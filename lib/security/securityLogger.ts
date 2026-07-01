import {
  SecurityLogType,
  SecuritySeverity,
  NotificationType,
  Prisma,
  SecurityLog,
} from '@prisma/client';
import prisma from '../middleware/prismaConfig';
import { NextRequest } from 'next/server';
import { logger } from '../middleware/logger';
import { randomBytes } from 'crypto';

/**
 * Security logging service for tracking security-related events
 * All logs are persisted to the database for audit purposes
 */

/**
 * Structure for security log data.
 */
interface SecurityLogData {
  type: SecurityLogType;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  status?: number;
  details?: Record<string, unknown>;
  severity?: SecuritySeverity;
  correlationId?: string;
}

/**
 * Generate a unique correlation ID for tracking related security events
 */
export function generateCorrelationId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Log security event to console (for development)
 */
export function logToConsoleInDev(data: SecurityLogData): void {
  if (process.env.NODE_ENV === 'development') {
    const emoji = getSeverityEmoji(data.severity || SecuritySeverity.INFO);
    logger.log(`${emoji} Security Log [${data.type}]:`, {
      userId: data.userId,
      endpoint: data.endpoint,
      details: data.details,
    });
  }
}

/**
 * Log a security event to the database.
 * Also logs to console in development environment.
 * @param data - The security event data to log.
 */
export async function logSecurityEvent(data: SecurityLogData): Promise<void> {
  try {
    await prisma.securityLog.create({
      data: {
        type: data.type,
        user_id: data.userId,
        ip_address: data.ipAddress,
        user_agent: data.userAgent,
        endpoint: data.endpoint,
        method: data.method,
        status: data.status,
        details: (data.details as Prisma.InputJsonValue) || Prisma.JsonNull,
        severity: data.severity || SecuritySeverity.INFO,
        correlationId: data.correlationId,
      },
    });

    // Also log to console in development
    logToConsoleInDev(data);
  } catch (error) {
    // Don't throw errors from logging - just log to console
    logger.error('Failed to log security event:', error);
  }
}

/**
 * Helper function to extract client information from a request
 */
export function getClientInfo(req: NextRequest) {
  const ipAddress =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  const userAgent = req.headers.get('user-agent') || 'unknown';

  return { ipAddress, userAgent };
}

/**
 * Log a successful login
 */
export async function logLoginSuccess(userId: string, req: NextRequest): Promise<void> {
  const { ipAddress, userAgent } = getClientInfo(req);

  await logSecurityEvent({
    type: SecurityLogType.LOGIN_SUCCESS,
    userId,
    ipAddress,
    userAgent,
    endpoint: '/api/auth/login',
    method: 'POST',
    status: 200,
    severity: SecuritySeverity.INFO,
  });
}

/**
 * Log a failed login attempt
 */
export async function logLoginFailed(
  email: string,
  req: NextRequest,
  reason: string,
): Promise<void> {
  const { ipAddress, userAgent } = getClientInfo(req);

  await logSecurityEvent({
    type: SecurityLogType.LOGIN_FAILED,
    ipAddress,
    userAgent,
    endpoint: '/api/auth/login',
    method: 'POST',
    status: 401,
    details: { email, reason },
    severity: SecuritySeverity.WARNING,
  });
}

/**
 * Log a logout
 */
export async function logLogout(userId: string, req: NextRequest): Promise<void> {
  const { ipAddress, userAgent } = getClientInfo(req);

  await logSecurityEvent({
    type: SecurityLogType.LOGOUT,
    userId,
    ipAddress,
    userAgent,
    endpoint: '/api/auth/logout',
    method: 'POST',
    status: 200,
    severity: SecuritySeverity.INFO,
  });
}

/**
 * Log admin access
 */
export async function logAdminAccess(
  userId: string,
  req: NextRequest,
  action: string,
): Promise<void> {
  const { ipAddress, userAgent } = getClientInfo(req);

  await logSecurityEvent({
    type: SecurityLogType.ADMIN_ACCESS,
    userId,
    ipAddress,
    userAgent,
    endpoint: req.nextUrl.pathname,
    method: req.method,
    details: { action },
    severity: SecuritySeverity.WARNING,
  });
}

/**
 * Log data modification
 */
export async function logDataModification(
  userId: string,
  req: NextRequest,
  resourceType: string,
  resourceId: string,
  action: 'create' | 'update' | 'delete',
): Promise<void> {
  const { ipAddress, userAgent } = getClientInfo(req);

  await logSecurityEvent({
    type: SecurityLogType.DATA_MODIFIED,
    userId,
    ipAddress,
    userAgent,
    endpoint: req.nextUrl.pathname,
    method: req.method,
    details: { resourceType, resourceId, action },
    severity: SecuritySeverity.INFO,
  });
}

/**
 * Log suspicious activity
 */
