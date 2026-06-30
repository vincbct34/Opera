/**
 * Validation tests for scoring engine implementation
 * Ensures all criteria definitions match their implementation
 */

import { describe, it, expect } from '@jest/globals';
import {
  CRITERIA_DEFINITIONS,
  getCriterionDefinition,
  getDefaultEnabledCriteria,
  getCriteriaByCategory,
  type ScoringCriterionType,
} from '../criteriaDefinitions';
import {
  ScoringEngine,
  type CriterionConfig,
  type InstitutionHistory,
  type RegistrationData,
  type RegistrationWithHistory,
} from '../scoringEngine';

// Helper to create mock data
const createMockData = (
  regOverrides: Partial<RegistrationData> = {},
  historyOverrides: Partial<InstitutionHistory> = {},
): RegistrationWithHistory => ({
  registration: {
    id: 'test-reg',
    user_id: 'test-user',
    institution_id: 'test-inst',
    event_id: 'test-event',
    date: new Date('2024-12-01'),
    booked_seats: 30,
    caretaker_count: 2,
    aesh_count: null,
    comments: null,
    status: 'PENDING',
    created_at: new Date('2024-10-01'),
    institution: {
      id: 'test-inst',
      name: 'Test Institution',
      type: ['ELEMENTAIRE'],
      is_rep: false,
      address: {
        city: 'Montpellier',
        zip_code: '34000',
      },
    },
    disabilities: [],
    category: [],
    grades: [],
    age_ranges: [],
    ...regOverrides,
  },
  institutionHistory: {
    institutionId: 'test-inst',
    totalRegistrations: 5,
    confirmedCount: 5,
    attendedCount: 4,
    noShowCount: 1,
    cancelledCount: 0,
    attendanceRate: 80,
    confirmationRate: 100,
    lastAttendedDate: new Date('2024-01-01'),
    monthsSinceLastAttendance: 10,
    recentNoShow: false,
    recentRegistrations: [],
    ...historyOverrides,
  },
});

