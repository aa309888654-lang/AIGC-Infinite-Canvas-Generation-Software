import axios from 'axios';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { quotaService } from './quota-service';
import { minioService } from './minio-service';
import logger from '../utils/logger';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const MINIO_PUBLIC_URL = process.env.MINIO_PUBLIC_URL || '';

interface SaveResult {
  localUrl: string | null;
  cosUrl: string | null;       // 兼容：实际为MinIO对象URL
  primaryUrl: string | null;
  cosKey: string | null;       // 兼容：实际为MinIO对象key
  objectUrl: string | null;
  objectKey: string | null;
}

export class AutoSaveService {
  /**
   * 自动保存远程资源到MinIO对象存储
   * 策略：优先保存到MinIO（第二块硬盘），本地作为备份
   * MinIO失败时，回退到本地存储
   */
  async autoSaveUrl(
    userId: string,
    url: string,
    type: 'video' | 'image' | 'audio',
    name?: string,
    options?: { headers?: Record<string, string> },
  ): Promise<SaveResult> {
    const result: SaveResult = {
      localUrl: null,
      cosUrl: null,
      primaryUrl: null,
      cosKey: null,
      objectUrl: null,
      objectKey: null,
    };

    if (!url) return result;

    try {
      // 1. 下载文件
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: options?.headers,
      });
      const buffer = Buffer.from(response.data, 'binary');
      const fileSize = buffer.length;

      // 2. 检查配额
      let quotaCheck = await quotaService.checkStorageQuota(userId, fileSize);
      if (!quotaCheck.allowed) {
        logger.info(`[AutoSave] 存储空间不足，尝试自动清理: userId=${userId}`);
        const cleanupResult = await quotaService.checkAndCleanupStorage(userId);
        if (cleanupResult.cleaned) {
          quotaCheck = await quotaService.checkStorageQuota(userId, fileSize);
        }
        if (!quotaCheck.allowed) {
          logger.warn(`[AutoSave] 存储空间不足: userId=${userId}, size=${fileSize}`);
        }
      }

      // 3. 确定目录和文件名
      const folder = type === 'video' ? 'videos' : type === 'image' ? 'images' : 'audio';
      const ext = path.extname(new URL(url).pathname) || (type === 'video' ? '.mp4' : type === 'image' ? '.png' : '.mp3');
      const filename = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
      const mimeTypeMap: Record<string, string> = {
        '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
        '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
      };
      const mimeType = mimeTypeMap[ext.toLowerCase()] || (type === 'video' ? 'video/mp4' : type === 'image' ? 'image/png' : 'audio/mpeg');

      // 4. 保存到MinIO（主存储）和本地（备份），并行执行
      const [minioResult, localResult] = await Promise.allSettled([
        this.saveToMinio(userId, buffer, folder, filename, mimeType),
        this.saveToLocal(userId, buffer, folder, filename, mimeType),
      ]);

      // 处理MinIO存储结果
      if (minioResult.status === 'fulfilled' && minioResult.value) {
        result.objectUrl = minioResult.value.url;
        result.objectKey = minioResult.value.key;
        result.cosUrl = minioResult.value.url;   // 兼容字段
        result.cosKey = minioResult.value.key;   // 兼容字段
        logger.info(`[AutoSave] MinIO保存成功: ${filename}`);
      } else {
        logger.warn(`[AutoSave] MinIO保存失败: ${filename}, error=${minioResult.status === 'rejected' ? minioResult.reason : 'unknown'}`);
      }

      // 处理本地存储结果
      if (localResult.status === 'fulfilled' && localResult.value) {
        result.localUrl = localResult.value;
        logger.info(`[AutoSave] 本地保存成功: ${filename}`);
      } else {
        logger.warn(`[AutoSave] 本地保存失败: ${filename}, error=${localResult.status === 'rejected' ? localResult.reason : 'unknown'}`);
      }

      // 5. 确定主URL（优先MinIO，MinIO失败用本地）
      result.primaryUrl = result.objectUrl || result.localUrl || null;
      if (result.primaryUrl) {
        await prisma.userFile.create({
          data: {
            userId,
            filename,
            originalName: name || filename,
            fileType: type,
            fileSize,
            size: fileSize,
            mimeType,
            filePath: result.localUrl ? path.join(UPLOAD_DIR, folder, userId, filename) : '',
            storagePath: result.objectKey || result.cosKey || undefined,
            folder,
            url: result.primaryUrl,
            cosUrl: result.objectUrl || undefined,
          },
        });

        logger.info(`[AutoSave] 素材自动保存成功: userId=${userId}, file=${filename}, minio=${!!result.objectUrl}, local=${!!result.localUrl}`);
      }

      return result;
    } catch (error: unknown) {
      logger.error(`[AutoSave] 自动保存失败: ${(error instanceof Error ? error.message : String(error))}`, { userId, url, type });
      return result;
    }
  }

  private async saveToLocal(
    userId: string,
    buffer: Buffer,
    folder: string,
    filename: string,
    _mimeType: string
  ): Promise<string | null> {
    try {
      const dir = path.join(UPLOAD_DIR, folder, userId);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const filePath = path.join(dir, filename);
      fs.writeFileSync(filePath, buffer);

      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3200}`;
      return `${baseUrl}/uploads/${folder}/${userId}/${filename}`;
    } catch (error: unknown) {
      logger.error(`[AutoSave] 本地保存失败: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  private async saveToMinio(
    userId: string,
    buffer: Buffer,
    folder: string,
    filename: string,
    mimeType: string
  ): Promise<{ url: string; key: string } | null> {
    if (!minioService.isAvailable()) {
      logger.warn('[AutoSave] MinIO不可用，跳过对象存储');
      return null;
    }

    try {
      const date = new Date();
      const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
      const typeFolder = folder === 'videos' ? 'video' : folder === 'images' ? 'image' : 'audio';
      const folderPrefix = `generated/${typeFolder}/${dateStr}`;

      const uploadResult = await minioService.uploadFile(userId, buffer, filename, mimeType, folderPrefix);

      if (!uploadResult.success) {
        logger.warn(`[AutoSave] MinIO上传失败: ${uploadResult.message}`);
        return null;
      }

      // 使用 MinIO 返回的实际对象 key，确保 URL 与对象存储中的文件名一致。
      const objectKey = uploadResult.objectName || `${folderPrefix}/${userId}/${uploadResult.fileName}`;

      // 生成可访问的URL
      let publicUrl: string;
      if (MINIO_PUBLIC_URL) {
        // 通过Nginx反向代理访问，Nginx 的 proxy_pass 已包含 bucket 名（/storage/ -> /aicg-files/）
        // 因此这里不再在路径中拼接 bucketName，直接用 objectKey
        publicUrl = `${MINIO_PUBLIC_URL}/${objectKey}`;
      } else {
        // 使用presigned URL（7天有效）
        const presignedUrl = await minioService.getFileUrl(objectKey, 3600 * 24 * 7);
        publicUrl = presignedUrl || uploadResult.fileUrl || '';
      }

      return { url: publicUrl, key: objectKey };
    } catch (error: unknown) {
      logger.error(`[AutoSave] MinIO保存失败: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * 获取可用的资源URL
   */
  async getAvailableUrl(userId: string, filename: string): Promise<string | null> {
    const file = await prisma.userFile.findFirst({
      where: { userId, filename },
    });

    if (!file) return null;

    if (file.cosUrl) {
      return file.cosUrl;
    }

    if (file.url) {
      return file.url;
    }

    return null;
  }
}

export const autoSaveService = new AutoSaveService();
