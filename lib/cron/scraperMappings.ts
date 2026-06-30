/**
 * Centralized mappings for the WordPress event scraper
 * All dictionaries and mapping functions used by eventsScraper.ts
 */

import {
  Accessibility,
  PublicCategory,
  SchoolGrade,
  AgeRange,
  EventType,
} from '@/app/generated/prisma';

// Re-export EventType for backward compatibility
export { EventType };

// Type for mapped public data (category + audience targets)
export interface PublicMapping {
  category: PublicCategory;
  grades: SchoolGrade[];
  age_ranges: AgeRange[];
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Mapping of WordPress event type slugs to Prisma EventType
 */
export const EVENT_TYPE_MAP: Record<string, EventType> = {
  voix: EventType.CONCERT_LYRIQUE,
  symphonique: EventType.SYMPHONIQUE,
  opera: EventType.OPERA,
  'chambre-2': EventType.CHAMBRE_BAROQUE,
  'en-famille': EventType.EN_FAMILLE,
  'opera-junior': EventType.OPERA_JUNIOR,
  'cine-concert': EventType.CINE_CONCERT,
  insolite: EventType.INSOLITE,
  'theatre-musical': EventType.THEATRE_MUSICAL,
  danse: EventType.DANSE,
  'conte-musical': EventType.CONTE_MUSICAL,
  'concert-decentralise': EventType.CONCERT_DECENTRALISE,
  'electro-acoustique': EventType.ELECTRO_ACOUSTIQUE,
  'musique-electronique': EventType.MUSIQUE_ELECTRONIQUE,
  'concert-lecture': EventType.CONCERT_LECTURE,
  'en-plein-air': EventType.PLEIN_AIR,
  jazz: EventType.JAZZ,
  litterature: EventType.LITTERATURE,
  masterclass: EventType.MASTERCLASS,
  'musique-et-bien-etre': EventType.MUSIQUE_ET_BIEN_ETRE,
  'musiques-actuelles': EventType.MUSIQUE_ACTUELLE,
  participatif: EventType.PARTICIPATIF,
  'promenade-sonore': EventType.PROMENADE_SONORE,
  atelier: EventType.ATELIER,
  gala: EventType.GALA,
  exposition: EventType.EXPOSITION,
  'portes-ouvertes': EventType.PORTES_OUVERTES,
  interdisciplinaire: EventType.INTERDISCIPLINAIRE,
  'spectacle-educatif': EventType.SPECTACLE_EDUCATIF,
  caritatif: EventType.CARITATIF,
  'lopera-orchestre-annonce': EventType.CARITATIF, // WordPress uses this slug for "Caritatif"
  theatre: EventType.THEATRE,
  'rendez-vous': EventType.RENDEZ_VOUS,
  'musiques-dailleurs': EventType.MUSIQUES_DAILLEURS,
  baroque: EventType.BAROQUE,
  'musique-electro-acoustique': EventType.ELECTRO_ACOUSTIQUE, // Alternative slug for electro-acoustique
};

/**
 * Map WordPress event types to Prisma EventType enum array
 * Returns all valid types found, or [OPERA] as default
 */
export function mapEventType(wpTypes: string[]): EventType[] {
  if (!wpTypes || wpTypes.length === 0) return [EventType.OPERA];

  const mappedTypes: EventType[] = [];
  for (const wpType of wpTypes) {
    const mapped = EVENT_TYPE_MAP[wpType.toLowerCase()];
    if (mapped && !mappedTypes.includes(mapped)) {
      mappedTypes.push(mapped);
    }
  }

  return mappedTypes.length > 0 ? mappedTypes : [EventType.OPERA];
}

// ============================================================================
// Public / Age Range Mappings
// ============================================================================

/**
 * Mapping of WordPress public taxonomy IDs to Prisma PublicCategory + audience targets
 * Fetched from: /wp-json/wp/v2/publics
 *
 * Source: WordPress admin dropdown for "Publics" taxonomy
 * Last updated: 2026-02-18
 */
export const WP_PUBLIC_ID_MAP: Record<number, PublicMapping> = {
  // Root categories (level-0) - parent = 0
  286: { category: PublicCategory.ASSOCIATION, grades: [], age_ranges: [] }, // Associations à caractère social
  299: { category: PublicCategory.COLLEGE, grades: [], age_ranges: [] }, // Collèges
  288: { category: PublicCategory.CONSERVATOIRE, grades: [], age_ranges: [] }, // Conservatoires et écoles de musique
  302: { category: PublicCategory.CRECHE, grades: [], age_ranges: [] }, // Crèches
  301: { category: PublicCategory.ELEMENTAIRE, grades: [], age_ranges: [] }, // Élémentaires
  296: { category: PublicCategory.SUPERIEUR, grades: [], age_ranges: [] }, // Enseignement supérieur
  287: { category: PublicCategory.LYCEE, grades: [], age_ranges: [] }, // Lycées
  285: { category: PublicCategory.MATERNELLE, grades: [], age_ranges: [] }, // Maternelles
  363: { category: PublicCategory.PUBLICS_EMPECHES, grades: [], age_ranges: [] }, // Publics empêchés / Santé / Handicap
  364: { category: PublicCategory.PERISCOLAIRE, grades: [], age_ranges: [] }, // Centre de loisirs / Périscolaire

  // Child categories (level-1) - specific grades
  // Collèges
  310: { category: PublicCategory.COLLEGE, grades: ['SIXIEME'], age_ranges: [] }, // Collèges (6ème)
  344: { category: PublicCategory.COLLEGE, grades: ['CINQUIEME'], age_ranges: [] }, // Collèges (5ème)
  345: { category: PublicCategory.COLLEGE, grades: ['QUATRIEME'], age_ranges: [] }, // Collèges (4ème)
  346: { category: PublicCategory.COLLEGE, grades: ['TROISIEME'], age_ranges: [] }, // Collèges (3ème)

  // Élémentaires
  351: { category: PublicCategory.ELEMENTAIRE, grades: ['CP'], age_ranges: [] }, // Élémentaires (CP)
  352: { category: PublicCategory.ELEMENTAIRE, grades: ['CE1'], age_ranges: [] }, // Élémentaires (CE1)
  353: { category: PublicCategory.ELEMENTAIRE, grades: ['CE2'], age_ranges: [] }, // Élémentaires (CE2)
  354: { category: PublicCategory.ELEMENTAIRE, grades: ['CM1'], age_ranges: [] }, // Élémentaires (CM1)
  355: { category: PublicCategory.ELEMENTAIRE, grades: ['CM2'], age_ranges: [] }, // Élémentaires (CM2)

  // Lycées
  348: { category: PublicCategory.LYCEE, grades: ['SECONDE'], age_ranges: [] }, // Lycées (seconde)
  349: { category: PublicCategory.LYCEE, grades: ['PREMIERE'], age_ranges: [] }, // Lycées (première)
  350: { category: PublicCategory.LYCEE, grades: ['TERMINALE'], age_ranges: [] }, // Lycées (terminale)

  // Maternelles
  306: { category: PublicCategory.MATERNELLE, grades: ['PS'], age_ranges: [] }, // Maternelles (petite section)
  347: { category: PublicCategory.MATERNELLE, grades: ['MS'], age_ranges: [] }, // Maternelles (moyenne section)
  307: { category: PublicCategory.MATERNELLE, grades: ['GS'], age_ranges: [] }, // Maternelles (grande section)
};

/**
 * Mapping of public name strings to Prisma PublicCategory + audience targets
 * Used as fallback when public IDs are not available
 *
 * Source: WordPress admin dropdown for "Publics" taxonomy
 * Last updated: 2026-02-18
 */
export const PUBLIC_NAME_MAP: Record<string, PublicMapping> = {
  // Root categories
  'associations a caractere social': {
    category: PublicCategory.ASSOCIATION,
    grades: [],
    age_ranges: [],
  },
  'associations à caractère social': {
    category: PublicCategory.ASSOCIATION,
    grades: [],
    age_ranges: [],
  },
  association: { category: PublicCategory.ASSOCIATION, grades: [], age_ranges: [] },
  college: { category: PublicCategory.COLLEGE, grades: [], age_ranges: [] },
  collège: { category: PublicCategory.COLLEGE, grades: [], age_ranges: [] },
  colleges: { category: PublicCategory.COLLEGE, grades: [], age_ranges: [] },
  collèges: { category: PublicCategory.COLLEGE, grades: [], age_ranges: [] },
  conservatoire: { category: PublicCategory.CONSERVATOIRE, grades: [], age_ranges: [] },
  'conservatoires et ecoles de musique': {
    category: PublicCategory.CONSERVATOIRE,
    grades: [],
    age_ranges: [],
  },
  'conservatoires et écoles de musique': {
    category: PublicCategory.CONSERVATOIRE,
    grades: [],
    age_ranges: [],
  },
  creche: { category: PublicCategory.CRECHE, grades: [], age_ranges: [] },
  crèche: { category: PublicCategory.CRECHE, grades: [], age_ranges: [] },
  creches: { category: PublicCategory.CRECHE, grades: [], age_ranges: [] },
  crèches: { category: PublicCategory.CRECHE, grades: [], age_ranges: [] },
  'enseignement superieur': {
    category: PublicCategory.SUPERIEUR,
    grades: [],
    age_ranges: [],
  },
  'enseignement supérieur': {
    category: PublicCategory.SUPERIEUR,
    grades: [],
    age_ranges: [],
  },
  elementaire: { category: PublicCategory.ELEMENTAIRE, grades: [], age_ranges: [] },
  élémentaire: { category: PublicCategory.ELEMENTAIRE, grades: [], age_ranges: [] },
  elementaires: { category: PublicCategory.ELEMENTAIRE, grades: [], age_ranges: [] },
  élémentaires: { category: PublicCategory.ELEMENTAIRE, grades: [], age_ranges: [] },
  lycee: { category: PublicCategory.LYCEE, grades: [], age_ranges: [] },
  lycée: { category: PublicCategory.LYCEE, grades: [], age_ranges: [] },
  lycees: { category: PublicCategory.LYCEE, grades: [], age_ranges: [] },
  lycées: { category: PublicCategory.LYCEE, grades: [], age_ranges: [] },
  maternelle: { category: PublicCategory.MATERNELLE, grades: [], age_ranges: [] },
  maternelles: { category: PublicCategory.MATERNELLE, grades: [], age_ranges: [] },
  'centre de loisirs': { category: PublicCategory.PERISCOLAIRE, grades: [], age_ranges: [] },
  'centre de loisir': { category: PublicCategory.PERISCOLAIRE, grades: [], age_ranges: [] },
  periscolaire: { category: PublicCategory.PERISCOLAIRE, grades: [], age_ranges: [] },
  périscolaire: { category: PublicCategory.PERISCOLAIRE, grades: [], age_ranges: [] },
  'centre de loisirs / periscolaire': {
    category: PublicCategory.PERISCOLAIRE,
    grades: [],
    age_ranges: [],
  },
  'centre de loisirs / périscolaire': {
    category: PublicCategory.PERISCOLAIRE,
    grades: [],
    age_ranges: [],
  },
  'publics empeches': { category: PublicCategory.PUBLICS_EMPECHES, grades: [], age_ranges: [] },
  'publics empêchés': { category: PublicCategory.PUBLICS_EMPECHES, grades: [], age_ranges: [] },
  'publics empeches / sante / handicap': {
    category: PublicCategory.PUBLICS_EMPECHES,
    grades: [],
    age_ranges: [],
  },
  'publics empêchés / santé / handicap': {
    category: PublicCategory.PUBLICS_EMPECHES,
    grades: [],
    age_ranges: [],
  },

  // Child categories (more specific patterns first)
  // Collèges
  'colleges (6eme)': { category: PublicCategory.COLLEGE, grades: ['SIXIEME'], age_ranges: [] },
  'collèges (6ème)': { category: PublicCategory.COLLEGE, grades: ['SIXIEME'], age_ranges: [] },
  'colleges (5eme)': { category: PublicCategory.COLLEGE, grades: ['CINQUIEME'], age_ranges: [] },
  'collèges (5ème)': { category: PublicCategory.COLLEGE, grades: ['CINQUIEME'], age_ranges: [] },
  'colleges (4eme)': { category: PublicCategory.COLLEGE, grades: ['QUATRIEME'], age_ranges: [] },
  'collèges (4ème)': { category: PublicCategory.COLLEGE, grades: ['QUATRIEME'], age_ranges: [] },
  'colleges (3eme)': { category: PublicCategory.COLLEGE, grades: ['TROISIEME'], age_ranges: [] },
  'collèges (3ème)': { category: PublicCategory.COLLEGE, grades: ['TROISIEME'], age_ranges: [] },

  // Élémentaires
  'elementaires (cp)': { category: PublicCategory.ELEMENTAIRE, grades: ['CP'], age_ranges: [] },
  'élémentaires (cp)': { category: PublicCategory.ELEMENTAIRE, grades: ['CP'], age_ranges: [] },
  'elementaires (ce1)': { category: PublicCategory.ELEMENTAIRE, grades: ['CE1'], age_ranges: [] },
  'élémentaires (ce1)': { category: PublicCategory.ELEMENTAIRE, grades: ['CE1'], age_ranges: [] },
  'elementaires (ce2)': { category: PublicCategory.ELEMENTAIRE, grades: ['CE2'], age_ranges: [] },
  'élémentaires (ce2)': { category: PublicCategory.ELEMENTAIRE, grades: ['CE2'], age_ranges: [] },
  'elementaires (cm1)': { category: PublicCategory.ELEMENTAIRE, grades: ['CM1'], age_ranges: [] },
  'élémentaires (cm1)': { category: PublicCategory.ELEMENTAIRE, grades: ['CM1'], age_ranges: [] },
  'elementaires (cm2)': { category: PublicCategory.ELEMENTAIRE, grades: ['CM2'], age_ranges: [] },
  'élémentaires (cm2)': { category: PublicCategory.ELEMENTAIRE, grades: ['CM2'], age_ranges: [] },

  // Lycées
  'lycees (seconde)': { category: PublicCategory.LYCEE, grades: ['SECONDE'], age_ranges: [] },
  'lycées (seconde)': { category: PublicCategory.LYCEE, grades: ['SECONDE'], age_ranges: [] },
  'lycees (premiere)': { category: PublicCategory.LYCEE, grades: ['PREMIERE'], age_ranges: [] },
  'lycées (première)': { category: PublicCategory.LYCEE, grades: ['PREMIERE'], age_ranges: [] },
  'lycees (terminale)': { category: PublicCategory.LYCEE, grades: ['TERMINALE'], age_ranges: [] },
  'lycées (terminale)': { category: PublicCategory.LYCEE, grades: ['TERMINALE'], age_ranges: [] },

  // Maternelles
  'maternelles (petite section)': {
    category: PublicCategory.MATERNELLE,
    grades: ['PS'],
    age_ranges: [],
  },
  'maternelles (moyenne section)': {
    category: PublicCategory.MATERNELLE,
    grades: ['MS'],
    age_ranges: [],
  },
  'maternelles (grande section)': {
    category: PublicCategory.MATERNELLE,
    grades: ['GS'],
    age_ranges: [],
  },
};

/**
 * Map WordPress public IDs to Prisma PublicCategory, SchoolGrade and AgeRange arrays
 * Uses the structured taxonomy IDs from acf.colonne_de_gauche.public
 * Returns arrays for use in Event.category / Event.grades / Event.age_ranges
 */
export function mapPublicIdsToCategories(publicIds: number[]): {
  categories: PublicCategory[];
  grades: SchoolGrade[];
  age_ranges: AgeRange[];
} {
  if (!publicIds || publicIds.length === 0) {
    return { categories: [PublicCategory.AUTRE], grades: [], age_ranges: [] };
  }

  const categories: PublicCategory[] = [];
  const grades = new Set<SchoolGrade>();
  const ageRanges = new Set<AgeRange>();

  for (const id of publicIds) {
    const mapped = WP_PUBLIC_ID_MAP[id];
    if (mapped) {
      if (!categories.includes(mapped.category)) {
        categories.push(mapped.category);
      }
      for (const grade of mapped.grades) {
        grades.add(grade);
      }
      for (const ageRange of mapped.age_ranges) {
        ageRanges.add(ageRange);
      }
    }
  }

  // Fallback if nothing mapped
  if (categories.length === 0) {
    return { categories: [PublicCategory.AUTRE], grades: [], age_ranges: [] };
  }

  return { categories, grades: Array.from(grades), age_ranges: Array.from(ageRanges) };
}

/**
 * Map WordPress public names to Prisma PublicCategory, SchoolGrade and AgeRange arrays
 * Fallback method when public IDs are not available
 */
export function mapPublicNamesToCategories(publicNames: string[]): {
  categories: PublicCategory[];
  grades: SchoolGrade[];
  age_ranges: AgeRange[];
} {
  const normalizeString = (str: string) =>
    str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const categories: PublicCategory[] = [];
  const grades = new Set<SchoolGrade>();
  const ageRanges = new Set<AgeRange>();

  for (const name of publicNames) {
    const normalized = normalizeString(name);
    // Try exact match first
    for (const [key, value] of Object.entries(PUBLIC_NAME_MAP)) {
      const normalizedKey = normalizeString(key);
      if (normalized === normalizedKey) {
        if (!categories.includes(value.category)) {
          categories.push(value.category);
        }
        for (const grade of value.grades) {
          grades.add(grade);
        }
        for (const ageRange of value.age_ranges) {
          ageRanges.add(ageRange);
        }
        break;
      }
    }
    // If no exact match, try partial match
    if (categories.length === 0) {
      for (const [key, value] of Object.entries(PUBLIC_NAME_MAP)) {
        const normalizedKey = normalizeString(key);
        if (normalized.includes(normalizedKey) || normalizedKey.includes(normalized)) {
          if (!categories.includes(value.category)) {
            categories.push(value.category);
          }
          break;
        }
      }
    }
  }

  // Fallback
  if (categories.length === 0) {
    return { categories: [PublicCategory.AUTRE], grades: [], age_ranges: [] };
  }

  return { categories, grades: Array.from(grades), age_ranges: Array.from(ageRanges) };
}

// ============================================================================
// Age Range Mappings
// ============================================================================

/**
 * Mapping of WordPress age taxonomy IDs to Prisma AgeRange
 * Fetched from: /wp-json/wp/v2/ages
 *
 * Source: WordPress admin dropdown for "Ages" taxonomy
 * Last updated: 2026-02-18
 */
export const WP_AGE_ID_MAP: Record<number, AgeRange> = {
  356: AgeRange.AGE_0_3, // De 0 à 3 ans
  357: AgeRange.AGE_3_6, // De 3 à 6 ans
  358: AgeRange.AGE_6_11, // De 6 à 11 ans
  359: AgeRange.AGE_11_15, // De 11 à 15 ans
  360: AgeRange.AGE_15_18, // De 15 à 18 ans
  361: AgeRange.AGE_18_PLUS, // À partir de 18 ans
};

/**
 * Mapping of age name strings to Prisma AgeRange
 * Used as fallback when age IDs are not available
 */
export const AGE_NAME_MAP: Record<string, AgeRange> = {
  'de 0 a 3 ans': AgeRange.AGE_0_3,
  'de 0 à 3 ans': AgeRange.AGE_0_3,
  '0 a 3 ans': AgeRange.AGE_0_3,
  '0 à 3 ans': AgeRange.AGE_0_3,
  'de 3 a 6 ans': AgeRange.AGE_3_6,
  'de 3 à 6 ans': AgeRange.AGE_3_6,
  '3 a 6 ans': AgeRange.AGE_3_6,
  '3 à 6 ans': AgeRange.AGE_3_6,
  'de 6 a 11 ans': AgeRange.AGE_6_11,
  'de 6 à 11 ans': AgeRange.AGE_6_11,
  '6 a 11 ans': AgeRange.AGE_6_11,
  '6 à 11 ans': AgeRange.AGE_6_11,
  'de 11 a 15 ans': AgeRange.AGE_11_15,
  'de 11 à 15 ans': AgeRange.AGE_11_15,
  '11 a 15 ans': AgeRange.AGE_11_15,
  '11 à 15 ans': AgeRange.AGE_11_15,
  'de 15 a 18 ans': AgeRange.AGE_15_18,
  'de 15 à 18 ans': AgeRange.AGE_15_18,
  '15 a 18 ans': AgeRange.AGE_15_18,
  '15 à 18 ans': AgeRange.AGE_15_18,
  'a partir de 18 ans': AgeRange.AGE_18_PLUS,
  'à partir de 18 ans': AgeRange.AGE_18_PLUS,
  '18 ans et plus': AgeRange.AGE_18_PLUS,
};

/**
 * Map WordPress age IDs to Prisma AgeRange array
 * Uses the structured taxonomy IDs from acf.colonne_de_gauche.age
 * Returns array for use in Event.age_ranges
 */
export function mapAgeIdsToRanges(ageIds: number[]): AgeRange[] {
  if (!ageIds || ageIds.length === 0) {
    return [];
  }

  const ranges = new Set<AgeRange>();

  for (const id of ageIds) {
    const mapped = WP_AGE_ID_MAP[id];
    if (mapped) {
      ranges.add(mapped);
    }
  }

  return Array.from(ranges);
}

/**
 * Map WordPress age names to Prisma AgeRange array
 * Fallback method when age IDs are not available
 */
export function mapAgeNamesToRanges(ageNames: string[]): AgeRange[] {
  const normalizeString = (str: string) =>
    str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const ranges = new Set<AgeRange>();

  for (const name of ageNames) {
    const normalized = normalizeString(name);
    // Try exact match first
    for (const [key, value] of Object.entries(AGE_NAME_MAP)) {
      const normalizedKey = normalizeString(key);
      if (normalized === normalizedKey) {
        ranges.add(value);
        break;
      }
    }
    // If no exact match, try partial match
    if (ranges.size === 0) {
      for (const [key, value] of Object.entries(AGE_NAME_MAP)) {
        const normalizedKey = normalizeString(key);
        if (normalized.includes(normalizedKey) || normalizedKey.includes(normalized)) {
          ranges.add(value);
          break;
        }
      }
    }
  }

  return Array.from(ranges);
}

// ============================================================================
// Accessibility Mappings
// ============================================================================

/**
 * Mapping of WordPress accessibility taxonomy IDs to Prisma Accessibility
 * Fetched from: /wp-json/wp/v2/accessibilite
 */
export const WP_ACCESSIBILITY_ID_MAP: Record<number, Accessibility> = {
  289: Accessibility.AUDITORY, // Sourds et malentendants
  290: Accessibility.VISUAL, // Aveugles et malvoyants
};

/**
 * Map WordPress accessibility IDs to Prisma Accessibility enum
 * Uses the structured taxonomy IDs from acf.colonne_de_gauche.accessibilite
 */
export function mapAccessibilityIds(accessibilityIds: number[]): Accessibility[] {
  if (!accessibilityIds || accessibilityIds.length === 0) {
    return [];
  }

  const types: Accessibility[] = [];
  for (const id of accessibilityIds) {
    const mapped = WP_ACCESSIBILITY_ID_MAP[id];
    if (mapped && !types.includes(mapped)) {
      types.push(mapped);
    }
  }

  return types;
}

// ============================================================================
// Location Mappings
// ============================================================================

/**
 * Complete mapping of WordPress location slugs to display names
 * Source: WordPress admin dropdown for "Lieux"
 */
export const LOCATIONS_MAP: Record<string, string> = {
  // === Autres / Décentralisés ===
  'lieux-en-region-et-decentralise': 'Autres',
  'lieux-aix-en-provence-chateau-du-tholonet': 'Aix-en-Provence | Château du Tholonet',
  'lieux-amelie-les-bains-salle-jean-trescases': 'Amélie-les-Bains | Salle Jean Trescases',
  'lieux-argeles-sur-mer-eglise-notre-dame-del-prat':
    'Argelès-sur-Mer | Église Notre-Dame del Prat',
  'lieux-arles-sur-tech': 'Arles-sur-Tech',
  'lieux-arles-sur-tech-parc-de-lhotel-de-ville': "Arles-sur-Tech | Parc de l'hôtel de ville",
  'lieux-banyuls-sur-mer-eglise-saint-jean-baptiste':
    'Banyuls-sur-Mer | Église Saint Jean-Baptiste',
  'lieux-beziers-domaine-de-bayssan': 'Béziers | Domaine de Bayssan',
  'lieux-beziers-domaine-de-bayssan-chapelle-saint-felix':
    'Béziers | Domaine de Bayssan, chapelle Saint-Félix',
  'lieux-canaules-et-argentieres': 'Canaules-et-Argentières | Temple',
  'lieux-capestang-collegiale': 'Capestang | Collégiale',
  'lieux-castelnaudary-halle-aux-grains': 'Castelnaudary | Halle aux Grains',
  'lieux-castries-cour-du-chateau': 'Castries | Cour du château',
  'lieux-cros-eglise': 'Cros | Église Saint-Vincent',
  'lieux-cros-temple': 'Cros | Temple',
  'lieux-en-ligne': 'En ligne',
  'lieux-fabregues-eglise': 'Fabrègues | Église Saint-Jacques',
  'lieux-ganges-theatre-de-lalbarede': "Ganges | Théâtre de l'Albarède",
  'lieux-generargues-la-bambouseraie': 'Générargues | La Bambouseraie',
  'lieux-gignac-gymnase-le-riveral': 'Gignac | Gymnase Le Riveral',
  'lieux-le-soler-espace-culturel-francois-calvet': 'Le Soler | Espace Culturel François Calvet',
  'lieux-limoux-musee-du-piano': 'Limoux | Musée du piano',
  'lieux-limouxmusee-du-piano': 'Limoux | Musée du piano',
  'lieux-marvejols-eglise-notre-dame-de-la-carce': 'Marvejols | Église Notre-Dame de la Carce',
  'lieux-monteils-temple': 'Monteils | Temple',
  'lieux-montpellier-centre-social-caf-lile-aux-familles':
    "Montpellier | Centre social CAF L'Île aux familles",
  'lieux-montpellier-chateau-de-la-piscine': 'Montpellier | Château de la Piscine',
  'lieux-montpellier-domaine-do-theatre-jean-claude-carriere':
    "Montpellier | Domaine d'O Théâtre (Jean-Claude Carrière)",
  'lieux-montpellier-domaine-de-grammont': 'Montpellier | Domaine de Grammont',
  'lieux-montpellier-enclos-st-francois': 'Montpellier | Enclos St-François',
  'lieux-montpellier-halle-tropisme': 'Montpellier | Halle Tropisme',
  'lieux-montpellier-jardin-des-plantes': 'Montpellier | Jardin des Plantes',
  'lieux-montpellier-kiosque-bosc': 'Montpellier | Kiosque Bosc',
  'lieux-montpellier-maison-pour-tous-albertine-sarrazin':
    'Montpellier | Maison pour tous Albertine Sarrazin (Parc de la Guirlande)',
  'lieux-montpellier-maison-pour-tous-leo-lagrange':
    'Montpellier | Maison pour tous Léo Lagrange (Cour)',
  'lieux-montpellier-maison-pour-tous-marie-curie': 'Montpellier | Maison pour tous Marie Curie',
  'lieux-montpellier-panorama-rooftop-du-corum': 'Montpellier | Panorama (toit du Corum)',
  'lieux-montpellier-parc-du-domaine-do': "Montpellier | Parc du Domaine d'O",
  'lieux-montpellier-parc-font-colombe': 'Montpellier | Parc Font-Colombe',
  'lieux-montpellier-parc-montcalm': 'Montpellier | Parc Montcalm',
  'lieux-montpellier-parc-rimbaud': 'Montpellier | Parc Rimbaud',
  'lieux-montpellier-place-de-leurope': "Montpellier | Place de l'Europe",
  'lieux-montpellier-place-royale-du-peyrou': 'Montpellier | Place Royale du Peyrou',
  'lieux-montpellier-quartier-antigone': 'Montpellier | Quartier Antigone',
  'lieux-montpellier-temple-maguelone': 'Montpellier | Temple Maguelone',
  'lieux-montpellier-theatre-jean-claude-carriere': 'Montpellier | Théâtre Jean-Claude Carrière',
  'lieux-musee-du-piano%ef%bd%9climoux': 'Musée du piano | Limoux',
  'lieux-narbonne-palais-des-archeveques-en-region-et-decentralise':
    'Narbonne | Palais des Archevêques',
  'lieux-nimes-theatre-de-nimes-salle-bernadette-lafont':
    'Nîmes | Théâtre de Nîmes (salle Bernadette Lafont)',
  'lieux-orange-theatre-antique': 'Orange | Théâtre Antique',
  'lieux-palavas-les-flots-eglise-saint-pierre': 'Palavas-les-Flots | Église Saint-Pierre',
  'lieux-palavas-les-flots-le-nautilus': 'Palavas-les-Flots | Le Nautilus',
  'lieux-poilhes-place-de-lhorreum': "Poilhes | Place de l'Horréum",
  'lieux-poilhes-salle-du-peuple': 'Poilhes | Salle du Peuple',
  'lieux-port-leucate-espace-henry-de-monfreid-en-region-et-decentralise':
    'Port Leucate | Espace Henry de Monfreid',
  'lieux-prades-le-lez-salle-jacques-brel': 'Prades-le-Lez | Salle Jacques-Brel',
  'lieux-rimeize-eglise-st-fabien': 'Rimeize | Église St Fabien',
  'lieux-saint-chely-dapcher-cine-theatre': "Saint-Chély d'Apcher | Ciné-théâtre",
  'lieux-saint-clement-de-riviere-salle-frederic-bazille':
    'Saint-Clément de Rivière | Salle Frédéric Bazille',
  'lieux-saint-gely-du-fesc-eglise': 'Saint-Gély-du-Fesc | Église',
  'lieux-saint-gely-du-fesc-scene-en-pic-saint-loup':
    'Saint-Gély-du-Fesc | Scène en Grand Pic Saint-Loup – Auditorium Georges-Brassens',
  'lieux-saint-jean-du-gard-temple': 'Saint-Jean-du-Gard | Temple',
  'lieux-saint-jean-pla-de-corts-salle-polyvalente': 'Saint-Jean-Pla-de-Corts | Salle Polyvalente',
  'lieux-salses-le-chateau-forteresse-de-salses': 'Salses-le-château | Forteresse de Salses',
  'lieux-sauveterre-pole-culturel-jean-ferrat': 'Sauveterre | Pôle culturel Jean Ferrat',
  'lieux-st-fabien-de-rimeize-eglise': 'St Fabien de Rimeize | Église',
  'lieux-toulouges-theatre-el-mil-lenari': 'Toulouges | Théâtre El Mil.lenari',
  'lieux-vergeze-espace-vergeze': 'Vergèze | Espace Vergèze',
  'lieux-villeneuve-les-maguelone-cathedrale-saint-pierre':
    'Villeneuve-lès-Maguelone | Cathédrale Saint-Pierre',
  'lieux-agde-mediatheque': 'Agde | Médiathèque',
  'lieux-maison-de-leau-allegre-les-fumades': "Allègre-les-Fumades | Maison de l'Eau",
  'lieux-bagnols-sur-ceze-eglise': 'Bagnols-sur-Cèze | Église Saint-Jean-Baptiste',
  'lieux-bagnols-sur-ceze-salle-multiculturelle': 'Bagnols-sur-Cèze | Salle multiculturelle',
  'lieux-bedarieux-la-tuilerie': 'Bédarieux | La Tuilerie',
  'lieux-carcassonne-theatre-jean-alary': 'Carcassonne | Théâtre Jean-Alary',
  'lieux-castelnaudary-theatre-des-3-ponts': 'Castelnaudary | Théâtre des 3 ponts',
  'lieux-castelnau-le-lez-eglise-saint-vincent-de-paul':
    'Castelnau-le-Lez | Église Saint-Vincent-de-Paul',
  'lieux-castres-eglise-notre-dame-de-la-plate': 'Castres | Église Notre-Dame-de-la-Platé',
  'lieux-castries': 'Castries | Foyer communal H. Paulet',
  'lieux-ceret-salle-de-lunion': "Céret | Salle de l'Union",
  'lieux-florac-la-genette-verte': 'Florac | La Genette Verte',
  'lieux-frontignan-eglise-saint-paul': 'Frontignan | Église Saint-Paul',
  'lieux-gignac-le-sonambule': 'Gignac | Le Sonambule',
  'lieux-lattes-theatre-jacques-coeur': 'Lattes | Théâtre Jacques-Cœur',
  'lieux-le-cres-agora': 'Le Crès | Agora',
  'lieux-lodeve-cathedrale-saint-fulcran': 'Lodève | Cathédrale Saint-Fulcran',
  'lieux-lunel-salle-georges-brassens': 'Lunel | Salle Georges-Brassens',
  'lieux-dome-marseille': 'Marseille | Le Dôme',
  'lieux-mauguio-theatre-samuel-bassaget': 'Mauguio | Théâtre Bassaget',
  'lieux-meze-eglise-saint-hilaire': 'Mèze | Église Saint-Hilaire',
  'lieux-montferrier-salle-du-devezou': 'Montferrier-sur-Lez | Le Devézou',
  'lieux-domaine-do-de-montpellier-amphitheatre-do': "Montpellier | Amphithéâtre d'O – Domaine d'O",
  'lieux-cite-des-arts-crr': 'Montpellier | Cité des Arts – CRR',
  'lieux-montpellier-hotel-de-cabrieres-sabatier-despeyran':
    "Montpellier | Hôtel de Cabrières-Sabatier d'Espeyran",
  'lieux-montpellier-maison-pour-tous-albert-camus':
    'Montpellier | Maison pour Tous Albert-Camus (Parvis)',
  'lieux-montpellier-maison-pour-tous-louis-feuillade':
    'Montpellier | Maison pour Tous Louis-Feuillade',
  'lieux-montpellier-maison-pour-tous-rosa-lee-parks':
    'Montpellier | Maison pour tous Rosa Lee Parks',
  'lieux-la-chouette-parenthese': 'Montpellier | La Chouette Parenthèse',
  'lieux-montpellier-parvis-de-lhotel-de-ville': "Montpellier | Parvis de l'Hôtel de Ville",
  'lieux-montpellier-terrasse-du-chateau-de-flaugergues':
    'Montpellier | Terrasse du Château de Flaugergues',
  'lieux-theatre-de-lagora-cite-internationale-de-la-danse':
    "Théâtre de l'Agora | cité internationale de la danse",
  'lieux-montpellier-theatre-jean-vilar': 'Montpellier | Théâtre Jean-Vilar',
  'lieux-montpellier-theatre-la-vignette': 'Montpellier | Théâtre La Vignette',
  'lieux-zenith-sud-montpellier': 'Montpellier | Zénith Sud',
  'lieux-mende-theatre': 'Mende | Théâtre',
  'lieux-millau-theatre-de-la-maison-du-peuple': 'Millau | Théâtre de la Maison du Peuple',
  'lieux-narbonne-arena': 'Narbonne | Arena',
  'lieux-narbonne-scene-nationale': 'Narbonne | Scène nationale',
  'lieux-nimes-arenes': 'Nîmes | Arènes',
  'lieux-palavas-les-flots': 'Palavas-les-Flots',
  'lieux-opera-grand-avignon': 'Opéra Grand Avignon',
  'lieux-theatre-des-champs-elysees-paris': 'Paris | Théâtre des Champs-Elysées',
  'lieux-puissalicon-eglise': 'Puissalicon | Eglise',
  'lieux-quarante-abbatiale-sainte-marie': 'Quarante | Abbatiale Sainte-Marie',
  'lieux-saint-andre-de-sangonis-pavillon-de-la-culture':
    'Saint-André-de-Sangonis | Pavillon de la Culture',
  'lieux-saint-georges-dorques-eglise': "Saint-Georges d'Orques | Église",
  'lieux-saint-jean-de-vedas': 'Saint-Jean-de-Védas | Chai du terral',
  'lieux-serignan-la-cigaliere': 'Sérignan | La Cigalière',
  'lieux-sete-scene-nationale-archipel-de-thau':
    'Sète | Théâtre Molière – Scène nationale Archipel de Thau',
  'lieux-tauriac-de-camares-eglise': 'Tauriac-de-Camarès | Église',
  'lieux-hambourg-allemagne': 'Hambourg | Allemagne',

  // === Le Corum ===
  'lieux-le-corum-2': 'Le Corum',
  'lieux-le-corum': 'Opéra Berlioz | Le Corum',
  'lieux-salle-pasteur-le-corum': 'Salle Pasteur | Le Corum',

  // === Opéra Comédie ===
  'lieux-opera-comedie': 'Opéra Comédie',
  'lieux-salle-bagouet-opera-comedie': 'Opéra Comédie | Salle Bagouet',
  'lieux-grand-foyer-opera-comedie': 'Opéra Comédie | Grand Foyer',
  'lieux-salle-moliere-opera-comedie': 'Salle Molière | Opéra Comédie',
  'lieux-salon-victor-hugo-opera-comedie': 'Opéra Comédie | Salon Victor-Hugo',
};

/**
 * Format location name from class_list value and return both location and seat count
 * All seat capacities are 0 - staff will configure manually
 */
export function formatLocation(locationClass: string | null): {
  location: string;
  totalSeats: number;
} {
  if (!locationClass) {
    return { location: 'Autre', totalSeats: 0 };
  }

  // Check if it's a known location
  if (LOCATIONS_MAP[locationClass]) {
    return { location: LOCATIONS_MAP[locationClass], totalSeats: 0 };
  }

  // Fallback for unknown locations: format from slug
  const formattedName = locationClass
    .replace(/^lieux-/, '')
    .split('-')
    .map((word, i) => (i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
  return { location: formattedName, totalSeats: 0 };
}
