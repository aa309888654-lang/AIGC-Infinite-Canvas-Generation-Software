/**
 * 统一缓存服务
 * 整合所有缓存管理功能，提供单一入口
 */

import { logger } from '@/lib/logger';

export type CacheType = 'api' | 'thumbnail' | 'model' | 'workflow' | 'temp' | 'all';

export interface CacheStats {
  name: string;
  size: number;
  itemCount: number;
  formattedSize: string;
}

export interface CacheClearResult {
  success: boolean;
  clearedCaches: string[];
  errors: string[];
  freedSize: number;
  timestamp: Date;
}

export interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  cleanupInterval: number;
  enableDiskCache: boolean;
  enableCompression: boolean;
}

const DEFAULT_CONFIG: CacheConfig = {
  maxSize: 500 * 1024 * 1024,
  defaultTTL: 30 * 60 * 1000,
  cleanupInterval: 5 * 60 * 1000,
  enableDiskCache: true,
  enableCompression: false,
};

export class UnifiedCacheService {
  private static instance: UnifiedCacheService;
  private caches: Map<string, Map<string, { data: unknown; timestamp: number; ttl: number; size: number }>> = new Map();
  private config: CacheConfig;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private hitCount: number = 0;
  private missCount: number = 0;

  private constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initCaches();
    this.startCleanupTimer();
  }

  static getInstance(config?: Partial<CacheConfig>): UnifiedCacheService {
    if (!UnifiedCacheService.instance) {
      UnifiedCacheService.instance = new UnifiedCacheService(config);
    }
    return UnifiedCacheService.instance;
  }

  private initCaches(): void {
    const cacheTypes: CacheType[] = ['api', 'thumbnail', 'model', 'workflow', 'temp'];
    cacheTypes.forEach(type => {
      this.caches.set(type, new Map());
    });
  }

  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private cleanup(): void {
    const now = Date.now();
    this.caches.forEach((cache) => {
      cache.forEach((entry, key) => {
        if (now - entry.timestamp > entry.ttl) {
          cache.delete(key);
        }
      });
    });
  }

  get<T>(type: CacheType, key: string): T | null {
    const cache = this.caches.get(type);
    if (!cache) return null;

    const entry = cache.get(key);
    if (!entry) {
      this.missCount++;
      return null;
    }

    if (Date.now() - entry.timestamp > entry.ttl) {
      cache.delete(key);
      this.missCount++;
      return null;
    }

    this.hitCount++;
    return entry.data as T;
  }

  set<T>(type: CacheType, key: string, data: T, ttl?: number): void {
    const cache = this.caches.get(type);
    if (!cache) return;

    const size = this.estimateSize(data);
    cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL,
      size,
    });
  }

  private estimateSize(data: unknown): number {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      return 1024;
    }
  }

  delete(type: CacheType, key: string): boolean {
    const cache = this.caches.get(type);
    return cache?.delete(key) || false;
  }

  clear(type: CacheType): void {
    if (type === 'all') {
      this.caches.forEach(cache => cache.clear());
    } else {
      this.caches.get(type)?.clear();
    }
  }

  async clearAll(): Promise<CacheClearResult> {
    const result: CacheClearResult = {
      success: true,
      clearedCaches: [],
      errors: [],
      freedSize: 0,
      timestamp: new Date(),
    };

    const cacheNames: Record<CacheType, string> = {
      api: 'API缓存',
      thumbnail: '缩略图缓存',
      model: '模型缓存',
      workflow: '工作流缓存',
      temp: '临时缓存',
      all: '所有缓存',
    };

    this.caches.forEach((cache, type) => {
      try {
        let size = 0;
        cache.forEach(entry => { size += entry.size; });
        cache.clear();
        result.clearedCaches.push(cacheNames[type as CacheType] || type);
        result.freedSize += size;
        logger.info(`${cacheNames[type as CacheType]}已清除，释放 ${this.formatSize(size)}`);
      } catch (error) {
        result.errors.push(`${cacheNames[type as CacheType]}清除失败: ${error}`);
        result.success = false;
        logger.error(`${cacheNames[type as CacheType]}清除失败:`, error);
      }
    });

    return result;
  }

  getStats(type?: CacheType): CacheStats[] {
    const stats: CacheStats[] = [];
    const cacheNames: Record<CacheType, string> = {
      api: 'API缓存',
      thumbnail: '缩略图缓存',
      model: '模型缓存',
      workflow: '工作流缓存',
      temp: '临时缓存',
      all: '所有缓存',
    };

    if (type && type !== 'all') {
      const cache = this.caches.get(type);
      if (cache) {
        let size = 0;
        cache.forEach(entry => { size += entry.size; });
        stats.push({
          name: cacheNames[type],
          size,
          itemCount: cache.size,
          formattedSize: this.formatSize(size),
        });
      }
    } else {
      this.caches.forEach((cache, cacheType) => {
        let size = 0;
        cache.forEach(entry => { size += entry.size; });
        stats.push({
          name: cacheNames[cacheType as CacheType],
          size,
          itemCount: cache.size,
          formattedSize: this.formatSize(size),
        });
      });
    }

    return stats;
  }

  getTotalSize(): number {
    let total = 0;
    this.caches.forEach(cache => {
      cache.forEach(entry => { total += entry.size; });
    });
    return total;
  }

  getHitRate(): number {
    const total = this.hitCount + this.missCount;
    return total === 0 ? 0 : (this.hitCount / total) * 100;
  }

  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.caches.clear();
  }
}

export const unifiedCacheService = UnifiedCacheService.getInstance();
export default UnifiedCacheService;
