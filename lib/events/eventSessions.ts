/**
 * Per-séance seat capacity ("jauge").
 * An EventSession tracks total_seats/booked_seats for one specific date of an
 * event, independent of the legacy Event.total_seats/booked_seats (which
 * stays a whole-event figure, unaffected by this). Session capacity is what
 * gates registration availability for a given date going forward.
 */
import { PrismaClient } from '@prisma/client';
import prisma from '@/lib/middleware/prismaConfig';

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export class EventSessionInUseError extends Error {
  constructor(public readonly dates: Date[]) {
    super('Impossible de supprimer une séance avec des places déjà réservées');
    this.name = 'EventSessionInUseError';
  }
}

/**
 * Create an EventSession for any given date that doesn't have one yet, using
 * defaultSeats as its capacity. Never touches an existing session, so manual
 * per-séance capacity edits are never clobbered by a rescrape.
 */
export async function ensureEventSessions(
  eventId: string,
  dates: Date[],
  defaultSeats: number,
  tx: TransactionClient | typeof prisma = prisma,
): Promise<void> {
  const existing = await tx.eventSession.findMany({
    where: { event_id: eventId },
    select: { date: true },
  });
  const existingTimes = new Set(existing.map((s) => s.date.getTime()));
  const missing = dates.filter((d) => !existingTimes.has(d.getTime()));

  if (missing.length > 0) {
    await tx.eventSession.createMany({
      data: missing.map((date) => ({
        event_id: eventId,
        date,
        total_seats: defaultSeats,
        booked_seats: 0,
      })),
    });
  }
}

/**
 * Full sync of an event's sessions from an admin-submitted list: updates
 * capacity on existing sessions, creates new ones, and removes sessions for
 * dates no longer present — unless that session already has bookings, in
 * which case the whole update is rejected via EventSessionInUseError.
 */
export async function syncEventSessions(
  eventId: string,
  entries: { date: Date; total_seats: number }[],
  tx: TransactionClient | typeof prisma = prisma,
): Promise<void> {
  const existing = await tx.eventSession.findMany({ where: { event_id: eventId } });
  const existingByTime = new Map(existing.map((s) => [s.date.getTime(), s]));
  const submittedTimes = new Set(entries.map((e) => e.date.getTime()));

  const toRemove = existing.filter((s) => !submittedTimes.has(s.date.getTime()));
  const blocked = toRemove.filter((s) => s.booked_seats > 0);
  if (blocked.length > 0) {
    throw new EventSessionInUseError(blocked.map((s) => s.date));
  }

  if (toRemove.length > 0) {
    await tx.eventSession.deleteMany({ where: { id: { in: toRemove.map((s) => s.id) } } });
  }

  for (const entry of entries) {
    const current = existingByTime.get(entry.date.getTime());
    if (current) {
      if (current.total_seats !== entry.total_seats) {
        await tx.eventSession.update({
          where: { id: current.id },
          data: { total_seats: entry.total_seats },
        });
      }
    } else {
      await tx.eventSession.create({
        data: {
          event_id: eventId,
          date: entry.date,
          total_seats: entry.total_seats,
          booked_seats: 0,
        },
      });
    }
  }
}

/** Resolve the EventSession matching a registration's (event_id, date). */
export async function findEventSession(
  eventId: string,
  date: Date,
  tx: TransactionClient | typeof prisma = prisma,
) {
  return tx.eventSession.findUnique({
    where: { event_id_date: { event_id: eventId, date } },
  });
}
