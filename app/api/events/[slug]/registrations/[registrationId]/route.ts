import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';
import { RegistrationStatus, Accessibility, PublicCategory, SchoolGrade, AgeRange } from '@/app/generated/prisma/enums';
import { UnifiedNotificationService } from '@/lib/notifications/unifiedNotificationService';
import { historyCache } from '@/lib/events/registrationAnalytics';
import { sendEmail } from '@/lib/notifications/emailService';

// SMTP2GO Template ID for musical preparation requests to Opera staff
const PREPARATION_REQUEST_TEMPLATE_ID = '4049381';

/**
 * PATCH /api/events/[slug]/registrations/[registrationId]
 * Update registration status (admin only).
 * Body: { status?: RegistrationStatus, was_present_comment?: string }
 * @param req - The incoming request containing update data.
 * @param context - The route context containing the slug and registration ID.
 * @returns JSON response with the updated registration.
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ slug: string; registrationId: string }> },
) {
  return requireAdmin(req as AuthenticatedRequest, async () => {
    try {
      const { registrationId } = await context.params;
      const body = await req.json();

      // Validate status if provided
      if (body.status) {
        const validStatuses: RegistrationStatus[] = [
          'PENDING',
          'CONFIRMED',
          'CANCELLED',
          'REJECTED',
          'ATTENDED',
          'NO_SHOW',
        ];
        if (!validStatuses.includes(body.status)) {
          return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
        }
      }

      // Validate user_id if provided
      if (body.user_id) {
        const user = await prisma.user.findUnique({
          where: { id: body.user_id },
        });
        if (!user) {
          return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
        }
      }

      // Validate institution_id if provided
      if (body.institution_id) {
        const institution = await prisma.institution.findUnique({
          where: { id: body.institution_id },
        });
        if (!institution) {
          return NextResponse.json({ error: 'Établissement introuvable' }, { status: 404 });
        }
      }

      // Get current registration with full details
      const currentRegistration = await prisma.registration.findUnique({
        where: { id: registrationId },
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
              location: true,
              has_initial_formation: true,
              has_musical_preparation: true,
            },
          },
        },
      });

      if (!currentRegistration) {
        return NextResponse.json({ error: 'Inscription introuvable' }, { status: 404 });
      }

      // Build update data object
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
        comments?: string | null;
        manager_first_name?: string | null;
        manager_last_name?: string | null;
        manager_email?: string | null;
        manager_phone_number?: string | null;
      } = {};

      // Add fields to update data if provided
      if (body.status) updateData.status = body.status;
      if (typeof body.was_present_comment === 'string')
        updateData.was_present_comment = body.was_present_comment;
      if (body.user_id) updateData.user_id = body.user_id;
      if (body.institution_id) updateData.institution_id = body.institution_id;
      if (typeof body.booked_seats === 'number') updateData.booked_seats = body.booked_seats;
      if (typeof body.caretaker_count === 'number')
        updateData.caretaker_count = body.caretaker_count;
      if (typeof body.aesh_count === 'number') updateData.aesh_count = body.aesh_count;
      if (typeof body.want_formation === 'boolean') updateData.want_formation = body.want_formation;
      if (typeof body.want_preparation === 'boolean')
        updateData.want_preparation = body.want_preparation;
      if (typeof body.comments === 'string') updateData.comments = body.comments;
      if (typeof body.manager_first_name === 'string')
        updateData.manager_first_name = body.manager_first_name;
      if (typeof body.manager_last_name === 'string')
        updateData.manager_last_name = body.manager_last_name;
      if (typeof body.manager_email === 'string') updateData.manager_email = body.manager_email;
      if (typeof body.manager_phone_number === 'string')
        updateData.manager_phone_number = body.manager_phone_number;

      // Update registration
      const updatedRegistration = await prisma.registration.update({
        where: { id: registrationId },
        data: updateData,
        select: {
          id: true,
          user_id: true,
          institution_id: true,
          event_id: true,
          date: true,
          booked_seats: true,
          caretaker_count: true,
          aesh_count: true,
          status: true,
          manager_first_name: true,
          manager_last_name: true,
          manager_email: true,
          manager_phone_number: true,
          comments: true,
          was_present_comment: true,
          created_at: true,
          updated_at: true,
          category: true,
          grades: true,
          age_ranges: true,
          want_formation: true,
          want_preparation: true,
          user: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
            },
          },
          institution: {
            select: {
              id: true,
              name: true,
            },
          },
          event: {
            select: {
              id: true,
              title: true,
              slug: true,
              image_url: true,
              location: true,
            },
          },
        },
      });

      // Update disabilities if provided
      if (body.disabilities && Array.isArray(body.disabilities)) {
        // Delete all existing disabilities for this registration
        await prisma.registrationDisability.deleteMany({
          where: { registration_id: registrationId },
        });

        // Create new disabilities (only those with count > 0)
        const newDisabilities = body.disabilities.filter(
          (d: { type: Accessibility; count: number; details?: string }) => d.count > 0,
        );
        if (newDisabilities.length > 0) {
          await prisma.registrationDisability.createMany({
            data: newDisabilities.map(
              (d: { type: Accessibility; count: number; details?: string }) => ({
                registration_id: registrationId,
                type: d.type,
                count: d.count,
                details: d.type === 'OTHER' ? d.details || null : null,
              }),
            ),
          });
        }
      }

      // Update category, grades, and age_ranges if provided
      if (body.category && Array.isArray(body.category)) {
        await prisma.registration.update({
          where: { id: registrationId },
          data: { category: body.category as PublicCategory[] },
        });
      }
      if (body.grades && Array.isArray(body.grades)) {
        await prisma.registration.update({
          where: { id: registrationId },
          data: { grades: body.grades as SchoolGrade[] },
        });
      }
      if (body.age_ranges && Array.isArray(body.age_ranges)) {
        await prisma.registration.update({
          where: { id: registrationId },
          data: { age_ranges: body.age_ranges as AgeRange[] },
        });
      }

      // Gestion des places réservées selon le changement de statut
      if (body.status && body.status !== currentRegistration.status) {
        const oldStatus = currentRegistration.status;
        const newStatus = body.status;

        // Passage de PENDING/REJECTED/CANCELLED à CONFIRMED : réserver les places
        if (
          newStatus === 'CONFIRMED' &&
          (oldStatus === 'PENDING' || oldStatus === 'REJECTED' || oldStatus === 'CANCELLED')
        ) {
          await prisma.event.update({
            where: { id: currentRegistration.event_id },
            data: {
              booked_seats: {
                increment: currentRegistration.booked_seats,
              },
            },
          });
        }

        // Passage de CONFIRMED à CANCELLED/REJECTED : libérer les places
        if (oldStatus === 'CONFIRMED' && (newStatus === 'CANCELLED' || newStatus === 'REJECTED')) {
          await prisma.event.update({
            where: { id: currentRegistration.event_id },
            data: {
              booked_seats: {
                decrement: currentRegistration.booked_seats,
              },
            },
          });
        }

        // Invalider le cache de l'historique de l'institution quand le statut change
        // Cela affecte le calcul des scores futurs (taux de présence, absences récentes, etc.)
        historyCache.clearInstitution(currentRegistration.institution_id);
      }

      // Send email and in-app notifications based on status change
      if (body.status && body.status !== currentRegistration.status) {
        const eventDate = updatedRegistration.date.toLocaleDateString('fr-FR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        const eventTime = updatedRegistration.date.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        });

        try {
          if (body.status === 'CONFIRMED') {
            // Registration confirmed by admin
            await UnifiedNotificationService.notifyRegistrationConfirmed({
              userId: updatedRegistration.user_id,
              eventTitle: updatedRegistration.event.title,
              eventDate,
              eventTime,
              eventLocation: updatedRegistration.event.location || undefined,
              eventId: updatedRegistration.event.id,
              eventSlug: updatedRegistration.event.slug,
              eventImage: updatedRegistration.event.image_url || undefined,
            });

            // Send notification email to Opera staff if user requested musical preparation
            if (currentRegistration.want_preparation) {
              const operaEmail =
                process.env.OPERA_ADMIN_EMAIL || 'inscriptions@opera-orchestre-montpellier.fr';

              // Format event dates for the email
              const formattedDates: string = currentRegistration.event.event_dates
                .map((date: Date) =>
                  new Date(date).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                )
                .join(', ');

              const userName = `${currentRegistration.user.first_name} ${currentRegistration.user.last_name}`;

              await sendEmail({
                to: operaEmail,
                template_id: PREPARATION_REQUEST_TEMPLATE_ID,
                template_data: {
                  event_title: currentRegistration.event.title,
                  event_dates: formattedDates,
                  user_name: userName,
                  user_email: currentRegistration.user.email,
                  user_phone: currentRegistration.user.phone_number,
                  institution_name: currentRegistration.institution.name,
                  institution_city: currentRegistration.institution.address?.city || 'Non spécifié',
                  request_date: new Date().toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                },
              });

              logger.info('Musical preparation notification sent to Opera staff', {
                registrationId,
                userId: currentRegistration.user.id,
                eventId: currentRegistration.event.id,
                institutionId: currentRegistration.institution.id,
              });
            }
          } else if (body.status === 'REJECTED') {
            // Registration rejected by admin
            await UnifiedNotificationService.notifyRegistrationRejected({
              userId: updatedRegistration.user_id,
              eventTitle: updatedRegistration.event.title,
              eventDate,
              reason: body.was_present_comment,
              eventImage: updatedRegistration.event.image_url || undefined,
            });
          } else if (body.status === 'CANCELLED' && currentRegistration.status !== 'PENDING') {
            // Registration cancelled by admin (not user self-cancellation)
            await UnifiedNotificationService.notifyRegistrationCancelled({
              userId: updatedRegistration.user_id,
              eventTitle: updatedRegistration.event.title,
              eventDate,
              reason: body.was_present_comment,
              cancelledBy: 'admin',
              eventImage: updatedRegistration.event.image_url || undefined,
            });
          }
        } catch (notificationError) {
          // Log but don't fail the request if notification fails
          logger.error('Failed to send notification:', ...sanitizeLogArgs(notificationError));
        }
      }

      return NextResponse.json({ registration: updatedRegistration });
    } catch (error) {
      logger.error('Error updating registration:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: "Erreur lors de la mise à jour de l'inscription" },
        { status: 500 },
      );
    }
  });
}

/**
 * DELETE /api/events/[slug]/registrations/[registrationId]
 * Delete a registration (admin only).
 * @param req - The incoming request.
 * @param context - The route context containing the slug and registration ID.
 * @returns JSON response indicating success or failure.
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ slug: string; registrationId: string }> },
) {
  return requireAdmin(req as AuthenticatedRequest, async () => {
    try {
      const { registrationId } = await context.params;

      // Get registration to free up seats
      const registration = await prisma.registration.findUnique({
        where: { id: registrationId },
      });

      if (!registration) {
        return NextResponse.json({ error: 'Inscription introuvable' }, { status: 404 });
      }

      // Delete disabilities first (cascade)
      await prisma.registrationDisability.deleteMany({
        where: { registration_id: registrationId },
      });

      // Delete registration
      await prisma.registration.delete({
        where: { id: registrationId },
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

      // Invalider le cache de l'historique de l'institution
      historyCache.clearInstitution(registration.institution_id);

      return NextResponse.json({ success: true });
    } catch (error) {
      logger.error('Error deleting registration:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: "Erreur lors de la suppression de l'inscription" },
        { status: 500 },
      );
    }
  });
}
