import { NextRequest, NextResponse } from 'next/server';

import { requireAuth, AuthenticatedRequest } from '@/app/api/middleware';

import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';

/**
 * GET /api/institutions/[id]/registrations
 * Get registrations for a specific institution.
 * Query params:
 *   - page (optional): Page number for pagination
 *   - limit (optional): Number of items per page
 * @param req - The incoming request.
 * @param context - The route context containing the institution ID.
 * @returns JSON response with registrations and pagination info.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return requireAuth(req as AuthenticatedRequest, async () => {
    try {
      const { id } = await context.params;

      const { searchParams } = new URL(req.url);
      const page = parseInt(searchParams.get('page') || '1');
      const limitParam = searchParams.get('limit');
      const limit = limitParam ? parseInt(limitParam) : 10;
      const shouldPaginate = limit > 0;
      const skip = shouldPaginate ? (page - 1) * limit : undefined;

      const [registrations, total] = await Promise.all([
        prisma.registration.findMany({
          where: { institution_id: id },
          include: {
            event: true,
            user: true,
            disabilities: true,
            blockSelections: {
              select: {
                id: true,
                wants_to_attend: true,
                selected_date: true,
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
          },
          orderBy: { created_at: 'desc' },
          ...(shouldPaginate && { skip, take: limit }),
        }),
        prisma.registration.count({
          where: { institution_id: id },
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
      logger.error('Error fetching registrations for institution:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des inscriptions' },
        { status: 500 },
      );
    }
  });
}
