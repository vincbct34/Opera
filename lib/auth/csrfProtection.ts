import { randomBytes, createHash } from 'crypto';
import { getRedisClient, isRedisConnected } from '../middleware/redisConfig';
import { logger } from '../middleware/logger';

// Fallback: Store CSRF tokens in memory when Redis is not available
const csrfTokenStore = new Map<string, { token: string; expires: number }>();

// Token expiration time (15 minutes)
const TOKEN_EXPIRATION = 15 * 60 * 1000;
const TOKEN_EXPIRATION_SECONDS = 15 * 60;

/**
 * Generate a CSRF token for a given session/user identifier
 * @param identifier - Unique identifier (user ID, session ID, etc.)
 * @returns CSRF token
 */
export async function generateCSRFToken(identifier: string): Promise<string> {
  // Generate a random token
  const token = randomBytes(32).toString('hex');

  // Create a hash combining the token and identifier for validation
  const tokenHash = createHash('sha256').update(`${token}:${identifier}`).digest('hex');

  const redis = getRedisClient();

  if (redis && isRedisConnected()) {
    try {
      // Store in Redis with automatic expiration
      await redis.setex(`csrf:${identifier}`, TOKEN_EXPIRATION_SECONDS, tokenHash);
    } catch (error) {
      logger.error('Redis error storing CSRF token, falling back to memory:', error);
      // Fallback to memory storage
      csrfTokenStore.set(identifier, {
        token: tokenHash,
        expires: Date.now() + TOKEN_EXPIRATION,
      });
    }
  } else {
    // Fallback to memory storage
    csrfTokenStore.set(identifier, {
      token: tokenHash,
      expires: Date.now() + TOKEN_EXPIRATION,
    });
  }

  // Clean up expired tokens periodically (for memory fallback)
  cleanupExpiredTokens();

  return token;
}

/**
 * Validate a CSRF token against a stored token for an identifier
 * @param token - Token to validate
 * @param identifier - Unique identifier (user ID, session ID, etc.)
 * @returns true if token is valid, false otherwise
 */
export async function validateCSRFToken(
  token: string | null,
  identifier: string,
): Promise<boolean> {
  if (!token || !identifier) {
    return false;
  }

  const redis = getRedisClient();

  if (redis && isRedisConnected()) {
    try {
      // Retrieve from Redis
      const stored = await redis.get(`csrf:${identifier}`);

      if (!stored) {
        return false;
      }

      // Recreate the hash and compare
      const tokenHash = createHash('sha256').update(`${token}:${identifier}`).digest('hex');

      return tokenHash === stored;
    } catch (error) {
      logger.error('Redis error validating CSRF token, falling back to memory:', error);
      // Fall through to memory validation
    }
  }

  // Fallback to memory storage
  const stored = csrfTokenStore.get(identifier);

  if (!stored) {
    return false;
  }

  // Check if token is expired
  if (Date.now() > stored.expires) {
    csrfTokenStore.delete(identifier);
    return false;
  }

  // Recreate the hash and compare
  const tokenHash = createHash('sha256').update(`${token}:${identifier}`).digest('hex');

  return tokenHash === stored.token;
}

/**
 * Delete a CSRF token for a given identifier
 * @param identifier - Unique identifier
 */
export async function deleteCSRFToken(identifier: string): Promise<void> {
  const redis = getRedisClient();

  if (redis && isRedisConnected()) {
    try {
      await redis.del(`csrf:${identifier}`);
    } catch (error) {
      logger.error('Redis error deleting CSRF token:', error);
    }
  }

  // Also delete from memory fallback
  csrfTokenStore.delete(identifier);
}

/**
 * Clean up expired tokens from the store
 * Exported for testing purposes
 */
export function cleanupExpiredTokens(): void {
  const now = Date.now();

  for (const [identifier, data] of csrfTokenStore.entries()) {
    if (now > data.expires) {
      csrfTokenStore.delete(identifier);
    }
  }
}

/**
 * Check if setInterval is available
 * Exported for testing purposes
 */
export function isSetIntervalAvailable(): boolean {
  return typeof setInterval !== 'undefined';
}

// Store the cleanup interval reference
let cleanupIntervalId: NodeJS.Timeout | number | null = null;

/**
 * Start automatic cleanup interval
 * Exported for testing purposes
 */
export function startCleanupInterval(): void {
  if (isSetIntervalAvailable()) {
    cleanupIntervalId = setInterval(cleanupExpiredTokens, 5 * 60 * 1000);
  }
}

/**
 * Stop automatic cleanup interval
 * Exported for testing purposes
 */
export function stopCleanupInterval(): void {
  if (cleanupIntervalId !== null && typeof clearInterval !== 'undefined') {
    clearInterval(cleanupIntervalId as NodeJS.Timeout);
    cleanupIntervalId = null;
  }
}

// Cleanup expired tokens every 5 minutes
startCleanupInterval();