export async function logSuspiciousActivity(
  req: NextRequest,
  userId: string | undefined,
  reason: string,
  details?: Record<string, unknown>,
): Promise<void> {
  const { ipAddress, userAgent } = getClientInfo(req);

  await logSecurityEvent({
    type: SecurityLogType.SUSPICIOUS_ACTIVITY,
    userId,
    ipAddress,
    userAgent,
    endpoint: req.nextUrl.pathname,
    method: req.method,
    details: { reason, ...details },
    severity: SecuritySeverity.CRITICAL,
  });
}

/**
 * Log rate limit exceeded
 */
export async function logRateLimitExceeded(req: NextRequest, identifier: string): Promise<void> {
  const { ipAddress, userAgent } = getClientInfo(req);

  await logSecurityEvent({
    type: SecurityLogType.RATE_LIMIT_EXCEEDED,
    ipAddress,
    userAgent,
    endpoint: req.nextUrl.pathname,
    method: req.method,
    details: { identifier },
    severity: SecuritySeverity.WARNING,
  });
}

/**
 * Log password change
 */
export async function logPasswordChange(userId: string, req: NextRequest): Promise<void> {
  const { ipAddress, userAgent } = getClientInfo(req);

  await logSecurityEvent({
    type: SecurityLogType.PASSWORD_CHANGE,
    userId,
    ipAddress,
    userAgent,
    endpoint: '/api/auth/change-password',
    method: 'POST',
    status: 200,
    severity: SecuritySeverity.WARNING,
  });
}

/**
 * Log password reset request
 */
export async function logPasswordResetRequest(email: string, req: NextRequest): Promise<void> {
  const { ipAddress, userAgent } = getClientInfo(req);

  await logSecurityEvent({
    type: SecurityLogType.PASSWORD_RESET_REQUEST,
    ipAddress,
    userAgent,
    endpoint: '/api/auth/reset-password',
    method: 'POST',
    details: { email },
    severity: SecuritySeverity.INFO,
  });
}

/**
 * Log successful password reset
 */
export async function logPasswordResetSuccess(userId: string, req: NextRequest): Promise<void> {
  const { ipAddress, userAgent } = getClientInfo(req);

  await logSecurityEvent({
    type: SecurityLogType.PASSWORD_RESET_SUCCESS,
    userId,
    ipAddress,
    userAgent,
    endpoint: '/api/auth/reset-password',
    method: 'POST',
    status: 200,
    severity: SecuritySeverity.WARNING,
  });
}

/**
 * Log registration
 */
export async function logRegistration(userId: string, req: NextRequest): Promise<void> {
  const { ipAddress, userAgent } = getClientInfo(req);

  await logSecurityEvent({
    type: SecurityLogType.REGISTER,
    userId,
    ipAddress,
    userAgent,
    endpoint: '/api/auth/register',
    method: 'POST',
    status: 201,
    severity: SecuritySeverity.INFO,
  });
}

/**
 * Log unauthorized access attempt
 */
export async function logUnauthorizedAccess(req: NextRequest, reason: string): Promise<void> {
  const { ipAddress, userAgent } = getClientInfo(req);

  await logSecurityEvent({
    type: SecurityLogType.UNAUTHORIZED_ACCESS,
    ipAddress,
    userAgent,
    endpoint: req.nextUrl.pathname,
    method: req.method,
    status: 403,
    details: { reason },
    severity: SecuritySeverity.WARNING,
  });
}

/**
 * Get severity emoji for console logging
 */
export function getSeverityEmoji(severity: SecuritySeverity): string {
  switch (severity) {
    case SecuritySeverity.INFO:
      return 'ℹ️';
    case SecuritySeverity.WARNING:
      return '⚠️';
    case SecuritySeverity.CRITICAL:
      return '🚨';
    default:
      return 'ℹ️';
  }
}

/**
 * Clean up old security logs (run periodically via cron)
 * Keeps logs for 90 days by default
 */
export async function cleanupOldSecurityLogs(daysToKeep: number = 90): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = await prisma.securityLog.deleteMany({
    where: {
      timestamp: {
        lt: cutoffDate,
      },
    },
  });

  logger.info(`Cleaned up ${result.count} security logs older than ${daysToKeep} days`);
  return result.count;
}

/**
 * Get recent failed login attempts for a user (by email or IP)
 */
export async function getRecentFailedLogins(
  identifier: string,
  type: 'email' | 'ip',
  minutes: number = 30,
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setMinutes(cutoffDate.getMinutes() - minutes);

  const where =
    type === 'email'
      ? {
          type: SecurityLogType.LOGIN_FAILED,
          details: {
            path: ['email'],
            equals: identifier,
          },
          timestamp: { gte: cutoffDate },
        }
      : {
          type: SecurityLogType.LOGIN_FAILED,
          ip_address: identifier,
          timestamp: { gte: cutoffDate },
        };

  const count = await prisma.securityLog.count({ where });
  return count;
}

