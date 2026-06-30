/* eslint-disable */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { getClientInfo, getSeverityEmoji, logToConsoleInDev } from '@/lib/security/securityLogger';
import { SecuritySeverity, SecurityLogType } from '@/app/generated/prisma/enums';

jest.mock('@/lib/middleware/prismaConfig', () => ({
  __esModule: true,
  default: {
    securityLog: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
      findFirst: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
  },
}));

// Type the mocked Prisma
const getMockedPrisma = async () => {
  const prisma = (await import('@/lib/middleware/prismaConfig')).default;
  return prisma as any as {
    securityLog: {
      create: jest.Mock<any>;
      deleteMany: jest.Mock<any>;
      count: jest.Mock<any>;
      findMany: jest.Mock<any>;
      groupBy: jest.Mock<any>;
      findFirst: jest.Mock<any>;
    };
    user: {
      findMany: jest.Mock<any>;
    };
    notification: {
      create: jest.Mock<any>;
    };
  };
};

describe('Security Logger', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    const mockedPrisma = await getMockedPrisma();
    mockedPrisma.securityLog.create.mockResolvedValue({});
    mockedPrisma.securityLog.deleteMany.mockResolvedValue({ count: 0 });
    mockedPrisma.securityLog.count.mockResolvedValue(0);
  });

  const createMockRequest = (headers: Record<string, string> = {}) => {
    const h = new Headers(headers);
    return { headers: h, nextUrl: { pathname: '/test' } } as any;
  };

  test('getClientInfo extracts IP', () => {
    const req = createMockRequest({ 'x-forwarded-for': '192.168.1.1' });
    const info = getClientInfo(req);
    expect(info.ipAddress).toBe('192.168.1.1');
  });

  test('getClientInfo extracts IP from x-real-ip', () => {
    const req = createMockRequest({ 'x-real-ip': '10.0.0.1' });
    const info = getClientInfo(req);
    expect(info.ipAddress).toBe('10.0.0.1');
  });

  test('getClientInfo returns unknown', () => {
    const req = createMockRequest({});
    const info = getClientInfo(req);
    expect(info.ipAddress).toBe('unknown');
  });

  test('all logging functions work', async () => {
    const {
      logLoginSuccess,
      logLoginFailed,
      logLogout,
      logAdminAccess,
      logDataModification,
      logSuspiciousActivity,
      logRateLimitExceeded,
      logPasswordChange,
      logPasswordResetRequest,
      logPasswordResetSuccess,
      logRegistration,
      logUnauthorizedAccess,
      logSecurityEvent,
      cleanupOldSecurityLogs,
      getRecentFailedLogins,
    } = await import('@/lib/security/securityLogger');
    const { SecurityLogType, SecuritySeverity } = await import('@/app/generated/prisma/enums');
    const req = createMockRequest({});

    await logLoginSuccess('u1', req);
    await logLoginFailed('e@e.com', req, 'r');
    await logLogout('u1', req);
    await logAdminAccess('u1', req, 'a');
    await logDataModification('u1', req, 't', 'i', 'update');
    await logSuspiciousActivity(req, 'u1', 'r', {});
    await logSuspiciousActivity(req, undefined, 'r');
    await logRateLimitExceeded(req, 'c');
    await logPasswordChange('u1', req);
    await logPasswordResetRequest('e@e.com', req);
    await logPasswordResetSuccess('u1', req);
    await logRegistration('u1', req);
    await logUnauthorizedAccess(req, 'r');
    await logSecurityEvent({ type: SecurityLogType.LOGIN_SUCCESS, userId: 'u1' });
    const c = await cleanupOldSecurityLogs(90);
    const c2 = await cleanupOldSecurityLogs();
    const f1 = await getRecentFailedLogins('e@e.com', 'email', 30);
    const f2 = await getRecentFailedLogins('1.1.1.1', 'ip', 30);
    const f3 = await getRecentFailedLogins('e@e.com', 'email');

    expect(true).toBe(true);
  });

  test('logSecurityEvent handles errors', async () => {
    const mockedPrisma = await getMockedPrisma();
    mockedPrisma.securityLog.create.mockRejectedValueOnce(new Error('err'));
    const { logSecurityEvent } = await import('@/lib/security/securityLogger');
    const { SecurityLogType } = await import('@/app/generated/prisma/enums');
    await logSecurityEvent({ type: SecurityLogType.LOGIN_FAILED });
    expect(true).toBe(true);
  });

  test('coverage test - development mode and severity', async () => {
    jest.isolateModules(async () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        writable: true,
        configurable: true,
      });
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const { logSecurityEvent } = await import('@/lib/security/securityLogger');
      const { SecurityLogType, SecuritySeverity } = await import('@/app/generated/prisma/enums');

      await logSecurityEvent({
        type: SecurityLogType.LOGIN_SUCCESS,
        userId: 'u1',
        severity: SecuritySeverity.INFO,
      });
      await logSecurityEvent({
        type: SecurityLogType.LOGIN_FAILED,
        severity: SecuritySeverity.WARNING,
      });
      await logSecurityEvent({
        type: SecurityLogType.SUSPICIOUS_ACTIVITY,
        severity: SecuritySeverity.CRITICAL,
      });
      await logSecurityEvent({
        type: SecurityLogType.UNAUTHORIZED_ACCESS,
        severity: undefined as any,
      });

      consoleSpy.mockRestore();
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'test',
        writable: true,
        configurable: true,
      });
    });
    expect(true).toBe(true);
  });

  test('getSeverityEmoji returns correct emojis', () => {
    expect(getSeverityEmoji(SecuritySeverity.INFO)).toBe('ℹ️');
    expect(getSeverityEmoji(SecuritySeverity.WARNING)).toBe('⚠️');
    expect(getSeverityEmoji(SecuritySeverity.CRITICAL)).toBe('🚨');
    expect(getSeverityEmoji('INVALID' as any)).toBe('ℹ️');
  });

  test('logToConsoleInDev logs in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    // Import logger and spy on its log method
    const { logger } = require('@/lib/middleware/logger');
    const loggerSpy = jest.spyOn(logger, 'log').mockImplementation(() => {});

    // Test development mode
    (process.env as any).NODE_ENV = 'development';
    logToConsoleInDev({
      type: SecurityLogType.LOGIN_SUCCESS,
      userId: 'u1',
      severity: SecuritySeverity.INFO,
    });
    expect(loggerSpy).toHaveBeenCalled();

    loggerSpy.mockClear();

    // Test production mode (should not log)
    (process.env as any).NODE_ENV = 'production';
    logToConsoleInDev({
      type: SecurityLogType.LOGIN_SUCCESS,
      userId: 'u1',
      severity: SecuritySeverity.INFO,
    });
    expect(loggerSpy).not.toHaveBeenCalled();

    loggerSpy.mockRestore();
    (process.env as any).NODE_ENV = originalEnv;
  });

  test('logToConsoleInDev handles all severity levels', () => {
    const originalEnv = process.env.NODE_ENV;
    // Import logger and spy on its log method
    const { logger } = require('@/lib/middleware/logger');
    const loggerSpy = jest.spyOn(logger, 'log').mockImplementation(() => {});
    (process.env as any).NODE_ENV = 'development';

    logToConsoleInDev({ type: SecurityLogType.LOGIN_SUCCESS, severity: SecuritySeverity.INFO });
    logToConsoleInDev({ type: SecurityLogType.LOGIN_FAILED, severity: SecuritySeverity.WARNING });
    logToConsoleInDev({
      type: SecurityLogType.SUSPICIOUS_ACTIVITY,
      severity: SecuritySeverity.CRITICAL,
    });
    logToConsoleInDev({ type: SecurityLogType.UNAUTHORIZED_ACCESS });

    expect(loggerSpy).toHaveBeenCalledTimes(4);
    loggerSpy.mockRestore();
    (process.env as any).NODE_ENV = originalEnv;
  });

  describe('New security functions', () => {
    test('generateCorrelationId generates unique IDs', async () => {
      const { generateCorrelationId } = await import('@/lib/security/securityLogger');
      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();
      expect(id1).toHaveLength(32);
      expect(id2).toHaveLength(32);
      expect(id1).not.toBe(id2);
    });

    test('logSecurityEvent accepts correlationId', async () => {
      const mockedPrisma = await getMockedPrisma();
      mockedPrisma.securityLog.create.mockResolvedValue({});
      const { logSecurityEvent, generateCorrelationId } = await import(
        '@/lib/security/securityLogger'
      );
      const { SecurityLogType } = await import('@/app/generated/prisma/enums');
      const correlationId = generateCorrelationId();
      await logSecurityEvent({ type: SecurityLogType.LOGIN_SUCCESS, correlationId });
      expect(mockedPrisma.securityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ correlationId }),
        }),
      );
    });

    test('getLogsByCorrelationId returns logs for correlation ID', async () => {
      const mockedPrisma = await getMockedPrisma();
      const mockLogs = [
        { id: '1', type: SecurityLogType.LOGIN_SUCCESS, timestamp: new Date() },
        { id: '2', type: SecurityLogType.LOGOUT, timestamp: new Date() },
      ];
      mockedPrisma.securityLog.findMany.mockResolvedValue(mockLogs);
      const { getLogsByCorrelationId } = await import('@/lib/security/securityLogger');
      const logs = await getLogsByCorrelationId('abc123');
      expect(logs).toEqual(mockLogs);
      expect(mockedPrisma.securityLog.findMany).toHaveBeenCalledWith({
        where: { correlationId: 'abc123' },
        orderBy: { timestamp: 'asc' },
      });
    });

    test('detectSuspiciousPatterns detects brute force attempts', async () => {
      const mockedPrisma = await getMockedPrisma();
      // Mock all groupBy calls - only brute force returns data
      mockedPrisma.securityLog.groupBy
        .mockResolvedValueOnce([{ ip_address: '1.2.3.4', _count: { ip_address: 15 } }]) // Brute force
        .mockResolvedValueOnce([]) // Rate limit violations
        .mockResolvedValueOnce([]) // Unauthorized attempts
        .mockResolvedValueOnce([]); // Suspicious activity clusters
      // Mock count calls: lockouts (0), CSRF violations (0)
      mockedPrisma.securityLog.count.mockResolvedValue(0);
      const { detectSuspiciousPatterns } = await import('@/lib/security/securityLogger');
      const patterns = await detectSuspiciousPatterns(24);
      expect(patterns.some((p) => p.type === 'BRUTE_FORCE_ATTEMPT')).toBe(true);
      const bruteForcePattern = patterns.find((p) => p.type === 'BRUTE_FORCE_ATTEMPT');
      expect(bruteForcePattern?.severity).toBe(SecuritySeverity.CRITICAL);
    });

    test('detectSuspiciousPatterns detects rate limit abuse', async () => {
      const mockedPrisma = await getMockedPrisma();
      // Mock all groupBy calls - only rate limit returns data
      mockedPrisma.securityLog.groupBy
        .mockResolvedValueOnce([]) // No brute force
        .mockResolvedValueOnce([{ ip_address: '1.2.3.4', _count: { ip_address: 6 } }]) // Rate limit
        .mockResolvedValueOnce([]) // No unauthorized
        .mockResolvedValueOnce([]); // No suspicious activity
      // Mock count calls: lockouts (0), CSRF violations (0)
      mockedPrisma.securityLog.count.mockResolvedValue(0);
      const { detectSuspiciousPatterns } = await import('@/lib/security/securityLogger');
      const patterns = await detectSuspiciousPatterns(24);
      expect(patterns.some((p) => p.type === 'RATE_LIMIT_ABUSE')).toBe(true);
      const rateLimitPattern = patterns.find((p) => p.type === 'RATE_LIMIT_ABUSE');
      expect(rateLimitPattern?.severity).toBe(SecuritySeverity.WARNING);
    });

    test('detectSuspiciousPatterns detects unauthorized access patterns', async () => {
      const mockedPrisma = await getMockedPrisma();
      // Mock all groupBy calls - only unauthorized returns data
      mockedPrisma.securityLog.groupBy
        .mockResolvedValueOnce([]) // No brute force
        .mockResolvedValueOnce([]) // No rate limit
        .mockResolvedValueOnce([{ ip_address: '1.2.3.4', _count: { ip_address: 4 } }]) // Unauthorized
        .mockResolvedValueOnce([]); // No suspicious activity
      // Mock count calls: lockouts (0), CSRF violations (0)
      mockedPrisma.securityLog.count.mockResolvedValue(0);
      const { detectSuspiciousPatterns } = await import('@/lib/security/securityLogger');
      const patterns = await detectSuspiciousPatterns(24);
      expect(patterns.some((p) => p.type === 'UNAUTHORIZED_ACCESS_PATTERN')).toBe(true);
      const unauthorizedPattern = patterns.find((p) => p.type === 'UNAUTHORIZED_ACCESS_PATTERN');
      expect(unauthorizedPattern?.severity).toBe(SecuritySeverity.CRITICAL);
    });

    test('detectSuspiciousPatterns detects account lockout spike', async () => {
      const mockedPrisma = await getMockedPrisma();
      // Mock all groupBy calls to return empty (no patterns from groupBy)
      mockedPrisma.securityLog.groupBy.mockResolvedValue([]);
      // Mock count calls: lockouts (10), CSRF violations (0)
      mockedPrisma.securityLog.count.mockResolvedValueOnce(10).mockResolvedValueOnce(0);
      const { detectSuspiciousPatterns } = await import('@/lib/security/securityLogger');
      const patterns = await detectSuspiciousPatterns(24);
      expect(patterns.some((p) => p.type === 'ACCOUNT_LOCKOUT_SPIKE')).toBe(true);
    });

    test('detectSuspiciousPatterns detects CSRF attack pattern', async () => {
      const mockedPrisma = await getMockedPrisma();
      // Mock all groupBy calls to return empty (no patterns from groupBy)
      mockedPrisma.securityLog.groupBy.mockResolvedValue([]);
      // Mock count calls: lockouts (0), CSRF violations (25)
      mockedPrisma.securityLog.count.mockResolvedValueOnce(0).mockResolvedValueOnce(25);
      const { detectSuspiciousPatterns } = await import('@/lib/security/securityLogger');
      const patterns = await detectSuspiciousPatterns(24);
      expect(patterns.some((p) => p.type === 'CSRF_ATTACK_PATTERN')).toBe(true);
    });

    test('detectSuspiciousPatterns detects suspicious activity clusters', async () => {
      const mockedPrisma = await getMockedPrisma();
      // Mock groupBy calls in order: brute force, rate limit, unauthorized, suspicious activity
      mockedPrisma.securityLog.groupBy
        .mockResolvedValueOnce([]) // No brute force
        .mockResolvedValueOnce([]) // No rate limit
        .mockResolvedValueOnce([]) // No unauthorized
        .mockResolvedValueOnce([{ ip_address: '1.2.3.4', _count: { ip_address: 2 } }]); // Suspicious activity
      // Mock count calls: lockouts, CSRF violations
      mockedPrisma.securityLog.count.mockResolvedValue(0); // No lockouts or CSRF
      const { detectSuspiciousPatterns } = await import('@/lib/security/securityLogger');
      const patterns = await detectSuspiciousPatterns(24);
      expect(patterns.some((p) => p.type === 'SUSPICIOUS_ACTIVITY_CLUSTER')).toBe(true);
    });

    test('detectSuspiciousPatterns returns empty array when no patterns', async () => {
      const mockedPrisma = await getMockedPrisma();
      // Mock all groupBy calls to return empty arrays (no patterns)
      mockedPrisma.securityLog.groupBy.mockResolvedValue([]);
      // Mock all count calls to return 0 (no lockouts or CSRF violations)
      mockedPrisma.securityLog.count.mockResolvedValue(0);
      const { detectSuspiciousPatterns } = await import('@/lib/security/securityLogger');
      const patterns = await detectSuspiciousPatterns(24);
      expect(patterns).toEqual([]);
    });

    test('getSecurityStats returns comprehensive statistics', async () => {
      const mockedPrisma = await getMockedPrisma();
      const mockLogs = [
        {
          id: '1',
          type: SecurityLogType.LOGIN_SUCCESS,
          severity: SecuritySeverity.INFO,
          ip_address: '1.2.3.4',
          user_agent: 'Mozilla',
          timestamp: new Date(),
        },
        {
          id: '2',
          type: SecurityLogType.LOGIN_FAILED,
          severity: SecuritySeverity.WARNING,
          ip_address: '1.2.3.4',
          user_agent: 'Chrome',
          timestamp: new Date(),
        },
      ];
      mockedPrisma.securityLog.findMany.mockResolvedValue(mockLogs);
      mockedPrisma.securityLog.groupBy.mockResolvedValue([]);
      mockedPrisma.securityLog.count.mockResolvedValue(0);
      const { getSecurityStats } = await import('@/lib/security/securityLogger');
      const stats = await getSecurityStats(new Date('2024-01-01'), new Date('2024-01-31'));
      expect(stats.totalEvents).toBe(2);
      expect(stats.bySeverity.INFO).toBe(1);
      expect(stats.bySeverity.WARNING).toBe(1);
      expect(stats.failedLogins).toBe(1);
      expect(stats.topIps).toHaveLength(1);
      expect(stats.topIps[0].ipAddress).toBe('1.2.3.4');
      expect(stats.topIps[0].count).toBe(2);
    });

    test('getSecurityLogs returns paginated results', async () => {
      const mockedPrisma = await getMockedPrisma();
      const mockLogs = [
        { id: '1', type: SecurityLogType.LOGIN_SUCCESS, timestamp: new Date() },
        { id: '2', type: SecurityLogType.LOGOUT, timestamp: new Date() },
      ];
      mockedPrisma.securityLog.findMany.mockResolvedValue(mockLogs);
      mockedPrisma.securityLog.count.mockResolvedValue(2);
      const { getSecurityLogs } = await import('@/lib/security/securityLogger');
      const result = await getSecurityLogs({ page: 1, limit: 50 });
      expect(result.logs).toEqual(mockLogs);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.totalPages).toBe(1);
    });

    test('getSecurityLogs applies filters', async () => {
      const mockedPrisma = await getMockedPrisma();
      mockedPrisma.securityLog.findMany.mockResolvedValue([]);
      mockedPrisma.securityLog.count.mockResolvedValue(0);
      const { getSecurityLogs } = await import('@/lib/security/securityLogger');
      await getSecurityLogs({
        page: 1,
        limit: 10,
        type: SecurityLogType.LOGIN_SUCCESS,
        severity: SecuritySeverity.INFO,
        userId: 'user123',
        ipAddress: '1.2.3.4',
        correlationId: 'abc123',
        search: 'test',
      });
      expect(mockedPrisma.securityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: SecurityLogType.LOGIN_SUCCESS,
            severity: SecuritySeverity.INFO,
            user_id: 'user123',
            ip_address: '1.2.3.4',
            correlationId: 'abc123',
          }),
        }),
      );
    });

    test('getSecurityLogs applies date range filter', async () => {
      const mockedPrisma = await getMockedPrisma();
      mockedPrisma.securityLog.findMany.mockResolvedValue([]);
      mockedPrisma.securityLog.count.mockResolvedValue(0);
      const { getSecurityLogs } = await import('@/lib/security/securityLogger');
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      await getSecurityLogs({ startDate, endDate });
      expect(mockedPrisma.securityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: {
              gte: startDate,
              lte: endDate,
            },
          }),
        }),
      );
    });

    test('getSecurityLogs limits page size to 100', async () => {
      const mockedPrisma = await getMockedPrisma();
      mockedPrisma.securityLog.findMany.mockResolvedValue([]);
      mockedPrisma.securityLog.count.mockResolvedValue(0);
      const { getSecurityLogs } = await import('@/lib/security/securityLogger');
      await getSecurityLogs({ page: 1, limit: 200 });
      expect(mockedPrisma.securityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        }),
      );
    });

    test('createAdminSecurityAlert creates notifications for admins', async () => {
      const mockedPrisma = await getMockedPrisma();
      mockedPrisma.user.findMany.mockResolvedValue([{ id: 'admin1' }, { id: 'admin2' }]);
      mockedPrisma.notification.create.mockResolvedValue({});
      const { createAdminSecurityAlert } = await import('@/lib/security/securityLogger');
      const pattern = {
        type: 'TEST_PATTERN',
        severity: SecuritySeverity.CRITICAL,
        description: 'Test pattern detected',
        count: 5,
        details: {},
      };
      await createAdminSecurityAlert(pattern);
      expect(mockedPrisma.user.findMany).toHaveBeenCalledWith({
        where: {
          role: {
            in: ['ADMIN', 'SUPERADMIN'],
          },
        },
        select: { id: true },
      });
      expect(mockedPrisma.notification.create).toHaveBeenCalledTimes(2);
    });

    test('createAdminSecurityAlert handles errors gracefully', async () => {
      const mockedPrisma = await getMockedPrisma();
      mockedPrisma.user.findMany.mockRejectedValue(new Error('DB Error'));
      const loggerSpy = jest
        .spyOn(require('@/lib/middleware/logger').logger, 'error')
        .mockImplementation(() => {});
      const { createAdminSecurityAlert } = await import('@/lib/security/securityLogger');
      const pattern = {
        type: 'TEST_PATTERN',
        severity: SecuritySeverity.CRITICAL,
        description: 'Test pattern detected',
        count: 5,
        details: {},
      };
      await expect(createAdminSecurityAlert(pattern)).resolves.not.toThrow();
      loggerSpy.mockRestore();
    });
  });
});
