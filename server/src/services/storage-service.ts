import { minioService } from './minio-service';
import fs from 'fs';
import { promises as fsPromises } from 'fs'; // PERF-01 修复：导入异步 fs API
import path from 'path';
import crypto from 'crypto';
import { isLocalOnlyMode } from '../utils/local-mode';

export interface ImageProcessOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpg' | 'png' | 'avif';
  thumbnail?: boolean;
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

type StorageService = {
  isAvailable(): boolean;
  uploadFile(
    userId: string,
    file: Buffer | Blob,
    fileName: string,
    contentType: string,
    folder?: string
  ): Promise<UploadResult>;
  uploadBuffer(
    userId: string,
    buffer: Buffer,
    fileName: string,
    contentType?: string,
    folder?: string
  ): Promise<UploadResult>;
  getFileUrl(objectName: string, expiry?: number): Promise<string | null>;
  deleteFile(objectName: string): Promise<boolean>;
  listFiles(userId: string, folder?: string): Promise<FileInfo[]>;
  getFile(objectName: string): Promise<Buffer | null>;
  initializeBucket(): Promise<boolean>;
  setPublicPolicy(): Promise<boolean>;
};

class StorageServiceFactory {
  private storageService: StorageService;
  private storageType: 'minio' | 'local' | 'none' = 'none';

  constructor() {
    const storageType = process.env.STORAGE_TYPE || (isLocalOnlyMode() ? 'local' : 'minio');

    if (storageType === 'local' && process.env.NODE_ENV !== 'production') {
      this.storageService = createLocalStorageService();
      this.storageType = 'local';
      console.log('[Storage] Using local filesystem');
    } else if (minioService.isAvailable()) {
      this.storageService = minioService;
      this.storageType = 'minio';
      console.log('[Storage] Using MinIO');
    } else {
      this.storageService = {
        isAvailable: () => false,
        uploadFile: async () => ({ success: false, message: 'MinIO 存储服务未配置' }),
        uploadBuffer: async () => ({ success: false, message: 'MinIO 存储服务未配置' }),
        getFileUrl: async () => null,
        deleteFile: async () => false,
        listFiles: async () => [],
        getFile: async () => null,
        initializeBucket: async () => false,
        setPublicPolicy: async () => false,
      };
      this.storageType = 'none';
      console.warn('[Storage] MinIO is required; no storage service configured');
    }
  }

  getStorageType(): 'minio' | 'local' | 'none' {
    return this.storageType;
  }

  isAvailable(): boolean {
    return this.storageService.isAvailable();
  }

  isCos(): boolean {
    return false;
  }

  async uploadFile(
    userId: string,
    file: Buffer | Blob,
    fileName: string,
    contentType: string,
    folder: string = 'workflows'
  ): Promise<UploadResult> {
    return this.storageService.uploadFile(userId, file, fileName, contentType, folder);
  }

  async uploadBuffer(
    userId: string,
    buffer: Buffer,
    fileName: string,
    contentType: string = 'application/octet-stream',
    folder: string = 'workflows'
  ): Promise<UploadResult> {
    return this.storageService.uploadBuffer(userId, buffer, fileName, contentType, folder);
  }

  async getFileUrl(objectName: string, expiry: number = 3600): Promise<string | null> {
    return this.storageService.getFileUrl(objectName, expiry);
  }

  async deleteFile(objectName: string): Promise<boolean> {
    return this.storageService.deleteFile(objectName);
  }

  async listFiles(userId: string, folder: string = 'workflows'): Promise<FileInfo[]> {
    return this.storageService.listFiles(userId, folder);
  }

  async getFile(objectName: string): Promise<Buffer | null> {
    return this.storageService.getFile(objectName);
  }

  async initializeBucket(): Promise<boolean> {
    return this.storageService.initializeBucket();
  }

  async setPublicPolicy(): Promise<boolean> {
    return this.storageService.setPublicPolicy();
  }

  buildImageUrl(objectName: string, options?: ImageProcessOptions): string | null {
    void objectName;
    void options;
    return null;
  }

  async getThumbnailUrl(objectName: string, size: number = 200): Promise<string | null> {
    void size;
    return this.getFileUrl(objectName);
  }

