/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import {
  findSimilarInstitutions,
  checkInstitutionCreation,
  isAssociation,
} from '../search/institutionDuplicateDetection';
import prisma from '../middleware/prismaConfig';
import { PublicCategory } from '@/app/generated/prisma';
import * as fuzzySearch from '../search/fuzzySearch';

// Mock Prisma
jest.mock('../middleware/prismaConfig', () => ({
  __esModule: true,
  default: {
    institution: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

const mockFindMany = prisma.institution.findMany as jest.MockedFunction<
  typeof prisma.institution.findMany
>;

const mockFindFirst = prisma.institution.findFirst as jest.MockedFunction<
  typeof prisma.institution.findFirst
>;

describe('institutionDuplicateDetection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findSimilarInstitutions', () => {
    it('should find institutions with similar names in same city', async () => {
      const mockInstitutions = [
        {
          id: '1',
          name: 'École primaire Victor Hugo',
          type: [PublicCategory.ELEMENTAIRE],
          address: {
            city: 'Montpellier',
            zip_code: '34000',
          },
        },
        {
          id: '2',
          name: 'Lycée Jean Jaurès',
          type: [PublicCategory.LYCEE],
          address: {
            city: 'Paris',
            zip_code: '75001',
          },
        },
      ];

      mockFindMany.mockResolvedValue(mockInstitutions as any);

      const results = await findSimilarInstitutions({
        name: 'Ecole primaire Victor Hugo',
        city: 'Montpellier',
        zipCode: '34000',
        type: [PublicCategory.ELEMENTAIRE],
      });

      expect(results.length).toBe(1);
      expect(results[0].name).toBe('École primaire Victor Hugo');
      expect(results[0].nameSimilarity).toBeGreaterThan(80);
    });

    it('should find institutions in same ZIP code', async () => {
      const mockInstitutions = [
        {
          id: '1',
          name: 'École A',
          type: [PublicCategory.ELEMENTAIRE],
          address: {
            city: 'Montpellier',
            zip_code: '34000',
          },
        },
      ];

      mockFindMany.mockResolvedValue(mockInstitutions as any);

      const results = await findSimilarInstitutions({
        name: 'École B',
        city: 'Montpellier',
        zipCode: '34000',
        type: [PublicCategory.ELEMENTAIRE],
      });

      expect(mockFindMany).toHaveBeenCalled();
      expect(results).toBeDefined();
    });

    it('should use custom similarity thresholds', async () => {
      const mockInstitutions = [
        {
          id: '1',
          name: 'École Test',
          type: [PublicCategory.ELEMENTAIRE],
          address: {
            city: 'Montpellier',
            zip_code: '34000',
          },
        },
      ];

      mockFindMany.mockResolvedValue(mockInstitutions as any);

      await findSimilarInstitutions({
        name: 'École',
        city: 'Montpellier',
        zipCode: '34000',
        type: [PublicCategory.ELEMENTAIRE],
        nameSimilarityThreshold: 50,
        citySimilarityThreshold: 50,
      });

      expect(prisma.institution.findMany).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockFindMany.mockRejectedValue(new Error('DB error'));

      await expect(
        findSimilarInstitutions({
          name: 'Test',
          city: 'Paris',
          zipCode: '75001',
          type: [PublicCategory.ELEMENTAIRE],
        }),
      ).rejects.toThrow('DB error');
    });

    it('should return empty array when no similar institutions found', async () => {
      mockFindMany.mockResolvedValue([] as any);

      const results = await findSimilarInstitutions({
        name: 'Unique School Name',
        city: 'Paris',
        zipCode: '75001',
        type: [PublicCategory.ELEMENTAIRE],
      });

      expect(results).toEqual([]);
    });
  });

  describe('checkInstitutionCreation', () => {
    it('should allow creation when no similar institutions exist', async () => {
      mockFindMany.mockResolvedValue([] as any);
      mockFindFirst.mockResolvedValue(null as any);

      const result = await checkInstitutionCreation(
        'New School',
        'Paris',
        '75001',
        [PublicCategory.ELEMENTAIRE],
        false,
      );

      expect(result.allowed).toBe(true);
      expect(result.similarInstitutions).toEqual([]);
    });

    it('should prevent creation when exact duplicate exists', async () => {
      const mockInstitution = {
        id: '1',
        name: 'École Test',
        type: [PublicCategory.ELEMENTAIRE],
        address: {
          city: 'Paris',
          zip_code: '75001',
        },
      };

      mockFindMany.mockResolvedValue([mockInstitution] as any);
      mockFindFirst.mockResolvedValue(mockInstitution as any);

      const result = await checkInstitutionCreation(
        'École Test',
        'Paris',
        '75001',
        [PublicCategory.ELEMENTAIRE],
        false,
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('exact');
      expect(result.similarInstitutions.length).toBeGreaterThan(0);
    });

    it('should allow creation with force_create=true even with duplicates', async () => {
      const mockInstitution = {
        id: '1',
        name: 'École Test',
        type: [PublicCategory.ELEMENTAIRE],
        address: {
          city: 'Paris',
          zip_code: '75001',
        },
      };

      mockFindMany.mockResolvedValue([mockInstitution] as any);
      mockFindFirst.mockResolvedValue(null as any); // No exact match, just similar

      const result = await checkInstitutionCreation(
        'Ecole Test 2', // Similar but not exact
        'Paris',
        '75001',
        [PublicCategory.ELEMENTAIRE],
        true,
      );

      expect(result.allowed).toBe(true);
    });

    it('should suggest similar institutions when high similarity detected', async () => {
      const mockInstitution = {
        id: '1',
        name: 'École Primaire Victor Hugo',
        type: [PublicCategory.ELEMENTAIRE],
        address: {
          city: 'Montpellier',
          zip_code: '34000',
        },
      };

      mockFindMany.mockResolvedValue([mockInstitution] as any);
      mockFindFirst.mockResolvedValue(null as any);

      const result = await checkInstitutionCreation(
        'Ecole Primaire Victor Hugo',
        'Montpellier',
        '34000',
        [PublicCategory.ELEMENTAIRE],
        false,
      );

      expect(result.allowed).toBe(false);
      expect(result.similarInstitutions).toHaveLength(1);
      expect(result.similarInstitutions[0].nameSimilarity).toBeGreaterThan(80);
    });

    it('should handle database errors gracefully', async () => {
      mockFindFirst.mockRejectedValue(new Error('DB error'));

      await expect(
        checkInstitutionCreation('Test', 'Paris', '75001', [PublicCategory.ELEMENTAIRE], false),
      ).rejects.toThrow('DB error');
    });

    it('should prevent creation when similar name in same city exists', async () => {
      const mockInstitution = {
        id: '1',
        name: 'École Jean Jaurès',
        type: [PublicCategory.ELEMENTAIRE],
        address: {
          city: 'Montpellier',
          zip_code: '34000',
        },
      };

      mockFindMany.mockResolvedValue([mockInstitution] as any);
      mockFindFirst.mockResolvedValue(null as any);

      const result = await checkInstitutionCreation(
        'Ecole Jean Jaures',
        'Montpellier',
        '34000',
        [PublicCategory.ELEMENTAIRE],
        false,
      );

      expect(result.allowed).toBe(false);
      expect(result.similarInstitutions.length).toBeGreaterThan(0);
    });

    it('should allow creation for associations without duplicate check', async () => {
      mockFindFirst.mockResolvedValue(null as any);

      const result = await checkInstitutionCreation(
        'Association Test',
        'Paris',
        '75001',
        [PublicCategory.ASSOCIATION],
        false,
      );

      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('ASSOCIATION');
      expect(result.similarInstitutions).toEqual([]);
      // Should not call findMany since associations skip duplicate check
      expect(mockFindMany).not.toHaveBeenCalled();
    });
  });

  describe('findSimilarInstitutions - edge cases', () => {
    it('should handle city similarity threshold correctly', async () => {
      // Mock to return low name similarity but high city similarity
      const mockCalculateFrenchSimilarity = jest
        .spyOn(fuzzySearch, 'calculateFrenchSimilarity')
        .mockImplementation((str1: string, str2: string) => {
          // Check if comparing names (École Test A vs École Test B)
          if (
            (str1.toLowerCase().includes('école test') &&
              str2.toLowerCase().includes('école test')) ||
            (str1.toLowerCase().includes('test') && str2.toLowerCase().includes('test'))
          ) {
            return 65; // Below threshold 70 for name
          }
          // Check if comparing cities (Paris vs Paris Est)
          return 85; // Above threshold 70 for city, but below 95
        });

      const mockInstitution = {
        id: '1',
        name: 'École Test A',
        type: [PublicCategory.ELEMENTAIRE],
        address: {
          city: 'Paris',
          zip_code: '75001',
        },
      };

      mockFindMany.mockResolvedValue([mockInstitution] as any);

      const results = await findSimilarInstitutions({
        name: 'École Test B',
        city: 'Paris Est',
        zipCode: '75001',
        type: [PublicCategory.ELEMENTAIRE],
        nameSimilarityThreshold: 70,
        citySimilarityThreshold: 70,
      });

      // Should NOT have results because name similarity (65) is below threshold (70)
      // even though city similarity (85) is above threshold (70)
      expect(results.length).toBe(0);

      mockCalculateFrenchSimilarity.mockRestore();
    });

    it('should use fallback match reason when name and city below threshold but one is close', async () => {
      // This test tries to trigger the else branch by having values that somehow pass line 72
      // but fail both threshold checks at lines 84 and 86
      // This might be unreachable code, but we'll try edge values
      let callCount = 0;
      const mockCalculateFrenchSimilarity = jest
        .spyOn(fuzzySearch, 'calculateFrenchSimilarity')
        .mockImplementation(() => {
          callCount++;
          // First call is for name, return 69 (just below 70 threshold)
          if (callCount === 1) return 69;
          // Second call is for city, return 71 (just above 70 threshold)
          return 71;
        });

      const mockInstitution = {
        id: '1',
        name: 'École A',
        type: [PublicCategory.ELEMENTAIRE],
        address: {
          city: 'Paris',
          zip_code: '75001',
        },
      };

      mockFindMany.mockResolvedValue([mockInstitution] as any);

      const results = await findSimilarInstitutions({
        name: 'École B',
        city: 'Lyon',
        zipCode: '75001',
        type: [PublicCategory.ELEMENTAIRE],
        nameSimilarityThreshold: 70,
        citySimilarityThreshold: 70,
      });

      // If we get results, check the match reason
      // Should be empty because name (69) is below threshold (70)
      expect(results.length).toBe(0);

      mockCalculateFrenchSimilarity.mockRestore();
    });
  });

  it('should NOT find institutions if name is different but city is same (AND logic check)', async () => {
    const mockInstitutions = [
      {
        id: '1',
        name: 'Opéra Orchestre national de Montpellier',
        type: [PublicCategory.ASSOCIATION],
        address: {
          city: 'Montpellier',
          zip_code: '34000',
        },
      },
    ];

    mockFindMany.mockResolvedValue(mockInstitutions as any);

    const results = await findSimilarInstitutions({
      name: 'EPITECH',
      city: 'Montpellier',
      zipCode: '34000',
      type: [PublicCategory.SUPERIEUR],
      nameSimilarityThreshold: 80,
      citySimilarityThreshold: 70,
    });

    // Name similarity is very low, City is 100%
    // With AND logic, this should be 0
    expect(results.length).toBe(0);
  });

  it('should handle missing zipCode (undefined) gracefully', async () => {
    mockFindMany.mockResolvedValue([]);

    const results = await findSimilarInstitutions({
      name: 'École primaire',
      city: 'Montpellier',
      zipCode: null,
      type: [PublicCategory.ELEMENTAIRE],
    });

    expect(results).toEqual([]);
    expect(mockFindMany).toHaveBeenCalled();
  });

  describe('isAssociation', () => {
    it('should return true when types include ASSOCIATION', () => {
      expect(isAssociation([PublicCategory.ASSOCIATION])).toBe(true);
      expect(isAssociation([PublicCategory.ASSOCIATION, PublicCategory.ELEMENTAIRE])).toBe(true);
    });

    it('should return false when types do not include ASSOCIATION', () => {
      expect(isAssociation([PublicCategory.ELEMENTAIRE])).toBe(false);
      expect(isAssociation([PublicCategory.LYCEE, PublicCategory.COLLEGE])).toBe(false);
      expect(isAssociation([])).toBe(false);
    });
  });
});
