/**
 * 手机端文件存储服务
 * 使用 IndexedDB 持久化存储生成的文件元数据
 * 自动下载生成的图片、视频、音频到本地
 */

export interface StoredFileRecord {
  id: string;
  type: 'image' | 'video' | 'audio' | 'music';
  originalUrl: string;
  localUrl?: string; // 如果已下载到本地，可能是 blob URL
  filename: string;
  prompt?: string;
  createdAt: number;
  downloadedAt?: number;
  size?: number;
  mimeType?: string;
  metadata?: Record<string, unknown>;
}

export interface DownloadProgress {
  id: string;
  progress: number;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  error?: string;
}

const DB_NAME = 'mobile-file-storage';
const DB_VERSION = 1;
const STORE_NAME = 'files';
const AUTO_DOWNLOAD_KEY = 'auto-download-enabled';

class MobileFileStorageService {
  private static instance: MobileFileStorageService;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private constructor() {
    this.initPromise = this.initDB();
  }

  public static getInstance(): MobileFileStorageService {
    if (!MobileFileStorageService.instance) {
      MobileFileStorageService.instance = new MobileFileStorageService();
    }
    return MobileFileStorageService.instance;
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[MobileFileStorage] Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[MobileFileStorage] IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('downloadedAt', 'downloadedAt', { unique: false });
          console.log('[MobileFileStorage] Object store created');
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    await this.initPromise;
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }
    return this.db;
  }

  public isAutoDownloadEnabled(): boolean {
    try {
      const stored = localStorage.getItem(AUTO_DOWNLOAD_KEY);
      if (stored === null) return true; // 默认开启
      return stored === 'true';
    } catch {
      return true;
    }
  }

  public setAutoDownload(enabled: boolean): void {
    try {
      localStorage.setItem(AUTO_DOWNLOAD_KEY, String(enabled));
    } catch (e) {
      console.error('[MobileFileStorage] Failed to save auto-download preference:', e);
    }
  }

  public async saveFileRecord(record: Omit<StoredFileRecord, 'createdAt'>): Promise<string> {
    const db = await this.ensureDB();
    const fullRecord: StoredFileRecord = {
      ...record,
      createdAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(fullRecord);

      request.onsuccess = () => {
        console.log('[MobileFileStorage] File record saved:', record.id);
        resolve(record.id);
      };

      request.onerror = () => {
        console.error('[MobileFileStorage] Failed to save file record:', request.error);
        reject(request.error);
      };
    });
  }

  public async getFileRecord(id: string): Promise<StoredFileRecord | null> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  public async getAllFiles(type?: StoredFileRecord['type']): Promise<StoredFileRecord[]> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = type ? store.index('type') : store;
      const request = index.getAll(type ? IDBKeyRange.only(type) : undefined);

      request.onsuccess = () => {
        const results = (request.result || []).sort((a, b) => b.createdAt - a.createdAt);
        resolve(results);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  public async markAsDownloaded(id: string, localUrl?: string): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const record = getRequest.result as StoredFileRecord | undefined;
        if (record) {
          record.downloadedAt = Date.now();
          if (localUrl) record.localUrl = localUrl;
          
          const putRequest = store.put(record);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  public async deleteFileRecord(id: string): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async clearAllRecords(): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async getFileCount(): Promise<number> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  public async downloadFile(url: string, filename: string, mimeType?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return { success: false, error: `下载失败: HTTP ${response.status}` };
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

      return { success: true };
    } catch (error) {
      console.error('[MobileFileStorage] Download failed:', error);
      return { success: false, error: String(error) };
    }
  }

  public generateFilename(type: StoredFileRecord['type'], extension?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const random = Math.random().toString(36).substring(2, 6);
    
    const prefixes: Record<StoredFileRecord['type'], string> = {
      image: 'IMG',
      video: 'VID',
      audio: 'AUD',
      music: 'MUS',
    };
    
    const ext = extension || (type === 'music' || type === 'audio' ? 'mp3' : type === 'video' ? 'mp4' : 'png');
    return `${prefixes[type]}_${timestamp}_${random}.${ext}`;
  }

  public extractExtension(url: string): string {
    try {
      const pathname = new URL(url).pathname;
      const parts = pathname.split('.');
      if (parts.length > 1) {
        return parts[parts.length - 1].split('?')[0].toLowerCase();
      }
    } catch { /* ignore */ }
    return '';
  }

  public async autoSaveGeneratedContent(
    type: StoredFileRecord['type'],
    url: string,
    prompt?: string,
    options?: { metadata?: Record<string, unknown>; customFilename?: string }
  ): Promise<string | null> {
    if (!this.isAutoDownloadEnabled()) {
      console.log('[MobileFileStorage] Auto-download disabled, skipping save');
      return null;
    }

    if (!url || typeof url !== 'string') {
      console.warn('[MobileFileStorage] Invalid URL provided, skipping save');
      return null;
    }

    try {
      const isAlreadySaved = await this.checkIfUrlExists(url);
      if (isAlreadySaved) {
        console.log('[MobileFileStorage] URL already saved, skipping duplicate download:', url.substring(0, 50));
        const existingFiles = await this.getAllFiles();
        const existing = existingFiles.find(f => f.originalUrl === url);
        return existing?.id || null;
      }

      const ext = this.extractExtension(url) || (type === 'music' || type === 'audio' ? 'mp3' : type === 'video' ? 'mp4' : 'png');
      const filename = options?.customFilename || this.generateFilename(type, ext);
      
      const recordId = await this.saveFileRecord({
        id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        type,
        originalUrl: url,
        filename,
        prompt,
        metadata: options?.metadata,
      });

      const downloadResult = await this.downloadFile(url, filename);
      
      if (downloadResult.success) {
        await this.markAsDownloaded(recordId, url);
        console.log(`[MobileFileStorage] Auto-saved ${type}: ${filename}`);
        return recordId;
      } else {
        console.warn(`[MobileFileStorage] Auto-download failed for ${filename}:`, downloadResult.error);
        return recordId;
      }
    } catch (error) {
      console.error('[MobileFileStorage] Auto-save failed:', error);
      return null;
    }
  }

  public async recoverFilesFromServer(urls: Array<{ url: string; type: StoredFileRecord['type']; prompt?: string }>): Promise<void> {
    for (const item of urls) {
      const exists = await this.checkIfUrlExists(item.url);
      if (!exists) {
        await this.autoSaveGeneratedContent(item.type, item.url, item.prompt);
      }
    }
  }

  private async checkIfUrlExists(url: string): Promise<boolean> {
    const files = await this.getAllFiles();
    return files.some(f => f.originalUrl === url && f.downloadedAt);
  }
}

export const mobileFileStorage = MobileFileStorageService.getInstance();
