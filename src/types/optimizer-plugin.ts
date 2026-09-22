/**
 * 优化器插件相关类型定义
 */

import type { OptimizationModeType } from './optimization';

/** 插件状态 */
export type PluginStatus = 
  | 'unregistered'
  | 'registered'
  | 'initialized'
  | 'active'
  | 'inactive'
  | 'error';

/** 插件生命周期钩子 */
export interface PluginLifecycleHooks {
  onInit?: () => Promise<void> | void;
  onActivate?: () => Promise<void> | void;
  onDeactivate?: () => Promise<void> | void;
  onDestroy?: () => Promise<void> | void;
}

/** 插件接口 */
export interface OptimizerPlugin {
  /** 插件ID */
  id: string;
  /** 插件名称 */
  name: string;
  /** 插件版本 */
  version: string;
  /** 插件描述 */
  description?: string;
  /** 插件作者 */
  author?: string;
  /** 插件图标 */
  icon?: string;
  /** 生命周期钩子 */
  lifecycle: PluginLifecycleHooks;
  /** 插件配置 */
  config?: Record<string, unknown>;
  /** 依赖插件 */
  dependencies?: string[];
}

/** 优化器插件 - 扩展优化模式 */
export interface OptimizationModePlugin extends OptimizerPlugin {
  /** 支持的优化模式 */
  supportedModes: OptimizationModeType[];
  /** 优化器函数 */
  optimizer: {
    /** 执行优化 */
    optimize: (prompt: string, options?: Record<string, unknown>) => Promise<string>;
    /** 验证提示词 */
    validate?: (prompt: string) => Promise<{ valid: boolean; errors?: string[] }>;
    /** 获取建议 */
    getSuggestions?: (prompt: string) => Promise<string[]>;
  };
  /** 配置Schema */
  configSchema?: Record<string, ConfigSchemaField>;
}

/** 质量分析插件 */
export interface QualityAnalyzerPlugin extends OptimizerPlugin {
  /** 分析器函数 */
  analyzer: {
    /** 分析质量 */
    analyze: (prompt: string) => Promise<QualityAnalysisResult>;
    /** 批量分析 */
    batchAnalyze?: (prompts: string[]) => Promise<QualityAnalysisResult[]>;
  };
}

/** 质量分析结果 */
export interface QualityAnalysisResult {
  score: number;
  metrics: {
    clarity: number;
    specificity: number;
    completeness: number;
    creativity: number;
  };
  suggestions: string[];
  metadata?: Record<string, unknown>;
}

/** 模板插件 */
export interface TemplatePlugin extends OptimizerPlugin {
  /** 模板提供函数 */
  provider: {
    /** 获取模板列表 */
    getTemplates: () => Promise<TemplateDefinition[]>;
    /** 搜索模板 */
    searchTemplates: (query: string) => Promise<TemplateDefinition[]>;
    /** 获取模板详情 */
    getTemplateById: (id: string) => Promise<TemplateDefinition | null>;
  };
}

/** 模板定义 */
export interface TemplateDefinition {
  id: string;
  name: string;
  description?: string;
  prompt: string;
  category: string;
  tags?: string[];
  applicableModels?: string[];
  variables?: TemplateVariable[];
}

/** 模板变量 */
export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  defaultValue?: unknown;
  options?: string[];
  required?: boolean;
}

/** 配置Schema字段 */
export interface ConfigSchemaField {
  type: 'string' | 'number' | 'boolean' | 'select' | 'array';
  label: string;
  description?: string;
  defaultValue?: unknown;
  options?: { label: string; value: unknown }[];
  required?: boolean;
  validation?: (value: unknown) => boolean;
}

/** 插件注册信息 */
export interface PluginRegistration {
  plugin: OptimizerPlugin;
  status: PluginStatus;
  registeredAt: number;
  activatedAt?: number;
  error?: string;
}

/** 插件管理器配置 */
export interface PluginManagerConfig {
  /** 插件目录 */
  pluginsDir?: string;
  /** 是否自动激活 */
  autoActivate?: boolean;
  /** 插件加载超时 */
  loadTimeout?: number;
}
