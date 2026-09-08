/**
 * 持久化存储Hook
 * 支持LocalStorage、IndexedDB和内存缓存
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export type StorageType = 'localStorage' | 'indexedDB' | 'memory';
export type DataType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export interface StorageOptions {
  storageType?: StorageType;
  encrypt?: boolean;
  compress?: boolean;
  ttl?: number;
  namespace?: string;
}

export interface StorageItem<T = any> {
  key: string;
  value: T;
  type: DataType;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  version: number;
  metadata?: Record<string, any>;
}

export interface StorageStats {
  totalItems: number;
  totalSize: number;
  expiredItems: number;
  lastCleanup: number;
}

const DB_NAME = 'ai-video-sdk-db';
const DB_VERSION = 1;
const STORE_NAME = 'storage';

export function useStorage(defaultOptions: StorageOptions = {}) {
  const [stats, setStats] = useState<StorageStats>({
    totalItems: 0,
    totalSize: 0,
    expiredItems: 0,
    lastCleanup: Date.now(),
  });

  const dbRef = useRef<IDBDatabase | null>(null);
  const optionsRef = useRef<StorageOptions>({
    storageType: 'localStorage',
    namespace: 'ai-sdk',
    ...defaultOptions,
  });

  // IndexedDB初始化
  const initIndexedDB = useCallback((): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      if (dbRef.current) {
        resolve(dbRef.current);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        dbRef.current = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
    });
  }, []);

  // 生成带命名空间的key
  const getNamespacedKey = useCallback((key: string): string => {
    const namespace = optionsRef.current.namespace || 'ai-sdk';
    return `${namespace}:${key}`;
  }, []);

  // LocalStorage操作
  const localStorageOps = {
    async get<T = any>(key: string): Promise<T | null> {
      try {
        const raw = localStorage.getItem(getNamespacedKey(key));
        if (!raw) return null;

        const item: StorageItem<T> = JSON.parse(raw);

        if (item.expiresAt && item.expiresAt < Date.now()) {
          await this.remove(key);
          return null;
        }

        return item.value;
      } catch (error) {
        console.error(`[Storage] Failed to get from localStorage: ${key}`, error);
        return null;
      }
    },

    async set<T = any>(key: string, value: T, options?: StorageOptions): Promise<boolean> {
      try {
        const now = Date.now();
        const item: StorageItem<T> = {
          key: getNamespacedKey(key),
          value,
          type: Array.isArray(value) ? 'array' : typeof value as DataType,
          createdAt: now,
          updatedAt: now,
          expiresAt: options?.ttl ? now + options.ttl : undefined,
          version: 1,
        };

        localStorage.setItem(getNamespacedKey(key), JSON.stringify(item));
        await updateStats();
        return true;
      } catch (error) {
        console.error(`[Storage] Failed to set to localStorage: ${key}`, error);
        return false;
      }
    },

    async remove(key: string): Promise<boolean> {
      try {
        localStorage.removeItem(getNamespacedKey(key));
        await updateStats();
        return true;
      } catch (error) {
        console.error(`[Storage] Failed to remove from localStorage: ${key}`, error);
        return false;
      }
    },

    async clear(): Promise<boolean> {
      try {
        const namespace = optionsRef.current.namespace || 'ai-sdk';
        const keys = Object.keys(localStorage).filter(k => k.startsWith(`${namespace}:`));
        keys.forEach(k => localStorage.removeItem(k));
        await updateStats();
        return true;
      } catch (error) {
        console.error('[Storage] Failed to clear localStorage', error);
        return false;
      }
    },

    async keys(): Promise<string[]> {
      try {
        const namespace = optionsRef.current.namespace || 'ai-sdk';
        return Object.keys(localStorage)
          .filter(k => k.startsWith(`${namespace}:`))
          .map(k => k.replace(`${namespace}:`, ''));
      } catch (error) {
        console.error('[Storage] Failed to get keys from localStorage', error);
        return [];
      }
    },
  };

  // IndexedDB操作
  const indexedDBOps = {
    async get<T = any>(key: string): Promise<T | null> {
      try {
        const db = await initIndexedDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(STORE_NAME, 'readonly');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.get(getNamespacedKey(key));

          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const item: StorageItem<T> | undefined = request.result;
            if (!item) {
              resolve(null);
              return;
            }

            if (item.expiresAt && item.expiresAt < Date.now()) {
              this.remove(key).then(() => resolve(null));
              return;
            }

            resolve(item.value);
          };
        });
      } catch (error) {
        console.error(`[Storage] Failed to get from IndexedDB: ${key}`, error);
        return null;
      }
    },

    async set<T = any>(key: string, value: T, options?: StorageOptions): Promise<boolean> {
      try {
        const db = await initIndexedDB();
        const now = Date.now();

        const existing = await this.get(key);
        const item: StorageItem<T> = {
          key: getNamespacedKey(key),
          value,
          type: Array.isArray(value) ? 'array' : typeof value as DataType,
          createdAt: existing ? (existing as StorageItem<T>).createdAt : now,
          updatedAt: now,
          expiresAt: options?.ttl ? now + options.ttl : undefined,
          version: existing ? ((existing as StorageItem<T>).version || 1) + 1 : 1,
        };

        return new Promise((resolve, reject) => {
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.put(item);

          request.onerror = () => reject(request.error);
          request.onsuccess = async () => {
            await updateStats();
            resolve(true);
          };
        });
      } catch (error) {
        console.error(`[Storage] Failed to set to IndexedDB: ${key}`, error);
        return false;
      }
    },

    async remove(key: string): Promise<boolean> {
      try {
        const db = await initIndexedDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.delete(getNamespacedKey(key));

          request.onerror = () => reject(request.error);
          request.onsuccess = async () => {
            await updateStats();
            resolve(true);
          };
        });
      } catch (error) {
        console.error(`[Storage] Failed to remove from IndexedDB: ${key}`, error);
        return false;
      }
    },

    async clear(): Promise<boolean> {
      try {
        const db = await initIndexedDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.clear();

          request.onerror = () => reject(request.error);
          request.onsuccess = async () => {
            await updateStats();
            resolve(true);
          };
        });
      } catch (error) {
        console.error('[Storage] Failed to clear IndexedDB', error);
        return false;
      }
    },

    async keys(): Promise<string[]> {
      try {
        const db = await initIndexedDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(STORE_NAME, 'readonly');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.getAllKeys();

          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const namespace = optionsRef.current.namespace || 'ai-sdk';
            const keys = request.result
              .filter((k: string) => k.startsWith(`${namespace}:`))
              .map((k: string) => k.replace(`${namespace}:`, ''));
            resolve(keys);
          };
        });
      } catch (error) {
        console.error('[Storage] Failed to get keys from IndexedDB', error);
        return [];
      }
    },
  };

  // 内存缓存操作
  const memoryCache = new Map<string, StorageItem>();

  const memoryOps = {
    async get<T = any>(key: string): Promise<T | null> {
      const item = memoryCache.get(getNamespacedKey(key));
      if (!item) return null;

      if (item.expiresAt && item.expiresAt < Date.now()) {
        memoryCache.delete(getNamespacedKey(key));
        return null;
      }

      return item.value;
    },

    async set<T = any>(key: string, value: T, options?: StorageOptions): Promise<boolean> {
      const now = Date.now();
      const existing = memoryCache.get(getNamespacedKey(key));

      const item: StorageItem<T> = {
        key: getNamespacedKey(key),
        value,
        type: Array.isArray(value) ? 'array' : typeof value as DataType,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        expiresAt: options?.ttl ? now + options.ttl : undefined,
        version: existing ? existing.version + 1 : 1,
      };

      memoryCache.set(getNamespacedKey(key), item);
      return true;
    },

    async remove(key: string): Promise<boolean> {
      return memoryCache.delete(getNamespacedKey(key));
    },

    async clear(): Promise<boolean> {
      memoryCache.clear();
      return true;
    },

    async keys(): Promise<string[]> {
      const namespace = optionsRef.current.namespace || 'ai-sdk';
      return Array.from(memoryCache.keys())
        .filter(k => k.startsWith(`${namespace}:`))
        .map(k => k.replace(`${namespace}:`, ''));
    },
  };

  // 获取当前存储类型的操作对象
  const getOps = useCallback(() => {
    switch (optionsRef.current.storageType) {
      case 'indexedDB':
        return indexedDBOps;
      case 'memory':
        return memoryOps;
      default:
        return localStorageOps;
    }
  }, [indexedDBOps, localStorageOps, memoryOps]);

  // 更新统计信息
  const updateStats = useCallback(async () => {
    const ops = getOps();
    const keys = await ops.keys();
    let totalSize = 0;
    let expiredItems = 0;
    const now = Date.now();

    for (const key of keys) {
      const item = await ops.get(key);
      if (item) {
        totalSize += JSON.stringify(item).length;
      }
      const fullItem = await getOps().get(getNamespacedKey(key));
      if (fullItem && (fullItem as any).expiresAt && (fullItem as any).expiresAt < now) {
        expiredItems++;
      }
    }

    setStats({
      totalItems: keys.length,
      totalSize,
      expiredItems,
      lastCleanup: Date.now(),
    });
  }, [getOps, getNamespacedKey]);

  // 保存数据
  const save = useCallback(async <T = any>(
    key: string,
    value: T,
    options?: StorageOptions
  ): Promise<boolean> => {
    const mergedOptions = { ...optionsRef.current, ...options };
    return getOps().set(key, value, mergedOptions);
  }, [getOps]);

  // 读取数据
  const get = useCallback(async <T = any>(key: string): Promise<T | null> => {
    return getOps().get<T>(key);
  }, [getOps]);

  // 删除数据
  const remove = useCallback(async (key: string): Promise<boolean> => {
    return getOps().remove(key);
  }, [getOps]);

  // 清空所有数据
  const clear = useCallback(async (): Promise<boolean> => {
    return getOps().clear();
  }, [getOps]);

  // 获取所有键
  const keys = useCallback(async (): Promise<string[]> => {
    return getOps().keys();
  }, [getOps]);

  // 批量保存
  const saveMany = useCallback(async <T = any>(
    items: Array<{ key: string; value: T }>,
    options?: StorageOptions
  ): Promise<boolean> => {
    const mergedOptions = { ...optionsRef.current, ...options };
    const ops = getOps();
    const results = await Promise.all(
      items.map(item => ops.set(item.key, item.value, mergedOptions))
    );
    return results.every(r => r);
  }, [getOps]);

  // 批量读取
  const getMany = useCallback(async <T = any>(
    keysList: string[]
  ): Promise<Record<string, T | null>> => {
    const ops = getOps();
    const results = await Promise.all(
      keysList.map(async (key) => {
        const value = await ops.get<T>(key);
        return { key, value };
      })
    );
    return results.reduce((acc, { key, value }) => {
      acc[key] = value;
      return acc;
    }, {} as Record<string, T | null>);
  }, [getOps]);

  // 清理过期数据
  const cleanup = useCallback(async (): Promise<number> => {
    const ops = getOps();
    const allKeys = await ops.keys();
    const _now = Date.now();
    let cleaned = 0;

    for (const key of allKeys) {
      const item = await ops.get(key);
      if (!item) {
        await ops.remove(key);
        cleaned++;
      }
    }

    await updateStats();
    return cleaned;
  }, [getOps, updateStats]);

  // 导出数据
  const exportData = useCallback(async (): Promise<string> => {
    const ops = getOps();
    const allKeys = await ops.keys();
    const data: Record<string, any> = {};

    for (const key of allKeys) {
      const value = await ops.get(key);
      if (value !== null) {
        data[key] = value;
      }
    }

    return JSON.stringify(data, null, 2);
  }, [getOps]);

  // 导入数据
  const importData = useCallback(async (jsonString: string): Promise<boolean> => {
    try {
      const data = JSON.parse(jsonString);
      const entries = Object.entries(data);
      const ops = getOps();

      for (const [key, value] of entries) {
        await ops.set(key, value);
      }

      await updateStats();
      return true;
    } catch (error) {
      console.error('[Storage] Failed to import data', error);
      return false;
    }
  }, [getOps, updateStats]);

  // 设置选项
  const setOptions = useCallback((newOptions: StorageOptions) => {
    optionsRef.current = { ...optionsRef.current, ...newOptions };
  }, []);

  // 监听storage事件（跨标签页同步）
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key?.startsWith(optionsRef.current.namespace || 'ai-sdk')) {
        updateStats();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [updateStats]);

  // 初始化时更新统计
  useEffect(() => {
    updateStats();
  }, [updateStats]);

  return {
    save,
    get,
    remove,
    clear,
    keys,
    saveMany,
    getMany,
    cleanup,
    exportData,
    importData,
    setOptions,
    stats,
  };
}
