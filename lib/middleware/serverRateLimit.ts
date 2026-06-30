import { NextRequest } from 'next/server';
import { Redis } from 'ioredis';
import { getRedisClient, isRedisConnected } from '../middleware/redisConfig';
import { logger } from '../middleware/logger';

/**
 * Redis-backed rate limiter for server-side API protection
 * Falls back to in-memory storage when Redis is unavailable
 */

/**
 * Interface representing a rate limit entry in memory.
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
  blockedUntil?: number;
}

// Fallback: Store rate limit data in memory when Redis is unavailable
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Get max attempts for auth based on environment
 * Exported for testing
 */
export function getAuthMaxAttempts(): number {
  return process.env.NODE_ENV === 'production' ? 5 : 20;
}

// Configuration for different endpoint types
/**
 * Configuration for different endpoint types.
 * Defines max attempts, time window, and block duration for each category.
 */
export const RATE_LIMIT_CONFIGS = {
  // Authentication endpoints (login, register) - strict limits
  auth: {
    maxAttempts: getAuthMaxAttempts(), // Plus permissif en dev
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 2 * 60 * 1000, // Block for 2 minutes after limit
  },
  // General API endpoints
  api: {
    maxAttempts: 100,
    windowMs: 60 * 1000, // 1 minute
    blockDurationMs: 2 * 60 * 1000, // Block for 2 minutes
  },
  // Public search endpoints (institutions, events) - permissive but protected
  search: {
    maxAttempts: 100, // Plus permissif pour recherches multiples
    windowMs: 60 * 1000, // 1 minute
    blockDurationMs: 2 * 60 * 1000, // Block for 2 minutes
  },
  // Sensitive operations (delete, admin actions)
  sensitive: {
    maxAttempts: 30,
    windowMs: 60 * 1000, // 1 minute
    blockDurationMs: 2 * 60 * 1000, // Block for 2 minutes
  },
};

/**
 * Get client identifier from request (IP + User-Agent).
 * @param req - The incoming request.
 * @param includeEndpoint - Whether to include the endpoint path in the identifier (default: true).
 * @returns A unique string identifier for the client.
 */
export function getClientIdentifier(req: NextRequest, includeEndpoint = true): string {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  const userAgent = req.headers.get('user-agent') || 'unknown';

  // Include endpoint in identifier to have separate rate limits per endpoint
  const endpoint = includeEndpoint ? `:${new URL(req.url).pathname}` : '';

  // Hash to avoid storing full user agent
  return `${ip}:${userAgent.substring(0, 50)}${endpoint}`;
}

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier for the client
 * @param config - Rate limit configuration
 * @returns Object with success status and remaining attempts
 */
export async function checkRateLimit(
  identifier: string,
  config: {
    maxAttempts: number;
    windowMs: number;
    blockDurationMs: number;
  },
): Promise<{
  success: boolean;
  remaining: number;
  resetAt: number;
  blockedUntil?: number;
}> {
  const redis = getRedisClient();

  if (redis && isRedisConnected()) {
    try {
      return await checkRateLimitRedis(identifier, config, redis);
    } catch (error) {
      logger.error('Redis error in rate limiting, falling back to memory:', error);
      // Fall through to memory-based rate limiting
    }
  }

  // Fallback to memory-based rate limiting
  return checkRateLimitMemory(identifier, config);
}

/**
 * Redis-based rate limiting implementation
 */
