import path from 'path';
import logger from '../utils/logger';
import { minioService } from './minio-service';

const PRESIGNED_URL_TTL_SECONDS = 3600 * 24 * 7;

function normalizeBaseUrl(value?: string): string {
  return (value || '').trim().replace(/\/+$/, '');
}

function datePartition(): string {
  const date = new Date();
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

class MinioPublicStorageService {
  isEnabled(): boolean {
    return minioService.isAvailable();
  }

  async uploadGeneratedBuffer(
    userId: string,
    type: 'video' | 'image' | 'audio',
    buffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<{ url: string; key: string } | null> {
    if (!this.isEnabled()) {
      logger.warn('[MinIOPublic] MinIO is not configured; cannot publish generated asset');
      return null;
    }

    const safeExt = path.extname(filename);
    const safeName = path.basename(filename, safeExt).replace(/[^a-zA-Z0-9._-]/g, '_') || 'asset';
    const objectFileName = `${safeName}${safeExt}`;
    const folderPrefix = `generated/${type}/${datePartition()}`;

    const uploadResult = await minioService.uploadBuffer(userId, buffer, objectFileName, mimeType, folderPrefix);
    if (!uploadResult.success || !uploadResult.fileName) {
      logger.warn(`[MinIOPublic] Upload failed: ${uploadResult.message || 'unknown error'}`);
      return null;
    }

    const objectKey = uploadResult.objectName || `${folderPrefix}/${userId}/${uploadResult.fileName}`;
    const publicBaseUrl = normalizeBaseUrl(process.env.MINIO_PUBLIC_URL);
    const url = publicBaseUrl
      ? `${publicBaseUrl}/${objectKey}`
      : await minioService.getFileUrl(objectKey, PRESIGNED_URL_TTL_SECONDS) || uploadResult.fileUrl;

    if (!url) {
      logger.warn(`[MinIOPublic] Uploaded but no accessible URL returned: ${objectKey}`);
      return null;
    }

    return { url, key: objectKey };
  }
}

export const minioPublicStorageService = new MinioPublicStorageService();
export default minioPublicStorageService;
