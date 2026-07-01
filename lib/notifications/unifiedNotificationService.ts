import { NotificationService } from './notificationService';
import { sendEmail } from './emailService';
import { getServerBaseUrl } from '../utils/getBaseUrl';
import prisma from '../middleware/prismaConfig';
import { logger } from '../middleware/logger';
import { formatFormationName } from '../events/registrationBlocks';

/**
 * Unified Notification Service.
 * Handles both in-app notifications AND email notifications.
 * Respects user preferences for email notifications unless overridden.
 */

/**
 * Base parameters for unified notifications.
 */
interface BaseNotificationParams {
  userId: string;
  sendEmail?: boolean; // Override to force email sending (default: respect user preferences)
}

interface RegistrationConfirmedParams extends BaseNotificationParams {
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation?: string;
  eventId: string;
  eventSlug?: string | null;
  eventImage?: string | null;
  formationName?: string | null;
}

interface RegistrationRejectedParams extends BaseNotificationParams {
  eventTitle: string;
  eventDate: string;
  reason?: string;
  eventImage?: string | null;
  formationName?: string | null;
}

interface RegistrationCancelledParams extends BaseNotificationParams {
  eventTitle: string;
  eventDate: string;
  reason?: string;
  cancelledBy: 'user' | 'admin';
  eventImage?: string | null;
  formationName?: string | null;
}

interface EventReminderParams extends BaseNotificationParams {
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation?: string;
  eventId: string;
  eventSlug?: string | null;
  daysUntilEvent: number;
  eventImage?: string | null;
  formationName?: string | null;
}

interface RegistrationModifiedForAdminParams {
  registrationId: string;
  eventTitle: string;
  eventDates: Date[];
  eventImage?: string | null;
  userEmail: string;
  userName: string;
  userPhone: string | null;
  institutionName: string;
  institutionCity: string;
  modifiedFields: string[];
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  formationName?: string | null;
}

interface RegistrationSubmittedParams {
  userId: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation?: string;
  eventSlug?: string | null;
  eventImage?: string | null;
  formationName?: string | null;
}

