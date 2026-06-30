import prisma from '../middleware/prismaConfig';
import { NotificationType } from '@/app/generated/prisma';
import { logger } from '../middleware/logger';

/**
 * Parameters for creating a notification.
 */
export interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
}

export class NotificationService {
  /**
   * Create a single notification for a user.
   * @param params - The notification parameters.
   * @returns The created notification.
   */
  static async createNotification({ userId, title, message, type }: CreateNotificationParams) {
    try {
      const notification = await prisma.notification.create({
        data: {
          user_id: userId,
          title,
          message,
          type,
        },
      });

      logger.info(`Notification créée pour l'utilisateur ${userId}:`, {
        type,
        title,
      });

      return notification;
    } catch (error) {
      logger.error('Erreur lors de la création de la notification:', error);
      throw error;
    }
  }

  /**
   * Create notifications for multiple users in bulk.
   * @param userIds - Array of user IDs to receive the notification.
   * @param notificationData - The notification content (title, message, type).
   * @returns The result of the bulk creation operation.
   */
  static async createBulkNotifications(
    userIds: string[],
    notificationData: Omit<CreateNotificationParams, 'userId'>,
  ) {
    try {
      const notifications = await prisma.notification.createMany({
        data: userIds.map((userId) => ({
          user_id: userId,
          title: notificationData.title,
          message: notificationData.message,
          type: notificationData.type,
        })),
      });

      logger.info(
        `${notifications.count} notifications créées en lot pour ${userIds.length} utilisateurs`,
      );

      return notifications;
    } catch (error) {
      logger.error('Erreur lors de la création des notifications en lot:', error);
      throw error;
    }
  }

  /**
   * Registration confirmed notification
   */
  static async notifyRegistrationConfirmed(userId: string, eventTitle: string, eventDate: string) {
    return this.createNotification({
      userId,
      title: "Demande d'inscription confirmée",
      message: `Votre demande d'inscription pour "${eventTitle}" le ${eventDate} a été confirmée.`,
      type: 'REGISTRATION_CONFIRMED',
    });
  }

  /**
   * Registration cancelled notification
   */
  static async notifyRegistrationCancelled(
    userId: string,
    eventTitle: string,
    eventDate: string,
    reason?: string,
  ) {
    const message = reason
      ? `Votre demande d'inscription pour "${eventTitle}" le ${eventDate} a été annulée. Raison: ${reason}`
      : `Votre demande d'inscription pour "${eventTitle}" le ${eventDate} a été annulée.`;

    return this.createNotification({
      userId,
      title: "Demande d'inscription annulée",
      message,
      type: 'REGISTRATION_CANCELLED',
    });
  }

  /**
   * Registration rejected notification
   */
  static async notifyRegistrationRejected(
    userId: string,
    eventTitle: string,
    eventDate: string,
    reason?: string,
  ) {
    const message = reason
      ? `Votre demande d'inscription pour "${eventTitle}" le ${eventDate} a été refusée. Raison: ${reason}`
      : `Votre demande d'inscription pour "${eventTitle}" le ${eventDate} a été refusée.`;

    return this.createNotification({
      userId,
      title: "Demande d'inscription refusée",
      message,
      type: 'REGISTRATION_REJECTED',
    });
  }

  /**
   * Event reminder notification
   */
  static async notifyEventReminder(
    userId: string,
    eventTitle: string,
    eventDate: string,
    daysUntilEvent: number,
  ) {
    const message =
      daysUntilEvent === 0
        ? `Rappel: "${eventTitle}" a lieu aujourd'hui !`
        : daysUntilEvent === 1
          ? `Rappel: "${eventTitle}" a lieu demain (${eventDate}).`
          : `Rappel: "${eventTitle}" a lieu dans ${daysUntilEvent} jours (${eventDate}).`;

    return this.createNotification({
      userId,
      title: "Rappel d'événement",
      message,
      type: 'EVENT_REMINDER',
    });
  }

  /**
   * System update notification
   */
  static async notifySystemUpdate(userIds: string[], updateTitle: string, updateMessage: string) {
    return this.createBulkNotifications(userIds, {
      title: updateTitle,
      message: updateMessage,
      type: 'SYSTEM_UPDATE',
    });
  }

  /**
   * Get users with upcoming registrations for event reminders
   */
  static async getUsersWithUpcomingRegistrations(eventDate: Date) {
    try {
      const users = await prisma.user.findMany({
        where: {
          events_reminders_enabled: true,
          registrations: {
            some: {
              date: eventDate,
              status: 'CONFIRMED',
            },
          },
        },
        include: {
          registrations: {
            where: {
              date: eventDate,
              status: 'CONFIRMED',
            },
            include: {
              event: true,
            },
          },
        },
      });

      return users;
    } catch (error) {
      logger.error(
        "Erreur lors de la récupération des utilisateurs avec demande d'inscription:",
        error,
      );
      throw error;
    }
  }

  /**
   * Clean up old notifications (older than 30 days)
   */
  static async cleanupOldNotifications(daysOld: number = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await prisma.notification.deleteMany({
        where: {
          created_at: {
            lt: cutoffDate,
          },
        },
      });

      logger.info(`${result.count} anciennes notifications supprimées`);
      return result;
    } catch (error) {
      logger.error('Erreur lors du nettoyage des anciennes notifications:', error);
      throw error;
    }
  }
}
