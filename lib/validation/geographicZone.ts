/**
 * Utilitaire pour déterminer la zone géographique d'un établissement.
 * Basé sur la ville et le code postal de l'adresse.
 */

export type GeographicZone = 'MONTPELLIER' | 'METROPOLE' | 'HERAULT' | 'OUTSIDE';

/**
 * Liste des villes de la Métropole de Montpellier (hors Montpellier)
 */
const METROPOLE_CITIES = [
  'Baillargues',
  'Beaulieu',
  'Castelnau-le-Lez',
  'Castries',
  'Clapiers',
  'Cournonsec',
  'Cournonterral',
  'Fabrègues',
  'Grabels',
  'Jacou',
  'Juvignac',
  'Lattes',
  'Lavérune',
  'Le Crès',
  'Montaud',
  'Montferrier-sur-Lez',
  'Murviel-lès-Montpellier',
  'Pérols',
  'Pignan',
  'Prades-le-Lez',
  'Restinclières',
  'Saint-Brès',
  'Saint-Drézéry',
  'Saint-Geniès-des-Mourgues',
  "Saint-Georges d'Orques",
  'Saint-Jean-de-Védas',
  'Saussan',
  'Sussargues',
  'Vendargues',
  'Villeneuve-lès-Maguelone',
];

/**
 * Normalise une chaîne pour la comparaison (supprime accents, casse, espaces).
 * @param str - Chaîne à normaliser.
 * @returns Chaîne normalisée.
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .replace(/['-\s]/g, ''); // Supprime apostrophes, tirets et espaces
}

/**
 * Détermine la zone géographique d'un établissement.
 * @param city - Ville de l'établissement.
 * @param zipCode - Code postal de l'établissement.
 * @returns Zone géographique de l'établissement.
 */
export function determineGeographicZone(city: string, zipCode: string): GeographicZone {
  const normalizedCity = normalizeString(city);

  // 1. Vérifier si c'est Montpellier
  if (normalizedCity === 'montpellier') {
    return 'MONTPELLIER';
  }

  // 2. Vérifier si c'est dans la Métropole de Montpellier
  const isMetropole = METROPOLE_CITIES.some(
    (metropoleCity) => normalizeString(metropoleCity) === normalizedCity,
  );

  if (isMetropole) {
    return 'METROPOLE';
  }

  // 3. Vérifier si c'est dans l'Hérault (code postal commence par 34)
  if (zipCode.startsWith('34')) {
    return 'HERAULT';
  }

  // 4. Sinon, c'est en dehors du département
  return 'OUTSIDE';
}

/**
 * Labels pour chaque zone géographique.
 */
export const GEOGRAPHIC_ZONE_LABELS: Record<GeographicZone, string> = {
  MONTPELLIER: 'Montpellier',
  METROPOLE: 'Métropole de Montpellier',
  HERAULT: "Département de l'Hérault",
  OUTSIDE: 'Hors département',
};

/**
 * Ordre de priorité par défaut des zones (du plus proche au plus loin).
 */
export const GEOGRAPHIC_ZONE_PRIORITY: Record<GeographicZone, number> = {
  MONTPELLIER: 4,
  METROPOLE: 3,
  HERAULT: 2,
  OUTSIDE: 1,
};
