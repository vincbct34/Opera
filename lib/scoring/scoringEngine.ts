import type { ScoringCriterionType, ParameterValue } from './criteriaDefinitions';
import { getCriterionDefinition } from './criteriaDefinitions';
import { determineGeographicZone } from '@/lib/validation/geographicZone';
import type { RegistrationStatus, Accessibility, PublicCategory, SchoolGrade, AgeRange } from '@/app/generated/prisma/enums';

export interface CriterionConfig {
  type: ScoringCriterionType;
  enabled: boolean;
  weight: number;
  parameters?: Record<string, ParameterValue>;
}

export interface InstitutionHistory {
  institutionId: string;
  totalRegistrations: number;
  confirmedCount: number;
  attendedCount: number;
  noShowCount: number;
  cancelledCount: number;
  attendanceRate: number;
  confirmationRate: number;
  lastAttendedDate: Date | null;
  monthsSinceLastAttendance: number | null;
  recentNoShow: boolean;
  recentRegistrations: Array<{
    eventId: string;
    eventTitle: string;
    eventLocation?: string;
    date: Date;
    status: RegistrationStatus;
    wasPresent: boolean | null;
    comment?: string;
    bookedSeats: number;
    caretakerCount?: number;
    aeshCount?: number;
    category?: string[];
    grades?: string[];
    ageRanges?: string[];
    disabilitiesCount?: number;
    wantFormation?: boolean;
    wantPreparation?: boolean;
  }>;
}

export interface RegistrationData {
  id: string;
  user_id: string;
  institution_id: string;
  event_id: string;
  date: Date;
  booked_seats: number;
  caretaker_count: number | null;
  aesh_count: number | null;
  comments: string | null;
  status: RegistrationStatus;
  created_at: Date;
  category: PublicCategory[];
  grades?: SchoolGrade[];
  age_ranges?: AgeRange[];
  institution: {
    id: string;
    name: string;
    type: PublicCategory[];
    is_rep: boolean;
    address?: {
      city: string;
      zip_code: string | null;
    };
  };
  event?: {
    id: string;
    category: PublicCategory[];
    grades?: SchoolGrade[];
    age_ranges?: AgeRange[];
  };
  disabilities?: Array<{
    type: Accessibility;
    count: number;
  }>;
}

export interface RegistrationWithHistory {
  registration: RegistrationData;
  institutionHistory: InstitutionHistory;
}

export interface ScoringResult {
  totalScore: number;
  maxScore: number;
  normalizedScore: number;
  breakdown: CriterionScore[];
}

export interface CriterionScore {
  type: ScoringCriterionType;
  weight: number;
  rawScore: number;
  weightedScore: number;
  details?: string;
}

/**
 * Moteur de calcul des scores
 */
export class ScoringEngine {
  private config: CriterionConfig[];

  constructor(config: CriterionConfig[]) {
    this.config = config.filter((c) => c.enabled);
  }

  /**
   * Calcule le score total d'une inscription
   */
  calculateScore(data: RegistrationWithHistory): ScoringResult {
    const breakdown: CriterionScore[] = [];
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const criterion of this.config) {
      const rawScore = this.calculateCriterionScore(criterion, data);

      // Récupérer la définition du critère pour savoir si c'est une pénalité
      const criterionDef = getCriterionDefinition(criterion.type);
      const isPenalty = criterionDef?.isPenalty ?? false;

      // Si c'est un critère pénalisant, inverser le score
      const adjustedScore = isPenalty ? -rawScore : rawScore;
      const weightedScore = (adjustedScore * criterion.weight) / 100;

      breakdown.push({
        type: criterion.type,
        weight: criterion.weight,
        rawScore: adjustedScore,
        weightedScore,
      });

      totalWeightedScore += weightedScore;
      totalWeight += Math.abs(criterion.weight);
    }

    // Normaliser le score sur 100
    const normalizedScore =
      totalWeight > 0 ? Math.round((totalWeightedScore * 100) / totalWeight) : 0;

