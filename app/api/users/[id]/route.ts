import { NextRequest, NextResponse } from 'next/server';
import { Role } from '@/app/generated/prisma';
import { requireAdminOrSameUser, requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';
import { logAdminAccess, logDataModification } from '@/lib/security/securityLogger';

/**
 * GET /api/users/[id]
 * Get user information by ID.
 * Access: Admin or the user themselves.
 * @param req - The incoming request.
 * @param context - The route context containing the user ID.
 * @returns JSON response with user details.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return requireAdminOrSameUser(req as AuthenticatedRequest, async (authReq) => {
    try {
      const { id } = await context.params;

      // Log admin access if admin is viewing another user
      if (authReq.user && authReq.user.role !== 'USER' && authReq.user.id !== id) {
        await logAdminAccess(authReq.user.id, req, `View user details: ${id}`);
      }

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          phone_number: true,
          role: true,
          email_notifications_enabled: true,
          events_reminders_enabled: true,
          groups: {
            select: {
              id: true,
              name: true,
              category: true,
              grades: true,
              age_ranges: true,
              students_count: true,
              updated_at: true,
              disabilities: {
                select: {
                  id: true,
                  type: true,
                  count: true,
                  details: true,
                },
              },
            },
          },
          userInstitutions: {
            select: {
              institution: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          // Include registrations with event and disabilities so clients can render details
          registrations: {
            select: {
              id: true,
              event_id: true,
              event: true,
              date: true,
              booked_seats: true,
              status: true,
              category: true,
              grades: true,
              age_ranges: true,
              manager_first_name: true,
              manager_last_name: true,
              manager_email: true,
              disabilities: {
                select: {
                  id: true,
                  type: true,
                  count: true,
                  details: true,
                },
              },
            },
          },
          created_at: true,
          updated_at: true,
        },
      });

      if (!user) {
        return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
      }

      return NextResponse.json({ user });
    } catch (error) {
      logger.error('Error fetching user:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: "Erreur lors de la récupération de l'utilisateur" },
        { status: 500 },
      );
    }
  });
}

/**
 * PATCH /api/users/[id]
 * Update user information (self-service or admin).
 * Modifiable fields: first_name, last_name, phone_number, email_notifications_enabled, events_reminders_enabled, institution_ids.
 * Admin/Superadmin can also modify: role.
 * @param req - The incoming request.
 * @param context - The route context containing the user ID.
 * @returns JSON response with updated user details.
 */
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return requireAdminOrSameUser(req as AuthenticatedRequest, async (authReq) => {
    try {
      const { id } = await context.params;
      const body = await req.json().catch(() => ({}));

      // Build allowed update object depending on role
      const isSuperAdmin = authReq.user && authReq.user.role === 'SUPERADMIN';
      const data: {
        first_name?: string;
        last_name?: string;
        phone_number?: string;
        email_notifications_enabled?: boolean;
        events_reminders_enabled?: boolean;
        role?: Role;
      } = {};
      if (typeof body.first_name === 'string') data.first_name = body.first_name.trim();
      if (typeof body.last_name === 'string') data.last_name = body.last_name.trim();
      if (typeof body.phone_number === 'string') data.phone_number = body.phone_number.trim();
      if (typeof body.email_notifications_enabled === 'boolean')
        data.email_notifications_enabled = body.email_notifications_enabled;
      if (typeof body.events_reminders_enabled === 'boolean')
        data.events_reminders_enabled = body.events_reminders_enabled;

      // If role is provided but requester isn't SUPERADMIN => forbid explicitly
      if (typeof body.role !== 'undefined') {
        if (!isSuperAdmin) {
          return NextResponse.json(
            { error: 'Permission refusée pour modifier le rôle' },
            { status: 403 },
          );
        }
        // Validate that provided role is one of the enum values
        const allowedRoles = Object.values(Role) as string[];
        if (typeof body.role !== 'string' || !allowedRoles.includes(body.role)) {
          return NextResponse.json({ error: 'Valeur de rôle invalide' }, { status: 400 });
        }
        data.role = body.role as Role;
      }

      // Handle institution_ids update separately (admin or self-service)
      let updateInstitutions = false;
      let institution_ids: string[] = [];
      if (Array.isArray(body.institution_ids)) {
        updateInstitutions = true;
        institution_ids = body.institution_ids;
      }

      if (Object.keys(data).length === 0 && !updateInstitutions) {
        return NextResponse.json({ error: 'Aucun champ valide à mettre à jour' }, { status: 400 });
      }

      // Update user and institutions in a transaction
      const updated = await prisma.$transaction(async (tx) => {
        // Update user data
        const user = await tx.user.update({
          where: { id },
          data,
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            phone_number: true,
            role: true,
            email_notifications_enabled: true,
            events_reminders_enabled: true,
            groups: {
              select: {
                id: true,
                name: true,
                category: true,
                grades: true,
                age_ranges: true,
                students_count: true,
                updated_at: true,
                disabilities: {
                  select: {
                    id: true,
                    type: true,
                    count: true,
                    details: true,
                  },
                },
              },
            },
            userInstitutions: {
              select: {
                institution: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            registrations: {
              select: {
                id: true,
                event_id: true,
                event: true,
                date: true,
                booked_seats: true,
                status: true,
                category: true,
                grades: true,
                age_ranges: true,
                manager_first_name: true,
                manager_last_name: true,
                manager_email: true,
                disabilities: {
                  select: {
                    id: true,
                    type: true,
                    count: true,
                    details: true,
                  },
                },
              },
            },
            created_at: true,
            updated_at: true,
          },
        });

        // Update institutions if needed
        if (updateInstitutions) {
          // Delete existing associations
          await tx.userInstitution.deleteMany({
            where: { user_id: id },
          });

          // Create new associations
          if (institution_ids.length > 0) {
            await tx.userInstitution.createMany({
              data: institution_ids.map((institution_id) => ({
                user_id: id,
                institution_id,
              })),
            });
          }

          // Refetch user with updated institutions
          return await tx.user.findUnique({
            where: { id },
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
              phone_number: true,
              role: true,
              email_notifications_enabled: true,
              events_reminders_enabled: true,
              groups: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                  grades: true,
                  age_ranges: true,
                  students_count: true,
                  updated_at: true,
                  disabilities: {
                    select: {
                      id: true,
                      type: true,
                      count: true,
                      details: true,
                    },
                  },
                },
              },
              userInstitutions: {
                select: {
                  institution: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
              registrations: {
                select: {
                  id: true,
                  event_id: true,
                  event: true,
                  date: true,
                  booked_seats: true,
                  status: true,
                  category: true,
                  grades: true,
                  age_ranges: true,
                  manager_first_name: true,
                  manager_last_name: true,
                  manager_email: true,
                  disabilities: {
                    select: {
                      id: true,
                      type: true,
                      count: true,
                      details: true,
                    },
                  },
                },
              },
              created_at: true,
              updated_at: true,
            },
          });
        }

        return user;
      });

      // Log data modification
      if (authReq.user) {
        await logDataModification(authReq.user.id, req, 'User', id, 'update');
      }

      return NextResponse.json({ user: updated });
    } catch (error: unknown) {
      logger.error('Error updating user:', ...sanitizeLogArgs(error));
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
        return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 });
    }
  });
}

