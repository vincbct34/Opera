import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';
import { getSecurityStats } from '@/lib/security/securityLogger';

/**
 * Compliance report data structure
 */
interface ComplianceReport {
  reportDate: string;
  period: { startDate: string; endDate: string };
  summary: {
    totalSecurityEvents: number;
    criticalEvents: number;
    warningEvents: number;
    infoEvents: number;
    failedLoginAttempts: number;
    suspiciousPatternsDetected: number;
  };
  eventTypeBreakdown: Record<string, number>;
  topSourceIPs: Array<{ ipAddress: string; eventCount: number }>;
  suspiciousPatterns: Array<{
    type: string;
    severity: string;
    description: string;
    count: number;
  }>;
  recommendations: string[];
}

/**
 * GET /api/admin/security-report
 * Generates a compliance report for a given time period
 * @query startDate - Start date (ISO string, default: 30 days ago)
 * @query endDate - End date (ISO string, default: now)
 * @query format - Response format (json or csv, default: json)
 */
export async function GET(request: NextRequest) {
  return requireAdmin(request as AuthenticatedRequest, async () => {
    try {
      const searchParams = request.nextUrl.searchParams;
      const format = searchParams.get('format') || 'json';

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

      // Get security statistics
      const stats = await getSecurityStats(startDate, endDate);

      // Build compliance report
      const report: ComplianceReport = {
        reportDate: new Date().toISOString(),
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        summary: {
          totalSecurityEvents: stats.totalEvents,
          criticalEvents: stats.bySeverity.CRITICAL || 0,
          warningEvents: stats.bySeverity.WARNING || 0,
          infoEvents: stats.bySeverity.INFO || 0,
          failedLoginAttempts: stats.failedLogins,
          suspiciousPatternsDetected: stats.suspiciousPatterns.length,
        },
        eventTypeBreakdown: stats.byType,
        topSourceIPs: stats.topIps.map((ip) => ({
          ipAddress: ip.ipAddress,
          eventCount: ip.count,
        })),
        suspiciousPatterns: stats.suspiciousPatterns.map((p) => ({
          type: p.type,
          severity: p.severity,
          description: p.description,
          count: p.count,
        })),
        recommendations: generateRecommendations(stats),
      };

      // Return based on format
      if (format === 'csv') {
        // Generate CSV format
        const csv = generateComplianceCSV(report);
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="security-report-${new Date().toISOString().split('T')[0]}.csv"`,
          },
        });
      }

      return NextResponse.json({
        success: true,
        data: report,
      });
    } catch (error) {
      logger.error('Error generating compliance report:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate compliance report',
        },
        { status: 500 },
      );
    }
  });
}

/**
 * Generate security recommendations based on statistics
 */
function generateRecommendations(stats: {
  totalEvents: number;
  bySeverity: Record<string, number>;
  failedLogins: number;
  suspiciousPatterns: Array<{ type: string; count: number }>;
}): string[] {
  const recommendations: string[] = [];

  // High number of failed logins
  if (stats.failedLogins > 100) {
    recommendations.push(
      `Nombre élevé de tentatives de connexion échouées (${stats.failedLogins}). Envisagez de renforcer la politique de mots de passe ou d'implémenter une protection supplémentaire contre les attaques par force brute.`,
    );
  }

  // Critical events
  if ((stats.bySeverity.CRITICAL || 0) > 10) {
    recommendations.push(
      `${stats.bySeverity.CRITICAL} événements critiques détectés. Une investigation immédiate est recommandée.`,
    );
  }

  // Suspicious patterns
  if (stats.suspiciousPatterns.length > 0) {
    const bruteForcePatterns = stats.suspiciousPatterns.filter(
      (p) => p.type.includes('BRUTE_FORCE') || p.type.includes('RATE_LIMIT'),
    );

    if (bruteForcePatterns.length > 0) {
      recommendations.push(
        "Des patterns de force brute ou d'abus de rate limiting ont été détectés. Envisagez de bloquer les adresses IP concernées.",
      );
    }

    const unauthorizedPatterns = stats.suspiciousPatterns.filter(
      (p) => p.type.includes('UNAUTHORIZED') || p.type.includes('SUSPICIOUS'),
    );

    if (unauthorizedPatterns.length > 0) {
      recommendations.push(
        "Des tentatives d'accès non autorisé ont été détectées. Vérifiez les permissions des utilisateurs et les contrôles d'accès.",
      );
    }
  }

  // General recommendations
  if (recommendations.length === 0) {
    recommendations.push(
      'Aucune anomalie majeure détectée. Continuez à surveiller les logs de sécurité régulièrement.',
    );
  }

  return recommendations;
}

/**
 * Generate CSV format for compliance report
 */
function generateComplianceCSV(report: ComplianceReport): string {
  const lines: string[] = [];

  // Header
  lines.push('RAPPORT DE CONFORMITÉ SÉCURITÉ');
  lines.push('');
  lines.push(`Date du rapport,${report.reportDate}`);
  lines.push(`Période,${report.period.startDate} à ${report.period.endDate}`);
  lines.push('');

  // Summary
  lines.push('RÉSUMÉ');
  lines.push('Métrique,Valeur');
  lines.push(`Total événements,${report.summary.totalSecurityEvents}`);
  lines.push(`Événements critiques,${report.summary.criticalEvents}`);
  lines.push(`Événements d\'avertissement,${report.summary.warningEvents}`);
  lines.push(`Événements d\'information,${report.summary.infoEvents}`);
  lines.push(`Tentatives de connexion échouées,${report.summary.failedLoginAttempts}`);
  lines.push(`Patterns suspects détectés,${report.summary.suspiciousPatternsDetected}`);
  lines.push('');

  // Event type breakdown
  lines.push("TYPES D'ÉVÉNEMENTS");
  lines.push('Type,Nombre');
  Object.entries(report.eventTypeBreakdown).forEach(([type, count]) => {
    lines.push(`${type},${count}`);
  });
  lines.push('');

  // Top source IPs
  lines.push('TOP ADRESSES IP SOURCES');
  lines.push("Adresse IP,Nombre d'événements");
  report.topSourceIPs.slice(0, 20).forEach((ip) => {
    lines.push(`${ip.ipAddress},${ip.eventCount}`);
  });
  lines.push('');

  // Suspicious patterns
  if (report.suspiciousPatterns.length > 0) {
    lines.push('PATTERNS SUSPECTS');
    lines.push('Type,Sévérité,Description,Nombre');
    report.suspiciousPatterns.forEach((pattern) => {
      lines.push(
        `"${pattern.type}","${pattern.severity}","${pattern.description}",${pattern.count}`,
      );
    });
    lines.push('');
  }

  // Recommendations
  lines.push('RECOMMANDATIONS');
  report.recommendations.forEach((rec, index) => {
    lines.push(`${index + 1},"${rec}"`);
  });

  return lines.join('\n');
}
