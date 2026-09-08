import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs'; // PERF-05 修复：导入异步 fs API
import * as path from 'path';
import { execFile } from 'child_process';
import { pipeline } from 'stream';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const pipelineAsync = promisify(pipeline);

export interface BackupConfig {
  backupDir: string;
  retentionDays: number;
  compress: boolean;
  uploadToS3: boolean;
}

export interface BackupResult {
  success: boolean;
  filePath?: string;
  fileSize?: number;
  message: string;
  timestamp: Date;
}

class BackupService {
  private config: BackupConfig = {
    backupDir: process.env.BACKUP_DIR || './backups',
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10),
    compress: true,
    uploadToS3: false
  };

  constructor() {
    if (process.env.NODE_ENV !== 'test') {
      // 风险修复：异步创建目录，不阻塞构造函数
      this.ensureBackupDir().catch(err => logger.error('[Backup] ensureBackupDir failed:', err));
      this.startScheduledBackup();
    }
  }

  // 风险修复：将 ensureBackupDir 改为异步，避免同步 fs 调用阻塞事件循环
  private async ensureBackupDir() {
    try {
      await fsPromises.access(this.config.backupDir);
    } catch {
      await fsPromises.mkdir(this.config.backupDir, { recursive: true });
    }
  }

  private startScheduledBackup() {
    const cronExpression = process.env.BACKUP_CRON || '0 2 * * *';
    logger.info(`[Backup] Scheduled backup: ${cronExpression}`);

    setInterval(() => {
      this.performScheduledBackup();
    }, 60 * 60 * 1000);
  }

  private async performScheduledBackup() {
    const hour = new Date().getHours();
    if (hour === 2) {
      await this.createBackup();
    }
  }

  async createBackup(options: {
    type?: 'full' | 'incremental';
    compress?: boolean;
  } = {}): Promise<BackupResult> {
    // P1 修复：每次备份前确保目录存在（幂等操作），防止目录被删除后备份失败
    await this.ensureBackupDir().catch(err => {
      logger.error('[Backup] createBackup: ensureBackupDir failed:', err);
    });

    const timestamp = new Date();
    const filename = `backup_${timestamp.toISOString().replace(/[:.]/g, '-')}.sql`;
    const filepath = path.join(this.config.backupDir, filename);

    try {
      const databaseUrl = process.env.DATABASE_URL || '';

      if (databaseUrl.includes('postgresql') || databaseUrl.includes('postgres://')) {
        await this.backupPostgres(databaseUrl, filepath);

        if (this.config.compress) {
          const gzPath = await this.compressFile(filepath);
          await fsPromises.unlink(filepath); // 风险修复：使用异步 unlink 替代 fs.unlinkSync
          const stats = await fsPromises.stat(gzPath);
          await this.cleanOldBackups();

          return {
            success: true,
            filePath: gzPath,
            fileSize: stats.size,
            message: 'PostgreSQL备份成功',
            timestamp
          };
        }

        const stats = await fsPromises.stat(filepath); // PERF-05 修复：使用异步 stat
        await this.cleanOldBackups();

        return {
          success: true,
          filePath: filepath,
          fileSize: stats.size,
          message: 'PostgreSQL备份成功',
          timestamp
        };
      }

      if (databaseUrl.includes('mysql') || databaseUrl.includes('mariadb')) {
        const dbName = databaseUrl.match(/\/([^/]+)\?/)?.[1] || 'database';
        await this.backupMysql(databaseUrl, dbName, filepath);

        if (this.config.compress) {
          const gzPath = await this.compressFile(filepath);
          await fsPromises.unlink(filepath); // PERF-05 修复：使用异步 unlink
          const stats = await fsPromises.stat(gzPath); // PERF-05 修复：使用异步 stat
          await this.cleanOldBackups();

          return {
            success: true,
            filePath: gzPath,
            fileSize: stats.size,
            message: 'MySQL备份成功',
            timestamp
          };
        }

        const stats = await fsPromises.stat(filepath); // PERF-05 修复：使用异步 stat
        await this.cleanOldBackups();

        return {
          success: true,
          filePath: filepath,
          fileSize: stats.size,
          message: 'MySQL备份成功',
          timestamp
        };
      }

      return {
        success: false,
        message: '不支持的数据库类型',
        timestamp
      };
    } catch (error: unknown) {
      console.error('[Backup] Error:', error);
      return {
        success: false,
        message: `备份失败: ${(error instanceof Error ? error.message : String(error))}`,
        timestamp
      };
    }
  }

  private async backupMysql(connectionString: string, dbName: string, filepath: string): Promise<void> {
    const host = connectionString.match(/@([^:]+)/)?.[1] || 'localhost';
    const port = connectionString.match(/:(\d+)/)?.[1] || '3306';
    const user = connectionString.match(/:([^:@]+)@/)?.[1] || 'root';
    const password = connectionString.match(/@[^:]+:[^@]+@(?:[^:]+:)?([^/]+)/)?.[1] || '';

    const mysqlEnv = { ...process.env, MYSQL_PWD: password };
    await execFileAsync(
      'mysqldump',
      ['-h', host, '-P', port, '-u', user, `--result-file=${filepath}`, '--', dbName],
      { env: mysqlEnv, windowsHide: true }
    );
  }

  private async backupPostgres(connectionString: string, filepath: string): Promise<void> {
    const host = connectionString.match(/@([^:]+)/)?.[1] || 'localhost';
    const port = connectionString.match(/:(\d+)\//)?.[1] || '5432';
    const user = connectionString.match(/:([^:@]+)@/)?.[1] || 'postgres';
    const password = connectionString.match(/\/\/[^:]+:([^@]+)@/)?.[1] || '';
    const dbName = connectionString.match(/\/([^/?]+)/)?.[1] || 'ai_clipping_studio';

    const pgEnv = { ...process.env, PGPASSWORD: password };
    await execFileAsync(
      'pg_dump',
      ['-h', host, '-p', port, '-U', user, '-d', dbName, '-f', filepath],
      { env: pgEnv, windowsHide: true }
    );
  }

  private async compressFile(filepath: string): Promise<string> {
    const { createGzip } = await import('zlib');

    const gzPath = filepath + '.gz';
    const gzip = createGzip();

    await pipelineAsync(
      fs.createReadStream(filepath),
      gzip,
      fs.createWriteStream(gzPath)
    );

    return gzPath;
  }

  async restoreBackup(backupPath: string): Promise<BackupResult> {
    try {
      // 风险修复：使用异步 access 替代同步 existsSync
      try {
        await fsPromises.access(backupPath);
      } catch {
        return {
          success: false,
          message: '备份文件不存在',
          timestamp: new Date()
        };
      }

      const databaseUrl = process.env.DATABASE_URL || '';

      if (databaseUrl.includes('postgresql') || databaseUrl.includes('postgres://')) {
        const host = databaseUrl.match(/@([^:]+)/)?.[1] || 'localhost';
        const port = databaseUrl.match(/:(\d+)\//)?.[1] || '5432';
        const user = databaseUrl.match(/:([^:@]+)@/)?.[1] || 'postgres';
        const password = databaseUrl.match(/\/\/[^:]+:([^@]+)@/)?.[1] || '';
        const dbName = databaseUrl.match(/\/([^/?]+)/)?.[1] || 'ai_clipping_studio';

        let sqlPath = backupPath;
        if (backupPath.endsWith('.gz')) {
          const { createGunzip } = await import('zlib');
          sqlPath = backupPath.replace('.gz', '');
          await pipelineAsync(
            fs.createReadStream(backupPath),
            createGunzip(),
            fs.createWriteStream(sqlPath)
          );
        }

        const pgEnv = { ...process.env, PGPASSWORD: password };
        await execFileAsync(
          'psql',
          ['-h', host, '-p', port, '-U', user, '-d', dbName, '-f', sqlPath],
          { env: pgEnv, windowsHide: true }
        );

        if (sqlPath !== backupPath) {
          await fsPromises.unlink(sqlPath); // PERF-05 修复：使用异步 unlink
        }

        return {
          success: true,
          message: 'PostgreSQL恢复成功',
          timestamp: new Date()
        };
      }

      if (databaseUrl.includes('mysql') || databaseUrl.includes('mariadb')) {
        return {
          success: false,
          message: 'MySQL数据库恢复请使用mysql命令行工具',
          timestamp: new Date()
        };
      }

      return {
        success: false,
        message: '不支持的数据库类型',
        timestamp: new Date()
      };
    } catch (error: unknown) {
      return {
        success: false,
        message: `恢复失败: ${(error instanceof Error ? error.message : String(error))}`,
        timestamp: new Date()
      };
    }
  }

  async listBackups(): Promise<Array<{
    filename: string;
    path: string;
    size: number;
    createdAt: Date;
  }>> {
    const files = await fsPromises.readdir(this.config.backupDir); // PERF-05 修复：使用异步 readdir
    const backups = await Promise.all(
      files
        .filter(f => f.startsWith('backup_') && (f.endsWith('.sql') || f.endsWith('.gz')))
        .map(async filename => {
          const filepath = path.join(this.config.backupDir, filename);
          const stats = await fsPromises.stat(filepath); // PERF-05 修复：使用异步 stat
          return {
            filename,
            path: filepath,
            size: stats.size,
            createdAt: stats.birthtime
          };
        })
    );
    backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return backups;
  }

  private async cleanOldBackups(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    const files = await fsPromises.readdir(this.config.backupDir); // PERF-05 修复：使用异步 readdir
    let deletedCount = 0;

    for (const file of files) {
      const filepath = path.join(this.config.backupDir, file);
      const stats = await fsPromises.stat(filepath); // PERF-05 修复：使用异步 stat

      if (stats.birthtime < cutoffDate) {
        await fsPromises.unlink(filepath); // PERF-05 修复：使用异步 unlink
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      logger.info(`[Backup] Cleaned ${deletedCount} old backup files`);
    }
  }

  async deleteBackup(filename: string): Promise<boolean> {
    try {
      const filepath = path.join(this.config.backupDir, filename);
      // PERF-05 修复：使用异步 API
      try {
        await fsPromises.access(filepath);
        await fsPromises.unlink(filepath);
        return true;
      } catch {
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  async getBackupStats(): Promise<{
    totalBackups: number;
    totalSize: number;
    oldestBackup: Date | null;
    newestBackup: Date | null;
  }> {
    const backups = await this.listBackups();

    if (backups.length === 0) {
      return { totalBackups: 0, totalSize: 0, oldestBackup: null, newestBackup: null };
    }

    return {
      totalBackups: backups.length,
      totalSize: backups.reduce((sum, b) => sum + b.size, 0),
      oldestBackup: backups[backups.length - 1].createdAt,
      newestBackup: backups[0].createdAt
    };
  }

  async uploadToRemote(backupPath: string, remotePath: string): Promise<boolean> {
    try {
      logger.info(`[Backup] Uploading to remote: ${remotePath}`);
      return true;
    } catch (error) {
      console.error('[Backup] Upload failed:', error);
      return false;
    }
  }
}

export const backupService = new BackupService();
export default backupService;
