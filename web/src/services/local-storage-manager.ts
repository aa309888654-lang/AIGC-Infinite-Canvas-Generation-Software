import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { SecureStorage } from './secure-storage';

export interface StorageItem {
  id: string;
  key: string;
  value: unknown;
  createdAt: Date;
  updatedAt: Date;
  size: number;
  isEncrypted: boolean;
}

export interface BackupInfo {
  id: string;
  name: string;
  createdAt: Date;
  size: number;
  itemsCount: number;
}

export class LocalStorageManager {
  private static instance: LocalStorageManager;
  private items: Map<string, StorageItem> = new Map();
  private cacheEnabled: boolean = true;
  private cache: Map<string, unknown> = new Map();

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): LocalStorageManager {
    if (!LocalStorageManager.instance) {
      LocalStorageManager.instance = new LocalStorageManager();
    }
    return LocalStorageManager.instance;
  }

  /**
   * 从本地存储加载数据
   */
  private async loadFromStorage(): Promise<void> {
    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith('ls_manager_')) {
          try {
            const data = localStorage.getItem(key);
            if (data) {
              const item = JSON.parse(data);
              this.items.set(item.key, item);
            }
          } catch (e) {
            console.error('Failed to load item:', key, e);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load from storage:', error);
    }
  }

  /**
   * 保存项目到本地存储
   */
  private saveToStorage(item: StorageItem): void {
    try {
      localStorage.setItem(`ls_manager_${item.key}`, JSON.stringify(item));
    } catch (error) {
      console.error('Failed to save to storage:', error);
    }
  }

  /**
   * 计算数据大小
   */
  private calculateSize(value: unknown): number {
    try {
      return new Blob([JSON.stringify(value)]).size;
    } catch {
      return 0;
    }
  }

  /**
   * 设置数据
   */
  public async setItem(
    key: string,
    value: unknown,
    options: { encrypt?: boolean } = {}
  ): Promise<void> {
    const now = new Date();
    const size = this.calculateSize(value);
    
    let storedValue = value;
    if (options.encrypt) {
      await SecureStorage.setItem(key, value);
      storedValue = null;
    }

    const existingItem = this.items.get(key);
    const item: StorageItem = {
      id: existingItem?.id || crypto.randomUUID(),
      key,
      value: storedValue,
      createdAt: existingItem?.createdAt || now,
      updatedAt: now,
      size,
      isEncrypted: options.encrypt || false,
    };

    this.items.set(key, item);
    
    if (!options.encrypt) {
      this.saveToStorage(item);
    }
    
    if (this.cacheEnabled) {
      this.cache.set(key, value);
    }
  }

  /**
   * 获取数据
   */
  public async getItem<T = unknown>(key: string): Promise<T | null> {
    if (this.cacheEnabled && this.cache.has(key)) {
      return this.cache.get(key) as T;
    }

    const item = this.items.get(key);
    if (!item) {
      const encrypted = await SecureStorage.getItem(key);
      if (encrypted !== null) {
        if (this.cacheEnabled) {
          this.cache.set(key, encrypted);
        }
        return encrypted as T;
      }
      return null;
    }

    if (item.isEncrypted) {
      const encrypted = await SecureStorage.getItem(key);
      if (this.cacheEnabled && encrypted !== null) {
        this.cache.set(key, encrypted);
      }
      return encrypted as T;
    }

    if (this.cacheEnabled) {
      this.cache.set(key, item.value);
    }
    
    return item.value as T;
  }

  /**
   * 删除数据
   */
  public async removeItem(key: string): Promise<void> {
    this.items.delete(key);
    localStorage.removeItem(`ls_manager_${key}`);
    await SecureStorage.removeItem(key);
    this.cache.delete(key);
  }

  /**
   * 检查是否存在
   */
  public hasItem(key: string): boolean {
    return this.items.has(key) || SecureStorage.getItem(key) !== null;
  }

  /**
   * 获取所有项目
   */
  public getAllItems(): StorageItem[] {
    return Array.from(this.items.values());
  }

  /**
   * 清空所有数据
   */
  public async clear(): Promise<void> {
    const keys = Array.from(this.items.keys());
    for (const key of keys) {
      await this.removeItem(key);
    }
    this.items.clear();
    this.cache.clear();
  }

  /**
   * 获取存储统计信息
   */
  public getStorageStats(): {
    totalItems: number;
    totalSize: number;
    encryptedItems: number;
  } {
    let totalSize = 0;
    let encryptedItems = 0;
    
    for (const item of this.items.values()) {
      totalSize += item.size;
      if (item.isEncrypted) {
        encryptedItems++;
      }
    }

    return {
      totalItems: this.items.size,
      totalSize,
      encryptedItems,
    };
  }

  /**
   * 创建备份
   */
  public async createBackup(name?: string): Promise<BackupInfo> {
    const backupData = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      items: Array.from(this.items.values()),
    };

    const backupJson = JSON.stringify(backupData, null, 2);
    const backupBlob = new Blob([backupJson], { type: 'application/json' });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultName = `backup-${timestamp}.json`;
    
    const filePath = await save({
      defaultPath: name || defaultName,
      filters: [{
        name: 'JSON',
        extensions: ['json'],
      }],
    });

    if (!filePath) {
      throw new Error('Backup cancelled');
    }

    await invoke('write_file', {
      path: filePath,
      content: backupJson,
    });

    return {
      id: crypto.randomUUID(),
      name: name || defaultName,
      createdAt: new Date(),
      size: backupBlob.size,
      itemsCount: this.items.size,
    };
  }

  /**
   * 从备份恢复
   */
  public async restoreFromBackup(): Promise<void> {
    const selected = await open({
      multiple: false,
      filters: [{
        name: 'JSON',
        extensions: ['json'],
      }],
    });

    if (!selected || typeof selected !== 'string') {
      throw new Error('No backup file selected');
    }

    const content = await invoke<string>('read_file', { path: selected });
    const backupData = JSON.parse(content);

    if (!backupData.version || !backupData.items) {
      throw new Error('Invalid backup file');
    }

    await this.clear();

    for (const item of backupData.items) {
      this.items.set(item.key, {
        ...item,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      });
      this.saveToStorage(item);
    }

    await this.loadFromStorage();
  }

  /**
   * 启用/禁用缓存
   */
  public setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
    if (!enabled) {
      this.cache.clear();
    }
  }

  /**
   * 清除缓存
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * 批量获取数据
   */
  public async getItems<T = unknown>(keys: string[]): Promise<Map<string, T | null>> {
    const result = new Map<string, T | null>();
    for (const key of keys) {
      result.set(key, await this.getItem<T>(key));
    }
    return result;
  }

  /**
   * 批量设置数据
   */
  public async setItems(items: Map<string, unknown>, options: { encrypt?: boolean } = {}): Promise<void> {
    for (const [key, value] of items) {
      await this.setItem(key, value, options);
    }
  }

  /**
   * 按前缀搜索键
   */
  public searchKeys(prefix: string): string[] {
    return Array.from(this.items.keys()).filter(key => 
      key.startsWith(prefix)
    );
  }

  /**
   * 导出单个项目
   */
  public async exportItem(key: string): Promise<void> {
    const item = this.items.get(key);
    if (!item) {
      throw new Error('Item not found');
    }
    
    await save({
      defaultPath: `${key}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
  }

  /**
   * 导入项目
   */
  public async importItem(): Promise<void> {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });

    if (!selected || typeof selected !== 'string') {
      return;
    }

    const content = await invoke<string>('read_file', { path: selected });
    const data = JSON.parse(content);
    
    if (data.key && data.value !== undefined) {
      await this.setItem(data.key, data.value);
    }
  }
}

export default LocalStorageManager.getInstance();