export class UnifiedNotificationService {
  /**
   * Get user details including email preferences.
   * @param userId - The user's ID.
   * @returns User object with email and preference fields, or null if not found.
   */
  private static async getUserDetails(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          email_notifications_enabled: true,
          events_reminders_enabled: true,
        },
      });

      return user;
    } catch (error) {
      logger.error('Error fetching user details:', error);
      return null;
    }
  }

  /**
   * Send admin email notification when a user modifies their registration.
   */
  static async notifyRegistrationModifiedForAdmin(params: RegistrationModifiedForAdminParams) {
    try {
      const adminEmail =
        process.env.OPERA_ADMIN_EMAIL || 'inscriptions@opera-orchestre-montpellier.fr';

      const formattedDates = params.eventDates
        .map((date) =>
          new Date(date).toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
        )
        .join(', ');

      const adminUrl = `${getServerBaseUrl()}/admin/events`;

      await sendEmail({
        to: adminEmail,
        template_id: '8091556',
        template_data: {
          first_name: 'Bonjour',
          event_name: params.eventTitle,
          event_date: formattedDates,
          event_url: adminUrl,
          event_image: params.eventImage,
          event_title: params.eventTitle,
          event_dates: formattedDates,
          user_name: params.userName,
          user_email: params.userEmail,
          user_phone: params.userPhone || 'Non spécifié',
          institution_name: params.institutionName,
          institution_city: params.institutionCity,
          modification_date: new Date().toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          modified_fields: params.modifiedFields.join(', '),
          formation_name: params.formationName || '',
          unsubscribe_url: `${getServerBaseUrl()}/account`,
        },
      });
    } catch (error) {
      logger.error('Error in notifyRegistrationModifiedForAdmin:', error);
    }
  }

  /**
   * Send registration confirmed notification (in-app + email).
   * @param params - Parameters including user ID and event details.
   */
  static async notifyRegistrationConfirmed(params: RegistrationConfirmedParams) {
    const {
      userId,
      eventTitle,
      eventDate,
      eventTime,
      eventLocation,
      eventSlug,
      eventImage,
      formationName,
      sendEmail: forceSendEmail,
    } = params;

    try {
      // Create in-app notification
      await NotificationService.notifyRegistrationConfirmed(userId, eventTitle, eventDate);

      // Get user details for email
      const user = await this.getUserDetails(userId);
      if (!user) {
        logger.warn(`User ${userId} not found for email notification`);
        return;
      }

      // Send email if enabled or forced
      const shouldSendEmail = forceSendEmail ?? user.email_notifications_enabled;
      if (shouldSendEmail) {
        await sendEmail({
          to: user.email,
          template_id: '5961341',
          template_data: {
            first_name: user.first_name,
            last_name: user.last_name,
            event_name: eventTitle,
            event_date: eventDate,
            event_time: eventTime,
            event_location: eventLocation,
            event_url: eventSlug
              ? `${getServerBaseUrl()}/events/${eventSlug}`
              : `${getServerBaseUrl()}/events`,
            event_image: eventImage,
            formation_name: formationName || '',
            unsubscribe_url: `${getServerBaseUrl()}/account`,
          },
        });

        logger.info(`Registration confirmed email sent to ${user.email}`);
      }
    } catch (error) {
      logger.error('Error in notifyRegistrationConfirmed:', error);
    }
  }

  /**
   * Send registration submitted confirmation email.
   * Sent immediately after user submits a registration form.
   * @param params - Parameters including user ID and event details.
   */
  static async notifyRegistrationSubmitted(params: RegistrationSubmittedParams) {
    const {
      userId,
      eventTitle,
      eventDate,
      eventTime,
      eventLocation,
      eventSlug,
      eventImage,
      formationName,
    } = params;

    try {
      // Get user details for email
      const user = await this.getUserDetails(userId);
      if (!user) {
        logger.warn(`User ${userId} not found for email notification`);
        return;
      }

      // Always send this email regardless of user preferences
      // (it's a transactional confirmation, not a marketing/preference email)
      await sendEmail({
        to: user.email,
        template_id: '2180336',
        template_data: {
          first_name: user.first_name,
          event_image: eventImage,
          event_name: eventTitle,
          event_date: eventDate,
          event_time: eventTime,
          event_location: eventLocation,
          event_url: eventSlug
            ? `${getServerBaseUrl()}/events/${eventSlug}`
            : `${getServerBaseUrl()}/events`,
          formation_name: formationName || '',
          unsubscribe_url: `${getServerBaseUrl()}/account`,
        },
      });

      logger.info(`Registration submitted confirmation email sent to ${user.email}`);
    } catch (error) {
      logger.error('Error in notifyRegistrationSubmitted:', error);
    }
  }

  /**
   * Send registration rejected notification (in-app + email)
   */
  static async notifyRegistrationRejected(params: RegistrationRejectedParams) {
    const {
      userId,
      eventTitle,
      eventDate,
      reason,
      eventImage,
      formationName,
      sendEmail: forceSendEmail,
    } = params;

    try {
      // Create in-app notification
      await NotificationService.notifyRegistrationRejected(userId, eventTitle, eventDate, reason);

      // Get user details for email
      const user = await this.getUserDetails(userId);
      if (!user) {
        logger.warn(`User ${userId} not found for email notification`);
        return;
      }

      // Send email if enabled or forced
      const shouldSendEmail = forceSendEmail ?? user.email_notifications_enabled;
      if (shouldSendEmail) {
        await sendEmail({
          to: user.email,
          template_id: '8292108',
          template_data: {
            first_name: user.first_name,
            last_name: user.last_name,
            event_name: eventTitle,
            event_image: eventImage,
            formation_name: formationName || '',
            program_url: `${getServerBaseUrl()}/events`,
            unsubscribe_url: `${getServerBaseUrl()}/account`,
          },
        });

        logger.info(`Registration rejected email sent to ${user.email}`);
      }
    } catch (error) {
      logger.error('Error in notifyRegistrationRejected:', error);
    }
  }

  /**
   * Send registration cancelled notification (in-app + email)
   */
  static async notifyRegistrationCancelled(params: RegistrationCancelledParams) {
    const {
      userId,
      eventTitle,
      eventDate,
      reason,
      cancelledBy,
      eventImage,
      formationName,
      sendEmail: forceSendEmail,
    } = params;

    try {
      // Create in-app notification
      await NotificationService.notifyRegistrationCancelled(userId, eventTitle, eventDate, reason);

      // Get user details for email
      const user = await this.getUserDetails(userId);
      if (!user) {
        logger.warn(`User ${userId} not found for email notification`);
        return;
      }

      // Send email if enabled or forced
      const shouldSendEmail = forceSendEmail ?? user.email_notifications_enabled;
      if (shouldSendEmail) {
        await sendEmail({
          to: user.email,
          template_id: '0052157',
          template_data: {
            first_name: user.first_name,
            last_name: user.last_name,
            event_name: eventTitle,
            event_date: eventDate,
            reason,
            cancelled_by: cancelledBy,
            event_image: eventImage,
            formation_name: formationName || '',
            program_url: `${getServerBaseUrl()}/events`,
            unsubscribe_url: `${getServerBaseUrl()}/account`,
          },
        });

        logger.info(`Registration cancelled email sent to ${user.email}`);
      }
    } catch (error) {
      logger.error('Error in notifyRegistrationCancelled:', error);
    }
  }

  /**
   * Send event reminder notification (in-app + email)
   */
  static async notifyEventReminder(params: EventReminderParams) {
    const {
      userId,
      eventTitle,
      eventDate,
      eventTime,
      eventLocation,
      daysUntilEvent,
      eventImage,
      formationName,
      sendEmail: forceSendEmail,
    } = params;

    try {
      // Create in-app notification
      await NotificationService.notifyEventReminder(userId, eventTitle, eventDate, daysUntilEvent);

      // Get user details for email
      const user = await this.getUserDetails(userId);
      if (!user) {
        logger.warn(`User ${userId} not found for email notification`);
        return;
      }

      // Send email if event reminders are enabled or forced
      const shouldSendEmail = forceSendEmail ?? user.events_reminders_enabled;
      if (shouldSendEmail) {
        await sendEmail({
          to: user.email,
          template_id: '6601097',
          template_data: {
            first_name: user.first_name,
            last_name: user.last_name,
            event_name: eventTitle,
            event_date: eventDate,
            event_time: eventTime,
            event_location: eventLocation,
            event_image: eventImage,
            days_until_event: daysUntilEvent,
            formation_name: formationName || '',
            ticket_url: `${getServerBaseUrl()}/account/registrations`,
            program_url: `${getServerBaseUrl()}/events`,
            unsubscribe_url: `${getServerBaseUrl()}/account`,
          },
        });

        logger.info(`Event reminder email sent to ${user.email}`);
      }
    } catch (error) {
      logger.error('Error in notifyEventReminder:', error);
    }
  }

  /**
   * Send event reminders to all users with upcoming confirmed registrations
   */
  static async sendUpcomingEventReminders(daysUntilEvent: number) {
    try {
      // Calculate the target date
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysUntilEvent);
      targetDate.setHours(0, 0, 0, 0);

      // Get users with confirmed registrations for this date
      const users = await NotificationService.getUsersWithUpcomingRegistrations(targetDate);

      logger.info(
        `Sending reminders for ${users.length} users with events in ${daysUntilEvent} days`,
      );

      // Send reminders for each user's registrations
      const reminderPromises = users.flatMap((user) =>
        user.registrations.map(async (registration) => {
          try {
            const formationName = formatFormationName(
              registration.blockSelections,
              registration.want_formation,
            );

            await this.notifyEventReminder({
              userId: user.id,
              eventTitle: registration.event.title,
              eventDate: registration.date.toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              }),
              eventTime: registration.date.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              }),
              eventLocation: undefined,
              eventId: registration.event.id,
              eventSlug: registration.event.slug,
              eventImage: registration.event.image_url || undefined,
              daysUntilEvent,
              formationName,
            });
          } catch (error) {
            logger.error(
              `Failed to send reminder to user ${user.id} for event ${registration.event.id}:`,
              error,
            );
          }
        }),
      );

      await Promise.allSettled(reminderPromises);
      logger.info('Finished sending event reminders');
    } catch (error) {
      logger.error('Error in sendUpcomingEventReminders:', error);
    }
  }
}
