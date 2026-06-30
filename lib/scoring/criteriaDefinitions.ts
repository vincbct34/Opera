/**
 * Définitions des critères de scoring pour les inscriptions
 * Chaque critère a ses métadonnées, paramètres configurables et logique de calcul
 */

export type ScoringCriterionType =
  | 'ATTENDANCE_RATE'
  | 'MONTHS_SINCE_LAST'
  | 'TOTAL_PARTICIPATIONS'
  | 'RECENT_NO_SHOW'
  | 'IS_REP_INSTITUTION'
  | 'FIRST_TIME_APPLICANT'
  | 'ACCESSIBILITY_NEEDS'
  | 'EARLY_REGISTRATION'
  | 'INSTITUTION_TYPE'
  | 'REQUESTED_SEATS_COUNT'
  | 'CARETAKER_RATIO'
  | 'GEOGRAPHIC_ZONE'
  | 'EVENT_CATEGORY_MATCH'
  | 'AESH_COUNT';

export type ParameterValue = string | number | boolean | string[];

export interface CriterionDefinition {
  type: ScoringCriterionType;
  name: string;
  description: string;
  category: 'historique' | 'diversite' | 'priorite' | 'contexte';
  defaultWeight: number;
  defaultEnabled: boolean;
  isPenalty: boolean; // Indique si ce critère est pénalisant (score sera inversé automatiquement)
  defaultParameters: Record<string, ParameterValue>;
  parameterDefinitions: ParameterDefinition[];
}

export interface ParameterDefinition {
  key: string;
  label: string;
  type: 'number' | 'boolean' | 'select' | 'multiselect';
  defaultValue: ParameterValue;
  min?: number;
  max?: number;
  options?: Array<{ value: string | number; label: string }>;
  description?: string;
}

/**
 * Définitions de tous les critères disponibles
 */
