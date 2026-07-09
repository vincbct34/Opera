/**
 * Tests for lib/configService.ts
 * Configuration service with database storage, caching, and fallback to defaults
 */

import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFindMany = jest.fn<any>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUpsert = jest.fn<any>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDeleteMany = jest.fn<any>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockTransaction = jest.fn<any>();

jest.mock('@/lib/middleware/prismaConfig', () => ({
  __esModule: true,
  default: {
    appConfig: {
      findMany: mockFindMany,
      upsert: mockUpsert,
      deleteMany: mockDeleteMany,
    },
    $transaction: mockTransaction,
  },
}));

// Mock logger
jest.mock('@/lib/middleware/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock Redis client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockRedisGet = jest.fn() as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockRedisSet = jest.fn() as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockRedisDel = jest.fn() as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockRedisKeys = jest.fn() as any;

const mockRedis = {
  get: mockRedisGet,
  set: mockRedisSet,
  del: mockRedisDel,
  keys: mockRedisKeys,
};

jest.mock('@/lib/middleware/redisConfig', () => ({
  getRedisClient: jest.fn(() => mockRedis),
  isRedisConnected: jest.fn(() => true),
}));

import {
  clearConfigCache,
  getConfig,
  getConfigValue,
  setConfigValue,
  setConfigValues,
  resetConfigToDefaults,
  getConfigSync,
  getConfigValueSync,
  preloadAllConfigs,
  DEFAULT_ACCESSIBILITY_LABELS,
  DEFAULT_EVENT_TYPE_LABELS,
  DEFAULT_PUBLIC_CATEGORY_LABELS,
  DEFAULT_REGISTRATION_STATUS_LABELS,
  DEFAULT_EVENT_STATUS_LABELS,
  DEFAULT_SCHOOL_GRADE_LABELS,
  DEFAULT_AGE_RANGE_LABELS,
  HERO_IMAGE_KEY,
  type ConfigCategory,
} from '../config/configService';

import { logger } from '@/lib/middleware/logger';

describe('configService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearConfigCache(); // Clear cache before each test
  });

  afterEach(() => {
    clearConfigCache();
  });

  // ==========================================================================
  // Default Exports
  // ==========================================================================

  describe('default exports', () => {
    it('should re-export DEFAULT_ACCESSIBILITY_LABELS', () => {
      expect(DEFAULT_ACCESSIBILITY_LABELS).toBeDefined();
      expect(typeof DEFAULT_ACCESSIBILITY_LABELS).toBe('object');
    });

    it('should re-export DEFAULT_EVENT_TYPE_LABELS', () => {
      expect(DEFAULT_EVENT_TYPE_LABELS).toBeDefined();
      expect(typeof DEFAULT_EVENT_TYPE_LABELS).toBe('object');
    });

    it('should re-export DEFAULT_PUBLIC_CATEGORY_LABELS', () => {
      expect(DEFAULT_PUBLIC_CATEGORY_LABELS).toBeDefined();
      expect(typeof DEFAULT_PUBLIC_CATEGORY_LABELS).toBe('object');
    });

    it('should re-export DEFAULT_REGISTRATION_STATUS_LABELS', () => {
      expect(DEFAULT_REGISTRATION_STATUS_LABELS).toBeDefined();
      expect(typeof DEFAULT_REGISTRATION_STATUS_LABELS).toBe('object');
    });

    it('should re-export DEFAULT_EVENT_STATUS_LABELS', () => {
      expect(DEFAULT_EVENT_STATUS_LABELS).toBeDefined();
      expect(typeof DEFAULT_EVENT_STATUS_LABELS).toBe('object');
    });
  });

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  describe('clearConfigCache', () => {
    it('should clear cache for specific category', async () => {
      mockFindMany.mockResolvedValueOnce([]);
      await getConfig('accessibility_labels');

      clearConfigCache('accessibility_labels');

      // Cache should be cleared, so next call should hit database again
      mockFindMany.mockResolvedValueOnce([]);
      await getConfig('accessibility_labels');

      expect(mockFindMany).toHaveBeenCalledTimes(2);
    });

    it('should clear all cache when no category specified', async () => {
      mockFindMany.mockResolvedValue([]);

      await getConfig('accessibility_labels');
      await getConfig('event_type_labels');

      clearConfigCache();

      await getConfig('accessibility_labels');
      await getConfig('event_type_labels');

      // Should have called findMany 4 times (2 before clear, 2 after)
      expect(mockFindMany).toHaveBeenCalledTimes(4);
    });
  });

  // ==========================================================================
  // getConfig
  // ==========================================================================

  describe('getConfig', () => {
    it('should return default values when database returns empty', async () => {
      mockFindMany.mockResolvedValueOnce([]);

      const result = await getConfig('accessibility_labels');

      expect(result).toEqual(DEFAULT_ACCESSIBILITY_LABELS);
    });

    it('should return database values merged with defaults', async () => {
      mockFindMany.mockResolvedValueOnce([
        { category: 'accessibility_labels', key: 'NONE', value: 'Aucun handicap (custom)' },
      ]);

      const result = await getConfig('accessibility_labels');

      expect(result.NONE).toBe('Aucun handicap (custom)');
      // Other values should still be defaults
      expect(result.MOTOR).toBe(DEFAULT_ACCESSIBILITY_LABELS.MOTOR);
    });

    it('should use cache on subsequent calls', async () => {
      mockFindMany.mockResolvedValueOnce([]);

      await getConfig('accessibility_labels');
      await getConfig('accessibility_labels');

      // Should only call database once
      expect(mockFindMany).toHaveBeenCalledTimes(1);
    });

    it('should return defaults for event_type_labels category', async () => {
      mockFindMany.mockResolvedValueOnce([]);

      const result = await getConfig('event_type_labels');

      expect(result).toEqual(DEFAULT_EVENT_TYPE_LABELS);
    });

    it('should return defaults for public_category_labels category', async () => {
      mockFindMany.mockResolvedValueOnce([]);

      const result = await getConfig('public_category_labels');

      expect(result).toEqual(DEFAULT_PUBLIC_CATEGORY_LABELS);
    });

    it('should return defaults for registration_status_labels category', async () => {
      mockFindMany.mockResolvedValueOnce([]);

      const result = await getConfig('registration_status_labels');

      expect(result).toEqual(DEFAULT_REGISTRATION_STATUS_LABELS);
    });

    it('should return defaults for event_status_labels category', async () => {
      mockFindMany.mockResolvedValueOnce([]);

      const result = await getConfig('event_status_labels');

      expect(result).toEqual(DEFAULT_EVENT_STATUS_LABELS);
    });

    it('should return defaults for school_grade_labels category', async () => {
      mockFindMany.mockResolvedValueOnce([]);

      const result = await getConfig('school_grade_labels');

      expect(result).toEqual(DEFAULT_SCHOOL_GRADE_LABELS);
    });

    it('should return defaults for age_range_labels category', async () => {
      mockFindMany.mockResolvedValueOnce([]);

      const result = await getConfig('age_range_labels');

      expect(result).toEqual(DEFAULT_AGE_RANGE_LABELS);
    });

    it('should return empty object for unknown category', async () => {
      mockFindMany.mockResolvedValueOnce([]);

      const result = await getConfig('unknown_category' as ConfigCategory);

      expect(result).toEqual({});
    });

    it('should handle database errors gracefully', async () => {
      mockFindMany.mockRejectedValueOnce(new Error('Database error'));

      const result = await getConfig('accessibility_labels');

      expect(result).toEqual(DEFAULT_ACCESSIBILITY_LABELS);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // getConfigValue
  // ==========================================================================

  describe('getConfigValue', () => {
    it('should return specific config value', async () => {
      mockFindMany.mockResolvedValueOnce([]);

      const result = await getConfigValue('accessibility_labels', 'NONE');

      expect(result).toBe(DEFAULT_ACCESSIBILITY_LABELS.NONE);
    });

    it('should return undefined for non-existent key', async () => {
      mockFindMany.mockResolvedValueOnce([]);

      const result = await getConfigValue('accessibility_labels', 'NON_EXISTENT');

      expect(result).toBeUndefined();
    });

    it('should return database value if exists', async () => {
      mockFindMany.mockResolvedValueOnce([
        { category: 'accessibility_labels', key: 'NONE', value: 'Custom Value' },
      ]);

      const result = await getConfigValue('accessibility_labels', 'NONE');

      expect(result).toBe('Custom Value');
    });
  });

  // ==========================================================================
  // setConfigValue
  // ==========================================================================

  describe('setConfigValue', () => {
    it('should upsert config value in database', async () => {
      mockUpsert.mockResolvedValueOnce({});

      await setConfigValue('accessibility_labels', 'NONE', 'New Value');

      expect(mockUpsert).toHaveBeenCalledWith({
        where: {
          category_key: { category: 'accessibility_labels', key: 'NONE' },
        },
        update: { value: 'New Value' },
        create: { category: 'accessibility_labels', key: 'NONE', value: 'New Value' },
      });
    });

    it('should clear cache after setting value', async () => {
      mockFindMany.mockResolvedValue([]);
      mockUpsert.mockResolvedValue({});

      // Populate cache
      await getConfig('accessibility_labels');

      // Set value (should clear cache)
      await setConfigValue('accessibility_labels', 'NONE', 'New Value');

      // Next call should hit database again
      await getConfig('accessibility_labels');

      expect(mockFindMany).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // setConfigValues
  // ==========================================================================

  describe('setConfigValues', () => {
    it('should upsert multiple config values in a transaction', async () => {
      mockTransaction.mockResolvedValueOnce([]);

      await setConfigValues('accessibility_labels', {
        NONE: 'Value 1',
        MOTOR: 'Value 2',
      });

      expect(mockTransaction).toHaveBeenCalledTimes(1);
      const transactionArg = mockTransaction.mock.calls[0][0];
      expect(transactionArg).toHaveLength(2);
    });

    it('should clear cache after setting values', async () => {
      mockFindMany.mockResolvedValue([]);
      mockTransaction.mockResolvedValue([]);

      // Populate cache
      await getConfig('accessibility_labels');

      // Set values (should clear cache)
      await setConfigValues('accessibility_labels', { NONE: 'New' });

      // Next call should hit database again
      await getConfig('accessibility_labels');

      expect(mockFindMany).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // resetConfigToDefaults
  // ==========================================================================

  describe('resetConfigToDefaults', () => {
    it('should delete all config entries for category', async () => {
      mockDeleteMany.mockResolvedValueOnce({ count: 5 });

      await resetConfigToDefaults('accessibility_labels');

      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: { category: 'accessibility_labels' },
      });
    });

    it('should clear cache after reset', async () => {
      mockFindMany.mockResolvedValue([]);
      mockDeleteMany.mockResolvedValue({ count: 0 });

      // Populate cache
      await getConfig('accessibility_labels');

      // Reset (should clear cache)
      await resetConfigToDefaults('accessibility_labels');

      // Next call should hit database again
      await getConfig('accessibility_labels');

      expect(mockFindMany).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // Synchronous Getters
  // ==========================================================================

  describe('getConfigSync', () => {
    it('should return cached value if available', async () => {
      mockFindMany.mockResolvedValueOnce([
        { category: 'accessibility_labels', key: 'NONE', value: 'Cached Value' },
      ]);

      // Populate cache
      await getConfig('accessibility_labels');

      // Sync call should use cache
      const result = getConfigSync('accessibility_labels');

      expect(result.NONE).toBe('Cached Value');
    });

    it('should return defaults if cache is empty', () => {
      const result = getConfigSync('accessibility_labels');

      expect(result).toEqual(DEFAULT_ACCESSIBILITY_LABELS);
    });

    it('should return defaults for event_type_labels when cache empty', () => {
      const result = getConfigSync('event_type_labels');

      expect(result).toEqual(DEFAULT_EVENT_TYPE_LABELS);
    });

    it('should return defaults for public_category_labels when cache empty', () => {
      const result = getConfigSync('public_category_labels');

      expect(result).toEqual(DEFAULT_PUBLIC_CATEGORY_LABELS);
    });

    it('should return defaults for registration_status_labels when cache empty', () => {
      const result = getConfigSync('registration_status_labels');

      expect(result).toEqual(DEFAULT_REGISTRATION_STATUS_LABELS);
    });

    it('should return defaults for event_status_labels when cache empty', () => {
      const result = getConfigSync('event_status_labels');

      expect(result).toEqual(DEFAULT_EVENT_STATUS_LABELS);
    });

    it('should return defaults for school_grade_labels when cache empty', () => {
      const result = getConfigSync('school_grade_labels');

      expect(result).toEqual(DEFAULT_SCHOOL_GRADE_LABELS);
    });

    it('should return defaults for age_range_labels when cache empty', () => {
      const result = getConfigSync('age_range_labels');

      expect(result).toEqual(DEFAULT_AGE_RANGE_LABELS);
    });

    it('should return an empty hero image default for site_assets when cache empty', () => {
      const result = getConfigSync('site_assets');

      expect(result).toEqual({ [HERO_IMAGE_KEY]: '' });
    });
  });

  describe('getConfigValueSync', () => {
    it('should return specific value from cache', async () => {
      mockFindMany.mockResolvedValueOnce([
        { category: 'accessibility_labels', key: 'NONE', value: 'Sync Value' },
      ]);

      // Populate cache
      await getConfig('accessibility_labels');

      const result = getConfigValueSync('accessibility_labels', 'NONE');

      expect(result).toBe('Sync Value');
    });

    it('should return default value if cache empty', () => {
      const result = getConfigValueSync('accessibility_labels', 'NONE');

      expect(result).toBe(DEFAULT_ACCESSIBILITY_LABELS.NONE);
    });

    it('should return undefined for non-existent key', () => {
      const result = getConfigValueSync('accessibility_labels', 'NON_EXISTENT');

      expect(result).toBeUndefined();
    });
  });

  // ==========================================================================
  // preloadAllConfigs
  // ==========================================================================

  describe('preloadAllConfigs', () => {
    it('should load all config categories into cache', async () => {
      mockFindMany.mockResolvedValue([]);

      await preloadAllConfigs();

      // Should call findMany for all config categories
      expect(mockFindMany).toHaveBeenCalledTimes(7);
      expect(logger.info).toHaveBeenCalledWith('Configuration cache preloaded');
    });

    it('should populate cache for all categories', async () => {
      mockFindMany.mockResolvedValue([]);

      await preloadAllConfigs();

      // Clear mocks to check if cache is being used
      mockFindMany.mockClear();

      // These should use cache and not call database
      await getConfig('accessibility_labels');
      await getConfig('event_type_labels');
      await getConfig('public_category_labels');
      await getConfig('registration_status_labels');
      await getConfig('event_status_labels');
      await getConfig('school_grade_labels');
      await getConfig('age_range_labels');

      expect(mockFindMany).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Cache TTL
  // ==========================================================================

  describe('cache TTL', () => {
    it('should refresh cache after TTL expires', async () => {
      mockFindMany.mockResolvedValue([]);

      // First call
      await getConfig('accessibility_labels');

      // Mock Date.now to simulate time passage (5 minutes + 1ms)
      const originalDateNow = Date.now;
      const startTime = originalDateNow();
      Date.now = jest.fn(() => startTime + 5 * 60 * 1000 + 1);

      // Second call should refresh cache
      await getConfig('accessibility_labels');

      expect(mockFindMany).toHaveBeenCalledTimes(2);

      // Restore Date.now
      Date.now = originalDateNow;
    });

    it('should use cache if TTL not expired', async () => {
      mockFindMany.mockResolvedValue([]);

      // First call
      await getConfig('accessibility_labels');

      // Mock Date.now to simulate time passage (4 minutes - before TTL)
      const originalDateNow = Date.now;
      const startTime = originalDateNow();
      Date.now = jest.fn(() => startTime + 4 * 60 * 1000);

      // Second call should use cache
      await getConfig('accessibility_labels');

      expect(mockFindMany).toHaveBeenCalledTimes(1);

      // Restore Date.now
      Date.now = originalDateNow;
    });
  });

  // ==========================================================================
  // Redis Integration
  // ==========================================================================

  describe('Redis integration', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      clearConfigCache();
    });

    afterEach(() => {
      clearConfigCache();
    });

    describe('getConfig with Redis', () => {
      it('should use Redis cache when available', async () => {
        mockRedisGet.mockResolvedValueOnce(JSON.stringify(DEFAULT_ACCESSIBILITY_LABELS));

        const result = await getConfig('accessibility_labels');

        expect(mockRedisGet).toHaveBeenCalledWith('app_config:accessibility_labels');
        expect(result).toEqual(DEFAULT_ACCESSIBILITY_LABELS);
        // Should not call database
        expect(mockFindMany).not.toHaveBeenCalled();
      });

      it('should fall back to database when Redis returns null', async () => {
        mockRedisGet.mockResolvedValueOnce(null);
        mockFindMany.mockResolvedValueOnce([]);

        const result = await getConfig('accessibility_labels');

        expect(mockRedisGet).toHaveBeenCalled();
        expect(mockFindMany).toHaveBeenCalled();
        expect(result).toEqual(DEFAULT_ACCESSIBILITY_LABELS);
      });

      it('should store result in Redis after database fetch', async () => {
        mockRedisGet.mockResolvedValueOnce(null);
        mockFindMany.mockResolvedValueOnce([]);
        mockRedisSet.mockResolvedValueOnce('OK');

        await getConfig('accessibility_labels');

        expect(mockRedisSet).toHaveBeenCalledWith(
          'app_config:accessibility_labels',
          JSON.stringify(DEFAULT_ACCESSIBILITY_LABELS),
          'EX',
          300,
        );
      });

      it('should handle Redis get error gracefully', async () => {
        mockRedisGet.mockRejectedValueOnce(new Error('Redis connection error'));
        mockFindMany.mockResolvedValueOnce([]);

        const result = await getConfig('accessibility_labels');

        expect(logger.error).toHaveBeenCalledWith(
          'Redis cache read error for accessibility_labels:',
          expect.any(Error),
        );
        expect(result).toEqual(DEFAULT_ACCESSIBILITY_LABELS);
      });

      it('should handle Redis set error gracefully', async () => {
        mockRedisGet.mockResolvedValueOnce(null);
        mockFindMany.mockResolvedValueOnce([]);
        mockRedisSet.mockRejectedValueOnce(new Error('Redis set error'));

        const result = await getConfig('accessibility_labels');

        expect(logger.error).toHaveBeenCalledWith(
          'Redis cache set error for accessibility_labels:',
          expect.any(Error),
        );
        // Should still return the result
        expect(result).toEqual(DEFAULT_ACCESSIBILITY_LABELS);
      });
    });

    describe('clearConfigCache with Redis', () => {
      it('should delete specific category from Redis', async () => {
        mockRedisDel.mockResolvedValueOnce(1);

        await clearConfigCache('accessibility_labels');

        expect(mockRedisDel).toHaveBeenCalledWith('app_config:accessibility_labels');
        expect(logger.debug).toHaveBeenCalledWith('Redis cache cleared for accessibility_labels');
      });

      it('should delete all config keys from Redis when no category specified', async () => {
        mockRedisKeys.mockResolvedValueOnce([
          'app_config:accessibility_labels',
          'app_config:event_type_labels',
        ]);
        mockRedisDel.mockResolvedValueOnce(2);

        await clearConfigCache();

        expect(mockRedisKeys).toHaveBeenCalledWith('app_config:*');
        expect(mockRedisDel).toHaveBeenCalledWith(
          'app_config:accessibility_labels',
          'app_config:event_type_labels',
        );
      });

      it('should handle Redis del error gracefully', async () => {
        mockRedisDel.mockRejectedValueOnce(new Error('Redis del error'));

        await clearConfigCache('accessibility_labels');

        expect(logger.error).toHaveBeenCalledWith(
          'Failed to clear Redis cache:',
          expect.any(Error),
        );
        // In-memory cache should still be cleared
        expect(mockFindMany).not.toHaveBeenCalled(); // Will be checked by next call
      });

      it('should clear in-memory cache even when Redis fails', async () => {
        mockRedisDel.mockRejectedValueOnce(new Error('Redis error'));
        mockFindMany.mockResolvedValueOnce([]);

        // Populate cache
        await getConfig('accessibility_labels');

        // Clear cache (Redis fails but in-memory should be cleared)
        await clearConfigCache('accessibility_labels');

        // Next call should hit database again because in-memory cache was cleared
        await getConfig('accessibility_labels');

        expect(mockFindMany).toHaveBeenCalledTimes(2);
      });
    });
  });
});
