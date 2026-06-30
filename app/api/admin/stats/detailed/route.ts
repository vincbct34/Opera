import { NextResponse, NextRequest } from 'next/server';
import {
  getDashboardStats,
  getRegistrationStatsByStatus,
  getUserStatsByRole,
  getEventCapacityStats,
  getRegistrationTrendData,
  getTopInstitutionsByRegistrations,
  getTopEventsByRegistrations,
} from '@/lib/middleware/admin';
import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';

/**
 * GET /api/admin/stats/detailed
 * Retrieves detailed statistics for the admin dashboard.
 * Query params:
 *   - period (optional): 'all', 'week', 'month', 'year'. Defaults to 'month'.
 * @param request - The incoming request.
 * @returns JSON response with detailed statistics.
 */
export async function GET(request: NextRequest) {
  return requireAdmin(request as AuthenticatedRequest, async (req) => {
    try {
      // Get period from query params
      const searchParams = req.nextUrl.searchParams;
      const period = (searchParams.get('period') || 'month') as 'all' | 'week' | 'month' | 'year';

      // Determine days based on period
      let days: number | null = null;
      switch (period) {
        case 'week':
          days = 7;
          break;
        case 'month':
          days = 30;
          break;
        case 'year':
          days = 365;
          break;
        case 'all':
          days = null; // No time limit
          break;
        default:
          days = 30;
      }

      const [
        dashboardStats,
        registrationsByStatus,
        usersByRole,
        eventCapacity,
        registrationTrend,
        topInstitutions,
        topEvents,
      ] = await Promise.all([
        getDashboardStats(days),
        getRegistrationStatsByStatus(days),
        getUserStatsByRole(days),
        getEventCapacityStats(days),
        getRegistrationTrendData(days),
        getTopInstitutionsByRegistrations(10, days),
        getTopEventsByRegistrations(20, days),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          dashboardStats,
          registrationsByStatus,
          usersByRole,
          eventCapacity,
          registrationTrend,
          topInstitutions,
          topEvents,
        },
      });
    } catch (error) {
      logger.error('Error fetching detailed admin stats:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch detailed stats',
        },
        { status: 500 },
      );
    }
  });
}
