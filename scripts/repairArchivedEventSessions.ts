/**
 * One-off repair for the initial backfill's exact-timestamp matching: on
 * archived events, Registration.date sometimes drifts by minutes from the
 * event's current event_dates (dates were edited after people registered),
 * so those registrations never matched a session and booked_seats stayed 0.
 *
 * Scope: ARCHIVED events only (past, closed — never affects live capacity
 * checks or open registrations). Re-attributes each counted registration to
 * its nearest session by time instead of requiring an exact match, then
 * recomputes booked_seats per session. Never touches Registration or
 * total_seats.
 *
 * Dry-run by default — prints what would change without writing anything.
 * Pass --apply to actually update the database.
 *
 * Usage:
 *   npx tsx scripts/repairArchivedEventSessions.ts          # dry run
 *   npx tsx scripts/repairArchivedEventSessions.ts --apply  # write changes
 */
import prisma from '../lib/middleware/prismaConfig';

const COUNTS_TOWARD_BOOKED_SEATS = ['CONFIRMED', 'ATTENDED', 'NO_SHOW'] as const;

async function main() {
  const apply = process.argv.includes('--apply');

  const events = await prisma.event.findMany({
    where: { status: 'ARCHIVED' },
    include: {
      sessions: true,
      registrations: { select: { date: true, booked_seats: true, status: true } },
    },
  });

  let sessionsChanged = 0;
  let eventsChanged = 0;

  for (const event of events) {
    if (event.sessions.length === 0) continue;

    const bookedBySessionId = new Map<string, number>();
    for (const session of event.sessions) bookedBySessionId.set(session.id, 0);

    for (const reg of event.registrations) {
      if (!(COUNTS_TOWARD_BOOKED_SEATS as readonly string[]).includes(reg.status)) continue;

      let closest = event.sessions[0];
      let closestDiff = Math.abs(reg.date.getTime() - closest.date.getTime());
      for (const session of event.sessions.slice(1)) {
        const diff = Math.abs(reg.date.getTime() - session.date.getTime());
        if (diff < closestDiff) {
          closest = session;
          closestDiff = diff;
        }
      }
      bookedBySessionId.set(
        closest.id,
        (bookedBySessionId.get(closest.id) || 0) + reg.booked_seats,
      );
    }

    let eventChanged = false;
    for (const session of event.sessions) {
      const newBooked = bookedBySessionId.get(session.id) || 0;
      if (newBooked !== session.booked_seats) {
        console.log(
          `${event.title} — séance ${session.date.toISOString()}: ${session.booked_seats} -> ${newBooked}`,
        );
        if (apply) {
          await prisma.eventSession.update({
            where: { id: session.id },
            data: { booked_seats: newBooked },
          });
        }
        sessionsChanged += 1;
        eventChanged = true;
      }
    }
    if (eventChanged) eventsChanged += 1;
  }

  console.log(
    `${apply ? 'Repaired' : '[dry run] Would repair'} ${sessionsChanged} session(s) across ${eventsChanged} archived event(s).`,
  );
  if (!apply && sessionsChanged > 0) {
    console.log('Re-run with --apply to write these changes.');
  }
}

main()
  .catch((error) => {
    console.error('Repair failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
