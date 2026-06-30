import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/app/api/middleware';
import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';

/**
 * GET /api/registrations
 * Get all registrations for the authenticated user.
 * Returns registrations with full event details and institution information.
 * Query params:
 *   - page (optional): Page number for pagination
 *   - limit (optional): Number of items per page
 * @param req - The incoming request.
 * @returns JSON response with registrations and pagination info.
 */
export async function GET(req: NextRequest) {
  return requireAuth(req as AuthenticatedRequest, async (authReq: AuthenticatedRequest) => {
    try {
      const userId = authReq.user!.id;

      const { searchParams } = new URL(req.url);
      const page = parseInt(searchParams.get('page') || '1');
      const limitParam = searchParams.get('limit');
      const limit = limitParam ? parseInt(limitParam) : 10;
      const shouldPaginate = limit > 0;
      const skip = shouldPaginate ? (page - 1) * limit : undefined;

      const [registrations, total] = await Promise.all([
        prisma.registration.findMany({
          where: { user_id: userId },
          include: {
            event: {
              include: {
                accessibility: true,
              },
            },
            institution: {
              include: {
                address: true,
              },
            },
            disabilities: {
              select: {
                id: true,
                type: true,
                count: true,
                details: true,
                // Include registration_id to help with deletion if needed
                registration_id: true,
              },
            },
          },
          orderBy: { created_at: 'desc' },
          ...(shouldPaginate && { skip, take: limit }),
        }),
        prisma.registration.count({
          where: { user_id: userId },
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
      logger.error('Error fetching registrations:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des demandes' },
        { status: 500 },
      );
    }
  });
}
