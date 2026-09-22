/**
 * IndexedDB 视频存储服务
 * 用于在浏览器本地持久化存储视频文件
 */

import { logger } from '@/lib/logger';

const DB_NAME = 'VideoStorageDB';
const DB_VERSION = 1;
const STORE_NAME = 'videos';

export interface VideoMetadata {
  fileName: string;
  duration: number;
  width: number;
  height: number;
  fileSize: number;
  createdAt: number;
}

export interface StoredVideo {
  id: string;
  blob: Blob;
  metadata: VideoMetadata;
  url?: string; // 运行时生成的 URL
}

class VideoStorageService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  /**
   * 初始化数据库
   */
  private async initDB(): Promise<IDBDatabase> {
    if (this.db) {
      logger.debug('[VideoStorage] 数据库已存在，直接使用');
      return this.db;
    }
    
    if (this.initPromise) {
      logger.debug('[VideoStorage] 等待数据库初始化...');
      return this.initPromise;
    }

    logger.info('[VideoStorage] 开始初始化数据库...');
    
    this.initPromise = new Promise<IDBDatabase>((resolve, reject) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
          console.error('[VideoStorage] 数据库打开失败:', request.error);
          this.initPromise = null;
          reject(request.error);
        };

        request.onsuccess = () => {
          this.db = request.result;
          logger.info('[VideoStorage] 数据库初始化成功');
          resolve(this.db);
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          logger.info('[VideoStorage] 数据库版本升级中...');
          
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('fileName', 'metadata.fileName', { unique: false });
            store.createIndex('createdAt', 'metadata.createdAt', { unique: false });
            logger.debug('[VideoStorage] 创建对象存储');
          }
        };
      } catch (error) {
        console.error('[VideoStorage] 初始化异常:', error);
        this.initPromise = null;
        reject(error);
      }
    });

    return this.initPromise;
  }

  /**
   * 存储视频文件
   * @param id 视频 ID（节点 ID）
   * @param file 视频文件
   * @param metadata 视频元数据
   */
  async saveVideo(id: string, file: File, metadata: VideoMetadata): Promise<void> {
    logger.debug('[VideoStorage] 开始保存视频', { id, fileName: metadata.fileName });
    
    const db = await this.initDB();
    logger.debug('[VideoStorage] 数据库已就绪，开始保存视频');

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const storedVideo: StoredVideo = {
        id,
        blob: file,
        metadata,
      };

      const request = store.put(storedVideo);

      request.onsuccess = () => {
        logger.info(`[VideoStorage] 视频保存成功: ${id}`, metadata.fileName);
        resolve();
      };

      request.onerror = () => {
        console.error(`[VideoStorage] 视频保存失败: ${id}`, request.error);
        reject(request.error);
      };
      
      transaction.oncomplete = () => {
        logger.debug(`[VideoStorage] 事务完成: ${id}`);
      };
      
      transaction.onerror = () => {
        console.error(`[VideoStorage] 事务错误: ${id}`, transaction.error);
        reject(transaction.error);
      };
    });
  }

  /**
   * 获取存储的视频
   * @param id 视频 ID
   */
  async getVideo(id: string): Promise<StoredVideo | null> {
    logger.debug('[VideoStorage] 开始获取视频:', id);
    
    const db = await this.initDB();
    logger.debug('[VideoStorage] 数据库已就绪，开始获取视频');

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result as StoredVideo | undefined;
        if (result) {
          logger.info('[VideoStorage] 视频加载成功', { fileName: result.metadata.fileName, id: result.id, blobSize: result.blob.size, blobType: result.blob.type });
          resolve(result);
        } else {
          logger.debug('[VideoStorage] 未找到视频:', id);
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error(`[VideoStorage] 视频加载失败: ${id}`, request.error);
        reject(request.error);
      };
      
      transaction.oncomplete = () => {
        logger.debug(`[VideoStorage] 读取事务完成: ${id}`);
      };
    });
  }

  /**
   * 删除视频
   * @param id 视频 ID
   */
  async deleteVideo(id: string): Promise<void> {
    logger.debug('[VideoStorage] 开始删除视频:', id);
    
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        logger.info(`[VideoStorage] 视频删除成功: ${id}`);
        resolve();
      };

      request.onerror = () => {
        console.error(`[VideoStorage] 视频删除失败: ${id}`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 清理过期的视频 URL（释放内存）
   * @param video 视频对象
   */
  revokeVideoURL(video: StoredVideo): void {
    if (video.url) {
      URL.revokeObjectURL(video.url);
      video.url = undefined;
    }
  }

  /**
   * 获取所有存储的视频
   */
  async getAllVideos(): Promise<StoredVideo[]> {
    logger.debug('[VideoStorage] 开始获取所有视频');
    
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const videos = request.result as StoredVideo[];
        logger.info(`[VideoStorage] 获取到 ${videos.length} 个视频`);
        resolve(videos);
      };

      request.onerror = () => {
        console.error('[VideoStorage] 获取视频列表失败', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 清空所有视频
   */
  async clearAllVideos(): Promise<void> {
    logger.info('[VideoStorage] 开始清空所有视频');
    
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        logger.info('[VideoStorage] 已清空所有视频');
        resolve();
      };

      request.onerror = () => {
        console.error('[VideoStorage] 清空视频失败', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取存储空间使用情况
   */
  async getStorageInfo(): Promise<{ count: number; totalSize: number }> {
    const videos = await this.getAllVideos();
    const totalSize = videos.reduce((sum, video) => sum + video.metadata.fileSize, 0);
    return {
      count: videos.length,
      totalSize,
    };
  }

  /**
   * 检查视频是否存在（调试用）
   */
  async checkVideoExists(id: string): Promise<boolean> {
    logger.debug('[VideoStorage] 检查视频是否存在:', id);
    const video = await this.getVideo(id);
    return video !== null;
  }

  /**
   * 获取数据库状态（调试用）
   */
  getDBStatus(): { initialized: boolean; dbName: string | null } {
    return {
      initialized: this.db !== null,
      dbName: this.db?.name || null
    };
  }
}

// 导出单例
export const videoStorage = new VideoStorageService();

// 挂载到全局对象供组件访问
if (typeof window !== 'undefined') {
  (window as any as Record<string, unknown>).videoStorage = videoStorage;
  logger.info('[VideoStorage] ✅ 已挂载到全局对象');
}
