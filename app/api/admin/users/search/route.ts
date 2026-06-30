import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';

/**
 * GET /api/admin/users/search
 * Search for users by email, first name, or last name.
 * Admin only endpoint.
 *
 * Query params:
 * - q: search query (min 2 characters)
 * - limit: maximum results (default 10, max 50)
 *
 * @param req - The incoming request
 * @returns JSON response with array of users
 */
export const GET = async (req: NextRequest) => {
  return requireAdmin(req as AuthenticatedRequest, async () => {
    try {
      const { searchParams } = new URL(req.url);
      const query = searchParams.get('q');
      const limit = Math.min(Number(searchParams.get('limit') || '10'), 50);

      if (!query || query.length < 2) {
        return NextResponse.json(
          { error: 'Requête trop courte (min 2 caractères)' },
          { status: 400 },
        );
      }

      // Search by email, first_name, or last_name
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: query, mode: 'insensitive' } },
            { first_name: { contains: query, mode: 'insensitive' } },
            { last_name: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          role: true,
        },
        take: limit,
        orderBy: { email: 'asc' },
      });

      return NextResponse.json({ users });
    } catch (error) {
      logger.error('Error searching users:', ...sanitizeLogArgs(error));
      return NextResponse.json({ error: 'Erreur lors de la recherche' }, { status: 500 });
    }
  });
};
