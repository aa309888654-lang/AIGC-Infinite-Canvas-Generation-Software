/**
 * 模型参数动态适配系统
 * 
 * 设计目标：
 * 1. 为每个模型定义官方参数规范
 * 2. 根据模型动态显示/隐藏参数
 * 3. 参数值严格遵循官方约束
 */

// 参数类型枚举
export type ParameterType = 
  | 'select'      // 下拉选择
  | 'number'       // 数字输入
  | 'slider'       // 滑块选择
  | 'toggle'       // 开关
  | 'text'         // 文本输入
  | 'textarea';    // 多行文本

// 参数值定义
export interface ParameterOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  description?: string;
}

// 参数条件定义
export interface ParameterCondition {
  param: string;           // 依赖的参数名
  operator: 'eq' | 'neq' | 'in' | 'nin' | 'gt' | 'lt' | 'gte' | 'lte';
  value: unknown;
}

// 参数Schema定义
export interface ParameterSchema {
  id: string;
  type: ParameterType;
  label: string;
  default?: unknown;
  
  // 选项配置（用于select/slider类型）
  options?: ParameterOption[];
  
  // 数值配置（用于number/slider类型）
  min?: number;
  max?: number;
  step?: number;
  
  // 条件显示配置
  visibleWhen?: ParameterCondition[];   // 显示条件（数组内为AND关系）
  enabledWhen?: ParameterCondition[];   // 启用条件
  
  // 验证配置
  required?: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: RegExp;
    message?: string;
  };
  
  // 提示信息
  placeholder?: string;
  tooltip?: string;
  
  // 样式配置
  width?: 'small' | 'medium' | 'large';
}

// 模型参数配置
export interface ModelParameterConfig {
  // 模型基本信息
  modelId: string;
  provider: string;
  version: string;
  
  // 参数Schema列表
  parameters: ParameterSchema[];
  
  // 布局配置
  layout?: {
    columns?: number;           // 列数
    compact?: boolean;         // 紧凑模式
  };
}

// ============================================
// Doubao Seedance 模型参数配置
// ============================================
export const DOUBAO_SEEDANCE_CONFIGS: ModelParameterConfig[] = [
  {
    modelId: 'doubao-seedance-1-5-pro-251215',
    provider: 'doubao',
    version: '1.5',
    layout: { columns: 3, compact: true },
    parameters: [
      {
        id: 'duration',
        type: 'select',
        label: '时长',
        default: 5,
        options: [
          { value: 5, label: '5秒' },
          { value: 10, label: '10秒' },
        ],
      },
      {
        id: 'aspectRatio',
        type: 'select',
        label: '比例',
        default: '16:9',
        options: [
          { value: '16:9', label: '横向' },
          { value: '9:16', label: '竖向' },
          { value: '1:1', label: '方形' },
          { value: '4:3', label: '4:3' },
          { value: '3:4', label: '3:4' },
        ],
      },
      {
        id: 'resolution',
        type: 'select',
        label: '分辨率',
        default: '1080p',
        options: [
          { value: '720p', label: '720p' },
          { value: '1080p', label: '1080p' },
        ],
      },
      {
        id: 'generateAudio',
        type: 'toggle',
        label: '音频',
        default: true,
      },
    ],
  },
  {
    modelId: 'doubao-seedance-1-0-pro-250528',
    provider: 'doubao',
    version: '1.0',
    layout: { columns: 3, compact: true },
    parameters: [
      {
        id: 'duration',
        type: 'select',
        label: '时长',
        default: 5,
        options: [
          { value: 5, label: '5秒' },
          { value: 10, label: '10秒' },
        ],
      },
      {
        id: 'aspectRatio',
        type: 'select',
        label: '比例',
        default: '16:9',
        options: [
          { value: '16:9', label: '横向' },
          { value: '9:16', label: '竖向' },
          { value: '1:1', label: '方形' },
        ],
      },
      {
        id: 'resolution',
        type: 'select',
        label: '分辨率',
        default: '720p',
        options: [
          { value: '720p', label: '720p' },
          { value: '1080p', label: '1080p' },
        ],
      },
      {
        id: 'generateAudio',
        type: 'toggle',
        label: '音频',
        default: true,
      },
    ],
  },
  {
    modelId: 'doubao-seedance-1-0-pro-fast-250528',
    provider: 'doubao',
    version: '1.0',
    layout: { columns: 2, compact: true },
    parameters: [
      {
        id: 'duration',
        type: 'select',
        label: '时长',
        default: 5,
        options: [
          { value: 5, label: '5秒' },
        ],
      },
      {
        id: 'aspectRatio',
        type: 'select',
        label: '比例',
        default: '16:9',
        options: [
          { value: '16:9', label: '横向' },
          { value: '9:16', label: '竖向' },
          { value: '1:1', label: '方形' },
        ],
      },
      {
        id: 'resolution',
        type: 'select',
        label: '分辨率',
        default: '720p',
        options: [
          { value: '720p', label: '720p' },
        ],
      },
    ],
  },
  {
    modelId: 'doubao-seedance-1-0-lite-t2v-250428',
    provider: 'doubao',
    version: '1.0',
    layout: { columns: 2, compact: true },
    parameters: [
      {
        id: 'duration',
        type: 'select',
        label: '时长',
        default: 5,
        options: [
          { value: 5, label: '5秒' },
        ],
      },
      {
        id: 'aspectRatio',
        type: 'select',
        label: '比例',
        default: '16:9',
        options: [
          { value: '16:9', label: '横向' },
          { value: '9:16', label: '竖向' },
          { value: '1:1', label: '方形' },
        ],
      },
      {
        id: 'resolution',
        type: 'select',
        label: '分辨率',
        default: '720p',
        options: [
          { value: '720p', label: '720p' },
        ],
      },
    ],
  },
];

