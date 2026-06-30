import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import {
  isPasswordReused,
  addPasswordToHistory,
  changePasswordWithHistory,
  resetPasswordWithHistory,
} from '@/lib/auth/passwordHistory';
import prisma from '@/lib/middleware/prismaConfig';
import bcrypt from 'bcrypt';

// Mock Prisma
jest.mock('@/lib/middleware/prismaConfig', () => ({
  __esModule: true,
  default: {
    passwordHistory: {
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock bcrypt
jest.mock('bcrypt');

// Type the mocked functions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockedPrisma = prisma as any as {
  passwordHistory: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findMany: jest.Mock<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: jest.Mock<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deleteMany: jest.Mock<any>;
  };
  user: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findUnique: jest.Mock<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: jest.Mock<any>;
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockedBcrypt = bcrypt as any as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  compare: jest.Mock<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hash: jest.Mock<any>;
};

describe('Password History Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isPasswordReused', () => {
    test('returns true if password matches current password', async () => {
      const userId = 'user123';
      const password = 'TestPassword123';
      const hashedPassword = await bcrypt.hash(password, 10);

      mockedPrisma.passwordHistory.findMany.mockResolvedValue([]);
      mockedPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        password: hashedPassword,
      });
      mockedBcrypt.compare.mockResolvedValue(true);

      const result = await isPasswordReused(userId, password);
      expect(result).toBe(true);
    });

    test('returns true if password matches one in history', async () => {
      const userId = 'user123';
      const password = 'TestPassword123';
      const hashedPassword = await bcrypt.hash(password, 10);

      mockedPrisma.passwordHistory.findMany.mockResolvedValue([
        { id: '1', user_id: userId, password_hash: hashedPassword, created_at: new Date() },
      ]);
      mockedPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        password: 'different-hash',
      });
      mockedBcrypt.compare
        .mockResolvedValueOnce(false) // current password
        .mockResolvedValueOnce(true); // history password

      const result = await isPasswordReused(userId, password);
      expect(result).toBe(true);
    });

    test('returns false if password is new', async () => {
      const userId = 'user123';
      const password = 'NewPassword123';

      mockedPrisma.passwordHistory.findMany.mockResolvedValue([]);
      mockedPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        password: 'different-hash',
      });
      mockedBcrypt.compare.mockResolvedValue(false);

      const result = await isPasswordReused(userId, password);
      expect(result).toBe(false);
    });

    test('returns false if user not found', async () => {
      const userId = 'nonexistent';
      const password = 'TestPassword123';

      mockedPrisma.user.findUnique.mockResolvedValue(null);

      const result = await isPasswordReused(userId, password);
      expect(result).toBe(false);
    });
  });

  describe('addPasswordToHistory', () => {
    test('adds password to history', async () => {
      const userId = 'user123';
      const passwordHash = 'hashed-password';

      mockedPrisma.passwordHistory.create.mockResolvedValue({
        id: '1',
        user_id: userId,
        password_hash: passwordHash,
        created_at: new Date(),
      });
      mockedPrisma.passwordHistory.findMany.mockResolvedValue([
        { id: '1', user_id: userId, password_hash: passwordHash, created_at: new Date() },
      ]);
      mockedPrisma.passwordHistory.deleteMany.mockResolvedValue({ count: 0 });

      await addPasswordToHistory(userId, passwordHash);

      expect(prisma.passwordHistory.create).toHaveBeenCalledWith({
        data: {
          user_id: userId,
          password_hash: passwordHash,
        },
      });
    });

    test('deletes old passwords when exceeding limit', async () => {
      const userId = 'user123';
      const passwordHash = 'hashed-password';

      // Mock 6 existing passwords (limit is 5)
      const existingPasswords = Array.from({ length: 6 }, (_, i) => ({
        id: `pass${i}`,
        user_id: userId,
        password_hash: `hash${i}`,
        created_at: new Date(Date.now() - i * 1000),
      }));

      mockedPrisma.passwordHistory.create.mockResolvedValue(existingPasswords[0]);
      mockedPrisma.passwordHistory.findMany.mockResolvedValue(existingPasswords);
      mockedPrisma.passwordHistory.deleteMany.mockResolvedValue({ count: 1 });

      await addPasswordToHistory(userId, passwordHash);

      expect(prisma.passwordHistory.deleteMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ['pass5'],
          },
        },
      });
    });
  });

  describe('changePasswordWithHistory', () => {
    test('successfully changes password if not reused', async () => {
      const userId = 'user123';
      const currentPassword = 'OldPass123';
      const newPassword = 'NewPass456';
      const hashedOldPassword = 'hashed-old';
      const hashedNewPassword = 'hashed-new';

      mockedPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        password: hashedOldPassword,
      });
      mockedBcrypt.compare
        .mockResolvedValueOnce(true) // current password verification
        .mockResolvedValue(false); // password not reused
      mockedBcrypt.hash.mockResolvedValue(hashedNewPassword);
      mockedPrisma.passwordHistory.findMany.mockResolvedValue([]);
      mockedPrisma.passwordHistory.create.mockResolvedValue({});
      mockedPrisma.user.update.mockResolvedValue({});

      const result = await changePasswordWithHistory(userId, currentPassword, newPassword);

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalled();
    });

    test('rejects password change if current password is incorrect', async () => {
      const userId = 'user123';
      const currentPassword = 'WrongPass123';
      const newPassword = 'NewPass456';

      mockedPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        password: 'hashed-password',
      });
      mockedBcrypt.compare.mockResolvedValue(false);

      const result = await changePasswordWithHistory(userId, currentPassword, newPassword);

      expect(result.success).toBe(false);
      expect(result.error).toContain('incorrect');
    });

    test('rejects password change if password was used before', async () => {
      const userId = 'user123';
      const currentPassword = 'OldPass123';
      const newPassword = 'UsedPass123';

      mockedPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        password: 'hashed-old',
      });
      mockedBcrypt.compare
        .mockResolvedValueOnce(true) // current password verification
        .mockResolvedValueOnce(false) // check current
        .mockResolvedValueOnce(true); // found in history
      mockedPrisma.passwordHistory.findMany.mockResolvedValue([
        { id: '1', password_hash: 'hashed-used' },
      ]);

      const result = await changePasswordWithHistory(userId, currentPassword, newPassword);

      expect(result.success).toBe(false);
      expect(result.error).toContain('déjà été utilisé');
    });

    test('returns error if user not found in changePasswordWithHistory', async () => {
      const userId = 'nonexistent';
      const currentPassword = 'CurrentPass123';
      const newPassword = 'NewPass456';

      mockedPrisma.user.findUnique.mockResolvedValue(null);

      const result = await changePasswordWithHistory(userId, currentPassword, newPassword);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Utilisateur non trouvé');
    });
  });

  describe('resetPasswordWithHistory', () => {
    test('successfully resets password if not reused', async () => {
      const userId = 'user123';
      const newPassword = 'NewPass456';
      const hashedNewPassword = 'hashed-new';

      mockedPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        password: 'hashed-old',
      });
      mockedBcrypt.compare.mockResolvedValue(false); // password not reused
      mockedBcrypt.hash.mockResolvedValue(hashedNewPassword);
      mockedPrisma.passwordHistory.findMany.mockResolvedValue([]);
      mockedPrisma.passwordHistory.create.mockResolvedValue({});
      mockedPrisma.user.update.mockResolvedValue({});

      const result = await resetPasswordWithHistory(userId, newPassword);

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalled();
    });

    test('rejects password reset if password was used before', async () => {
      const userId = 'user123';
      const newPassword = 'UsedPass123';

      mockedPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        password: 'hashed-old',
      });
      mockedBcrypt.compare
        .mockResolvedValueOnce(false) // check current
        .mockResolvedValueOnce(true); // found in history
      mockedPrisma.passwordHistory.findMany.mockResolvedValue([
        { id: '1', password_hash: 'hashed-used' },
      ]);

      const result = await resetPasswordWithHistory(userId, newPassword);

      expect(result.success).toBe(false);
      expect(result.error).toContain('déjà été utilisé');
    });

    test('returns error if user not found in resetPasswordWithHistory', async () => {
      const userId = 'nonexistent';
      const newPassword = 'NewPass456';

      mockedPrisma.user.findUnique.mockResolvedValue(null);

      const result = await resetPasswordWithHistory(userId, newPassword);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Utilisateur non trouvé');
    });
  });

  describe('cleanupOldPasswordHistory', () => {
    test('deletes password history older than specified days', async () => {
      mockedPrisma.passwordHistory.deleteMany.mockResolvedValue({ count: 25 });

      const result = await import('@/lib/auth/passwordHistory').then((m) =>
        m.cleanupOldPasswordHistory(365),
      );

      expect(result).toBe(25);
      expect(prisma.passwordHistory.deleteMany).toHaveBeenCalled();
    });

    test('uses default 365 days', async () => {
      mockedPrisma.passwordHistory.deleteMany.mockResolvedValue({ count: 10 });

      const result = await import('@/lib/auth/passwordHistory').then((m) =>
        m.cleanupOldPasswordHistory(),
      );

      expect(result).toBe(10);
      expect(prisma.passwordHistory.deleteMany).toHaveBeenCalled();
    });
  });
});
