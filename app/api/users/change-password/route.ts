import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/app/api/middleware';
import { ChangePasswordSchema } from '@/lib/validation/validationSchemas';
import { changePasswordWithHistory } from '@/lib/auth/passwordHistory';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';
import { logPasswordChange, logSecurityEvent } from '@/lib/security/securityLogger';
import { SecurityLogType, SecuritySeverity } from '@/app/generated/prisma/enums';

/**
 * POST /api/users/change-password
 * Change password endpoint - User can change their own password.
 * Requires: current password, new password, confirmation.
 * @param req - The incoming request containing password data.
 * @returns JSON response with success message.
 */
export async function POST(req: NextRequest) {
  return requireAuth(req as AuthenticatedRequest, async (authReq: AuthenticatedRequest) => {
    try {
      const body = await req.json().catch(() => ({}));

      // Validate input
      const validation = ChangePasswordSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          {
            error: 'Données invalides',
            details: validation.error.flatten().fieldErrors,
          },
          { status: 400 },
        );
      }

      const { currentPassword, newPassword } = validation.data;

      // Check that new password is different from current
      if (currentPassword === newPassword) {
        return NextResponse.json(
          { error: "Le nouveau mot de passe doit être différent de l'ancien" },
          { status: 400 },
        );
      }

      // Ensure user is defined
      if (!authReq.user) {
        return NextResponse.json({ error: 'Utilisateur non authentifié' }, { status: 401 });
      }

      // Change password with history validation
      const result = await changePasswordWithHistory(authReq.user.id, currentPassword, newPassword);

      if (!result.success) {
        // Log failed attempt
        await logSecurityEvent({
          type: SecurityLogType.PASSWORD_CHANGE,
          userId: authReq.user.id,
          ipAddress:
            req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
          userAgent: req.headers.get('user-agent') || 'unknown',
          endpoint: '/api/users/change-password',
          method: 'POST',
          severity: SecuritySeverity.WARNING,
          details: { success: false, reason: result.error },
        });

        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      // Log successful password change
      await logPasswordChange(authReq.user.id, req);

      return NextResponse.json({
        message: 'Mot de passe changé avec succès',
      });
    } catch (error) {
      logger.error('Error changing password:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: 'Erreur lors du changement de mot de passe' },
        { status: 500 },
      );
    }
  });
}
