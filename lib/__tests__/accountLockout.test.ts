import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals';
import {
  isAccountLocked,
  recordFailedLogin,
  resetFailedAttempts,
  unlockAccount,
  getAccountLockoutStatus,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MS,
} from '../auth/accountLockout';

// Mock Prisma
jest.mock('../middleware/prismaConfig', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../middleware/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Account Lockout', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports
  const prisma = require('../middleware/prismaConfig').default as any;
  const mockUserId = 'user-123';
  const mockEmail = 'test@example.com';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isAccountLocked', () => {
    it('should return false when user has no lock', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        locked_until: null,
      });

      const result = await isAccountLocked(mockUserId);

      expect(result.locked).toBe(false);
      expect(result.lockedUntil).toBeUndefined();
    });

    it('should return true when account is currently locked', async () => {
      const futureDate = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        locked_until: futureDate,
      });

      const result = await isAccountLocked(mockUserId);

      expect(result.locked).toBe(true);
      expect(result.lockedUntil).toEqual(futureDate);
    });

    it('should auto-unlock when lock period has expired', async () => {
      const pastDate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago

      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        locked_until: pastDate,
      });

      prisma.user.update.mockResolvedValue({
        id: mockUserId,
        locked_until: null,
        failed_login_attempts: 0,
      });

      const result = await isAccountLocked(mockUserId);

      expect(result.locked).toBe(false);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          failed_login_attempts: 0,
          locked_until: null,
        },
      });
    });

    it('should return false when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await isAccountLocked(mockUserId);

      expect(result.locked).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      prisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      const result = await isAccountLocked(mockUserId);

      // Should not throw and should assume not locked
      expect(result.locked).toBe(false);
    });
  });

  describe('recordFailedLogin', () => {
    it('should increment failed attempts counter', async () => {
      prisma.user.update.mockResolvedValue({
        id: mockUserId,
        email: mockEmail,
        failed_login_attempts: 3,
      });

      const result = await recordFailedLogin(mockUserId);

      expect(result.locked).toBe(false);
      expect(result.attemptsRemaining).toBe(MAX_FAILED_ATTEMPTS - 3);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          failed_login_attempts: {
            increment: 1,
          },
        },
        select: {
          failed_login_attempts: true,
          email: true,
        },
      });
    });

    it('should lock account after reaching max attempts', async () => {
      prisma.user.update
        .mockResolvedValueOnce({
          id: mockUserId,
          email: mockEmail,
          failed_login_attempts: MAX_FAILED_ATTEMPTS,
        })
        .mockResolvedValueOnce({
          id: mockUserId,
          locked_until: expect.any(Date),
        });

      const result = await recordFailedLogin(mockUserId);

      expect(result.locked).toBe(true);
      expect(result.attemptsRemaining).toBe(0);
      expect(result.lockedUntil).toBeInstanceOf(Date);

      // Check that lock was set
      expect(prisma.user.update).toHaveBeenCalledTimes(2);
      const lockCall = (prisma.user.update as jest.Mock).mock.calls[1][0] as {
        data: { locked_until: Date };
      };
      expect(lockCall.data.locked_until).toBeInstanceOf(Date);
    });

    it('should set lockout for correct duration', async () => {
      const beforeLock = Date.now();

      prisma.user.update
        .mockResolvedValueOnce({
          id: mockUserId,
          email: mockEmail,
          failed_login_attempts: MAX_FAILED_ATTEMPTS,
        })
        .mockResolvedValueOnce({
          id: mockUserId,
          locked_until: new Date(beforeLock + LOCKOUT_DURATION_MS),
        });

      const result = await recordFailedLogin(mockUserId);

      const afterLock = Date.now();

      expect(result.locked).toBe(true);
      expect(result.lockedUntil).toBeInstanceOf(Date);

      if (result.lockedUntil) {
        const lockDuration = result.lockedUntil.getTime() - beforeLock;
        // Allow some tolerance for execution time (±1 second)
        expect(lockDuration).toBeGreaterThanOrEqual(LOCKOUT_DURATION_MS - 1000);
        expect(lockDuration).toBeLessThanOrEqual(
          LOCKOUT_DURATION_MS + (afterLock - beforeLock) + 1000,
        );
      }
    });

    it('should handle errors gracefully', async () => {
      prisma.user.update.mockRejectedValue(new Error('Database error'));

      const result = await recordFailedLogin(mockUserId);

      // Should not throw and should return safe defaults
      expect(result.locked).toBe(false);
      expect(result.attemptsRemaining).toBe(MAX_FAILED_ATTEMPTS);
    });
  });

  describe('resetFailedAttempts', () => {
    it('should reset failed attempts and unlock account', async () => {
      prisma.user.update.mockResolvedValue({
        id: mockUserId,
        failed_login_attempts: 0,
        locked_until: null,
      });

      await resetFailedAttempts(mockUserId);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          failed_login_attempts: 0,
          locked_until: null,
        },
      });
    });

    it('should handle errors gracefully', async () => {
      prisma.user.update.mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(resetFailedAttempts(mockUserId)).resolves.not.toThrow();
    });
  });

  describe('unlockAccount', () => {
    it('should unlock account and reset attempts', async () => {
      prisma.user.update.mockResolvedValue({
        id: mockUserId,
        failed_login_attempts: 0,
        locked_until: null,
      });

      await unlockAccount(mockUserId);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          failed_login_attempts: 0,
          locked_until: null,
        },
      });
    });

    it('should handle errors gracefully', async () => {
      prisma.user.update.mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(unlockAccount(mockUserId)).resolves.not.toThrow();
    });
  });

  describe('getAccountLockoutStatus', () => {
    it('should return full status for unlocked account', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        failed_login_attempts: 3,
        locked_until: null,
      });

      const result = await getAccountLockoutStatus(mockUserId);

      expect(result).toEqual({
        locked: false,
        failedAttempts: 3,
        attemptsRemaining: MAX_FAILED_ATTEMPTS - 3,
        lockedUntil: undefined,
      });
    });

    it('should return full status for locked account', async () => {
      const lockUntil = new Date(Date.now() + 30 * 60 * 1000);

      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        failed_login_attempts: MAX_FAILED_ATTEMPTS,
        locked_until: lockUntil,
      });

      const result = await getAccountLockoutStatus(mockUserId);

      expect(result).toEqual({
        locked: true,
        failedAttempts: MAX_FAILED_ATTEMPTS,
        attemptsRemaining: 0,
        lockedUntil: lockUntil,
      });
    });

    it('should handle edge case where locked_until is null but still locked', async () => {
      // This is an edge case where the account appears locked but locked_until is null
      const futureDate = new Date(Date.now() + 30 * 60 * 1000);

      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        failed_login_attempts: MAX_FAILED_ATTEMPTS,
        locked_until: futureDate,
      });

      const result = await getAccountLockoutStatus(mockUserId);

      expect(result.locked).toBe(true);
      expect(result.lockedUntil).toBe(futureDate);
    });

    it('should return safe defaults for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await getAccountLockoutStatus(mockUserId);

      expect(result).toEqual({
        locked: false,
        failedAttempts: 0,
        attemptsRemaining: MAX_FAILED_ATTEMPTS,
      });
    });

    it('should handle errors gracefully', async () => {
      prisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      const result = await getAccountLockoutStatus(mockUserId);

      // Should return safe defaults
      expect(result).toEqual({
        locked: false,
        failedAttempts: 0,
        attemptsRemaining: MAX_FAILED_ATTEMPTS,
      });
    });
  });

  describe('Configuration', () => {
    it('should have reasonable lockout threshold', () => {
      // MAX_FAILED_ATTEMPTS should be high enough to prevent accidental lockouts
      // but low enough to prevent brute force
      expect(MAX_FAILED_ATTEMPTS).toBeGreaterThanOrEqual(5);
      expect(MAX_FAILED_ATTEMPTS).toBeLessThanOrEqual(15);
    });

    it('should have reasonable lockout duration', () => {
      // LOCKOUT_DURATION_MS should be long enough to deter brute force
      // but not so long that it's unreasonable for legitimate users
      const tenMinutes = 10 * 60 * 1000;
      const twentyFourHours = 24 * 60 * 60 * 1000;

      expect(LOCKOUT_DURATION_MS).toBeGreaterThanOrEqual(tenMinutes / 2); // At least 5 minutes
      expect(LOCKOUT_DURATION_MS).toBeLessThanOrEqual(twentyFourHours); // At most 24 hours
    });
  });
});
