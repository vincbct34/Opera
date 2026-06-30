import bcrypt from 'bcrypt';
import prisma from '../middleware/prismaConfig';
import { logger } from '../middleware/logger';

/**
 * Service for managing password history to prevent password reuse
 */

const PASSWORD_HISTORY_LIMIT = 5; // Number of previous passwords to check

/**
 * Check if a password has been used recently.
 * Verifies against the current password and the last N passwords in history.
 * @param userId - The user's ID.
 * @param newPassword - The new password to check.
 * @returns true if the password has been used before, false otherwise.
 */
export async function isPasswordReused(userId: string, newPassword: string): Promise<boolean> {
  // Get the last N passwords for this user
  const passwordHistory = await prisma.passwordHistory.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    take: PASSWORD_HISTORY_LIMIT,
  });

  // Also check the current password
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });

  if (!currentUser) {
    return false;
  }

  // Check current password
  const matchesCurrent = await bcrypt.compare(newPassword, currentUser.password);
  if (matchesCurrent) {
    return true;
  }

  // Check against password history
  for (const record of passwordHistory) {
    const matches = await bcrypt.compare(newPassword, record.password_hash);
    if (matches) {
      return true;
    }
  }

  return false;
}

/**
 * Add a password to the user's history.
 * Maintains a limited history size by deleting older entries.
 * @param userId - The user's ID.
 * @param passwordHash - The hashed password to store.
 */
export async function addPasswordToHistory(userId: string, passwordHash: string): Promise<void> {
  // Add the new password to history
  await prisma.passwordHistory.create({
    data: {
      user_id: userId,
      password_hash: passwordHash,
    },
  });

  // Keep only the last N passwords
  const allPasswords = await prisma.passwordHistory.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
  });

  // Delete older passwords if we have more than the limit
  if (allPasswords.length > PASSWORD_HISTORY_LIMIT) {
    const toDelete = allPasswords.slice(PASSWORD_HISTORY_LIMIT);
    await prisma.passwordHistory.deleteMany({
      where: {
        id: {
          in: toDelete.map((p) => p.id),
        },
      },
    });
  }
}

/**
 * Change a user's password with history validation
 * @param userId - The user's ID
 * @param currentPassword - The current password for verification
 * @param newPassword - The new password to set
 * @returns Success message or error
 */
export async function changePasswordWithHistory(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  // Get the user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });

  if (!user) {
    return { success: false, error: 'Utilisateur non trouvé' };
  }

  // Verify current password
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
  if (!isCurrentPasswordValid) {
    return { success: false, error: 'Mot de passe actuel incorrect' };
  }

  // Check if new password was used before
  const isReused = await isPasswordReused(userId, newPassword);
  if (isReused) {
    return {
      success: false,
      error: `Ce mot de passe a déjà été utilisé récemment. Veuillez en choisir un nouveau.`,
    };
  }

  // Save old password to history before updating
  await addPasswordToHistory(userId, user.password);

  // Hash and update the new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      last_password_change: new Date(),
    },
  });

  return { success: true };
}

/**
 * Reset password with history validation (for password reset flow)
 * @param userId - The user's ID
 * @param newPassword - The new password to set
 * @returns Success message or error
 */
export async function resetPasswordWithHistory(
  userId: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  // Get the user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });

  if (!user) {
    return { success: false, error: 'Utilisateur non trouvé' };
  }

  // Check if new password was used before
  const isReused = await isPasswordReused(userId, newPassword);
  if (isReused) {
    return {
      success: false,
      error: `Ce mot de passe a déjà été utilisé récemment. Veuillez en choisir un nouveau.`,
    };
  }

  // Save old password to history before updating
  await addPasswordToHistory(userId, user.password);

  // Hash and update the new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      last_password_change: new Date(),
    },
  });

  return { success: true };
}

/**
 * Clean up old password history (run periodically via cron)
 * Keeps history for 365 days by default
 */
export async function cleanupOldPasswordHistory(daysToKeep: number = 365): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = await prisma.passwordHistory.deleteMany({
    where: {
      created_at: {
        lt: cutoffDate,
      },
    },
  });

  logger.info(`Cleaned up ${result.count} password history records older than ${daysToKeep} days`);
  return result.count;
}
