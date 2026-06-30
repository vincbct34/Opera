import { describe, expect, it } from '@jest/globals';
import {
  EventType,
  EVENT_TYPE_MAP,
  formatLocation,
  LOCATIONS_MAP,
  mapPublicNamesToCategories,
  mapEventType,
  mapPublicIdsToCategories,
  mapAgeIdsToRanges,
  mapAgeNamesToRanges,
  PUBLIC_NAME_MAP,
  WP_PUBLIC_ID_MAP,
  WP_AGE_ID_MAP,
  AGE_NAME_MAP,
} from '@/lib/cron/scraperMappings';
import { PublicCategory, AgeRange } from '@/app/generated/prisma/enums';

describe('scraperMappings', () => {
  // ============================================================================
  // LOCATIONS_MAP Tests
  // ============================================================================
  describe('LOCATIONS_MAP', () => {
    it('should contain Opéra Comédie locations', () => {
      expect(LOCATIONS_MAP['lieux-opera-comedie']).toBe('Opéra Comédie');
      expect(LOCATIONS_MAP['lieux-salle-moliere-opera-comedie']).toBe(
        'Salle Molière | Opéra Comédie',
      );
      expect(LOCATIONS_MAP['lieux-grand-foyer-opera-comedie']).toBe('Opéra Comédie | Grand Foyer');
    });

    it('should contain Le Corum locations', () => {
      expect(LOCATIONS_MAP['lieux-le-corum']).toBe('Opéra Berlioz | Le Corum');
      expect(LOCATIONS_MAP['lieux-salle-pasteur-le-corum']).toBe('Salle Pasteur | Le Corum');
    });

    it('should contain regional locations with accents', () => {
      expect(LOCATIONS_MAP['lieux-beziers-domaine-de-bayssan']).toBe(
        'Béziers | Domaine de Bayssan',
      );
      expect(LOCATIONS_MAP['lieux-nimes-arenes']).toBe('Nîmes | Arènes');
      expect(LOCATIONS_MAP['lieux-zenith-sud-montpellier']).toBe('Montpellier | Zénith Sud');
    });
  });

  describe('formatLocation', () => {
    it('should return Autre for null input', () => {
      const result = formatLocation(null);
      expect(result).toEqual({ location: 'Autre', totalSeats: 0 });
    });

    it('should return mapped location for known key', () => {
      const result = formatLocation('lieux-opera-comedie');
      expect(result).toEqual({ location: 'Opéra Comédie', totalSeats: 0 });
    });

    it('should return formatted fallback for unknown key', () => {
      const result = formatLocation('lieux-some-unknown-venue');
      expect(result).toEqual({ location: 'Some unknown venue', totalSeats: 0 });
    });

    it('should always return totalSeats as 0', () => {
      const known = formatLocation('lieux-le-corum');
      const unknown = formatLocation('lieux-random-place');
      expect(known.totalSeats).toBe(0);
      expect(unknown.totalSeats).toBe(0);
    });
  });

  // ============================================================================
  // EVENT_TYPE_MAP Tests
  // ============================================================================
  describe('EVENT_TYPE_MAP', () => {
    it('should contain common event types', () => {
      expect(EVENT_TYPE_MAP['opera']).toBe(EventType.OPERA);
      expect(EVENT_TYPE_MAP['symphonique']).toBe(EventType.SYMPHONIQUE);
      expect(EVENT_TYPE_MAP['voix']).toBe(EventType.CONCERT_LYRIQUE);
    });

    it('should contain hyphenated event types', () => {
      expect(EVENT_TYPE_MAP['cine-concert']).toBe(EventType.CINE_CONCERT);
      expect(EVENT_TYPE_MAP['opera-junior']).toBe(EventType.OPERA_JUNIOR);
      expect(EVENT_TYPE_MAP['en-famille']).toBe(EventType.EN_FAMILLE);
    });
  });

  describe('mapEventType', () => {
    it('should return OPERA as default for empty input', () => {
      expect(mapEventType([])).toEqual([EventType.OPERA]);
    });

    it('should map single type correctly', () => {
      expect(mapEventType(['symphonique'])).toEqual([EventType.SYMPHONIQUE]);
    });

    it('should map multiple types and deduplicate', () => {
      expect(mapEventType(['opera', 'voix', 'opera'])).toEqual([
        EventType.OPERA,
        EventType.CONCERT_LYRIQUE,
      ]);
    });

    it('should return OPERA for unknown types', () => {
      expect(mapEventType(['unknown-type'])).toEqual([EventType.OPERA]);
    });
  });

  // ============================================================================
  // WP_PUBLIC_ID_MAP Tests
  // ============================================================================
  describe('WP_PUBLIC_ID_MAP', () => {
    it('should contain root category IDs', () => {
      expect(WP_PUBLIC_ID_MAP[285]).toBeDefined(); // Maternelles
      expect(WP_PUBLIC_ID_MAP[299]).toBeDefined(); // Collèges
      expect(WP_PUBLIC_ID_MAP[287]).toBeDefined(); // Lycées
      expect(WP_PUBLIC_ID_MAP[301]).toBeDefined(); // Élémentaires
      expect(WP_PUBLIC_ID_MAP[302]).toBeDefined(); // Crèches
      expect(WP_PUBLIC_ID_MAP[288]).toBeDefined(); // Conservatoires
      expect(WP_PUBLIC_ID_MAP[296]).toBeDefined(); // Enseignement supérieur
      expect(WP_PUBLIC_ID_MAP[286]).toBeDefined(); // Associations
    });

    it('should contain child category IDs - Maternelles', () => {
      expect(WP_PUBLIC_ID_MAP[306]?.grades).toContain('PS'); // Maternelles (petite section)
      expect(WP_PUBLIC_ID_MAP[347]?.grades).toContain('MS'); // Maternelles (moyenne section)
      expect(WP_PUBLIC_ID_MAP[307]?.grades).toContain('GS'); // Maternelles (grande section)
    });

    it('should contain child category IDs - Élémentaires', () => {
      expect(WP_PUBLIC_ID_MAP[351]?.grades).toContain('CP'); // Élémentaires (CP)
      expect(WP_PUBLIC_ID_MAP[352]?.grades).toContain('CE1'); // Élémentaires (CE1)
      expect(WP_PUBLIC_ID_MAP[353]?.grades).toContain('CE2'); // Élémentaires (CE2)
      expect(WP_PUBLIC_ID_MAP[354]?.grades).toContain('CM1'); // Élémentaires (CM1)
      expect(WP_PUBLIC_ID_MAP[355]?.grades).toContain('CM2'); // Élémentaires (CM2)
    });

    it('should contain child category IDs - Collèges', () => {
      expect(WP_PUBLIC_ID_MAP[310]?.grades).toContain('SIXIEME'); // Collèges (6ème)
      expect(WP_PUBLIC_ID_MAP[344]?.grades).toContain('CINQUIEME'); // Collèges (5ème)
      expect(WP_PUBLIC_ID_MAP[345]?.grades).toContain('QUATRIEME'); // Collèges (4ème)
      expect(WP_PUBLIC_ID_MAP[346]?.grades).toContain('TROISIEME'); // Collèges (3ème)
    });

    it('should contain child category IDs - Lycées', () => {
      expect(WP_PUBLIC_ID_MAP[348]?.grades).toContain('SECONDE'); // Lycées (seconde)
      expect(WP_PUBLIC_ID_MAP[349]?.grades).toContain('PREMIERE'); // Lycées (première)
      expect(WP_PUBLIC_ID_MAP[350]?.grades).toContain('TERMINALE'); // Lycées (terminale)
    });
  });

  describe('mapPublicIdsToCategories', () => {
    it('should return AUTRE for empty input', () => {
      expect(mapPublicIdsToCategories([])).toEqual({
        categories: [PublicCategory.AUTRE],
        grades: [],
        age_ranges: [],
      });
    });

    it('should map single ID correctly', () => {
      const result = mapPublicIdsToCategories([285]); // Maternelles
      expect(result.categories).toContain(PublicCategory.MATERNELLE);
    });

    it('should map multiple IDs and deduplicate', () => {
      const result = mapPublicIdsToCategories([285, 307]); // Both are Maternelles
      expect(result.categories).toHaveLength(1);
      expect(result.categories).toContain(PublicCategory.MATERNELLE);
    });

    it('should return AUTRE for unknown IDs', () => {
      expect(mapPublicIdsToCategories([9999])).toEqual({
        categories: [PublicCategory.AUTRE],
        grades: [],
        age_ranges: [],
      });
    });
  });

  // ============================================================================
  // PUBLIC_NAME_MAP Tests
  // ============================================================================
  describe('PUBLIC_NAME_MAP', () => {
    it('should contain public name mappings', () => {
      expect(PUBLIC_NAME_MAP['maternelle']).toBeDefined();
      expect(PUBLIC_NAME_MAP['college']).toBeDefined();
      expect(PUBLIC_NAME_MAP['lycee']).toBeDefined();
    });

    it('should handle accented variants', () => {
      expect(PUBLIC_NAME_MAP['élémentaire']).toBeDefined();
      expect(PUBLIC_NAME_MAP['collège']).toBeDefined();
    });
  });

  describe('mapPublicNamesToCategories', () => {
    it('should return AUTRE for empty input', () => {
      expect(mapPublicNamesToCategories([])).toEqual({
        categories: [PublicCategory.AUTRE],
        grades: [],
        age_ranges: [],
      });
    });

    it('should map public name correctly', () => {
      const result = mapPublicNamesToCategories(['lycees']);
      expect(result.categories).toContain(PublicCategory.LYCEE);
    });

    it('should handle plural forms', () => {
      const result = mapPublicNamesToCategories(['maternelles']);
      expect(result.categories).toContain(PublicCategory.MATERNELLE);
    });

    it('should return AUTRE for unknown names', () => {
      expect(mapPublicNamesToCategories(['unknown-public'])).toEqual({
        categories: [PublicCategory.AUTRE],
        grades: [],
        age_ranges: [],
      });
    });

    it('should handle partial match when no exact match found', () => {
      // 'maternelle' is in PUBLIC_NAME_MAP, so 'maternelle-test' should partial match
      const result = mapPublicNamesToCategories(['test-maternelle-suffix']);
      // Should find 'maternelle' via partial match
      expect(result.categories).toContain(PublicCategory.MATERNELLE);
    });

    it('should extract specific grades when available', () => {
      const result = mapPublicNamesToCategories(['maternelles (petite section)']);
      expect(result.categories).toContain(PublicCategory.MATERNELLE);
      expect(result.grades).toContain('PS');
    });

    it('should return empty audience targets when only root category is matched', () => {
      const result = mapPublicNamesToCategories(['maternelle']);
      expect(result.categories).toContain(PublicCategory.MATERNELLE);
      expect(result.grades).toEqual([]);
      expect(result.age_ranges).toEqual([]);
    });

    it('should handle multiple names with different grades', () => {
      const result = mapPublicNamesToCategories([
        'maternelles (petite section)',
        'maternelles (grande section)',
      ]);
      expect(result.categories).toContain(PublicCategory.MATERNELLE);
      expect(result.grades).toContain('PS');
      expect(result.grades).toContain('GS');
    });
  });

  // ============================================================================
  // WP_AGE_ID_MAP Tests
  // ============================================================================
  describe('WP_AGE_ID_MAP', () => {
    it('should contain all age range IDs', () => {
      expect(WP_AGE_ID_MAP[356]).toBe(AgeRange.AGE_0_3); // De 0 à 3 ans
      expect(WP_AGE_ID_MAP[357]).toBe(AgeRange.AGE_3_6); // De 3 à 6 ans
      expect(WP_AGE_ID_MAP[358]).toBe(AgeRange.AGE_6_11); // De 6 à 11 ans
      expect(WP_AGE_ID_MAP[359]).toBe(AgeRange.AGE_11_15); // De 11 à 15 ans
      expect(WP_AGE_ID_MAP[360]).toBe(AgeRange.AGE_15_18); // De 15 à 18 ans
      expect(WP_AGE_ID_MAP[361]).toBe(AgeRange.AGE_18_PLUS); // À partir de 18 ans
    });
  });

  describe('mapAgeIdsToRanges', () => {
    it('should return empty array for empty input', () => {
      expect(mapAgeIdsToRanges([])).toEqual([]);
    });

    it('should map single ID correctly', () => {
      const result = mapAgeIdsToRanges([356]); // De 0 à 3 ans
      expect(result).toContain(AgeRange.AGE_0_3);
    });

    it('should map multiple IDs and deduplicate', () => {
      const result = mapAgeIdsToRanges([356, 356]); // Same ID twice
      expect(result).toHaveLength(1);
      expect(result).toContain(AgeRange.AGE_0_3);
    });

    it('should return empty array for unknown IDs', () => {
      const result = mapAgeIdsToRanges([9999]);
      expect(result).toEqual([]);
    });

    it('should map multiple different IDs', () => {
      const result = mapAgeIdsToRanges([356, 357, 358]);
      expect(result).toContain(AgeRange.AGE_0_3);
      expect(result).toContain(AgeRange.AGE_3_6);
      expect(result).toContain(AgeRange.AGE_6_11);
    });
  });

  // ============================================================================
  // AGE_NAME_MAP Tests
  // ============================================================================
  describe('AGE_NAME_MAP', () => {
    it('should contain age name mappings', () => {
      expect(AGE_NAME_MAP['de 0 à 3 ans']).toBe(AgeRange.AGE_0_3);
      expect(AGE_NAME_MAP['de 3 à 6 ans']).toBe(AgeRange.AGE_3_6);
      expect(AGE_NAME_MAP['de 6 à 11 ans']).toBe(AgeRange.AGE_6_11);
    });

    it('should handle accented variants', () => {
      expect(AGE_NAME_MAP['de 0 a 3 ans']).toBe(AgeRange.AGE_0_3);
      expect(AGE_NAME_MAP['à partir de 18 ans']).toBe(AgeRange.AGE_18_PLUS);
    });
  });

  describe('mapAgeNamesToRanges', () => {
    it('should return empty array for empty input', () => {
      expect(mapAgeNamesToRanges([])).toEqual([]);
    });

    it('should map age name correctly', () => {
      const result = mapAgeNamesToRanges(['de 0 à 3 ans']);
      expect(result).toContain(AgeRange.AGE_0_3);
    });

    it('should handle accented variants', () => {
      const result = mapAgeNamesToRanges(['de 0 a 3 ans']);
      expect(result).toContain(AgeRange.AGE_0_3);
    });

    it('should return empty array for unknown names', () => {
      const result = mapAgeNamesToRanges(['unknown-age']);
      expect(result).toEqual([]);
    });

    it('should handle partial match when no exact match found', () => {
      const result = mapAgeNamesToRanges(['0 à 3 ans']);
      expect(result).toContain(AgeRange.AGE_0_3);
    });

    it('should map multiple different names', () => {
      const result = mapAgeNamesToRanges(['de 0 à 3 ans', 'de 3 à 6 ans']);
      expect(result).toContain(AgeRange.AGE_0_3);
      expect(result).toContain(AgeRange.AGE_3_6);
    });
  });
});