/**
 * DELETE /api/users/[id]
 * Delete a user by ID (admin only).
 * @param req - The incoming request.
 * @param context - The route context containing the user ID.
 * @returns JSON response with success message.
 */
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return requireAdmin(req as AuthenticatedRequest, async (authReq) => {
    try {
      const { id } = await context.params;

      // Ensure user exists
      const existing = await prisma.user.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
      }

      // Delete related records in a transaction to avoid orphaned data
      await prisma.$transaction(async (tx) => {
        // Delete groups (will cascade to GroupDisability via onDelete: Cascade)
        await tx.group.deleteMany({ where: { user_id: id } });

        // Delete registrations (need to manually delete RegistrationDisability first)
        const userRegistrations = await tx.registration.findMany({
          where: { user_id: id },
          select: { id: true },
        });
        if (userRegistrations.length > 0) {
          await tx.registrationDisability.deleteMany({
            where: { registration_id: { in: userRegistrations.map((r) => r.id) } },
          });
          await tx.registration.deleteMany({ where: { user_id: id } });
        }

        // Delete notifications
        await tx.notification.deleteMany({ where: { user_id: id } });

        // Delete user-institution relationships (has onDelete: Cascade but explicit is safer)
        await tx.userInstitution.deleteMany({ where: { user_id: id } });

        // Delete password reset tokens
        await tx.passwordResetToken.deleteMany({ where: { userId: id } });

        // Delete password history (has onDelete: Cascade but explicit is safer)
        await tx.passwordHistory.deleteMany({ where: { user_id: id } });

        // Delete refresh token blacklist entries for this user
        await tx.refreshTokenBlacklist.deleteMany({ where: { user_id: id } });

        // Finally, delete the user
        await tx.user.delete({ where: { id } });
      });

      // Log data modification
      if (authReq.user) {
        await logDataModification(authReq.user.id, req, 'User', id, 'delete');
      }

      return NextResponse.json({ message: 'Utilisateur supprimé avec succès' });
    } catch (error) {
      logger.error('Error deleting user:', ...sanitizeLogArgs(error));
      return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 });
    }
  });
}
