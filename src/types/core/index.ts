/**
 * 统一核心类型定义
 * 解决 types/api-controller.ts 和 services/unified-api/types.ts 的类型冲突
 *
 * 合并策略：
 * - 保留所有APIProvider（取并集）
 * - 统一认证配置
 * - 统一Provider信息
 */

// ==================== API提供商类型 ====================
export type UnifiedAPIProvider =
  | 'doubao'
  | 'doubao-video'
  | 'jimeng'
  | 'leonardoAI'
  | 'recraftAI'
  | 'ideogram'
  | 'stabilityAI'
  | 'openai'
  | 'anthropicClaude'
  | 'googleGemini'
  | 'baiduWenxin'
  | 'aliyunQwen'
  | 'haiper'
  | 'minimax'
  | 'hailuo'
  | 'adobe'
  | 'flux'
  | 'bytedance'
  | 'adobeFirefly'
  | 'seedream'
  | 'minimaxVideo'
  | 'huawei'
  | 'huaweiVideo'
  | 'openaiCompatible'
  | 'vidu'
  | 'aliyun-wan'
  | 'agnes'
  | 'apipaths'
  | 'sensenova'
  | 'stepfun'
  | 'local';

// 向后兼容别名
export type APIProvider = UnifiedAPIProvider;

export type APIEnvironment = 'development' | 'staging' | 'production';

// ==================== AIModelProvider 兼容层 ====================
/**
 * AIModelProvider 类型（使用下划线格式，与旧代码兼容）
 * @deprecated 请使用 UnifiedAPIProvider
 */
export type AIModelProvider =
  | 'jimeng' | 'doubao' | 'doubao-video' | 'bytedance'
  | 'stability_ai' | 'minimax' | 'stepfun'
  | 'adobe_firefly' | 'leonardo_ai' | 'ideogram' | 'recraft_ai' | 'seedream' | 'stable_diffusion'
  | 'bilibili' | 'hailuo' | 'huawei' | 'huawei_video'
  | 'local';

/**
 * AIModelProvider 到 UnifiedAPIProvider 的映射表
 */
const AIMODEL_TO_UNIFIED: Record<AIModelProvider, UnifiedAPIProvider> = {
  jimeng: 'doubao',
  doubao: 'doubao',
  'doubao-video': 'doubao-video',
  bytedance: 'bytedance',
  stability_ai: 'stabilityAI',
  minimax: 'minimax',
  stepfun: 'stepfun',
  adobe_firefly: 'adobeFirefly',
  leonardo_ai: 'leonardoAI',
  ideogram: 'ideogram',
  recraft_ai: 'recraftAI',
  seedream: 'doubao',
  stable_diffusion: 'stabilityAI',
  bilibili: 'bytedance',
  hailuo: 'hailuo',
  huawei: 'huawei',
  huawei_video: 'huaweiVideo',
  local: 'local',
};

/**
 * UnifiedAPIProvider 到 AIModelProvider 的映射表
 */
const UNIFIED_TO_AIMODEL: Record<UnifiedAPIProvider, AIModelProvider> = {
  jimeng: 'jimeng',
  doubao: 'doubao',
  'doubao-video': 'doubao-video',
  bytedance: 'bytedance',
  stabilityAI: 'stability_ai',
  minimax: 'minimax',
  adobeFirefly: 'adobe_firefly',
  leonardoAI: 'leonardo_ai',
  ideogram: 'ideogram',
  recraftAI: 'recraft_ai',
  huawei: 'huawei',
  huaweiVideo: 'huawei_video',
  hailuo: 'hailuo',
  openai: 'stable_diffusion',
  anthropicClaude: 'stable_diffusion',
  googleGemini: 'stable_diffusion',
  baiduWenxin: 'stable_diffusion',
  aliyunQwen: 'stable_diffusion',
  haiper: 'stable_diffusion',
  adobe: 'adobe_firefly',
  flux: 'stable_diffusion',
  seedream: 'seedream',
  minimaxVideo: 'minimax',
  openaiCompatible: 'stable_diffusion',
  vidu: 'stable_diffusion',
  'aliyun-wan': 'stable_diffusion',
  agnes: 'stable_diffusion',
  apipaths: 'stable_diffusion',
  sensenova: 'stable_diffusion',
  stepfun: 'stepfun',
  local: 'stable_diffusion',
};

