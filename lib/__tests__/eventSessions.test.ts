/* eslint-disable */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import {
  ensureEventSessions,
  syncEventSessions,
  findEventSession,
  EventSessionInUseError,
} from '@/lib/events/eventSessions';

jest.mock('@/lib/middleware/prismaConfig', () => {
  return {
    __esModule: true,
    default: {
      eventSession: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
    },
  };
});

const prisma = require('@/lib/middleware/prismaConfig').default;

describe('lib/events/eventSessions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('EventSessionInUseError', () => {
    test('carries the blocked dates and a French message', () => {
      const dates = [new Date('2026-05-01T10:00:00Z')];
      const error = new EventSessionInUseError(dates);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('EventSessionInUseError');
      expect(error.dates).toBe(dates);
      expect(error.message).toMatch(/réservées/);
    });
  });

  describe('ensureEventSessions', () => {
    test('creates sessions only for dates missing an existing one', async () => {
      const existingDate = new Date('2026-05-01T10:00:00Z');
      const missingDate = new Date('2026-05-02T10:00:00Z');
      prisma.eventSession.findMany.mockResolvedValue([{ date: existingDate }]);

      await ensureEventSessions('evt-1', [existingDate, missingDate], 100);

      expect(prisma.eventSession.createMany).toHaveBeenCalledWith({
        data: [{ event_id: 'evt-1', date: missingDate, total_seats: 100, booked_seats: 0 }],
      });
    });

    test('does nothing when every date already has a session', async () => {
      const existingDate = new Date('2026-05-01T10:00:00Z');
      prisma.eventSession.findMany.mockResolvedValue([{ date: existingDate }]);

      await ensureEventSessions('evt-1', [existingDate], 100);

      expect(prisma.eventSession.createMany).not.toHaveBeenCalled();
    });

    test('uses the provided transaction client instead of the default prisma client', async () => {
      const tx = {
        eventSession: { findMany: jest.fn().mockResolvedValue([]), createMany: jest.fn() },
      };
      const date = new Date('2026-05-01T10:00:00Z');

      await ensureEventSessions('evt-1', [date], 50, tx as any);

      expect(tx.eventSession.createMany).toHaveBeenCalledWith({
        data: [{ event_id: 'evt-1', date, total_seats: 50, booked_seats: 0 }],
      });
      expect(prisma.eventSession.createMany).not.toHaveBeenCalled();
    });
  });

  describe('syncEventSessions', () => {
    test('creates new sessions, updates changed capacity, and leaves unchanged ones alone', async () => {
      const keptDate = new Date('2026-05-01T10:00:00Z');
      const newDate = new Date('2026-05-02T10:00:00Z');
      prisma.eventSession.findMany.mockResolvedValue([
        { id: 'sess-1', date: keptDate, total_seats: 50, booked_seats: 0 },
      ]);

      await syncEventSessions('evt-1', [
        { date: keptDate, total_seats: 80 },
        { date: newDate, total_seats: 30 },
      ]);

      expect(prisma.eventSession.update).toHaveBeenCalledWith({
        where: { id: 'sess-1' },
        data: { total_seats: 80 },
      });
      expect(prisma.eventSession.create).toHaveBeenCalledWith({
        data: { event_id: 'evt-1', date: newDate, total_seats: 30, booked_seats: 0 },
      });
      expect(prisma.eventSession.deleteMany).not.toHaveBeenCalled();
    });

    test('does not update a session whose capacity is unchanged', async () => {
      const keptDate = new Date('2026-05-01T10:00:00Z');
      prisma.eventSession.findMany.mockResolvedValue([
        { id: 'sess-1', date: keptDate, total_seats: 50, booked_seats: 0 },
      ]);

      await syncEventSessions('evt-1', [{ date: keptDate, total_seats: 50 }]);

      expect(prisma.eventSession.update).not.toHaveBeenCalled();
    });

    test('deletes sessions for dates no longer submitted when they have no bookings', async () => {
      const removedDate = new Date('2026-05-03T10:00:00Z');
      prisma.eventSession.findMany.mockResolvedValue([
        { id: 'sess-2', date: removedDate, total_seats: 40, booked_seats: 0 },
      ]);

      await syncEventSessions('evt-1', []);

      expect(prisma.eventSession.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['sess-2'] } },
      });
    });

    test('rejects removing a session that already has bookings', async () => {
      const removedDate = new Date('2026-05-03T10:00:00Z');
      prisma.eventSession.findMany.mockResolvedValue([
        { id: 'sess-2', date: removedDate, total_seats: 40, booked_seats: 5 },
      ]);

      await expect(syncEventSessions('evt-1', [])).rejects.toBeInstanceOf(EventSessionInUseError);
      expect(prisma.eventSession.deleteMany).not.toHaveBeenCalled();
      expect(prisma.eventSession.create).not.toHaveBeenCalled();
    });
  });

  describe('findEventSession', () => {
    test('resolves the session by its (event_id, date) compound key', async () => {
      const date = new Date('2026-05-01T10:00:00Z');
      prisma.eventSession.findUnique.mockResolvedValue({ id: 'sess-1' });

      const result = await findEventSession('evt-1', date);

      expect(prisma.eventSession.findUnique).toHaveBeenCalledWith({
        where: { event_id_date: { event_id: 'evt-1', date } },
      });
      expect(result).toEqual({ id: 'sess-1' });
    });
  });
});
