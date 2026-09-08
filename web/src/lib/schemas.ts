/**
 * 输入验证 Schema
 * 使用 Zod 定义所有输入验证规则
 */

import { z } from 'zod';

/**
 * API 密钥配置验证
 */
export const APIKeyConfigSchema = z.object({
  access_key: z.string().optional(),
  secret_key: z.string().optional(),
  ak: z.string().optional(),
  sk: z.string().optional(),
  apiKey: z.string().optional(),
  modelId: z.string().optional(),
});

/**
 * 视频生成参数验证
 */
export const VideoGenerationParamsSchema = z.object({
  modelProvider: z.enum([
    'doubao', 'bytedance',
    'stability_ai',
    'minimax', 'adobe_firefly', 'leonardo_ai', 'ideogram', 'recraft_ai', 'seedream'
  ]),
  resolution: z.enum(['16:9', '9:16', '1:1', '4:3', '21:9']).optional(),
  duration: z.number().min(3).max(30).optional(),
  prompt: z.string().min(1).max(5000),
  negativePrompt: z.string().max(2000).optional(),
  startImage: z.string().url().optional(),
  endImage: z.string().url().optional(),
  referenceImage: z.string().url().optional(),
  motionStrength: z.number().min(0).max(1).optional(),
  videoMode: z.enum(['standard', 'high_quality', 'fast']).optional(),
  generationMode: z.enum(['text_to_video', 'image_to_video', 'first_last_frame']).optional(),
});

/**
 * 图片生成参数验证
 */
export const ImageGenerationParamsSchema = z.object({
  modelProvider: z.enum([
    'doubao', 'bytedance',
    'stability_ai',
    'minimax', 'adobe_firefly', 'leonardo_ai', 'ideogram', 'recraft_ai', 'seedream'
  ]),
  aspectRatio: z.enum(['1:1', '3:4', '4:3', '16:9', '9:16', '4:5']).optional(),
  prompt: z.string().min(1).max(5000),
  negativePrompt: z.string().max(2000).optional(),
  referenceImage: z.string().url().optional(),
  seed: z.number().optional(),
});

/**
 * Seedream 节点参数验证
 */
export const SeedreamParamsSchema = z.object({
  prompt: z.string().min(1).max(5000),
  negativePrompt: z.string().max(2000).optional(),
  seed: z.number().optional(),
  seedMode: z.enum(['fixed', 'random', 'increment']).optional(),
  cfgScale: z.number().min(1).max(20).optional(),
  steps: z.number().min(1).max(100).optional(),
});

/**
 * Seedream 配置验证
 */
export const SeedreamConfigSchema = z.object({
  size: z.enum(['512x512', '768x768', '1024x1024', '1024x768', '768x1024']).optional(),
  aspectRatio: z.enum(['1:1', '4:3', '3:4', '16:9', '9:16']).optional(),
  watermark: z.boolean().optional(),
});

/**
 * 豆包视频参数验证
 */
export const DoubaoVideoParamsSchema = z.object({
  prompt: z.string().min(1).max(5000),
  negativePrompt: z.string().max(2000).optional(),
  firstFrame: z.string().url().optional(),
  lastFrame: z.string().url().optional(),
  duration: z.number().min(3).max(10).optional(),
  mode: z.enum(['text_to_video', 'image_to_video', 'first_last_frame']).optional(),
});

/**
 * 节点数据验证
 */
export const VideoGenNodeDataSchema = z.object({
  type: z.literal('videoGen'),
  params: VideoGenerationParamsSchema.optional(),
  task: z.any().optional(),
  isExpanded: z.boolean().optional(),
});

export const ImageGenNodeDataSchema = z.object({
  type: z.union([z.literal('imageGen'), z.literal('unifiedImageStudio')]),
  params: ImageGenerationParamsSchema.optional(),
  task: z.any().optional(),
  isExpanded: z.boolean().optional(),
});

export const ImageInputNodeDataSchema = z.object({
  type: z.literal('imageInput'),
  imageUrl: z.string().url().optional(),
  fileName: z.string().optional(),
});

export const VideoInputNodeDataSchema = z.object({
  type: z.literal('videoInput'),
  videoUrl: z.string().url().optional(),
  fileName: z.string().optional(),
  startFrame: z.number().optional(),
  endFrame: z.number().optional(),
});

/**
 * 验证函数
 */
export function validateVideoParams(params: unknown) {
  return VideoGenerationParamsSchema.safeParse(params);
}

export function validateImageParams(params: unknown) {
  return ImageGenerationParamsSchema.safeParse(params);
}

export function validateSeedreamParams(params: unknown) {
  return SeedreamParamsSchema.safeParse(params);
}

export function validateDoubaoVideoParams(params: unknown) {
  return DoubaoVideoParamsSchema.safeParse(params);
}

/**
 * 验证并返回错误信息
 */
export function getValidationError(result: z.SafeParseReturnType<unknown, unknown>): string | null {
  if (!result.success) {
    return result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
  }
  return null;
}
