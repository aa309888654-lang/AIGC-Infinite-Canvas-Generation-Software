/**
 * 配置热更新系统
 * 支持运行时动态更新配置，无需重启应用
 */

import { generateId } from '@/lib/utils';

// ==================== 类型定义 ====================

// 配置项类型
export type ConfigValueType = string | number | boolean | object | null;

// 配置项
export interface ConfigItem<T extends ConfigValueType = ConfigValueType> {
  key: string;
  value: T;
  type: string;
  defaultValue: T;
  description?: string;
  validator?: (value: T) => boolean;
  onChange?: (newValue: T, oldValue: T) => void;
}

// 配置变更事件
export interface ConfigChangeEvent {
  key: string;
  oldValue: ConfigValueType;
  newValue: ConfigValueType;
  timestamp: Date;
}

// 配置订阅者
export interface ConfigSubscriber {
  id: string;
  keys: string[];
  callback: (event: ConfigChangeEvent) => void;
}

// ==================== 配置管理器 ====================

class ConfigManager {
  private static instance: ConfigManager;
  private configs: Map<string, ConfigItem> = new Map();
  private subscribers: Map<string, Set<ConfigSubscriber>> = new Map();
  private changeHistory: ConfigChangeEvent[] = [];
  private maxHistorySize = 100;
  private storageKey = 'appConfigs';
  private watchInterval: number | null = null;
  
  private constructor() {
    this.loadFromStorage();
    this.startWatching();
  }
  
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }
  
  // ==================== 配置操作 ====================
  
  // 注册配置项
  register<T extends ConfigValueType>(item: ConfigItem<T>): void {
    const existing = this.configs.get(item.key);
    if (existing) {
      console.warn(`[Config] 配置项 ${item.key} 已存在，将被覆盖`);
    }
    
    this.configs.set(item.key, {
      ...item,
      type: item.type || typeof item.value
    });
    
    this.saveToStorage();
    // console.log(`[Config] 注册配置项: ${item.key}`);
  }
  
  // 批量注册配置项
  registerMany(items: ConfigItem[]): void {
    items.forEach(item => this.register(item));
  }
  
  // 获取配置值
  get<T = ConfigValueType>(key: string, defaultValue?: T): T {
    const item = this.configs.get(key);
    if (!item) {
      return defaultValue as T;
    }
    return item.value as T;
  }
  
  // 设置配置值
  set(key: string, value: ConfigValueType, options?: {
    silent?: boolean;
    validate?: boolean;
  }): boolean {
    const item = this.configs.get(key);
    if (!item) {
      console.warn(`[Config] 配置项 ${key} 不存在`);
      return false;
    }
    
    // 验证
    if (options?.validate !== false && item.validator) {
      if (!item.validator(value)) {
        console.error(`[Config] 配置值验证失败: ${key}`);
        return false;
      }
    }
    
    const oldValue = item.value;
    
    // 创建变更事件
    const event: ConfigChangeEvent = {
      key,
      oldValue,
      newValue: value,
      timestamp: new Date()
    };
    
    // 更新值
    (item as any).value = value;
    
    // 保存到存储
    if (!options?.silent) {
      this.saveToStorage();
      this.notifySubscribers(event);
      this.addToHistory(event);
      
      // 触发 onChange 回调
      if (item.onChange) {
        item.onChange(value, oldValue);
      }
    }
    
    // console.log(`[Config] 更新配置: ${key}`, { oldValue, newValue: value });
    return true;
  }
  
  // 重置为默认值
  reset(key: string): boolean {
    const item = this.configs.get(key);
    if (!item) return false;
    
    return this.set(key, item.defaultValue);
  }
  
  // 重置所有配置
  resetAll(): void {
    this.configs.forEach((item, key) => {
      this.set(key, item.defaultValue, { silent: true });
    });
    this.saveToStorage();
  }
  
  // ==================== 订阅机制 ====================
  
  // 订阅配置变更
  subscribe(keys: string[], callback: (event: ConfigChangeEvent) => void): () => void {
    const id = generateId();
    const subscriber: ConfigSubscriber = {
      id,
      keys,
      callback
    };
    
    keys.forEach(key => {
      if (!this.subscribers.has(key)) {
        this.subscribers.set(key, new Set());
      }
      this.subscribers.get(key)!.add(subscriber);
    });
    
    // console.log(`[Config] 订阅配置: ${keys.join(', ')}`);
    
    // 返回取消订阅函数
    return () => {
      keys.forEach(key => {
        this.subscribers.get(key)?.delete(subscriber);
      });
    };
  }
  
  // 通知订阅者
  private notifySubscribers(event: ConfigChangeEvent): void {
    const subscribers = this.subscribers.get(event.key);
    if (!subscribers) return;
    
    subscribers.forEach(sub => {
      if (sub.keys.includes(event.key)) {
        try {
          sub.callback(event);
        } catch (error) {
          console.error(`[Config] 订阅回调执行失败:`, error);
        }
      }
    });
  }
  
  // ==================== 历史记录 ====================
  
  // 添加到历史记录
  private addToHistory(event: ConfigChangeEvent): void {
    this.changeHistory.push(event);
    if (this.changeHistory.length > this.maxHistorySize) {
      this.changeHistory.shift();
    }
  }
  
  // 获取历史记录
  getHistory(key?: string): ConfigChangeEvent[] {
    if (key) {
      return this.changeHistory.filter(e => e.key === key);
    }
    return [...this.changeHistory];
  }
  
  // 清空历史记录
  clearHistory(): void {
    this.changeHistory = [];
  }
  
  // ==================== 存储持久化 ====================
  
  // 保存到存储
  private saveToStorage(): void {
    try {
      const data: Record<string, ConfigValueType> = {};
      this.configs.forEach((item, key) => {
        data[key] = item.value;
      });
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (e) {
      console.error('[Config] 保存配置失败:', e);
    }
  }
  
  // 从存储加载
  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        // 只加载已注册的配置
        Object.entries(parsed).forEach(([key, value]) => {
          const item = this.configs.get(key);
          if (item) {
            (item as any).value = value;
          }
        });
      }
    } catch (e) {
      console.error('[Config] 加载配置失败:', e);
    }
  }
  
  // ==================== 文件监听 ====================
  
  // 启动文件监听（用于开发环境）
  private startWatching(): void {
    if (typeof window === 'undefined') return;
    
    // 监听 storage 事件，实现跨标签页同步
    window.addEventListener('storage', (event) => {
      if (event.key === this.storageKey && event.newValue) {
        try {
          const newConfigs = JSON.parse(event.newValue);
          Object.entries(newConfigs).forEach(([key, value]) => {
            const item = this.configs.get(key);
            if (item && item.value !== value) {
              const event: ConfigChangeEvent = {
                key,
                oldValue: item.value,
                newValue: value as ConfigValueType,
                timestamp: new Date()
              };
              (item as any).value = value;
              this.notifySubscribers(event);
              
              if (item.onChange) {
                item.onChange(value as ConfigValueType, event.oldValue as ConfigValueType);
              }
            }
          });
        } catch (e) {
          console.error('[Config] 同步配置失败:', e);
        }
      }
    });
  }
  
  // 手动触发重新加载
  reload(): void {
    this.loadFromStorage();
    // console.log('[Config] 配置已重新加载');
  }
  
  // ==================== 导出/导入 ====================
  
  // 导出配置
  exportConfig(): string {
    const data: Record<string, ConfigValueType> = {};
    this.configs.forEach((item, key) => {
      data[key] = item.value;
    });
    return JSON.stringify(data, null, 2);
  }
  
  // 导入配置
  importConfig(jsonString: string, options?: { validate?: boolean }): boolean {
    try {
      const data = JSON.parse(jsonString);
      Object.entries(data).forEach(([key, value]) => {
        this.set(key, value as ConfigValueType, { validate: options?.validate });
      });
      return true;
    } catch (e) {
      console.error('[Config] 导入配置失败:', e);
      return false;
    }
  }
  
  // ==================== 工具方法 ====================
  
  // 获取所有配置项
  getAll(): ConfigItem[] {
    return Array.from(this.configs.values());
  }
  
  // 获取配置项信息
  getInfo(key: string): ConfigItem | undefined {
    return this.configs.get(key);
  }
  
  // 检查配置是否存在
  has(key: string): boolean {
    return this.configs.has(key);
  }
  
  // 删除配置项
  delete(key: string): boolean {
    const result = this.configs.delete(key);
    if (result) {
      this.subscribers.delete(key);
      this.saveToStorage();
    }
    return result;
  }
  
  // 清空所有配置
  clear(): void {
    this.configs.clear();
    this.subscribers.clear();
    this.changeHistory = [];
    localStorage.removeItem(this.storageKey);
  }
}