/**
 * Get all logs associated with a correlation ID
 */
export async function getLogsByCorrelationId(correlationId: string): Promise<SecurityLog[]> {
  return await prisma.securityLog.findMany({
    where: { correlationId },
    orderBy: { timestamp: 'asc' },
  });
}

/**
 * Suspicious pattern detection results
 */
export interface SuspiciousPattern {
  type: string;
  severity: SecuritySeverity;
  description: string;
  count: number;
  details: Record<string, unknown>;
}

/**
 * Detect suspicious patterns in security logs
 * Returns an array of detected patterns
 */
export async function detectSuspiciousPatterns(hours: number = 24): Promise<SuspiciousPattern[]> {
  const patterns: SuspiciousPattern[] = [];
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - hours);

  // 1. Multiple failed logins from same IP (brute force detection)
  const bruteForceIps = await prisma.securityLog.groupBy({
    by: ['ip_address'],
    where: {
      type: SecurityLogType.LOGIN_FAILED,
      timestamp: { gte: cutoffDate },
      ip_address: { not: 'unknown' },
    },
    having: { ip_address: { _count: { gt: 10 } } },
    _count: { ip_address: true },
  });

  for (const ip of bruteForceIps) {
    patterns.push({
      type: 'BRUTE_FORCE_ATTEMPT',
      severity: SecuritySeverity.CRITICAL,
      description: `Tentatives de connexion multiples depuis l'IP ${ip.ip_address}`,
      count: ip._count.ip_address,
      details: { ipAddress: ip.ip_address },
    });
  }

  // 2. Rate limit violations from same IP
  const rateLimitViolations = await prisma.securityLog.groupBy({
    by: ['ip_address'],
    where: {
      type: SecurityLogType.RATE_LIMIT_EXCEEDED,
      timestamp: { gte: cutoffDate },
      ip_address: { not: 'unknown' },
    },
    having: { ip_address: { _count: { gt: 5 } } },
    _count: { ip_address: true },
  });

  for (const ip of rateLimitViolations) {
    patterns.push({
      type: 'RATE_LIMIT_ABUSE',
      severity: SecuritySeverity.WARNING,
      description: `Violations répétées des limites de taux depuis ${ip.ip_address}`,
      count: ip._count.ip_address,
      details: { ipAddress: ip.ip_address },
    });
  }

  // 3. Unauthorized access attempts
  const unauthorizedAttempts = await prisma.securityLog.groupBy({
    by: ['ip_address'],
    where: {
      type: SecurityLogType.UNAUTHORIZED_ACCESS,
      timestamp: { gte: cutoffDate },
      ip_address: { not: 'unknown' },
    },
    having: { ip_address: { _count: { gt: 3 } } },
    _count: { ip_address: true },
  });

  for (const ip of unauthorizedAttempts) {
    patterns.push({
      type: 'UNAUTHORIZED_ACCESS_PATTERN',
      severity: SecuritySeverity.CRITICAL,
      description: `Tentatives d'accès non autorisé depuis ${ip.ip_address}`,
      count: ip._count.ip_address,
      details: { ipAddress: ip.ip_address },
    });
  }

  // 4. Account lockouts spike
  const lockoutCount = await prisma.securityLog.count({
    where: {
      type: SecurityLogType.ACCOUNT_LOCKED,
      timestamp: { gte: cutoffDate },
    },
  });

  if (lockoutCount > 5) {
    patterns.push({
      type: 'ACCOUNT_LOCKOUT_SPIKE',
      severity: SecuritySeverity.WARNING,
      description: `Pic inhabituel de verrouillages de comptes (${lockoutCount} verrouillages)`,
      count: lockoutCount,
      details: {},
    });
  }

  // 5. CSRF token invalidations
  const csrfViolations = await prisma.securityLog.count({
    where: {
      type: SecurityLogType.CSRF_TOKEN_INVALID,
      timestamp: { gte: cutoffDate },
    },
  });

  if (csrfViolations > 20) {
    patterns.push({
      type: 'CSRF_ATTACK_PATTERN',
      severity: SecuritySeverity.WARNING,
      description: `Nombre élevé d'invalidations de tokens CSRF (${csrfViolations})`,
      count: csrfViolations,
      details: {},
    });
  }

  // 6. Suspicious activity spike
  const suspiciousActivity = await prisma.securityLog.groupBy({
    by: ['ip_address'],
    where: {
      type: SecurityLogType.SUSPICIOUS_ACTIVITY,
      timestamp: { gte: cutoffDate },
      ip_address: { not: 'unknown' },
    },
    having: { ip_address: { _count: { gt: 1 } } },
    _count: { ip_address: true },
  });

  for (const ip of suspiciousActivity) {
    patterns.push({
      type: 'SUSPICIOUS_ACTIVITY_CLUSTER',
      severity: SecuritySeverity.CRITICAL,
      description: `Activité suspecte groupée depuis ${ip.ip_address}`,
      count: ip._count.ip_address,
      details: { ipAddress: ip.ip_address },
    });
  }

  return patterns;
}