    return {
      totalScore: totalWeightedScore,
      maxScore: totalWeight,
      normalizedScore: Math.max(0, Math.min(100, normalizedScore)),
      breakdown,
    };
  }

  /**
   * Calcule le score pour un critère spécifique
   */
  private calculateCriterionScore(
    criterion: CriterionConfig,
    data: RegistrationWithHistory,
  ): number {
    const { registration, institutionHistory } = data;

    switch (criterion.type) {
      case 'ATTENDANCE_RATE':
        return this.calculateAttendanceRateScore(institutionHistory, criterion.parameters);

      case 'MONTHS_SINCE_LAST':
        return this.calculateMonthsSinceLastScore(institutionHistory, criterion.parameters);

      case 'TOTAL_PARTICIPATIONS':
        return this.calculateTotalParticipationsScore(institutionHistory, criterion.parameters);

      case 'RECENT_NO_SHOW':
        return this.calculateRecentNoShowScore(institutionHistory, criterion.parameters);

      case 'IS_REP_INSTITUTION':
        return registration.institution.is_rep ? 100 : 0;

      case 'FIRST_TIME_APPLICANT':
        return institutionHistory.totalRegistrations === 0 ? 100 : 0;

      case 'ACCESSIBILITY_NEEDS':
        return registration.disabilities && registration.disabilities.length > 0 ? 100 : 0;

      case 'EARLY_REGISTRATION':
        return this.calculateEarlyRegistrationScore(registration, criterion.parameters);

      case 'INSTITUTION_TYPE':
        return this.calculateInstitutionTypeScore(registration, criterion.parameters);

      case 'REQUESTED_SEATS_COUNT':
        return this.calculateRequestedSeatsScore(registration, criterion.parameters);

      case 'CARETAKER_RATIO':
        return this.calculateCaretakerRatioScore(registration, criterion.parameters);

      case 'GEOGRAPHIC_ZONE':
        return this.calculateGeographicZoneScore(registration, criterion.parameters);

      case 'EVENT_CATEGORY_MATCH':
        return this.calculateEventCategoryMatchScore(registration, criterion.parameters);

      case 'AESH_COUNT':
        return this.calculateAeshCountScore(registration, criterion.parameters);

      default:
        return 0;
    }
  }

  // === Implémentations des calculs spécifiques ===

  private calculateAttendanceRateScore(
    history: InstitutionHistory,
    params?: Record<string, ParameterValue>,
  ): number {
    if (history.confirmedCount === 0) return 50; // Neutre si pas d'historique

    const rate = (history.attendedCount / history.confirmedCount) * 100;

    const bonusThreshold = (params?.bonusThreshold as number) ?? 80;
    const penaltyThreshold = (params?.penaltyThreshold as number) ?? 50;
    const applyBonus = (params?.applyBonus as boolean) ?? true;
    const applyPenalty = (params?.applyPenalty as boolean) ?? true;

    if (rate >= bonusThreshold && applyBonus) return 100;
    if (rate <= penaltyThreshold && applyPenalty) return 0;

    // Interpolation linéaire
    return Math.round(((rate - penaltyThreshold) / (bonusThreshold - penaltyThreshold)) * 100);
  }

  private calculateMonthsSinceLastScore(
    history: InstitutionHistory,
    params?: Record<string, ParameterValue>,
  ): number {
    const months = history.monthsSinceLastAttendance;

    if (months === null || months === undefined) {
      return (params?.neverParticipatedScore as number) ?? 100;
    }

    const score12Months = (params?.score12Months as number) ?? 100;
    const score6Months = (params?.score6Months as number) ?? 50;
    const score3Months = (params?.score3Months as number) ?? 15;

    if (months >= 12) return score12Months;
    if (months >= 6) return score6Months;
    if (months >= 3) return score3Months;
    return 0;
  }

  private calculateTotalParticipationsScore(
    history: InstitutionHistory,
    params?: Record<string, ParameterValue>,
  ): number {
    const favorNew = (params?.favorNew as boolean) ?? true;
    const total = history.totalRegistrations;

    if (favorNew) {
      // Favoriser les nouveaux
      if (total === 0) return 100;
      if (total <= 2) return 70;
      if (total <= 5) return 40;
      return 10;
    } else {
      // Récompenser la fidélité
      if (total >= 10) return 100;
      if (total >= 5) return 70;
      if (total >= 2) return 40;
      return 10;
    }
  }

  private calculateRecentNoShowScore(
    history: InstitutionHistory,
    params?: Record<string, ParameterValue>,
  ): number {
    const penaltyScore = (params?.penaltyScore as number) ?? 100;
    // Retourne un score positif qui sera inversé par le flag isPenalty
    // pour créer la pénalité (ex: 100 * 15% = 15 points, puis inversé en -15)
    return history.recentNoShow ? penaltyScore : 0;
  }

  private calculateEarlyRegistrationScore(
    registration: RegistrationData,
    params?: Record<string, ParameterValue>,
  ): number {
    // Pour l'instant, basé sur le délai entre inscription et événement
    const earlyThresholdDays = (params?.earlyThresholdDays as number) ?? 30;
    const daysBeforeEvent = this.daysBetween(
      new Date(registration.created_at),
      new Date(registration.date),
    );

    return daysBeforeEvent >= earlyThresholdDays ? 100 : 0;
  }

  private calculateInstitutionTypeScore(
    registration: RegistrationData,
    params?: Record<string, ParameterValue>,
  ): number {
    const favoredTypes = (params?.favoredTypes as string[]) ?? [];

    if (favoredTypes.length === 0) return 50; // Neutre si aucun type favori

    const hasMatchingType = registration.institution.type.some((type) =>
      favoredTypes.includes(type),
    );

    return hasMatchingType ? 100 : 0;
  }

  private calculateRequestedSeatsScore(
    registration: RegistrationData,
    params?: Record<string, ParameterValue>,
  ): number {
    const seats = registration.booked_seats;
    const preference = (params?.preference as string) ?? 'neutral';
    const smallThreshold = (params?.smallThreshold as number) ?? 20;
    const largeThreshold = (params?.largeThreshold as number) ?? 60;

    if (preference === 'small') {
      if (seats <= smallThreshold) return 100;
      if (seats <= (smallThreshold + largeThreshold) / 2) return 50;
      return 0;
    } else if (preference === 'large') {
      if (seats >= largeThreshold) return 100;
      if (seats >= (smallThreshold + largeThreshold) / 2) return 50;
      return 0;
    }

    return 50; // Neutre
  }

  private calculateCaretakerRatioScore(
    registration: RegistrationData,
    params?: Record<string, ParameterValue>,
  ): number {
    const caretakerCount = registration.caretaker_count ?? 0;
    const seats = registration.booked_seats;

    if (seats === 0) return 0;

    const ratio = caretakerCount / seats;
    const preferHigh = (params?.preferHigh as boolean) ?? true;
    const minRatio = (params?.minRatio as number) ?? 0.05;

    if (preferHigh) {
      if (ratio >= minRatio * 2) return 100;
      if (ratio >= minRatio) return 70;
      return 30;
    } else {
      if (ratio <= minRatio) return 100;
      if (ratio <= minRatio * 2) return 70;
      return 30;
    }
  }

  private calculateGeographicZoneScore(
    registration: RegistrationData,
    params?: Record<string, ParameterValue>,
  ): number {
    // Si pas d'adresse, retourner 50 (neutre)
    if (!registration.institution.address) return 50;

    const { city, zip_code } = registration.institution.address;
    const zone = determineGeographicZone(city, zip_code || '');

    // Récupérer les scores configurés pour chaque zone
    const montpellierScore = (params?.montpellierScore as number) ?? 100;
    const metropoleScore = (params?.metropoleScore as number) ?? 75;
    const heraultScore = (params?.heraultScore as number) ?? 50;
    const outsideScore = (params?.outsideScore as number) ?? 25;

    switch (zone) {
      case 'MONTPELLIER':
        return montpellierScore;
      case 'METROPOLE':
        return metropoleScore;
      case 'HERAULT':
        return heraultScore;
      case 'OUTSIDE':
        return outsideScore;
      default:
        return 50;
    }
  }

  private calculateEventCategoryMatchScore(
    registration: RegistrationData,
    params?: Record<string, ParameterValue>,
  ): number {
    // Si pas de données d'événement ou pas de cibles de niveau/âge, retourner 50 (neutre)
    if (
      !registration.event ||
      ((!registration.event.grades || registration.event.grades.length === 0) &&
        (!registration.event.age_ranges || registration.event.age_ranges.length === 0))
    ) {
      return 50;
    }

    const registrationGrades = registration.grades ?? [];
    const registrationAgeRanges = registration.age_ranges ?? [];

    // Si pas de niveaux/tranches dans l'inscription, retourner le score "pas de correspondance"
    if (registrationGrades.length === 0 && registrationAgeRanges.length === 0) {
      return (params?.noMatchScore as number) || 0;
    }

    const eventGrades = registration.event.grades ?? [];
    const eventAgeRanges = registration.event.age_ranges ?? [];

    const matchingGrades = registrationGrades.filter((grade) => eventGrades.includes(grade)).length;
    const matchingAgeRanges = registrationAgeRanges.filter((ageRange) =>
      eventAgeRanges.includes(ageRange),
    ).length;

    const matchingCount = matchingGrades + matchingAgeRanges;
    const registrationTargetsCount = registrationGrades.length + registrationAgeRanges.length;

    if (registrationTargetsCount === 0) {
      return (params?.noMatchScore as number) || 0;
    }

    if (matchingCount === 0) {
      // Aucune correspondance
      return (params?.noMatchScore as number) || 0;
    }

    const matchPercentage = (matchingCount / registrationTargetsCount) * 100;

    // Récupérer les paramètres
    const perfectMatchScore = (params?.perfectMatchScore as number) ?? 100;
    const partialMatchScore = (params?.partialMatchScore as number) ?? 75;
    const minimalMatchScore = (params?.minimalMatchScore as number) ?? 50;
    const partialThreshold = (params?.partialThreshold as number) ?? 50;

    // Match parfait : toutes les catégories correspondent
    if (matchPercentage === 100) {
      return perfectMatchScore;
    }

    // Match partiel : au moins le seuil est atteint
    if (matchPercentage >= partialThreshold) {
      return partialMatchScore;
    }

    // Match minimal : au moins 1 catégorie correspond
    return minimalMatchScore;
  }

  private calculateAeshCountScore(
    registration: RegistrationData,
    params?: Record<string, ParameterValue>,
  ): number {
    const aeshCount = registration.aesh_count ?? 0;

    if (aeshCount === 0) return 0;

    const minCount = (params?.minCount as number) ?? 1;
    const highCount = (params?.highCount as number) ?? 3;

    if (aeshCount >= highCount) return 100;
    if (aeshCount >= minCount) return 70;

    return 30;
  }

  // === Utilitaires ===

  private daysBetween(date1: Date, date2: Date): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Obtenir le poids total de tous les critères activés
   */
  getTotalWeight(): number {
    return this.config.reduce((sum, c) => sum + Math.abs(c.weight), 0);
  }

  /**
   * Vérifier si la configuration est valide (poids total = 100)
   */
  isConfigValid(): boolean {
    const total = this.getTotalWeight();
    return total === 100;
  }

  /**
   * Obtenir un résumé de la configuration
   */
  getConfigSummary(): {
    totalCriteria: number;
    enabledCriteria: number;
    totalWeight: number;
    isValid: boolean;
  } {
    return {
      totalCriteria: this.config.length,
      enabledCriteria: this.config.filter((c) => c.enabled).length,
      totalWeight: this.getTotalWeight(),
      isValid: this.isConfigValid(),
    };
  }
}

/**
 * Créer un moteur de scoring depuis une configuration
 */
export function createScoringEngine(criteria: CriterionConfig[]): ScoringEngine {
  return new ScoringEngine(criteria);
}

/**
 * Calculer le score d'une inscription avec une configuration donnée
 */
export function calculateRegistrationScore(
  registration: RegistrationWithHistory,
  criteria: CriterionConfig[],
): ScoringResult {
  const engine = createScoringEngine(criteria);
  return engine.calculateScore(registration);
}
