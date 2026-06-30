import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';
import { getSecurityStats } from '@/lib/security/securityLogger';

/**
 * GET /api/admin/security-stats
 * Retrieves security statistics for a given time period
 * @query startDate - Start date (ISO string, default: 30 days ago)
 * @query endDate - End date (ISO string, default: now)
 * @query detectPatterns - Whether to detect suspicious patterns (default: true)
 */
export async function GET(request: NextRequest) {
  return requireAdmin(request as AuthenticatedRequest, async () => {
    try {
      const searchParams = request.nextUrl.searchParams;

      // Default to last 30 days
      const endDate = new Date();
      const startDate = searchParams.has('startDate')
        ? new Date(searchParams.get('startDate')!)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      if (searchParams.has('endDate')) {
        const endDateParam = searchParams.get('endDate');
        if (endDateParam) {
          endDate.setTime(new Date(endDateParam).getTime());
        }
      }

      const detectPatterns = searchParams.get('detectPatterns') !== 'false';

      const stats = await getSecurityStats(startDate, endDate);

      // If pattern detection is disabled, clear the patterns array
      if (!detectPatterns) {
        stats.suspiciousPatterns = [];
      }

      return NextResponse.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error fetching security stats:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch security statistics',
        },
        { status: 500 },
      );
    }
  });
}
