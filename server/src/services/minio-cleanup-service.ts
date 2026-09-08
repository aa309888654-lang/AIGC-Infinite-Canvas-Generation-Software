import { minioService } from './minio-service';
import { logger } from '../utils/logger';

const DEFAULT_TTL_DAYS = 7;
const TEMPORARY_PREFIX = 'temporary';
const CLEANUP_HOUR = 3; // 凌晨 3 点执行
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 每小时检查一次

class MinioCleanupService {
  private ttlDays: number;
  private lastRunDate: string | null = null;

  constructor() {
    if (process.env.NODE_ENV === 'test') return;
    this.ttlDays = parseInt(process.env.MINIO_TTL_DAYS || String(DEFAULT_TTL_DAYS), 10);
    if (Number.isNaN(this.ttlDays) || this.ttlDays < 1) {
      this.ttlDays = DEFAULT_TTL_DAYS;
    }
    this.start();
  }

  private start() {
    if (!minioService.isAvailable()) {
      logger.info('[MinIOCleanup] MinIO 未启用，跳过清理服务');
      return;
    }
    logger.info(`[MinIOCleanup] 定时清理服务已启动，前缀=${TEMPORARY_PREFIX}/，TTL=${this.ttlDays} 天，执行时间: 每日 ${CLEANUP_HOUR}:00`);
    setInterval(() => {
      this.tick().catch(err => logger.error('[MinIOCleanup] tick failed:', err));
    }, CHECK_INTERVAL_MS);
  }

  private async tick() {
    const now = new Date();
    if (now.getHours() !== CLEANUP_HOUR) return;
    // 同一天内只执行一次（防止 setInterval 在目标小时内多次触发）
    const today = now.toISOString().slice(0, 10);
    if (this.lastRunDate === today) return;
    this.lastRunDate = today;
    await this.runCleanup();
  }

  /**
   * 仅扫描 temporary/ 前缀下超过 TTL 的对象并删除。
   * generated/、user-storage/ 和 model-data/ 是持久数据，禁止 TTL 清理。
   * 可手动调用（如通过管理接口触发）。
   */
  async runCleanup(): Promise<{ scanned: number; deleted: number; failed: number; freedBytes: number }> {
    if (!minioService.isAvailable()) {
      logger.warn('[MinIOCleanup] MinIO 不可用，跳过清理');
      return { scanned: 0, deleted: 0, failed: 0, freedBytes: 0 };
    }

    const ready = await minioService.ensureReady();
    if (!ready) {
      logger.warn('[MinIOCleanup] MinIO 连接未就绪，跳过清理');
      return { scanned: 0, deleted: 0, failed: 0, freedBytes: 0 };
    }

    const cutoff = Date.now() - this.ttlDays * 24 * 60 * 60 * 1000;
    logger.info(`[MinIOCleanup] 开始清理 ${TEMPORARY_PREFIX}/ 下早于 ${new Date(cutoff).toISOString()} 的对象 (TTL=${this.ttlDays}天)`);

    const files = await minioService.listAllFiles(TEMPORARY_PREFIX);
    let deleted = 0;
    let failed = 0;
    let freedBytes = 0;

    for (const file of files) {
      const lastModified = file.uploadedAt ? new Date(file.uploadedAt).getTime() : 0;
      if (lastModified && lastModified < cutoff) {
        const objectName = file.url; // listAllFiles 中 url 字段存放的是 objectName
        const size = file.fileSize || 0;
        const ok = await minioService.deleteFile(objectName);
        if (ok) {
          deleted++;
          freedBytes += size;
        } else {
          failed++;
        }
      }
    }

    logger.info(
      `[MinIOCleanup] 清理完成: 扫描=${files.length}, 删除=${deleted}, 失败=${failed}, 释放空间=${(freedBytes / 1024 / 1024).toFixed(2)}MB`
    );
    return { scanned: files.length, deleted, failed, freedBytes };
  }
}

export const minioCleanupService = new MinioCleanupService();
export default minioCleanupService;
