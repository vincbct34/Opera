/**
 * Module d'analyse de l'historique des inscriptions par institution.
 * Calcule les statistiques nécessaires pour le scoring.
 */

import type { InstitutionHistory } from '../scoring/scoringEngine';
import type { PrismaClient, RegistrationStatus } from '@/app/generated/prisma';

// Types pour les données Prisma (compatibles sans importer le client)
interface RegistrationRecord {
  id: string;
  event_id: string;
  status: RegistrationStatus;
  date: Date;
  created_at: Date;
  was_present_comment: string | null;
  booked_seats: number;
  caretaker_count?: number | null;
  aesh_count?: number | null;
  category?: string[] | null;
  grades?: string[] | null;
  age_ranges?: string[] | null;
  want_formation?: boolean | null;
  want_preparation?: boolean | null;
  disabilities?: Array<{ count: number }>;
  event: {
    id: string;
    title: string;
    location?: string | null;
  };
}

/**
 * Calcule l'historique complet d'une institution.
 * @param institutionId - L'ID de l'institution.
 * @param prisma - Le client Prisma.
 * @returns L'historique calculé.
 */
export async function calculateInstitutionHistory(
  institutionId: string,
  prisma: PrismaClient,
): Promise<InstitutionHistory> {
  // Récupérer toutes les inscriptions de l'institution
  const registrations: RegistrationRecord[] = await prisma.registration.findMany({
    where: {
      institution_id: institutionId,
    },
    select: {
      id: true,
      event_id: true,
      status: true,
      date: true,
      created_at: true,
      was_present_comment: true,
      booked_seats: true,
      caretaker_count: true,
      aesh_count: true,
      category: true,
      grades: true,
      age_ranges: true,
      want_formation: true,
      want_preparation: true,
      event: {
        select: {
          id: true,
          title: true,
          location: true,
        },
      },
      disabilities: {
        select: {
          count: true,
        },
      },
    },
    orderBy: {
      date: 'desc',
    },
  });

  // Initialiser les compteurs
  let confirmedCount = 0;
  let attendedCount = 0;
  let noShowCount = 0;
  let cancelledCount = 0;
  let lastAttendedDate: Date | null = null;
  let recentNoShow = false;

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const recentRegistrations: InstitutionHistory['recentRegistrations'] = [];

  // Analyser chaque inscription
  for (const reg of registrations) {
    // Compter par statut
    if (reg.status === 'CONFIRMED') {
      confirmedCount++;
    } else if (reg.status === 'ATTENDED') {
      confirmedCount++;
      attendedCount++;
      if (!lastAttendedDate || reg.date > lastAttendedDate) {
        lastAttendedDate = reg.date;
      }
    } else if (reg.status === 'NO_SHOW') {
      confirmedCount++;
      noShowCount++;
      // Vérifier si c'est un NO_SHOW récent (dans les 6 derniers mois)
      if (reg.date >= sixMonthsAgo) {
        recentNoShow = true;
      }
    } else if (reg.status === 'CANCELLED') {
      cancelledCount++;
    }

    // Construire l'historique détaillé (limiter aux 10 dernières)
    if (recentRegistrations.length < 10) {
      let wasPresent: boolean | null = null;
      if (reg.status === 'ATTENDED') wasPresent = true;
      if (reg.status === 'NO_SHOW') wasPresent = false;

      // Calculer le nombre total de personnes avec disabilities
      const disabilitiesCount = reg.disabilities?.reduce((sum, d) => sum + d.count, 0) || 0;

      recentRegistrations.push({
        eventId: reg.event.id,
        eventTitle: reg.event.title,
        eventLocation: reg.event.location || undefined,
        date: reg.date,
        status: reg.status,
        wasPresent,
        comment: reg.was_present_comment || undefined,
        bookedSeats: reg.booked_seats,
        caretakerCount: reg.caretaker_count || undefined,
        aeshCount: reg.aesh_count || undefined,
        category: reg.category && reg.category.length > 0 ? reg.category : undefined,
        grades: reg.grades && reg.grades.length > 0 ? reg.grades : undefined,
        ageRanges: reg.age_ranges && reg.age_ranges.length > 0 ? reg.age_ranges : undefined,
        disabilitiesCount: disabilitiesCount > 0 ? disabilitiesCount : undefined,
        wantFormation: reg.want_formation || undefined,
        wantPreparation: reg.want_preparation || undefined,
      });
    }
  }

  // Calculer les taux
  const totalRegistrations = registrations.length;
  const attendanceRate = confirmedCount > 0 ? (attendedCount / confirmedCount) * 100 : 0;
  const confirmationRate = totalRegistrations > 0 ? (confirmedCount / totalRegistrations) * 100 : 0;

  // Calculer le délai depuis la dernière participation
  let monthsSinceLastAttendance: number | null = null;
  if (lastAttendedDate) {
    const now = new Date();
    const diffTime = now.getTime() - lastAttendedDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    monthsSinceLastAttendance = Math.floor(diffDays / 30);
  }

  return {
    institutionId,
    totalRegistrations,
    confirmedCount,
    attendedCount,
    noShowCount,
    cancelledCount,
    attendanceRate: Math.round(attendanceRate * 10) / 10,
    confirmationRate: Math.round(confirmationRate * 10) / 10,
    lastAttendedDate,
    monthsSinceLastAttendance,
    recentNoShow,
    recentRegistrations,
  };
}

