import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import { restoreBackup } from '@/lib/backup/backupService';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';

/**
 * POST /api/admin/backups/restore
 * Restores the database from a backup file.
 * A safety backup is automatically created before restoring.
 * Protected by admin authentication.
 *
 * Body:
 * - filename: The backup file to restore from
 *
 * @returns JSON response with restore results.
 */
export async function POST(request: NextRequest) {
  return requireAdmin(request as AuthenticatedRequest, async (req) => {
    try {
      const body = await req.json();
      const { filename } = body;

      if (!filename || typeof filename !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Le champ "filename" est requis' },
          { status: 400 },
        );
      }

      logger.info(`Admin restore initiated for backup: ${filename}`);

      const result = await restoreBackup(filename);

      logger.info(`Admin restore completed: ${filename} (safety backup: ${result.safetyBackup})`);

      return NextResponse.json({
        success: true,
        message: 'Base de données restaurée avec succès',
        result: {
          restoredFrom: result.restoredFrom,
          safetyBackup: result.safetyBackup,
          recordCounts: result.recordCounts,
        },
      });
    } catch (error) {
      logger.error('Error restoring backup:', ...sanitizeLogArgs(error));

      const message = error instanceof Error ? error.message : 'Unknown error';
      const status = message.includes('not found') ? 404 : 500;

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to restore backup',
          details: message,
        },
        { status },
      );
    }
  });
}
