export enum CacheCategory {
  API = 'api',
  THUMBNAIL = 'thumbnail',
  WORKFLOW = 'workflow',
  GENERATION = 'generation',
  MODEL = 'model',
  CONFIG = 'config',
  USER_DATA = 'user_data',
  TEMP = 'temp'
}

export enum CachePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum EvictionStrategy {
  LRU = 'lru',
  LFU = 'lfu',
  FIFO = 'fifo',
  SIZE_BASED = 'size_based'
}

export interface CacheEntry<T = unknown> {
  id: string;
  key: string;
  value: T;
  category: CacheCategory;
  priority: CachePriority;
  tags: string[];
  size: number;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
  accessCount: number;
  ttl?: number;
  expiresAt?: number;
  persistToDisk: boolean;
}

export interface CacheConfig {
  maxTotalSize: number;
  maxEntrySize: number;
  defaultTTL: number;
  cleanupInterval: number;
  evictionStrategy: EvictionStrategy;
  persistEnabled: boolean;
  persistPath: string;
  categoryConfigs: Record<CacheCategory, CategoryConfig>;
}

export interface CategoryConfig {
  enabled: boolean;
  maxSize: number;
  defaultTTL: number;
  priority: CachePriority;
  persist: boolean;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  evictionCount: number;
  categories: CategoryStats[];
  performance: PerformanceMetrics;
  lastCleanup: number | null;
}

export interface CategoryStats {
  category: CacheCategory;
  entryCount: number;
  totalSize: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
}

export interface PerformanceMetrics {
  averageGetTime: number;
  averageSetTime: number;
  peakMemoryUsage: number;
  totalOperations: number;
  lastHourStats: TimeWindowStats;
}

export interface TimeWindowStats {
  startTime: number;
  hitCount: number;
  missCount: number;
  evictionCount: number;
}

export interface CacheEntryOptions {
  category?: CacheCategory;
  priority?: CachePriority;
  tags?: string[];
  ttl?: number;
  persistToDisk?: boolean;
}

export interface CacheQueryOptions {
  category?: CacheCategory;
  tags?: string[];
  minAccessCount?: number;
  createdAfter?: number;
  accessedAfter?: number;
}

export const DEFAULT_CATEGORY_CONFIGS: Record<CacheCategory, CategoryConfig> = {
  [CacheCategory.API]: {
    enabled: true,
    maxSize: 100 * 1024 * 1024,
    defaultTTL: 5 * 60 * 1000,
    priority: CachePriority.HIGH,
    persist: false
  },
  [CacheCategory.THUMBNAIL]: {
    enabled: true,
    maxSize: 500 * 1024 * 1024,
    defaultTTL: 7 * 24 * 60 * 60 * 1000,
    priority: CachePriority.NORMAL,
    persist: true
  },
  [CacheCategory.WORKFLOW]: {
    enabled: true,
    maxSize: 200 * 1024 * 1024,
    defaultTTL: 24 * 60 * 60 * 1000,
    priority: CachePriority.HIGH,
    persist: true
  },
  [CacheCategory.GENERATION]: {
    enabled: true,
    maxSize: 300 * 1024 * 1024,
    defaultTTL: 1 * 60 * 60 * 1000,
    priority: CachePriority.NORMAL,
    persist: true
  },
  [CacheCategory.MODEL]: {
    enabled: true,
    maxSize: 50 * 1024 * 1024,
    defaultTTL: 30 * 60 * 1000,
    priority: CachePriority.CRITICAL,
    persist: false
  },
  [CacheCategory.CONFIG]: {
    enabled: true,
    maxSize: 10 * 1024 * 1024,
    defaultTTL: 0,
    priority: CachePriority.CRITICAL,
    persist: true
  },
  [CacheCategory.USER_DATA]: {
    enabled: true,
    maxSize: 100 * 1024 * 1024,
    defaultTTL: 0,
    priority: CachePriority.HIGH,
    persist: true
  },
  [CacheCategory.TEMP]: {
    enabled: true,
    maxSize: 50 * 1024 * 1024,
    defaultTTL: 5 * 60 * 1000,
    priority: CachePriority.LOW,
    persist: false
  }
};

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxTotalSize: 2 * 1024 * 1024 * 1024,
  maxEntrySize: 50 * 1024 * 1024,
  defaultTTL: 5 * 60 * 1000,
  cleanupInterval: 60 * 1000,
  evictionStrategy: EvictionStrategy.LRU,
  persistEnabled: true,
  persistPath: 'unified_cache',
  categoryConfigs: DEFAULT_CATEGORY_CONFIGS
};

export const createCacheKey = (category: CacheCategory, ...parts: (string | number)[]): string => {
  return `${category}:${parts.join(':')}`;
};

export const parseCacheKey = (key: string): { category: CacheCategory; parts: string[] } => {
  const [category, ...parts] = key.split(':');
  return { category: category as CacheCategory, parts };
};

export const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
