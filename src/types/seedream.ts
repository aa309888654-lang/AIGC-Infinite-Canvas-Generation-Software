// Doubao-Seedream-5.0-lite 模型类型定义

// 生成模式
export type SeedreamGenMode = 
  | 'text_to_image'           // 文本生成图像
  | 'single_image_to_image'   // 单图像风格迁移
  | 'multi_image_to_image'    // 多图像融合
  | 'sequential';             // 序列图像生成

// 尺寸预设 - 根据Python代码更新
export interface SizePreset {
  label: string;
  width: number;
  height: number;
  aspectRatio: string;
}

// 支持的宽高比 - 根据Python代码
export const SUPPORTED_ASPECT_RATIOS: Record<string, [number, number]> = {
  "1:1": [1024, 1024],
  "16:9": [1920, 1080],
  "9:16": [1080, 1920],
  "4:3": [1440, 1080],
  "3:4": [1080, 1440],
  "2.35:1": [1920, 816],
  "1:2.35": [816, 1920]
};

// 尺寸配置
export interface SeedreamSizeConfig {
  size: string;
  aspectRatio: string;
  width?: number;
  height?: number;
}

// 种子模式
export type SeedMode = 'random' | 'fixed';


// 参考图像
export interface ReferenceImage {
  id: string;
  url: string;
  base64?: string;
}

// 节点配置
export interface SeedreamNodeConfig {
  modelProvider: 'doubao';
  size: string;
  aspectRatio: string;
  watermark: boolean;
}

// 节点参数 - 根据Python代码更新
export interface SeedreamNodeParams {
  // 生成模式
  mode: SeedreamGenMode;
  // 提示词
  prompt: string;
  negativePrompt: string;
  // 参考图像
  referenceImages: ReferenceImage[];
  // 算法参数
  seed: number;
  seedMode: SeedMode;
  cfgScale: number;
  steps: number;
  // 图生图参数
  strength?: number; // 重绘强度 0-1
  // 生成数量
  numImages?: number; // 1-4张
}

// 节点数据
export interface SeedreamNodeData {
  type: 'seedream';
  genMode: SeedreamGenMode;
  config: SeedreamNodeConfig;
  params: SeedreamNodeParams;
  task?: {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    resultUrl?: string;
    resultUrls?: string[];
    seed?: number;
    generationTime?: number;
    error?: string;
  };
  isExpanded?: boolean;
}

// API 请求参数
export interface SeedreamRequestParams {
  prompt: string;
  negativePrompt?: string;
  generationMode: SeedreamGenMode;
  size: string;
  aspectRatio: string;
  watermark: boolean;
  image?: Array<{ url: string }>;
  seed: number;
  seedMode: SeedMode;
  cfgScale: number;
  steps: number;
  // 图生图重绘强度
  strength?: number;
  // 生成图片数量
  numImages?: number;
}

// API 响应
export interface SeedreamResponse {
  images: string[];
  seed: number;
  generationTime: number;
}

// 预设尺寸列表 - 根据Python代码更新
export const SIZE_PRESETS: SizePreset[] = [
  { label: '1:1 (1024×1024)', width: 1024, height: 1024, aspectRatio: '1:1' },
  { label: '16:9 (1920×1080)', width: 1920, height: 1080, aspectRatio: '16:9' },
  { label: '9:16 (1080×1920)', width: 1080, height: 1920, aspectRatio: '9:16' },
  { label: '4:3 (1440×1080)', width: 1440, height: 1080, aspectRatio: '4:3' },
  { label: '3:4 (1080×1440)', width: 1080, height: 1440, aspectRatio: '3:4' },
  { label: '2.35:1 (1920×816)', width: 1920, height: 816, aspectRatio: '2.35:1' },
  { label: '1:2.35 (816×1920)', width: 816, height: 1920, aspectRatio: '1:2.35' },
];

// 预设宽高比 - 根据Python代码更新
export const ASPECT_RATIOS = [
  { value: '1:1', label: '1:1' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '2.35:1', label: '2.35:1' },
  { value: '1:2.35', label: '1:2.35' },
];

// 默认配置
export const DEFAULT_SEEDREAM_CONFIG: SeedreamNodeConfig = {
  modelProvider: 'doubao',
  size: '2048x2048',
  aspectRatio: '1:1',
  watermark: true,
};

// 默认参数 - 根据Python代码更新
export const DEFAULT_SEEDREAM_PARAMS: SeedreamNodeParams = {
  mode: 'text_to_image',
  prompt: '',
  negativePrompt: '低质,模糊,变形,水印,文字,丑陋,畸变,多余肢体,过曝,欠曝',
  referenceImages: [],
  seed: -1,
  seedMode: 'random',
  cfgScale: 7.5, // Python代码默认值
  steps: 25,     // Python代码默认值
  strength: 0.6,  // Python代码默认值
  numImages: 1,   // Python代码默认值
};

// 模式描述
export const MODE_DESCRIPTIONS: Record<SeedreamGenMode, string> = {
  text_to_image: '通过文本提示词生成图像',
  single_image_to_image: '结合参考图像进行风格迁移',
  multi_image_to_image: '融合多张参考图像的风格特征',
  sequential: '生成具有叙事连贯性的系列图像',
};

// 模式图标
export const MODE_ICONS: Record<SeedreamGenMode, string> = {
  text_to_image: '📝',
  single_image_to_image: '🖼️',
  multi_image_to_image: '🎨',
  sequential: '🎬',
};

// 模式名称
export const MODE_NAMES: Record<SeedreamGenMode, string> = {
  text_to_image: '文生图',
  single_image_to_image: '图生图',
  multi_image_to_image: '多图融合',
  sequential: '序列生成',
};