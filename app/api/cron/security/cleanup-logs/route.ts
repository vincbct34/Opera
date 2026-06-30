import { NextResponse, NextRequest } from 'next/server';
import { requireCronAuth } from '@/lib/middleware/cronAuth';
import { cleanupOldSecurityLogs } from '@/lib/security/securityLogger';
import { logger } from '@/lib/middleware/logger';

/**
 * GET /api/cron/security/cleanup-logs
 * Triggers the cleanup of old security logs.
 * Keeps logs for 90 days by default.
 * @param req - The incoming request.
 * @returns JSON response with cleanup results.
 */
export async function GET(req: NextRequest) {
  return requireCronAuth(req, async () => {
    try {
      // Get days to keep from query params (default: 90)
      const searchParams = req.nextUrl.searchParams;
      const daysToKeep = searchParams.has('days') ? parseInt(searchParams.get('days')!, 10) : 90;

      const deletedCount = await cleanupOldSecurityLogs(daysToKeep);

      logger.info(`Security logs cleanup completed: ${deletedCount} logs deleted`);

      return NextResponse.json({
        success: true,
        message: `${deletedCount} logs supprimés`,
        stats: {
          deletedCount,
          daysKept: daysToKeep,
        },
      });
    } catch (error) {
      logger.error('Error cleaning up security logs:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to cleanup security logs',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 },
      );
    }
  });
}