  getBucketInfo(): { bucket: string; endpoint: string; publicUrl: string; publicRead: boolean } | null {
    if (this.storageType !== 'minio') return null;
    return minioService.getBucketInfo();
  }
}

export const storageService = new StorageServiceFactory();
export default storageService;

/**
 * 本地文件系统存储服务
 * 使用数据盘 /home/aicg-data/storage 作为存储后端
 * 通过 Nginx 提供文件访问: /storage/cache/ 和 /storage/users/
 */
function createLocalStorageService(): StorageService {
  const basePath = process.env.LOCAL_STORAGE_DIR
    ? path.resolve(process.env.LOCAL_STORAGE_DIR)
    : path.join(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'), 'storage');
  const domain = process.env.BASE_URL || '';

  const ensureDir = (dir: string) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  };

  return {
    isAvailable: () => {
      try {
        ensureDir(basePath);
        return true;
      } catch {
        return false;
      }
    },

    uploadFile: async (userId, file, fileName, contentType, folder = 'workflows') => {
      try {
        const dir = path.join(basePath, 'users', userId, folder);
        ensureDir(dir);
        const fileId = crypto.randomUUID();
        const ext = path.extname(fileName);
        const storedName = `${fileId}${ext}`;
        const filePath = path.join(dir, storedName);
        const buffer = file instanceof Blob ? Buffer.from(await file.arrayBuffer()) : Buffer.from(file as any);
        await fsPromises.writeFile(filePath, buffer); // PERF-01 修复：使用异步 writeFile 替代 writeFileSync
        const objectName = `users/${userId}/${folder}/${storedName}`;
        return {
          success: true,
          fileId,
          fileName,
          objectName,
          fileUrl: `${domain}/storage/${objectName}`,
          fileSize: buffer.length,
        };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    uploadBuffer: async (userId, buffer, fileName, contentType = 'application/octet-stream', folder = 'workflows') => {
      try {
        const dir = path.join(basePath, 'users', userId, folder);
        ensureDir(dir);
        const fileId = crypto.randomUUID();
        const ext = path.extname(fileName);
        const storedName = `${fileId}${ext}`;
        const filePath = path.join(dir, storedName);
        await fsPromises.writeFile(filePath, buffer); // PERF-01 修复：使用异步 writeFile 替代 writeFileSync
        const objectName = `users/${userId}/${folder}/${storedName}`;
        return {
          success: true,
          fileId,
          fileName,
          objectName,
          fileUrl: `${domain}/storage/${objectName}`,
          fileSize: buffer.length,
        };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    getFileUrl: async (objectName: string) => {
      const filePath = path.join(basePath, objectName);
      if (fs.existsSync(filePath)) {
        return `${domain}/storage/${objectName}`;
      }
      return null;
    },

    deleteFile: async (objectName: string) => {
      try {
        const filePath = path.join(basePath, objectName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },

    listFiles: async (userId: string, folder = 'workflows') => {
      const dir = path.join(basePath, 'users', userId, folder);
      if (!fs.existsSync(dir)) return [];
      try {
        const files = fs.readdirSync(dir);
        return files.map(file => {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          return {
            fileId: path.basename(file, path.extname(file)),
            fileName: file,
            fileSize: stat.size,
            contentType: 'application/octet-stream',
            uploadedAt: stat.mtime,
            url: `${domain}/storage/users/${userId}/${folder}/${file}`,
          };
        });
      } catch {
        return [];
      }
    },

    getFile: async (objectName: string) => {
      try {
        const filePath = path.join(basePath, objectName);
        if (fs.existsSync(filePath)) {
          return fs.readFileSync(filePath);
        }
        return null;
      } catch {
        return null;
      }
    },

    initializeBucket: async () => {
      try {
        ensureDir(path.join(basePath, 'cache'));
        ensureDir(path.join(basePath, 'users'));
        ensureDir(path.join(basePath, 'temp'));
        console.log('[LocalStorage] Directories initialized');
        return true;
      } catch {
        return false;
      }
    },

    setPublicPolicy: async () => {
      // 本地存储通过 Nginx 控制访问，无需额外策略
      return true;
    },
  };
}
