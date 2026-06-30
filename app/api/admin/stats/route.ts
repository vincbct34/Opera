import { NextRequest, NextResponse } from 'next/server';
import { getDashboardStats } from '@/lib/middleware/admin';
import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';

/**
 * GET /api/admin/stats
 * Retrieves summary statistics for the admin dashboard.
 * @param request - The incoming request.
 * @returns JSON response with summary statistics.
 */
export async function GET(request: NextRequest) {
  return requireAdmin(request as AuthenticatedRequest, async () => {
    try {
      const stats = await getDashboardStats();

      return NextResponse.json({ success: true, stats });
    } catch (error) {
      logger.error('Error fetching admin stats:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        {
          success: false,
          stats: {
            upcomingEvents: 0,
            totalUsers: 0,
            totalInstitutions: 0,
            pendingRegistrations: 0,
          },
          error: 'Failed to fetch stats',
        },
        { status: 500 },
      );
    }
  });
}