/**
 * 将 AIModelProvider 转换为 UnifiedAPIProvider
 * @deprecated 请直接使用 UnifiedAPIProvider
 */
export function toUnifiedProvider(provider: AIModelProvider): UnifiedAPIProvider {
  return AIMODEL_TO_UNIFIED[provider] || 'doubao';
}

/**
 * 将 UnifiedAPIProvider 转换为 AIModelProvider
 */
export function toAIModelProvider(provider: UnifiedAPIProvider): AIModelProvider {
  return UNIFIED_TO_AIMODEL[provider] || 'stable_diffusion';
}

/**
 * 检查是否为有效的 AIModelProvider
 */
export function isAIModelProvider(value: string): value is AIModelProvider {
  return value in AIMODEL_TO_UNIFIED;
}

/**
 * 检查是否为有效的 UnifiedAPIProvider
 */
export function isUnifiedProvider(value: string): value is UnifiedAPIProvider {
  return value in UNIFIED_TO_AIMODEL;
}

// ==================== 通用类型守卫 ====================

/**
 * 检查值是否为非空对象
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 检查值是否为非空数组
 */
export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * 检查值是否为字符串
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * 检查值是否为数字
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/**
 * 检查值是否为布尔值
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * 检查值是否为函数
 */
export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

/**
 * 检查错误对象
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * 安全获取对象属性
 */
export function getProperty<T>(obj: unknown, key: string): T | undefined {
  if (isObject(obj)) {
    return obj[key] as T;
  }
  return undefined;
}

/**
 * 安全解析 JSON
 */
export function safeParseJSON<T = unknown>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * 类型守卫组合函数 - AND
 */
export function and<T>(...predicates: Array<(value: T) => boolean>) {
  return (value: T): boolean => predicates.every(predicate => predicate(value));
}

/**
 * 类型守卫组合函数 - OR
 */
export function or<T>(...predicates: Array<(value: T) => boolean>) {
  return (value: T): boolean => predicates.some(predicate => predicate(value));
}

/**
 * 类型守卫组合函数 - NOT
 */
export function not<T>(predicate: (value: T) => boolean) {
  return (value: T): boolean => !predicate(value);
}

// ==================== 认证配置 ====================
export interface UnifiedAPIAuthConfig {
  apiKey?: string;
  accessKey?: string;
  secretKey?: string;
  baseUrl?: string;
  groupId?: string;
  model?: string;
  version?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  environment?: APIEnvironment;
}

// 向后兼容别名
export type APIAuthConfig = UnifiedAPIAuthConfig;

// ==================== 提供商信息 ====================
export interface UnifiedProviderInfo {
  id: UnifiedAPIProvider;
  name: string;
  description: string;
  color: string;
  authType: 'bearer' | 'aksk' | 'custom';
  authFields: Array<{
    key: string;
    label: string;
    type: 'text' | 'password';
    placeholder: string;
    required: boolean;
  }>;
  supportsImageGeneration: boolean;
  supportsVideoGeneration: boolean;
}

// 向后兼容别名
export type ProviderInfo = UnifiedProviderInfo;

// ==================== 默认配置 ====================
export const UNIFIED_DEFAULT_AUTH_CONFIG: UnifiedAPIAuthConfig = {
  apiKey: '',
  accessKey: '',
  secretKey: '',
  baseUrl: '',
  model: '',
  version: '',
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1,
  environment: 'production',
};

// 向后兼容别名
export const DEFAULT_AUTH_CONFIG: APIAuthConfig = UNIFIED_DEFAULT_AUTH_CONFIG;

