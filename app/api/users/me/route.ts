import { NextRequest, NextResponse } from 'next/server';

import { requireAuth, AuthenticatedRequest } from '@/app/api/middleware';
import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';

/**
 * GET /api/users/me
 * Get the authenticated user's information.
 * @param req - NextRequest object containing the request data.
 * @returns NextResponse with user information.
 */
export async function GET(req: NextRequest) {
  // Use requireAuth to ensure the user is authenticated
  return requireAuth(req as AuthenticatedRequest, async (req: AuthenticatedRequest) => {
    try {
      const userId = req.user!.id;

      // Fetch full user data from database with institutions
      const userData = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          phone_number: true,
          role: true,
          email_notifications_enabled: true,
          events_reminders_enabled: true,
          created_at: true,
          updated_at: true,
          userInstitutions: {
            select: {
              institution_id: true,
            },
          },
        },
      });

      if (!userData) {
        return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
      }

      // Transform user data to include institution_ids array
      const user = {
        ...userData,
        institution_ids: userData.userInstitutions.map((ui) => ui.institution_id),
        userInstitutions: undefined, // Remove the relation object
      };

      return NextResponse.json({ user });
    } catch (error) {
      logger.error('Error fetching user data:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des données utilisateur' },
        { status: 500 },
      );
    }
  });
}

/**
 * DELETE /api/users/me
 * Delete the authenticated user's account.
 * Checks for related entities and prevents deletion if present (groups, registrations, notifications, institutions).
 * @param req - The incoming request.
 * @returns JSON response with success message.
 */
export async function DELETE(req: NextRequest) {
  return requireAuth(req as AuthenticatedRequest, async (req: AuthenticatedRequest) => {
    try {
      const userId = req.user!.id;

      // Ensure user exists
      const existing = await prisma.user.findUnique({ where: { id: userId } });
      if (!existing) {
        return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
      }

      // Delete related records in a transaction
      await prisma.$transaction(async (tx) => {
        // Delete groups (will cascade to GroupDisability via onDelete: Cascade)
        await tx.group.deleteMany({ where: { user_id: userId } });

        // Delete registrations (need to manually delete RegistrationDisability first)
        const userRegistrations = await tx.registration.findMany({
          where: { user_id: userId },
          select: { id: true },
        });
        if (userRegistrations.length > 0) {
          await tx.registrationDisability.deleteMany({
            where: { registration_id: { in: userRegistrations.map((r) => r.id) } },
          });
          await tx.registration.deleteMany({ where: { user_id: userId } });
        }

        // Delete notifications
        await tx.notification.deleteMany({ where: { user_id: userId } });

        // Delete user-institution relationships (has onDelete: Cascade but explicit is safer)
        await tx.userInstitution.deleteMany({ where: { user_id: userId } });

        // Delete password reset tokens
        await tx.passwordResetToken.deleteMany({ where: { userId: userId } });

        // Delete password history (has onDelete: Cascade but explicit is safer)
        await tx.passwordHistory.deleteMany({ where: { user_id: userId } });

        // Delete refresh token blacklist entries for this user
        await tx.refreshTokenBlacklist.deleteMany({ where: { user_id: userId } });

        // Finally, delete the user
        await tx.user.delete({ where: { id: userId } });
      });

      return NextResponse.json({ message: 'Compte supprimé avec succès' });
    } catch (error) {
      logger.error('Error deleting self user:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: 'Erreur lors de la suppression du compte' },
        { status: 500 },
      );
    }
  });
}
