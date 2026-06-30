import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import { listBackups, createBackup } from '@/lib/backup/backupService';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';

/**
 * GET /api/admin/backups
 * Lists all available database backups.
 * Protected by admin authentication.
 *
 * @returns JSON response with list of backups.
 */
export async function GET(request: NextRequest) {
  return requireAdmin(request as AuthenticatedRequest, async () => {
    try {
      const backups = await listBackups();

      return NextResponse.json({
        success: true,
        backups,
        count: backups.length,
      });
    } catch (error) {
      logger.error('Error listing backups:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { success: false, error: 'Failed to list backups' },
        { status: 500 },
      );
    }
  });
}

/**
 * POST /api/admin/backups
 * Creates a new database backup manually.
 * Protected by admin authentication.
 *
 * @returns JSON response with backup results.
 */
export async function POST(request: NextRequest) {
  return requireAdmin(request as AuthenticatedRequest, async () => {
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
      logger.error('Error creating backup:', ...sanitizeLogArgs(error));
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