// ============================================
// Vidu 模型参数配置
// ============================================
export const VIDU_CONFIGS: ModelParameterConfig[] = [
  {
    modelId: 'viduq2-pro',
    provider: 'vidu',
    version: 'Q2',
    layout: { columns: 3, compact: true },
    parameters: [
      {
        id: 'duration',
        type: 'select',
        label: '时长',
        default: 8,
        options: [
          { value: 1, label: '1秒' },
          { value: 2, label: '2秒' },
          { value: 4, label: '4秒' },
          { value: 5, label: '5秒' },
          { value: 8, label: '8秒' },
          { value: 10, label: '10秒' },
        ],
      },
      {
        id: 'resolution',
        type: 'select',
        label: '分辨率',
        default: '720p',
        options: [
          { value: '540p', label: '540p' },
          { value: '720p', label: '720p' },
          { value: '1080p', label: '1080p' },
        ],
      },
      {
        id: 'motionAmplitude',
        type: 'select',
        label: '动作幅度',
        default: 'medium',
        options: [
          { value: 'low', label: '低' },
          { value: 'medium', label: '中' },
          { value: 'high', label: '高' },
        ],
      },
    ],
  },
  {
    modelId: 'vidu2-i2v',
    provider: 'vidu',
    version: '2.0',
    layout: { columns: 2, compact: true },
    parameters: [
      {
        id: 'duration',
        type: 'select',
        label: '时长',
        default: 4,
        options: [
          { value: 4, label: '4秒' },
        ],
      },
      {
        id: 'resolution',
        type: 'select',
        label: '分辨率',
        default: '720p',
        options: [
          { value: '360p', label: '360p' },
          { value: '720p', label: '720p' },
        ],
      },
      {
        id: 'motionAmplitude',
        type: 'select',
        label: '动作幅度',
        default: 'medium',
        options: [
          { value: 'low', label: '低' },
          { value: 'medium', label: '中' },
          { value: 'high', label: '高' },
        ],
      },
    ],
  },
  {
    modelId: 'vidu2-start-end',
    provider: 'vidu',
    version: '2.0',
    layout: { columns: 2, compact: true },
    parameters: [
      {
        id: 'duration',
        type: 'select',
        label: '时长',
        default: 4,
        options: [
          { value: 4, label: '4秒' },
        ],
      },
      {
        id: 'resolution',
        type: 'select',
        label: '分辨率',
        default: '720p',
        options: [
          { value: '360p', label: '360p' },
          { value: '720p', label: '720p' },
        ],
      },
      {
        id: 'motionAmplitude',
        type: 'select',
        label: '动作幅度',
        default: 'medium',
        options: [
          { value: 'low', label: '低' },
          { value: 'medium', label: '中' },
          { value: 'high', label: '高' },
        ],
      },
    ],
  },
  {
    modelId: 'vidu2-reference',
    provider: 'vidu',
    version: '2.0',
    layout: { columns: 2, compact: true },
    parameters: [
      {
        id: 'duration',
        type: 'select',
        label: '时长',
        default: 4,
        options: [
          { value: 4, label: '4秒' },
        ],
      },
      {
        id: 'resolution',
        type: 'select',
        label: '分辨率',
        default: '720p',
        options: [
          { value: '360p', label: '360p' },
          { value: '720p', label: '720p' },
        ],
      },
      {
        id: 'motionAmplitude',
        type: 'select',
        label: '动作幅度',
        default: 'medium',
        options: [
          { value: 'low', label: '低' },
          { value: 'medium', label: '中' },
          { value: 'high', label: '高' },
        ],
      },
    ],
  },
];

