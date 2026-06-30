import { NextRequest, NextResponse } from 'next/server';
import { createAuthMiddleware, AuthenticatedRequest } from '@/app/api/middleware';
import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';

// Middleware for public endpoint with rate limiting to prevent data scraping
const eventsMiddleware = createAuthMiddleware({
  requireAuth: false, // Public endpoint
  requireCSRF: false, // No CSRF needed for GET
  rateLimitConfig: 'search', // 300 requests/minute
});

/**
 * GET /api/events
 * Get a list of all events (public endpoint).
 * Includes accessibility information.
 * @param req - The incoming request.
 * @returns JSON response with the list of events.
 */
export async function GET(req: NextRequest) {
  return eventsMiddleware(req as AuthenticatedRequest, async () => {
    try {
      const events = await prisma.event.findMany({
        orderBy: { created_at: 'desc' },
        include: { accessibility: true },
      });

      const payload = events.map((e) => ({
        id: e.id,
        title: e.title,
        slug: e.slug,
        description: e.description,
        type: e.type,
        category: e.category,
        grades: e.grades,
        age_ranges: e.age_ranges,
        location: e.location,
        duration: e.duration,
        total_seats: e.total_seats,
        booked_seats: e.booked_seats,
        status: e.status,
        image_url: e.image_url,
        created_at: e.created_at.toISOString(),
        updated_at: e.updated_at.toISOString(),
        event_dates: e.event_dates.map((d) => d.toISOString()),
        accessibility: e.accessibility.map((a) => a.type),
        has_initial_formation: e.has_initial_formation,
        is_formation_mandatory: e.is_formation_mandatory,
        has_musical_preparation: e.has_musical_preparation,
        registrations: [],
      }));

      return NextResponse.json({ success: true, events: payload, total: payload.length });
    } catch (error) {
      logger.error('Error fetching events from DB:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { success: false, events: [], total: 0, error: 'failed to fetch' },
        { status: 500 },
      );
    }
  });
}
