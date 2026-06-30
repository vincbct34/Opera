/**
 * Tests for institution search with fuzzy matching and relevance scoring
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateInstitutionScore,
  searchInstitutions,
  buildSearchWhereClause,
  InstitutionSearchData,
} from '../search/institutionSearch';
import { PublicCategory } from '@/app/generated/prisma';

describe('Institution Search', () => {
  // Sample institutions for testing
  const sampleInstitutions: InstitutionSearchData[] = [
    {
      id: '1',
      name: 'École Primaire Jean Jaurès',
      type: [PublicCategory.ELEMENTAIRE],
      address: {
        street: '10 rue de la République',
        zip_code: '34000',
        city: 'Montpellier',
      },
    },
    {
      id: '2',
      name: 'École Élémentaire Jean Moulin',
      type: [PublicCategory.ELEMENTAIRE],
      address: {
        street: '5 avenue Victor Hugo',
        zip_code: '34070',
        city: 'Montpellier',
      },
    },
    {
      id: '3',
      name: 'Collège Jean Jaurès',
      type: [PublicCategory.COLLEGE],
      address: {
        street: '20 boulevard des Arceaux',
        zip_code: '34000',
        city: 'Montpellier',
      },
    },
    {
      id: '4',
      name: 'Lycée Jean Monnet',
      type: [PublicCategory.LYCEE],
      address: {
        street: '15 rue des Écoles',
        zip_code: '34000',
        city: 'Montpellier',
      },
    },
    {
      id: '5',
      name: 'École Maternelle Les Petits',
      type: [PublicCategory.MATERNELLE],
      address: {
        street: '3 impasse des Fleurs',
        zip_code: '34080',
        city: 'Montpellier',
      },
    },
    {
      id: '6',
      name: 'Association Culturelle Montpellier',
      type: [PublicCategory.ASSOCIATION],
      address: {
        street: '8 place de la Comédie',
        zip_code: '34000',
        city: 'Montpellier',
      },
    },
    {
      id: '7',
      name: 'École Primaire Paul Valéry',
      type: [PublicCategory.ELEMENTAIRE],
      address: {
        street: '12 rue Foch',
        zip_code: '34200',
        city: 'Sète',
      },
    },
  ];

  describe('calculateInstitutionScore', () => {
    it('should give highest score to exact name match', () => {
      const institution = sampleInstitutions[0]; // École Primaire Jean Jaurès
      const { score, matchReasons } = calculateInstitutionScore(
        institution,
        'École Primaire Jean Jaurès',
      );

      expect(score).toBeGreaterThan(500);
      expect(matchReasons).toContain('Nom correspond exactement');
    });

    it('should handle French accent normalization', () => {
      const institution = sampleInstitutions[1]; // École Élémentaire Jean Moulin
      const { score: score1 } = calculateInstitutionScore(institution, 'ecole elementaire');
      const { score: score2 } = calculateInstitutionScore(institution, 'école élémentaire');

      // Both should match despite accent differences
      expect(score1).toBeGreaterThan(0);
      expect(score2).toBeGreaterThan(0);
    });

    it('should handle typos with fuzzy matching', () => {
      const institution = sampleInstitutions[0]; // École Primaire Jean Jaurès
      const { score } = calculateInstitutionScore(institution, 'Jean Jaures'); // Missing accent

      // Should still find the institution despite the typo (missing accent)
      expect(score).toBeGreaterThan(0);
    });

    it('should match by zip code in city field', () => {
      const institution = sampleInstitutions[0]; // 34000
      const { score, matchReasons } = calculateInstitutionScore(institution, 'Jean', '34000');

      expect(score).toBeGreaterThan(0);
      expect(matchReasons).toContain('Code postal correspond');
    });

    it('should match partial zip code in city field', () => {
      const institution = sampleInstitutions[0]; // 34000
      const { score, matchReasons } = calculateInstitutionScore(institution, 'Jean', '340');

      expect(score).toBeGreaterThan(0);
      expect(matchReasons).toContain('Code postal correspond');
    });

    it('should give bonus for all keywords found in name', () => {
      const institution = sampleInstitutions[0]; // École Primaire Jean Jaurès
      const { score, matchReasons } = calculateInstitutionScore(institution, 'ecole jean');

      expect(score).toBeGreaterThan(0);
      expect(matchReasons.some((r) => r.includes('mots-clés'))).toBe(true);
    });

    it('should recognize institution types in name query', () => {
      const institution = sampleInstitutions[2]; // Collège Jean Jaurès
      const { score, matchReasons } = calculateInstitutionScore(institution, 'collège jean');

      expect(score).toBeGreaterThan(0);
      expect(matchReasons.some((r) => r.includes('Type correspondant'))).toBe(true);
    });

    it('should boost score when both name and city match', () => {
      const institution = sampleInstitutions[0]; // École Primaire Jean Jaurès, Montpellier
      const { score: nameOnlyScore } = calculateInstitutionScore(institution, 'Jean Jaurès');
      const { score: nameAndCityScore } = calculateInstitutionScore(
        institution,
        'Jean Jaurès',
        'Montpellier',
      );

      expect(nameAndCityScore).toBeGreaterThan(nameOnlyScore);
    });

    it('should handle city name variations', () => {
      const institution = sampleInstitutions[0]; // Montpellier
      const { score: exactScore } = calculateInstitutionScore(institution, 'Jean', 'Montpellier');
      const { score: partialScore } = calculateInstitutionScore(institution, 'Jean', 'Montpel');

      expect(exactScore).toBeGreaterThan(partialScore);
      expect(partialScore).toBeGreaterThan(0);
    });

    it('should use fuzzy matching for name typos with similarity 70-99%', () => {
      const institution = sampleInstitutions[0]; // École Primaire Jean Jaurès
      // Query that has some similarity but not exact (typo in "Jean" -> "Jan")
      const { score, matchReasons } = calculateInstitutionScore(
        institution,
        'École Primaire Jan Jaurès',
      );

      expect(score).toBeGreaterThan(0);
      // Should trigger fuzzy name matching (lines 114-116)
      expect(matchReasons.some((r) => r.includes('Nom similaire'))).toBe(true);
    });

    it('should match when city contains query but does not start with it', () => {
      const institution = sampleInstitutions[0]; // Montpellier
      // Query that is contained in city name but not at the start
      const { score, matchReasons } = calculateInstitutionScore(institution, 'Jean', 'pellier');

      expect(score).toBeGreaterThan(0);
      // Should trigger city contains matching (lines 129-131)
      expect(matchReasons).toContain('Ville contient la recherche');
    });

    it('should use fuzzy matching for city typos with similarity 70-99%', () => {
      const institution = sampleInstitutions[0]; // Montpellier
      // Query with typo in city name
      const { score, matchReasons } = calculateInstitutionScore(institution, 'Jean', 'Montpelier');

      expect(score).toBeGreaterThan(0);
      // Should trigger fuzzy city matching (lines 160-162)
      expect(matchReasons.some((r) => r.includes('Ville similaire'))).toBe(true);
    });

    it('should handle single-character keywords in name query', () => {
      const institution = sampleInstitutions[0]; // École Primaire Jean Jaurès
      // Query with single char keyword that should be filtered
      const { score } = calculateInstitutionScore(institution, 'a école jean');

      expect(score).toBeGreaterThan(0);
      // The 'a' should be filtered out (line 96 - continue branch)
    });

    it('should handle single-character keywords in city query', () => {
      const institution = sampleInstitutions[0]; // Montpellier
      // Query with single char keyword in city that should be filtered
      const { score } = calculateInstitutionScore(institution, 'Jean', 'a Montpellier');

      expect(score).toBeGreaterThan(0);
      // The 'a' should be filtered out (line 136 - continue branch)
    });
  });

  describe('searchInstitutions', () => {
    it('should return results sorted by relevance', () => {
      const results = searchInstitutions(sampleInstitutions, 'Jean Jaurès');

      expect(results.length).toBeGreaterThan(0);
      // First result should be the exact match (École Primaire Jean Jaurès)
      expect(results[0].name).toContain('Jean Jaurès');
      // Results should be sorted by score descending
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    });

    it('should limit results based on config', () => {
      const results = searchInstitutions(sampleInstitutions, 'Jean', 'Montpellier', {
        maxResults: 3,
      });

      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should filter by minimum score', () => {
      const results = searchInstitutions(sampleInstitutions, 'xyz', undefined, { minScore: 50 });

      // No institution should match 'xyz' with score >= 50
      expect(results.length).toBe(0);
    });

    it('should handle multi-word name searches', () => {
      const results = searchInstitutions(sampleInstitutions, 'école primaire');

      expect(results.length).toBeGreaterThan(0);
      // All results should have école or primaire in name
      results.forEach((result) => {
        const hasKeyword =
          result.name.toLowerCase().includes('école') ||
          result.name.toLowerCase().includes('primaire');
        expect(hasKeyword).toBe(true);
      });
    });

    it('should prioritize name over city matches', () => {
      const results = searchInstitutions(sampleInstitutions, 'Jean');

      expect(results.length).toBeGreaterThan(0);
      // Jean Jaurès schools should rank higher
      const topResult = results[0];
      expect(topResult.name.toLowerCase()).toContain('jean');
    });

    it('should find institutions by type keyword in name', () => {
      const results = searchInstitutions(sampleInstitutions, 'association');

      expect(results.length).toBeGreaterThan(0);
      const hasAssociation = results.some((r) => r.type.includes(PublicCategory.ASSOCIATION));
      expect(hasAssociation).toBe(true);
    });

    it('should handle city-only searches', () => {
      const results = searchInstitutions(sampleInstitutions, 'Paul', 'Sète');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].address.city).toBe('Sète');
    });

    it('should handle searches with accents vs without', () => {
      const resultsWithAccent = searchInstitutions(sampleInstitutions, 'école');
      const resultsWithoutAccent = searchInstitutions(sampleInstitutions, 'ecole');

      // Both should find schools
      expect(resultsWithAccent.length).toBeGreaterThan(0);
      expect(resultsWithoutAccent.length).toBeGreaterThan(0);
      // Should return similar results
      expect(resultsWithAccent.length).toBe(resultsWithoutAccent.length);
    });

    it('should combine name and city filtering', () => {
      const results = searchInstitutions(sampleInstitutions, 'Jean', 'Montpellier');

      expect(results.length).toBeGreaterThan(0);
      // All results should be from Montpellier
      results.forEach((result) => {
        expect(result.address.city).toBe('Montpellier');
      });
      // And have Jean in the name
      expect(results[0].name.toLowerCase()).toContain('jean');
    });
  });

  describe('buildSearchWhereClause', () => {
    it('should create OR conditions for name keywords', () => {
      const where = buildSearchWhereClause('Jean Jaurès');

      expect(where.OR).toBeDefined();
      expect(Array.isArray(where.OR)).toBe(true);
      if (Array.isArray(where.OR)) {
        expect(where.OR.length).toBeGreaterThan(0);
      }
    });

    it('should handle single keyword name searches', () => {
      const where = buildSearchWhereClause('école');

      expect(where.OR).toBeDefined();
      expect(Array.isArray(where.OR)).toBe(true);
    });

    it('should create AND conditions when both name and city provided', () => {
      const where = buildSearchWhereClause('Jean', 'Montpellier');

      expect(where.AND).toBeDefined();
      if (Array.isArray(where.AND)) {
        expect(where.AND.length).toBe(2); // One for name, one for city
      }
    });

    it('should handle zip code in city field', () => {
      const where = buildSearchWhereClause('Jean', '34000');

      expect(where.AND).toBeDefined();
      if (Array.isArray(where.AND)) {
        // Should have city OR conditions including zip code
        const cityConditions = where.AND[1];
        if (cityConditions && typeof cityConditions === 'object' && 'OR' in cityConditions) {
          expect(cityConditions.OR).toBeDefined();
        }
      }
    });

    it('should create keyword conditions for multi-word name query', () => {
      const where = buildSearchWhereClause('école primaire jean');

      expect(where.OR).toBeDefined();
      // Should have conditions for each keyword + full query
      if (Array.isArray(where.OR)) {
        expect(where.OR.length).toBeGreaterThan(3);
      }
    });

    it('should handle institution with null zip_code', () => {
      const institution: InstitutionSearchData = {
        id: '99',
        name: 'Test School',
        type: [PublicCategory.ELEMENTAIRE],
        address: {
          street: '1 rue test',
          zip_code: null as unknown as string,
          city: 'Montpellier',
        },
      };

      const { score } = calculateInstitutionScore(institution, 'Test School');
      expect(score).toBeGreaterThan(0);
    });

    it('should handle name-only search (no city)', () => {
      const where = buildSearchWhereClause('Jean');

      // Should just have name conditions (no AND)
      expect(where.OR).toBeDefined();
      expect(where.AND).toBeUndefined();
    });

    it('should return empty object when name is too short', () => {
      const where = buildSearchWhereClause('J');

      // Should return empty object (line 299)
      expect(Object.keys(where).length).toBe(0);
    });
  });
});
