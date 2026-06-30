/**
 * Redis Configuration and Client Setup
 * Provides centralized Redis connection with error handling and fallback
 */

import Redis from 'ioredis';
import { logger } from '../middleware/logger';

let redisClient: Redis | null = null;
let isRedisAvailable = false;

/**
 * Initialize Redis client with connection pooling and error handling.
 * Skips initialization in test environment.
 * @returns The initialized Redis client or null if not configured/test env.
 */
function createRedisClient(): Redis | null {
  // Skip Redis in test environment
  if (process.env.NODE_ENV === 'test') {
    logger.info('Redis disabled in test environment');
    return null;
  }

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    // Only show warning in production or if explicitly requested
    if (process.env.NODE_ENV === 'production') {
      logger.warn('REDIS_URL not configured. Using in-memory fallback for CSRF and rate limiting.');
      logger.warn(
        '⚠️  WARNING: In-memory storage is NOT suitable for production with multiple instances!',
      );
    } else if (process.env.SHOW_REDIS_WARNINGS === 'true') {
      logger.info('REDIS_URL not configured. Using in-memory fallback.');
    }
    return null;
  }

  try {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true,
      enableReadyCheck: true,
      enableOfflineQueue: true,
      connectTimeout: 10000,
    });

    // Event handlers
    client.on('connect', () => {
      logger.info('Redis client connected');
      isRedisAvailable = true;
    });

    client.on('ready', () => {
      logger.info('Redis client ready');
      isRedisAvailable = true;
    });

    client.on('error', (err) => {
      logger.error('Redis client error:', err);
      isRedisAvailable = false;
    });

    client.on('close', () => {
      logger.warn('Redis connection closed');
      isRedisAvailable = false;
    });

    client.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });

    // Attempt to connect
    client.connect().catch((err) => {
      logger.error('Failed to connect to Redis:', err);
      isRedisAvailable = false;
    });

    return client;
  } catch (error) {
    logger.error('Error creating Redis client:', error);
    return null;
  }
}

/**
 * Get the Redis client instance (singleton pattern).
 * Initializes the client if it doesn't exist.
 * @returns The Redis client instance or null.
 */
export function getRedisClient(): Redis | null {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  return redisClient;
}

/**
 * Check if Redis is available and connected.
 * @returns true if Redis is ready, false otherwise.
 */
export function isRedisConnected(): boolean {
  return isRedisAvailable && redisClient?.status === 'ready';
}

/**
 * Close Redis connection (for graceful shutdown).
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    isRedisAvailable = false;
    logger.info('Redis connection closed');
  }
}

/**
 * Test Redis connection by sending a ping.
 * @returns true if ping succeeds, false otherwise.
 */
export async function testRedisConnection(): Promise<boolean> {
  const client = getRedisClient();
  if (!client) {
    return false;
  }

  try {
    await client.ping();
    return true;
  } catch (error) {
    logger.error('Redis ping failed:', error);
    return false;
  }
}

// Initialize Redis client on module load
if (process.env.NODE_ENV !== 'test') {
  getRedisClient();
}

// Graceful shutdown
if (typeof process !== 'undefined') {
  process.on('SIGTERM', async () => {
    await closeRedis();
  });

  process.on('SIGINT', async () => {
    await closeRedis();
  });
}
