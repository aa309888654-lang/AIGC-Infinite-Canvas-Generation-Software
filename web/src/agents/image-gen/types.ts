/**
 * AI图片生成 Agent 类型定义
 */

export interface ImageGenParams {
  prompt?: string;
  negativePrompt?: string;
  model?: string;
  style?: string;
  aspectRatio?: string;
  quality?: 'standard' | 'high' | 'ultra';
  seed?: number;
  steps?: number;
  guidance?: number;
  sourceImage?: string;
  mask?: string;
  strength?: number;
  direction?: 'left' | 'right' | 'up' | 'down' | 'all';
}

export interface ImageGenResult {
  success: boolean;
  imageUrl?: string;
  thumbnailUrl?: string;
  generationId?: string;
  error?: string;
  metadata?: {
    model: string;
    prompt: string;
    seed: number;
    steps: number;
    guidance: number;
    aspectRatio: string;
  };
}

export interface BatchGenerateParams {
  prompts: string[];
  model: string;
  style?: string;
  aspectRatio?: string;
  count?: number;
}

export interface BatchGenerateResult {
  success: boolean;
  results: ImageGenResult[];
  totalCount: number;
  successCount: number;
}

export interface ImageVariationParams {
  sourceImage: string;
  count: number;
  variationStrength?: number;
  model?: string;
}

export interface ImageUpscaleParams {
  sourceImage: string;
  scale: 2 | 4;
  model?: 'realesrgan' | 'gfpgan' | 'swinir';
}

export interface ImageEditParams {
  sourceImage: string;
  mask: string;
  prompt: string;
  model?: string;
  strength?: number;
}

export type ImageGenMode = 'text-to-image' | 'image-to-image' | 'inpainting' | 'outpainting' | 'style-transfer';

export interface StylePreset {
  id: string;
  name: string;
  nameEn: string;
  prompt: string;
  category: 'photography' | 'art' | 'anime' | '3d' | 'custom';
  sampleImages?: string[];
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'photorealistic',
    name: '写实摄影',
    nameEn: 'Photorealistic',
    prompt: 'photorealistic, 8k, ultra detailed, professional photography, studio lighting',
    category: 'photography',
  },
  {
    id: 'cinematic',
    name: '电影感',
    nameEn: 'Cinematic',
    prompt: 'cinematic, film grain, dramatic lighting, anamorphic, movie still',
    category: 'photography',
  },
  {
    id: 'anime',
    name: '动漫风格',
    nameEn: 'Anime Style',
    prompt: 'anime style, cel shading, vibrant colors, detailed illustration',
    category: 'anime',
  },
  {
    id: 'manga',
    name: '漫画风格',
    nameEn: 'Manga Style',
    prompt: 'manga style, black and white, comic art, ink drawing',
    category: 'anime',
  },
  {
    id: 'oil-painting',
    name: '油画',
    nameEn: 'Oil Painting',
    prompt: 'oil painting, masterpiece, classical art, renaissance style',
    category: 'art',
  },
  {
    id: 'watercolor',
    name: '水彩画',
    nameEn: 'Watercolor',
    prompt: 'watercolor painting, fluid, artistic, delicate brushwork',
    category: 'art',
  },
  {
    id: 'digital-art',
    name: '数字艺术',
    nameEn: 'Digital Art',
    prompt: 'digital art, illustration, detailed, vibrant, trending on artstation',
    category: 'art',
  },
  {
    id: 'cyberpunk',
    name: '赛博朋克',
    nameEn: 'Cyberpunk',
    prompt: 'cyberpunk, neon lights, futuristic, rain, city at night',
    category: 'custom',
  },
  {
    id: 'fantasy',
    name: '奇幻风格',
    nameEn: 'Fantasy',
    prompt: 'fantasy, magical, ethereal, mystical, epic',
    category: 'custom',
  },
  {
    id: 'portrait',
    name: '专业人像',
    nameEn: 'Portrait',
    prompt: 'portrait photography, professional lighting, sharp focus, detailed skin',
    category: 'photography',
  },
];

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  website?: string;
  apiEndpoint: string;
  maxResolution: number;
  supportsInpainting: boolean;
  supportsOutpainting: boolean;
  supportsStyleTransfer: boolean;
  pricing?: {
    perImage: number;
    currency: string;
  };
}

export const MODEL_INFO: Record<string, ModelInfo> = {
  'doubao-seedream-5-0-pro': {
    id: 'doubao-seedream-5-0-pro',
    name: '豆包 Seedream 5.0 Pro',
    provider: '字节跳动',
    apiEndpoint: '/api/providers/doubao/seedream-5-0-pro',
    maxResolution: 2048,
    supportsInpainting: true,
    supportsOutpainting: true,
    supportsStyleTransfer: false,
  },
  'doubao-seedream-5-0-lite': {
    id: 'doubao-seedream-5-0-lite',
    name: '豆包 Seedream 5.0 Lite',
    provider: '字节跳动',
    apiEndpoint: '/api/providers/doubao/seedream-5-0-lite',
    maxResolution: 1536,
    supportsInpainting: true,
    supportsOutpainting: true,
    supportsStyleTransfer: false,
  },
  'sensenova-u1-fast': {
    id: 'sensenova-u1-fast',
    name: 'SenseNova U1 Fast',
    provider: '商汤科技',
    apiEndpoint: '/api/providers/sensenova/u1-fast',
    maxResolution: 1024,
    supportsInpainting: false,
    supportsOutpainting: false,
    supportsStyleTransfer: false,
  },
  'step-image-edit-2': {
    id: 'step-image-edit-2',
    name: 'StepFun Image Edit 2',
    provider: '阶星辰',
    apiEndpoint: '/api/providers/stepfun/image-edit-2',
    maxResolution: 2048,
    supportsInpainting: true,
    supportsOutpainting: false,
    supportsStyleTransfer: true,
  },
  'image-01': {
    id: 'image-01',
    name: 'MiniMax Image-01',
    provider: 'MiniMax',
    apiEndpoint: '/api/providers/minimax/image-01',
    maxResolution: 1536,
    supportsInpainting: false,
    supportsOutpainting: false,
    supportsStyleTransfer: false,
  },
  'agnes-image-2.1-flash': {
    id: 'agnes-image-2.1-flash',
    name: 'Agnes Image 2.1 Flash',
    provider: 'Agnes',
    apiEndpoint: '/api/providers/agnes/image-2-1-flash',
    maxResolution: 2048,
    supportsInpainting: true,
    supportsOutpainting: true,
    supportsStyleTransfer: false,
  },
};
