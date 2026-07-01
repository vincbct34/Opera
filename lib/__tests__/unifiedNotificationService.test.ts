/* eslint-disable */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { UnifiedNotificationService } from '@/lib/notifications/unifiedNotificationService';
import { NotificationService } from '@/lib/notifications/notificationService';
import { sendEmail } from '@/lib/notifications/emailService';
import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';

// Mock dependencies
jest.mock('@/lib/notifications/notificationService');
jest.mock('@/lib/notifications/emailService');
jest.mock('@/lib/middleware/prismaConfig', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));
jest.mock('@/lib/middleware/logger');

describe('UnifiedNotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    first_name: 'John',
    last_name: 'Doe',
    email_notifications_enabled: true,
    events_reminders_enabled: true,
  };

  describe('notifyRegistrationConfirmed', () => {
    it('should send in-app notification and email when email_notifications_enabled is true', async () => {
      // @ts-ignore
      prisma.user.findUnique.mockResolvedValue(mockUser);
      // @ts-ignore
      NotificationService.notifyRegistrationConfirmed.mockResolvedValue(undefined);
      // @ts-ignore
      sendEmail.mockResolvedValue(undefined);

      await UnifiedNotificationService.notifyRegistrationConfirmed({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
        eventTime: '20:00',
        eventLocation: 'Opéra Comédie',
        eventId: 'event-123',
        eventImage: 'http://example.com/image.jpg',
      });

      expect(NotificationService.notifyRegistrationConfirmed).toHaveBeenCalledWith(
        'user-123',
        'La Traviata',
        '15 mars 2025',
      );
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          template_id: '5961341',
          template_data: expect.objectContaining({
            event_name: 'La Traviata',
            event_date: '15 mars 2025',
            event_time: '20:00',
            event_location: 'Opéra Comédie',
            event_image: 'http://example.com/image.jpg',
            unsubscribe_url: expect.stringContaining('/account'),
          }),
        }),
      );
    });

    it('should include event slug in URL when provided', async () => {
      // @ts-ignore
      prisma.user.findUnique.mockResolvedValue(mockUser);
      // @ts-ignore
      NotificationService.notifyRegistrationConfirmed.mockResolvedValue(undefined);
      // @ts-ignore
      sendEmail.mockResolvedValue(undefined);

      await UnifiedNotificationService.notifyRegistrationConfirmed({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
        eventTime: '20:00',
        eventLocation: 'Opéra Comédie',
        eventId: 'event-123',
        eventSlug: 'la-traviata-2025',
        eventImage: 'http://example.com/image.jpg',
      });

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          template_data: expect.objectContaining({
            event_url: expect.stringContaining('/events/la-traviata-2025'),
          }),
        }),
      );
    });

    it('should include formation name in email when provided', async () => {
      // @ts-ignore
      prisma.user.findUnique.mockResolvedValue(mockUser);
      // @ts-ignore
      NotificationService.notifyRegistrationConfirmed.mockResolvedValue(undefined);
      // @ts-ignore
      sendEmail.mockResolvedValue(undefined);

      await UnifiedNotificationService.notifyRegistrationConfirmed({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
        eventTime: '20:00',
        eventId: 'event-123',
        formationName: 'Formation initiale',
      });

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          template_data: expect.objectContaining({
            formation_name: 'Formation initiale',
          }),
        }),
      );
    });

    it('should default formation name to empty string when not provided', async () => {
      // @ts-ignore
      prisma.user.findUnique.mockResolvedValue(mockUser);
      // @ts-ignore
      NotificationService.notifyRegistrationConfirmed.mockResolvedValue(undefined);
      // @ts-ignore
      sendEmail.mockResolvedValue(undefined);

      await UnifiedNotificationService.notifyRegistrationConfirmed({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
        eventTime: '20:00',
        eventId: 'event-123',
      });

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          template_data: expect.objectContaining({
            formation_name: '',
          }),
        }),
      );
    });

    it('should not send email when email_notifications_enabled is false', async () => {
      // @ts-ignore
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        email_notifications_enabled: false,
      });
      // @ts-ignore
      NotificationService.notifyRegistrationConfirmed.mockResolvedValue(undefined);

      await UnifiedNotificationService.notifyRegistrationConfirmed({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
        eventTime: '20:00',
        eventId: 'event-123',
      });

      expect(NotificationService.notifyRegistrationConfirmed).toHaveBeenCalled();
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('should send email when forceSendEmail is true regardless of user preferences', async () => {
      // @ts-ignore
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        email_notifications_enabled: false,
      });
      // @ts-ignore
      NotificationService.notifyRegistrationConfirmed.mockResolvedValue(undefined);
      // @ts-ignore
      sendEmail.mockResolvedValue(undefined);

      await UnifiedNotificationService.notifyRegistrationConfirmed({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
        eventTime: '20:00',
        eventId: 'event-123',
        sendEmail: true,
      });

      expect(sendEmail).toHaveBeenCalled();
    });

    it('should handle user not found error gracefully', async () => {
      // @ts-ignore
      prisma.user.findUnique.mockResolvedValue(null);
      // @ts-ignore
      NotificationService.notifyRegistrationConfirmed.mockResolvedValue(undefined);

      await UnifiedNotificationService.notifyRegistrationConfirmed({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
        eventTime: '20:00',
        eventId: 'event-123',
      });

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('not found'));
    });

    it('should handle errors gracefully and log them', async () => {
      // @ts-ignore
      prisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      await UnifiedNotificationService.notifyRegistrationConfirmed({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
        eventTime: '20:00',
        eventId: 'event-123',
      });

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error'),
        expect.any(Error),
      );
    });

    it('should handle notification service errors', async () => {
      // @ts-ignore
      NotificationService.notifyRegistrationConfirmed.mockRejectedValue(
        new Error('Notification error'),
      );

      await UnifiedNotificationService.notifyRegistrationConfirmed({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
        eventTime: '20:00',
        eventId: 'event-123',
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Error in notifyRegistrationConfirmed:',
        expect.any(Error),
      );
    });

    it('should handle email sending errors', async () => {
      // @ts-ignore
      prisma.user.findUnique.mockResolvedValue(mockUser);
      // @ts-ignore
      NotificationService.notifyRegistrationConfirmed.mockResolvedValue(undefined);
      // @ts-ignore
      sendEmail.mockRejectedValue(new Error('Email service error'));

      await UnifiedNotificationService.notifyRegistrationConfirmed({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
        eventTime: '20:00',
        eventId: 'event-123',
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Error in notifyRegistrationConfirmed:',
        expect.any(Error),
      );
    });
  });

  describe('notifyRegistrationRejected', () => {
    it('should send in-app notification and email with reason', async () => {
      // @ts-ignore
      prisma.user.findUnique.mockResolvedValue(mockUser);
      // @ts-ignore
      NotificationService.notifyRegistrationRejected.mockResolvedValue(undefined);
      // @ts-ignore
      sendEmail.mockResolvedValue(undefined);

      await UnifiedNotificationService.notifyRegistrationRejected({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
        reason: 'Places complètes',
        eventImage: 'http://example.com/image.jpg',
      });

      expect(NotificationService.notifyRegistrationRejected).toHaveBeenCalledWith(
        'user-123',
        'La Traviata',
        '15 mars 2025',
        'Places complètes',
      );
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          template_id: '8292108',
          template_data: expect.objectContaining({
            event_name: 'La Traviata',
            event_image: 'http://example.com/image.jpg',
            program_url: expect.stringContaining('/events'),
            unsubscribe_url: expect.stringContaining('/account'),
          }),
        }),
      );
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('rejected email sent'));
    });

    it('should handle missing reason', async () => {
      // @ts-ignore
      prisma.user.findUnique.mockResolvedValue(mockUser);
      // @ts-ignore
      NotificationService.notifyRegistrationRejected.mockResolvedValue(undefined);
      // @ts-ignore
      sendEmail.mockResolvedValue(undefined);

      await UnifiedNotificationService.notifyRegistrationRejected({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
      });

      expect(sendEmail).toHaveBeenCalled();
    });

    it('should not send email when forceSendEmail is explicitly false', async () => {
      // @ts-ignore
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        email_notifications_enabled: true,
      });
      // @ts-ignore
      NotificationService.notifyRegistrationRejected.mockResolvedValue(undefined);

      await UnifiedNotificationService.notifyRegistrationRejected({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
        sendEmail: false,
      });

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // @ts-ignore
      prisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      await UnifiedNotificationService.notifyRegistrationRejected({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
      });

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error'),
        expect.any(Error),
      );
    });

    it('should not send email when user not found', async () => {
      // @ts-ignore
      prisma.user.findUnique.mockResolvedValue(null);
      // @ts-ignore
      NotificationService.notifyRegistrationRejected.mockResolvedValue(undefined);

      await UnifiedNotificationService.notifyRegistrationRejected({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
      });

      expect(logger.warn).toHaveBeenCalled();
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('should handle notification service errors', async () => {
      // @ts-ignore
      NotificationService.notifyRegistrationRejected.mockRejectedValue(
        new Error('Notification error'),
      );

      await UnifiedNotificationService.notifyRegistrationRejected({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Error in notifyRegistrationRejected:',
        expect.any(Error),
      );
    });

    it('should handle email sending errors', async () => {
      // @ts-ignore
      prisma.user.findUnique.mockResolvedValue(mockUser);
      // @ts-ignore
      NotificationService.notifyRegistrationRejected.mockResolvedValue(undefined);
      // @ts-ignore
      sendEmail.mockRejectedValue(new Error('Email error'));

      await UnifiedNotificationService.notifyRegistrationRejected({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Error in notifyRegistrationRejected:',
        expect.any(Error),
      );
    });
  });

  describe('notifyRegistrationCancelled', () => {
    it('should send notification when cancelled by user', async () => {
      // @ts-ignore
      prisma.user.findUnique.mockResolvedValue(mockUser);
      // @ts-ignore
      NotificationService.notifyRegistrationCancelled.mockResolvedValue(undefined);
      // @ts-ignore
      sendEmail.mockResolvedValue(undefined);

      await UnifiedNotificationService.notifyRegistrationCancelled({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
        cancelledBy: 'user',
        eventImage: 'http://example.com/image.jpg',
      });

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          template_id: '0052157',
          template_data: expect.objectContaining({
            event_name: 'La Traviata',
            event_date: '15 mars 2025',
            event_image: 'http://example.com/image.jpg',
            program_url: expect.stringContaining('/events'),
            unsubscribe_url: expect.stringContaining('/account'),
          }),
        }),
      );
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('cancelled email sent'));
    });

    it('should send notification when cancelled by admin with reason', async () => {
      // @ts-ignore
      prisma.user.findUnique.mockResolvedValue(mockUser);
      // @ts-ignore
      NotificationService.notifyRegistrationCancelled.mockResolvedValue(undefined);
      // @ts-ignore
      sendEmail.mockResolvedValue(undefined);

      await UnifiedNotificationService.notifyRegistrationCancelled({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
        reason: 'Événement reporté',
        cancelledBy: 'admin',
        eventImage: 'http://example.com/image.jpg',
      });

      expect(sendEmail).toHaveBeenCalled();
    });

    it('should not send email when forceSendEmail is explicitly false', async () => {
      // @ts-ignore
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        email_notifications_enabled: true,
      });
      // @ts-ignore
      NotificationService.notifyRegistrationCancelled.mockResolvedValue(undefined);

      await UnifiedNotificationService.notifyRegistrationCancelled({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
        cancelledBy: 'user',
        sendEmail: false,
      });

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // @ts-ignore
      prisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      await UnifiedNotificationService.notifyRegistrationCancelled({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
        cancelledBy: 'user',
      });

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error'),
        expect.any(Error),
      );
    });

    it('should not send email when user not found', async () => {
      // @ts-ignore
      prisma.user.findUnique.mockResolvedValue(null);
      // @ts-ignore
      NotificationService.notifyRegistrationCancelled.mockResolvedValue(undefined);

      await UnifiedNotificationService.notifyRegistrationCancelled({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
        cancelledBy: 'admin',
      });

      expect(logger.warn).toHaveBeenCalled();
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('should handle notification service errors', async () => {
      // @ts-ignore
      NotificationService.notifyRegistrationCancelled.mockRejectedValue(
        new Error('Notification error'),
      );

      await UnifiedNotificationService.notifyRegistrationCancelled({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
        cancelledBy: 'user',
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Error in notifyRegistrationCancelled:',
        expect.any(Error),
      );
    });

    it('should handle email sending errors', async () => {
      // @ts-ignore
      prisma.user.findUnique.mockResolvedValue(mockUser);
      // @ts-ignore
      NotificationService.notifyRegistrationCancelled.mockResolvedValue(undefined);
      // @ts-ignore
      sendEmail.mockRejectedValue(new Error('Email error'));

      await UnifiedNotificationService.notifyRegistrationCancelled({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
        cancelledBy: 'admin',
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Error in notifyRegistrationCancelled:',
        expect.any(Error),
      );
    });
  });

  describe('notifyEventReminder', () => {
    it('should send reminder when events_reminders_enabled is true', async () => {
      // @ts-ignore
      prisma.user.findUnique.mockResolvedValue(mockUser);
      // @ts-ignore
      NotificationService.notifyEventReminder.mockResolvedValue(undefined);
      // @ts-ignore
      sendEmail.mockResolvedValue(undefined);

      await UnifiedNotificationService.notifyEventReminder({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
        eventTime: '20:00',
        eventLocation: 'Opéra Comédie',
        eventId: 'event-123',
        daysUntilEvent: 7,
        eventImage: 'http://example.com/image.jpg',
      });

      expect(NotificationService.notifyEventReminder).toHaveBeenCalledWith(
        'user-123',
        'La Traviata',
        '15 mars 2025',
        7,
      );
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          template_id: '6601097',
          template_data: expect.objectContaining({
            event_name: 'La Traviata',
            event_date: '15 mars 2025',
            event_time: '20:00',
            event_image: 'http://example.com/image.jpg',
            ticket_url: expect.stringContaining('/account/registrations'),
            program_url: expect.stringContaining('/events'),
            unsubscribe_url: expect.stringContaining('/account'),
          }),
        }),
      );
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('reminder email sent'));
    });

    it('should not send email when events_reminders_enabled is false', async () => {
      // @ts-ignore
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        events_reminders_enabled: false,
      });
      // @ts-ignore
      NotificationService.notifyEventReminder.mockResolvedValue(undefined);

      await UnifiedNotificationService.notifyEventReminder({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
        eventTime: '20:00',
        eventId: 'event-123',
        daysUntilEvent: 1,
      });

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('should not send email when forceSendEmail is explicitly false', async () => {
      // @ts-ignore
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        events_reminders_enabled: true,
      });
      // @ts-ignore
      NotificationService.notifyEventReminder.mockResolvedValue(undefined);

      await UnifiedNotificationService.notifyEventReminder({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
        eventTime: '20:00',
        eventId: 'event-123',
        daysUntilEvent: 7,
        sendEmail: false,
      });

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // @ts-ignore
      prisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      await UnifiedNotificationService.notifyEventReminder({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
        eventTime: '20:00',
        eventId: 'event-123',
        daysUntilEvent: 7,
      });

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error'),
        expect.any(Error),
      );
    });

    it('should not send email when user not found', async () => {
      // @ts-ignore
      prisma.user.findUnique.mockResolvedValue(null);
      // @ts-ignore
      NotificationService.notifyEventReminder.mockResolvedValue(undefined);

      await UnifiedNotificationService.notifyEventReminder({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
        eventTime: '20:00',
        eventId: 'event-123',
        daysUntilEvent: 1,
      });

      expect(logger.warn).toHaveBeenCalled();
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('should handle notification service errors', async () => {
      // @ts-ignore
      NotificationService.notifyEventReminder.mockRejectedValue(new Error('Notification error'));

      await UnifiedNotificationService.notifyEventReminder({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
        eventTime: '20:00',
        eventId: 'event-123',
        daysUntilEvent: 7,
      });

      expect(logger.error).toHaveBeenCalledWith('Error in notifyEventReminder:', expect.any(Error));
    });

    it('should handle email sending errors', async () => {
      // @ts-ignore
      prisma.user.findUnique.mockResolvedValue(mockUser);
      // @ts-ignore
      NotificationService.notifyEventReminder.mockResolvedValue(undefined);
      // @ts-ignore
      sendEmail.mockRejectedValue(new Error('Email error'));

      await UnifiedNotificationService.notifyEventReminder({
        userId: 'user-123',
        eventTitle: 'La Traviata',
        eventDate: '15 mars 2025',
        eventTime: '20:00',
        eventId: 'event-123',
        daysUntilEvent: 1,
      });

      expect(logger.error).toHaveBeenCalledWith('Error in notifyEventReminder:', expect.any(Error));
    });
  });

  describe('sendUpcomingEventReminders', () => {
    it('should send reminders for events in 7 days', async () => {
      // @ts-ignore
      NotificationService.getUsersWithUpcomingRegistrations.mockResolvedValue([
        {
          id: 'user-1',
          registrations: [
            {
              event: { id: 'event-1', title: 'La Traviata' },
              date: new Date('2025-03-15'),
            },
          ],
        },
      ]);
      // @ts-ignore
      prisma.user.findUnique.mockResolvedValue(mockUser);
      // @ts-ignore
      NotificationService.notifyEventReminder.mockResolvedValue(undefined);
      // @ts-ignore
      sendEmail.mockResolvedValue(undefined);

      await UnifiedNotificationService.sendUpcomingEventReminders(7);

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('7 days'));
      expect(logger.info).toHaveBeenCalledWith('Finished sending event reminders');
    });

    it('should handle errors gracefully when sending reminders to individual users', async () => {
      // @ts-ignore
      NotificationService.getUsersWithUpcomingRegistrations.mockResolvedValue([
        {
          id: 'user-1',
          registrations: [
            {
              event: { id: 'event-1', title: 'La Traviata' },
              date: new Date('2025-03-15'),
            },
          ],
        },
      ]);

      // Mock notifyEventReminder to throw an error
      // @ts-expect-error - Mocking function to reject
      const mockNotifyEventReminder = jest.fn().mockRejectedValue(new Error('Reminder error'));
      // @ts-expect-error - Overriding method for test
      UnifiedNotificationService.notifyEventReminder = mockNotifyEventReminder;

      await UnifiedNotificationService.sendUpcomingEventReminders(1);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send reminder to user'),
        expect.any(Error),
      );
      expect(logger.info).toHaveBeenCalledWith('Finished sending event reminders');
    });

    it('should handle errors in getUsersWithUpcomingRegistrations', async () => {
      // @ts-ignore
      NotificationService.getUsersWithUpcomingRegistrations.mockRejectedValue(
        new Error('Database error'),
      );

      await UnifiedNotificationService.sendUpcomingEventReminders(7);

      expect(logger.error).toHaveBeenCalledWith(
        'Error in sendUpcomingEventReminders:',
        expect.any(Error),
      );
    });

    it('should handle empty registration list', async () => {
      // @ts-ignore
      NotificationService.getUsersWithUpcomingRegistrations.mockResolvedValue([]);

      await UnifiedNotificationService.sendUpcomingEventReminders(0);

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('0 users'));
    });
  });
});
