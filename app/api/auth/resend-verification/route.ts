import { NextRequest, NextResponse } from 'next/server';

import { createAuthMiddleware, AuthenticatedRequest } from '@/app/api/middleware';

import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs, redactEmail } from '@/lib/security/logSanitization';
import {
  sendEmail,
  generateEmailVerificationToken,
  generateVerificationUrl,
} from '@/lib/notifications/emailService';

// Middleware without CSRF protection for resending verification
const resendVerificationMiddleware = createAuthMiddleware({
  requireAuth: false,
  requireCSRF: false, // Disable CSRF for resend verification
  enableRateLimit: true,
  rateLimitConfig: 'auth', // Use stricter rate limit for email sending
});

/**
 * Resend email verification route.
 * @param req - NextRequest object containing user email.
 * @returns NextResponse with resend status.
 */
export async function POST(req: NextRequest) {
  return resendVerificationMiddleware(
    req as AuthenticatedRequest,
    async (req: AuthenticatedRequest) => {
      try {
        const body = await req.json();
        const { email } = body;

        // Validate email presence
        if (!email) {
          return NextResponse.json({ error: 'Email requis' }, { status: 400 });
        }

        // Find user with this email
        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          // For security reasons, don't reveal that the email doesn't exist
          return NextResponse.json({
            message:
              'Si cet email existe dans notre système, un nouveau lien de vérification a été envoyé.',
          });
        }

        // Check if user is already verified (no verification token)
        if (!user.email_verification_token) {
          return NextResponse.json({
            message: 'Ce compte est déjà vérifié.',
          });
        }

        // Generate new verification token and expiration
        const newVerificationToken = generateEmailVerificationToken();
        const newExpirationDate = new Date();
        newExpirationDate.setHours(newExpirationDate.getHours() + 24); // 24 hours from now

        // Update user with new token
        await prisma.user.update({
          where: { id: user.id },
          data: {
            email_verification_token: newVerificationToken,
            email_verification_expires: newExpirationDate,
          },
        });

        // Send new verification email
        try {
          const verificationUrl = generateVerificationUrl(newVerificationToken);
          await sendEmail({
            to: email,
            template_id: '3666105', // Welcome / Verification Template
            template_data: {
              first_name: user.first_name,
              last_name: user.last_name,
              confirm_url: verificationUrl,
            },
          });

          logger.info(`Nouvel email de vérification envoyé à ${redactEmail(email)}`);

          return NextResponse.json({
            message: 'Un nouveau lien de vérification a été envoyé à votre adresse email.',
          });
        } catch (emailError) {
          logger.error(
            "Erreur lors de l'envoi du nouvel email de vérification:",
            ...sanitizeLogArgs(emailError),
          );
          return NextResponse.json(
            { error: "Erreur lors de l'envoi de l'email. Veuillez réessayer." },
            { status: 500 },
          );
        }
      } catch (error) {
        logger.error(
          "Erreur lors du renvoi de l'email de vérification:",
          ...sanitizeLogArgs(error),
        );
        return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
      }
    },
  );
}
