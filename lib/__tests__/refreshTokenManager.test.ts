/* eslint-disable */
/**
 * @jest-environment node
 *
 * Refresh Token Manager Tests
 */

import { describe, expect, it, afterEach, jest, beforeEach, beforeAll } from '@jest/globals';

// Set environment variables for testing
// Set test environment variables before importing the module
process.env.ACCESS_TOKEN_SECRET =
  'test-access-token-secret-for-unit-tests-minimum-32-characters-long';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-token-secret-for-unit-tests-minimum-32-characters';

// In-memory store for testing
const blacklistedTokens = new Map<string, { token: string; user_id: string; expires_at: Date }>();

// Mock Prisma before importing anything that depends on it
jest.mock('@/lib/middleware/prismaConfig', () => ({
  __esModule: true,
  default: {
    refreshTokenBlacklist: {
      create: jest.fn(async ({ data }: any) => {
        if (blacklistedTokens.has(data.token)) {
          const error: any = new Error('Unique constraint failed');
          error.code = 'P2002';
          throw error;
        }
        const entry = { token: data.token, user_id: data.user_id, expires_at: data.expires_at };
        blacklistedTokens.set(data.token, entry);
        return entry;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        return blacklistedTokens.get(where.token) || null;
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        let deleted = 0;
        if (where.token?.in) {
          where.token.in.forEach((token: string) => {
            if (blacklistedTokens.delete(token)) deleted++;
          });
        } else if (where.user_id) {
          for (const [token, entry] of blacklistedTokens.entries()) {
            if (entry.user_id === where.user_id) {
              blacklistedTokens.delete(token);
              deleted++;
            }
          }
        } else if (where.expires_at?.lt) {
          for (const [token, entry] of blacklistedTokens.entries()) {
            if (entry.expires_at < where.expires_at.lt) {
              blacklistedTokens.delete(token);
              deleted++;
            }
          }
        }
        return { count: deleted };
      }),
      count: jest.fn(async ({ where }: any) => {
        let count = 0;
        if (where.expires_at?.lt) {
          for (const entry of blacklistedTokens.values()) {
            if (entry.expires_at < where.expires_at.lt) count++;
          }
        }
        return count;
      }),
    },
  },
}));

import {
  blacklistRefreshToken,
  isTokenBlacklisted,
  generateRefreshToken,
  verifyRefreshToken,
  getTokenExpiration,
  cleanupExpiredBlacklistedTokens,
  blacklistAllUserTokens,
} from '@/lib/auth/refreshTokenManager';
import prisma from '@/lib/middleware/prismaConfig';

