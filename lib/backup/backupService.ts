/**
 * Database Backup Service
 * Provides functionality to create, list, compare, and restore JSON backups
 * of all Prisma database tables.
 */

import { promises as fs } from 'fs';
import path from 'path';
import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';

// Backup directory relative to project root
const BACKUP_DIR = path.join(process.cwd(), 'tmp', 'backups');

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
 * Ensures the backup directory exists
 */
async function ensureBackupDir(): Promise<void> {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
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
 * Creates a JSON backup of all database tables
 */
export async function createBackup(): Promise<BackupResult> {
  await ensureBackupDir();

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `backup-${timestamp}.json`;
  const filepath = path.join(BACKUP_DIR, filename);

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

  const jsonContent = JSON.stringify(backupData, null, 2);
  await fs.writeFile(filepath, jsonContent, 'utf-8');

  const stats = await fs.stat(filepath);

  // Cleanup old backups
  const cleanedUp = await cleanupOldBackups();

  logger.info(
    `Backup created: ${filename} (${stats.size} bytes, ${cleanedUp} old backups removed)`,
  );

  return {
    filename,
    sizeBytes: stats.size,
    tableCount: TABLE_NAMES.length,
    recordCounts,
    cleanedUp,
  };
}

/**
 * Removes old backups beyond the retention limit
 */
async function cleanupOldBackups(): Promise<number> {
  const files = await getBackupFiles();

  if (files.length <= MAX_BACKUPS) {
    return 0;
  }

  // Sort by modification time, newest first
  const sorted = files.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  const toDelete = sorted.slice(MAX_BACKUPS);

  let deleted = 0;
  for (const file of toDelete) {
    try {
      await fs.unlink(path.join(BACKUP_DIR, file.name));
      deleted++;
    } catch (error) {
      logger.error(`Error deleting old backup "${file.name}":`, error);
    }
  }

  return deleted;
}

/**
 * Gets backup files with their stats
 */
async function getBackupFiles(): Promise<Array<{ name: string; mtime: Date; size: number }>> {
  try {
    await ensureBackupDir();
    const entries = await fs.readdir(BACKUP_DIR);
    const backupFiles = entries.filter((f) => f.startsWith('backup-') && f.endsWith('.json'));

    const filesWithStats = await Promise.all(
      backupFiles.map(async (name) => {
        const stat = await fs.stat(path.join(BACKUP_DIR, name));
        return { name, mtime: stat.mtime, size: stat.size };
      }),
    );

    return filesWithStats;
  } catch {
    return [];
  }
}

/**
 * Lists all available backups with metadata
 */
export async function listBackups(): Promise<BackupInfo[]> {
  const files = await getBackupFiles();

  // Sort newest first
  files.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  const backups: BackupInfo[] = [];

  for (const file of files) {
    try {
      const content = await fs.readFile(path.join(BACKUP_DIR, file.name), 'utf-8');
      const data = JSON.parse(content) as BackupData;
      backups.push({
        filename: file.name,
        createdAt: data.metadata?.createdAt || file.mtime.toISOString(),
        sizeBytes: file.size,
        tableCount: data.metadata?.tableCount || Object.keys(data.tables || {}).length,
      });
    } catch {
      // If we can't parse the file, still include it with basic info
      backups.push({
        filename: file.name,
        createdAt: file.mtime.toISOString(),
        sizeBytes: file.size,
        tableCount: 0,
      });
    }
  }

  return backups;
}

/**
 * Loads and parses a backup file
 */
export async function loadBackup(filename: string): Promise<BackupData> {
  // Sanitize filename to prevent path traversal
  const sanitized = path.basename(filename);
  const filepath = path.join(BACKUP_DIR, sanitized);

  try {
    const content = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(content) as BackupData;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Backup file "${sanitized}" not found`);
    }
    throw new Error(`Failed to read backup file "${sanitized}": ${(error as Error).message}`);
  }
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
 * Restores the database from a backup file.
 * Creates a safety backup before restoring.
 * Tries an interactive Prisma transaction for atomicity (direct PostgreSQL).
 * Falls back to sequential operations if transactions are unsupported (Prisma Accelerate/data proxy).
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
export { BACKUP_DIR, MAX_BACKUPS, TABLE_NAMES, ensureBackupDir, countTableData };
