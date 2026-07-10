import { describe, expect, it, beforeEach, jest, afterEach } from '@jest/globals';

// Mock dependencies before imports
jest.mock('@/lib/middleware/prismaConfig', () => ({
  __esModule: true,
  default: {
    appConfig: {
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    address: {
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    user: { findMany: jest.fn(), count: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
    institution: {
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    userInstitution: {
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    group: { findMany: jest.fn(), count: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
    groupDisability: {
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    event: { findMany: jest.fn(), count: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
    eventAccessibility: {
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    scoringConfiguration: {
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    scoringCriterion: {
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    registration: {
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    registrationDisability: {
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    notification: {
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    passwordResetToken: {
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    refreshTokenBlacklist: {
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    passwordHistory: {
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    securityLog: {
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    // Backup storage table
    backup: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/middleware/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import prisma from '@/lib/middleware/prismaConfig';
import {
  createBackup,
  listBackups,
  loadBackup,
  compareBackup,
  restoreBackup,
  TABLE_NAMES,
  countTableData,
} from '../backup/backupService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const backupModel = (prisma as any).backup as Record<string, jest.Mock<any>>;

describe('backupService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: all findMany returns empty arrays
    for (const tableName of TABLE_NAMES) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const model = (prisma as any)[tableName];
      if (model) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (model.findMany as jest.Mock<any>).mockResolvedValue([]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (model.count as jest.Mock<any>).mockResolvedValue(0);
      }
    }

    // Default backup table behaviour
    backupModel.create.mockResolvedValue({});
    backupModel.findMany.mockResolvedValue([]);
    backupModel.findUnique.mockResolvedValue(null);
    backupModel.deleteMany.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createBackup', () => {
    it('should create a backup row with all tables', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((prisma as any).user.findMany as jest.Mock<any>).mockResolvedValue([
        { id: 'user1', email: 'test@test.com', last_name: 'Test' },
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((prisma as any).event.findMany as jest.Mock<any>).mockResolvedValue([
        { id: 'event1', title: 'Concert' },
        { id: 'event2', title: 'Opera' },
      ]);

      const result = await createBackup();

      expect(result.filename).toMatch(
        /^backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-f]{6}\.json$/,
      );
      expect(result.sizeBytes).toBeGreaterThan(0);
      expect(result.tableCount).toBe(TABLE_NAMES.length);
      expect(result.recordCounts.user).toBe(1);
      expect(result.recordCounts.event).toBe(2);
      expect(backupModel.create).toHaveBeenCalledTimes(1);

      // Verify persisted backup structure
      const createArg = backupModel.create.mock.calls[0][0] as {
        data: { content: { metadata: { version: string }; tables: Record<string, unknown[]> } };
      };
      expect(createArg.data.content.metadata.version).toBe('1.0');
      expect(createArg.data.content.tables.user).toHaveLength(1);
      expect(createArg.data.content.tables.event).toHaveLength(2);
    });

    it('should handle table export errors gracefully', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((prisma as any).user.findMany as jest.Mock<any>).mockRejectedValue(new Error('DB error'));

      const result = await createBackup();

      // Should still create backup, just with empty user table
      expect(result.recordCounts.user).toBe(0);
      expect(result.filename).toBeDefined();
      expect(backupModel.create).toHaveBeenCalledTimes(1);
    });

    it('should clean up old backups beyond retention limit', async () => {
      // 2 rows beyond the retention limit remain after skip: MAX_BACKUPS
      backupModel.findMany.mockResolvedValue([{ id: 'old1' }, { id: 'old2' }]);
      backupModel.deleteMany.mockResolvedValue({ count: 2 });

      const result = await createBackup();

      expect(result.cleanedUp).toBe(2);
      expect(backupModel.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['old1', 'old2'] } },
      });
    });

    it('should report 0 cleaned up when deleteMany fails', async () => {
      backupModel.findMany.mockResolvedValue([{ id: 'old1' }]);
      backupModel.deleteMany.mockRejectedValue(new Error('Delete failed'));

      const result = await createBackup();
      expect(result.cleanedUp).toBe(0);
    });
  });

  describe('listBackups', () => {
    it('should list available backups (newest first from DB ordering)', async () => {
      backupModel.findMany.mockResolvedValue([
        {
          filename: 'backup-2026-02-21T10-00-00-000Z-abc123.json',
          created_at: new Date('2026-02-21T10:00:00Z'),
          size_bytes: 2000,
          table_count: 18,
        },
        {
          filename: 'backup-2026-02-20T10-00-00-000Z-def456.json',
          created_at: new Date('2026-02-20T10:00:00Z'),
          size_bytes: 1000,
          table_count: 18,
        },
      ]);

      const backups = await listBackups();

      expect(backups).toHaveLength(2);
      expect(backups[0].filename).toBe('backup-2026-02-21T10-00-00-000Z-abc123.json');
      expect(backups[0].sizeBytes).toBe(2000);
      expect(backups[0].tableCount).toBe(18);
      expect(backups[0].createdAt).toBe(new Date('2026-02-21T10:00:00Z').toISOString());
      expect(backups[1].filename).toBe('backup-2026-02-20T10-00-00-000Z-def456.json');
    });

    it('should return empty array when no backups exist', async () => {
      backupModel.findMany.mockResolvedValue([]);

      const backups = await listBackups();
      expect(backups).toHaveLength(0);
    });
  });

  describe('loadBackup', () => {
    it('should load a valid backup by filename', async () => {
      const backupData = {
        metadata: { createdAt: '2026-02-22T10:00:00Z', version: '1.0', tableCount: 18 },
        tables: { user: [{ id: 'u1' }] },
      };
      backupModel.findUnique.mockResolvedValue({ content: backupData });

      const result = await loadBackup('backup-2026-02-22.json');
      expect(result.metadata.version).toBe('1.0');
      expect(result.tables.user).toHaveLength(1);
      expect(backupModel.findUnique).toHaveBeenCalledWith({
        where: { filename: 'backup-2026-02-22.json' },
        select: { content: true },
      });
    });

    it('should throw when the backup does not exist', async () => {
      backupModel.findUnique.mockResolvedValue(null);

      await expect(loadBackup('nonexistent.json')).rejects.toThrow('not found');
    });
  });

  describe('compareBackup', () => {
    it('should detect added, removed, and modified records', async () => {
      const backupData = {
        metadata: { createdAt: '2026-02-22T10:00:00Z', version: '1.0', tableCount: 18 },
        tables: {
          user: [
            { id: 'u1', email: 'a@a.com', updated_at: '2026-02-20T10:00:00Z' },
            { id: 'u2', email: 'b@b.com', updated_at: '2026-02-20T10:00:00Z' },
            { id: 'u3', email: 'c@c.com', updated_at: '2026-02-20T10:00:00Z' },
          ],
        },
      };
      backupModel.findUnique.mockResolvedValue({ content: backupData });

      // Current DB has: u1 (modified), u2 (unchanged), u4 (added). u3 was removed.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((prisma as any).user.findMany as jest.Mock<any>).mockResolvedValue([
        { id: 'u1', email: 'a_modified@a.com', updated_at: new Date('2026-02-21T10:00:00Z') },
        { id: 'u2', email: 'b@b.com', updated_at: new Date('2026-02-20T10:00:00Z') },
        { id: 'u4', email: 'd@d.com', updated_at: new Date('2026-02-21T10:00:00Z') },
      ]);

      const result = await compareBackup('test-backup.json');

      const userDiff = result.tables.find((t) => t.table === 'user');
      expect(userDiff).toBeDefined();
      expect(userDiff!.backupCount).toBe(3);
      expect(userDiff!.currentCount).toBe(3);
      expect(userDiff!.added).toBe(1); // u4
      expect(userDiff!.removed).toBe(1); // u3
      expect(userDiff!.modified).toBe(1); // u1

      expect(result.summary.totalAdded).toBeGreaterThanOrEqual(1);
      expect(result.summary.totalRemoved).toBeGreaterThanOrEqual(1);
      expect(result.summary.totalModified).toBeGreaterThanOrEqual(1);
    });

    it('should show no differences when backup matches current DB', async () => {
      const records = [{ id: 'u1', email: 'a@a.com', updated_at: '2026-02-20T10:00:00.000Z' }];
      const backupData = {
        metadata: { createdAt: '2026-02-22T10:00:00Z', version: '1.0', tableCount: 18 },
        tables: { user: records },
      };
      backupModel.findUnique.mockResolvedValue({ content: backupData });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((prisma as any).user.findMany as jest.Mock<any>).mockResolvedValue([
        { id: 'u1', email: 'a@a.com', updated_at: new Date('2026-02-20T10:00:00.000Z') },
      ]);

      const result = await compareBackup('test-backup.json');

      const userDiff = result.tables.find((t) => t.table === 'user');
      expect(userDiff!.added).toBe(0);
      expect(userDiff!.removed).toBe(0);
      expect(userDiff!.modified).toBe(0);
    });

    it('should use JSON fallback when records have no updated_at field', async () => {
      const backupData = {
        metadata: { createdAt: '2026-02-22T10:00:00Z', version: '1.0', tableCount: 18 },
        tables: {
          user: [
            { id: 'u1', name: 'Alice' },
            { id: 'u2', name: 'Bob' },
          ],
        },
      };
      backupModel.findUnique.mockResolvedValue({ content: backupData });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((prisma as any).user.findMany as jest.Mock<any>).mockResolvedValue([
        { id: 'u1', name: 'Alice Updated' },
        { id: 'u2', name: 'Bob' },
      ]);

      const result = await compareBackup('test-backup.json');
      const userDiff = result.tables.find((t) => t.table === 'user');
      expect(userDiff!.modified).toBe(1);
    });

    it('should handle records without id field', async () => {
      const backupData = {
        metadata: { createdAt: '2026-02-22T10:00:00Z', version: '1.0', tableCount: 18 },
        tables: { user: [{ name: 'no-id-record' }] },
      };
      backupModel.findUnique.mockResolvedValue({ content: backupData });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((prisma as any).user.findMany as jest.Mock<any>).mockResolvedValue([
        { name: 'another-no-id' },
      ]);

      const result = await compareBackup('test-backup.json');
      const userDiff = result.tables.find((t) => t.table === 'user');
      expect(userDiff!.added).toBe(0);
      expect(userDiff!.removed).toBe(0);
      expect(userDiff!.modified).toBe(0);
    });

    it('should handle backup with missing metadata gracefully', async () => {
      const backupData = { tables: { user: [] } };
      backupModel.findUnique.mockResolvedValue({ content: backupData });

      const result = await compareBackup('test-backup.json');
      expect(result.backupDate).toBe('Unknown');
    });
  });

  describe('restoreBackup', () => {
    it('should create safety backup, then restore data in correct order', async () => {
      const backupData = {
        metadata: { createdAt: '2026-02-22T10:00:00Z', version: '1.0', tableCount: 18 },
        tables: {
          user: [{ id: 'u1', email: 'test@test.com' }],
          event: [{ id: 'e1', title: 'Concert' }],
        },
      };
      backupModel.findUnique.mockResolvedValue({ content: backupData });

      // Mock transaction - execute the callback with prisma as the tx client
      (prisma.$transaction as jest.MockedFunction<typeof prisma.$transaction>).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (fn: any) => fn(prisma),
      );

      const result = await restoreBackup('test-backup.json');

      expect(result.restoredFrom).toBe('test-backup.json');
      expect(result.safetyBackup).toBeDefined();
      expect(result.recordCounts.user).toBe(1);
      expect(result.recordCounts.event).toBe(1);
      expect(prisma.$transaction).toHaveBeenCalled();
      // Safety backup persisted
      expect(backupModel.create).toHaveBeenCalled();
    });

    it('should throw when the backup does not exist', async () => {
      backupModel.findUnique.mockResolvedValue(null);

      await expect(restoreBackup('nonexistent.json')).rejects.toThrow('not found');
    });

    it('should throw when deleteMany fails during restore', async () => {
      const backupData = {
        metadata: { createdAt: '2026-02-22T10:00:00Z', version: '1.0', tableCount: 18 },
        tables: { user: [{ id: 'u1' }] },
      };
      backupModel.findUnique.mockResolvedValue({ content: backupData });

      (prisma.$transaction as jest.MockedFunction<typeof prisma.$transaction>).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (fn: any) => {
          const txMock = {
            ...Object.fromEntries(
              TABLE_NAMES.map((t) => [
                t,
                {
                  deleteMany: jest
                    .fn<() => Promise<void>>()
                    .mockRejectedValue(new Error('Delete failed')),
                  createMany: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
                },
              ]),
            ),
          };
          return fn(txMock);
        },
      );

      await expect(restoreBackup('test-backup.json')).rejects.toThrow('Delete failed');
    });

    it('should throw when createMany fails during restore', async () => {
      const backupData = {
        metadata: { createdAt: '2026-02-22T10:00:00Z', version: '1.0', tableCount: 18 },
        tables: { user: [{ id: 'u1' }] },
      };
      backupModel.findUnique.mockResolvedValue({ content: backupData });

      (prisma.$transaction as jest.MockedFunction<typeof prisma.$transaction>).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (fn: any) => {
          const txMock = {
            ...Object.fromEntries(
              TABLE_NAMES.map((t) => [
                t,
                {
                  deleteMany: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
                  createMany: jest
                    .fn<() => Promise<void>>()
                    .mockRejectedValue(new Error('Insert failed')),
                },
              ]),
            ),
          };
          return fn(txMock);
        },
      );

      await expect(restoreBackup('test-backup.json')).rejects.toThrow('Insert failed');
    });

    it('should fall back to sequential restore on P5000 (Prisma Accelerate)', async () => {
      const backupData = {
        metadata: { createdAt: '2026-02-22T10:00:00Z', version: '1.0', tableCount: 18 },
        tables: { user: [{ id: 'u1', email: 'test@test.com' }] },
      };
      backupModel.findUnique.mockResolvedValue({ content: backupData });

      const p5000Error = new Error('BadRequestError') as Error & { code: string };
      p5000Error.code = 'P5000';
      (prisma.$transaction as jest.MockedFunction<typeof prisma.$transaction>).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (fn: any) => {
          const txMock = {
            ...Object.fromEntries(
              TABLE_NAMES.map((t) => [
                t,
                {
                  deleteMany: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
                  createMany: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
                },
              ]),
            ),
          };
          try {
            await fn(txMock);
          } catch {
            // Ignore inner error
          }
          throw p5000Error;
        },
      );

      const result = await restoreBackup('test-backup.json');

      // Should succeed via sequential fallback (using prisma directly)
      expect(result.restoredFrom).toBe('test-backup.json');
      expect(result.recordCounts.user).toBe(1);
    });
  });

  describe('countTableData', () => {
    it('should return the count for a valid table', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((prisma as any).user.count as jest.Mock<any>).mockResolvedValue(42);

      const result = await countTableData('user');
      expect(result).toBe(42);
    });

    it('should return 0 for a table without count method', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const original = (prisma as any).user.count;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma as any).user.count = undefined;

      const result = await countTableData('user');
      expect(result).toBe(0);

      // Restore
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma as any).user.count = original;
    });
  });

  describe('fetchTableData - model not found', () => {
    it('should return empty array and warn when model is not in prisma client', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const original = (prisma as any).user.findMany;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma as any).user.findMany = undefined;

      const backupData = {
        metadata: { createdAt: '2026-02-22T10:00:00Z', version: '1.0', tableCount: 18 },
        tables: { user: [{ id: 'u1' }] },
      };
      backupModel.findUnique.mockResolvedValue({ content: backupData });

      const result = await compareBackup('test-backup.json');
      const userDiff = result.tables.find((t) => t.table === 'user');
      expect(userDiff!.currentCount).toBe(0);

      // Restore
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma as any).user.findMany = original;
    });
  });
});
