import { describe, expect, it, jest } from '@jest/globals';
import {
  getRedisClient,
  isRedisConnected,
  testRedisConnection,
  closeRedis,
} from '../middleware/redisConfig';

// Mock logger
jest.mock('../middleware/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('redisConfig', () => {
  // In test environment, Redis is disabled
  describe('getRedisClient', () => {
    it('should return null in test environment', () => {
      const client = getRedisClient();
      expect(client).toBeNull();
    });
  });

  describe('isRedisConnected', () => {
    it('should return false when Redis is not available', () => {
      const result = isRedisConnected();
      expect(result).toBe(false);
    });
  });

  describe('testRedisConnection', () => {
    it('should return false when client is null', async () => {
      const result = await testRedisConnection();
      expect(result).toBe(false);
    });
  });

  describe('closeRedis', () => {
    it('should handle closing when client is null', async () => {
      await expect(closeRedis()).resolves.toBeUndefined();
    });
  });
});
