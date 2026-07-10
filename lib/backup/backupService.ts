/**
 * Database Backup Service
 * Provides functionality to create, list, compare, and restore JSON backups
 * of all Prisma database tables.
 *
 * Backups are stored as rows in the `Backup` table (not on local disk) so they
 * are shared across all server instances and survive redeploys/restarts. Local
 * filesystem storage is unsafe here: this app runs load-balanced (Redis is
 * mandatory in production) and container filesystems are ephemeral.
 */

import { randomBytes } from 'crypto';
import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';

// Maximum number of backups to retain
const MAX_BACKUPS = 30;

// Tables in dependency order (for restore: delete in reverse, insert in order)
const TABLE_NAMES = [
  'appConfig',
  'address',
  'user',
  'institution',
  'userInstitution',
  'group',
  'groupDisability',
  'event',
  'eventAccessibility',
  'scoringConfiguration',
  'scoringCriterion',
  'registration',
  'registrationDisability',
  'notification',
  'passwordResetToken',
  'refreshTokenBlacklist',
  'passwordHistory',
  'securityLog',
] as const;

type TableName = (typeof TABLE_NAMES)[number];

/** Metadata for a single backup file */
export interface BackupInfo {
  filename: string;
  createdAt: string;
  sizeBytes: number;
  tableCount: number;
}

/** Result of a backup comparison for a single table */
export interface TableDiff {
  table: string;
  backupCount: number;
  currentCount: number;
  added: number;
  removed: number;
  modified: number;
}

/** Result of a full backup comparison */
export interface BackupComparison {
  filename: string;
  backupDate: string;
  tables: TableDiff[];
  summary: {
    totalAdded: number;
    totalRemoved: number;
    totalModified: number;
  };
}

/** Result of a backup creation */
export interface BackupResult {
  filename: string;
  sizeBytes: number;
  tableCount: number;
  recordCounts: Record<string, number>;
  cleanedUp: number;
}

/** Full backup data structure */
interface BackupData {
  metadata: {
    createdAt: string;
    version: string;
    tableCount: number;
  };
  tables: Record<string, unknown[]>;
}

/**
 * Fetches all records from a Prisma table
 */
async function fetchTableData(tableName: TableName): Promise<unknown[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = (prisma as any)[tableName];
  if (!model || typeof model.findMany !== 'function') {
    logger.warn(`Table "${tableName}" not found in Prisma client, skipping`);
    return [];
  }
  return model.findMany();
}

/**
 * Counts records in a Prisma table
 */
async function countTableData(tableName: TableName): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = (prisma as any)[tableName];
  if (!model || typeof model.count !== 'function') {
    return 0;
  }
  return model.count();
}

/**
 * Generates a unique backup filename. Includes millisecond precision plus a
 * random suffix so concurrent backups (e.g. cron + admin, or the safety backup
 * created during a restore) never collide on the `filename` unique constraint.
 */
function generateFilename(now: Date): string {
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const suffix = randomBytes(3).toString('hex');
  return `backup-${timestamp}-${suffix}.json`;
}

/**
 * Creates a JSON backup of all database tables, stored as a row in the Backup table.
 */
export async function createBackup(): Promise<BackupResult> {
  const now = new Date();
  const filename = generateFilename(now);

  const tables: Record<string, unknown[]> = {};
  const recordCounts: Record<string, number> = {};

  // Export each table
  for (const tableName of TABLE_NAMES) {
    try {
      const data = await fetchTableData(tableName);
      tables[tableName] = data;
      recordCounts[tableName] = data.length;
    } catch (error) {
      logger.error(`Error exporting table "${tableName}":`, error);
      tables[tableName] = [];
      recordCounts[tableName] = 0;
    }
  }

  const backupData: BackupData = {
    metadata: {
      createdAt: now.toISOString(),
      version: '1.0',
      tableCount: TABLE_NAMES.length,
    },
    tables,
  };

  const sizeBytes = Buffer.byteLength(JSON.stringify(backupData), 'utf-8');

  await prisma.backup.create({
    data: {
      filename,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content: backupData as any,
      size_bytes: sizeBytes,
      table_count: TABLE_NAMES.length,
      created_at: now,
    },
  });

  // Cleanup old backups
  const cleanedUp = await cleanupOldBackups();

  logger.info(`Backup created: ${filename} (${sizeBytes} bytes, ${cleanedUp} old backups removed)`);

  return {
    filename,
    sizeBytes,
    tableCount: TABLE_NAMES.length,
    recordCounts,
    cleanedUp,
  };
}

