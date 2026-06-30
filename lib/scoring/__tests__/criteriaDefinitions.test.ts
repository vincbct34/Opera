import { describe, it, expect } from '@jest/globals';
import {
  CRITERIA_DEFINITIONS,
  CRITERION_CATEGORIES,
  getCriterionDefinition,
  getCriteriaByCategory,
  getDefaultEnabledCriteria,
  type ScoringCriterionType,
} from '../criteriaDefinitions';

describe('criteriaDefinitions', () => {
  describe('CRITERIA_DEFINITIONS', () => {
    it('should contain all 14 criterion types', () => {
      const expectedTypes: ScoringCriterionType[] = [
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

      const actualTypes = Object.keys(CRITERIA_DEFINITIONS);
      expect(actualTypes).toHaveLength(14);
      expectedTypes.forEach((type) => {
        expect(actualTypes).toContain(type);
      });
    });

    it('should have valid structure for ATTENDANCE_RATE', () => {
      const attendanceRate = CRITERIA_DEFINITIONS.ATTENDANCE_RATE;
      expect(attendanceRate.type).toBe('ATTENDANCE_RATE');
      expect(attendanceRate.name).toBe('Taux de présence historique');
      expect(attendanceRate.category).toBe('historique');
      expect(attendanceRate.defaultWeight).toBe(40);
      expect(attendanceRate.defaultEnabled).toBe(true);
      expect(attendanceRate.defaultParameters).toHaveProperty('bonusThreshold', 80);
      expect(attendanceRate.defaultParameters).toHaveProperty('penaltyThreshold', 50);
      expect(attendanceRate.parameterDefinitions).toHaveLength(4);
    });

    it('should have valid structure for MONTHS_SINCE_LAST', () => {
      const monthsSinceLast = CRITERIA_DEFINITIONS.MONTHS_SINCE_LAST;
      expect(monthsSinceLast.type).toBe('MONTHS_SINCE_LAST');
      expect(monthsSinceLast.category).toBe('diversite');
      expect(monthsSinceLast.defaultWeight).toBe(30);
      expect(monthsSinceLast.defaultEnabled).toBe(true);
      expect(monthsSinceLast.parameterDefinitions).toHaveLength(4);
    });

    it('should have valid structure for RECENT_NO_SHOW', () => {
      const recentNoShow = CRITERIA_DEFINITIONS.RECENT_NO_SHOW;
      expect(recentNoShow.type).toBe('RECENT_NO_SHOW');
      expect(recentNoShow.category).toBe('historique');
      expect(recentNoShow.defaultWeight).toBe(15); // Now positive, isPenalty flag handles the logic
      expect(recentNoShow.isPenalty).toBe(true); // Marked as penalty criterion
      expect(recentNoShow.defaultEnabled).toBe(true);
    });

    it('should have valid structure for IS_REP_INSTITUTION', () => {
      const isRep = CRITERIA_DEFINITIONS.IS_REP_INSTITUTION;
      expect(isRep.type).toBe('IS_REP_INSTITUTION');
      expect(isRep.category).toBe('priorite');
      expect(isRep.defaultWeight).toBe(15);
      expect(isRep.parameterDefinitions).toHaveLength(0);
    });

    it('should have proper parameter definitions with min/max constraints', () => {
      const earlyRegistration = CRITERIA_DEFINITIONS.EARLY_REGISTRATION;
      const thresholdParam = earlyRegistration.parameterDefinitions.find(
        (p) => p.key === 'earlyThresholdDays',
      );

      expect(thresholdParam).toBeDefined();
      expect(thresholdParam?.type).toBe('number');
      expect(thresholdParam?.min).toBe(1);
      expect(thresholdParam?.max).toBe(365);
      expect(thresholdParam?.defaultValue).toBe(30);
    });

    it('should have select options for INSTITUTION_TYPE', () => {
      const institutionType = CRITERIA_DEFINITIONS.INSTITUTION_TYPE;
      const favoredTypesParam = institutionType.parameterDefinitions.find(
        (p) => p.key === 'favoredTypes',
      );

      expect(favoredTypesParam).toBeDefined();
      expect(favoredTypesParam?.type).toBe('multiselect');
      expect(favoredTypesParam?.options).toBeDefined();
      expect(favoredTypesParam?.options?.length).toBeGreaterThan(0);
    });

    it('should have select options for REQUESTED_SEATS_COUNT', () => {
      const seatsCount = CRITERIA_DEFINITIONS.REQUESTED_SEATS_COUNT;
      const preferenceParam = seatsCount.parameterDefinitions.find((p) => p.key === 'preference');

      expect(preferenceParam).toBeDefined();
      expect(preferenceParam?.type).toBe('select');
      expect(preferenceParam?.options).toBeDefined();
      expect(preferenceParam?.options).toEqual([
        { value: 'small', label: 'Favoriser les petits groupes' },
        { value: 'large', label: 'Favoriser les grands groupes' },
        { value: 'neutral', label: 'Neutre (score 50 pour tous)' },
      ]);
    });

    it('should have boolean parameters for CARETAKER_RATIO', () => {
      const caretaker = CRITERIA_DEFINITIONS.CARETAKER_RATIO;
      const preferHighParam = caretaker.parameterDefinitions.find((p) => p.key === 'preferHigh');

      expect(preferHighParam).toBeDefined();
      expect(preferHighParam?.type).toBe('boolean');
      expect(preferHighParam?.defaultValue).toBe(true);
    });

    it('should have valid structure for AESH_COUNT', () => {
      const aeshCount = CRITERIA_DEFINITIONS.AESH_COUNT;
      expect(aeshCount.type).toBe('AESH_COUNT');
      expect(aeshCount.name).toBe('Accompagnants AESH déclarés');
      expect(aeshCount.category).toBe('priorite');
      expect(aeshCount.defaultWeight).toBe(0);
      expect(aeshCount.defaultEnabled).toBe(false);
      expect(aeshCount.isPenalty).toBe(false);
      expect(aeshCount.defaultParameters).toHaveProperty('minCount', 1);
      expect(aeshCount.defaultParameters).toHaveProperty('highCount', 3);
      expect(aeshCount.parameterDefinitions).toHaveLength(2);
    });
  });

  describe('CRITERION_CATEGORIES', () => {
    it('should contain all 4 categories', () => {
      const categories = Object.keys(CRITERION_CATEGORIES);
      expect(categories).toHaveLength(4);
      expect(categories).toContain('historique');
      expect(categories).toContain('diversite');
      expect(categories).toContain('priorite');
      expect(categories).toContain('contexte');
    });

    it('should have valid structure for each category', () => {
      Object.values(CRITERION_CATEGORIES).forEach((category) => {
        expect(category).toHaveProperty('label');
        expect(category).toHaveProperty('description');
        expect(category).toHaveProperty('color');
        expect(typeof category.label).toBe('string');
        expect(typeof category.description).toBe('string');
        expect(typeof category.color).toBe('string');
      });
    });
  });

  describe('getCriterionDefinition', () => {
    it('should return the correct definition for a valid type', () => {
      const definition = getCriterionDefinition('ATTENDANCE_RATE');
      expect(definition).toBeDefined();
      expect(definition?.type).toBe('ATTENDANCE_RATE');
      expect(definition?.name).toBe('Taux de présence historique');
    });

    it('should return undefined for an invalid type', () => {
      const definition = getCriterionDefinition('INVALID_TYPE' as ScoringCriterionType);
      expect(definition).toBeUndefined();
    });

    it('should return the correct definition for all types', () => {
      const types: ScoringCriterionType[] = [
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
      ];

      types.forEach((type) => {
        const definition = getCriterionDefinition(type);
        expect(definition).toBeDefined();
        expect(definition?.type).toBe(type);
      });
    });
  });

  describe('getCriteriaByCategory', () => {
    it('should return all historique criteria', () => {
      const historique = getCriteriaByCategory('historique');
      expect(historique.length).toBeGreaterThan(0);
      historique.forEach((criterion) => {
        expect(criterion.category).toBe('historique');
      });

      const types = historique.map((c) => c.type);
      expect(types).toContain('ATTENDANCE_RATE');
      expect(types).toContain('RECENT_NO_SHOW');
    });

    it('should return all diversite criteria', () => {
      const diversite = getCriteriaByCategory('diversite');
      expect(diversite.length).toBeGreaterThan(0);
      diversite.forEach((criterion) => {
        expect(criterion.category).toBe('diversite');
      });

      const types = diversite.map((c) => c.type);
      expect(types).toContain('MONTHS_SINCE_LAST');
      expect(types).toContain('TOTAL_PARTICIPATIONS');
      expect(types).toContain('FIRST_TIME_APPLICANT');
    });

    it('should return all priorite criteria', () => {
      const priorite = getCriteriaByCategory('priorite');
      expect(priorite.length).toBeGreaterThan(0);
      priorite.forEach((criterion) => {
        expect(criterion.category).toBe('priorite');
      });

      const types = priorite.map((c) => c.type);
      expect(types).toContain('IS_REP_INSTITUTION');
      expect(types).toContain('ACCESSIBILITY_NEEDS');
    });

    it('should return all contexte criteria', () => {
      const contexte = getCriteriaByCategory('contexte');
      expect(contexte.length).toBeGreaterThan(0);
      contexte.forEach((criterion) => {
        expect(criterion.category).toBe('contexte');
      });

      const types = contexte.map((c) => c.type);
      expect(types).toContain('EARLY_REGISTRATION');
      expect(types).toContain('REQUESTED_SEATS_COUNT');
      expect(types).toContain('CARETAKER_RATIO');
    });

    it('should return empty array for invalid category', () => {
      const invalid = getCriteriaByCategory('invalid' as keyof typeof CRITERION_CATEGORIES);
      expect(invalid).toEqual([]);
    });
  });

  describe('getDefaultEnabledCriteria', () => {
    it('should return only default enabled criteria', () => {
      const defaultEnabled = getDefaultEnabledCriteria();
      expect(defaultEnabled.length).toBeGreaterThan(0);

      defaultEnabled.forEach((criterion) => {
        expect(criterion.defaultEnabled).toBe(true);
      });
    });

    it('should include ATTENDANCE_RATE in default enabled', () => {
      const defaultEnabled = getDefaultEnabledCriteria();
      const types = defaultEnabled.map((c) => c.type);
      expect(types).toContain('ATTENDANCE_RATE');
    });

    it('should NOT include TOTAL_PARTICIPATIONS in default enabled', () => {
      const defaultEnabled = getDefaultEnabledCriteria();
      const types = defaultEnabled.map((c) => c.type);
      expect(types).not.toContain('TOTAL_PARTICIPATIONS');
    });

    it('should NOT include EARLY_REGISTRATION in default enabled', () => {
      const defaultEnabled = getDefaultEnabledCriteria();
      const types = defaultEnabled.map((c) => c.type);
      expect(types).not.toContain('EARLY_REGISTRATION');
    });

    it('should have consistent defaultEnabled flags', () => {
      const allCriteria = Object.values(CRITERIA_DEFINITIONS);
      const defaultEnabled = getDefaultEnabledCriteria();

      // Tous les critères dans defaultEnabled doivent avoir defaultEnabled=true
      defaultEnabled.forEach((criterion) => {
        const original = allCriteria.find((c) => c.type === criterion.type);
        expect(original?.defaultEnabled).toBe(true);
      });

      // Tous les critères avec defaultEnabled=true doivent être dans la liste
      const enabledTypes = allCriteria.filter((c) => c.defaultEnabled).map((c) => c.type);
      const resultTypes = defaultEnabled.map((c) => c.type);
      expect(resultTypes.sort()).toEqual(enabledTypes.sort());
    });
  });

  describe('Data integrity', () => {
    it('should have unique types across all criteria', () => {
      const types = Object.values(CRITERIA_DEFINITIONS).map((c) => c.type);
      const uniqueTypes = [...new Set(types)];
      expect(types.length).toBe(uniqueTypes.length);
    });

    it('should have non-empty names and descriptions', () => {
      Object.values(CRITERIA_DEFINITIONS).forEach((criterion) => {
        expect(criterion.name).toBeTruthy();
        expect(criterion.name.length).toBeGreaterThan(0);
        expect(criterion.description).toBeTruthy();
        expect(criterion.description.length).toBeGreaterThan(0);
      });
    });

    it('should have valid weight ranges', () => {
      Object.values(CRITERIA_DEFINITIONS).forEach((criterion) => {
        expect(criterion.defaultWeight).toBeDefined();
        expect(typeof criterion.defaultWeight).toBe('number');
        // Poids peut être négatif (RECENT_NO_SHOW = -15)
        expect(criterion.defaultWeight).toBeGreaterThanOrEqual(-100);
        expect(criterion.defaultWeight).toBeLessThanOrEqual(100);
      });
    });

    it('should have matching parameter keys in definitions and defaults', () => {
      Object.values(CRITERIA_DEFINITIONS).forEach((criterion) => {
        const paramKeys = criterion.parameterDefinitions.map((p) => p.key);
        const defaultKeys = Object.keys(criterion.defaultParameters);

        // Chaque clé dans defaultParameters doit avoir une définition
        defaultKeys.forEach((key) => {
          expect(paramKeys).toContain(key);
        });

        // Chaque définition doit avoir une valeur par défaut
        paramKeys.forEach((key) => {
          expect(criterion.defaultParameters).toHaveProperty(key);
        });
      });
    });

    it('should have valid parameter default values matching their type', () => {
      Object.values(CRITERIA_DEFINITIONS).forEach((criterion) => {
        criterion.parameterDefinitions.forEach((param) => {
          const defaultValue = param.defaultValue;

          switch (param.type) {
            case 'number':
              expect(typeof defaultValue).toBe('number');
              if (param.min !== undefined) {
                expect(defaultValue as number).toBeGreaterThanOrEqual(param.min);
              }
              if (param.max !== undefined) {
                expect(defaultValue as number).toBeLessThanOrEqual(param.max);
              }
              break;
            case 'boolean':
              expect(typeof defaultValue).toBe('boolean');
              break;
            case 'select':
              expect(param.options).toBeDefined();
              const selectValues = param.options?.map((o) => o.value) || [];
              expect(selectValues).toContain(defaultValue);
              break;
            case 'multiselect':
              expect(Array.isArray(defaultValue)).toBe(true);
              break;
          }
        });
      });
    });
  });
});