// 导出单例
export const configManager = ConfigManager.getInstance();

// ==================== 便捷函数 ====================

// 注册配置
export function registerConfig<T extends ConfigValueType>(item: ConfigItem<T>): void {
  configManager.register(item);
}

// 获取配置
export function getConfig<T extends ConfigValueType>(key: string, defaultValue?: T): T {
  return configManager.get(key, defaultValue);
}

// 设置配置
export function setConfig<T extends ConfigValueType>(key: string, value: T): boolean {
  return configManager.set(key, value);
}

// 订阅配置变更
export function subscribeConfig(
  keys: string[], 
  callback: (event: ConfigChangeEvent) => void
): () => void {
  return configManager.subscribe(keys, callback);
}

// 导出配置
export function exportConfig(): string {
  return configManager.exportConfig();
}

// 导入配置
export function importConfig(jsonString: string): boolean {
  return configManager.importConfig(jsonString);
}

// ==================== 预设配置项 ====================

// 系统配置
export const SYSTEM_CONFIGS: ConfigItem[] = [
  {
    key: 'system.language',
    value: 'zh-CN',
    type: 'string',
    defaultValue: 'zh-CN',
    description: '系统语言',
    validator: (value) => ['zh-CN', 'en-US'].includes(value as string)
  },
  {
    key: 'system.theme',
    value: 'dark',
    type: 'string',
    defaultValue: 'dark',
    description: '系统主题',
    validator: (value) => ['dark', 'light'].includes(value as string)
  },
  {
    key: 'system.autoSave',
    value: true,
    type: 'boolean',
    defaultValue: true,
    description: '自动保存'
  },
  {
    key: 'system.autoSaveInterval',
    value: 30000,
    type: 'number',
    defaultValue: 30000,
    description: '自动保存间隔(ms)',
    validator: (value) => typeof value === 'number' && value >= 5000
  }
];

// UI配置
export const UI_CONFIGS: ConfigItem[] = [
  {
    key: 'ui.sidebarWidth',
    value: 280,
    type: 'number',
    defaultValue: 280,
    description: '侧边栏宽度',
    validator: (value) => typeof value === 'number' && value >= 200 && value <= 500
  },
  {
    key: 'ui.showMinimap',
    value: true,
    type: 'boolean',
    defaultValue: true,
    description: '显示小地图'
  },
  {
    key: 'ui.gridSize',
    value: 20,
    type: 'number',
    defaultValue: 20,
    description: '网格大小'
  }
];

// 初始化预设配置
export function initDefaultConfigs(): void {
  configManager.registerMany([...SYSTEM_CONFIGS, ...UI_CONFIGS]);
  // console.log('[Config] 已初始化预设配置');
}