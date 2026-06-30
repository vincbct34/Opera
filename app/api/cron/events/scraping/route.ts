import { NextResponse, NextRequest } from 'next/server';

import { requireCronAuth } from '@/lib/middleware/cronAuth';
import { scrapeEvents, ApiEvent } from '@/lib/cron/eventsScraper';
import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { HolidaysService } from '@/lib/services/holidays.service';

async function insertEventsToDatabase(events: ApiEvent[]) {
  const insertedEvents = [];
  const errors = [];

  // Get the opening limit date once for the batch
  const openingLimitDate = await HolidaysService.getOpeningLimitDate();

  for (const event of events) {
    try {
      // Check if an event with the same title and dates already exists
      const existingEvent = await prisma.event.findFirst({
        where: {
          title: event.title,
          event_dates: {
            hasSome: event.event_dates,
          },
        },
      });

      if (existingEvent) {
        // Build update data respecting protected fields
        const protectedFields = existingEvent.protected_fields || [];

        const updateData: Record<string, unknown> = {
          updated_at: new Date(),
        };

        // Only update fields that are not protected
        if (!protectedFields.includes('slug')) {
          updateData.slug = event.slug;
        }
        if (!protectedFields.includes('description')) {
          updateData.description = event.description;
        }
        if (!protectedFields.includes('type')) {
          updateData.type = event.type;
        }
        if (!protectedFields.includes('category')) {
          updateData.category = event.category;
        }
        if (!protectedFields.includes('grades')) {
          updateData.grades = event.grades;
        }
        if (!protectedFields.includes('age_ranges')) {
          updateData.age_ranges = event.age_ranges;
        }
        if (!protectedFields.includes('location')) {
          updateData.location = event.location;
        }
        if (!protectedFields.includes('duration')) {
          updateData.duration = event.duration;
        }
        if (!protectedFields.includes('total_seats')) {
          updateData.total_seats = event.total_seats;
        }
        if (!protectedFields.includes('caretaker')) {
          updateData.caretaker = event.caretaker;
        }
        if (!protectedFields.includes('image_url')) {
          updateData.image_url = event.image_url;
        }
        if (!protectedFields.includes('event_dates')) {
          updateData.event_dates = event.event_dates;
        }
        if (!protectedFields.includes('has_initial_formation')) {
          updateData.has_initial_formation = event.has_initial_formation;
        }
        if (!protectedFields.includes('has_musical_preparation')) {
          updateData.has_musical_preparation = event.has_musical_preparation;
        }
        if (!protectedFields.includes('accessibility')) {
          updateData.accessibility = {
            deleteMany: {},
            create: event.accessibility.map((type) => ({ type })),
          };
        }

        // Update existing event
        const updatedEvent = await prisma.event.update({
          where: { id: existingEvent.id },
          data: updateData,
        });
        insertedEvents.push({ ...updatedEvent, status: 'updated' });
      } else {
        // Determine status based on opening limit
        // Logic: Event is OPEN if it starts before or on the limit date
        const firstDate = event.event_dates.length > 0 ? event.event_dates[0] : null;
        const initialStatus =
          firstDate && new Date(firstDate) <= openingLimitDate ? 'OPEN' : 'CLOSED';

        const newEvent = await prisma.event.create({
          data: {
            title: event.title,
            slug: event.slug,
            description: event.description,
            type: event.type,
            category: event.category,
            grades: event.grades,
            age_ranges: event.age_ranges,
            location: event.location,
            duration: event.duration,
            total_seats: event.total_seats,
            caretaker: event.caretaker,
            image_url: event.image_url,
            event_dates: event.event_dates,
            has_initial_formation: event.has_initial_formation,
            has_musical_preparation: event.has_musical_preparation,
            accessibility: {
              create: event.accessibility.map((type) => ({ type })),
            },
            booked_seats: 0,
            status: initialStatus,
          },
        });
        insertedEvents.push({ ...newEvent, status: 'created' });
      }
    } catch (error) {
      logger.error(`Error inserting event "${event.title}":`, error);
      errors.push({
        title: event.title,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return { insertedEvents, errors };
}

/**
 * GET /api/cron/events/scraping
 * Triggers the event scraping process.
 * @param req - The incoming request.
 * @returns JSON response with scraping results and statistics.
 */
export async function GET(req: NextRequest) {
  return requireCronAuth(req, async () => {
    try {
      const events = await scrapeEvents();
      const { insertedEvents, errors } = await insertEventsToDatabase(events);

      return NextResponse.json({
        success: true,
        message: `${insertedEvents.length} événements traités`,
        stats: {
          total: events.length,
          created: insertedEvents.filter((e) => e.status === 'created').length,
          updated: insertedEvents.filter((e) => e.status === 'updated').length,
          errors: errors.length,
        },
        events: insertedEvents.map((e) => ({ id: e.id, title: e.title, status: e.status })),
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      logger.error('Error scraping events:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to scrape events',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 },
      );
    }
  });
}