/**
 * Removes old backups beyond the retention limit (oldest first).
 */
async function cleanupOldBackups(): Promise<number> {
  const old = await prisma.backup.findMany({
    orderBy: { created_at: 'desc' },
    skip: MAX_BACKUPS,
    select: { id: true },
  });

  if (old.length === 0) {
    return 0;
  }

  try {
    const result = await prisma.backup.deleteMany({
      where: { id: { in: old.map((b) => b.id) } },
    });
    return result.count;
  } catch (error) {
    logger.error('Error deleting old backups:', error);
    return 0;
  }
}

/**
 * Lists all available backups with metadata, newest first.
 */
export async function listBackups(): Promise<BackupInfo[]> {
  const rows = await prisma.backup.findMany({
    orderBy: { created_at: 'desc' },
    select: { filename: true, created_at: true, size_bytes: true, table_count: true },
  });

  return rows.map((row) => ({
    filename: row.filename,
    createdAt: row.created_at.toISOString(),
    sizeBytes: row.size_bytes,
    tableCount: row.table_count,
  }));
}

/**
 * Loads and parses a backup by filename.
 */
export async function loadBackup(filename: string): Promise<BackupData> {
  const row = await prisma.backup.findUnique({
    where: { filename },
    select: { content: true },
  });

  if (!row) {
    throw new Error(`Backup file "${filename}" not found`);
  }

  return row.content as unknown as BackupData;
}

/**
 * Compares a backup with the current database state
 */
export async function compareBackup(filename: string): Promise<BackupComparison> {
  const backup = await loadBackup(filename);
  const tables: TableDiff[] = [];

  let totalAdded = 0;
  let totalRemoved = 0;
  let totalModified = 0;

  for (const tableName of TABLE_NAMES) {
    const backupRecords = (backup.tables[tableName] || []) as Array<Record<string, unknown>>;
    const currentRecords = (await fetchTableData(tableName)) as Array<Record<string, unknown>>;

    const backupCount = backupRecords.length;
    const currentCount = currentRecords.length;

    // Build maps by ID for comparison
    const backupMap = new Map<string, Record<string, unknown>>();
    for (const record of backupRecords) {
      if (record.id) {
        backupMap.set(record.id as string, record);
      }
    }

    const currentMap = new Map<string, Record<string, unknown>>();
    for (const record of currentRecords) {
      if (record.id) {
        currentMap.set(record.id as string, record);
      }
    }

    // Records in current but not in backup = added since backup
    let added = 0;
    for (const id of currentMap.keys()) {
      if (!backupMap.has(id)) {
        added++;
      }
    }

    // Records in backup but not in current = removed since backup
    let removed = 0;
    for (const id of backupMap.keys()) {
      if (!currentMap.has(id)) {
        removed++;
      }
    }

    // Records in both but with different updated_at = modified
    let modified = 0;
    for (const [id, backupRecord] of backupMap.entries()) {
      const currentRecord = currentMap.get(id);
      if (currentRecord) {
        // Compare updated_at if it exists, otherwise compare JSON
        const backupUpdated = backupRecord.updated_at || backupRecord.updatedAt;
        const currentUpdated = currentRecord.updated_at || currentRecord.updatedAt;

        if (backupUpdated && currentUpdated) {
          if (
            new Date(backupUpdated as string).getTime() !==
            new Date(currentUpdated as string).getTime()
          ) {
            modified++;
          }
        } else {
          // Fallback to JSON comparison (excluding timestamps)
          const bCopy = { ...backupRecord };
          const cCopy = { ...currentRecord };
          delete bCopy.created_at;
          delete bCopy.createdAt;
          delete bCopy.updated_at;
          delete bCopy.updatedAt;
          delete cCopy.created_at;
          delete cCopy.createdAt;
          delete cCopy.updated_at;
          delete cCopy.updatedAt;
          if (JSON.stringify(bCopy) !== JSON.stringify(cCopy)) {
            modified++;
          }
        }
      }
    }

    totalAdded += added;
    totalRemoved += removed;
    totalModified += modified;

    tables.push({
      table: tableName,
      backupCount,
      currentCount,
      added,
      removed,
      modified,
    });
  }

  return {
    filename,
    backupDate: backup.metadata?.createdAt || 'Unknown',
    tables,
    summary: {
      totalAdded,
      totalRemoved,
      totalModified,
    },
  };
}