describe('Refresh Token Manager', () => {
  const testUserId = 'test-user-id';
  const createdTokens: string[] = [];

  // Ensure JWT refresh secret is available for these tests
  beforeAll(() => {
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET ??
      'test-refresh-token-secret-for-unit-tests-minimum-32-characters';
  });

  beforeEach(() => {
    // Clear the in-memory store
    blacklistedTokens.clear();
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup: delete all test tokens from blacklist
    if (createdTokens.length > 0) {
      await prisma.refreshTokenBlacklist.deleteMany({
        where: {
          token: {
            in: createdTokens,
          },
        },
      });
      createdTokens.length = 0;
    }
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const { token, expiresAt } = generateRefreshToken(testUserId);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      expect(expiresAt).toBeInstanceOf(Date);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should generate tokens with proper structure', () => {
      const { token } = generateRefreshToken(testUserId);

      // JWT tokens have 3 parts separated by dots
      const parts = token.split('.');
      expect(parts).toHaveLength(3);

      // Should be able to verify the token
      const decoded = verifyRefreshToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.id).toBe(testUserId);
    });

    it('should set expiration to 7 days from now', () => {
      const { expiresAt } = generateRefreshToken(testUserId);
      const expectedExpiration = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Allow 1 second difference for test execution time
      expect(Math.abs(expiresAt.getTime() - expectedExpiration.getTime())).toBeLessThan(1000);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const { token } = generateRefreshToken(testUserId);
      const decoded = verifyRefreshToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded?.id).toBe(testUserId);
    });

    it('should return null for invalid token', () => {
      const decoded = verifyRefreshToken('invalid-token');
      expect(decoded).toBeNull();
    });

    it('should return null for tampered token', () => {
      const { token } = generateRefreshToken(testUserId);
      const tamperedToken = token.slice(0, -5) + 'xxxxx';
      const decoded = verifyRefreshToken(tamperedToken);

      expect(decoded).toBeNull();
    });
  });

  describe('getTokenExpiration', () => {
    it('should extract expiration date from token', () => {
      const { token, expiresAt } = generateRefreshToken(testUserId);
      const extractedExpiration = getTokenExpiration(token);

      expect(extractedExpiration).not.toBeNull();
      // Allow 1 second difference
      expect(Math.abs(extractedExpiration!.getTime() - expiresAt.getTime())).toBeLessThan(1000);
    });

    it('should return null for invalid token', () => {
      const expiration = getTokenExpiration('invalid-token');
      expect(expiration).toBeNull();
    });
  });

  describe('missing JWT refresh secret handling', () => {
    it('generateRefreshToken should throw when JWT_REFRESH_SECRET is missing', () => {
      const previous = process.env.JWT_REFRESH_SECRET;
      // Remove secret
      delete process.env.JWT_REFRESH_SECRET;

      try {
        expect(() => generateRefreshToken(testUserId)).toThrow(
          'Missing JWT refresh secret (JWT_REFRESH_SECRET)',
        );
      } finally {
        // Restore
        process.env.JWT_REFRESH_SECRET = previous;
      }
    });

    it('verifyRefreshToken should return null when JWT_REFRESH_SECRET is missing', () => {
      const previous = process.env.JWT_REFRESH_SECRET;
      // Remove secret
      delete process.env.JWT_REFRESH_SECRET;

      try {
        const decoded = verifyRefreshToken('any-token');
        expect(decoded).toBeNull();
      } finally {
        // Restore
        process.env.JWT_REFRESH_SECRET = previous;
      }
    });
  });

  describe('blacklistRefreshToken', () => {
    it('should blacklist a refresh token', async () => {
      const { token, expiresAt } = generateRefreshToken(testUserId);
      createdTokens.push(token);

      await blacklistRefreshToken(token, testUserId, expiresAt);

      const isBlacklisted = await isTokenBlacklisted(token);
      expect(isBlacklisted).toBe(true);
    });

    it('should not throw error when blacklisting same token twice', async () => {
      const { token, expiresAt } = generateRefreshToken(testUserId);
      createdTokens.push(token);

      await blacklistRefreshToken(token, testUserId, expiresAt);
      await expect(blacklistRefreshToken(token, testUserId, expiresAt)).resolves.not.toThrow();
    });

    it('should use default expiration if not provided', async () => {
      const { token } = generateRefreshToken(testUserId);
      createdTokens.push(token);

      await blacklistRefreshToken(token, testUserId);

      const blacklistedToken = await prisma.refreshTokenBlacklist.findUnique({
        where: { token },
      });

      expect(blacklistedToken).not.toBeNull();
      expect(blacklistedToken!.expires_at.getTime()).toBeGreaterThan(Date.now());
    });

    it('should handle unique constraint error gracefully', async () => {
      const { token, expiresAt } = generateRefreshToken(testUserId);
      createdTokens.push(token);

      // First blacklist
      await blacklistRefreshToken(token, testUserId, expiresAt);

      // Try to blacklist again - should handle unique constraint error
      await expect(blacklistRefreshToken(token, testUserId, expiresAt)).resolves.not.toThrow();

      const isBlacklisted = await isTokenBlacklisted(token);
      expect(isBlacklisted).toBe(true);
    });

    it('should rethrow non-unique constraint errors', async () => {
      // Mock prisma to throw a different error
      const originalCreate = prisma.refreshTokenBlacklist.create;
      (prisma.refreshTokenBlacklist.create as any) = jest
        .fn<any>()
        .mockRejectedValue(new Error('Database error'));

      const { token } = generateRefreshToken(testUserId);

      await expect(blacklistRefreshToken(token, testUserId)).rejects.toThrow('Database error');

      // Restore
      prisma.refreshTokenBlacklist.create = originalCreate;
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return false for non-blacklisted token', async () => {
      const { token } = generateRefreshToken(testUserId);

      const isBlacklisted = await isTokenBlacklisted(token);
      expect(isBlacklisted).toBe(false);
    });

    it('should return true for blacklisted token', async () => {
      const { token, expiresAt } = generateRefreshToken(testUserId);
      createdTokens.push(token);

      await blacklistRefreshToken(token, testUserId, expiresAt);

      const isBlacklisted = await isTokenBlacklisted(token);
      expect(isBlacklisted).toBe(true);
    });
  });

  describe('cleanupExpiredBlacklistedTokens', () => {
    it('should delete expired tokens', async () => {
      const { token } = generateRefreshToken(testUserId);
      const expiredDate = new Date(Date.now() - 1000); // 1 second ago
      createdTokens.push(token);

      await blacklistRefreshToken(token, testUserId, expiredDate);

      const deletedCount = await cleanupExpiredBlacklistedTokens();
      expect(deletedCount).toBeGreaterThanOrEqual(1);

      const isBlacklisted = await isTokenBlacklisted(token);
      expect(isBlacklisted).toBe(false);
    });

    it('should not delete non-expired tokens', async () => {
      const { token, expiresAt } = generateRefreshToken(testUserId);
      createdTokens.push(token);

      await blacklistRefreshToken(token, testUserId, expiresAt);

      await cleanupExpiredBlacklistedTokens();

      const isBlacklisted = await isTokenBlacklisted(token);
      expect(isBlacklisted).toBe(true);
    });
  });

  describe('blacklistAllUserTokens', () => {
    it('should log message for blacklisting all user tokens', async () => {
      // Mock the logger instead of console.log
      const { logger } = await import('@/lib/middleware/logger');
      const loggerSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});

      await blacklistAllUserTokens(testUserId);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Blacklisting all tokens for user ${testUserId}`),
      );

      loggerSpy.mockRestore();
    });
  });

  describe('getTokenExpiration error handling', () => {
    it('should return null for malformed token in getTokenExpiration', () => {
      // Token that will cause jwt.decode to throw
      const malformedToken = 'not.a.valid.jwt.structure.at.all';
      const expiration = getTokenExpiration(malformedToken);
      expect(expiration).toBeNull();
    });

    it('should return null when token has no exp claim', () => {
      // Create a token without exp by mocking jwt
      const jwt = require('jsonwebtoken');
      const tokenWithoutExp = jwt.sign({ id: testUserId }, process.env.REFRESH_TOKEN_SECRET!, {
        noTimestamp: true,
      });

      // Decode will succeed but no exp field
      const decoded = jwt.decode(tokenWithoutExp);
      expect(decoded).toBeTruthy();

      const expiration = getTokenExpiration(tokenWithoutExp);
      expect(expiration).toBeNull();
    });

    it('should handle jwt.decode throwing an error', () => {
      // Mock jwt.decode to throw
      const jwt = require('jsonwebtoken');
      const originalDecode = jwt.decode;

      jwt.decode = () => {
        throw new Error('Decode error');
      };

      const expiration = getTokenExpiration('any-token');
      expect(expiration).toBeNull();

      // Restore
      jwt.decode = originalDecode;
    });
  });
});
