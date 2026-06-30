import { getAccessToken, setAccessToken, clearAccessToken } from '@/lib/auth/tokenStore';
import { logSuspiciousActivity } from '@/lib/security/securityUtils';
import { logger } from '../middleware/logger';

// Rate limiting for API requests
const apiCallTracker = new Map<string, { count: number; lastReset: number }>();
const MAX_CALLS_PER_MINUTE = 60;

// CSRF token cache
let csrfToken: string | null = null;
let csrfTokenExpiry: number = 0;
const CSRF_TOKEN_LIFETIME = 14 * 60 * 1000; // 14 minutes (less than server's 15 min)

/**
 * Check if the API rate limit has been exceeded for a given endpoint.
 * @param endpoint - The API endpoint being accessed.
 * @returns true if the request is allowed, false if rate limited.
 */
function checkApiRateLimit(endpoint: string): boolean {
  const now = Date.now();
  const key = endpoint;
  const tracker = apiCallTracker.get(key) || { count: 0, lastReset: now };

  // Reset counter if more than one minute has elapsed
  if (now - tracker.lastReset > 60000) {
    tracker.count = 0;
    tracker.lastReset = now;
  }

  tracker.count++;
  apiCallTracker.set(key, tracker);

  if (tracker.count > MAX_CALLS_PER_MINUTE) {
    logSuspiciousActivity('Rate limit dépassé', { endpoint, count: tracker.count });
    return false;
  }

  return true;
}

/**
 * Fetch and cache CSRF token
 */
export async function getCSRFToken(): Promise<string | null> {
  // Return cached token if still valid
  if (csrfToken && Date.now() < csrfTokenExpiry) {
    return csrfToken;
  }

  try {
    const response = await fetch('/api/auth/csrf', {
      headers: {
        Authorization: getAccessToken() ? `Bearer ${getAccessToken()}` : '',
      },
    });

    if (response.ok) {
      const { csrfToken: newToken } = await response.json();
      csrfToken = newToken;
      csrfTokenExpiry = Date.now() + CSRF_TOKEN_LIFETIME;
      return csrfToken;
    }
  } catch (error) {
    logger.error('Failed to fetch CSRF token:', error);
  }

  return null;
}

/**
 * Clear cached CSRF token (e.g., on logout)
 */
export function clearCSRFToken(): void {
  csrfToken = null;
  csrfTokenExpiry = 0;
}

/**
 * Set CSRF token directly (e.g., from login/refresh response)
 */
export function setCSRFToken(token: string): void {
  csrfToken = token;
  csrfTokenExpiry = Date.now() + CSRF_TOKEN_LIFETIME;
}

/**
 * Extract and cache CSRF token from response headers
 */
function extractCSRFTokenFromResponse(response: Response): void {
  // Guard against responses without headers (e.g., mocked responses in tests)
  if (!response.headers || typeof response.headers.get !== 'function') {
    return;
  }

  const token = response.headers.get('X-CSRF-Token');
  if (token) {
    setCSRFToken(token);
  }
}

/**
 * Extended fetch options that include contentType override
 */
export interface FetchWithAuthInit extends RequestInit {
  /**
   * Override the default Content-Type header behavior.
   * - undefined: Use default behavior (application/json for POST)
   * - null: Don't set Content-Type (useful for FormData)
   * - string: Use the specified Content-Type
   */
  _contentType?: string | null;
}

/**
 * Centralized fetch wrapper that handles authentication and security.
 * - Attaches access token if available.
 * - Transparently refreshes token on 401 Unauthorized.
 * - Retries original request once after refresh.
 * - Handles CSRF tokens for state-changing methods.
 * - Enforces client-side rate limiting.
 *
 * @param input - The resource URL or Request object.
 * @param init - The fetch options.
 * @returns The fetch Response.
 * @throws Error if rate limit is exceeded.
 */