/**
 * Calcule l'historique pour plusieurs institutions en batch.
 * @param institutionIds - Liste des IDs d'institutions.
 * @param prisma - Le client Prisma.
 * @returns Map des historiques par ID d'institution.
 */
export async function calculateMultipleInstitutionHistories(
  institutionIds: string[],
  prisma: PrismaClient,
): Promise<Map<string, InstitutionHistory>> {
  const historyMap = new Map<string, InstitutionHistory>();

  // Utiliser Promise.all pour paralléliser
  const histories = await Promise.all(
    institutionIds.map((id) => calculateInstitutionHistory(id, prisma)),
  );

  histories.forEach((history) => {
    historyMap.set(history.institutionId, history);
  });

  return historyMap;
}

/**
 * Obtenir un résumé de l'historique (version courte pour affichage).
 * @param history - L'historique de l'institution.
 * @returns Chaîne résumée.
 */
export function formatHistorySummary(history: InstitutionHistory): string {
  const parts: string[] = [];

  if (history.totalRegistrations === 0) {
    return 'Aucune participation';
  }

  parts.push(`${history.totalRegistrations} demande(s)`);

  if (history.confirmedCount > 0) {
    parts.push(`${history.confirmedCount} confirmée(s)`);
  }

  if (history.attendedCount > 0) {
    parts.push(`${Math.round(history.attendanceRate)}% présence`);
  }

  if (history.monthsSinceLastAttendance !== null) {
    const months = history.monthsSinceLastAttendance;
    if (months === 0) {
      parts.push('Dernière: ce mois');
    } else if (months === 1) {
      parts.push('Dernière: il y a 1 mois');
    } else if (months < 12) {
      parts.push(`Dernière: il y a ${months} mois`);
    } else {
      const years = Math.floor(months / 12);
      parts.push(`Dernière: il y a ${years} an(s)`);
    }
  }

  return parts.join(' | ');
}

/**
 * Déterminer la "santé" de l'historique (pour affichage visuel).
 * @param history - L'historique de l'institution.
 * @returns Objet contenant le niveau, la couleur et l'icône.
 */
export function getHistoryHealth(history: InstitutionHistory): {
  level: 'excellent' | 'good' | 'fair' | 'poor' | 'new';
  color: string;
  icon: string;
} {
  // Nouveau demandeur
  if (history.totalRegistrations === 0) {
    return {
      level: 'new',
      color: 'purple',
      icon: '🆕',
    };
  }

  // Pas encore de confirmations
  if (history.confirmedCount === 0) {
    return {
      level: 'fair',
      color: 'gray',
      icon: '➖',
    };
  }

  const rate = history.attendanceRate;

  // Excellent: > 80% de présence
  if (rate >= 80) {
    return {
      level: 'excellent',
      color: 'emerald',
      icon: '✅',
    };
  }

  // Good: 60-80%
  if (rate >= 60) {
    return {
      level: 'good',
      color: 'blue',
      icon: '👍',
    };
  }

  // Fair: 40-60%
  if (rate >= 40) {
    return {
      level: 'fair',
      color: 'amber',
      icon: '⚠️',
    };
  }

  // Poor: < 40%
  return {
    level: 'poor',
    color: 'red',
    icon: '❌',
  };
}

