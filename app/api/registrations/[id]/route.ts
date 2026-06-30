import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/app/api/middleware';
import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';
import {
  RegistrationStatus,
  Accessibility,
  PublicCategory,
  SchoolGrade,
  AgeRange,
} from '@/app/generated/prisma/enums';
import { UnifiedNotificationService } from '@/lib/notifications/unifiedNotificationService';

/**
 * GET /api/registrations/[id]
 * Get a single registration by ID.
 * Users can only access their own registrations unless they are admin.
 * @param req - The incoming request.
 * @param context - The route context containing the registration ID.
 * @returns JSON response with the registration details.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return requireAuth(req as AuthenticatedRequest, async (authReq: AuthenticatedRequest) => {
    try {
      const { id } = await context.params;
      const userId = authReq.user!.id;
      const isAdmin = authReq.user!.role === 'ADMIN' || authReq.user!.role === 'SUPERADMIN';

      const registration = await prisma.registration.findUnique({
        where: { id },
        include: {
          event: {
            include: {
              accessibility: true,
            },
          },
          institution: {
            include: {
              address: true,
            },
          },
          disabilities: {
            select: {
              id: true,
              type: true,
              count: true,
              details: true,
            },
          },
        },
      });

      if (!registration) {
        return NextResponse.json({ error: 'Demande non trouvée' }, { status: 404 });
      }

      // Check if user owns this registration or is admin
      if (registration.user_id !== userId && !isAdmin) {
        return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
      }

      return NextResponse.json({ registration });
    } catch (error) {
      logger.error('Error fetching registration:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: 'Erreur lors de la récupération de la demande' },
        { status: 500 },
      );
    }
  });
}

/**
 * PATCH /api/registrations/[id]
 * Update a registration.
 * Users can cancel their own pending registrations.
 * Admins can update any registration.
 * @param req - The incoming request.
 * @param context - The route context containing the registration ID.
 * @returns JSON response with the updated registration.
 */
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return requireAuth(req as AuthenticatedRequest, async (authReq: AuthenticatedRequest) => {
    try {
      const { id } = await context.params;
      const userId = authReq.user!.id;
      const isAdmin = authReq.user!.role === 'ADMIN' || authReq.user!.role === 'SUPERADMIN';
      const body = await req.json().catch(() => ({}));

      // Fetch registration with full details for notification and change detection
      const registration = await prisma.registration.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
              phone_number: true,
            },
          },
          institution: {
            select: {
              id: true,
              name: true,
              address: {
                select: {
                  city: true,
                },
              },
            },
          },
          event: {
            select: {
              id: true,
              title: true,
              event_dates: true,
              image_url: true,
            },
          },
        },
      });

      if (!registration) {
        return NextResponse.json({ error: 'Demande non trouvée' }, { status: 404 });
      }

      // Check permissions
      const isOwner = registration.user_id === userId;
      if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
      }

      // Capture significant field values before modification for change detection
      const significantFields = [
        'booked_seats',
        'caretaker_count',
        'aesh_count',
        'want_formation',
        'want_preparation',
        'manager_email',
        'manager_phone_number',
      ] as const;

      const previousValues: Record<string, unknown> = {};
      for (const field of significantFields) {
        previousValues[field] = registration[field];
      }

      // Regular users can only edit their own pending/confirmed registrations
      // They can cancel pending registrations or update registration details
      if (!isAdmin) {
        // If trying to change status, only allow cancellation of pending registrations
        if (body.status) {
          if (body.status !== 'CANCELLED') {
            return NextResponse.json(
              { error: 'Vous ne pouvez que annuler vos demandes' },
              { status: 403 },
            );
          }
          if (registration.status !== 'PENDING') {
            return NextResponse.json(
              { error: 'Vous ne pouvez annuler que les demandes en attente' },
              { status: 400 },
            );
          }
        }

        // For other fields, allow editing only pending or confirmed registrations
        const canEditFields =
          registration.status === 'PENDING' || registration.status === 'CONFIRMED';
        if (!canEditFields && !body.status) {
          return NextResponse.json(
            { error: 'Vous ne pouvez modifier que les demandes en attente ou confirmées' },
            { status: 400 },
          );
        }
      }

      // Validate status if provided
      if (body.status) {
        const validStatuses = Object.values(RegistrationStatus);
        if (!validStatuses.includes(body.status)) {
          return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
        }
      }

      // Build update data object (declared early so it can be used below)
      const updateData: {
        status?: RegistrationStatus;
        was_present_comment?: string;
        user_id?: string;
        institution_id?: string;
        booked_seats?: number;
        caretaker_count?: number | null;
        aesh_count?: number | null;
        want_formation?: boolean | null;
        want_preparation?: boolean | null;
        comments?: string;
        manager_first_name?: string;
        manager_last_name?: string;
        manager_email?: string;
        manager_phone_number?: string;
      } = {};

      // Admin-only fields: user_id and institution_id
      if (body.user_id) {
        if (!isAdmin) {
          return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
        }
        // Validate user exists
        const user = await prisma.user.findUnique({
          where: { id: body.user_id },
        });
        if (!user) {
          return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
        }
        updateData.user_id = body.user_id;
      }

      if (body.institution_id) {
        if (!isAdmin) {
          return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
        }
        // Validate institution exists
        const institution = await prisma.institution.findUnique({
          where: { id: body.institution_id },
        });
        if (!institution) {
          return NextResponse.json({ error: 'Établissement introuvable' }, { status: 404 });
        }
        updateData.institution_id = body.institution_id;
      }

      if (body.status) {
        updateData.status = body.status;
      }

      // Allow users to update these fields
      if (typeof body.booked_seats === 'number' && body.booked_seats > 0) {
        updateData.booked_seats = body.booked_seats;
      }

      if (typeof body.caretaker_count === 'number') {
        updateData.caretaker_count = body.caretaker_count >= 0 ? body.caretaker_count : null;
      }

      if (typeof body.aesh_count === 'number') {
        updateData.aesh_count = body.aesh_count >= 0 ? body.aesh_count : null;
      }

      // Validate educational content requests if provided
      if (typeof body.want_formation === 'boolean' || typeof body.want_preparation === 'boolean') {
        const event = await prisma.event.findUnique({
          where: { id: registration.event_id },
          select: { has_initial_formation: true, has_musical_preparation: true },
        });

        if (!event) {
          return NextResponse.json({ error: 'Événement introuvable' }, { status: 404 });
        }

        if (typeof body.want_formation === 'boolean') {
          if (body.want_formation && !event.has_initial_formation) {
            return NextResponse.json(
              { error: 'Cet événement ne propose pas de formation initiale' },
              { status: 400 },
            );
          }
          updateData.want_formation = body.want_formation;
        }

        if (typeof body.want_preparation === 'boolean') {
          if (body.want_preparation && !event.has_musical_preparation) {
            return NextResponse.json(
              { error: 'Cet événement ne propose pas de préparation musicale' },
              { status: 400 },
            );
          }
          updateData.want_preparation = body.want_preparation;
        }
      }

      if (typeof body.comments === 'string') {
        updateData.comments = body.comments || null;
      }

      if (typeof body.manager_first_name === 'string') {
        updateData.manager_first_name = body.manager_first_name || null;
      }

      if (typeof body.manager_last_name === 'string') {
        updateData.manager_last_name = body.manager_last_name || null;
      }

      if (typeof body.manager_email === 'string') {
        updateData.manager_email = body.manager_email || null;
      }

      if (typeof body.manager_phone_number === 'string') {
        updateData.manager_phone_number = body.manager_phone_number || null;
      }

      if (isAdmin && typeof body.was_present_comment === 'string') {
        updateData.was_present_comment = body.was_present_comment;
      }

      if (Object.keys(updateData).length === 0 && !body.disabilities) {
        return NextResponse.json({ error: 'Aucune modification à apporter' }, { status: 400 });
      }

      const updatedRegistration = await prisma.registration.update({
        where: { id },
        data: updateData,
        include: {
          event: {
            include: {
              accessibility: true,
            },
          },
          institution: {
            include: {
              address: true,
            },
          },
          disabilities: {
            select: {
              id: true,
              type: true,
              count: true,
              details: true,
            },
          },
        },
      });

      // Update disabilities if provided
      if (body.disabilities && Array.isArray(body.disabilities)) {
        // Delete all existing disabilities for this registration
        await prisma.registrationDisability.deleteMany({
          where: { registration_id: id },
        });

        // Create new disabilities (only those with count > 0)
        const newDisabilities = body.disabilities.filter(
          (d: { type: Accessibility; count: number; details?: string }) => d.count > 0,
        );
        if (newDisabilities.length > 0) {
          await prisma.registrationDisability.createMany({
            data: newDisabilities.map(
              (d: { type: Accessibility; count: number; details?: string }) => ({
                registration_id: id,
                type: d.type,
                count: d.count,
                details: d.type === 'OTHER' ? d.details || null : null,
              }),
            ),
          });
        }
      }

      // Update category, grades, and age_ranges if provided (admin only)
      if (isAdmin) {
        if (body.category && Array.isArray(body.category)) {
          await prisma.registration.update({
            where: { id },
            data: { category: body.category as PublicCategory[] },
          });
        }
        if (body.grades && Array.isArray(body.grades)) {
          await prisma.registration.update({
            where: { id },
            data: { grades: body.grades as SchoolGrade[] },
          });
        }
        if (body.age_ranges && Array.isArray(body.age_ranges)) {
          await prisma.registration.update({
            where: { id },
            data: { age_ranges: body.age_ranges as AgeRange[] },
          });
        }
      }

      // Detect significant field changes and send notification to admins
      // Only notify for user modifications (not admin modifications)
      if (!isAdmin) {
        const modifiedFields: string[] = [];
        const newValues: Record<string, unknown> = {};

        // Field labels for the notification email
        const fieldLabels: Record<string, string> = {
          booked_seats: 'Nombre de places',
          caretaker_count: "Nombre d'accompagnateurs",
          aesh_count: "Nombre d'AESH",
          want_formation: 'Demande de formation',
          want_preparation: 'Préparation musicale',
          manager_email: 'Email responsable',
          manager_phone_number: 'Téléphone responsable',
        };

        for (const field of significantFields) {
          const newValue = updatedRegistration[field];
          if (previousValues[field] !== newValue) {
            modifiedFields.push(fieldLabels[field]);
            newValues[field] = newValue;
          }
        }

        // Send notification if any significant fields were changed
        if (modifiedFields.length > 0) {
          try {
            await UnifiedNotificationService.notifyRegistrationModifiedForAdmin({
              registrationId: updatedRegistration.id,
              eventTitle: registration.event.title,
              eventDates: registration.event.event_dates,
              eventImage: registration.event.image_url,
              userName: `${registration.user.first_name} ${registration.user.last_name}`,
              userEmail: registration.user.email,
              userPhone: registration.user.phone_number,
              institutionName: registration.institution.name,
              institutionCity: registration.institution.address?.city || 'Non spécifié',
              modifiedFields,
              previousValues,
              newValues,
            });

            logger.info('Registration modification notification sent to Opera staff', {
              registrationId: updatedRegistration.id,
              userId: registration.user.id,
              modifiedFields,
            });
          } catch (notificationError) {
            // Log but don't fail the request if notification fails
            logger.error(
              'Failed to send registration modification notification:',
              ...sanitizeLogArgs(notificationError),
            );
          }
        }
      }

      // Gestion des places réservées si le statut a changé
      if (updateData.status && updateData.status !== registration.status) {
        const oldStatus = registration.status;
        const newStatus = updateData.status;

        // Si passage de CONFIRMED à CANCELLED : libérer les places
        if (oldStatus === 'CONFIRMED' && newStatus === 'CANCELLED') {
          await prisma.event.update({
            where: { id: registration.event_id },
            data: {
              booked_seats: {
                decrement: registration.booked_seats,
              },
            },
          });
        }

        // Send cancellation notification if user cancelled their own registration
        if (newStatus === 'CANCELLED' && !isAdmin) {
          try {
            const eventDate = updatedRegistration.date.toLocaleDateString('fr-FR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            });

            await UnifiedNotificationService.notifyRegistrationCancelled({
              userId: registration.user_id,
              eventTitle: updatedRegistration.event.title,
              eventDate,
              cancelledBy: 'user',
            });
          } catch (notificationError) {
            // Log but don't fail the request if notification fails
            logger.error('Failed to send notification:', ...sanitizeLogArgs(notificationError));
          }
        }
      }

      // Reload registration with updated disabilities
      const finalRegistration = await prisma.registration.findUnique({
        where: { id },
        include: {
          event: {
            include: {
              accessibility: true,
            },
          },
          institution: {
            include: {
              address: true,
            },
          },
          disabilities: {
            select: {
              id: true,
              type: true,
              count: true,
              details: true,
            },
          },
        },
      });

      return NextResponse.json({ registration: finalRegistration });
    } catch (error) {
      logger.error('Error updating registration:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: 'Erreur lors de la mise à jour de la demande' },
        { status: 500 },
      );
    }
  });
}

