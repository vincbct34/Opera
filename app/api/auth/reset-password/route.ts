import { NextRequest, NextResponse } from 'next/server';
import { createAuthMiddleware, AuthenticatedRequest } from '@/app/api/middleware';
import prisma from '@/lib/middleware/prismaConfig';
import { sendPasswordResetEmail } from '@/lib/notifications/emailService';
import { randomBytes } from 'crypto';
import { ResetPasswordRequestSchema } from '@/lib/validation/validationSchemas';
import { logPasswordResetRequest } from '@/lib/security/securityLogger';
import { z } from 'zod';

// Middleware without CSRF protection for password reset request
const resetPasswordMiddleware = createAuthMiddleware({
  requireAuth: false,
  requireCSRF: false, // Disable CSRF for password reset request
  enableRateLimit: true,
  rateLimitConfig: 'auth', // Use stricter rate limit for password reset
});

/**
 * Request password reset.
 * @param req - The incoming request containing email.
 * @returns JSON response indicating that an email has been sent (if account exists).
 */
export async function POST(req: NextRequest) {
  return resetPasswordMiddleware(req as AuthenticatedRequest, async (req: AuthenticatedRequest) => {
    // Validate request body
    let email: string;

    try {
      const body = await req.json();
      const validatedData = ResetPasswordRequestSchema.parse(body);
      email = validatedData.email;
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

    // Log password reset request
    await logPasswordResetRequest(email, req);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // To avoid enumeration, always return success
      return NextResponse.json({ message: 'Si un compte existe, un email a été envoyé.' });
    }

    // Generate unique token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1h

    // Supprimer les anciens tokens
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    // Create new token
    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    // Generate reset URL
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/auth/reset-password/new-password?token=${token}`;

    // Envoyer l'email
    await sendPasswordResetEmail(user.email, resetUrl);

    return NextResponse.json({ message: 'Si un compte existe, un email a été envoyé.' });
  });
}