/**
 * Core restore logic: deletes all data then inserts backup data.
 * Used by both transactional and sequential restore paths.
 * @param client - Either a Prisma transaction client or the main Prisma client
 * @param backup - The parsed backup data
 * @param recordCounts - Object to populate with record counts per table
 */
async function performRestore(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  backup: BackupData,
  recordCounts: Record<string, number>,
): Promise<void> {
  // Delete all data in reverse dependency order
  const reversedTables = [...TABLE_NAMES].reverse();
  for (const tableName of reversedTables) {
    try {
      const model = client[tableName];
      if (model && typeof model.deleteMany === 'function') {
        await model.deleteMany({});
      }
    } catch (error) {
      logger.error(`Error clearing table "${tableName}":`, error);
      throw error;
    }
  }

  // Insert backup data in dependency order
  for (const tableName of TABLE_NAMES) {
    const records = backup.tables[tableName] || [];
    recordCounts[tableName] = records.length;

    if (records.length === 0) continue;

    try {
      const model = client[tableName];
      if (model && typeof model.createMany === 'function') {
        // Use createMany for efficiency, process in chunks to avoid memory issues
        const chunkSize = 500;
        for (let i = 0; i < records.length; i += chunkSize) {
          const chunk = records.slice(i, i + chunkSize);
          await model.createMany({
            data: chunk,
            skipDuplicates: true,
          });
        }
      }
    } catch (error) {
      logger.error(`Error restoring table "${tableName}":`, error);
      throw error;
    }
  }
}

/**
 * Restores the database from a backup.
 * Creates a safety backup before restoring.
 * Tries an interactive Prisma transaction for atomicity (direct PostgreSQL).
 * Falls back to sequential operations if transactions are unsupported (Prisma Accelerate/data proxy).
 *
 * Note: the Backup table is not part of TABLE_NAMES, so existing backups
 * (including the safety backup) are preserved across a restore.
 */
export async function restoreBackup(filename: string): Promise<{
  restoredFrom: string;
  safetyBackup: string;
  recordCounts: Record<string, number>;
}> {
  // Load the backup first to validate it
  const backup = await loadBackup(filename);

  // Create a safety backup before restoring
  logger.info(`Creating safety backup before restore from "${filename}"...`);
  const safetyResult = await createBackup();

  logger.info(`Starting restore from "${filename}"...`);

  const recordCounts: Record<string, number> = {};

  try {
    // Try interactive transaction first (works with direct PostgreSQL)
    await prisma.$transaction(
      async (tx) => {
        await performRestore(tx, backup, recordCounts);
      },
      {
        maxWait: 60000, // 60 seconds max wait
        timeout: 120000, // 120 seconds timeout
      },
    );
  } catch (error) {
    // If P5000 (Prisma Accelerate/data proxy doesn't support interactive transactions),
    // fall back to sequential operations without transaction wrapper
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P5000') {
      logger.warn(
        'Interactive transaction not supported (Prisma Accelerate/proxy). Falling back to sequential restore...',
      );
      // Reset recordCounts since the failed transaction may have partially populated it
      for (const key of Object.keys(recordCounts)) {
        delete recordCounts[key];
      }
      await performRestore(prisma, backup, recordCounts);
    } else {
      throw error;
    }
  }

  logger.info(`Restore completed from "${filename}"`);

  return {
    restoredFrom: filename,
    safetyBackup: safetyResult.filename,
    recordCounts,
  };
}

// Export for testing
export { MAX_BACKUPS, TABLE_NAMES, countTableData };
