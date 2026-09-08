import type { Agent, AgentCapability } from '@/agents/types';

/**
 * AI图片生成 Agent
 * 负责文生图、图生图、智能补全等图片生成相关节点开发
 */
export interface ImageGenConfig {
  model: string;
  style: string;
  aspectRatio: string;
  quality: 'standard' | 'high' | 'ultra';
}

export interface ImageGenCapability extends AgentCapability {
  models: string[];
  styles: string[];
  aspectRatios: string[];
}

export const IMAGE_GEN_MODELS = [
  { id: 'doubao-seedream-5-0-pro', name: '豆包 Seedream 5.0 Pro', provider: '字节跳动' },
  { id: 'doubao-seedream-5-0-lite', name: '豆包 Seedream 5.0 Lite', provider: '字节跳动' },
  { id: 'sensenova-u1-fast', name: 'SenseNova U1 Fast', provider: '商汤科技' },
  { id: 'step-image-edit-2', name: 'StepFun Image Edit 2', provider: '阶星辰' },
  { id: 'image-01', name: 'MiniMax Image-01', provider: 'MiniMax' },
  { id: 'agnes-image-2.1-flash', name: 'Agnes Image 2.1 Flash', provider: 'Agnes' },
] as const;

export const IMAGE_STYLES = [
  { id: 'photorealistic', name: '写实摄影', prompt: 'photorealistic, 8k, detailed' },
  { id: 'anime', name: '动漫风格', prompt: 'anime style, cel shading, vibrant colors' },
  { id: 'oil-painting', name: '油画', prompt: 'oil painting, masterpiece, brushwork' },
  { id: 'watercolor', name: '水彩', prompt: 'watercolor painting, fluid, artistic' },
  { id: 'digital-art', name: '数字艺术', prompt: 'digital art, illustration, detailed' },
  { id: 'cyberpunk', name: '赛博朋克', prompt: 'cyberpunk, neon lights, futuristic' },
  { id: 'fantasy', name: '奇幻', prompt: 'fantasy, magical, ethereal' },
  { id: 'portrait', name: '人像', prompt: 'portrait photography, professional lighting' },
] as const;

export const ASPECT_RATIOS = [
  { id: '1:1', label: '1:1 方形', width: 1024, height: 1024 },
  { id: '16:9', label: '16:9 宽屏', width: 1344, height: 768 },
  { id: '9:16', label: '9:16 竖屏', width: 768, height: 1344 },
  { id: '4:3', label: '4:3 标准', width: 1152, height: 896 },
  { id: '3:4', label: '3:4 竖版', width: 896, height: 1152 },
  { id: '21:9', label: '21:9 电影', width: 1536, height: 640 },
] as const;

export const createImageGenAgent = (): Agent => ({
  id: 'image-gen',
  name: 'AI图片生成 Agent',
  description: '专业的AI图片生成节点开发专家，支持文生图、图生图、智能补全等多种图片生成能力',
  version: '1.0.0',
  capabilities: [
    {
      type: 'text-to-image',
      description: '文字描述生成图片',
      models: IMAGE_GEN_MODELS.map(m => m.id),
    },
    {
      type: 'image-to-image',
      description: '参考图片生成新图',
      models: ['doubao-seedream-5-0-pro', 'step-image-edit-2'],
    },
    {
      type: 'inpainting',
      description: '智能局部重绘',
      models: ['doubao-seedream-5-0-pro', 'step-image-edit-2'],
    },
    {
      type: 'outpainting',
      description: '智能向外扩展',
      models: ['doubao-seedream-5-0-pro', 'doubao-seedream-5-0-lite'],
    },
    {
      type: 'style-transfer',
      description: '风格迁移',
      models: ['step-image-edit-2'],
    },
  ],
  tools: [
    'image-generation',
    'style-transfer',
    'image-edit',
    'background-remove',
    'face-enhance',
    'upscale',
    'image-to-prompt',
    'batch-generate',
  ],
  nodeTypes: [
    'imageInput',
    'unifiedImageStudio',
    'imageGen',
    'styleTransfer',
    'imageEdit',
    'inpaint',
    'outpaint',
  ],
  execute: async (input, _context) => {
    const { type, params } = input;

    switch (type) {
      case 'text-to-image':
        return generateTextToImage(params);
      case 'image-to-image':
        return generateImageToImage(params);
      case 'inpainting':
        return performInpainting(params);
      case 'outpainting':
        return performOutpainting(params);
      case 'style-transfer':
        return performStyleTransfer(params);
      default:
        throw new Error(`Unknown image generation type: ${type}`);
    }
  },
});

// 内部实现函数
async function generateTextToImage(params: Record<string, unknown>) {
  const { prompt, model, style, aspectRatio } = params;

  // 调用图片生成API
  const response = await fetch('/api/image/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model, style, aspectRatio }),
  });

  if (!response.ok) {
    throw new Error(`Image generation failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    success: true,
    imageUrl: data.imageUrl,
    thumbnailUrl: data.thumbnailUrl,
    generationId: data.id,
    prompt,
    model,
    style,
    aspectRatio,
  };
}

async function generateImageToImage(params: Record<string, unknown>) {
  const { prompt, sourceImage, model, strength } = params;

  const response = await fetch('/api/image/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, sourceImage, model, strength, mode: 'image-to-image' }),
  });

  const data = await response.json();
  return {
    success: true,
    imageUrl: data.imageUrl,
    sourceImage,
    model,
  };
}

async function performInpainting(params: Record<string, unknown>) {
  const { prompt, sourceImage, mask, model } = params;

  const response = await fetch('/api/image/inpaint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, sourceImage, mask, model }),
  });

  const data = await response.json();
  return {
    success: true,
    imageUrl: data.imageUrl,
    mask,
    model,
  };
}

async function performOutpainting(params: Record<string, unknown>) {
  const { prompt, sourceImage, direction, model } = params;

  const response = await fetch('/api/image/outpaint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, sourceImage, direction, model }),
  });

  const data = await response.json();
  return {
    success: true,
    imageUrl: data.imageUrl,
    direction,
    model,
  };
}

async function performStyleTransfer(params: Record<string, unknown>) {
  const { sourceImage, style, model } = params;

  const response = await fetch('/api/image/style-transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceImage, style, model }),
  });

  const data = await response.json();
  return {
    success: true,
    imageUrl: data.imageUrl,
    style,
    model,
  };
}

export default createImageGenAgent;
