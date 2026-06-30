import { NextRequest, NextResponse } from 'next/server';

import { createAuthMiddleware, AuthenticatedRequest } from '@/app/api/middleware';

import prisma from '@/lib/middleware/prismaConfig';
import { sendEmail } from '@/lib/notifications/emailService';

import { logger } from '@/lib/middleware/logger';
import { getServerBaseUrl } from '@/lib/utils/getBaseUrl';

// Middleware without CSRF protection for email verification (GET-like operation via POST)
const verifyEmailMiddleware = createAuthMiddleware({
  requireAuth: false,
  requireCSRF: false, // Disable CSRF for email verification
  enableRateLimit: true,
  rateLimitConfig: 'api',
});

/**
 * Verify email route for activating user accounts.
 * @param req - NextRequest object containing the verification token.
 * @returns NextResponse with verification status.
 */
export async function POST(req: NextRequest) {
  return verifyEmailMiddleware(req as AuthenticatedRequest, async (req: AuthenticatedRequest) => {
    try {
      const body = await req.json();
      const { token } = body;

      // Validate token presence
      if (!token) {
        return NextResponse.json({ error: 'Token de vérification requis' }, { status: 400 });
      }

      // Find user with the verification token
      const user = await prisma.user.findFirst({
        where: {
          email_verification_token: token,
        },
      });

      if (!user) {
        return NextResponse.json({ error: 'Token de vérification invalide' }, { status: 400 });
      }

      // Check if token has expired
      if (user.email_verification_expires && user.email_verification_expires < new Date()) {
        return NextResponse.json({ error: 'Le lien de vérification a expiré' }, { status: 400 });
      }

      // Update user to mark email as verified
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          email_verification_token: null,
          email_verification_expires: null,
          // If there's a pending email, update the main email
          ...(user.pending_email && {
            email: user.pending_email,
            pending_email: null,
          }),
        },
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          role: true,
        },
      });

      // Send confirmation email
      try {
        await sendEmail({
          to: updatedUser.email,
          template_id: '7909341',
          template_data: {
            first_name: updatedUser.first_name,
            last_name: updatedUser.last_name,
            login_url: `${getServerBaseUrl()}/auth/login`,
            account_url: `${getServerBaseUrl()}/account`,
            unsubscribe_url: `${getServerBaseUrl()}/account`,
          },
        });

        logger.info(`Email de confirmation envoyé à ${updatedUser.email}`);
      } catch (emailError) {
        logger.error("Erreur lors de l'envoi de l'email de confirmation:", emailError);
        // Continue even if confirmation email fails
      }

      return NextResponse.json({
        message: 'Email vérifié avec succès',
        user: updatedUser,
      });
    } catch (error) {
      logger.error("Erreur lors de la vérification de l'email:", error);
      return NextResponse.json(
        { error: 'Erreur interne lors de la vérification' },
        { status: 500 },
      );
    }
  });
}

/**
 * GET method to verify email via URL parameter (for email links).
 * @param req - The incoming request.
 * @returns Redirect to success or error page.
 */
export async function GET(req: NextRequest) {
  return verifyEmailMiddleware(req as AuthenticatedRequest, async (req: AuthenticatedRequest) => {
    try {
      const { searchParams } = new URL(req.url);
      const token = searchParams.get('token');

      // Validate token presence
      if (!token) {
        return NextResponse.redirect(new URL('/auth/verify-email?error=missing_token', req.url));
      }

      // Find user with the verification token
      const user = await prisma.user.findFirst({
        where: {
          email_verification_token: token,
        },
      });

      if (!user) {
        return NextResponse.redirect(new URL('/auth/verify-email?error=invalid_token', req.url));
      }

      // Check if token has expired
      if (user.email_verification_expires && user.email_verification_expires < new Date()) {
        return NextResponse.redirect(new URL('/auth/verify-email?error=expired_token', req.url));
      }

      // Update user to mark email as verified
      await prisma.user.update({
        where: { id: user.id },
        data: {
          email_verification_token: null,
          email_verification_expires: null,
          // If there's a pending email, update the main email
          ...(user.pending_email && {
            email: user.pending_email,
            pending_email: null,
          }),
        },
      });

      // Send confirmation email
      try {
        await sendEmail({
          to: user.pending_email || user.email,
          template_id: '7909341',
          template_data: {
            first_name: user.first_name,
            last_name: user.last_name,
            account_url: `${getServerBaseUrl()}/account`,
            unsubscribe_url: `${getServerBaseUrl()}/account`,
          },
        });

        logger.info(`Email de confirmation envoyé à ${user.pending_email || user.email}`);
      } catch (emailError) {
        logger.error("Erreur lors de l'envoi de l'email de confirmation:", emailError);
      }

      // Redirect to success page
      return NextResponse.redirect(new URL('/auth/verify-email?success=true', req.url));
    } catch (error) {
      logger.error("Erreur lors de la vérification de l'email:", error);
      return NextResponse.redirect(new URL('/auth/verify-email?error=server_error', req.url));
    }
  });
}
