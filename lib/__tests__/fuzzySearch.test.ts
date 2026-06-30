import { describe, expect, it } from '@jest/globals';
import {
  normalizeFrenchText,
  calculateFrenchSimilarity,
  findSimilarStrings,
  areSimilar,
} from '../search/fuzzySearch';

describe('fuzzySearch', () => {
  describe('normalizeFrenchText', () => {
    it('should convert to lowercase', () => {
      expect(normalizeFrenchText('ÉCOLE')).toBe('ecole');
      expect(normalizeFrenchText('TEST')).toBe('test');
    });

    it('should remove accents', () => {
      expect(normalizeFrenchText('École')).toBe('ecole');
      expect(normalizeFrenchText('Hôpital')).toBe('hopital');
      expect(normalizeFrenchText('Théâtre')).toBe('theatre');
      expect(normalizeFrenchText('Café')).toBe('cafe');
    });

    it('should trim whitespace', () => {
      expect(normalizeFrenchText('  test  ')).toBe('test');
      expect(normalizeFrenchText('\tschool\n')).toBe('school');
    });

    it('should handle combined transformations', () => {
      expect(normalizeFrenchText('  École Primaire  ')).toBe('ecole primaire');
      expect(normalizeFrenchText('Théâtre Municipal')).toBe('theatre municipal');
    });
  });

  describe('calculateFrenchSimilarity', () => {
    it('should return 100 for identical strings', () => {
      expect(calculateFrenchSimilarity('test', 'test')).toBe(100);
      expect(calculateFrenchSimilarity('École', 'École')).toBe(100);
    });

    it('should return 100 for strings that are identical after normalization', () => {
      expect(calculateFrenchSimilarity('École', 'ecole')).toBe(100);
      expect(calculateFrenchSimilarity('THÉÂTRE', 'théâtre')).toBe(100);
    });

    it('should return 0 for completely different strings', () => {
      const similarity = calculateFrenchSimilarity('abc', 'xyz');
      expect(similarity).toBe(0);
    });

    it('should return similarity percentage for similar strings', () => {
      const similarity = calculateFrenchSimilarity('test', 'tests');
      expect(similarity).toBeGreaterThan(70);
      expect(similarity).toBeLessThan(100);
    });

    it('should handle empty strings', () => {
      expect(calculateFrenchSimilarity('', '')).toBe(0);
      expect(calculateFrenchSimilarity('test', '')).toBe(0);
      expect(calculateFrenchSimilarity('', 'test')).toBe(0);
    });

    it('should be case and accent insensitive', () => {
      expect(calculateFrenchSimilarity('École Jean Jaurès', 'ECOLE JEAN JAURES')).toBe(100);
    });
  });

  describe('findSimilarStrings', () => {
    const candidates = [
      'École primaire Victor Hugo',
      'École élémentaire Jean Jaurès',
      'Lycée Montaigne',
      'Collège Gambetta',
    ];

    it('should find exact matches', () => {
      const results = findSimilarStrings('École primaire Victor Hugo', candidates, 80);
      expect(results.length).toBe(1);
      expect(results[0].value).toBe('École primaire Victor Hugo');
      expect(results[0].similarity).toBe(100);
    });

    it('should find similar strings above threshold', () => {
      const results = findSimilarStrings('Ecole primaire Victor Hugo', candidates, 80);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].value).toBe('École primaire Victor Hugo');
      expect(results[0].similarity).toBeGreaterThanOrEqual(80);
    });

    it('should filter out strings below threshold', () => {
      const results = findSimilarStrings('Lycée', candidates, 80);
      // Should only find exact or very close matches
      results.forEach((result) => {
        expect(result.similarity).toBeGreaterThanOrEqual(80);
      });
    });

    it('should return results sorted by similarity descending', () => {
      const results = findSimilarStrings('École primaire', candidates, 50);
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].similarity).toBeGreaterThanOrEqual(results[i + 1].similarity);
      }
    });

    it('should return empty array if no matches above threshold', () => {
      const results = findSimilarStrings('Université Paris', candidates, 90);
      expect(results.length).toBe(0);
    });

    it('should handle empty candidates array', () => {
      const results = findSimilarStrings('test', [], 80);
      expect(results).toEqual([]);
    });
  });

  describe('areSimilar', () => {
    it('should return true for identical strings', () => {
      expect(areSimilar('test', 'test')).toBe(true);
      expect(areSimilar('École', 'école')).toBe(true);
    });

    it('should return true for similar strings above default threshold (80%)', () => {
      expect(areSimilar('École primaire', 'Ecole primaire')).toBe(true);
      expect(areSimilar('Victor Hugo', 'victor hugo')).toBe(true);
    });

    it('should return false for dissimilar strings below threshold', () => {
      expect(areSimilar('abc', 'xyz')).toBe(false);
      expect(areSimilar('École', 'Lycée')).toBe(false);
    });

    it('should use custom threshold when provided', () => {
      expect(areSimilar('test', 'tests', 50)).toBe(true);
      expect(areSimilar('test', 'testing', 90)).toBe(false);
      expect(areSimilar('École', 'Écoles', 70)).toBe(true);
    });

    it('should return false for empty strings', () => {
      expect(areSimilar('', '')).toBe(false);
      expect(areSimilar('test', '')).toBe(false);
      expect(areSimilar('', 'test')).toBe(false);
    });
  });
});