/**
 * Générer un rapport textuel de l'historique.
 * @param history - L'historique de l'institution.
 * @param registrationStatusLabels - Labels dynamiques pour les statuts d'inscription (optionnel).
 * @returns Rapport textuel.
 */
export function generateHistoryReport(
  history: InstitutionHistory,
  registrationStatusLabels?: Record<string, string>,
): string {
  if (history.totalRegistrations === 0) {
    return "Cet établissement n'a jamais fait de demande d'inscription auparavant.";
  }

  // Use dynamic labels if provided, otherwise fallback to defaults
  const labels = {
    confirmed: registrationStatusLabels?.CONFIRMED || 'Confirmées',
    attended: registrationStatusLabels?.ATTENDED || 'Présences',
    noShow: registrationStatusLabels?.NO_SHOW || 'Absences',
    cancelled: registrationStatusLabels?.CANCELLED || 'Annulations',
  };

  const lines: string[] = [];

  lines.push('📊 Statistiques globales');
  lines.push(`• Demandes totales: ${history.totalRegistrations}`);
  lines.push(
    `• ${labels.confirmed}: ${history.confirmedCount} (${Math.round(history.confirmationRate)}%)`,
  );

  if (history.confirmedCount > 0) {
    lines.push(
      `• ${labels.attended} effectives: ${history.attendedCount} (${Math.round(history.attendanceRate)}% de taux de présence)`,
    );
    if (history.noShowCount > 0) {
      lines.push(`• ${labels.noShow}: ${history.noShowCount}`);
    }
  }

  if (history.cancelledCount > 0) {
    lines.push(`• ${labels.cancelled}: ${history.cancelledCount}`);
  }

  if (history.lastAttendedDate) {
    const monthsAgo = history.monthsSinceLastAttendance ?? 0;
    if (monthsAgo === 0) {
      lines.push('• Dernière participation: ce mois-ci');
    } else if (monthsAgo === 1) {
      lines.push('• Dernière participation: il y a 1 mois');
    } else if (monthsAgo < 12) {
      lines.push(`• Dernière participation: il y a ${monthsAgo} mois`);
    } else {
      const years = Math.floor(monthsAgo / 12);
      const remainingMonths = monthsAgo % 12;
      let dateStr = `il y a ${years} an${years > 1 ? 's' : ''}`;
      if (remainingMonths > 0) {
        dateStr += ` et ${remainingMonths} mois`;
      }
      lines.push(`• Dernière participation: ${dateStr}`);
    }
  }

  if (history.recentNoShow) {
    lines.push('⚠️  Absence récente (dans les 6 derniers mois)');
  }

  return lines.join('\n');
}

/**
 * Cache simple en mémoire pour les historiques (optionnel).
 * À utiliser avec précaution en production (considérer Redis ou autre).
 */
class HistoryCache {
  private cache = new Map<string, { data: InstitutionHistory; timestamp: number }>();
  private ttl = 5 * 60 * 1000; // 5 minutes

  get(institutionId: string): InstitutionHistory | null {
    const entry = this.cache.get(institutionId);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(institutionId);
      return null;
    }

    return entry.data;
  }

  set(institutionId: string, data: InstitutionHistory): void {
    this.cache.set(institutionId, {
      data,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  clearInstitution(institutionId: string): void {
    this.cache.delete(institutionId);
  }
}

export const historyCache = new HistoryCache();

/**
 * Calcule l'historique avec cache.
 * @param institutionId - L'ID de l'institution.
 * @param prisma - Le client Prisma.
 * @returns L'historique calculé (depuis le cache ou la base de données).
 */
export async function calculateInstitutionHistoryWithCache(
  institutionId: string,
  prisma: PrismaClient,
): Promise<InstitutionHistory> {
  // Vérifier le cache
  const cached = historyCache.get(institutionId);
  if (cached) {
    return cached;
  }

  // Calculer et mettre en cache
  const history = await calculateInstitutionHistory(institutionId, prisma);
  historyCache.set(institutionId, history);

  return history;
}
