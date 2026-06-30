import { NextRequest, NextResponse } from 'next/server';

import { createAuthMiddleware, AuthenticatedRequest } from '@/app/api/middleware';
import { getSecureCookieConfig } from '@/lib/auth/cookieConfig';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';
import {
  blacklistRefreshToken,
  getTokenExpiration,
  verifyRefreshToken,
} from '@/lib/auth/refreshTokenManager';
import { logLogout } from '@/lib/security/securityLogger';
import { deleteCSRFToken } from '@/lib/auth/csrfProtection';

// Middleware without CSRF protection for logout (CSRF not critical for logout)
const logoutMiddleware = createAuthMiddleware({
  requireAuth: false,
  requireCSRF: false, // Disable CSRF for logout to allow users to logout even with invalid CSRF
  enableRateLimit: true,
  rateLimitConfig: 'api',
});

/**
 * Logout route to clear the user's session and blacklist the refresh token.
 * @param req - NextRequest object containing the request data.
 * @returns NextResponse indicating successful logout.
 */
export async function POST(req: NextRequest) {
  // Use logoutMiddleware to handle the request
  return logoutMiddleware(req as AuthenticatedRequest, async (req: AuthenticatedRequest) => {
    // Get the refresh token from cookies
    const refreshToken = req.cookies.get('jwt')?.value;

    // If there's a refresh token, blacklist it
    if (refreshToken) {
      try {
        const decoded = verifyRefreshToken(refreshToken);
        const expiresAt = getTokenExpiration(refreshToken);

        await blacklistRefreshToken(refreshToken, decoded?.id, expiresAt || undefined);

        // Log the logout if we have a user ID
        if (decoded?.id) {
          await logLogout(decoded.id, req);
          // Clear CSRF token for the user
          await deleteCSRFToken(decoded.id);
        }
      } catch (error) {
        // Log error but don't fail the logout
        logger.error('Error blacklisting token during logout:', ...sanitizeLogArgs(error));
      }
    }

    // Also clear IP-based CSRF token
    const clientIdentifier = getClientIdentifier(req);
    await deleteCSRFToken(clientIdentifier);

    // Clear the JWT cookie to log out the user
    const res = NextResponse.json({ message: 'Déconnecté' });

    // Use secure cookie configuration to clear the cookie
    const cookieConfig = getSecureCookieConfig({
      name: 'jwt',
      value: '',
      maxAge: 0,
    });

    res.cookies.set(cookieConfig);
    return res;
  });
}

/**
 * Get a unique identifier for the client based on IP and User-Agent.
 * @param req - The incoming request.
 * @returns A unique identifier string.
 */
function getClientIdentifier(req: NextRequest): string {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  return `${ip}:${userAgent}`;
}
