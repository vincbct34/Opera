import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';

/**
 * GET /api/users/[id]/registrations
 * Get all registrations for a specific user (admin only).
 * Query params:
 *   - page (optional): default 1
 *   - limit (optional): default 10
 * @param req - The incoming request.
 * @param context - The route context containing the user ID.
 * @returns JSON response with registrations and pagination info.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return requireAdmin(req as AuthenticatedRequest, async () => {
    try {
      const { id } = await context.params;
      const { searchParams } = new URL(req.url);
      const page = parseInt(searchParams.get('page') || '1');
      const limitParam = searchParams.get('limit');
      const limit = limitParam ? parseInt(limitParam) : 10;
      const shouldPaginate = limit > 0;
      const skip = shouldPaginate ? (page - 1) * limit : undefined;

      // Ensure user exists
      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!user) {
        return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
      }

      const [registrations, total] = await Promise.all([
        prisma.registration.findMany({
          where: { user_id: id },
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
            event: {
              select: {
                id: true,
                title: true,
                location: true,
              },
            },
            institution: {
              select: {
                id: true,
                name: true,
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
          ...(shouldPaginate && { skip, take: limit }),
        }),
        prisma.registration.count({
          where: { user_id: id },
        }),
      ]);

      return NextResponse.json({
        registrations,
        pagination: {
          page,
          limit: shouldPaginate ? limit : total,
          total,
          totalPages: shouldPaginate ? Math.ceil(total / limit) : 1,
        },
      });
    } catch (error) {
      logger.error('Error fetching user registrations:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des inscriptions' },
        { status: 500 },
      );
    }
  });
}