// ==================== 提供商配置列表 ====================
export const UNIFIED_DEFAULT_PROVIDER_CONFIGS: UnifiedProviderInfo[] = [
  {
    id: 'doubao',
    name: '豆包AI',
    description: '字节跳动豆包大模型 (ARK API)',
    color: '#007AFF',
    authType: 'bearer',
    authFields: [
      { key: 'apiKey', label: 'API Key (Bearer Token)', type: 'password', placeholder: '3f6fb9ab-xxxx-xxxx (UUID格式)', required: true },
    ],
    supportsImageGeneration: true,
    supportsVideoGeneration: true,
  },
  {
    id: 'doubao-video',
    name: '豆包视频生成',
    description: '豆包视频生成 (使用豆包AI配置)',
    color: '#007AFF',
    authType: 'bearer',
    authFields: [
      { key: 'apiKey', label: 'API Key (Bearer Token)', type: 'password', placeholder: '3f6fb9ab-xxxx-xxxx (UUID格式)', required: true },
    ],
    supportsImageGeneration: false,
    supportsVideoGeneration: true,
  },
  {
    id: 'leonardoAI',
    name: 'Leonardo AI',
    description: 'Leonardo AI图片生成',
    color: '#10B981',
    authType: 'bearer',
    authFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '请输入API Key', required: true },
    ],
    supportsImageGeneration: true,
    supportsVideoGeneration: false,
  },
  {
    id: 'recraftAI',
    name: 'Recraft AI',
    description: 'Recraft AI图片生成',
    color: '#E91E63',
    authType: 'bearer',
    authFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '请输入API Key', required: true },
    ],
    supportsImageGeneration: true,
    supportsVideoGeneration: false,
  },
  {
    id: 'ideogram',
    name: 'Ideogram',
    description: 'Ideogram AI图片生成',
    color: '#00BCD4',
    authType: 'bearer',
    authFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '请输入API Key', required: true },
    ],
    supportsImageGeneration: true,
    supportsVideoGeneration: false,
  },
  {
    id: 'stabilityAI',
    name: 'Stability AI',
    description: 'Stability AI图片生成',
    color: '#795548',
    authType: 'bearer',
    authFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '请输入API Key', required: true },
    ],
    supportsImageGeneration: true,
    supportsVideoGeneration: false,
  },
  {
    id: 'openai',
    name: '第三方GPT',
    description: '兼容 GPT 模型接入',
    color: '#10A19D',
    authType: 'bearer',
    authFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '请输入 GPT 兼容接口 API Key', required: true },
    ],
    supportsImageGeneration: true,
    supportsVideoGeneration: false,
  },
  {
    id: 'anthropicClaude',
    name: '第三方Claude',
    description: '兼容 Claude 大模型接入',
    color: '#D4A574',
    authType: 'bearer',
    authFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '请输入 Claude 兼容接口 API Key', required: true },
    ],
    supportsImageGeneration: true,
    supportsVideoGeneration: false,
  },
  {
    id: 'googleGemini',
    name: 'Google Gemini',
    description: 'Google Gemini大模型',
    color: '#4285F4',
    authType: 'bearer',
    authFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '请输入Google API Key', required: true },
    ],
    supportsImageGeneration: true,
    supportsVideoGeneration: false,
  },
  {
    id: 'baiduWenxin',
    name: '百度文心一言',
    description: '百度文心大模型',
    color: '#2932E1',
    authType: 'bearer',
    authFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '请输入百度API Key', required: true },
    ],
    supportsImageGeneration: true,
    supportsVideoGeneration: false,
  },
  {
    id: 'aliyunQwen',
    name: '阿里云通义千问',
    description: '阿里云通义大模型',
    color: '#FF6A00',
    authType: 'bearer',
    authFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '请输入阿里云API Key', required: true },
    ],
    supportsImageGeneration: true,
    supportsVideoGeneration: false,
  },
  {
    id: 'haiper',
    name: 'Haiper AI',
    description: 'Haiper视频生成',
    color: '#6C63FF',
    authType: 'bearer',
    authFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '请输入Haiper API Key', required: true },
    ],
    supportsImageGeneration: false,
    supportsVideoGeneration: true,
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    description: 'MiniMax AI',
    color: '#00D4AA',
    authType: 'bearer',
    authFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '请输入MiniMax API Key', required: true },
    ],
    supportsImageGeneration: true,
    supportsVideoGeneration: true,
  },
  {
    id: 'hailuo',
    name: '海螺AI',
    description: '海螺视频生成',
    color: '#FF4081',
    authType: 'bearer',
    authFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '请输入海螺AI API Key', required: true },
    ],
    supportsImageGeneration: false,
    supportsVideoGeneration: true,
  },
  {
    id: 'adobe',
    name: 'Adobe Firefly',
    description: 'Adobe Firefly图片生成',
    color: '#FF0000',
    authType: 'bearer',
    authFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '请输入Adobe API Key', required: true },
    ],
    supportsImageGeneration: true,
    supportsVideoGeneration: false,
  },
  {
    id: 'flux',
    name: 'Flux AI',
    description: 'Flux图片生成',
    color: '#00BFFF',
    authType: 'bearer',
    authFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '请输入Flux API Key', required: true },
    ],
    supportsImageGeneration: true,
    supportsVideoGeneration: false,
  },
  {
    id: 'bytedance',
    name: '字节视频生成',
    description: '字节视频生成模型',
    color: '#FE2C55',
    authType: 'bearer',
    authFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '请输入字节API Key', required: true },
    ],
    supportsImageGeneration: false,
    supportsVideoGeneration: true,
  },
  {
    id: 'adobeFirefly',
    name: 'Adobe Firefly Video',
    description: 'Adobe Firefly视频生成',
    color: '#FF0000',
    authType: 'bearer',
    authFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '请输入Adobe API Key', required: true },
    ],
    supportsImageGeneration: false,
    supportsVideoGeneration: true,
  },
  {
    id: 'minimaxVideo',
    name: 'MiniMax Video',
    description: 'MiniMax视频生成',
    color: '#00D4AA',
    authType: 'bearer',
    authFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '请输入MiniMax API Key', required: true },
    ],
    supportsImageGeneration: false,
    supportsVideoGeneration: true,
  },
  {
    id: 'huawei',
    name: '华为云',
    description: '华为云大模型',
    color: '#D42428',
    authType: 'aksk',
    authFields: [
      { key: 'accessKey', label: 'Access Key', type: 'text', placeholder: '请输入华为云Access Key', required: true },
      { key: 'secretKey', label: 'Secret Key', type: 'password', placeholder: '请输入华为云Secret Key', required: true },
    ],
    supportsImageGeneration: true,
    supportsVideoGeneration: true,
  },
  {
    id: 'huaweiVideo',
    name: '华为云视频',
    description: '华为云视频生成',
    color: '#D42428',
    authType: 'aksk',
    authFields: [
      { key: 'accessKey', label: 'Access Key', type: 'text', placeholder: '请输入华为云Access Key', required: true },
      { key: 'secretKey', label: 'Secret Key', type: 'password', placeholder: '请输入华为云Secret Key', required: true },
    ],
    supportsImageGeneration: false,
    supportsVideoGeneration: true,
  },
  {
    id: 'vidu',
    name: 'Vidu',
    description: 'Vidu官方API，支持Q3/Q2/Q1全系列模型，文生视频/图生视频/首尾帧/参考视频',
    color: '#7C3AED',
    authType: 'bearer',
    authFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '请输入Vidu API Key', required: true },
      { key: 'baseUrl', label: 'Base URL', type: 'text', placeholder: '输入API Base URL', required: false },
    ],
    supportsImageGeneration: false,
    supportsVideoGeneration: true,
  },
  {
    id: 'openaiCompatible',
    name: 'OpenAI兼容接口',
    description: '支持OpenAI格式的兼容API',
    color: '#10A19D',
    authType: 'bearer',
    authFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '请输入API Key', required: true },
      { key: 'baseUrl', label: 'Base URL', type: 'text', placeholder: 'https://api.example.com/v1', required: true },
    ],
    supportsImageGeneration: true,
    supportsVideoGeneration: true,
  },
  {
    id: 'agnes',
    name: 'Agnes',
    description: 'Agnes 独立模型通道，支持 Agnes Image 与 Agnes Video',
    color: '#EC4899',
    authType: 'bearer',
    authFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '你的 Agnes API Key', required: true },
      { key: 'baseUrl', label: 'Base URL', type: 'text', placeholder: 'https://apihub.agnes-ai.com/v1', required: false },
    ],
    supportsImageGeneration: true,
    supportsVideoGeneration: true,
  },
  {
    id: 'sensenova',
    name: 'SenseNova',
    description: '轻量信息图生成 (2K分辨率, 11种比例)',
    color: '#7C3AED',
    authType: 'bearer',
    authFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '你的 SenseNova API密钥', required: true },
      { key: 'baseUrl', label: 'Base URL', type: 'text', placeholder: 'https://token.sensenova.cn/v1', required: false },
    ],
    supportsImageGeneration: true,
    supportsVideoGeneration: false,
  },
  {
    id: 'stepfun',
    name: 'StepFun',
    description: '高质量图片生成与语音模型',
    color: '#2563EB',
    authType: 'bearer',
    authFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '你的 StepFun API Key', required: true },
      { key: 'baseUrl', label: 'Base URL', type: 'text', placeholder: 'https://api.stepfun.com/step_plan/v1', required: false },
    ],
    supportsImageGeneration: true,
    supportsVideoGeneration: false,
  },
  {
    id: 'local',
    name: '本地模型',
    description: '本地部署的AI模型',
    color: '#6B7280',
    authType: 'custom',
    authFields: [
      { key: 'baseUrl', label: 'API 地址', type: 'text', placeholder: 'http://localhost:8000', required: true },
      { key: 'apiKey', label: 'API Key (可选)', type: 'password', placeholder: '可选', required: false },
    ],
    supportsImageGeneration: true,
    supportsVideoGeneration: false,
  },
];