async function checkRateLimitRedis(
  identifier: string,
  config: {
    maxAttempts: number;
    windowMs: number;
    blockDurationMs: number;
  },
  redis: Redis,
): Promise<{
  success: boolean;
  remaining: number;
  resetAt: number;
  blockedUntil?: number;
}> {
  const now = Date.now();
  const key = `ratelimit:${identifier}`;
  const blockKey = `ratelimit:block:${identifier}`;

  // Check if currently blocked
  const blockedUntil = await redis.get(blockKey);
  if (blockedUntil && now < parseInt(blockedUntil)) {
    return {
      success: false,
      remaining: 0,
      resetAt: parseInt(blockedUntil),
      blockedUntil: parseInt(blockedUntil),
    };
  }

  // Get current count
  const currentCount = await redis.get(key);

  // Get TTL to determine resetAt
  const ttl = await redis.ttl(key);
  const resetAt = ttl > 0 ? now + ttl * 1000 : now + config.windowMs;

  // If no entry or window expired, initialize
  if (!currentCount || ttl <= 0) {
    await redis.setex(key, Math.ceil(config.windowMs / 1000), '1');
    return {
      success: true,
      remaining: config.maxAttempts - 1,
      resetAt: now + config.windowMs,
    };
  }

  // Increment counter
  const newCount = await redis.incr(key);

  // Check if limit exceeded
  if (newCount > config.maxAttempts) {
    const blockUntil = now + config.blockDurationMs;
    await redis.setex(blockKey, Math.ceil(config.blockDurationMs / 1000), blockUntil.toString());

    return {
      success: false,
      remaining: 0,
      resetAt,
      blockedUntil: blockUntil,
    };
  }

  return {
    success: true,
    remaining: config.maxAttempts - newCount,
    resetAt,
  };
}

/**
 * Memory-based rate limiting implementation (fallback)
 */
function checkRateLimitMemory(
  identifier: string,
  config: {
    maxAttempts: number;
    windowMs: number;
    blockDurationMs: number;
  },
): {
  success: boolean;
  remaining: number;
  resetAt: number;
  blockedUntil?: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // Check if currently blocked
  if (entry?.blockedUntil && now < entry.blockedUntil) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.blockedUntil,
      blockedUntil: entry.blockedUntil,
    };
  }

  // Initialize or reset if window expired
  if (!entry || now > entry.resetAt) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    rateLimitStore.set(identifier, newEntry);

    return {
      success: true,
      remaining: config.maxAttempts - 1,
      resetAt: newEntry.resetAt,
    };
  }

  // Increment counter
  entry.count++;

  // Check if limit exceeded
  if (entry.count > config.maxAttempts) {
    entry.blockedUntil = now + config.blockDurationMs;
    rateLimitStore.set(identifier, entry);

    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
      blockedUntil: entry.blockedUntil,
    };
  }

  rateLimitStore.set(identifier, entry);

  return {
    success: true,
    remaining: config.maxAttempts - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Clean up expired entries (run periodically)
 */
export function cleanupExpiredEntries(): void {
  const now = Date.now();

  for (const [key, entry] of rateLimitStore.entries()) {
    // Remove if both reset time and block time have passed
    if (now > entry.resetAt && (!entry.blockedUntil || now > entry.blockedUntil)) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Reset rate limit for a specific identifier (e.g., after successful login)
 */
export async function resetRateLimit(identifier: string): Promise<void> {
  const redis = getRedisClient();

  if (redis && isRedisConnected()) {
    try {
      const key = `ratelimit:${identifier}`;
      const blockKey = `ratelimit:block:${identifier}`;
      await redis.del(key, blockKey);
    } catch (error) {
      logger.error('Redis error resetting rate limit:', error);
    }
  }

  // Also delete from memory fallback
  rateLimitStore.delete(identifier);
}

/**
 * Get current rate limit status without incrementing
 */
export function getRateLimitStatus(identifier: string): {
  isBlocked: boolean;
  remaining: number;
  resetAt: number | null;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry) {
    return { isBlocked: false, remaining: 0, resetAt: null };
  }

  const isBlocked = !!(entry.blockedUntil && now < entry.blockedUntil);

  return {
    isBlocked,
    remaining: isBlocked ? 0 : entry.count,
    resetAt: entry.resetAt,
  };
}

// Cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredEntries, 5 * 60 * 1000);
}
