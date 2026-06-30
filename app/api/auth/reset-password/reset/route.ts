import { NextRequest, NextResponse } from 'next/server';
import { createAuthMiddleware, AuthenticatedRequest } from '@/app/api/middleware';
import prisma from '@/lib/middleware/prismaConfig';
import { ResetPasswordSchema } from '@/lib/validation/validationSchemas';
import { resetPasswordWithHistory } from '@/lib/auth/passwordHistory';
import { logPasswordResetSuccess } from '@/lib/security/securityLogger';
import { z } from 'zod';

// Middleware without CSRF protection for password reset execution
const executeResetMiddleware = createAuthMiddleware({
  requireAuth: false,
  requireCSRF: false, // Disable CSRF for password reset execution (token-based)
  enableRateLimit: true,
  rateLimitConfig: 'auth',
});

/**
 * Execute password reset.
 * @param req - The incoming request containing token and new password.
 * @returns JSON response indicating success or failure.
 */
export async function POST(req: NextRequest) {
  return executeResetMiddleware(req as AuthenticatedRequest, async (req: AuthenticatedRequest) => {
    // Validate request body
    let token: string;
    let password: string;

    try {
      const body = await req.json();
      const validatedData = ResetPasswordSchema.parse(body);
      token = validatedData.token;
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

    // Chercher le token
    const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!resetToken || resetToken.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Token invalide ou expiré.' }, { status: 400 });
    }

    // Use the password history service to reset password
    const result = await resetPasswordWithHistory(resetToken.userId, password);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Mark email as verified (password reset proves email ownership)
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: {
        email_verification_token: null,
        email_verification_expires: null,
      },
    });

    // Delete used token
    await prisma.passwordResetToken.delete({ where: { token } });

    // Log the password reset
    await logPasswordResetSuccess(resetToken.userId, req);

    return NextResponse.json({ message: 'Mot de passe réinitialisé avec succès.' });
  });
}
