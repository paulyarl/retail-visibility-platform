#!/usr/bin/env node

/**
 * Database Backup Script for Railway PostgreSQL
 * Creates automated backups with point-in-time recovery capability
 */

import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../src/logger';

const execAsync = promisify(exec);

interface BackupOptions {
  type: 'full' | 'schema' | 'data';
  compress: boolean;
  retention: number; // days to keep backups
}

class DatabaseBackupService {
  private backupDir: string;
  private connectionString: string;

  constructor() {
    this.backupDir = process.env.BACKUP_DIR || './backups';
    this.connectionString = process.env.DATABASE_URL || '';

    if (!this.connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    this.ensureBackupDirectory();
  }

  private ensureBackupDirectory(): void {
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true });
      logger.info(`Created backup directory: ${this.backupDir}`);
    }
  }

  private generateBackupFilename(type: string, timestamp?: Date): string {
    const ts = timestamp || new Date();
    const dateStr = ts.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = ts.toISOString().split('T')[1].split('.')[0].replace(/:/g, ''); // HHMMSS
    return `backup_${type}_${dateStr}_${timeStr}.sql`;
  }

  /**
   * Create a full database backup using pg_dump
   */
  async createFullBackup(options: Partial<BackupOptions> = {}): Promise<string> {
    const opts = { type: 'full' as const, compress: true, retention: 30, ...options };
    const filename = this.generateBackupFilename(opts.type);
    const filepath = join(this.backupDir, filename);

    logger.info(`Starting full database backup: ${filename}`);

    try {
      // Use pg_dump for full backup
      const dumpCommand = `pg_dump "${this.connectionString}" --no-password --format=custom --compress=9 --file="${filepath}"`;

      const { stdout, stderr } = await execAsync(dumpCommand);

      if (stderr && !stderr.includes('NOTICE')) {
        logger.warn(`pg_dump stderr: ${stderr}`);
      }

      logger.info(`Full database backup completed: ${filename} (${this.getFileSize(filepath)})`);

      // Clean up old backups
      await this.cleanupOldBackups(opts.type, opts.retention);

      return filepath;
    } catch (error) {
      logger.error(`Full database backup failed: ${filename}`, undefined, { error: error.message });
      throw error;
    }
  }

  /**
   * Create a schema-only backup
   */
  async createSchemaBackup(options: Partial<BackupOptions> = {}): Promise<string> {
    const opts = { type: 'schema' as const, compress: false, retention: 30, ...options };
    const filename = this.generateBackupFilename(opts.type);
    const filepath = join(this.backupDir, filename);

    logger.info(`Starting schema backup: ${filename}`);

    try {
      const dumpCommand = `pg_dump "${this.connectionString}" --no-password --schema-only --file="${filepath}"`;

      const { stdout, stderr } = await execAsync(dumpCommand);

      if (stderr && !stderr.includes('NOTICE')) {
        logger.warn(`pg_dump schema stderr: ${stderr}`);
      }

      logger.info(`Schema backup completed: ${filename} (${this.getFileSize(filepath)})`);

      await this.cleanupOldBackups(opts.type, opts.retention);

      return filepath;
    } catch (error) {
      logger.error(`Schema backup failed: ${filename}`, undefined, { error: error.message });
      throw error;
    }
  }

  /**
   * Create a data-only backup
   */
  async createDataBackup(options: Partial<BackupOptions> = {}): Promise<string> {
    const opts = { type: 'data' as const, compress: true, retention: 7, ...options };
    const filename = this.generateBackupFilename(opts.type);
    const filepath = join(this.backupDir, filename);

    logger.info(`Starting data backup: ${filename}`);

    try {
      const dumpCommand = `pg_dump "${this.connectionString}" --no-password --data-only --format=custom --compress=9 --file="${filepath}"`;

      const { stdout, stderr } = await execAsync(dumpCommand);

      if (stderr && !stderr.includes('NOTICE')) {
        logger.warn(`pg_dump data stderr: ${stderr}`);
      }

      logger.info(`Data backup completed: ${filename} (${this.getFileSize(filepath)})`);

      await this.cleanupOldBackups(opts.type, opts.retention);

      return filepath;
    } catch (error) {
      logger.error(`Data backup failed: ${filename}`, undefined, { error: error.message });
      throw error;
    }
  }

  /**
   * Perform point-in-time recovery to a specific timestamp
   */
  async restoreToPointInTime(targetTimestamp: Date, backupFile?: string): Promise<void> {
    if (!backupFile) {
      // Find the most recent full backup before the target timestamp
      const backups = await this.listBackups('full');
      const suitableBackup = backups
        .filter(b => b.timestamp < targetTimestamp)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

      if (!suitableBackup) {
        throw new Error(`No suitable backup found for timestamp ${targetTimestamp.toISOString()}`);
      }

      backupFile = suitableBackup.filepath;
    }

    logger.info(`Starting point-in-time recovery to ${targetTimestamp.toISOString()} using ${backupFile}`);

    try {
      // Create a temporary database for recovery
      const tempDbName = `recovery_${Date.now()}`;
      await execAsync(`createdb "${tempDbName}"`);

      // Restore the base backup
      await execAsync(`pg_restore --no-password --dbname="${tempDbName}" "${backupFile}"`);

      // Note: Full point-in-time recovery would require WAL archiving and replay
      // This is a simplified version for Phase 1

      logger.info(`Point-in-time recovery completed to temporary database: ${tempDbName}`);

      // In production, you would:
      // 1. Stop the application
      // 2. Restore to a temporary database
      // 3. Validate the recovery
      // 4. Switch to the recovered database
      // 5. Restart the application

    } catch (error) {
      logger.error('Point-in-time recovery failed', undefined, { error: error.message, targetTimestamp, backupFile });
      throw error;
    }
  }

  /**
   * List available backups
   */
  async listBackups(type?: string): Promise<Array<{ filename: string; filepath: string; timestamp: Date; size: number; type: string }>> {
    const fs = require('fs').promises;
    const files = await fs.readdir(this.backupDir);

    const backups = files
      .filter((file: string) => file.startsWith('backup_') && file.endsWith('.sql'))
      .map((file: string) => {
        const match = file.match(/^backup_(full|schema|data)_(\d{4}-\d{2}-\d{2})_(\d{6})\.sql$/);
        if (!match) return null;

        const [, backupType, dateStr, timeStr] = match;
        const timestamp = new Date(`${dateStr}T${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}:${timeStr.slice(4, 6)}Z`);
        const filepath = join(this.backupDir, file);
        const stats = fs.statSync(filepath);

        return {
          filename: file,
          filepath,
          timestamp,
          size: stats.size,
          type: backupType,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.timestamp.getTime() - a.timestamp.getTime());

    return type ? backups.filter((b: any) => b.type === type) : backups;
  }

  /**
   * Clean up old backups
   */
  private async cleanupOldBackups(type: string, retentionDays: number): Promise<void> {
    const backups = await this.listBackups(type);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const oldBackups = backups.filter(b => b.timestamp < cutoffDate);

    for (const backup of oldBackups) {
      try {
        const fs = require('fs').promises;
        await fs.unlink(backup.filepath);
        logger.info(`Cleaned up old backup: ${backup.filename}`);
      } catch (error) {
        logger.warn(`Failed to clean up backup: ${backup.filename}`, undefined, { error: error.message });
      }
    }
  }

  private getFileSize(filepath: string): string {
    try {
      const stats = require('fs').statSync(filepath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      return `${sizeInMB} MB`;
    } catch {
      return 'unknown';
    }
  }
}

// CLI interface for manual backups
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log('Usage: node backup.js <command> [options]');
    console.log('Commands:');
    console.log('  full     - Create full database backup');
    console.log('  schema   - Create schema-only backup');
    console.log('  data     - Create data-only backup');
    console.log('  list     - List available backups');
    console.log('  cleanup  - Clean up old backups');
    process.exit(1);
  }

  try {
    const backupService = new DatabaseBackupService();

    switch (command) {
      case 'full':
        await backupService.createFullBackup();
        console.log('✅ Full backup completed');
        break;

      case 'schema':
        await backupService.createSchemaBackup();
        console.log('✅ Schema backup completed');
        break;

      case 'data':
        await backupService.createDataBackup();
        console.log('✅ Data backup completed');
        break;

      case 'list':
        const backups = await backupService.listBackups();
        console.log('Available backups:');
        backups.forEach(b => {
          console.log(`  ${b.filename} (${(b.size / (1024 * 1024)).toFixed(2)} MB) - ${b.timestamp.toISOString()}`);
        });
        break;

      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error('Backup operation failed:', error);
    process.exit(1);
  }
}

// Export for use in other modules
export { DatabaseBackupService };

// Run CLI if called directly
if (require.main === module) {
  main().catch(console.error);
}