// 向后兼容别名
export const DEFAULT_PROVIDER_CONFIGS: ProviderInfo[] = UNIFIED_DEFAULT_PROVIDER_CONFIGS;

// ==================== 统一连接状态类型 ====================
export interface UnifiedConnectionStatus {
  provider: UnifiedAPIProvider;
  status: 'connected' | 'disconnected' | 'error' | 'testing';
  lastChecked: Date;
  error?: string;
  responseTime?: number;
}

// 向后兼容别名
export type ConnectionStatus = UnifiedConnectionStatus;

// ==================== 统一任务状态类型 ====================
export type UnifiedTaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface UnifiedTask {
  id: string;
  type: string;
  status: UnifiedTaskStatus;
  progress: number;
  result?: unknown;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

// ==================== 统一错误类型 ====================
export class UnifiedAPIError extends Error {
  constructor(
    message: string,
    public code: string,
    public provider: UnifiedAPIProvider,
    public statusCode?: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'UnifiedAPIError';
  }
}

// ==================== 工具函数 ====================
/**
 * 根据provider获取默认配置
 */
export function getProviderConfig(provider: UnifiedAPIProvider): UnifiedProviderInfo | undefined {
  return UNIFIED_DEFAULT_PROVIDER_CONFIGS.find(p => p.id === provider);
}

/**
 * 检查provider是否支持图片生成
 */
export function supportsImageGeneration(provider: UnifiedAPIProvider): boolean {
  const config = getProviderConfig(provider);
  return config?.supportsImageGeneration ?? false;
}

/**
 * 检查provider是否支持视频生成
 */
export function supportsVideoGeneration(provider: UnifiedAPIProvider): boolean {
  const config = getProviderConfig(provider);
  return config?.supportsVideoGeneration ?? false;
}

// ==================== 统一核心State类型 ====================

/**
 * 统一任务状态接口
 */
export interface UnifiedTaskState {
  tasks: Record<string, UnifiedTask>;
  pendingTasks: string[];
  completedTasks: string[];
  failedTasks: string[];
}

/**
 * 统一错误状态接口
 */
export interface UnifiedErrorState {
  errors: Array<{
    id: string;
    code: string;
    message: string;
    provider?: UnifiedAPIProvider;
    timestamp: Date;
    context?: Record<string, unknown>;
  }>;
  hasErrors: boolean;
  errorCount: number;
}

/**
 * 统一面板状态接口
 */
export interface UnifiedPanelState {
  isOpen: boolean;
  isCollapsed: boolean;
  width?: number;
  height?: number;
  position?: { x: number; y: number };
  activeTab?: string;
}

/**
 * 统一预览状态接口
 */
export interface UnifiedPreviewState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
  muted: boolean;
  loop: boolean;
}