/**
 * Get security statistics for a given time period
 */
export interface SecurityStats {
  period: { start: Date; end: Date };
  totalEvents: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  topIps: Array<{ ipAddress: string; count: number }>;
  failedLogins: number;
  suspiciousPatterns: SuspiciousPattern[];
}

export async function getSecurityStats(startDate: Date, endDate: Date): Promise<SecurityStats> {
  const logs = await prisma.securityLog.findMany({
    where: {
      timestamp: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  // Count by severity
  const bySeverity: Record<string, number> = {};
  // Count by type
  const byType: Record<string, number> = {};
  // Count by IP
  const ipCounts: Record<string, number> = {};

  let failedLogins = 0;

  for (const log of logs) {
    // Count by severity
    bySeverity[log.severity] = (bySeverity[log.severity] || 0) + 1;

    // Count by type
    byType[log.type] = (byType[log.type] || 0) + 1;

    // Count by IP
    if (log.ip_address && log.ip_address !== 'unknown') {
      ipCounts[log.ip_address] = (ipCounts[log.ip_address] || 0) + 1;
    }

    // Count failed logins
    if (log.type === SecurityLogType.LOGIN_FAILED) {
      failedLogins++;
    }
  }

  // Get top IPs
  const topIps = Object.entries(ipCounts)
    .map(([ipAddress, count]) => ({ ipAddress, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Detect suspicious patterns
  const hoursInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60));
  const suspiciousPatterns = await detectSuspiciousPatterns(hoursInPeriod);

  return {
    period: { start: startDate, end: endDate },
    totalEvents: logs.length,
    bySeverity,
    byType,
    topIps,
    failedLogins,
    suspiciousPatterns,
  };
}

/**
 * Get security logs with filtering and pagination
 */
export interface SecurityLogsFilter {
  page?: number;
  limit?: number;
  type?: SecurityLogType;
  severity?: SecuritySeverity;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  correlationId?: string;
  search?: string;
}

export interface SecurityLogsResult {
  logs: SecurityLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getSecurityLogs(
  filter: SecurityLogsFilter = {},
): Promise<SecurityLogsResult> {
  const page = filter.page || 1;
  const limit = Math.min(filter.limit || 50, 100); // Max 100 per page
  const skip = (page - 1) * limit;

  const where: Prisma.SecurityLogWhereInput = {};

  if (filter.type) {
    where.type = filter.type;
  }

  if (filter.severity) {
    where.severity = filter.severity;
  }

  if (filter.userId) {
    where.user_id = filter.userId;
  }

  if (filter.ipAddress) {
    where.ip_address = filter.ipAddress;
  }

  if (filter.correlationId) {
    where.correlationId = filter.correlationId;
  }

  if (filter.startDate || filter.endDate) {
    where.timestamp = {};
    if (filter.startDate) {
      where.timestamp.gte = filter.startDate;
    }
    if (filter.endDate) {
      where.timestamp.lte = filter.endDate;
    }
  }

  if (filter.search) {
    where.OR = [
      { endpoint: { contains: filter.search, mode: 'insensitive' } },
      { ip_address: { contains: filter.search, mode: 'insensitive' } },
      { user_agent: { contains: filter.search, mode: 'insensitive' } },
    ];
  }

  const [logs, total] = await Promise.all([
    prisma.securityLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { timestamp: 'desc' },
    }),
    prisma.securityLog.count({ where }),
  ]);

  return {
    logs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Create admin notifications for critical security events
 */
export async function createAdminSecurityAlert(pattern: SuspiciousPattern): Promise<void> {
  try {
    // Get all admin and superadmin users
    const admins = await prisma.user.findMany({
      where: {
        role: {
          in: ['ADMIN', 'SUPERADMIN'],
        },
      },

      select: { id: true },
    });

    // Create notification for each admin
    const notifications = admins.map((admin) =>
      prisma.notification.create({
        data: {
          user_id: admin.id,
          title: `Alerte de sécurité: ${pattern.type}`,
          message: `${pattern.description}. Nombre d'occurrences: ${pattern.count}`,
          type: NotificationType.SECURITY_ALERT,
        },
      }),
    );

    await Promise.all(notifications);
    logger.info(
      `Created ${notifications.length} security alert notifications for pattern: ${pattern.type}`,
    );
  } catch (error) {
    logger.error('Failed to create admin security alerts:', error);
  }
}
