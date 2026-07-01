import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';
import { SecurityLogType, SecuritySeverity } from '@prisma/client';
import { getSecurityLogs, SecurityLogsFilter } from '@/lib/security/securityLogger';

/**
 * GET /api/admin/security-logs
 * Retrieves security logs with filtering and pagination
 * @query page - Page number (default: 1)
 * @query limit - Items per page (default: 50, max: 100)
 * @query type - Filter by log type
 * @query severity - Filter by severity (INFO, WARNING, CRITICAL)
 * @query userId - Filter by user ID
 * @query ipAddress - Filter by IP address
 * @query correlationId - Filter by correlation ID
 * @query startDate - Filter start date (ISO string)
 * @query endDate - Filter end date (ISO string)
 * @query search - Search in endpoint, IP, or user agent
 */
export async function GET(request: NextRequest) {
  return requireAdmin(request as AuthenticatedRequest, async () => {
    try {
      const searchParams = request.nextUrl.searchParams;

      // Parse pagination parameters
      const page = parseInt(searchParams.get('page') || '1', 10);
      const limit = parseInt(searchParams.get('limit') || '50', 10);

      // Parse filter parameters
      const filter: SecurityLogsFilter = {
        page,
        limit,
      };

      // Type filter
      if (searchParams.has('type')) {
        const type = searchParams.get('type') as SecurityLogType;
        if (Object.values(SecurityLogType).includes(type)) {
          filter.type = type;
        }
      }

      // Severity filter
      if (searchParams.has('severity')) {
        const severity = searchParams.get('severity') as SecuritySeverity;
        if (Object.values(SecuritySeverity).includes(severity)) {
          filter.severity = severity;
        }
      }

      // User ID filter
      if (searchParams.has('userId')) {
        filter.userId = searchParams.get('userId') || undefined;
      }

      // IP address filter
      if (searchParams.has('ipAddress')) {
        filter.ipAddress = searchParams.get('ipAddress') || undefined;
      }

      // Correlation ID filter
      if (searchParams.has('correlationId')) {
        filter.correlationId = searchParams.get('correlationId') || undefined;
      }

      // Date range filters
      if (searchParams.has('startDate')) {
        const startDate = searchParams.get('startDate');
        if (startDate) {
          filter.startDate = new Date(startDate);
        }
      }

      if (searchParams.has('endDate')) {
        const endDate = searchParams.get('endDate');
        if (endDate) {
          filter.endDate = new Date(endDate);
        }
      }

      // Search filter
      if (searchParams.has('search')) {
        filter.search = searchParams.get('search') || undefined;
      }

      const result = await getSecurityLogs(filter);

      return NextResponse.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Error fetching security logs:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch security logs',
        },
        { status: 500 },
      );
    }
  });
}
