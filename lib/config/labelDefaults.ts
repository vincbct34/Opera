/**
 * Default label mappings for displaying database enum values as human-readable French text
 *
 * This file contains ONLY static default values with NO server dependencies.
 * It can be safely imported in both client and server components.
 *
 * For dynamic labels that can be customized by admins, use configService (server-only).
 */

// ============================================================================
// Default Labels (static, safe for client-side)
// ============================================================================

/**
 * Default labels for EventType enum values
 */
export const DEFAULT_EVENT_TYPE_LABELS: Record<string, string> = {
  OPERA: 'Opéra',
  CONCERT_LYRIQUE: 'Concert lyrique',
  SYMPHONIQUE: 'Symphonique',
  CHAMBRE_BAROQUE: 'Chambre / Baroque',
  EN_FAMILLE: 'En famille',
  OPERA_JUNIOR: 'Opéra Junior',
  CINE_CONCERT: 'Ciné-concert',
  INSOLITE: 'Insolite',
  THEATRE_MUSICAL: 'Théâtre musical',
  DANSE: 'Danse',
  CONTE_MUSICAL: 'Conte musical',
  CONCERT_DECENTRALISE: 'Concert décentralisé',
  ELECTRO_ACOUSTIQUE: 'Électro-acoustique',
  MUSIQUE_ELECTRONIQUE: 'Musique électronique',
  CONCERT_LECTURE: 'Concert lecture',
  PLEIN_AIR: 'En plein air',
  JAZZ: 'Jazz',
  LITTERATURE: 'Littérature',
  MASTERCLASS: 'Masterclass',
  MUSIQUE_ET_BIEN_ETRE: 'Musique et bien-être',
  MUSIQUE_ACTUELLE: 'Musiques actuelles',
  PARTICIPATIF: 'Participatif',
  PROMENADE_SONORE: 'Promenade sonore',
  ATELIER: 'Atelier',
  GALA: 'Gala',
  EXPOSITION: 'Exposition',
  PORTES_OUVERTES: 'Portes ouvertes',
  INTERDISCIPLINAIRE: 'Interdisciplinaire',
  SPECTACLE_EDUCATIF: 'Spectacle éducatif',
  CARITATIF: 'Caritatif',
  THEATRE: 'Théâtre',
  RENDEZ_VOUS: 'Rendez-vous',
  MUSIQUES_DAILLEURS: "Musiques d'ailleurs",
  BAROQUE: 'Baroque',
};

/**
 * Default labels for PublicCategory enum values
 */
export const DEFAULT_PUBLIC_CATEGORY_LABELS: Record<string, string> = {
  CRECHE: 'Crèche',
  MATERNELLE: 'Maternelle',
  ELEMENTAIRE: 'Élémentaire',
  COLLEGE: 'Collège',
  LYCEE: 'Lycée',
  SUPERIEUR: 'Enseignement supérieur',
  CONSERVATOIRE: 'Conservatoire et école de musique',
  ASSOCIATION: 'Association / Publics éloignés',
  PERISCOLAIRE: 'Centre de loisirs / Périscolaire',
  PUBLICS_EMPECHES: 'Publics empêchés / Santé / Handicap',
  AUTRE: 'Autre',
};

/**
 * Default labels for EventStatus enum values
 */
export const DEFAULT_EVENT_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Ouvert',
  CLOSED: 'Fermé',
  ARCHIVED: 'Archivé',
};

/**
 * Default labels for RegistrationStatus enum values
 */
export const DEFAULT_REGISTRATION_STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  CANCELLED: 'Annulée',
  REJECTED: 'Refusée',
  ATTENDED: 'Présent',
  NO_SHOW: 'Absent',
};

/**
 * Default labels for Accessibility enum values
 */
export const DEFAULT_ACCESSIBILITY_LABELS: Record<string, string> = {
  VISUAL: 'Handicap visuel',
  AUDITORY: 'Handicap auditif',
  MOTOR: 'Mobilité réduite',
  PSYCHIC: 'Handicap psychique',
  NEUROATYPICAL: 'Neuroatypique',
  OTHER: 'Autre',
};

