/**
 * 配置管理器
 * 提供灵活的配置管理系统
 */

// 配置值类型
export type ConfigValue = string | number | boolean | unknown[] | Record<string, unknown>;

export interface ConfigSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    default: ConfigValue;
    description?: string;
    validation?: (value: ConfigValue) => boolean;
    options?: ConfigValue[];
  };
}

export interface ConfigCategory {
  id: string;
  name: string;
  description: string;
  schema: ConfigSchema;
  icon?: string;
}

export class ConfigManager {
  private static instance: ConfigManager;
  private configs: Map<string, Record<string, unknown>> = new Map();
  private schemas: Map<string, ConfigSchema> = new Map();
  private categories: Map<string, ConfigCategory> = new Map();
  private listeners: Map<string, Set<(key: string, value: unknown) => void>> = new Map();

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  // 注册配置模式
  registerSchema(categoryId: string, schema: ConfigSchema): void {
    this.schemas.set(categoryId, schema);
    
    // 初始化默认配置
    const defaultConfig: Record<string, unknown> = {};
    for (const [key, config] of Object.entries(schema)) {
      defaultConfig[key] = config.default;
    }
    
    if (!this.configs.has(categoryId)) {
      this.configs.set(categoryId, defaultConfig);
    }
  }

  // 注册配置分类
  registerCategory(category: ConfigCategory): void {
    this.categories.set(category.id, category);
    this.registerSchema(category.id, category.schema);
  }

  // 获取配置值
  get<T = unknown>(categoryId: string, key: string): T {
    const categoryConfig = this.configs.get(categoryId);
    if (!categoryConfig) {
      throw new Error(`配置分类 ${categoryId} 未注册`);
    }
    
    const schema = this.schemas.get(categoryId);
    if (!schema || !schema[key]) {
      throw new Error(`配置项 ${categoryId}.${key} 未定义`);
    }
    
    return (categoryConfig[key] as T) ?? (schema[key].default as T);
  }

  // 设置配置值
  set(categoryId: string, key: string, value: unknown): boolean {
    const configValue = value as ConfigValue;
    const schema = this.schemas.get(categoryId);
    if (!schema || !schema[key]) {
      console.warn(`尝试设置未定义的配置项: ${categoryId}.${key}`);
      return false;
    }
    
    const config = schema[key];
    
    // 类型验证
    if (typeof configValue !== config.type && config.type !== 'array' && config.type !== 'object') {
      console.warn(`配置项 ${categoryId}.${key} 类型不匹配: 期望 ${config.type}, 得到 ${typeof configValue}`);
      return false;
    }
    
    // 自定义验证
    if (config.validation && !config.validation(configValue)) {
      console.warn(`配置项 ${categoryId}.${key} 验证失败`);
      return false;
    }
    
    // 选项验证
    if (config.options && !config.options.includes(configValue)) {
      console.warn(`配置项 ${categoryId}.${key} 值不在允许范围内`);
      return false;
    }
    
    const categoryConfig = this.configs.get(categoryId);
    if (categoryConfig) {
      categoryConfig[key] = configValue;
      
      // 通知监听器
      const listeners = this.listeners.get(`${categoryId}:${key}`);
      if (listeners) {
        listeners.forEach(listener => listener(key, configValue));
      }
      
      return true;
    }
    
    return false;
  }

  // 批量设置配置
  setBatch(categoryId: string, updates: Record<string, unknown>): Record<string, boolean> {
    const results: Record<string, boolean> = {};
    
    for (const [key, value] of Object.entries(updates)) {
      results[key] = this.set(categoryId, key, value);
    }
    
    return results;
  }

  // 重置配置为默认值
  reset(categoryId: string, key?: string): void {
    const schema = this.schemas.get(categoryId);
    if (!schema) return;
    
    const categoryConfig = this.configs.get(categoryId);
    if (!categoryConfig) return;
    
    if (key) {
      // 重置单个配置项
      if (schema[key]) {
        categoryConfig[key] = schema[key].default;
      }
    } else {
      // 重置整个分类
      for (const [key, config] of Object.entries(schema)) {
        categoryConfig[key] = config.default;
      }
    }
  }