describe('Scoring Engine Implementation Validation', () => {
  describe('Criteria Definitions Integrity', () => {
    it('should have all criterion types defined', () => {
      const criterionTypes: ScoringCriterionType[] = [
        'ATTENDANCE_RATE',
        'MONTHS_SINCE_LAST',
        'TOTAL_PARTICIPATIONS',
        'RECENT_NO_SHOW',
        'IS_REP_INSTITUTION',
        'FIRST_TIME_APPLICANT',
        'ACCESSIBILITY_NEEDS',
        'EARLY_REGISTRATION',
        'INSTITUTION_TYPE',
        'REQUESTED_SEATS_COUNT',
        'CARETAKER_RATIO',
        'GEOGRAPHIC_ZONE',
        'EVENT_CATEGORY_MATCH',
        'AESH_COUNT',
      ];

      criterionTypes.forEach((type) => {
        expect(CRITERIA_DEFINITIONS[type]).toBeDefined();
        expect(CRITERIA_DEFINITIONS[type].type).toBe(type);
      });
    });

    it('should have valid default weights', () => {
      Object.values(CRITERIA_DEFINITIONS).forEach((criterion) => {
        expect(criterion.defaultWeight).toBeGreaterThanOrEqual(0);
        expect(criterion.defaultWeight).toBeLessThanOrEqual(100);
      });
    });

    it('should have valid parameter definitions', () => {
      Object.values(CRITERIA_DEFINITIONS).forEach((criterion) => {
        criterion.parameterDefinitions.forEach((param) => {
          // Check parameter has all required fields
          expect(param.key).toBeDefined();
          expect(param.label).toBeDefined();
          expect(param.type).toBeDefined();
          expect(param.defaultValue).toBeDefined();

          // Check numeric parameters have valid min/max
          if (param.type === 'number') {
            if (param.min !== undefined && param.max !== undefined) {
              expect(param.min).toBeLessThanOrEqual(param.max);
            }
          }

          // Check select/multiselect have options
          if (param.type === 'select' || param.type === 'multiselect') {
            expect(param.options).toBeDefined();
            expect(param.options!.length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should mark penalty criteria correctly', () => {
      const penaltyCriteria = Object.values(CRITERIA_DEFINITIONS).filter((c) => c.isPenalty);

      // Only RECENT_NO_SHOW should be a penalty
      expect(penaltyCriteria.length).toBe(1);
      expect(penaltyCriteria[0].type).toBe('RECENT_NO_SHOW');
    });

    it('should have correct default enabled criteria', () => {
      const defaultEnabled = getDefaultEnabledCriteria();

      // Check that we have some enabled by default
      expect(defaultEnabled.length).toBeGreaterThan(0);

      // Verify expected criteria are enabled
      const enabledTypes = defaultEnabled.map((c) => c.type);
      expect(enabledTypes).toContain('ATTENDANCE_RATE');
      expect(enabledTypes).toContain('MONTHS_SINCE_LAST');
      expect(enabledTypes).toContain('RECENT_NO_SHOW');
      expect(enabledTypes).toContain('IS_REP_INSTITUTION');
      expect(enabledTypes).toContain('FIRST_TIME_APPLICANT');
    });
  });

  describe('Score Range Validation', () => {
    it('should always return scores between 0 and 100 for all criteria', () => {
      const allCriteria = Object.keys(CRITERIA_DEFINITIONS) as ScoringCriterionType[];

      allCriteria.forEach((criterionType) => {
        const criteria: CriterionConfig[] = [{ type: criterionType, enabled: true, weight: 100 }];

        const engine = new ScoringEngine(criteria);

        // Test with various data scenarios
        const testCases = [
          createMockData(), // Normal case
          createMockData({}, { totalRegistrations: 0 }), // First time
          createMockData({}, { recentNoShow: true }), // Recent no-show
          createMockData({ booked_seats: 10 }), // Small group
          createMockData({ booked_seats: 100 }), // Large group
          createMockData({ caretaker_count: null }), // No caretaker
        ];

        testCases.forEach((data) => {
          const result = engine.calculateScore(data);

          expect(result.normalizedScore).toBeGreaterThanOrEqual(0);
          expect(result.normalizedScore).toBeLessThanOrEqual(100);
          expect(Number.isFinite(result.normalizedScore)).toBe(true);
        });
      });
    });

    it('should handle edge case: zero total weight', () => {
      const engine = new ScoringEngine([]);
      const data = createMockData();

      const result = engine.calculateScore(data);

      expect(result.normalizedScore).toBe(0);
      expect(result.totalScore).toBe(0);
      expect(result.maxScore).toBe(0);
    });

    it('should handle edge case: all criteria disabled', () => {
      const criteria: CriterionConfig[] = [
        { type: 'ATTENDANCE_RATE', enabled: false, weight: 50 },
        { type: 'IS_REP_INSTITUTION', enabled: false, weight: 50 },
      ];

      const engine = new ScoringEngine(criteria);
      const data = createMockData();

      const result = engine.calculateScore(data);

      expect(result.normalizedScore).toBe(0);
    });
  });

  describe('Penalty Criteria Validation', () => {
    it('should apply negative scores for RECENT_NO_SHOW when triggered', () => {
      const criteria: CriterionConfig[] = [{ type: 'RECENT_NO_SHOW', enabled: true, weight: 15 }];

      const engine = new ScoringEngine(criteria);
      const data = createMockData({}, { recentNoShow: true });

      const result = engine.calculateScore(data);

      // Recent no-show should result in negative weighted score
      expect(result.breakdown[0].rawScore).toBe(-100); // Inverted due to isPenalty
      expect(result.breakdown[0].weightedScore).toBe(-15); // -100 * 15 / 100
      expect(result.normalizedScore).toBe(0); // Clamped to 0
    });

    it('should not penalize when RECENT_NO_SHOW is false', () => {
      const criteria: CriterionConfig[] = [{ type: 'RECENT_NO_SHOW', enabled: true, weight: 15 }];

      const engine = new ScoringEngine(criteria);
      const data = createMockData({}, { recentNoShow: false });

      const result = engine.calculateScore(data);

      // Check that raw score is 0 or -0 (both are valid in this case)
      expect(Math.abs(result.breakdown[0].rawScore)).toBe(0); // No penalty
      expect(Math.abs(result.breakdown[0].weightedScore)).toBe(0);
    });

    it('should combine penalty with positive criteria correctly', () => {
      const criteria: CriterionConfig[] = [
        { type: 'IS_REP_INSTITUTION', enabled: true, weight: 50 }, // Gives 100 raw score
        { type: 'RECENT_NO_SHOW', enabled: true, weight: 50 }, // Gives -100 raw score when triggered
      ];

      const engine = new ScoringEngine(criteria);
      const data = createMockData(
        { institution: { id: '1', name: 'REP School', type: [], is_rep: true } },
        { recentNoShow: true },
      );

      const result = engine.calculateScore(data);

      // IS_REP gives 50, RECENT_NO_SHOW gives -50, total = 0
      expect(result.totalScore).toBe(0);
      expect(result.normalizedScore).toBe(0);
    });
  });

  describe('Parameter Usage Validation', () => {
    it('should use custom parameters for ATTENDANCE_RATE', () => {
      const criteria: CriterionConfig[] = [
        {
          type: 'ATTENDANCE_RATE',
          enabled: true,
          weight: 100,
          parameters: {
            bonusThreshold: 90, // Custom threshold
            penaltyThreshold: 40,
            applyBonus: true,
            applyPenalty: true,
          },
        },
      ];

      const engine = new ScoringEngine(criteria);

      // 85% attendance - between 40 and 90
      const data = createMockData({}, { confirmedCount: 20, attendedCount: 17 });
      const result = engine.calculateScore(data);

      // Should interpolate: (85 - 40) / (90 - 40) * 100 = 90
      expect(result.breakdown[0].rawScore).toBe(90);
    });

    it('should use custom parameters for MONTHS_SINCE_LAST', () => {
      const criteria: CriterionConfig[] = [
        {
          type: 'MONTHS_SINCE_LAST',
          enabled: true,
          weight: 100,
          parameters: {
            neverParticipatedScore: 50, // Custom score
          },
        },
      ];

      const engine = new ScoringEngine(criteria);
      const data = createMockData({}, { monthsSinceLastAttendance: null });

      const result = engine.calculateScore(data);

      // Should use custom score instead of default 100
      expect(result.breakdown[0].rawScore).toBe(50);
    });

    it('should use custom parameters for GEOGRAPHIC_ZONE', () => {
      const criteria: CriterionConfig[] = [
        {
          type: 'GEOGRAPHIC_ZONE',
          enabled: true,
          weight: 100,
          parameters: {
            montpellierScore: 90,
            metropoleScore: 60,
            heraultScore: 30,
            outsideScore: 10,
          },
        },
      ];

      const engine = new ScoringEngine(criteria);
      const data = createMockData({
        institution: {
          id: '1',
          name: 'Test',
          type: [],
          is_rep: false,
          address: { city: 'Montpellier', zip_code: '34000' },
        },
      });

      const result = engine.calculateScore(data);

      // Should use custom Montpellier score
      expect(result.breakdown[0].rawScore).toBe(90);
    });
  });

  describe('Configuration Validation', () => {
    it('should correctly calculate total weight', () => {
      const criteria: CriterionConfig[] = [
        { type: 'ATTENDANCE_RATE', enabled: true, weight: 40 },
        { type: 'IS_REP_INSTITUTION', enabled: true, weight: 30 },
        { type: 'RECENT_NO_SHOW', enabled: true, weight: 30 },
      ];

      const engine = new ScoringEngine(criteria);

      expect(engine.getTotalWeight()).toBe(100);
      expect(engine.isConfigValid()).toBe(true);
    });

    it('should handle negative weights in total weight calculation', () => {
      const criteria: CriterionConfig[] = [
        { type: 'ATTENDANCE_RATE', enabled: true, weight: 50 },
        { type: 'RECENT_NO_SHOW', enabled: true, weight: 50 }, // Penalty criterion
      ];

      const engine = new ScoringEngine(criteria);

      // Total weight should be absolute value sum
      expect(engine.getTotalWeight()).toBe(100);
    });

    it('should validate configuration correctly', () => {
      const validConfig: CriterionConfig[] = [
        { type: 'ATTENDANCE_RATE', enabled: true, weight: 50 },
        { type: 'IS_REP_INSTITUTION', enabled: true, weight: 50 },
      ];

      const invalidConfig: CriterionConfig[] = [
        { type: 'ATTENDANCE_RATE', enabled: true, weight: 40 },
        { type: 'IS_REP_INSTITUTION', enabled: true, weight: 50 },
      ];

      const validEngine = new ScoringEngine(validConfig);
      const invalidEngine = new ScoringEngine(invalidConfig);

      expect(validEngine.isConfigValid()).toBe(true);
      expect(invalidEngine.isConfigValid()).toBe(false);
    });

    it('should provide accurate config summary', () => {
      const criteria: CriterionConfig[] = [
        { type: 'ATTENDANCE_RATE', enabled: true, weight: 40 },
        { type: 'IS_REP_INSTITUTION', enabled: false, weight: 30 },
        { type: 'RECENT_NO_SHOW', enabled: true, weight: 30 },
        { type: 'FIRST_TIME_APPLICANT', enabled: true, weight: 30 },
      ];

      const engine = new ScoringEngine(criteria);
      const summary = engine.getConfigSummary();

      expect(summary.totalCriteria).toBe(3); // Only enabled
      expect(summary.enabledCriteria).toBe(3);
      expect(summary.totalWeight).toBe(100);
      expect(summary.isValid).toBe(true);
    });
  });

  describe('Helper Functions Validation', () => {
    it('should retrieve criterion definition by type', () => {
      const definition = getCriterionDefinition('ATTENDANCE_RATE');

      expect(definition).toBeDefined();
      expect(definition?.type).toBe('ATTENDANCE_RATE');
      expect(definition?.name).toBe('Taux de présence historique');
    });

    it('should retrieve criteria by category', () => {
      const historiqueCriteria = getCriteriaByCategory('historique');

      expect(historiqueCriteria.length).toBeGreaterThan(0);
      historiqueCriteria.forEach((criterion) => {
        expect(criterion.category).toBe('historique');
      });

      // Check expected criteria are in historique category
      const types = historiqueCriteria.map((c) => c.type);
      expect(types).toContain('ATTENDANCE_RATE');
      expect(types).toContain('RECENT_NO_SHOW');
    });

    it('should retrieve all categories correctly', () => {
      const categories: Array<'historique' | 'diversite' | 'priorite' | 'contexte'> = [
        'historique',
        'diversite',
        'priorite',
        'contexte',
      ];

      categories.forEach((category) => {
        const criteria = getCriteriaByCategory(category);
        expect(criteria.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Real-World Scenario Validation', () => {
    it('should score a perfect institution correctly', () => {
      const criteria: CriterionConfig[] = [
        { type: 'ATTENDANCE_RATE', enabled: true, weight: 40 },
        { type: 'IS_REP_INSTITUTION', enabled: true, weight: 30 },
        { type: 'ACCESSIBILITY_NEEDS', enabled: true, weight: 15 },
        { type: 'RECENT_NO_SHOW', enabled: true, weight: 15 },
      ];

      const engine = new ScoringEngine(criteria);
      const data = createMockData(
        {
          institution: { id: '1', name: 'REP School', type: [], is_rep: true },
          disabilities: [{ type: 'VISUAL', count: 2 }],
        },
        {
          confirmedCount: 10,
          attendedCount: 10, // 100% attendance
          recentNoShow: false,
        },
      );

      const result = engine.calculateScore(data);

      // Perfect score: 40 + 30 + 15 + 0 = 85, normalized to 85
      expect(result.normalizedScore).toBe(85);
    });

    it('should score a problematic institution correctly', () => {
      const criteria: CriterionConfig[] = [
        { type: 'ATTENDANCE_RATE', enabled: true, weight: 50 },
        { type: 'RECENT_NO_SHOW', enabled: true, weight: 50 },
      ];

      const engine = new ScoringEngine(criteria);
      const data = createMockData(
        {},
        {
          confirmedCount: 10,
          attendedCount: 3, // 30% attendance (below penalty threshold)
          recentNoShow: true,
        },
      );

      const result = engine.calculateScore(data);

      // Low attendance gives 0, recent no-show gives -50, total = -50, normalized to 0
      expect(result.normalizedScore).toBe(0);
    });

    it('should score a new institution fairly', () => {
      const criteria: CriterionConfig[] = [
        { type: 'FIRST_TIME_APPLICANT', enabled: true, weight: 50 },
        { type: 'ACCESSIBILITY_NEEDS', enabled: true, weight: 50 },
      ];

      const engine = new ScoringEngine(criteria);
      const data = createMockData(
        {
          disabilities: [{ type: 'AUDITORY', count: 1 }],
        },
        {
          totalRegistrations: 0, // First time
        },
      );

      const result = engine.calculateScore(data);

      // First time: 50, accessibility: 50 = 100
      expect(result.normalizedScore).toBe(100);
    });
  });
});
