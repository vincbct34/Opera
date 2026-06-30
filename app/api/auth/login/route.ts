import { NextRequest, NextResponse } from 'next/server';

import { createAuthMiddleware, AuthenticatedRequest } from '@/app/api/middleware';

import prisma from '@/lib/middleware/prismaConfig';
import {
  checkRateLimit,
  getClientIdentifier as getRateLimitClientId,
  RATE_LIMIT_CONFIGS,
  resetRateLimit,
} from '@/lib/middleware/serverRateLimit';
import { getSecureCookieConfig } from '@/lib/auth/cookieConfig';
import { LoginSchema } from '@/lib/validation/validationSchemas';
import {
  logLoginSuccess,
  logLoginFailed,
  logRateLimitExceeded,
} from '@/lib/security/securityLogger';
import { generateRefreshToken } from '@/lib/auth/refreshTokenManager';
import { generateCSRFToken } from '@/lib/auth/csrfProtection';
import { isAccountLocked, recordFailedLogin, resetFailedAttempts } from '@/lib/auth/accountLockout';

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { z } from 'zod';
// Read JWT secrets directly from environment

// Middleware without CSRF protection for login (CSRF not needed for login)
const loginMiddleware = createAuthMiddleware({
  requireAuth: false,
  requireCSRF: false, // Disable CSRF for login
  enableRateLimit: false, // Rate limiting handled manually below
});

/**
 * Login route for user authentication.
 * @param req - NextRequest object containing the request data.
 * @returns NextResponse with access token and user information or error message.
 */
export async function POST(req: NextRequest) {
  // Use loginMiddleware to handle the request
  return loginMiddleware(req as AuthenticatedRequest, async (req: AuthenticatedRequest) => {
    // Rate limiting - check before processing
    const clientId = getRateLimitClientId(req);
    const rateLimitResult = await checkRateLimit(clientId, RATE_LIMIT_CONFIGS.auth);

    if (!rateLimitResult.success) {
      // Log rate limit exceeded
      await logRateLimitExceeded(req, clientId);

      const resetDate = new Date(rateLimitResult.resetAt).toLocaleTimeString('fr-FR');
      return NextResponse.json(
        {
          error: 'Trop de tentatives de connexion. Veuillez réessayer plus tard.',
          resetAt: resetDate,
          blockedUntil: rateLimitResult.blockedUntil,
        },
        { status: 429 },
      );
    }

    // Validate and parse request body with Zod
    let email: string;
    let password: string;

    try {
      const body = await req.json();
      const validatedData = LoginSchema.parse(body);
      email = validatedData.email;
      password = validatedData.password;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Données invalides',
            details: error.issues.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: 'Erreur lors de la validation des données' },
        { status: 400 },
      );
    }

    // Find the user by email with institutions
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        userInstitutions: {
          select: {
            institution_id: true,
          },
        },
      },
    });

    // If user not found, return generic error to prevent enumeration
    // Note: We intentionally check this before account lockout to avoid leaking user existence
    if (!user) {
      await logLoginFailed(email, req, 'User not found');
      return NextResponse.json({ error: 'Email ou mot de passe incorrect' }, { status: 401 });
    }

    // Check if account is locked due to too many failed attempts
    const lockStatus = await isAccountLocked(user.id);
    if (lockStatus.locked && lockStatus.lockedUntil) {
      const unlockTime = lockStatus.lockedUntil.toLocaleString('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short',
      });

      await logLoginFailed(email, req, 'Account locked');

      return NextResponse.json(
        {
          error: `Votre compte est temporairement verrouillé en raison de trop nombreuses tentatives de connexion. Réessayez après ${unlockTime}.`,
          code: 'ACCOUNT_LOCKED',
          lockedUntil: lockStatus.lockedUntil,
        },
        { status: 403 },
      );
    }

    // Compare the provided password with the stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);

    // If password does not match, record failed attempt and return generic error
    if (!isMatch) {
      // Record failed login attempt (may lock account if threshold exceeded)
      const lockResult = await recordFailedLogin(user.id);

      await logLoginFailed(email, req, 'Password mismatch');

      // If account was just locked, return specific message
      if (lockResult.locked && lockResult.lockedUntil) {
        const unlockTime = lockResult.lockedUntil.toLocaleString('fr-FR', {
          dateStyle: 'short',
          timeStyle: 'short',
        });

        return NextResponse.json(
          {
            error: `Trop de tentatives de connexion échouées. Votre compte est verrouillé jusqu'à ${unlockTime}.`,
            code: 'ACCOUNT_LOCKED',
            lockedUntil: lockResult.lockedUntil,
          },
          { status: 403 },
        );
      }

      // Return generic error with attempts remaining hint
      const attemptsMsg =
        lockResult.attemptsRemaining > 0
          ? ` (${lockResult.attemptsRemaining} tentatives restantes)`
          : '';

      return NextResponse.json(
        {
          error: `Email ou mot de passe incorrect${attemptsMsg}`,
          attemptsRemaining: lockResult.attemptsRemaining,
        },
        { status: 401 },
      );
    }

    // Check if user's email is verified (no verification token means verified)
    if (user.email_verification_token) {
      return NextResponse.json(
        {
          error: 'Veuillez vérifier votre adresse email avant de vous connecter',
          code: 'EMAIL_NOT_VERIFIED',
          email: user.email,
        },
        { status: 403 },
      );
    }

    // Extract institution IDs
    const institution_ids = user.userInstitutions.map(
      (ui: { institution_id: string }) => ui.institution_id,
    );

    // Update last activity timestamp on successful login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActivity: new Date() },
    });

    // Get JWT secrets from environment variables
    const accessSecret = process.env.ACCESS_TOKEN_SECRET || '';

    // If authentication is successful, create JWT tokens
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

    // Create a refresh token using the secure refresh token manager
    const { token: refreshToken } = generateRefreshToken(user.id);

    // Generate a new CSRF token for the authenticated user
    // This prevents race conditions by providing the token immediately
    const csrfToken = await generateCSRFToken(user.id);

    // Set the refresh token in cookies and return the access token and user info
    const res = NextResponse.json({
      accessToken,
      csrfToken, // Include CSRF token in response body
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        institution_ids,
      },
    });

    // Set the CSRF token in response header for automatic extraction by client
    res.headers.set('X-CSRF-Token', csrfToken);

    // Set the refresh token as an HTTP-only secure cookie (7 days, aligned with JWT exp)
    const cookieConfig = getSecureCookieConfig({
      name: 'jwt',
      value: refreshToken,
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 jours
    });

    res.cookies.set(cookieConfig);

    // Reset rate limit on successful login
    await resetRateLimit(clientId);

    // Reset failed login attempts on successful login
    await resetFailedAttempts(user.id);

    // Log successful login
    await logLoginSuccess(user.id, req);

    // Note: We no longer delete the old CSRF token to prevent race conditions
    // Old tokens will expire naturally via Redis TTL (15 minutes)

    return res;
  });
}
