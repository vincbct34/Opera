import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';
import type { Accessibility } from '@prisma/client';
import {
  getRegistrationBlocksWithLegacyFallback,
  serializeRegistrationBlock,
} from '@/lib/events/registrationBlocks';

/**
 * GET /api/events/[slug]
 * Get detailed information about a specific event by slug or ID.
 * @param req - The incoming request.
 * @param context - The route context containing the event slug.
 * @returns JSON response with the event details.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;

    // Try to find event by slug first, fallback to ID for backwards compatibility
    let event = await prisma.event.findFirst({
      where: { slug },
      include: {
        accessibility: true,
        registrationBlocks: {
          orderBy: { order: 'asc' },
        },
        sessions: { orderBy: { date: 'asc' } },
      },
    });

    // Fallback: if no event found by slug, try by ID (for backwards compatibility)
    if (!event) {
      event = await prisma.event.findUnique({
        where: { id: slug },
        include: {
          accessibility: true,
          registrationBlocks: {
            orderBy: { order: 'asc' },
          },
          sessions: { orderBy: { date: 'asc' } },
        },
      });
    }

    if (!event) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
    }

    const payload = {
      id: event.id,
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
      booked_seats: event.booked_seats,
      status: event.status,
      image_url: event.image_url,
      created_at: event.created_at.toISOString(),
      updated_at: event.updated_at.toISOString(),
      event_dates: event.event_dates.map((d: Date) => d.toISOString()),
      sessions: event.sessions.map((s) => ({
        date: s.date.toISOString(),
        total_seats: s.total_seats,
        booked_seats: s.booked_seats,
      })),
      accessibility: event.accessibility.map((a: { type: Accessibility }) => a.type),
      has_initial_formation: event.has_initial_formation,
      is_formation_mandatory: event.is_formation_mandatory,
      has_musical_preparation: event.has_musical_preparation,
      registrationBlocks: getRegistrationBlocksWithLegacyFallback(event).map(
        serializeRegistrationBlock,
      ),
    };

    return NextResponse.json({ success: true, event: payload });
  } catch (error) {
    logger.error('Error fetching event from DB:', ...sanitizeLogArgs(error));
    return NextResponse.json({ success: false, error: 'Failed to fetch event' }, { status: 500 });
  }
}
