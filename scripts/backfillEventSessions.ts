/**
 * One-off backfill: create an EventSession per (event, date) for events that
 * predate the per-séance jauge feature.
 *
 * total_seats is duplicated from the event's current total_seats value for
 * every date, since there is no historical per-séance split to recover —
 * admins can correct it per séance afterward via the admin event form.
 * booked_seats is recomputed from actual registrations (CONFIRMED / ATTENDED
 * / NO_SHOW) rather than trusted from Event.booked_seats, since that counter
 * doesn't reflect registrations created via the bulk import feature.
 *
 * Idempotent: events/dates that already have a session are left untouched.
 *
 * Usage: npx tsx scripts/backfillEventSessions.ts
 */
import prisma from '../lib/middleware/prismaConfig';

const COUNTS_TOWARD_BOOKED_SEATS = ['CONFIRMED', 'ATTENDED', 'NO_SHOW'] as const;

async function main() {
  const events = await prisma.event.findMany({
    include: { registrations: { select: { date: true, booked_seats: true, status: true } } },
  });

  let createdCount = 0;
  let skippedEvents = 0;

  for (const event of events) {
    const existingSessions = await prisma.eventSession.findMany({
      where: { event_id: event.id },
      select: { date: true },
    });
    const existingTimes = new Set(existingSessions.map((s) => s.date.getTime()));

    const missingDates = event.event_dates.filter((d) => !existingTimes.has(d.getTime()));
    if (missingDates.length === 0) {
      skippedEvents += 1;
      continue;
    }

    await prisma.eventSession.createMany({
      data: missingDates.map((date) => {
        const booked = event.registrations
          .filter(
            (r) =>
              r.date.getTime() === date.getTime() &&
              (COUNTS_TOWARD_BOOKED_SEATS as readonly string[]).includes(r.status),
          )
          .reduce((sum, r) => sum + r.booked_seats, 0);

        return {
          event_id: event.id,
          date,
          total_seats: event.total_seats,
          booked_seats: booked,
        };
      }),
    });
    createdCount += missingDates.length;
  }

  console.log(
    `Backfill done: ${createdCount} session(s) created across ${events.length - skippedEvents} event(s), ${skippedEvents} event(s) already up to date.`,
  );
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