export async function fetchWithAuth(
  input: RequestInfo | URL,
  init: FetchWithAuthInit = {},
): Promise<Response> {
  // Extract endpoint for rate limiting
  const endpoint = typeof input === 'string' ? input : input.toString();

  // Check rate limiting
  if (!checkApiRateLimit(endpoint)) {
    throw new Error('Trop de requêtes. Veuillez patienter.');
  }

  // Extract the custom contentType option before spreading init
  const { _contentType, ...standardInit } = init;

  // Clone headers so we can modify safely
  const headers = new Headers(standardInit.headers || {});

  // Add security headers - handle custom contentType option
  if (_contentType === null) {
    // Explicitly don't set Content-Type (for FormData uploads)
    // Browser will set it with the correct boundary
  } else if (_contentType !== undefined) {
    // Use custom Content-Type
    headers.set('Content-Type', _contentType);
  } else if (!headers.has('Content-Type') && standardInit.method === 'POST') {
    // Default behavior
    headers.set('Content-Type', 'application/json');
  }

  // Add header to identify authenticated requests
  headers.set('X-Requested-With', 'XMLHttpRequest');

  // One-time migration from localStorage to in-memory (to reduce XSS surface)
  if (typeof window !== 'undefined') {
    const existing = getAccessToken();
    if (!existing) {
      const legacy = localStorage.getItem('accessToken');
      if (legacy) {
        setAccessToken(legacy);
        // Clear legacy storage now that it's in memory
        localStorage.removeItem('accessToken');
        logSuspiciousActivity('Migration token depuis localStorage', { endpoint });
      }
    }
  }

  // Attach Authorization header if not already set and token exists
  const token = getAccessToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Attach CSRF token for state-changing methods
  const method = standardInit.method?.toUpperCase() || 'GET';
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrf = await getCSRFToken();
    if (csrf) {
      headers.set('X-CSRF-Token', csrf);
    }
  }

  let response = await fetch(input, { ...standardInit, headers });

  // Extract CSRF token from response headers if present
  extractCSRFTokenFromResponse(response);

  // If CSRF token is invalid, try to regenerate and retry once
  if (response.status === 403) {
    try {
      // Clone the response to read the body without consuming it
      const clonedResponse = response.clone();
      const data = await clonedResponse.json().catch(() => ({}));
      if (data.code === 'CSRF_TOKEN_INVALID') {
        // Clear cached CSRF token and regenerate
        clearCSRFToken();
        const newCsrf = await getCSRFToken();

        if (newCsrf) {
          const retryHeaders = new Headers(standardInit.headers || {});
          if (token) {
            retryHeaders.set('Authorization', `Bearer ${token}`);
          }
          retryHeaders.set('X-CSRF-Token', newCsrf);
          retryHeaders.set('X-Requested-With', 'XMLHttpRequest');
          // Handle _contentType option
          if (_contentType === null) {
            // Don't set Content-Type
          } else if (_contentType !== undefined) {
            retryHeaders.set('Content-Type', _contentType);
          } else if (!retryHeaders.has('Content-Type') && standardInit.method === 'POST') {
            retryHeaders.set('Content-Type', 'application/json');
          }

          // Retry the request with new CSRF token
          response = await fetch(input, { ...standardInit, headers: retryHeaders });
          // Extract CSRF token from retry response as well
          extractCSRFTokenFromResponse(response);
          return response;
        }
      }
    } catch {
      // If parsing fails, return original response (not cloned)
    }
  }

  // If unauthorized, try to refresh the token once
  if (response.status === 401) {
    try {
      const refreshRes = await fetch('/api/auth/refresh', { method: 'POST' });
      if (refreshRes.ok) {
        const { accessToken: newToken, csrfToken: newCsrf } = await refreshRes.json();
        if (newToken) {
          setAccessToken(newToken);

          // Extract CSRF token from refresh response
          extractCSRFTokenFromResponse(refreshRes);

          // If CSRF token is in the response body, use it
          if (newCsrf) {
            setCSRFToken(newCsrf);
          }

          // Retry original request with new token
          const retryHeaders = new Headers(standardInit.headers || {});
          retryHeaders.set('Authorization', `Bearer ${newToken}`);

          // For state-changing methods, use the new CSRF token
          if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
            const csrf = newCsrf || csrfToken;
            if (csrf) {
              retryHeaders.set('X-CSRF-Token', csrf);
            }
          }

          // Handle _contentType option
          if (_contentType === null) {
            // Don't set Content-Type
          } else if (_contentType !== undefined) {
            retryHeaders.set('Content-Type', _contentType);
          } else if (!retryHeaders.has('Content-Type') && standardInit.method === 'POST') {
            retryHeaders.set('Content-Type', 'application/json');
          }

          response = await fetch(input, { ...standardInit, headers: retryHeaders });
          // Extract CSRF token from retry response
          extractCSRFTokenFromResponse(response);
          return response;
        }
      }
      // Refresh failed: clear token for safety
      clearAccessToken();
    } catch {
      // Network/other error during refresh: clear token
      clearAccessToken();
    }
  }

  return response;
}

/** Helper to fetch JSON conveniently with auth */
export async function fetchJsonWithAuth<T = unknown>(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<{ data: T | null; response: Response }> {
  const res = await fetchWithAuth(input, init);
  try {
    const data = (await res.json()) as T;
    return { data, response: res };
  } catch {
    return { data: null, response: res };
  }
}