/**
 * DELETE /api/registrations/[id]
 * Delete a registration.
 * Users can delete their own registrations.
 * Admins can delete any registration.
 * @param req - The incoming request.
 * @param context - The route context containing the registration ID.
 * @returns JSON response with success message.
 */
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return requireAuth(req as AuthenticatedRequest, async (authReq: AuthenticatedRequest) => {
    try {
      const { id } = await context.params;
      const userId = authReq.user!.id;
      const isAdmin = authReq.user!.role === 'ADMIN' || authReq.user!.role === 'SUPERADMIN';

      const registration = await prisma.registration.findUnique({
        where: { id },
      });

      if (!registration) {
        return NextResponse.json({ error: 'Demande non trouvée' }, { status: 404 });
      }

      // Check permissions
      const isOwner = registration.user_id === userId;
      if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
      }

      // Delete disabilities first (cascade)
      await prisma.registrationDisability.deleteMany({
        where: { registration_id: id },
      });

      await prisma.registration.delete({
        where: { id },
      });

      // Free up seats only if registration was confirmed
      if (registration.status === 'CONFIRMED') {
        await prisma.event.update({
          where: { id: registration.event_id },
          data: {
            booked_seats: {
              decrement: registration.booked_seats,
            },
          },
        });
      }

      return NextResponse.json({ message: 'Demande supprimée avec succès' });
    } catch (error) {
      logger.error('Error deleting registration:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: 'Erreur lors de la suppression de la demande' },
        { status: 500 },
      );
    }
  });
}
