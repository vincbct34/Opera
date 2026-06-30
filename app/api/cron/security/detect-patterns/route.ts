import { NextResponse, NextRequest } from 'next/server';
import { requireCronAuth } from '@/lib/middleware/cronAuth';
import { detectSuspiciousPatterns, createAdminSecurityAlert } from '@/lib/security/securityLogger';
import { logger } from '@/lib/middleware/logger';
import { SecuritySeverity } from '@/app/generated/prisma';

/**
 * GET /api/cron/security/detect-patterns
 * Detects suspicious security patterns and creates admin alerts.
 * @param req - The incoming request.
 * @returns JSON response with detection results.
 */
export async function GET(req: NextRequest) {
  return requireCronAuth(req, async () => {
    try {
      // Get hours to look back from query params (default: 24)
      const searchParams = req.nextUrl.searchParams;
      const hours = searchParams.has('hours') ? parseInt(searchParams.get('hours')!, 10) : 24;

      // Detect suspicious patterns
      const patterns = await detectSuspiciousPatterns(hours);

      // Only create alerts for CRITICAL and WARNING patterns
      const alertablePatterns = patterns.filter(
        (p) => p.severity === SecuritySeverity.CRITICAL || p.severity === SecuritySeverity.WARNING,
      );

      // Create admin notifications for each pattern
      let alertsCreated = 0;
      for (const pattern of alertablePatterns) {
        try {
          await createAdminSecurityAlert(pattern);
          alertsCreated++;
        } catch (error) {
          logger.error(`Failed to create alert for pattern ${pattern.type}:`, error);
        }
      }

      logger.info(
        `Security pattern detection completed: ${patterns.length} patterns found, ${alertsCreated} alerts created`,
      );

      return NextResponse.json({
        success: true,
        message: `${patterns.length} patterns détectés, ${alertsCreated} alertes créées`,
        stats: {
          totalPatterns: patterns.length,
          criticalPatterns: patterns.filter((p) => p.severity === SecuritySeverity.CRITICAL).length,
          warningPatterns: patterns.filter((p) => p.severity === SecuritySeverity.WARNING).length,
          alertsCreated,
          hoursScanned: hours,
        },
        patterns: patterns.length > 0 ? patterns : undefined,
      });
    } catch (error) {
      logger.error('Error detecting security patterns:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to detect security patterns',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 },
      );
    }
  });
}