// ============================================
// 参数适配器 - 动态获取模型配置
// ============================================
export class ModelParameterAdapter {
  private configMap: Map<string, ModelParameterConfig> = new Map();

  constructor() {
    this.initializeConfigs();
  }

  private initializeConfigs() {
    // 注册所有模型配置
    [...DOUBAO_SEEDANCE_CONFIGS, ...VIDU_CONFIGS].forEach(config => {
      this.configMap.set(config.modelId, config);
    });
  }

  /**
   * 获取模型的参数配置
   */
  getConfig(modelId: string): ModelParameterConfig | null {
    return this.configMap.get(modelId) || null;
  }

  /**
   * 获取模型的可变参数列表
   */
  getParameters(modelId: string): ParameterSchema[] {
    const config = this.getConfig(modelId);
    return config?.parameters || [];
  }

  /**
   * 检查参数是否应该显示（根据条件）
   */
  shouldShowParameter(param: ParameterSchema, currentParams: Record<string, unknown>): boolean {
    if (!param.visibleWhen || param.visibleWhen.length === 0) {
      return true;
    }

    return param.visibleWhen.every(condition => {
      const currentValue = currentParams[condition.param];
      return this.evaluateCondition(condition, currentValue);
    });
  }

  /**
   * 检查参数是否应该启用
   */
  isParameterEnabled(param: ParameterSchema, currentParams: Record<string, unknown>): boolean {
    if (!param.enabledWhen || param.enabledWhen.length === 0) {
      return true;
    }

    return param.enabledWhen.every(condition => {
      const currentValue = currentParams[condition.param];
      return this.evaluateCondition(condition, currentValue);
    });
  }

  /**
   * 评估条件
   */
  private evaluateCondition(condition: ParameterCondition, currentValue: unknown): boolean {
    switch (condition.operator) {
      case 'eq':
        return currentValue === condition.value;
      case 'neq':
        return currentValue !== condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(currentValue);
      case 'nin':
        return Array.isArray(condition.value) && !condition.value.includes(currentValue);
      case 'gt':
        return typeof currentValue === 'number' && currentValue > (condition.value as number);
      case 'lt':
        return typeof currentValue === 'number' && currentValue < (condition.value as number);
      case 'gte':
        return typeof currentValue === 'number' && currentValue >= (condition.value as number);
      case 'lte':
        return typeof currentValue === 'number' && currentValue <= (condition.value as number);
      default:
        return true;
    }
  }

  /**
   * 获取参数的默认值
   */
  getDefaultValue(param: ParameterSchema): unknown {
    return param.default;
  }

  /**
   * 验证参数值
   */
  validateParameter(param: ParameterSchema, value: unknown): { valid: boolean; message?: string } {
    if (param.validation) {
      const { min, max, pattern, message } = param.validation;
      
      if (typeof value === 'number') {
        if (min !== undefined && value < min) {
          return { valid: false, message: message || `值不能小于 ${min}` };
        }
        if (max !== undefined && value > max) {
          return { valid: false, message: message || `值不能大于 ${max}` };
        }
      }
      
      if (pattern && typeof value === 'string' && !pattern.test(value)) {
        return { valid: false, message: message || '格式不正确' };
      }
    }
    
    return { valid: true };
  }

  /**
   * 获取模型列表
   */
  getAllModels(): Array<{ modelId: string; provider: string; version: string }> {
    return Array.from(this.configMap.values()).map(config => ({
      modelId: config.modelId,
      provider: config.provider,
      version: config.version,
    }));
  }

  /**
   * 按提供商获取模型
   */
  getModelsByProvider(provider: string): ModelParameterConfig[] {
    return Array.from(this.configMap.values()).filter(config => config.provider === provider);
  }
}

// 导出单例
export const modelParameterAdapter = new ModelParameterAdapter();
