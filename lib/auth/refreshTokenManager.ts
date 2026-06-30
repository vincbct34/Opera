/**
 * Refresh Token Management
 * Handles refresh token rotation and blacklisting
 */

import prisma from '@/lib/middleware/prismaConfig';
import jwt from 'jsonwebtoken';
import { logger } from '../middleware/logger';

/**
 * Add a refresh token to the blacklist
 * @param token - The refresh token to blacklist
 * @param userId - Optional user ID for tracking
 * @param expiresAt - When the token expires (for cleanup)
 */
export async function blacklistRefreshToken(
  token: string,
  userId?: string,
  expiresAt?: Date,
): Promise<void> {
  // Calculate expiration if not provided (7 days from now as default)
  const expires = expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  try {
    await prisma.refreshTokenBlacklist.create({
      data: {
        token,
        user_id: userId,
        expires_at: expires,
      },
    });
  } catch (error) {
    // If token already exists in blacklist, ignore the error
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return;
    }
    throw error;
  }
}

/**
 * Check if a refresh token is blacklisted
 * @param token - The refresh token to check
 * @returns true if token is blacklisted, false otherwise
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  const blacklistedToken = await prisma.refreshTokenBlacklist.findUnique({
    where: { token },
  });

  return blacklistedToken !== null;
}

/**
 * Generate a new refresh token with rotation
 * @param userId - The user ID to include in the token
 * @returns Object containing the new refresh token and its expiration date
 */
export function generateRefreshToken(userId: string): { token: string; expiresAt: Date } {
  const expiresIn = '7d';
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!refreshSecret) {
    throw new Error('Missing JWT refresh secret (JWT_REFRESH_SECRET)');
  }

  const token = jwt.sign({ id: userId }, refreshSecret, {
    expiresIn,
  });

  return { token, expiresAt };
}

/**
 * Blacklist all refresh tokens for a specific user
 * Useful for logout from all devices or account security breach
 * @param userId - The user ID whose tokens should be blacklisted
 */
export async function blacklistAllUserTokens(userId: string): Promise<void> {
  // This is a placeholder - in a production environment, you would want to track
  // active tokens per user. For now, we'll just mark this for future implementation.
  // You could implement a UserSession table to track all active refresh tokens.
  logger.info(`Blacklisting all tokens for user ${userId} - Not yet implemented`);
}

/**
 * Clean up expired tokens from the blacklist
 * This should be run periodically (e.g., via cron job)
 * @returns Number of deleted tokens
 */
export async function cleanupExpiredBlacklistedTokens(): Promise<number> {
  const result = await prisma.refreshTokenBlacklist.deleteMany({
    where: {
      expires_at: {
        lt: new Date(),
      },
    },
  });

  return result.count;
}

/**
 * Verify and decode a refresh token
 * @param token - The refresh token to verify
 * @returns Decoded token payload or null if invalid
 */
export function verifyRefreshToken(token: string): { id: string } | null {
  try {
    const refreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!refreshSecret) {
      throw new Error('Missing JWT refresh secret (JWT_REFRESH_SECRET)');
    }

    const decoded = jwt.verify(token, refreshSecret) as { id: string };
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Extract expiration date from a JWT token
 * @param token - The JWT token
 * @returns Expiration date or null if token is invalid
 */
export function getTokenExpiration(token: string): Date | null {
  try {
    const decoded = jwt.decode(token) as { exp?: number } | null;
    if (decoded && decoded.exp) {
      return new Date(decoded.exp * 1000);
    }
    return null;
  } catch {
    return null;
  }
}