/**
 * 统一选择状态接口
 */
export interface UnifiedSelectionState {
  selectedIds: string[];
  lastSelectedId: string | null;
  selectionMode: 'single' | 'multiple' | 'range';
  selectionStart: number | null;
  selectionEnd: number | null;
}

/**
 * 统一历史状态接口
 */
export interface UnifiedHistoryState {
  past: unknown[];
  present: unknown;
  future: unknown[];
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * 统一配置状态接口
 */
export interface UnifiedConfigState {
  configs: Record<string, unknown>;
  activeConfigId: string | null;
  isDirty: boolean;
  lastSaved: Date | null;
}

/**
 * 统一播放状态接口
 */
export interface UnifiedPlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
  muted: boolean;
  loopStart: number | null;
  loopEnd: number | null;
}

// ==================== 统一Config类型 ====================

/**
 * 通用配置项接口
 */
export interface BaseConfigItem<T = unknown> {
  id: string;
  key: string;
  value: T;
  label?: string;
  description?: string;
  category?: string;
  isSecret?: boolean;
  isRequired?: boolean;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    options?: T[];
  };
}

/**
 * 统一配置存储接口
 */
export interface UnifiedConfigStore<T = unknown> {
  configs: Record<string, BaseConfigItem<T>>;
  activeProfile: string;
  profiles: string[];
  isDirty: boolean;
  lastSaved: Date | null;
}

