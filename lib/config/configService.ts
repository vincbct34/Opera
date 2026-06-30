/**
 * Configuration Service (SERVER-SIDE ONLY)
 *
 * Provides dynamic configuration management with database storage,
 * in-memory caching, and fallback to default values.
 *
 * WARNING: This file imports Prisma and should ONLY be used in:
 * - Server components
 * - API routes
 * - Server actions
 *
 * For client components, use labelMappings.ts or labelDefaults.ts instead.
 *
 * Categories:
 * - accessibility_labels: Labels for Accessibility enum
 * - event_type_labels: Labels for EventType enum
 * - public_category_labels: Labels for PublicCategory enum
 * - registration_status_labels: Labels for RegistrationStatus enum
 * - event_status_labels: Labels for EventStatus enum
 * - school_grade_labels: Labels for SchoolGrade enum
 * - age_range_labels: Labels for AgeRange enum
 */

import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { getRedisClient, isRedisConnected } from '@/lib/middleware/redisConfig';
import {
  DEFAULT_ACCESSIBILITY_LABELS,
  DEFAULT_AGE_RANGE_LABELS,
  DEFAULT_EVENT_TYPE_LABELS,
  DEFAULT_PUBLIC_CATEGORY_LABELS,
  DEFAULT_REGISTRATION_STATUS_LABELS,
  DEFAULT_EVENT_STATUS_LABELS,
  DEFAULT_SCHOOL_GRADE_LABELS,
} from '@/lib/config/labelDefaults';

// Re-export defaults for convenience
export {
  DEFAULT_ACCESSIBILITY_LABELS,
  DEFAULT_AGE_RANGE_LABELS,
  DEFAULT_EVENT_TYPE_LABELS,
  DEFAULT_PUBLIC_CATEGORY_LABELS,
  DEFAULT_REGISTRATION_STATUS_LABELS,
  DEFAULT_EVENT_STATUS_LABELS,
  DEFAULT_SCHOOL_GRADE_LABELS,
};

// ============================================================================
// Types
// ============================================================================

export type ConfigCategory =
  | 'accessibility_labels'
  | 'event_type_labels'
  | 'public_category_labels'
  | 'registration_status_labels'
  | 'event_status_labels'
  | 'school_grade_labels'
  | 'age_range_labels';

export interface ConfigEntry {
  category: ConfigCategory;
  key: string;
  value: string;
}

// ============================================================================
// Cache Management (Redis with in-memory fallback)
// ============================================================================

const CACHE_PREFIX = 'app_config:';
const CACHE_TTL_SECONDS = 300; // 5 minutes in seconds for Redis

// In-memory fallback cache (used only when Redis is unavailable)
interface CacheEntry {
  data: Record<string, string>;
  timestamp: number;
}
const memoryCache = new Map<ConfigCategory, CacheEntry>();
const MEMORY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Clear the configuration cache (useful after updates)
 * Clears both Redis and in-memory cache
 */
export async function clearConfigCache(category?: ConfigCategory): Promise<void> {
  // Clear Redis cache
  const redis = getRedisClient();
  if (redis && isRedisConnected()) {
    try {
      if (category) {
        await redis.del(`${CACHE_PREFIX}${category}`);
      } else {
        const keys = await redis.keys(`${CACHE_PREFIX}*`);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      }
      logger.debug(`Redis cache cleared for ${category || 'all categories'}`);
    } catch (error) {
      logger.error('Failed to clear Redis cache:', error);
    }
  }

  // Clear in-memory fallback cache
  if (category) {
    memoryCache.delete(category);
  } else {
    memoryCache.clear();
  }
}

/**
 * Check if in-memory cache is valid
 */
