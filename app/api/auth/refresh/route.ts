import { NextRequest, NextResponse } from 'next/server';

import { createAuthMiddleware, AuthenticatedRequest } from '@/app/api/middleware';

import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';
import {
  isTokenBlacklisted,
  blacklistRefreshToken,
  generateRefreshToken,
  verifyRefreshToken,
  getTokenExpiration,
} from '@/lib/auth/refreshTokenManager';
import { getSecureCookieConfig } from '@/lib/auth/cookieConfig';
import { generateCSRFToken } from '@/lib/auth/csrfProtection';

import jwt from 'jsonwebtoken';
// Read JWT secrets directly from environment

// Middleware without CSRF protection for refresh (CSRF not needed for refresh)
const refreshMiddleware = createAuthMiddleware({
  requireAuth: false,
  requireCSRF: false, // Disable CSRF for refresh
  enableRateLimit: true,
  rateLimitConfig: 'api',
});

/**
 * Refresh route to generate a new access token using the refresh token.
 * Implements refresh token rotation for enhanced security.
 * @param req - NextRequest object containing the request data.
 * @returns NextResponse with a new access token or error message.
 */
export async function POST(req: NextRequest) {
  // Use refreshMiddleware to handle the request
  return refreshMiddleware(req as AuthenticatedRequest, async (req: AuthenticatedRequest) => {
    const oldRefreshToken = req.cookies.get('jwt')?.value; // Get the refresh token from cookies

    // Check if refresh token is provided
    if (!oldRefreshToken) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    try {
      // Check if token is blacklisted
      const isBlacklisted = await isTokenBlacklisted(oldRefreshToken);
      if (isBlacklisted) {
        return NextResponse.json(
          { error: 'Token révoqué. Veuillez vous reconnecter.' },
          { status: 403 },
        );
      }

      // Verify the refresh token
      const decoded = verifyRefreshToken(oldRefreshToken);
      if (!decoded) {
        return NextResponse.json({ error: 'Token invalide ou expiré' }, { status: 403 });
      }

      // Find the user by ID from the decoded token with institutions
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        include: {
          userInstitutions: {
            select: {
              institution_id: true,
            },
          },
        },
      });

      // If user not found, return error
      if (!user) {
        return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
      }

      // Extract institution IDs
      const institution_ids = user.userInstitutions.map(
        (ui: { institution_id: string }) => ui.institution_id,
      );

      // Get JWT secrets from environment variables
      const accessSecret = process.env.ACCESS_TOKEN_SECRET || '';

      // Create a new access token (15 minutes)
      const accessToken = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          institution_ids,
        },
        accessSecret,
        { expiresIn: '15m' },
      );

      // REFRESH TOKEN ROTATION: Generate a new refresh token
      const { token: newRefreshToken } = generateRefreshToken(user.id);

      // Blacklist the old refresh token
      const oldTokenExpiration = getTokenExpiration(oldRefreshToken);
      await blacklistRefreshToken(oldRefreshToken, user.id, oldTokenExpiration || undefined);

      // Generate a new CSRF token for the authenticated user
      // This prevents race conditions by providing the token immediately
      const csrfToken = await generateCSRFToken(user.id);

      // Prepare response with new access token and CSRF token
      const res = NextResponse.json({
        accessToken,
        csrfToken, // Include CSRF token in response body
      });

      // Set the CSRF token in response header for automatic extraction by client
      res.headers.set('X-CSRF-Token', csrfToken);

      // Set the new refresh token as an HTTP-only secure cookie
      const cookieConfig = getSecureCookieConfig({
        name: 'jwt',
        value: newRefreshToken,
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });

      res.cookies.set(cookieConfig);

      // Note: We no longer delete the old CSRF token to prevent race conditions
      // Old tokens will expire naturally via Redis TTL (15 minutes)

      // Return the new access token
      return res;
    } catch (error) {
      logger.error('Refresh token error:', ...sanitizeLogArgs(error));
      // If token verification fails, return error
      return NextResponse.json({ error: 'Token invalide ou expiré' }, { status: 403 });
    }
  });
}
