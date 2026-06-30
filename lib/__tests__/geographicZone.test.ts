import { describe, it, expect } from '@jest/globals';
import {
  determineGeographicZone,
  GEOGRAPHIC_ZONE_LABELS,
  GEOGRAPHIC_ZONE_PRIORITY,
} from '../validation/geographicZone';

describe('geographicZone', () => {
  describe('determineGeographicZone', () => {
    it('should return MONTPELLIER for Montpellier city', () => {
      expect(determineGeographicZone('Montpellier', '34000')).toBe('MONTPELLIER');
      expect(determineGeographicZone('montpellier', '34000')).toBe('MONTPELLIER');
      expect(determineGeographicZone('MONTPELLIER', '34090')).toBe('MONTPELLIER');
    });

    it('should return METROPOLE for cities in the Métropole', () => {
      expect(determineGeographicZone('Castelnau-le-Lez', '34170')).toBe('METROPOLE');
      expect(determineGeographicZone('Lattes', '34970')).toBe('METROPOLE');
      expect(determineGeographicZone('Grabels', '34790')).toBe('METROPOLE');
      expect(determineGeographicZone('Pérols', '34470')).toBe('METROPOLE');
      expect(determineGeographicZone('Saint-Jean-de-Védas', '34430')).toBe('METROPOLE');
    });

    it('should handle city names with accents and special characters', () => {
      expect(determineGeographicZone('Lavérune', '34880')).toBe('METROPOLE');
      expect(determineGeographicZone('Laverune', '34880')).toBe('METROPOLE');
      expect(determineGeographicZone('Saint-Drézéry', '34160')).toBe('METROPOLE');
      expect(determineGeographicZone("Saint-Georges d'Orques", '34680')).toBe('METROPOLE');
      expect(determineGeographicZone('Saint Georges dOrques', '34680')).toBe('METROPOLE');
    });

    it('should return HERAULT for cities in Hérault outside Métropole', () => {
      expect(determineGeographicZone('Béziers', '34500')).toBe('HERAULT');
      expect(determineGeographicZone('Sète', '34200')).toBe('HERAULT');
      expect(determineGeographicZone('Agde', '34300')).toBe('HERAULT');
      expect(determineGeographicZone('Lunel', '34400')).toBe('HERAULT');
    });

    it('should return OUTSIDE for cities outside Hérault', () => {
      expect(determineGeographicZone('Toulouse', '31000')).toBe('OUTSIDE');
      expect(determineGeographicZone('Marseille', '13000')).toBe('OUTSIDE');
      expect(determineGeographicZone('Paris', '75001')).toBe('OUTSIDE');
      expect(determineGeographicZone('Nîmes', '30000')).toBe('OUTSIDE');
    });

    it('should handle case-insensitive and normalized inputs', () => {
      expect(determineGeographicZone('CASTELNAU-LE-LEZ', '34170')).toBe('METROPOLE');
      expect(determineGeographicZone('castelnau le lez', '34170')).toBe('METROPOLE');
      expect(determineGeographicZone('CastelnauLeLez', '34170')).toBe('METROPOLE');
    });

    it('should prioritize Montpellier over Métropole check', () => {
      // Si quelqu'un nomme une ville "Montpellier" même avec un autre code postal
      expect(determineGeographicZone('Montpellier', '99999')).toBe('MONTPELLIER');
    });

    it('should prioritize Métropole over Hérault check', () => {
      // Vérifier qu'une ville de la Métropole est bien identifiée comme METROPOLE
      // même si le code postal commence par 34
      expect(determineGeographicZone('Lattes', '34970')).toBe('METROPOLE');
      expect(determineGeographicZone('Pérols', '34470')).toBe('METROPOLE');
    });
  });

  describe('GEOGRAPHIC_ZONE_LABELS', () => {
    it('should have labels for all zones', () => {
      expect(GEOGRAPHIC_ZONE_LABELS.MONTPELLIER).toBe('Montpellier');
      expect(GEOGRAPHIC_ZONE_LABELS.METROPOLE).toBe('Métropole de Montpellier');
      expect(GEOGRAPHIC_ZONE_LABELS.HERAULT).toBe("Département de l'Hérault");
      expect(GEOGRAPHIC_ZONE_LABELS.OUTSIDE).toBe('Hors département');
    });
  });

  describe('GEOGRAPHIC_ZONE_PRIORITY', () => {
    it('should have correct priority order (higher = closer)', () => {
      expect(GEOGRAPHIC_ZONE_PRIORITY.MONTPELLIER).toBe(4);
      expect(GEOGRAPHIC_ZONE_PRIORITY.METROPOLE).toBe(3);
      expect(GEOGRAPHIC_ZONE_PRIORITY.HERAULT).toBe(2);
      expect(GEOGRAPHIC_ZONE_PRIORITY.OUTSIDE).toBe(1);
    });

    it('should have descending priority from closest to farthest', () => {
      expect(GEOGRAPHIC_ZONE_PRIORITY.MONTPELLIER).toBeGreaterThan(
        GEOGRAPHIC_ZONE_PRIORITY.METROPOLE,
      );
      expect(GEOGRAPHIC_ZONE_PRIORITY.METROPOLE).toBeGreaterThan(GEOGRAPHIC_ZONE_PRIORITY.HERAULT);
      expect(GEOGRAPHIC_ZONE_PRIORITY.HERAULT).toBeGreaterThan(GEOGRAPHIC_ZONE_PRIORITY.OUTSIDE);
    });
  });
});
