import { describe, expect, it, beforeEach, jest, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';

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

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn(),
    unlink: jest.fn(),
  },
}));

import prisma from '@/lib/middleware/prismaConfig';
import {
  createBackup,
  listBackups,
  loadBackup,
  compareBackup,
  restoreBackup,
  BACKUP_DIR,
  TABLE_NAMES,
  ensureBackupDir,
  countTableData,
} from '../backup/backupService';

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
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createBackup', () => {
    it('should create a backup file with all tables', async () => {
      // Mock some data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((prisma as any).user.findMany as jest.Mock<any>).mockResolvedValue([
        { id: 'user1', email: 'test@test.com', last_name: 'Test' },
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((prisma as any).event.findMany as jest.Mock<any>).mockResolvedValue([
        { id: 'event1', title: 'Concert' },
        { id: 'event2', title: 'Opera' },
      ]);

      (fs.mkdir as jest.MockedFunction<typeof fs.mkdir>).mockResolvedValue(undefined);
      (fs.writeFile as jest.MockedFunction<typeof fs.writeFile>).mockResolvedValue(undefined);
      (fs.stat as jest.MockedFunction<typeof fs.stat>).mockResolvedValue({
        size: 12345,
        mtime: new Date(),
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);
      (fs.readdir as jest.MockedFunction<typeof fs.readdir>).mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof fs.readdir>>,
      );

      const result = await createBackup();

      expect(result.filename).toMatch(/^backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/);
      expect(result.sizeBytes).toBe(12345);
      expect(result.tableCount).toBe(TABLE_NAMES.length);
      expect(result.recordCounts.user).toBe(1);
      expect(result.recordCounts.event).toBe(2);
      expect(fs.writeFile).toHaveBeenCalledTimes(1);

      // Verify backup JSON structure
      const writtenContent = (fs.writeFile as jest.MockedFunction<typeof fs.writeFile>).mock
        .calls[0][1] as string;
      const parsed = JSON.parse(writtenContent);
      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.version).toBe('1.0');
      expect(parsed.tables).toBeDefined();
      expect(parsed.tables.user).toHaveLength(1);
      expect(parsed.tables.event).toHaveLength(2);
    });

    it('should handle table export errors gracefully', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((prisma as any).user.findMany as jest.Mock<any>).mockRejectedValue(new Error('DB error'));

      (fs.mkdir as jest.MockedFunction<typeof fs.mkdir>).mockResolvedValue(undefined);
      (fs.writeFile as jest.MockedFunction<typeof fs.writeFile>).mockResolvedValue(undefined);
      (fs.stat as jest.MockedFunction<typeof fs.stat>).mockResolvedValue({
        size: 100,
        mtime: new Date(),
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);
      (fs.readdir as jest.MockedFunction<typeof fs.readdir>).mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof fs.readdir>>,
      );

      const result = await createBackup();

      // Should still create backup, just with empty user table
      expect(result.recordCounts.user).toBe(0);
      expect(result.filename).toBeDefined();
    });

    it('should clean up old backups beyond retention limit', async () => {
      (fs.mkdir as jest.MockedFunction<typeof fs.mkdir>).mockResolvedValue(undefined);
      (fs.writeFile as jest.MockedFunction<typeof fs.writeFile>).mockResolvedValue(undefined);
      (fs.stat as jest.MockedFunction<typeof fs.stat>).mockResolvedValue({
        size: 100,
        mtime: new Date(),
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);
      (fs.unlink as jest.MockedFunction<typeof fs.unlink>).mockResolvedValue(undefined);

      // Simulate 32 existing files (exceeds MAX_BACKUPS=30 + 1 new)
      const mockFiles = Array.from(
        { length: 32 },
        (_, i) => `backup-2026-01-${String(i + 1).padStart(2, '0')}T00-00-00.json`,
      );
      (fs.readdir as jest.MockedFunction<typeof fs.readdir>).mockResolvedValue(
        mockFiles as unknown as Awaited<ReturnType<typeof fs.readdir>>,
      );

      const result = await createBackup();

      // Should have deleted 2 old backups (32 - 30 = 2)
      expect(result.cleanedUp).toBe(2);
      expect(fs.unlink).toHaveBeenCalledTimes(2);
    });
  });

  describe('listBackups', () => {
    it('should list available backups sorted by date', async () => {
      (fs.mkdir as jest.MockedFunction<typeof fs.mkdir>).mockResolvedValue(undefined);
      (fs.readdir as jest.MockedFunction<typeof fs.readdir>).mockResolvedValue([
        'backup-2026-02-20T10-00-00.json',
        'backup-2026-02-21T10-00-00.json',
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

      const olderDate = new Date('2026-02-20T10:00:00Z');
      const newerDate = new Date('2026-02-21T10:00:00Z');

      (fs.stat as jest.MockedFunction<typeof fs.stat>)
        .mockResolvedValueOnce({ mtime: olderDate, size: 1000 } as unknown as Awaited<
          ReturnType<typeof fs.stat>
        >)
        .mockResolvedValueOnce({ mtime: newerDate, size: 2000 } as unknown as Awaited<
          ReturnType<typeof fs.stat>
        >);

      const backupContent1 = JSON.stringify({
        metadata: { createdAt: '2026-02-20T10:00:00Z', version: '1.0', tableCount: 18 },
        tables: {},
      });
      const backupContent2 = JSON.stringify({
        metadata: { createdAt: '2026-02-21T10:00:00Z', version: '1.0', tableCount: 18 },
        tables: {},
      });

      (fs.readFile as jest.MockedFunction<typeof fs.readFile>)
        .mockResolvedValueOnce(backupContent2 as unknown as Awaited<ReturnType<typeof fs.readFile>>)
        .mockResolvedValueOnce(
          backupContent1 as unknown as Awaited<ReturnType<typeof fs.readFile>>,
        );

      const backups = await listBackups();

      expect(backups).toHaveLength(2);
      // Newest first
      expect(backups[0].filename).toBe('backup-2026-02-21T10-00-00.json');
      expect(backups[1].filename).toBe('backup-2026-02-20T10-00-00.json');
    });

    it('should return empty array when no backups exist', async () => {
      (fs.mkdir as jest.MockedFunction<typeof fs.mkdir>).mockResolvedValue(undefined);
      (fs.readdir as jest.MockedFunction<typeof fs.readdir>).mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof fs.readdir>>,
      );

      const backups = await listBackups();
      expect(backups).toHaveLength(0);
    });

    it('should handle parsing errors in backup files', async () => {
      (fs.mkdir as jest.MockedFunction<typeof fs.mkdir>).mockResolvedValue(undefined);
      (fs.readdir as jest.MockedFunction<typeof fs.readdir>).mockResolvedValue([
        'backup-corrupt.json',
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);
      (fs.stat as jest.MockedFunction<typeof fs.stat>).mockResolvedValue({
        mtime: new Date('2026-02-20'),
        size: 50,
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);
      (fs.readFile as jest.MockedFunction<typeof fs.readFile>).mockResolvedValue(
        'invalid json' as unknown as Awaited<ReturnType<typeof fs.readFile>>,
      );

      const backups = await listBackups();
      expect(backups).toHaveLength(1);
      expect(backups[0].tableCount).toBe(0); // Fallback
    });
  });

  describe('loadBackup', () => {
    it('should load and parse a valid backup file', async () => {
      const backupData = {
        metadata: { createdAt: '2026-02-22T10:00:00Z', version: '1.0', tableCount: 18 },
        tables: { user: [{ id: 'u1' }] },
      };

      (fs.readFile as jest.MockedFunction<typeof fs.readFile>).mockResolvedValue(
        JSON.stringify(backupData) as unknown as Awaited<ReturnType<typeof fs.readFile>>,
      );

      const result = await loadBackup('backup-2026-02-22T10-00-00.json');
      expect(result.metadata.version).toBe('1.0');
      expect(result.tables.user).toHaveLength(1);
    });

    it('should throw when file is not found', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.readFile as jest.MockedFunction<typeof fs.readFile>).mockRejectedValue(error);

      await expect(loadBackup('nonexistent.json')).rejects.toThrow('not found');
    });

    it('should sanitize filename to prevent path traversal', async () => {
      (fs.readFile as jest.MockedFunction<typeof fs.readFile>).mockResolvedValue(
        '{}' as unknown as Awaited<ReturnType<typeof fs.readFile>>,
      );

      await loadBackup('../../etc/passwd');

      // Should use basename only
      expect(fs.readFile).toHaveBeenCalledWith(path.join(BACKUP_DIR, 'passwd'), 'utf-8');
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
          // All other tables empty
        },
      };

      (fs.readFile as jest.MockedFunction<typeof fs.readFile>).mockResolvedValue(
        JSON.stringify(backupData) as unknown as Awaited<ReturnType<typeof fs.readFile>>,
      );

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

      (fs.readFile as jest.MockedFunction<typeof fs.readFile>).mockResolvedValue(
        JSON.stringify(backupData) as unknown as Awaited<ReturnType<typeof fs.readFile>>,
      );

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

      // Mock loadBackup
      (fs.readFile as jest.MockedFunction<typeof fs.readFile>).mockResolvedValue(
        JSON.stringify(backupData) as unknown as Awaited<ReturnType<typeof fs.readFile>>,
      );

      // Mock safety backup creation
      (fs.mkdir as jest.MockedFunction<typeof fs.mkdir>).mockResolvedValue(undefined);
      (fs.writeFile as jest.MockedFunction<typeof fs.writeFile>).mockResolvedValue(undefined);
      (fs.stat as jest.MockedFunction<typeof fs.stat>).mockResolvedValue({
        size: 100,
        mtime: new Date(),
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);
      (fs.readdir as jest.MockedFunction<typeof fs.readdir>).mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof fs.readdir>>,
      );

      // Mock transaction - execute the callback
      (prisma.$transaction as jest.MockedFunction<typeof prisma.$transaction>).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (fn: any) => {
          // Pass prisma itself as the transaction client
          return fn(prisma);
        },
      );

      const result = await restoreBackup('test-backup.json');

      expect(result.restoredFrom).toBe('test-backup.json');
      expect(result.safetyBackup).toBeDefined();
      expect(result.recordCounts.user).toBe(1);
      expect(result.recordCounts.event).toBe(1);

      // Verify transaction was called
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should throw when backup file does not exist', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.readFile as jest.MockedFunction<typeof fs.readFile>).mockRejectedValue(error);

      await expect(restoreBackup('nonexistent.json')).rejects.toThrow('not found');
    });
  });

  describe('ensureBackupDir', () => {
    it('should create backup directory recursively', async () => {
      (fs.mkdir as jest.MockedFunction<typeof fs.mkdir>).mockResolvedValue(undefined);

      await ensureBackupDir();

      expect(fs.mkdir).toHaveBeenCalledWith(BACKUP_DIR, { recursive: true });
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

  describe('loadBackup - non-ENOENT error', () => {
    it('should throw a generic error for non-ENOENT read failures', async () => {
      const error = new Error('Permission denied');
      (fs.readFile as jest.MockedFunction<typeof fs.readFile>).mockRejectedValue(error);

      await expect(loadBackup('test.json')).rejects.toThrow(
        'Failed to read backup file "test.json": Permission denied',
      );
    });
  });

  describe('compareBackup - JSON fallback comparison', () => {
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

      (fs.readFile as jest.MockedFunction<typeof fs.readFile>).mockResolvedValue(
        JSON.stringify(backupData) as unknown as Awaited<ReturnType<typeof fs.readFile>>,
      );

      // u1 modified (name changed), u2 unchanged
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((prisma as any).user.findMany as jest.Mock<any>).mockResolvedValue([
        { id: 'u1', name: 'Alice Updated' },
        { id: 'u2', name: 'Bob' },
      ]);

      const result = await compareBackup('test-backup.json');
      const userDiff = result.tables.find((t) => t.table === 'user');
      expect(userDiff!.modified).toBe(1); // u1 modified via JSON comparison
    });

    it('should not count as modified when JSON comparison matches', async () => {
      const backupData = {
        metadata: { createdAt: '2026-02-22T10:00:00Z', version: '1.0', tableCount: 18 },
        tables: {
          user: [{ id: 'u1', name: 'Alice' }],
        },
      };

      (fs.readFile as jest.MockedFunction<typeof fs.readFile>).mockResolvedValue(
        JSON.stringify(backupData) as unknown as Awaited<ReturnType<typeof fs.readFile>>,
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((prisma as any).user.findMany as jest.Mock<any>).mockResolvedValue([
        { id: 'u1', name: 'Alice' },
      ]);

      const result = await compareBackup('test-backup.json');
      const userDiff = result.tables.find((t) => t.table === 'user');
      expect(userDiff!.modified).toBe(0);
    });
  });

  describe('restoreBackup - transaction errors', () => {
    const setupRestoreMocks = () => {
      (fs.mkdir as jest.MockedFunction<typeof fs.mkdir>).mockResolvedValue(undefined);
      (fs.writeFile as jest.MockedFunction<typeof fs.writeFile>).mockResolvedValue(undefined);
      (fs.stat as jest.MockedFunction<typeof fs.stat>).mockResolvedValue({
        size: 100,
        mtime: new Date(),
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);
      (fs.readdir as jest.MockedFunction<typeof fs.readdir>).mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof fs.readdir>>,
      );
    };

    it('should throw when deleteMany fails during restore', async () => {
      const backupData = {
        metadata: { createdAt: '2026-02-22T10:00:00Z', version: '1.0', tableCount: 18 },
        tables: { user: [{ id: 'u1' }] },
      };

      (fs.readFile as jest.MockedFunction<typeof fs.readFile>).mockResolvedValue(
        JSON.stringify(backupData) as unknown as Awaited<ReturnType<typeof fs.readFile>>,
      );

      setupRestoreMocks();

      // Mock transaction to simulate deleteMany error
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

      (fs.readFile as jest.MockedFunction<typeof fs.readFile>).mockResolvedValue(
        JSON.stringify(backupData) as unknown as Awaited<ReturnType<typeof fs.readFile>>,
      );

      setupRestoreMocks();

      // Mock transaction to simulate createMany error
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

      (fs.readFile as jest.MockedFunction<typeof fs.readFile>).mockResolvedValue(
        JSON.stringify(backupData) as unknown as Awaited<ReturnType<typeof fs.readFile>>,
      );

      setupRestoreMocks();

      // $transaction throws P5000 after partially running (simulates Prisma Accelerate)
      const p5000Error = new Error('BadRequestError') as Error & { code: string };
      p5000Error.code = 'P5000';
      (prisma.$transaction as jest.MockedFunction<typeof prisma.$transaction>).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (fn: any) => {
          // Simulate the transaction partially populating recordCounts before failing
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
          // Then throw P5000 as the transaction itself fails
          throw p5000Error;
        },
      );

      const result = await restoreBackup('test-backup.json');

      // Should succeed via sequential fallback (using prisma directly)
      expect(result.restoredFrom).toBe('test-backup.json');
      expect(result.recordCounts.user).toBe(1);
    });
  });

  describe('cleanup - unlink error handling', () => {
    it('should handle errors when deleting old backup files', async () => {
      (fs.mkdir as jest.MockedFunction<typeof fs.mkdir>).mockResolvedValue(undefined);
      (fs.writeFile as jest.MockedFunction<typeof fs.writeFile>).mockResolvedValue(undefined);
      (fs.stat as jest.MockedFunction<typeof fs.stat>).mockResolvedValue({
        size: 100,
        mtime: new Date(),
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);

      // 32 files → 2 to delete, but unlink fails for them
      const mockFiles = Array.from(
        { length: 32 },
        (_, i) => `backup-2026-01-${String(i + 1).padStart(2, '0')}T00-00-00.json`,
      );
      (fs.readdir as jest.MockedFunction<typeof fs.readdir>).mockResolvedValue(
        mockFiles as unknown as Awaited<ReturnType<typeof fs.readdir>>,
      );
      (fs.unlink as jest.MockedFunction<typeof fs.unlink>).mockRejectedValue(
        new Error('Permission denied'),
      );

      const result = await createBackup();
      // Should have 0 cleaned up because unlink failed
      expect(result.cleanedUp).toBe(0);
    });
  });
  describe('listBackups - metadata fallback', () => {
    it('should use fallback when metadata.createdAt is missing', async () => {
      (fs.mkdir as jest.MockedFunction<typeof fs.mkdir>).mockResolvedValue(undefined);
      (fs.readdir as jest.MockedFunction<typeof fs.readdir>).mockResolvedValue([
        'backup-test.json',
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);
      (fs.stat as jest.MockedFunction<typeof fs.stat>).mockResolvedValue({
        mtime: new Date('2026-02-20'),
        size: 100,
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);

      // Backup without metadata
      const backupContent = JSON.stringify({
        tables: { user: [{ id: 'u1' }], event: [{ id: 'e1' }] },
      });
      (fs.readFile as jest.MockedFunction<typeof fs.readFile>).mockResolvedValue(
        backupContent as unknown as Awaited<ReturnType<typeof fs.readFile>>,
      );

      const backups = await listBackups();
      expect(backups).toHaveLength(1);
      // Should fallback to mtime for createdAt
      expect(backups[0].createdAt).toBe(new Date('2026-02-20').toISOString());
      // Should fallback to counting table keys for tableCount
      expect(backups[0].tableCount).toBe(2);
    });

    it('should handle backup with no tables property', async () => {
      (fs.mkdir as jest.MockedFunction<typeof fs.mkdir>).mockResolvedValue(undefined);
      (fs.readdir as jest.MockedFunction<typeof fs.readdir>).mockResolvedValue([
        'backup-no-tables.json',
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);
      (fs.stat as jest.MockedFunction<typeof fs.stat>).mockResolvedValue({
        mtime: new Date('2026-02-20'),
        size: 50,
      } as unknown as Awaited<ReturnType<typeof fs.stat>>);

      // Backup with metadata but no tables
      const backupContent = JSON.stringify({
        metadata: { version: '1.0' },
      });
      (fs.readFile as jest.MockedFunction<typeof fs.readFile>).mockResolvedValue(
        backupContent as unknown as Awaited<ReturnType<typeof fs.readFile>>,
      );

      const backups = await listBackups();
      expect(backups).toHaveLength(1);
      // No tableCount in metadata and no tables → fallback to 0
      expect(backups[0].tableCount).toBe(0);
    });
  });

  describe('compareBackup - edge cases', () => {
    it('should handle records without id field', async () => {
      const backupData = {
        metadata: { createdAt: '2026-02-22T10:00:00Z', version: '1.0', tableCount: 18 },
        tables: {
          user: [{ name: 'no-id-record' }],
        },
      };

      (fs.readFile as jest.MockedFunction<typeof fs.readFile>).mockResolvedValue(
        JSON.stringify(backupData) as unknown as Awaited<ReturnType<typeof fs.readFile>>,
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((prisma as any).user.findMany as jest.Mock<any>).mockResolvedValue([
        { name: 'another-no-id' },
      ]);

      const result = await compareBackup('test-backup.json');
      const userDiff = result.tables.find((t) => t.table === 'user');
      // Records without IDs can't be matched, so they don't count as added/removed/modified
      expect(userDiff!.added).toBe(0);
      expect(userDiff!.removed).toBe(0);
      expect(userDiff!.modified).toBe(0);
    });

    it('should handle backup with missing metadata gracefully', async () => {
      const backupData = {
        tables: { user: [] },
      };

      (fs.readFile as jest.MockedFunction<typeof fs.readFile>).mockResolvedValue(
        JSON.stringify(backupData) as unknown as Awaited<ReturnType<typeof fs.readFile>>,
      );

      const result = await compareBackup('test-backup.json');
      expect(result.backupDate).toBe('Unknown');
    });
  });

  describe('fetchTableData - model not found', () => {
    it('should return empty array and warn when model is not in prisma client', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const original = (prisma as any).user.findMany;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma as any).user.findMany = undefined;

      // Trigger fetchTableData via compareBackup
      const backupData = {
        metadata: { createdAt: '2026-02-22T10:00:00Z', version: '1.0', tableCount: 18 },
        tables: { user: [{ id: 'u1' }] },
      };
      (fs.readFile as jest.MockedFunction<typeof fs.readFile>).mockResolvedValue(
        JSON.stringify(backupData) as unknown as Awaited<ReturnType<typeof fs.readFile>>,
      );

      const result = await compareBackup('test-backup.json');
      const userDiff = result.tables.find((t) => t.table === 'user');
      // Current records should be empty (model not found -> [])
      expect(userDiff!.currentCount).toBe(0);

      // Restore
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma as any).user.findMany = original;
    });
  });

  describe('getBackupFiles - error handling', () => {
    it('should return empty array when readdir fails', async () => {
      (fs.mkdir as jest.MockedFunction<typeof fs.mkdir>).mockResolvedValue(undefined);
      (fs.readdir as jest.MockedFunction<typeof fs.readdir>).mockRejectedValue(
        new Error('Directory not found'),
      );

      // listBackups calls getBackupFiles internally
      const backups = await listBackups();
      expect(backups).toHaveLength(0);
    });
  });
});
