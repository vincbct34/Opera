import type { User } from '@/context/UserContext';

let accessToken: string | null = null;
let cachedUser: User | null = null;
let userCacheTimestamp: number = 0;
const USER_CACHE_DURATION = 2 * 60 * 1000; // Reduced to 2 minutes for better security

/**
 * Get the current access token from memory.
 * @returns The access token or null if not set.
 */
/**
 * Get the current access token from memory.
 * @returns The access token or null if not set.
 */
export function getAccessToken(): string | null {
  // Use only memory for access token (more secure)
  return accessToken;
}

/**
 * Set the access token in memory.
 * @param token - The access token to store.
 */
/**
 * Set the access token in memory.
 * @param token - The access token to store.
 */
export function setAccessToken(token: string): void {
  accessToken = token;
  // DO NOT store access token in localStorage for security reasons
}

/**
 * Clear the access token and cached user data.
 */
/**
 * Clear the access token and cached user data.
 */
export function clearAccessToken(): void {
  accessToken = null;
  cachedUser = null;
  userCacheTimestamp = 0;

  if (typeof window !== 'undefined') {
    // Clean up only non-sensitive data
    sessionStorage.removeItem('userCacheTimestamp');
    // Don't store cachedUser in storage to avoid data exposure
  }
}

/**
 * Get the cached user data if valid.
 * @returns The cached user object or null if expired/missing.
 */
/**
 * Get the cached user data if valid.
 * @returns The cached user object or null if expired/missing.
 */
export function getCachedUser(): User | null {
  const now = Date.now();

  // Use only in-memory cache for better security
  if (cachedUser && now - userCacheTimestamp < USER_CACHE_DURATION) {
    return cachedUser;
  }

  // Cache expired or doesn't exist
  return null;
}

/**
 * Set the cached user data.
 * @param user - The user object to cache.
 */
/**
 * Set the cached user data.
 * @param user - The user object to cache.
 */
export function setCachedUser(user: User | null): void {
  // Store only in memory to avoid exposure of sensitive data
  cachedUser = user;
  userCacheTimestamp = Date.now();

  // Optional: store only timestamp for validation
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('userCacheTimestamp', userCacheTimestamp.toString());
  }
}

/**
 * Check if there is potential cached data available.
 * @returns true if cache exists and is likely valid.
 */
export function hasPotentialCache(): boolean {
  if (cachedUser) return true;

  if (typeof window !== 'undefined') {
    const storedTimestamp = sessionStorage.getItem('userCacheTimestamp');
    if (storedTimestamp) {
      const timestamp = parseInt(storedTimestamp, 10);
      const now = Date.now();
      return now - timestamp < USER_CACHE_DURATION;
    }
  }

  return false;
}
