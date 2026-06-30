import prisma from '../middleware/prismaConfig';
import { logger } from '../middleware/logger';
import { sanitizeLogArgs } from '../security/logSanitization';

/**
 * Account Lockout Configuration
 * Protects against brute force attacks by locking accounts after repeated failed login attempts
 */

// Maximum failed login attempts before locking account
export const MAX_FAILED_ATTEMPTS = 5;

// Lockout duration in milliseconds (10 minutes)
export const LOCKOUT_DURATION_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Check if an account is currently locked.
 * @param userId - The user ID to check.
 * @returns Object with lock status and unlock time if locked.
 */
export async function isAccountLocked(
  userId: string,
): Promise<{ locked: boolean; lockedUntil?: Date }> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        locked_until: true,
      },
    });

    if (!user) {
      return { locked: false };
    }

    // Check if locked_until is set and in the future
    if (user.locked_until && user.locked_until > new Date()) {
      return {
        locked: true,
        lockedUntil: user.locked_until,
      };
    }

    // If locked_until has passed, auto-unlock the account
    if (user.locked_until && user.locked_until <= new Date()) {
      await unlockAccount(userId);
      return { locked: false };
    }

    return { locked: false };
  } catch (error) {
    logger.error('Error checking account lock status:', ...sanitizeLogArgs(error));
    // In case of error, assume not locked to avoid locking out users
    return { locked: false };
  }
}

/**
 * Record a failed login attempt and lock account if threshold exceeded.
 * @param userId - The user ID to record failed attempt for.
 * @returns Object with lock status and whether account was locked.
 */
export async function recordFailedLogin(
  userId: string,
): Promise<{ locked: boolean; attemptsRemaining: number; lockedUntil?: Date }> {
  try {
    // Increment failed_login_attempts
    const user = await prisma.user.update({
      where: { id: userId },
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

    const attemptsRemaining = MAX_FAILED_ATTEMPTS - user.failed_login_attempts;

    logger.info(
      `Failed login attempt for user ${user.email}. Attempts: ${user.failed_login_attempts}/${MAX_FAILED_ATTEMPTS}`,
    );

    // If max attempts reached, lock the account
    if (user.failed_login_attempts >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);

      await prisma.user.update({
        where: { id: userId },
        data: {
          locked_until: lockedUntil,
        },
      });

      logger.warn(
        `Account locked for user ${user.email} until ${lockedUntil.toISOString()} after ${MAX_FAILED_ATTEMPTS} failed attempts`,
      );

      return {
        locked: true,
        attemptsRemaining: 0,
        lockedUntil,
      };
    }

    return {
      locked: false,
      attemptsRemaining,
    };
  } catch (error) {
    logger.error('Error recording failed login:', ...sanitizeLogArgs(error));
    return {
      locked: false,
      attemptsRemaining: MAX_FAILED_ATTEMPTS,
    };
  }
}

/**
 * Reset failed login attempts (called after successful login).
 * @param userId - The user ID to reset attempts for.
 */
export async function resetFailedAttempts(userId: string): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        failed_login_attempts: 0,
        locked_until: null,
      },
    });

    logger.info(`Reset failed login attempts for user ${userId}`);
  } catch (error) {
    logger.error('Error resetting failed attempts:', ...sanitizeLogArgs(error));
  }
}

/**
 * Unlock an account (called when lockout period expires or by admin).
 * @param userId - The user ID to unlock.
 */
export async function unlockAccount(userId: string): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        failed_login_attempts: 0,
        locked_until: null,
      },
    });

    logger.info(`Account unlocked for user ${userId}`);
  } catch (error) {
    logger.error('Error unlocking account:', ...sanitizeLogArgs(error));
  }
}

/**
 * Get account lockout status with details.
 * @param userId - The user ID to check.
 * @returns Detailed lockout information.
 */
export async function getAccountLockoutStatus(userId: string): Promise<{
  locked: boolean;
  failedAttempts: number;
  attemptsRemaining: number;
  lockedUntil?: Date;
}> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        failed_login_attempts: true,
        locked_until: true,
      },
    });

    if (!user) {
      return {
        locked: false,
        failedAttempts: 0,
        attemptsRemaining: MAX_FAILED_ATTEMPTS,
      };
    }

    const locked = user.locked_until ? user.locked_until > new Date() : false;
    const attemptsRemaining = Math.max(0, MAX_FAILED_ATTEMPTS - user.failed_login_attempts);

    /* c8 ignore start - Unreachable branch: if locked is true, user.locked_until must exist */
    return {
      locked,
      failedAttempts: user.failed_login_attempts,
      attemptsRemaining,
      lockedUntil: locked ? user.locked_until || undefined : undefined,
    };
    /* c8 ignore stop */
  } catch (error) {
    logger.error('Error getting account lockout status:', ...sanitizeLogArgs(error));
    return {
      locked: false,
      failedAttempts: 0,
      attemptsRemaining: MAX_FAILED_ATTEMPTS,
    };
  }
}
