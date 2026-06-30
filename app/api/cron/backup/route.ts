import { NextResponse, NextRequest } from 'next/server';
import { requireCronAuth } from '@/lib/middleware/cronAuth';
import { createBackup } from '@/lib/backup/backupService';
import { logger } from '@/lib/middleware/logger';

/**
 * GET /api/cron/backup
 * Triggers the creation of a database backup.
 * Protected by CRON_SECRET authentication.
 *
 * Manual trigger (requires CRON_SECRET):
 *   curl http://localhost:3000/api/cron/backup \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET"
 *
 * @param req - The incoming request.
 * @returns JSON response with backup results and statistics.
 */
export async function GET(req: NextRequest) {
  return requireCronAuth(req, async () => {
    try {
      const result = await createBackup();

      return NextResponse.json({
        success: true,
        message: `Backup créée: ${result.filename}`,
        stats: {
          filename: result.filename,
          sizeBytes: result.sizeBytes,
          tableCount: result.tableCount,
          recordCounts: result.recordCounts,
          oldBackupsRemoved: result.cleanedUp,
        },
      });
    } catch (error) {
      logger.error('Error creating backup:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create backup',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 },
      );
    }
  });
}
