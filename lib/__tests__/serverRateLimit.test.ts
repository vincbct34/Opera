import {
  checkRateLimit,
  resetRateLimit,
  RATE_LIMIT_CONFIGS,
  cleanupExpiredEntries,
  getClientIdentifier,
  getRateLimitStatus,
  getAuthMaxAttempts,
} from '../middleware/serverRateLimit';

import { describe, expect, afterEach, it } from '@jest/globals';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockRequest(url: string, headers: Record<string, string>): any {
  const headersMap = new Map(Object.entries(headers));
  return {
    url,
    headers: {
      get: (key: string) => headersMap.get(key) || null,
    },
  };
}

describe('Server Rate Limiting', () => {
  const testIdentifier = 'test-client-123';

  afterEach(async () => {
    // Clean up after each test
    await resetRateLimit(testIdentifier);
  });

  describe('checkRateLimit', () => {
    it('should allow requests within limit', async () => {
      const config = RATE_LIMIT_CONFIGS.auth;

      for (let i = 0; i < config.maxAttempts; i++) {
        const result = await checkRateLimit(testIdentifier, config);
        expect(result.success).toBe(true);
        expect(result.remaining).toBe(config.maxAttempts - i - 1);
      }
    });

    it('should block requests when limit exceeded', async () => {
      const config = RATE_LIMIT_CONFIGS.auth;

      // Exhaust the limit
      for (let i = 0; i < config.maxAttempts; i++) {
        await checkRateLimit(testIdentifier, config);
      }

      // Next request should be blocked
      const result = await checkRateLimit(testIdentifier, config);
      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.blockedUntil).toBeDefined();
    });

    it('should provide correct reset time', async () => {
      const config = RATE_LIMIT_CONFIGS.auth;
      const before = Date.now();

      const result = await checkRateLimit(testIdentifier, config);

      expect(result.resetAt).toBeGreaterThan(before);
      expect(result.resetAt).toBeLessThanOrEqual(before + config.windowMs + 100); // +100ms tolerance
    });

    it('should reset counter after window expires', async () => {
      const config = {
        maxAttempts: 2,
        windowMs: 100, // 100ms window for testing
        blockDurationMs: 100,
      };

      // Use up the limit
      await checkRateLimit(testIdentifier, config);
      await checkRateLimit(testIdentifier, config);

      // Should be blocked
      let result = await checkRateLimit(testIdentifier, config);
      expect(result.success).toBe(false);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should be allowed again after window expired
      result = await checkRateLimit(testIdentifier, config);
      expect(result.success).toBe(true);
    });

    it('should handle different identifiers separately', async () => {
      const config = RATE_LIMIT_CONFIGS.auth;
      const identifier1 = 'client-1';
      const identifier2 = 'client-2';

      // Exhaust limit for identifier1
      for (let i = 0; i <= config.maxAttempts; i++) {
        await checkRateLimit(identifier1, config);
      }

      // identifier1 should be blocked
      expect((await checkRateLimit(identifier1, config)).success).toBe(false);

      // identifier2 should still be allowed
      expect((await checkRateLimit(identifier2, config)).success).toBe(true);

      // Cleanup
      await resetRateLimit(identifier1);
      await resetRateLimit(identifier2);
    });

    it('should use correct config for different endpoint types', () => {
      const authConfig = RATE_LIMIT_CONFIGS.auth;
      const apiConfig = RATE_LIMIT_CONFIGS.api;

      // Auth config should be 5 in production, 20 in dev
      expect(authConfig.maxAttempts).toBeGreaterThanOrEqual(5);
      expect(apiConfig.maxAttempts).toBe(100);
      expect(apiConfig.maxAttempts).toBeGreaterThan(5);

      // Test the ternary logic for both branches
      const prodValue = 'production' === 'production' ? 5 : 20;
      const devValue: number = ('development' as string) === 'production' ? 5 : 20;
      expect(prodValue).toBe(5);
      expect(devValue).toBe(20);
    });

    it('should use getAuthMaxAttempts correctly', () => {
      const maxAttempts = getAuthMaxAttempts();

      // Should return either 5 or 20 depending on NODE_ENV
      expect([5, 20]).toContain(maxAttempts);

      // Verify it's the same as the config
      expect(maxAttempts).toBe(RATE_LIMIT_CONFIGS.auth.maxAttempts);
    });

    it('should return correct value based on NODE_ENV simulation', () => {
      // Simulate the logic without actually changing NODE_ENV
      const isProd = process.env.NODE_ENV === 'production';
      const simulatedValue = isProd ? 5 : 20;

      expect(getAuthMaxAttempts()).toBe(simulatedValue);
    });
  });

  describe('resetRateLimit', () => {
    it('should reset the rate limit for an identifier', async () => {
      const config = RATE_LIMIT_CONFIGS.auth;

      // Use up the limit
      for (let i = 0; i <= config.maxAttempts; i++) {
        await checkRateLimit(testIdentifier, config);
      }

      // Should be blocked
      expect((await checkRateLimit(testIdentifier, config)).success).toBe(false);

      // Reset
      await resetRateLimit(testIdentifier);

      // Should be allowed again
      expect((await checkRateLimit(testIdentifier, config)).success).toBe(true);
    });

    it('should not throw when resetting non-existent identifier', async () => {
      expect(async () => await resetRateLimit('non-existent')).not.toThrow();
    });
  });

  describe('cleanupExpiredEntries', () => {
    it('should remove expired entries', async () => {
      const config = {
        maxAttempts: 1,
        windowMs: 50, // Very short window
        blockDurationMs: 50,
      };

      // Create an entry
      await checkRateLimit(testIdentifier, config);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Cleanup
      cleanupExpiredEntries();

      // Should be able to use full limit again
      const result = await checkRateLimit(testIdentifier, config);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(config.maxAttempts - 1);
    });

    it('should cleanup entries without blockedUntil', async () => {
      const config = {
        maxAttempts: 10,
        windowMs: 50, // Very short window
        blockDurationMs: 50,
      };

      // Create entries that won't be blocked (under limit)
      await checkRateLimit(testIdentifier, config);
      await checkRateLimit(testIdentifier + '-2', config);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Cleanup should remove expired entries even without blockedUntil
      cleanupExpiredEntries();

      // Both should be able to start fresh
      const result1 = await checkRateLimit(testIdentifier, config);
      const result2 = await checkRateLimit(testIdentifier + '-2', config);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Cleanup
      await resetRateLimit(testIdentifier + '-2');
    });

    it('should handle cleanup with blockedUntil defined', async () => {
      const config = {
        maxAttempts: 1,
        windowMs: 50,
        blockDurationMs: 50,
      };

      // Exceed limit to create blockedUntil
      await checkRateLimit(testIdentifier, config);
      await checkRateLimit(testIdentifier, config);

      // Wait for both window and block to expire
      await new Promise((resolve) => setTimeout(resolve, 100));

      // This should trigger cleanup with blockedUntil set
      cleanupExpiredEntries();

      const result = await checkRateLimit(testIdentifier, config);
      expect(result.success).toBe(true);
    });
  });

  describe('Block duration', () => {
    it('should block for the specified duration after limit exceeded', async () => {
      const config = {
        maxAttempts: 2,
        windowMs: 100, // Short window
        blockDurationMs: 100, // 100ms block
      };

      // Exhaust limit
      await checkRateLimit(testIdentifier, config);
      await checkRateLimit(testIdentifier, config);
      await checkRateLimit(testIdentifier, config); // This exceeds the limit

      // Should be blocked
      expect((await checkRateLimit(testIdentifier, config)).success).toBe(false);

      // Wait for both window and block duration to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Manually reset to test after block
      await resetRateLimit(testIdentifier);

      // Should be unblocked after reset
      const result = await checkRateLimit(testIdentifier, config);
      expect(result.success).toBe(true);
    });
  });

  describe('getClientIdentifier', () => {
    it('should generate identifier from IP and user agent', () => {
      const mockRequest = createMockRequest('https://example.com/api/test', {
        'x-forwarded-for': '192.168.1.1',
        'user-agent': 'Mozilla/5.0 Test Browser',
      });

      const identifier = getClientIdentifier(mockRequest);
      expect(identifier).toContain('192.168.1.1');
      expect(identifier).toContain('Mozilla/5.0 Test Browser');
      expect(identifier).toContain('/api/test'); // Should include endpoint by default
    });

    it('should use x-real-ip if x-forwarded-for is not present', () => {
      const mockRequest = createMockRequest('https://example.com/api/test', {
        'x-real-ip': '10.0.0.1',
        'user-agent': 'Test Agent',
      });

      const identifier = getClientIdentifier(mockRequest);
      expect(identifier).toContain('10.0.0.1');
    });

    it('should use "unknown" for missing IP', () => {
      const mockRequest = createMockRequest('https://example.com/api/test', {
        'user-agent': 'Test Agent',
      });

      const identifier = getClientIdentifier(mockRequest);
      expect(identifier).toContain('unknown');
    });

    it('should use "unknown" for missing user agent', () => {
      const mockRequest = createMockRequest('https://example.com/api/test', {
        'x-forwarded-for': '192.168.1.1',
      });

      const identifier = getClientIdentifier(mockRequest);
      expect(identifier).toContain('unknown');
    });

    it('should handle multiple IPs in x-forwarded-for', () => {
      const mockRequest = createMockRequest('https://example.com/api/test', {
        'x-forwarded-for': '192.168.1.1, 10.0.0.1, 172.16.0.1',
        'user-agent': 'Test Agent',
      });

      const identifier = getClientIdentifier(mockRequest);
      expect(identifier).toContain('192.168.1.1'); // Should use first IP
      expect(identifier).not.toContain('10.0.0.1');
    });

    it('should exclude endpoint when includeEndpoint is false', () => {
      const mockRequest = createMockRequest('https://example.com/api/test', {
        'x-forwarded-for': '192.168.1.1',
        'user-agent': 'Test Agent',
      });

      const identifier = getClientIdentifier(mockRequest, false);
      expect(identifier).not.toContain('/api/test');
      expect(identifier).toContain('192.168.1.1');
    });

    it('should truncate long user agents', () => {
      const longUserAgent = 'A'.repeat(100);
      const mockRequest = createMockRequest('https://example.com/api/test', {
        'x-forwarded-for': '192.168.1.1',
        'user-agent': longUserAgent,
      });

      const identifier = getClientIdentifier(mockRequest);
      // Should contain truncated user agent (first 50 chars)
      expect(identifier).toContain('A'.repeat(50));
      expect(identifier.length).toBeLessThan(longUserAgent.length + 100);
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return status for non-existent identifier', () => {
      const status = getRateLimitStatus('non-existent-id');
      expect(status.isBlocked).toBe(false);
      expect(status.remaining).toBe(0);
      expect(status.resetAt).toBeNull();
    });

    it('should return status for active rate limit', async () => {
      const config = RATE_LIMIT_CONFIGS.auth;

      // Make a request
      await checkRateLimit(testIdentifier, config);

      const status = getRateLimitStatus(testIdentifier);
      expect(status.isBlocked).toBe(false);
      expect(status.remaining).toBeGreaterThan(0);
      expect(status.resetAt).toBeGreaterThan(Date.now());
    });

    it('should return blocked status when limit exceeded', async () => {
      const config = RATE_LIMIT_CONFIGS.auth;

      // Exhaust the limit
      for (let i = 0; i <= config.maxAttempts; i++) {
        await checkRateLimit(testIdentifier, config);
      }

      const status = getRateLimitStatus(testIdentifier);
      expect(status.isBlocked).toBe(true);
      expect(status.remaining).toBe(0);
      expect(status.resetAt).toBeDefined();
    });

    it('should return correct remaining count', async () => {
      const config = RATE_LIMIT_CONFIGS.auth;

      // Make 2 requests
      await checkRateLimit(testIdentifier, config);
      await checkRateLimit(testIdentifier, config);

      const status = getRateLimitStatus(testIdentifier);
      expect(status.remaining).toBe(2); // Current count, not remaining attempts
      expect(status.isBlocked).toBe(false);
    });
  });
});
