import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import { compareBackup } from '@/lib/backup/backupService';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';

/**
 * GET /api/admin/backups/compare?filename=backup-2026-02-22_10-00-00.json
 * Compares a backup with the current database state.
 * Protected by admin authentication.
 *
 * Query params:
 * - filename: The backup file to compare
 *
 * @returns JSON response with table-by-table diff.
 */
export async function GET(request: NextRequest) {
  return requireAdmin(request as AuthenticatedRequest, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const filename = searchParams.get('filename');

      if (!filename) {
        return NextResponse.json(
          { success: false, error: 'Le paramètre "filename" est requis' },
          { status: 400 },
        );
      }

      const comparison = await compareBackup(filename);

      return NextResponse.json({
        success: true,
        comparison,
      });
    } catch (error) {
      logger.error('Error comparing backup:', ...sanitizeLogArgs(error));

      const message = error instanceof Error ? error.message : 'Unknown error';
      const status = message.includes('not found') ? 404 : 500;

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to compare backup',
          details: message,
        },
        { status },
      );
    }
  });
}
