import { logger } from '@/lib/logger';

export interface CacheMetadata {
  id: string;
  type: 'image' | 'video' | 'audio' | 'thumbnail' | 'workflow';
  name: string;
  size: number;
  createdAt: Date;
  accessedAt: Date;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface CacheOptions {
  type?: CacheMetadata['type'];
  name?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

class IndexedDBCache {
  private db: IDBDatabase | null = null;
  private dbName = 'AICG_Cache_DB';
  private dbVersion = 1;
  private isInitialized = false;

  async init(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        logger.error('IndexedDB 初始化失败:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        logger.info('IndexedDB 初始化成功');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('cache')) {
          const cacheStore = db.createObjectStore('cache', { keyPath: 'id' });
          cacheStore.createIndex('type', 'type', { unique: false });
          cacheStore.createIndex('createdAt', 'createdAt', { unique: false });
          cacheStore.createIndex('accessedAt', 'accessedAt', { unique: false });
          cacheStore.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains('metadata')) {
          const metadataStore = db.createObjectStore('metadata', { keyPath: 'id' });
          metadataStore.createIndex('type', 'type', { unique: false });
          metadataStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
        }

        if (!db.objectStoreNames.contains('blobs')) {
          db.createObjectStore('blobs', { keyPath: 'id' });
        }

        logger.info('IndexedDB 数据库结构已创建');
      };
    });
  }

  async set(id: string, data: unknown, options: CacheOptions = {}): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('数据库未初始化');

    const now = new Date();
    const metadata: CacheMetadata = {
      id,
      type: options.type || 'image',
      name: options.name || id,
      size: this.calculateSize(data),
      createdAt: now,
      accessedAt: now,
      tags: options.tags,
      metadata: options.metadata,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache', 'blobs'], 'readwrite');
      const cacheStore = transaction.objectStore('cache');
      const blobStore = transaction.objectStore('blobs');

      const metadataRequest = cacheStore.put(metadata);
      const blobRequest = blobStore.put({ id, data });

      metadataRequest.onerror = () => reject(metadataRequest.error);
      blobRequest.onerror = () => reject(blobRequest.error);

      transaction.oncomplete = () => {
        logger.info(`缓存已保存: ${id}`);
        resolve();
      };

      transaction.onerror = () => reject(transaction.error);
    });
  }

  async get<T = unknown>(id: string): Promise<T | null> {
    await this.init();
    if (!this.db) throw new Error('数据库未初始化');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache', 'blobs'], 'readonly');
      const cacheStore = transaction.objectStore('cache');
      const blobStore = transaction.objectStore('blobs');

      const metadataRequest = cacheStore.get(id);
      const blobRequest = blobStore.get(id);

      metadataRequest.onsuccess = () => {
        const metadata = metadataRequest.result as CacheMetadata | undefined;
        if (metadata) {
          metadata.accessedAt = new Date();
          cacheStore.put(metadata);
        }
      };

      blobRequest.onsuccess = () => {
        const result = blobRequest.result;
        if (result) {
          logger.info(`缓存已获取: ${id}`);
          resolve(result.data as T);
        } else {
          resolve(null);
        }
      };

      blobRequest.onerror = () => reject(blobRequest.error);
    });
  }

  async delete(id: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('数据库未初始化');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache', 'blobs'], 'readwrite');
      const cacheStore = transaction.objectStore('cache');
      const blobStore = transaction.objectStore('blobs');

      const metadataRequest = cacheStore.delete(id);
      const blobRequest = blobStore.delete(id);

      metadataRequest.onerror = () => reject(metadataRequest.error);
      blobRequest.onerror = () => reject(blobRequest.error);

      transaction.oncomplete = () => {
        logger.info(`缓存已删除: ${id}`);
        resolve();
      };

      transaction.onerror = () => reject(transaction.error);
    });
  }

  async clear(type?: CacheMetadata['type']): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('数据库未初始化');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache', 'blobs'], 'readwrite');
      const cacheStore = transaction.objectStore('cache');
      const blobStore = transaction.objectStore('blobs');

      if (type) {
        const index = cacheStore.index('type');
        const request = index.openCursor(IDBKeyRange.only(type));

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            blobStore.delete(cursor.value.id);
            cursor.continue();
          }
        };

        request.onerror = () => reject(request.error);
      } else {
        cacheStore.clear();
        blobStore.clear();
      }

      transaction.oncomplete = () => {
        logger.info(`缓存已清空${type ? ` (类型: ${type})` : ''}`);
        resolve();
      };

      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getAllMetadata(type?: CacheMetadata['type']): Promise<CacheMetadata[]> {
    await this.init();
    if (!this.db) throw new Error('数据库未初始化');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readonly');
      const cacheStore = transaction.objectStore('cache');

      let request: IDBRequest;
      if (type) {
        const index = cacheStore.index('type');
        request = index.getAll(IDBKeyRange.only(type));
      } else {
        request = cacheStore.getAll();
      }

      request.onsuccess = () => {
        resolve(request.result as CacheMetadata[]);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getTotalSize(): Promise<number> {
    const metadata = await this.getAllMetadata();
    return metadata.reduce((total, item) => total + item.size, 0);
  }

  async getStorageEstimate(): Promise<{ usage: number; quota: number }> {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
      };
    }
    return { usage: await this.getTotalSize(), quota: 0 };
  }

  async pruneOldest(count: number): Promise<void> {
    const metadata = await this.getAllMetadata();
    const sorted = metadata.sort((a, b) => 
      new Date(a.accessedAt).getTime() - new Date(b.accessedAt).getTime()
    );
    
    const toDelete = sorted.slice(0, count);
    for (const item of toDelete) {
      await this.delete(item.id);
    }
  }

  async pruneBySize(maxSize: number): Promise<void> {
    const metadata = await this.getAllMetadata();
    let totalSize = metadata.reduce((sum, m) => sum + m.size, 0);
    
    const sorted = metadata.sort((a, b) => 
      new Date(a.accessedAt).getTime() - new Date(b.accessedAt).getTime()
    );
    
    for (const item of sorted) {
      if (totalSize <= maxSize) break;
      await this.delete(item.id);
      totalSize -= item.size;
    }
  }

  async searchByTags(tags: string[]): Promise<CacheMetadata[]> {
    const metadata = await this.getAllMetadata();
    return metadata.filter(m => 
      m.tags && tags.some(tag => m.tags!.includes(tag))
    );
  }

  async searchByName(query: string): Promise<CacheMetadata[]> {
    const metadata = await this.getAllMetadata();
    const lowerQuery = query.toLowerCase();
    return metadata.filter(m => 
      m.name.toLowerCase().includes(lowerQuery)
    );
  }

  private calculateSize(data: unknown): number {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      return 0;
    }
  }
}

export const indexedDBCache = new IndexedDBCache();

export default indexedDBCache;
