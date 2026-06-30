/* eslint-disable */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';

import prisma from '@/lib/middleware/prismaConfig';
import { NotificationService } from '@/lib/notifications/notificationService';

jest.mock('@/lib/middleware/prismaConfig', () => ({
  __esModule: true,
  default: {
    notification: {
      create: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  },
}));

describe('NotificationService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('createNotification calls prisma.notification.create and returns result', async () => {
    const fake = { id: 'n1', user_id: 'u1' };
    // @ts-ignore
    prisma.notification.create.mockResolvedValue(fake);

    const res = await NotificationService.createNotification({
      userId: 'u1',
      title: 't',
      message: 'm',
      type: 'SYSTEM_UPDATE',
    });
    expect(prisma.notification.create).toHaveBeenCalled();
    expect(res).toBe(fake);
  });

  test('createBulkNotifications calls createMany and returns count', async () => {
    const fake = { count: 2 };
    // @ts-ignore
    prisma.notification.createMany.mockResolvedValue(fake);

    const res = await NotificationService.createBulkNotifications(['u1', 'u2'], {
      title: 't',
      message: 'm',
      type: 'SYSTEM_UPDATE',
    });
    expect(prisma.notification.createMany).toHaveBeenCalled();
    expect(res).toBe(fake);
  });

  test('notify helpers call createNotification/createBulkNotifications', async () => {
    // @ts-ignore
    prisma.notification.create.mockResolvedValue({ id: 'n' });
    // @ts-ignore
    prisma.notification.createMany.mockResolvedValue({ count: 2 });

    await NotificationService.notifyRegistrationConfirmed('u1', 'E', '2025-10-05');
    expect(prisma.notification.create).toHaveBeenCalled();

    await NotificationService.notifySystemUpdate(['u1', 'u2'], 'Update', 'desc');
    expect(prisma.notification.createMany).toHaveBeenCalled();
  });

  test('notifyRegistrationCancelled/rejected with and without reason', async () => {
    // @ts-ignore
    prisma.notification.create.mockResolvedValue({ id: 'n' });

    await NotificationService.notifyRegistrationCancelled('u1', 'Event', '2025-10-10');
    expect(prisma.notification.create).toHaveBeenCalled();

    await NotificationService.notifyRegistrationCancelled(
      'u2',
      'Event',
      '2025-10-10',
      'Overbooked',
    );
    expect(prisma.notification.create).toHaveBeenCalled();

    await NotificationService.notifyRegistrationRejected('u3', 'Event', '2025-10-10');
    await NotificationService.notifyRegistrationRejected(
      'u4',
      'Event',
      '2025-10-10',
      'Invalid info',
    );
    expect(prisma.notification.create).toHaveBeenCalled();
  });

  test('notifyEventReminder for 0,1 and >1 days', async () => {
    // @ts-ignore
    prisma.notification.create.mockResolvedValue({ id: 'r' });

    await NotificationService.notifyEventReminder('u1', 'E', '2025-10-10', 0);
    await NotificationService.notifyEventReminder('u1', 'E', '2025-10-10', 1);
    await NotificationService.notifyEventReminder('u1', 'E', '2025-10-10', 5);

    expect(prisma.notification.create).toHaveBeenCalledTimes(3);
  });

  test('notifySystemUpdate uses createBulkNotifications', async () => {
    // @ts-ignore
    prisma.notification.createMany.mockResolvedValue({ count: 5 });

    const res = await NotificationService.notifySystemUpdate(
      ['u1', 'u2'],
      'Update',
      'We updated the system',
    );
    expect(prisma.notification.createMany).toHaveBeenCalled();
    expect(res).toEqual({ count: 5 });
  });

  test('getUsersWithUpcomingRegistrations returns users with included registrations', async () => {
    const fakeUsers = [{ id: 'u1', registrations: [{ id: 'r1', event: { id: 'e1' } }] }];
    // @ts-ignore
    prisma.user.findMany.mockResolvedValue(fakeUsers);

    const res = await NotificationService.getUsersWithUpcomingRegistrations(new Date('2025-10-10'));
    expect(prisma.user.findMany).toHaveBeenCalled();
    expect(res).toBe(fakeUsers);
  });

  test('cleanupOldNotifications calls deleteMany and returns result', async () => {
    // @ts-ignore
    prisma.notification.deleteMany.mockResolvedValue({ count: 3 });
    const res = await NotificationService.cleanupOldNotifications(10);
    expect(prisma.notification.deleteMany).toHaveBeenCalled();
    expect(res).toEqual({ count: 3 });
  });

  test('createNotification throws error when prisma fails', async () => {
    // @ts-ignore
    prisma.notification.create.mockRejectedValue(new Error('DB error'));

    await expect(
      NotificationService.createNotification({
        userId: 'u1',
        title: 't',
        message: 'm',
        type: 'SYSTEM_UPDATE',
      }),
    ).rejects.toThrow('DB error');
  });

  test('createBulkNotifications throws error when prisma fails', async () => {
    // @ts-ignore
    prisma.notification.createMany.mockRejectedValue(new Error('Bulk error'));

    await expect(
      NotificationService.createBulkNotifications(['u1', 'u2'], {
        title: 't',
        message: 'm',
        type: 'SYSTEM_UPDATE',
      }),
    ).rejects.toThrow('Bulk error');
  });

  test('getUsersWithUpcomingRegistrations throws error when prisma fails', async () => {
    // @ts-ignore
    prisma.user.findMany.mockRejectedValue(new Error('Registration error'));

    await expect(NotificationService.getUsersWithUpcomingRegistrations(new Date())).rejects.toThrow(
      'Registration error',
    );
  });

  test('cleanupOldNotifications throws error when prisma fails', async () => {
    // @ts-ignore
    prisma.notification.deleteMany.mockRejectedValue(new Error('Delete error'));

    await expect(NotificationService.cleanupOldNotifications(30)).rejects.toThrow('Delete error');
  });
});
