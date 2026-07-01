import { NextResponse, NextRequest } from 'next/server';

import { requireCronAuth } from '@/lib/middleware/cronAuth';
import { EventStatus } from '@prisma/client';
import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { HolidaysService } from '@/lib/services/holidays.service';

export const dynamic = 'force-dynamic';

function getLatestEventDate(dates: Date[]): Date {
  return dates.reduce((latest, date) => (date > latest ? date : latest), dates[0]);
}

function shouldArchiveEvent(dates: Date[], now: Date): boolean {
  const latestDate = getLatestEventDate(dates);
  const archiveDate = new Date(latestDate);
  archiveDate.setFullYear(archiveDate.getFullYear() + 1);
  return archiveDate <= now;
}

/**
 * Update event statuses based on their dates.
 * Events with all dates in the past should be marked as CLOSED.
 * Events with at least one future date should be marked as OPEN.
 * Events whose latest date is more than one year old should be marked as ARCHIVED.
 * @param req - NextRequest object containing the request data.
 * @returns NextResponse with update status and count.
 */
export async function GET(req: NextRequest) {
  return requireCronAuth(req, async () => {
    try {
      const now = new Date();
      const openingLimitDate = await HolidaysService.getOpeningLimitDate();

      // Get all events with their dates
      const allEvents = await prisma.event.findMany({
        select: {
          id: true,
          title: true,
          status: true,
          event_dates: true,
          protected_fields: true,
        },
      });

      let updatedToClosedCount = 0;
      let updatedToOpenCount = 0;
      let updatedToArchivedCount = 0;
      const updatedEvents: {
        id: string;
        title: string;
        oldStatus: EventStatus;
        newStatus: EventStatus;
      }[] = [];

      for (const event of allEvents) {
        if (event.protected_fields?.includes('status')) {
          continue;
        }

        if (!event.event_dates || event.event_dates.length === 0) {
          // Skip events with no dates
          continue;
        }

        // Check if all dates are in the past
        const allDatesInPast = event.event_dates.every((date: Date) => date < now);

        // Check if at least one date is in the future
        const hasFutureDate = event.event_dates.some((date: Date) => date >= now);

        // Check if event should be opened based on limit date
        // Logic: Event should be OPEN if it has future dates AND starts before the limit
        const firstDate = event.event_dates.length > 0 ? new Date(event.event_dates[0]) : null;
        const startsWithinLimit = firstDate && firstDate <= openingLimitDate;

        let newStatus: EventStatus | null = null;

        if (event.status !== EventStatus.ARCHIVED && shouldArchiveEvent(event.event_dates, now)) {
          // Latest event date is more than one year old -> archive it
          newStatus = EventStatus.ARCHIVED;
          updatedToArchivedCount++;
        } else if (allDatesInPast && event.status === EventStatus.OPEN) {
          // All dates are past and event is still OPEN -> should be CLOSED
          newStatus = EventStatus.CLOSED;
          updatedToClosedCount++;
        } else if (hasFutureDate && event.status === EventStatus.CLOSED && startsWithinLimit) {
          // Has future dates, is CLOSED, but within opening window -> should be OPEN
          newStatus = EventStatus.OPEN;
          updatedToOpenCount++;
        }

        if (newStatus) {
          // Update the event status
          await prisma.event.update({
            where: { id: event.id },
            data: { status: newStatus },
          });

          updatedEvents.push({
            id: event.id,
            title: event.title,
            oldStatus: event.status,
            newStatus: newStatus,
          });
        }
      }

      const totalUpdated = updatedToClosedCount + updatedToOpenCount + updatedToArchivedCount;

      return NextResponse.json({
        success: true,
        message: `Successfully updated ${totalUpdated} event(s) status`,
        summary: {
          totalEventsProcessed: allEvents.length,
          totalUpdated,
          updatedToClosedCount,
          updatedToOpenCount,
          updatedToArchivedCount,
        },
        updatedEvents,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error updating event statuses:', error);

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update event statuses',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          timestamp: new Date().toISOString(),
        },
        { status: 500 },
      );
    }
  });
}

/**
 * Manual trigger for status update with optional dry-run mode.
 * POST /api/cron/events/status-update
 * Body: { dryRun?: boolean }
 * @param req - The incoming request.
 * @returns JSON response with update status and details.
 */
export async function POST(req: NextRequest) {
  return requireCronAuth(req, async (req: NextRequest) => {
    try {
      const body = await req.json().catch(() => ({}));
      const { dryRun = false } = body;

      const now = new Date();
      const openingLimitDate = await HolidaysService.getOpeningLimitDate();

      // Get all events with their dates
      const allEvents = await prisma.event.findMany({
        select: {
          id: true,
          title: true,
          status: true,
          event_dates: true,
          protected_fields: true,
        },
      });

      let toCloseCount = 0;
      let toOpenCount = 0;
      let toArchiveCount = 0;
      const eventsToUpdate: {
        id: string;
        title: string;
        oldStatus: EventStatus;
        newStatus: EventStatus;
        dates: Date[];
      }[] = [];

      for (const event of allEvents) {
        if (event.protected_fields?.includes('status')) {
          continue;
        }

        if (!event.event_dates || event.event_dates.length === 0) {
          // Skip events with no dates
          continue;
        }

        // Check if all dates are in the past
        const allDatesInPast = event.event_dates.every((date: Date) => date < now);

        // Check if at least one date is in the future
        const hasFutureDate = event.event_dates.some((date: Date) => date >= now);

        // Check if event should be opened based on limit date
        const firstDate = event.event_dates.length > 0 ? new Date(event.event_dates[0]) : null;
        const startsWithinLimit = firstDate && firstDate <= openingLimitDate;

        let newStatus: EventStatus | null = null;

        if (event.status !== EventStatus.ARCHIVED && shouldArchiveEvent(event.event_dates, now)) {
          // Latest event date is more than one year old -> archive it
          newStatus = EventStatus.ARCHIVED;
          toArchiveCount++;
        } else if (allDatesInPast && event.status === EventStatus.OPEN) {
          // All dates are past and event is still OPEN -> should be CLOSED
          newStatus = EventStatus.CLOSED;
          toCloseCount++;
        } else if (hasFutureDate && event.status === EventStatus.CLOSED && startsWithinLimit) {
          // Has future dates, is CLOSED, but within opening window -> should be OPEN
          newStatus = EventStatus.OPEN;
          toOpenCount++;
        }

        if (newStatus) {
          eventsToUpdate.push({
            id: event.id,
            title: event.title,
            oldStatus: event.status,
            newStatus: newStatus,
            dates: event.event_dates,
          });

          // Only update if not in dry-run mode
          if (!dryRun) {
            await prisma.event.update({
              where: { id: event.id },
              data: { status: newStatus },
            });
          }
        }
      }

      const totalToUpdate = toCloseCount + toOpenCount + toArchiveCount;

      return NextResponse.json({
        success: true,
        dryRun,
        message: dryRun
          ? `Dry run: Would update ${totalToUpdate} event(s) status`
          : `Successfully updated ${totalToUpdate} event(s) status`,
        summary: {
          totalEventsProcessed: allEvents.length,
          totalToUpdate,
          toCloseCount,
          toOpenCount,
          toArchiveCount,
        },
        eventsToUpdate,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in status update operation:', error);

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to perform status update operation',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          timestamp: new Date().toISOString(),
        },
        { status: 500 },
      );
    }
  });
}
