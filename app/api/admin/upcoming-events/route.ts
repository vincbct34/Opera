import { NextRequest, NextResponse } from 'next/server';
import { getUpcomingEvents, getTotalUpcomingEventsCount } from '@/lib/middleware/admin';
import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';

/**
 * GET /api/admin/upcoming-events
 * Retrieves upcoming events with pagination.
 * Query params:
 *   - page (optional): Page number. Defaults to 1.
 * @param request - The incoming request.
 * @returns JSON response with upcoming events and pagination info.
 */
export async function GET(request: NextRequest) {
  return requireAdmin(request as AuthenticatedRequest, async (req) => {
    try {
      const { searchParams } = new URL(req.url);
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
      const limit = 4;

      const events = await getUpcomingEvents(page, limit);
      const total = await getTotalUpcomingEventsCount();

      return NextResponse.json({ success: true, events, total, page, limit });
    } catch (error) {
      logger.error('Error fetching upcoming events:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        {
          success: false,
          events: [],
          total: 0,
          error: 'Failed to fetch upcoming events',
        },
        { status: 500 },
      );
    }
  });
}