/**
 * 请求配置接口
 */
export interface UnifiedRequestConfig {
  timeoutMs: number;
  maxRetries: number;
  baseRetryDelayMs: number;
  useCache: boolean;
  cacheTtlMs?: number;
  traceId?: string;
  taskId?: string;
}

/**
 * 缓存配置接口
 */
export interface UnifiedCacheConfig {
  enabled: boolean;
  maxSize: number;
  ttlMs: number;
  strategy: 'lru' | 'lfu' | 'fifo';
}

/**
 * 重试配置接口
 */
export interface UnifiedRetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableStatuses?: number[];
  retryableErrors?: string[];
}

/**
 * 熔断器配置接口
 */
export interface UnifiedCircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
  resetTimeoutMs: number;
}

/**
 * 通用Service配置接口
 */
export interface UnifiedServiceConfig {
  name: string;
  enabled: boolean;
  request?: Partial<UnifiedRequestConfig>;
  retry?: Partial<UnifiedRetryConfig>;
  circuitBreaker?: Partial<UnifiedCircuitBreakerConfig>;
  cache?: Partial<UnifiedCacheConfig>;
}

// 向后兼容类型别名
export type RequestConfig = UnifiedRequestConfig;
export type CacheConfig = UnifiedCacheConfig;
export type RetryConfig = UnifiedRetryConfig;
export type CircuitBreakerConfig = UnifiedCircuitBreakerConfig;

// ==================== 统一文件类型 ====================

/**
 * 统一文件项接口
 */
export interface UnifiedFileItem {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'other';
  mimeType: string;
  size: number;
  url?: string;
  thumbnailUrl?: string;
  duration?: number; // for video/audio
  width?: number; // for image/video
  height?: number; // for image/video
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

// ==================== 统一任务类型 ====================

/**
 * 统一生成任务接口
 */
export interface UnifiedGenerationTask {
  id: string;
  type: 'image' | 'video' | 'audio' | 'text';
  provider: UnifiedAPIProvider;
  status: UnifiedTaskStatus;
  progress: number;
  prompt: string;
  resultUrl?: string;
  resultUrls?: string[];
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
}

// ==================== 统一节点类型 ====================

/**
 * 统一工作流节点位置
 */
export interface UnifiedNodePosition {
  x: number;
  y: number;
}

/**
 * 统一工作流节点数据
 */
export interface UnifiedNodeData {
  label?: string;
  type?: string;
  [key: string]: unknown;
}

/**
 * 统一工作流节点
 */
export interface UnifiedNode {
  id: string;
  type: string;
  position: UnifiedNodePosition;
  data: UnifiedNodeData;
  width?: number;
  height?: number;
  selected?: boolean;
  dragging?: boolean;
}

/**
 * 统一工作流边
 */
export interface UnifiedEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
  animated?: boolean;
  style?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

// ==================== 统一API响应类型 ====================

/**
 * 统一API响应接口
 */
export interface UnifiedAPIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: Date;
}

/**
 * 统一分页响应接口
 */
export interface UnifiedPaginatedResponse<T = unknown> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