  // 添加配置变更监听器
  onChange(categoryId: string, key: string, callback: (key: string, value: unknown) => void): () => void {
    const listenerKey = `${categoryId}:${key}`;
    
    if (!this.listeners.has(listenerKey)) {
      this.listeners.set(listenerKey, new Set());
    }
    
    this.listeners.get(listenerKey)!.add(callback);
    
    // 返回取消监听的函数
    return () => {
      const listeners = this.listeners.get(listenerKey);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }

  // 获取配置分类
  getCategories(): ConfigCategory[] {
    return Array.from(this.categories.values());
  }

  // 获取配置模式
  getSchema(categoryId: string): ConfigSchema | undefined {
    return this.schemas.get(categoryId);
  }

  // 获取所有配置
  getAllConfigs(): Record<string, Record<string, unknown>> {
    const result: Record<string, Record<string, unknown>> = {};
    
    for (const [categoryId, config] of this.configs.entries()) {
      result[categoryId] = { ...config };
    }
    
    return result;
  }

  // 导出配置
  exportConfig(): string {
    return JSON.stringify(this.getAllConfigs(), null, 2);
  }

  // 导入配置
  importConfig(configJson: string): boolean {
    try {
      const configs = JSON.parse(configJson);
      
      for (const [categoryId, categoryConfig] of Object.entries(configs)) {
        if (typeof categoryConfig === 'object' && categoryConfig !== null) {
          this.setBatch(categoryId, categoryConfig as Record<string, unknown>);
        }
      }
      
      return true;
    } catch (error) {
      console.error('配置导入失败:', error);
      return false;
    }
  }

  // 验证配置
  validateConfig(categoryId: string): { valid: boolean; errors: string[] } {
    const schema = this.schemas.get(categoryId);
    const config = this.configs.get(categoryId);
    
    if (!schema || !config) {
      return { valid: false, errors: ['配置分类未找到'] };
    }
    
    const errors: string[] = [];
    
    for (const [key, schemaConfig] of Object.entries(schema)) {
      const value = config[key];
      
      // 类型检查
      if (value !== undefined && typeof value !== schemaConfig.type) {
        errors.push(`配置项 ${key} 类型不匹配`);
      }
      
      // 自定义验证
      if (value !== undefined && schemaConfig.validation && !schemaConfig.validation(value as any)) {
        errors.push(`配置项 ${key} 验证失败`);
      }
      
      // 选项验证
      if (value !== undefined && schemaConfig.options && !schemaConfig.options.includes(value as any)) {
        errors.push(`配置项 ${key} 值不在允许范围内`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// 创建全局配置管理器实例
export const configManager = ConfigManager.getInstance();

// 预定义的配置分类
export const PREDEFINED_CATEGORIES: ConfigCategory[] = [
  {
    id: 'general',
    name: '通用设置',
    description: '应用程序通用配置',
    icon: '⚙️',
    schema: {
      language: {
        type: 'string',
        default: 'zh-CN',
        description: '界面语言',
        options: ['zh-CN', 'en-US'],
      },
      theme: {
        type: 'string',
        default: 'dark',
        description: '主题模式',
        options: ['light', 'dark', 'auto'],
      },
      autoSave: {
        type: 'boolean',
        default: true,
        description: '自动保存工作流',
      },
      maxHistory: {
        type: 'number',
        default: 50,
        description: '最大历史记录数',
        validation: (value) => typeof value === 'number' && value >= 10 && value <= 200,
      },
    },
  },
  {
    id: 'performance',
    name: '性能设置',
    description: '性能优化相关配置',
    icon: '⚡',
    schema: {
      enableVirtualScroll: {
        type: 'boolean',
        default: true,
        description: '启用虚拟滚动',
      },
      maxVisibleNodes: {
        type: 'number',
        default: 100,
        description: '最大可见节点数',
        validation: (value) => typeof value === 'number' && value >= 50 && value <= 500,
      },
      enableCache: {
        type: 'boolean',
        default: true,
        description: '启用API缓存',
      },
      cacheTTL: {
        type: 'number',
        default: 300000,
        description: '缓存过期时间(毫秒)',
        validation: (value) => typeof value === 'number' && value >= 60000 && value <= 3600000,
      },
    },
  },
  {
    id: 'security',
    name: '安全设置',
    description: '安全相关配置',
    icon: '🔒',
    schema: {
      enableEncryption: {
        type: 'boolean',
        default: true,
        description: '启用数据加密',
      },
      autoLogout: {
        type: 'boolean',
        default: false,
        description: '长时间无操作自动登出',
      },
      sessionTimeout: {
        type: 'number',
        default: 3600000,
        description: '会话超时时间(毫秒)',
        validation: (value) => typeof value === 'number' && value >= 1800000 && value <= 7200000,
      },
    },
  },
];