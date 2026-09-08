import { Client } from 'minio';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { isLocalOnlyMode } from '../utils/local-mode';

const DEFAULT_MINIO_ACCESS_KEY = 'minioadmin';
const DEFAULT_MINIO_SECRET_KEY = 'minioadmin';
const DEFAULT_MAX_GET_FILE_BYTES = 20 * 1024 * 1024;

function getMaxGetFileBytes(): number {
  const configured = Number(process.env.MINIO_MAX_GET_FILE_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_GET_FILE_BYTES;
}

function normalizePublicPrefix(prefix: string): string {
  const trimmed = prefix.trim().replace(/^\/+/, '');
  if (!trimmed || trimmed === '*') return '*';
  if (trimmed.endsWith('*')) return trimmed;
  return trimmed.endsWith('/') ? `${trimmed}*` : `${trimmed}/*`;
}

export interface UploadResult {
  success: boolean;
  fileId?: string;
  fileName?: string;
  objectName?: string;
  fileUrl?: string;
  fileSize?: number;
  message?: string;
}

export interface FileInfo {
  fileId: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  uploadedAt: Date;
  url: string;
}

class MinioService {
  private client: Client;
  private bucketName: string;
  private isConfigured: boolean = false;
  private hasSafeCredentials: boolean = false;
  private clientInitialized: boolean = false;
  // 保存连接检查的 Promise，避免竞态条件：
  // StorageServiceFactory 在模块加载时同步调用 isAvailable()，
  // 但此时 checkConnection() 异步任务可能尚未完成。
  private connectionPromise: Promise<boolean>;

  constructor() {
    this.bucketName = process.env.MINIO_BUCKET || process.env.MINIO_BUCKET_FILES || 'aicg-files';
    // Delay reading credentials until the first real operation. The environment
    // hardening module may load/rotate .env after this module is imported.
    this.client = new Client({
      endPoint: 'localhost',
      port: 9000,
      useSSL: false,
      accessKey: 'minio-disabled',
      secretKey: 'minio-disabled',
    });
    this.connectionPromise = Promise.resolve(false);
  }

  private initializeClient(): boolean {
    if (isLocalOnlyMode()) return false;

    this.bucketName = process.env.MINIO_BUCKET || process.env.MINIO_BUCKET_FILES || 'aicg-files';
    const endpoint = process.env.MINIO_ENDPOINT || 'localhost:9000';
    const endpointUrl = endpoint.includes('://')
      ? new URL(endpoint)
      : new URL(`${process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http'}://${endpoint}`);
    const useSSL = process.env.MINIO_USE_SSL === 'true' || endpointUrl.protocol === 'https:';
    const portFromEnv = process.env.MINIO_PORT
      ? parseInt(process.env.MINIO_PORT, 10)
      : endpointUrl.port
        ? parseInt(endpointUrl.port, 10)
        : useSSL
          ? 443
          : 9000;
    const configuredAccessKey = process.env.MINIO_ACCESS_KEY?.trim();
    const configuredSecretKey = process.env.MINIO_SECRET_KEY?.trim();
    const hasCredentials = !!configuredAccessKey && !!configuredSecretKey;
    const usesDefaultCredentials =
      configuredAccessKey === DEFAULT_MINIO_ACCESS_KEY ||
      configuredSecretKey === DEFAULT_MINIO_SECRET_KEY;
    const allowDefaultCredentials =
      process.env.NODE_ENV !== 'production' && process.env.MINIO_ALLOW_DEFAULT_CREDENTIALS === 'true';
    const disableUnsafeMinio = (!hasCredentials || usesDefaultCredentials) && !allowDefaultCredentials;

    if (disableUnsafeMinio) {
      console.warn('[MinIO] Disabled: configure non-default MINIO_ACCESS_KEY/MINIO_SECRET_KEY, or set MINIO_ALLOW_DEFAULT_CREDENTIALS=true for local development only');
      this.hasSafeCredentials = false;
      return false;
    }

    this.client = new Client({
      endPoint: endpointUrl.hostname,
      port: portFromEnv,
      useSSL,
      accessKey: configuredAccessKey || DEFAULT_MINIO_ACCESS_KEY,
      secretKey: configuredSecretKey || DEFAULT_MINIO_SECRET_KEY,
    });
    this.hasSafeCredentials = true;
    this.clientInitialized = true;
    return true;
  }

  /**
   * 等待启动时的连接检查完成，并返回连接状态。
   * 各业务方法在执行前应先 await 此方法，以避免在连接尚未建立时就失败。
   */
  async ensureReady(): Promise<boolean> {
    if (!this.clientInitialized) {
      if (!this.initializeClient()) return false;
      this.connectionPromise = this.checkConnection();
    }
    try {
      await this.connectionPromise;
    } catch {
      // checkConnection 内部已捕获错误，这里忽略 Promise 拒绝
    }

    // MinIO may still be starting when the backend performs its constructor-time probe.
    // Retry on the first real storage operation instead of pinning the service offline
    // for the lifetime of the process. Concurrent callers share the same retry promise.
    if (!this.isConfigured && this.hasSafeCredentials) {
      this.connectionPromise = this.checkConnection();
      await this.connectionPromise;
    }
    return this.isConfigured;
  }

  async checkConnection(): Promise<boolean> {
    if (!this.clientInitialized && !this.initializeClient()) return false;
    try {
      await this.client.bucketExists(this.bucketName);
      this.isConfigured = true;
      console.log('[MinIO] Connected successfully');
      return true;
    } catch (error) {
      console.warn('[MinIO] Not configured:', error instanceof Error ? error.message : 'Unknown error');
      this.isConfigured = false;
      return false;
    }
  }

  /**
   * 同步可用性检查：
   * 当环境变量已配置 (MINIO_ACCESS_KEY / MINIO_SECRET_KEY) 时即返回 true，
   * 允许 StorageServiceFactory 在启动阶段（连接检查尚未完成时）就选择 MinIO。
   * 真正的连接状态由 ensureReady() 在业务方法中等待。
   */
  isAvailable(): boolean {
    if (isLocalOnlyMode()) return false;
    const accessKey = process.env.MINIO_ACCESS_KEY?.trim();
    const secretKey = process.env.MINIO_SECRET_KEY?.trim();
    return Boolean(
      accessKey &&
      secretKey &&
      accessKey !== DEFAULT_MINIO_ACCESS_KEY &&
      secretKey !== DEFAULT_MINIO_SECRET_KEY
    );
  }

  async initializeBucket(): Promise<boolean> {
    try {
      const exists = await this.client.bucketExists(this.bucketName);
      if (!exists) {
        await this.client.makeBucket(this.bucketName);
        console.log(`[MinIO] Bucket "${this.bucketName}" created`);
      }
      return true;
    } catch (error) {
      console.error('[MinIO] Bucket initialization failed:', error);
      return false;
    }
  }

  async uploadFile(
    userId: string,
    file: Buffer | Blob,
    fileName: string,
    contentType: string,
    folder: string = 'workflows'
  ): Promise<UploadResult> {
    if (!(await this.ensureReady())) {
      return {
        success: false,
        message: 'MinIO服务未配置或连接失败'
      };
    }

    try {
      const buffer = file instanceof Blob ? Buffer.from(await file.arrayBuffer()) : file;
      const fileId = uuidv4();
      const ext = path.extname(fileName);
      const newFileName = `${fileId}${ext}`;
      const objectName = `${folder}/${userId}/${newFileName}`;

      await this.client.putObject(
        this.bucketName,
        objectName,
        buffer,
        buffer.length,
        { 'Content-Type': contentType }
      );

      const fileUrl = await this.client.presignedGetObject(
        this.bucketName,
        objectName,
        3600 * 24 * 7 // 7天有效期
      );

      return {
        success: true,
        fileId,
        fileName: newFileName,
        objectName,
        fileUrl,
        fileSize: buffer.length
      };
    } catch (error: unknown) {
      console.error('[MinIO] Upload failed:', error);
      return {
        success: false,
        message: `上传失败: ${(error instanceof Error ? error.message : String(error))}`
      };
    }
  }

  async uploadBuffer(
    userId: string,
    buffer: Buffer,
    fileName: string,
    contentType: string = 'application/json',
    folder: string = 'workflows'
  ): Promise<UploadResult> {
    return this.uploadFile(userId, buffer, fileName, contentType, folder);
  }

  getBucketInfo(): { bucket: string; endpoint: string; publicUrl: string; publicRead: boolean } {
    return {
      bucket: this.bucketName,
      endpoint: process.env.MINIO_ENDPOINT || 'localhost:9000',
      publicUrl: process.env.MINIO_PUBLIC_URL || '',
      publicRead: process.env.MINIO_ALLOW_PUBLIC_POLICY === 'true',
    };
  }

  async getFileUrl(objectName: string, expiry: number = 3600): Promise<string | null> {
    if (!(await this.ensureReady())) return null;

    try {
      return await this.client.presignedGetObject(
        this.bucketName,
        objectName,
        expiry
      );
    } catch (error) {
      console.error('[MinIO] Get URL failed:', error);
      return null;
    }
  }

  async deleteFile(objectName: string): Promise<boolean> {
    if (!(await this.ensureReady())) return false;

    try {
      await this.client.removeObject(this.bucketName, objectName);
      return true;
    } catch (error) {
      console.error('[MinIO] Delete failed:', error);
      return false;
    }
  }

  async listFiles(userId: string, folder: string = 'workflows'): Promise<FileInfo[]> {
    if (!(await this.ensureReady())) return [];

    try {
      const prefix = `${folder}/${userId}/`;
      const files: FileInfo[] = [];
      const stream = this.client.listObjectsV2(this.bucketName, prefix, true);

      for await (const obj of stream) {
        if (obj.name) {
          files.push({
            fileId: path.basename(obj.name, path.extname(obj.name)),
            fileName: path.basename(obj.name),
            fileSize: obj.size || 0,
            contentType: 'application/octet-stream',
            uploadedAt: obj.lastModified || new Date(),
            url: obj.name
          });
        }
      }

      return files;
    } catch (error) {
      console.error('[MinIO] List files failed:', error);
      return [];
    }
  }

  async getFile(objectName: string): Promise<Buffer | null> {
    if (!(await this.ensureReady())) return null;

    try {
      const maxBytes = getMaxGetFileBytes();
      const stat = await this.client.statObject(this.bucketName, objectName);
      if ((stat.size || 0) > maxBytes) {
        console.warn(`[MinIO] Refusing to buffer large object ${objectName}: ${stat.size} bytes exceeds ${maxBytes}`);
        return null;
      }

      const stream = await this.client.getObject(this.bucketName, objectName);
      const chunks: Buffer[] = [];
      let totalBytes = 0;
      
      return await new Promise((resolve, reject) => {
        let settled = false;
        stream.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes > maxBytes) {
            settled = true;
            stream.destroy(new Error(`MinIO object exceeds ${maxBytes} bytes`));
            reject(new Error(`MinIO object exceeds ${maxBytes} bytes`));
            return;
          }
          chunks.push(chunk);
        });
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', (err) => {
          if (!settled) reject(err);
        });
      });
    } catch (error) {
      console.error('[MinIO] Get file failed:', error);
      return null;
    }
  }

  async getBucketPolicy(): Promise<string | null> {
    if (!(await this.ensureReady())) return null;

    try {
      return await this.client.getBucketPolicy(this.bucketName);
    } catch (error) {
      return null;
    }
  }

  async setPublicPolicy(): Promise<boolean> {
    if (!(await this.ensureReady())) return false;

    try {
      if (process.env.MINIO_ALLOW_PUBLIC_POLICY !== 'true') {
        console.warn('[MinIO] Public bucket policy skipped: set MINIO_ALLOW_PUBLIC_POLICY=true to enable');
        return false;
      }

      const publicPrefix = normalizePublicPrefix(process.env.MINIO_PUBLIC_PREFIX || 'public/');
      if (
        publicPrefix === '*' &&
        process.env.NODE_ENV === 'production' &&
        process.env.MINIO_ALLOW_BUCKET_PUBLIC_POLICY !== 'true'
      ) {
        console.warn('[MinIO] Refusing bucket-wide public policy in production');
        return false;
      }

      const resource = publicPrefix === '*'
        ? `arn:aws:s3:::${this.bucketName}/*`
        : `arn:aws:s3:::${this.bucketName}/${publicPrefix}`;
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [resource]
          }
        ]
      };
      
      await this.client.setBucketPolicy(this.bucketName, JSON.stringify(policy));
      return true;
    } catch (error) {
      console.error('[MinIO] Set policy failed:', error);
      return false;
    }
  }

  async listAllFiles(folder?: string): Promise<FileInfo[]> {
    if (!(await this.ensureReady())) return [];

    try {
      const prefix = folder ? `${folder}/` : '';
      const files: FileInfo[] = [];
      const stream = this.client.listObjectsV2(this.bucketName, prefix, true);

      for await (const obj of stream) {
        if (obj.name) {
          files.push({
            fileId: path.basename(obj.name, path.extname(obj.name)),
            fileName: path.basename(obj.name),
            fileSize: obj.size || 0,
            contentType: 'application/octet-stream',
            uploadedAt: obj.lastModified || new Date(),
            url: obj.name
          });
        }
      }

      return files;
    } catch (error) {
      console.error('[MinIO] List all files failed:', error);
      return [];
    }
  }
}

export const minioService = new MinioService();
export default minioService;