export const CRITERIA_DEFINITIONS: Record<ScoringCriterionType, CriterionDefinition> = {
  ATTENDANCE_RATE: {
    type: 'ATTENDANCE_RATE',
    name: 'Taux de présence historique',
    description:
      "Récompense la fiabilité. Plus les élèves se sont présentés aux événements précédents, plus le score est élevé. Si l'établissement n'a aucun historique, le score est neutre (50%).",
    category: 'historique',
    defaultWeight: 40,
    defaultEnabled: true,
    isPenalty: false,
    defaultParameters: {
      bonusThreshold: 80,
      penaltyThreshold: 50,
      applyBonus: true,
      applyPenalty: true,
    },
    parameterDefinitions: [
      {
        key: 'bonusThreshold',
        label: 'Seuil de bonus (%)',
        type: 'number',
        defaultValue: 80,
        min: 0,
        max: 100,
        description: 'Taux de présence à partir duquel le score maximal (100) est accordé',
      },
      {
        key: 'penaltyThreshold',
        label: 'Seuil de pénalité (%)',
        type: 'number',
        defaultValue: 50,
        min: 0,
        max: 100,
        description: 'Taux de présence en dessous duquel le score minimal (0) est accordé',
      },
      {
        key: 'applyBonus',
        label: 'Appliquer le bonus maximal',
        type: 'boolean',
        defaultValue: true,
        description:
          'Si coché, le score 100 est appliqué au-dessus du seuil de bonus. Sinon, interpolation linéaire.',
      },
      {
        key: 'applyPenalty',
        label: 'Appliquer la pénalité',
        type: 'boolean',
        defaultValue: true,
        description:
          'Si coché, le score 0 est appliqué en dessous du seuil de pénalité. Sinon, interpolation linéaire.',
      },
    ],
  },

  MONTHS_SINCE_LAST: {
    type: 'MONTHS_SINCE_LAST',
    name: 'Délai depuis dernière participation',
    description:
      "Favorise la diversité des publics. Plus cela fait longtemps que l'établissement n'a pas participé, plus le score est élevé. Cela permet à de nouveaux publics d'accéder aux événements.",
    category: 'diversite',
    defaultWeight: 30,
    defaultEnabled: true,
    isPenalty: false,
    defaultParameters: {
      score12Months: 100,
      score6Months: 50,
      score3Months: 15,
      neverParticipatedScore: 100,
    },
    parameterDefinitions: [
      {
        key: 'score12Months',
        label: 'Score si 12 mois ou plus',
        type: 'number',
        defaultValue: 100,
        min: 0,
        max: 100,
        description: "Score accordé (sur 100) si la dernière participation date d'un an ou plus",
      },
      {
        key: 'score6Months',
        label: 'Score si 6 à 11 mois',
        type: 'number',
        defaultValue: 50,
        min: 0,
        max: 100,
        description: 'Score accordé (sur 100) si la dernière participation date de 6 à 11 mois',
      },
      {
        key: 'score3Months',
        label: 'Score si 3 à 5 mois',
        type: 'number',
        defaultValue: 15,
        min: 0,
        max: 100,
        description: 'Score accordé (sur 100) si la dernière participation date de 3 à 5 mois',
      },
      {
        key: 'neverParticipatedScore',
        label: 'Score si jamais participé',
        type: 'number',
        defaultValue: 100,
        min: 0,
        max: 100,
        description: 'Score accordé (sur 100) pour un établissement qui na jamais participé',
      },
    ],
  },

  TOTAL_PARTICIPATIONS: {
    type: 'TOTAL_PARTICIPATIONS',
    name: 'Nombre total de participations passées',
    description:
      'Soit favoriser les nouveaux établissements (diversité des publics), soit récompenser la fidélité. Selon le choix, les scores sont attribués par paliers.',
    category: 'diversite',
    defaultWeight: 10,
    defaultEnabled: false,
    isPenalty: false,
    defaultParameters: {
      favorNew: true,
    },
    parameterDefinitions: [
      {
        key: 'favorNew',
        label: 'Favoriser les nouveaux établissements',
        type: 'boolean',
        defaultValue: true,
        description:
          'Si coché, favorise la diversité : 100 pts (jamais), 70 pts (1-2), 40 pts (3-5), 10 pts (6+). Si décoché, récompense la fidélité : 100 pts (10+), 70 pts (5-9), 40 pts (2-4), 10 pts (0-1).',
      },
    ],
  },

  RECENT_NO_SHOW: {
    type: 'RECENT_NO_SHOW',
    name: 'Absence récente (pénalité)',
    description:
      "Applique une pénalité si l'établissement s'est inscrit mais ne s'est pas présenté à sa dernière inscription confirmée. Cela pénalise les \"annulations de dernière minute\".",
    category: 'historique',
    defaultWeight: 15,
    defaultEnabled: true,
    isPenalty: true,
    defaultParameters: {
      penaltyScore: 100,
    },
    parameterDefinitions: [
      {
        key: 'penaltyScore',
        label: 'Score de pénalité (sur 100)',
        type: 'number',
        defaultValue: 100,
        min: 0,
        max: 100,
        description:
          'Score de pénalité appliqué si une absence récente est détectée (sera multiplié par le poids du critère)',
      },
    ],
  },

  IS_REP_INSTITUTION: {
    type: 'IS_REP_INSTITUTION',
    name: 'Établissement REP/REP+',
    description:
      "Accorde un bonus prioritaire aux établissements en éducation prioritaire (Réseaux REP ou REP+). Score 100 si l'établissement est REP/REP+, 0 sinon.",
    category: 'priorite',
    defaultWeight: 15,
    defaultEnabled: true,
    isPenalty: false,
    defaultParameters: {},
    parameterDefinitions: [],
  },

  FIRST_TIME_APPLICANT: {
    type: 'FIRST_TIME_APPLICANT',
    name: 'Première demande (jamais participé)',
    description:
      "Accorde un bonus aux établissements qui s'inscrivent pour la première fois. Score 100 si c'est la première demande, 0 sinon. Favorise les nouveaux publics.",
    category: 'diversite',
    defaultWeight: 10,
    defaultEnabled: true,
    isPenalty: false,
    defaultParameters: {},
    parameterDefinitions: [],
  },

  ACCESSIBILITY_NEEDS: {
    type: 'ACCESSIBILITY_NEEDS',
    name: "Besoins d'accessibilité",
    description:
      "Favorise les groupes ayant des besoins d'accessibilité spécifiques (handicap moteur, visuel, auditif, etc.). Score 100 si des besoins sont déclarés, 0 sinon.",
    category: 'priorite',
    defaultWeight: 2,
    defaultEnabled: true,
    isPenalty: false,
    defaultParameters: {},
    parameterDefinitions: [],
  },

  EARLY_REGISTRATION: {
    type: 'EARLY_REGISTRATION',
    name: 'Demande précoce',
    description:
      "Récompense les inscriptions faites suffisamment à l'avance avant l'événement. Score 100 si l'inscription est faite au moins X jours avant l'événement, 0 sinon.",
    category: 'contexte',
    defaultWeight: 0,
    defaultEnabled: false,
    isPenalty: false,
    defaultParameters: {
      earlyThresholdDays: 30,
    },
    parameterDefinitions: [
      {
        key: 'earlyThresholdDays',
        label: 'Délai minimum (jours avant lévénement)',
        type: 'number',
        defaultValue: 30,
        min: 1,
        max: 365,
        description:
          "Nombre minimum de jours entre l'inscription et la date de l'événement pour obtenir le bonus (score 100)",
      },
    ],
  },

  INSTITUTION_TYPE: {
    type: 'INSTITUTION_TYPE',
    name: "Type d'établissement",
    description:
      "Permet de favoriser certains types d'établissements (crèches, écoles, collèges, etc.). Score 100 si l'établissement correspond à un type favorisé, 0 sinon. Score 50 (neutre) si aucun type n'est sélectionné.",
    category: 'priorite',
    defaultWeight: 0,
    defaultEnabled: false,
    isPenalty: false,
    defaultParameters: {
      favoredTypes: [],
    },
    parameterDefinitions: [
      {
        key: 'favoredTypes',
        label: "Types d'établissements à favoriser",
        type: 'multiselect',
        defaultValue: [],
        options: [
          { value: 'CRECHE', label: 'Crèche' },
          { value: 'MATERNELLE', label: 'Maternelle' },
          { value: 'ELEMENTAIRE', label: 'Élémentaire' },
          { value: 'COLLEGE', label: 'Collège' },
          { value: 'LYCEE', label: 'Lycée' },
          { value: 'SUPERIEUR', label: 'Supérieur' },
          { value: 'ASSOCIATION', label: 'Association / Publics éloignés' },
          { value: 'CONSERVATOIRE', label: 'Conservatoire' },
          { value: 'PERISCOLAIRE', label: 'Centre de loisirs / Périscolaire' },
          { value: 'PUBLICS_EMPECHES', label: 'Publics empêchés / Santé / Handicap' },
          { value: 'AUTRE', label: 'Autre' },
        ],
        description:
          "Sélectionnez les types d'établissements à privilégier. Si aucun n'est sélectionné, le critère est neutre (score 50).",
      },
    ],
  },

  REQUESTED_SEATS_COUNT: {
    type: 'REQUESTED_SEATS_COUNT',
    name: 'Taille du groupe (nombre de places)',
    description:
      'Permet de favoriser les petits ou les grands groupes selon la préférence choisie. Score 100 pour le type favorisé, 50 pour les groupes moyens, 0 pour le type non favorisé. Neutre = score 50 pour tous.',
    category: 'contexte',
    defaultWeight: 0,
    defaultEnabled: false,
    isPenalty: false,
    defaultParameters: {
      preference: 'neutral',
      smallThreshold: 20,
      largeThreshold: 60,
    },
    parameterDefinitions: [
      {
        key: 'preference',
        label: 'Préférence de groupe',
        type: 'select',
        defaultValue: 'neutral',
        options: [
          { value: 'small', label: 'Favoriser les petits groupes' },
          { value: 'large', label: 'Favoriser les grands groupes' },
          { value: 'neutral', label: 'Neutre (score 50 pour tous)' },
        ],
        description: "Type de groupe à privilégier dans l'attribution des places",
      },
      {
        key: 'smallThreshold',
        label: 'Seuil "petit groupe"',
        type: 'number',
        defaultValue: 20,
        min: 1,
        max: 100,
        description:
          'Nombre maximum de places pour être considéré comme un petit groupe (score 100 si "petits groupes" favorisé)',
      },
      {
        key: 'largeThreshold',
        label: 'Seuil "grand groupe"',
        type: 'number',
        defaultValue: 60,
        min: 20,
        max: 200,
        description:
          'Nombre minimum de places pour être considéré comme un grand groupe (score 100 si "grands groupes" favorisé)',
      },
    ],
  },

  CARETAKER_RATIO: {
    type: 'CARETAKER_RATIO',
    name: 'Ratio accompagnateurs/élèves',
    description:
      "Évalue le ratio d'accompagnateurs par rapport au nombre d'élèves. Le ratio est calculé : nombre d'accompagnateurs / nombre de places. Score 100 si le ratio est élevé (2×minRatio), 70 si correct, 30 sinon.",
    category: 'contexte',
    defaultWeight: 0,
    defaultEnabled: false,
    isPenalty: false,
    defaultParameters: {
      preferHigh: true,
      minRatio: 0.05,
    },
    parameterDefinitions: [
      {
        key: 'preferHigh',
        label: 'Favoriser un ratio élevé',
        type: 'boolean',
        defaultValue: true,
        description:
          "Si coché, un ratio d'accompagnateurs élevé est favorisé. Sinon, un ratio faible est favorisé.",
      },
      {
        key: 'minRatio',
        label: 'Ratio minimum attendu',
        type: 'number',
        defaultValue: 0.05,
        min: 0,
        max: 1,
        description:
          'Ratio minimum attendu (ex: 0.05 = 1 accompagnateur pour 20 élèves). Au-dessus de 2× ce ratio, score 100. Au-dessus de ce ratio, score 70. Sinon, score 30.',
      },
    ],
  },

  GEOGRAPHIC_ZONE: {
    type: 'GEOGRAPHIC_ZONE',
    name: 'Zone géographique',
    description:
      "Attribue un score différent selon la localisation de l'établissement, de Montpellier jusqu'au hors-département. Permet de privilégier le public local ou régional.",
    category: 'priorite',
    defaultWeight: 10,
    defaultEnabled: true,
    isPenalty: false,
    defaultParameters: {
      montpellierScore: 100,
      metropoleScore: 75,
      heraultScore: 50,
      outsideScore: 25,
    },
    parameterDefinitions: [
      {
        key: 'montpellierScore',
        label: 'Score Montpellier (sur 100)',
        type: 'number',
        defaultValue: 100,
        min: 0,
        max: 100,
        description: 'Score (sur 100) pour les établissements situés à Montpellier',
      },
      {
        key: 'metropoleScore',
        label: 'Score Métropole (sur 100)',
        type: 'number',
        defaultValue: 75,
        min: 0,
        max: 100,
        description: 'Score (sur 100) pour les établissements de la Métropole de Montpellier',
      },
      {
        key: 'heraultScore',
        label: 'Score Hérault (sur 100)',
        type: 'number',
        defaultValue: 50,
        min: 0,
        max: 100,
        description:
          "Score (sur 100) pour les établissements du département de l'Hérault (hors métropole)",
      },
      {
        key: 'outsideScore',
        label: 'Score Hors département (sur 100)',
        type: 'number',
        defaultValue: 25,
        min: 0,
        max: 100,
        description: "Score (sur 100) pour les établissements hors de l'Hérault",
      },
    ],
  },

  EVENT_CATEGORY_MATCH: {
    type: 'EVENT_CATEGORY_MATCH',
    name: 'Correspondance public / événement',
    description:
      "Favorise les inscriptions dont le public (Collèges, Lycées, etc.) correspond aux catégories de l'événement. Score 100 pour une correspondance parfaite, 75 pour partielle (≥50%), 50 pour minimale (≥1 catégorie), 0 si aucune.",
    category: 'contexte',
    defaultWeight: 0,
    defaultEnabled: false,
    isPenalty: false,
    defaultParameters: {
      perfectMatchScore: 100,
      partialMatchScore: 75,
      minimalMatchScore: 50,
      noMatchScore: 0,
      partialThreshold: 50,
    },
    parameterDefinitions: [
      {
        key: 'perfectMatchScore',
        label: 'Score match parfait (sur 100)',
        type: 'number',
        defaultValue: 100,
        min: 0,
        max: 100,
        description:
          "Score attribué si toutes les catégories de l'inscription sont dans l'événement",
      },
      {
        key: 'partialMatchScore',
        label: 'Score match partiel (sur 100)',
        type: 'number',
        defaultValue: 75,
        min: 0,
        max: 100,
        description: 'Score attribué si au moins le seuil de correspondance partielle est atteint',
      },
      {
        key: 'minimalMatchScore',
        label: 'Score match minimal (sur 100)',
        type: 'number',
        defaultValue: 50,
        min: 0,
        max: 100,
        description: 'Score attribué si au moins 1 catégorie correspond',
      },
      {
        key: 'noMatchScore',
        label: 'Score sans correspondance (sur 100)',
        type: 'number',
        defaultValue: 0,
        min: 0,
        max: 100,
        description: "Score attribué si aucune catégorie ne correspond à l'événement",
      },
      {
        key: 'partialThreshold',
        label: 'Seuil match partiel (%)',
        type: 'number',
        defaultValue: 50,
        min: 0,
        max: 100,
        description:
          'Pourcentage minimum de catégories correspondantes pour le score de match partiel',
      },
    ],
  },

  AESH_COUNT: {
    type: 'AESH_COUNT',
    name: 'Accompagnants AESH déclarés',
    description:
      "Favorise les groupes ayant déclaré des accompagnants AESH (Accompagnants d'Élèves en Situation de Handicap). Score progressif selon le nombre d'AESH déclarés par rapport au seuil configuré.",
    category: 'priorite',
    defaultWeight: 0,
    defaultEnabled: false,
    isPenalty: false,
    defaultParameters: {
      minCount: 1,
      highCount: 3,
    },
    parameterDefinitions: [
      {
        key: 'minCount',
        label: 'AESH minimum',
        type: 'number',
        defaultValue: 1,
        min: 1,
        max: 20,
        description: "Nombre minimum d'AESH pour obtenir un score partiel (70)",
      },
      {
        key: 'highCount',
        label: 'AESH élevé',
        type: 'number',
        defaultValue: 3,
        min: 1,
        max: 20,
        description: "Nombre d'AESH à partir duquel le score maximal (100) est accordé",
      },
    ],
  },
};