/**
 * Default labels for SchoolGrade enum values
 */
export const DEFAULT_SCHOOL_GRADE_LABELS: Record<string, string> = {
  PS: 'Petite section',
  MS: 'Moyenne section',
  GS: 'Grande section',
  CP: 'CP',
  CE1: 'CE1',
  CE2: 'CE2',
  CM1: 'CM1',
  CM2: 'CM2',
  SIXIEME: '6ème',
  CINQUIEME: '5ème',
  QUATRIEME: '4ème',
  TROISIEME: '3ème',
  SECONDE: '2nde',
  PREMIERE: '1ère',
  TERMINALE: 'Terminale',
};

/**
 * Default labels for AgeRange enum values
 */
export const DEFAULT_AGE_RANGE_LABELS: Record<string, string> = {
  AGE_0_3: '0-3 ans',
  AGE_3_6: '3-6 ans',
  AGE_6_11: '6-11 ans',
  AGE_11_15: '11-15 ans',
  AGE_15_18: '15-18 ans',
  AGE_18_PLUS: '18 ans et plus',
};

// ============================================================================
// Helper Functions (using static defaults only - safe for client)
// ============================================================================

/**
 * Get the label for an event type (static defaults)
 */
export function getEventTypeLabel(type: string): string {
  return DEFAULT_EVENT_TYPE_LABELS[type] || type;
}

/**
 * Get labels for multiple event types (static defaults)
 */
export function getEventTypeLabels(types: string[]): string[] {
  return types.map(getEventTypeLabel);
}

/**
 * Get the label for a public category (static defaults)
 */
export function getPublicCategoryLabel(type: string): string {
  return DEFAULT_PUBLIC_CATEGORY_LABELS[type] || type;
}

/**
 * Get labels for multiple public categories (static defaults)
 */
export function getPublicCategoryLabels(types: string[]): string[] {
  return types.map(getPublicCategoryLabel);
}

/**
 * @deprecated Use getPublicCategoryLabel instead
 */
export function getPublicTypeLabel(type: string): string {
  return DEFAULT_PUBLIC_CATEGORY_LABELS[type] || type;
}

/**
 * @deprecated Use getPublicCategoryLabels instead
 */
export function getPublicTypeLabels(types: string[]): string[] {
  return types.map(getPublicCategoryLabel);
}

/**
 * Get the label for an event status (static defaults)
 */
export function getEventStatusLabel(status: string): string {
  return DEFAULT_EVENT_STATUS_LABELS[status] || status;
}

/**
 * Get the label for a registration status (static defaults)
 */
export function getRegistrationStatusLabel(status: string): string {
  return DEFAULT_REGISTRATION_STATUS_LABELS[status] || status;
}

/**
 * Get the label for an accessibility type (static defaults)
 */
export function getAccessibilityLabel(type: string): string {
  return DEFAULT_ACCESSIBILITY_LABELS[type] || type;
}

/**
 * Get labels for multiple accessibility types (static defaults)
 */
export function getAccessibilityLabels(types: string[]): string[] {
  return types.map(getAccessibilityLabel);
}

/**
 * Get the label for a school grade (static defaults)
 */
export function getSchoolGradeLabel(grade: string): string {
  return DEFAULT_SCHOOL_GRADE_LABELS[grade] || grade;
}

/**
 * Get labels for multiple school grades (static defaults)
 */
export function getSchoolGradeLabels(grades: string[]): string[] {
  return grades.map(getSchoolGradeLabel);
}

/**
 * Get the label for an age range (static defaults)
 */
export function getAgeRangeLabel(range: string): string {
  return DEFAULT_AGE_RANGE_LABELS[range] || range;
}

/**
 * Get labels for multiple age ranges (static defaults)
 */
export function getAgeRangeLabels(ranges: string[]): string[] {
  return ranges.map(getAgeRangeLabel);
}
