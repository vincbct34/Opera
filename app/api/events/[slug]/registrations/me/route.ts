import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/app/api/middleware';
import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';

/**
 * GET /api/events/[slug]/registrations/me
 * Get current user's registrations for a specific event.
 * @param req - The incoming request.
 * @param context - The route context containing the event slug.
 * @returns JSON response with the user's registrations for the event.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  return requireAuth(req as AuthenticatedRequest, async (authReq: AuthenticatedRequest) => {
    try {
      const { slug } = await context.params;
      const userId = authReq.user!.id;

      // Find event by slug or ID
      let event = await prisma.event.findFirst({
        where: { slug },
        select: { id: true },
      });

      if (!event) {
        event = await prisma.event.findUnique({
          where: { id: slug },
          select: { id: true },
        });
      }

      if (!event) {
        return NextResponse.json({ error: 'Événement introuvable' }, { status: 404 });
      }

      const registrations = await prisma.registration.findMany({
        where: {
          event_id: event.id,
          user_id: userId,
          status: {
            not: 'CANCELLED', // Exclude cancelled registrations
          },
        },
        select: {
          id: true,
          user_id: true,
          institution_id: true,
          event_id: true,
          date: true,
          booked_seats: true,
          caretaker_count: true,
          aesh_count: true,
          status: true,
          manager_first_name: true,
          manager_last_name: true,
          manager_email: true,
          manager_phone_number: true,
          comments: true,
          was_present_comment: true,
          created_at: true,
          updated_at: true,
          category: true,
          grades: true,
          age_ranges: true,
          want_formation: true,
          want_preparation: true,
          blockSelections: {
            select: {
              id: true,
              wants_to_attend: true,
              selected_date: true,
              selected_end_date: true,
              block: {
                select: {
                  id: true,
                  title: true,
                  mandatory: true,
                },
              },
            },
            orderBy: {
              block: {
                order: 'asc',
              },
            },
          },
          institution: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          disabilities: {
            select: {
              id: true,
              type: true,
              count: true,
              details: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });

      return NextResponse.json({ registrations });
    } catch (error) {
      logger.error('Error fetching user event registrations:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des inscriptions' },
        { status: 500 },
      );
    }
  });
}