/**
 * Catégories de critères avec leurs labels
 */
export const CRITERION_CATEGORIES = {
  historique: {
    label: 'Historique & Fiabilité',
    description: "Critères basés sur l'historique de participation de l'établissement",
    color: 'blue',
  },
  diversite: {
    label: 'Diversité & Équité',
    description: 'Critères favorisant la diversité des participants',
    color: 'purple',
  },
  priorite: {
    label: 'Priorités institutionnelles',
    description: 'Critères liés aux priorités de politique éducative',
    color: 'emerald',
  },
  contexte: {
    label: 'Contexte de la demande',
    description: 'Critères liés aux caractéristiques de la demande',
    color: 'amber',
  },
} as const;

/**
 * Obtenir la définition d'un critère par son type
 */
export function getCriterionDefinition(
  type: ScoringCriterionType,
): CriterionDefinition | undefined {
  return CRITERIA_DEFINITIONS[type];
}

/**
 * Obtenir tous les critères d'une catégorie
 */
export function getCriteriaByCategory(
  category: keyof typeof CRITERION_CATEGORIES,
): CriterionDefinition[] {
  return Object.values(CRITERIA_DEFINITIONS).filter((c) => c.category === category);
}

/**
 * Obtenir les critères activés par défaut
 */
export function getDefaultEnabledCriteria(): CriterionDefinition[] {
  return Object.values(CRITERIA_DEFINITIONS).filter((c) => c.defaultEnabled);
}