function isMemoryCacheValid(category: ConfigCategory): boolean {
  const entry = memoryCache.get(category);
  if (!entry) return false;
  return Date.now() - entry.timestamp < MEMORY_CACHE_TTL_MS;
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Get all config entries for a category from the database
 */
async function getConfigFromDatabase(
  category: ConfigCategory,
): Promise<Record<string, string> | null> {
  try {
    const entries = await prisma.appConfig.findMany({
      where: { category },
    });

    if (entries.length === 0) return null;

    const result: Record<string, string> = {};
    for (const entry of entries) {
      result[entry.key] = entry.value;
    }
    return result;
  } catch (error) {
    logger.error(`Failed to load config for category ${category}:`, error);
    return null;
  }
}

/**
 * Get the default values for a category
 */
function getDefaultValues(category: ConfigCategory): Record<string, string> {
  switch (category) {
    case 'accessibility_labels':
      return DEFAULT_ACCESSIBILITY_LABELS;
    case 'event_type_labels':
      return DEFAULT_EVENT_TYPE_LABELS;
    case 'public_category_labels':
      return DEFAULT_PUBLIC_CATEGORY_LABELS;
    case 'registration_status_labels':
      return DEFAULT_REGISTRATION_STATUS_LABELS;
    case 'event_status_labels':
      return DEFAULT_EVENT_STATUS_LABELS;
    case 'school_grade_labels':
      return DEFAULT_SCHOOL_GRADE_LABELS;
    case 'age_range_labels':
      return DEFAULT_AGE_RANGE_LABELS;
    default:
      return {};
  }
}

/**
 * Get config values for a category (with Redis cache and fallback)
 */
export async function getConfig(category: ConfigCategory): Promise<Record<string, string>> {
  const redis = getRedisClient();
  const cacheKey = `${CACHE_PREFIX}${category}`;

  // Try Redis first if available
  if (redis && isRedisConnected()) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      logger.error(`Redis cache read error for ${category}:`, error);
    }
  }

  // Fallback to in-memory cache
  if (isMemoryCacheValid(category)) {
    return memoryCache.get(category)!.data;
  }

  // Load from database
  const dbConfig = await getConfigFromDatabase(category);
  const defaults = getDefaultValues(category);

  // Merge: database values override defaults
  const merged = { ...defaults, ...(dbConfig || {}) };

  // Store in Redis if available
  if (redis && isRedisConnected()) {
    try {
      await redis.set(cacheKey, JSON.stringify(merged), 'EX', CACHE_TTL_SECONDS);
    } catch (error) {
      logger.error(`Redis cache set error for ${category}:`, error);
    }
  }

  // Also update in-memory cache as fallback
  memoryCache.set(category, {
    data: merged,
    timestamp: Date.now(),
  });

  return merged;
}

/**
 * Get a single config value
 */
export async function getConfigValue(
  category: ConfigCategory,
  key: string,
): Promise<string | undefined> {
  const config = await getConfig(category);
  return config[key];
}

/**
 * Update a config entry (upsert)
 */
export async function setConfigValue(
  category: ConfigCategory,
  key: string,
  value: string,
): Promise<void> {
  await prisma.appConfig.upsert({
    where: {
      category_key: { category, key },
    },
    update: { value },
    create: { category, key, value },
  });

  // Invalidate cache (async - don't wait for it)
  clearConfigCache(category);
}

/**
 * Update multiple config entries at once
 */
export async function setConfigValues(
  category: ConfigCategory,
  entries: Record<string, string>,
): Promise<void> {
  const operations = Object.entries(entries).map(([key, value]) =>
    prisma.appConfig.upsert({
      where: {
        category_key: { category, key },
      },
      update: { value },
      create: { category, key, value },
    }),
  );

  await prisma.$transaction(operations);

  // Invalidate cache (async - don't wait for it)
  clearConfigCache(category);
}

/**
 * Reset a category to default values (delete all custom values)
 */
export async function resetConfigToDefaults(category: ConfigCategory): Promise<void> {
  await prisma.appConfig.deleteMany({
    where: { category },
  });

  // Invalidate cache (async - don't wait for it)
  clearConfigCache(category);
}

// ============================================================================
// Synchronous Getters (for SSR/initial render - uses cache or defaults)
// ============================================================================

/**
 * Get config synchronously (uses in-memory cache if available, otherwise defaults)
 * Useful for SSR where async is not possible
 * NOTE: This only uses in-memory cache, not Redis. For fresh data, use getConfig() instead.
 */
export function getConfigSync(category: ConfigCategory): Record<string, string> {
  const cached = memoryCache.get(category);
  if (cached) {
    return cached.data;
  }
  return getDefaultValues(category);
}

/**
 * Get a single config value synchronously
 */
export function getConfigValueSync(category: ConfigCategory, key: string): string | undefined {
  return getConfigSync(category)[key];
}

// ============================================================================
// Preload Helper (call during app initialization)
// ============================================================================

/**
 * Preload all configuration categories into cache
 * Call this during app startup to warm the cache
 */
export async function preloadAllConfigs(): Promise<void> {
  const categories: ConfigCategory[] = [
    'accessibility_labels',
    'event_type_labels',
    'public_category_labels',
    'registration_status_labels',
    'event_status_labels',
    'school_grade_labels',
    'age_range_labels',
  ];

  await Promise.all(categories.map(getConfig));
  logger.info('Configuration cache preloaded');
}
