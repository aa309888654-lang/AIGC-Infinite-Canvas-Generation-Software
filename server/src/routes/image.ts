import express, { Router, type NextFunction, type Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, type AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { unifiedApiService } from '../services/unified-service';
import { ImageParams, ApiProviderConfig } from '../types/api';
import { decryptProviderSecrets } from './ai-provider';
import { autoSaveService } from '../services/auto-save-service';
import { minioPublicStorageService } from '../services/minio-public-storage-service';
import storageService from '../services/storage-service';
import { ProviderKeyManager } from '../services/provider-key-manager';
import { getUserModelCredential } from '../services/user-model-credential-service';
import { promptLogService } from '../services/prompt-log-service';
import {
  fetchRemoteBuffer,
  fetchSafeRemoteResponse,
  isAllowedRemoteHostname,
} from '../utils/safe-remote-fetch';

/** 移除 AI 响应中的 &lt;think&gt;...&lt;/think&gt; 推理标签 */
function stripThinkingTags(text: string): string {
  if (!text) return text;
  return text.replace(/<\s*think\s*>[\s\S]*?<\s*\/\s*think\s*>/gi, '').trim();
}
import crypto from 'crypto';
import axios from 'axios';
import { getApiProviderConfig } from './ai-provider';
import { logger } from '../utils/logger';
import { config } from '../types/env';
import { enhancePromptForModel } from '../services/prompt-enhancer';
import { checkPromptSafetyForImageGeneration } from '../services/prompt-firewall';
import { resolveImageModelChannel } from '../services/model-channel-registry';
import {
  buildGenerationIdempotencyKey,
  buildReusedGenerationResponse,
  createIdempotentGenerationTask,
  isLocalIdempotencyTaskId,
} from '../services/generation-idempotency';
import { normalizeImageResultAssets } from '../services/image-result-normalizer';
import {
  buildActiveImageNodeTaskFilter,
  markImageTaskFailed,
} from '../services/image-node-task-guard';
import {
  resolveImageWatermarkOpacity,
  resolveWatermarkEnabled,
  safelyApplyImageWatermark,
} from '../services/watermark-service';
// SEC-AUDIT 修复：导入会员等级模型白名单校验，防止前端绕过会员等级限制调用 Pro 专属模型
import {
  isModelAllowedForMembership,
  isProviderAllowedForMembership,
  MembershipLevel,
} from './ai-provider-membership';

/**
 * SEC M-3 修复：图片/视频代理 CORS 加固。
 * 原 Access-Control-Allow-Origin: * 允许任意第三方网站通过本代理拉取白名单域名资源，
 * 存在开放代理滥用风险。改为仅允许配置的前端来源（config.allowedOrigins）。
 * - 生产环境：严格白名单匹配（支持通配符子域名）
 * - 开发环境：允许所有来源（与全局 CORS 配置一致）
 * - 无 Origin 头（同源/原生客户端）：不设置 ACAO 头，浏览器同源策略天然放行
 */
function applyProxyCors(req: express.Request, res: express.Response): void {
  if (config.nodeEnv !== 'production') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return;
  }
  const origin = req.headers.origin;
  if (!origin) {
    return;
  }
  const isAllowed = config.allowedOrigins.some((allowedOrigin) => {
    if (allowedOrigin.includes('*')) {
      const pattern = allowedOrigin.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
      return new RegExp(`^${pattern}$`).test(origin);
    }
    return origin === allowedOrigin;
  });
  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
}

export const imageRouter = Router();
// 图生图等接口可能接收 base64 data URL 作为 referenceImage，单独放宽 body 限制到 20mb
imageRouter.use(express.json({ limit: '20mb' }));
const MAX_IMAGE_GENERATION_COUNT = 10;
const IMAGE_PROXY_ALLOWED_HOSTS = [
  'volces.com',
  'aliyuncs.com',
  'minimax.com',
  'minimaxi.com',
  'hailuoai.com',
  'jianying.com',
  'bilibili.com',
  'huawei.com',
  'byteimg.com',
  'byteimg.cn',
  'bytecdn.cn',
  'bytedance.com',
  'bytedance.net',
  'tiktokcdn.com',
  'tiktokv.com',
  'snssdk.com',
  'douyinpic.com',
  'toutiao.com',
  'toutiaovod.com',
  'vlabstatic.com',
  'volccdn.com',
  'wuyinkeji.com',
  'doubaocdn.com',
  'vidu.cn',
  'sensecoreapi-oss.cn',
  'sensecoreapi.cn',
] as const;
const IMAGE_PROXY_MAX_BYTES = 250 * 1024 * 1024;

function getConfiguredPublicAssetHosts(): string[] {
  return [process.env.MINIO_PUBLIC_URL, process.env.BASE_URL, process.env.APP_BASE_URL]
    .map((value) => {
      try {
        return value ? new URL(value).hostname : '';
      } catch {
        return '';
      }
    })
    .filter(Boolean);
}

const WUYIN_ENDPOINT =
  process.env.WUYIN_BASE_URL || process.env.WUYINKEJI_BASE_URL || 'https://api.wuyinkeji.com';
const WUYIN_API_KEY = process.env.WUYIN_API_KEY || '';

/** Apply the capability contract saved with a custom API model before any provider call. */
function normalizeCustomImageCapabilities(
  request: Record<string, any>,
  modelConfig: Record<string, any>
): void {
  const supportedRatios = Array.isArray(modelConfig.supportedAspectRatios)
    ? modelConfig.supportedAspectRatios
        .map((value: unknown) => String(value).trim())
        .filter(Boolean)
    : [];
  const supportedSizes = Array.isArray(modelConfig.supportedResolutions)
    ? modelConfig.supportedResolutions
        .map((value: unknown) => String(value).trim().replace(/[×*]/g, 'x'))
        .filter(Boolean)
    : [];
  const defaults =
    modelConfig.defaultParams && typeof modelConfig.defaultParams === 'object'
      ? modelConfig.defaultParams
      : {};
  const requestedRatio = String(request.aspectRatio || '').trim();
  if (supportedRatios.length > 0 && !supportedRatios.includes(requestedRatio)) {
    request.aspectRatio = supportedRatios.includes(String(defaults.aspectRatio || ''))
      ? String(defaults.aspectRatio)
      : supportedRatios[0];
  }
  if (supportedSizes.length === 0) return;

  const requestedSize = String(request.size || request.imageSize || '')
    .trim()
    .replace(/[×*]/g, 'x');
  const selectedSize = supportedSizes.includes(requestedSize)
    ? requestedSize
    : supportedSizes.includes(String(defaults.imageSize || '').replace(/[×*]/g, 'x'))
      ? String(defaults.imageSize).replace(/[×*]/g, 'x')
      : supportedSizes[0];
  // Keep `size` and `imageSize` identical so no legacy value can win by precedence.
  request.size = selectedSize;
  request.imageSize = selectedSize;
}

const WUYIN_MODELS = [
  'Wan2.7_image',
  'Wan2.6',
];


function resolveApiyiProvider(model: string, requestedProvider?: string): string {
  if (requestedProvider === 'wuyinkeji') return 'wuyinkeji';
  const m = (model || '').toLowerCase();
  if (WUYIN_MODELS.some((w) => m === w.toLowerCase())) return 'wuyinkeji';
  return 'wuyinkeji';
}

export function resolveImageProviderModelPair(
  provider: string,
  model: string
): { provider: string; model: string } {
  const resolvedChannel = resolveImageModelChannel(provider, model);
  if (resolvedChannel?.channel.enabled) {
    return {
      provider: resolvedChannel.provider,
      model: resolvedChannel.model,
    };
  }

  // 去除模型名中的 provider 前缀（如 "wuyinkeji-Wan2.7_image" -> "Wan2.7_image"）
  const PROVIDER_PREFIXES = [
    'wuyinkeji-',
    'agnes-',
    'stepfun-',
    'sensenova-',
    'doubao-',
    'minimax-',
    'seedream-',
    'vidu-',
    'deepseek-',
  ];
  let cleanModel = String(model || '');
  const lowerModel = cleanModel.toLowerCase();
  for (const prefix of PROVIDER_PREFIXES) {
    if (lowerModel.startsWith(prefix)) {
      cleanModel = cleanModel.slice(prefix.length);
      break;
    }
  }

  return { provider, model: cleanModel };
}

function resolveImagePixelResolution(
  value?: string
): '1K' | '720p' | '1080p' | '2K' | '4K' | undefined {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!normalized) return undefined;
  if (normalized === '1k') return '1K';
  if (normalized === '720p') return '720p';
  if (normalized === '1080p') return '1080p';
  if (normalized === '2k') return '2K';
  if (normalized === '4k') return '4K';

  const match = normalized.match(/^(\d{3,5})x(\d{3,5})$/);
  if (!match) return undefined;
  const width = Number(match[1]);
  const height = Number(match[2]);
  const maxSide = Math.max(width, height);

  if (maxSide >= 3840) return '4K';
  if (maxSide >= 2048) return '2K';
  if (maxSide >= 1920) return '1080p';
  if (maxSide >= 1280) return '720p';
  return '1K';
}

function resolveImageAspectRatio(aspectRatio?: string, resolution?: string): string {
  const ratio = String(aspectRatio || '').trim();
  if (ratio && /^\d+:\d+$/.test(ratio)) return ratio;

  const match = String(resolution || '')
    .trim()
    .match(/^(\d{3,5})x(\d{3,5})$/);
  if (!match) return ratio || '1:1';

  const width = Number(match[1]);
  const height = Number(match[2]);
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height) || 1;
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

function parseImageTaskOutput(
  outputResult?: any
): { url?: string; imageUrl?: string; urls?: string[]; metadata?: Record<string, unknown> } | null {
  if (!outputResult) return null;
  try {
    const result = typeof outputResult === 'string' ? JSON.parse(outputResult) : outputResult;
    if (!result || typeof result !== 'object') return null;
    return result as {
      url?: string;
      imageUrl?: string;
      urls?: string[];
      metadata?: Record<string, unknown>;
    };
  } catch (e) {
    return null;
  }
}

async function applyRequestedImageWatermark(
  output: {
    url?: string;
    imageUrl?: string;
    urls?: string[];
    metadata?: Record<string, unknown>;
  } | null,
  options: {
    enabled: boolean;
    userId: string;
    taskId: string;
    source?: string;
  }
) {
  if (!output || !options.enabled) return output;

  const opacity = resolveImageWatermarkOpacity(options.source);
  const candidates = [output.url, output.imageUrl, ...(output.urls || [])].filter(
    (url): url is string => typeof url === 'string' && url.trim().length > 0
  );
  const uniqueUrls = Array.from(new Set(candidates));
  const watermarkedUrls = await Promise.all(
    uniqueUrls.map((url, index) =>
      safelyApplyImageWatermark(url, options.userId, {
        opacity,
        outputKey: `${options.taskId}-${index + 1}`,
      })
    )
  );
  const replacements = new Map(uniqueUrls.map((url, index) => [url, watermarkedUrls[index]]));
  const replace = (url?: string) => (url ? replacements.get(url) || url : url);
  const nextUrls = (output.urls || uniqueUrls).map((url) => replace(url) || url);

  return {
    ...output,
    url: replace(output.url || output.imageUrl || nextUrls[0]),
    imageUrl: replace(output.imageUrl || output.url || nextUrls[0]),
    urls: nextUrls,
    metadata: {
      ...(output.metadata || {}),
      watermark: {
        applied: true,
        position: 'bottom-right',
        opacity,
      },
    },
  };
}

function getImageMimeFromBuffer(buffer: Buffer): { mimeType: string; ext: string } | null {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { mimeType: 'image/png', ext: 'png' };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: 'image/jpeg', ext: 'jpg' };
  }
  if (buffer.length >= 6 && buffer.subarray(0, 3).toString('ascii') === 'GIF') {
    return { mimeType: 'image/gif', ext: 'gif' };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mimeType: 'image/webp', ext: 'webp' };
  }
  return null;
}

function extractImageBase64(
  value?: string
): { base64: string; mimeType?: string; ext?: string } | null {
  const source = String(value || '').trim();
  if (!source) return null;

  const dataUrlMatch = source.match(/^data:image\/([a-z0-9.+-]+);base64,([\s\S]+)$/i);
  if (dataUrlMatch?.[2]) {
    const ext = dataUrlMatch[1].toLowerCase() === 'jpeg' ? 'jpg' : dataUrlMatch[1].toLowerCase();
    return {
      base64: dataUrlMatch[2].replace(/\s/g, ''),
      mimeType: `image/${dataUrlMatch[1].toLowerCase()}`,
      ext,
    };
  }

  if (/^(https?:|blob:|file:|\/uploads\/)/i.test(source)) return null;
  const compact = source.replace(/\s/g, '');
  if (compact.length < 256 || !/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return null;
  if (!/^(iVBORw0KGgo|\/9j\/|R0lGOD|UklGR)/.test(compact)) return null;

  return { base64: compact };
}

function saveGeneratedImageBase64(userId: string, value: string): string | null {
  const extracted = extractImageBase64(value);
  if (!extracted) return null;

  const buffer = Buffer.from(extracted.base64, 'base64');
  const detected = getImageMimeFromBuffer(buffer);
  if (!detected && !extracted.mimeType) return null;

  const ext = detected?.ext || extracted.ext || 'png';
  const uploadDir = path.join(
    process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'),
    'images',
    userId
  );
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 12);
  const filename = `ai_image_${hash}.${ext}`;
  const targetPath = path.join(uploadDir, filename);
  if (!fs.existsSync(targetPath)) {
    fs.writeFileSync(targetPath, buffer);
  }

  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3200}`;
  return `${baseUrl}/uploads/images/${userId}/${filename}`;
}

async function normalizeGeneratedImageResult(result: any, userId: string): Promise<any> {
  if (!result || typeof result !== 'object') return result;

  const normalized = { ...result };
  const savedByPayload = new Map<string, string>();
  const normalizeOne = (value?: string): string | undefined => {
    if (!value) return value;
    const extracted = extractImageBase64(value);
    if (!extracted) return value;
    const payloadHash = crypto.createHash('sha256').update(extracted.base64).digest('hex');
    const cached = savedByPayload.get(payloadHash);
    if (cached) return cached;
    const savedUrl = saveGeneratedImageBase64(userId, value);
    if (savedUrl) {
      savedByPayload.set(payloadHash, savedUrl);
      logger.info(`[Image] 生成结果 base64 已落盘: ${savedUrl}`);
      return savedUrl;
    }
    return value;
  };

  const normalizedUrls = Array.isArray(normalized.urls)
    ? normalized.urls
        .map((url: unknown) => (typeof url === 'string' ? normalizeOne(url) : url))
        .filter(Boolean)
    : undefined;

  normalized.url = normalizeOne(normalized.url || normalized.imageUrl || normalizedUrls?.[0]);
  normalized.imageUrl = normalizeOne(normalized.imageUrl || normalized.url);
  if (normalizedUrls?.length) {
    normalized.urls = normalizedUrls;
  } else if (normalized.url) {
    normalized.urls = [normalized.url];
  }

  normalized.metadata = sanitizeGeneratedImageMetadata(normalized.metadata);
  return normalized;
}

function sanitizeGeneratedImageMetadata(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[omitted-deep-metadata]';
  if (typeof value === 'string') {
    const extracted = extractImageBase64(value);
    if (extracted) {
      return `[omitted-base64-image:${Math.round(extracted.base64.length / 1024)}KB]`;
    }
    if (value.length > 20000) {
      return `[omitted-large-string:${value.length}]`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeGeneratedImageMetadata(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      sanitizeGeneratedImageMetadata(item, depth + 1),
    ]);
    return Object.fromEntries(entries);
  }
  return value;
}

// 图片生成请求验证
const generateImageSchema = z
  .object({
    prompt: z.string().min(1, 'Prompt is required'),
    negativePrompt: z.string().optional(),
    aspectRatio: z.string().optional().default('1:1'),
    resolution: z.string().optional(),
    size: z.string().optional(),
    imageSize: z.string().optional(),
    pixelResolution: z.string().optional(),
    quality: z.string().optional().default('standard'),
    style: z.string().optional(),
    referenceImage: z.string().optional(),
    referenceImages: z.array(z.string()).optional(),
    editSourceImages: z.array(z.string()).optional(),
    lockReferenceSubject: z.boolean().optional(),
    maskImageUrl: z.string().optional(),
    generationMode: z.string().optional(),
    characterConsistency: z.number().min(0).max(1).optional(),
    provider: z.string().optional().default('minimax'),
    model: z.string().optional(),
    imageCount: z.coerce.number().int().min(1).max(MAX_IMAGE_GENERATION_COUNT).optional(),
    n: z.coerce.number().int().min(1).max(MAX_IMAGE_GENERATION_COUNT).optional(),
    promptOptimizer: z.boolean().optional(),
    webSearch: z.boolean().optional(),
    seedreamCapability: z.string().optional(),
    seedreamOptimizeMode: z.enum(['standard', 'fast']).optional(),
    sequentialImageGeneration: z.enum(['auto', 'disabled']).optional(),
    sequentialMaxImages: z.coerce.number().int().min(1).max(15).optional(),
    outputFormat: z.enum(['jpeg', 'png']).optional(),
    seed: z.number().optional(),
    steps: z.number().optional(),
    cfgScale: z.number().optional(),
    strength: z.number().optional(),
    hdMode: z.boolean().optional(),
    gptQuality: z.enum(['auto', 'low', 'medium', 'high', 'standard', 'hd']).optional(),
    gptOutputFormat: z.enum(['png', 'jpeg', 'webp']).optional(),
    gptBackground: z.enum(['auto', 'transparent', 'opaque']).optional(),
    gptCompression: z.number().min(0).max(100).optional(),
    gptOutputCompression: z.number().min(0).max(100).optional(),
    moderation: z.enum(['auto', 'low']).optional(),
    useEditEndpointWhenReferenceExists: z.boolean().optional(),
    providerExtensions: z
      .object({
        seed: z.number().optional(),
        thinking: z.enum(['off', 'low', 'medium', 'high']).optional(),
        providerRaw: z.record(z.unknown()).optional(),
      })
      .optional(),
    background: z.string().optional(),
    vipSize: z.string().optional(),
    watermark: z.boolean().optional(),
    source: z.string().optional(),
    promptEnhancer: z.boolean().optional(),
    gptImageQuality: z.enum(['auto', 'low', 'medium', 'high']).optional(),
    gptImageStyle: z.string().optional(),
    thinkingLevel: z.enum(['minimal', 'low', 'medium', 'high']).optional(),
    fluxFormat: z.enum(['jpeg', 'png']).optional(),
    fluxSafety: z.number().optional(),
    fluxSeed: z.number().optional(),
    maskMode: z.string().optional(),
    expandDirection: z.string().optional(),
    expandPixels: z.number().optional(),
    upscaleEngine: z.string().optional(),
    stylePreset: z.string().optional(),
    variationCount: z.number().optional(),
    backgroundMode: z.string().optional(),
    nodeId: z.string().optional(),
  })
  .passthrough();

/**
 * @swagger
 * /api/image/generate:
 *   post:
 *     summary: 生成图片
 *     description: 使用 AI 模型生成图片
 *     tags: [AI 生成]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               prompt:
 *                 type: string
 *                 description: 生成提示词 *
               aspectRatio:
 *                 type: string
 *                 description: 宽高比 *
               quality:
 *                 type: string
 *                 description: 质量等级
 *               style:
 *                 type: string
 *                 description: 风格
 *               referenceImages:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 参考图小天API生成完成但未返回有效图片URL 列表
 *               generationMode:
 *                 type: string
 *                 description: 生成模式
 *               provider:
 *                 type: string
 *                 description: 服务提供商 *
               model:
 *                 type: string
 *                 description: 模型 ID
 *     responses:
 *       200:
 *         description: 生成成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     taskId:
 *                       type: string
 *                     status:
 *                       type: string
 *                     resultUrl:
 *                       type: string
 *                     points:
 *                       type: number
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权 *
       500:
 *         description: 服务器错误 */
imageRouter.post(
  '/generate',
  authenticate,
  async (req, res, next) => {
    let activeImageTaskId: string | undefined;
    try {
      const validatedData = generateImageSchema.parse(req.body);
      const removedImageModelIds = new Set([
        'sensenova-u1-fast',
        'step-image-edit-2',
        'agnes-image-2.1-flash',
      ]);
      const requestedModelId = String(validatedData.model || '').trim().toLowerCase();
      const requestedProviderId = String(validatedData.provider || '').trim().toLowerCase();
      if (
        removedImageModelIds.has(requestedModelId) ||
        ['agnes', 'sensenova', 'stepfun'].includes(requestedProviderId)
      ) {
        return res.status(400).json({
          success: false,
          error: '所选图片模型已下线，请选择当前可用的图片模型',
          code: 'MODEL_REMOVED',
        });
      }

      // SEC-AUDIT 修复：会员等级模型白名单校验，防止前端绕过调用 Pro 专属模型
      const membershipLevel = (req.membershipLevel || 'trial') as MembershipLevel;
      const watermarkEnabled = resolveWatermarkEnabled(validatedData.watermark, membershipLevel);
      // 固化本次任务的水印选择，避免任务执行期间会员等级变化导致结果不一致。
      validatedData.watermark = watermarkEnabled;
      const requestModel = validatedData.model || '';
      const requestProvider = validatedData.provider || '';
      const isCustomProviderRequest = requestProvider.startsWith('custom-image-');
      if (
        requestModel &&
        !isCustomProviderRequest &&
        !isModelAllowedForMembership(requestModel, membershipLevel)
      ) {
        return res
          .status(403)
          .json({ success: false, error: '当前会员等级无权使用该模型', code: 'MODEL_NOT_ALLOWED' });
      }
      if (
        requestProvider &&
        !isCustomProviderRequest &&
        !isProviderAllowedForMembership(requestProvider, membershipLevel)
      ) {
        return res.status(403).json({
          success: false,
          error: '当前会员等级无权使用该服务商',
          code: 'PROVIDER_NOT_ALLOWED',
        });
      }

      // 提示词内容安全审核：图片生成入口兜底检测，海报场景也必须拦截违规提示词
      const safetyResult = checkPromptSafetyForImageGeneration(
        validatedData.prompt,
        validatedData.source
      );
      if (!safetyResult.passed) {
        logger.warn(
          `[prompt-firewall] 图片生成提示词被拦截: category=${safetyResult.category}, keyword=${safetyResult.matchedKeyword}, userId=${req.userId}`
        );
        return res.status(400).json({
          success: false,
          error: `${safetyResult.message}（命中关键词：${safetyResult.matchedKeyword}）`,
          code: 'PROMPT_VIOLATION',
          category: safetyResult.category,
          matchedKeyword: safetyResult.matchedKeyword,
        });
      }
      const nodeId = validatedData.nodeId;
      if (nodeId) {
        // BUG-8 同步修复：使用 JSON 精确匹配 `"nodeId":"xxx"` 替代字符串 contains，
        // 避免 nodeId="n1" 误匹配到 "n10"/"n11" 等子串
        const existingTask = await prisma.task.findFirst({
          where: buildActiveImageNodeTaskFilter(req.userId!, nodeId),
          select: { id: true, status: true, createdAt: true },
        });
        if (existingTask) {
          return res.status(429).json({
            success: false,
            error: '该节点已有正在进行的图片生成任务，请等待完成后再试',
            data: { taskId: existingTask.id, status: existingTask.status },
          });
        }
      }

      // 自动保存提示词
      promptLogService
        .create({
          userId: req.userId || undefined,
          prompt: validatedData.prompt || '',
          negativePrompt: validatedData.negativePrompt || '',
          model: validatedData.model || '',
          provider: validatedData.provider || '',
          type: 'image',
          source: 'ai-view',
          ipAddress: req.ip || req.socket?.remoteAddress,
          userAgent: req.headers['user-agent'] as string,
        })
        .catch(() => {});

      // 通知：任务开始
      const { websocketPushService } = await import('../services/websocket-push-service');
      websocketPushService.notifyTaskProgress(req.userId!, 'pending', 0).catch(() => {});

      // 检查用户
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { isActive: true },
      });

      if (!user || !user.isActive) {
        throw new AppError('用户不存在或未激活', 404);
      }

      let providerName = validatedData.provider || 'minimax';
      let modelName = validatedData.model || '';
      if (providerName === 'ai-node-router') {
        throw new AppError('智能轮换已下线，请选择当前可用的图片模型', 400);
      }
      // Storyboard requests use the single retained Doubao image model.
      const forceStoryboardDoubaoSeedreamOnly =
        validatedData.source === 'storyboard-maker-single-sheet';
      if (forceStoryboardDoubaoSeedreamOnly) {
        providerName = 'doubao';
        modelName = 'doubao-seedream-5-0-lite';
        validatedData.provider = providerName;
        validatedData.model = modelName;
      }
      const requestedProviderName = providerName;
      const requestedModelName = modelName;
      let providerFallback: null | {
        requestedProvider: string;
        requestedModel: string;
        actualProvider: string;
        actualModel: string;
        reason: string;
      } = null;
      const markProviderFallback = (reason: string) => {
        if (providerName === requestedProviderName && modelName === requestedModelName) return;
        providerFallback = {
          requestedProvider: requestedProviderName,
          requestedModel: requestedModelName,
          actualProvider: providerName,
          actualModel: modelName,
          reason,
        };
      };

      const resolvedPair = resolveImageProviderModelPair(providerName, modelName);
      if (resolvedPair.provider !== providerName || resolvedPair.model !== modelName) {
        logger.info(
          `[Image] provider/model 校正: ${providerName}/${modelName || 'default'} -> ${resolvedPair.provider}/${resolvedPair.model || 'default'}`
        );
        providerName = resolvedPair.provider;
        validatedData.model = resolvedPair.model;
        modelName = resolvedPair.model;
        markProviderFallback('provider/model normalized by backend');
      }

      const hasReferenceInput = Boolean(
        validatedData.referenceImage ||
        (validatedData.referenceImages?.length || 0) > 0 ||
        (validatedData.editSourceImages?.length || 0) > 0
      );
      void hasReferenceInput;

      if (providerName === 'liblib') {
        throw new AppError('图片模型通道已下线，请选择当前可用的图片模型', 400);
      }

      const needsCharacterConsistency = validatedData.generationMode === 'character_reference';

      if (
        providerName === 'wuyinkeji'
      ) {
        const resolvedProvider = resolveApiyiProvider(modelName, providerName);
        const cfg = await prisma.providerConfig.findUnique({
          where: { provider: resolvedProvider },
        });
        const keyPool = await ProviderKeyManager.getActiveKeysForModel(
          resolvedProvider,
          modelName || resolvedProvider
        );
        const hasKeyPool = keyPool.some((item) => !!item.apiKey);
        const hasEnvFallback =
          (resolvedProvider === 'wuyinkeji' && !!WUYIN_API_KEY);
        logger.info(
          `[Image] provider解析: requested=${providerName}, model=${modelName}, resolved=${resolvedProvider}, cfgActive=${cfg?.isActive}, cfgHasApiKey=${!!cfg?.apiKey}, hasKeyPool=${hasKeyPool}, hasEnvFallback=${hasEnvFallback}`
        );
        if ((cfg?.isActive && cfg.apiKey) || hasKeyPool || hasEnvFallback) {
          providerName = resolvedProvider;
          logger.info(`[Image] ${validatedData.provider}/${modelName} -> ${resolvedProvider}`);
        } else {
          throw new AppError(
            `${resolvedProvider} 通道不可用，请配置对应的 API Key 或在管理后台启用该服务商`,
            400
          );
        }
      }

      if (providerName === 'doubao') {
        if (modelName.includes('seedream')) {
          logger.info(
            `[Image] Seedream 图片模型: ${modelName}，角色一致性 ${needsCharacterConsistency}，保留doubao provider`
          );
        } else {
          throw new AppError(
            'Doubao 非 Seedream 图片模型暂不支持，请使用 doubao-seedream-5-0-pro',
            400
          );
        }
      }

      // 获取 provider 配置
      let providerConfig = await prisma.providerConfig.findUnique({
        where: { provider: providerName },
      });

      if (
        (!providerConfig || !providerConfig.isActive) &&
        providerName === 'wuyinkeji' &&
        WUYIN_API_KEY
      ) {
        providerConfig = {
          id: 'wuyinkeji-env',
          provider: 'wuyinkeji',
          name: '小天1',
          displayName: '小天1',
          description: '小天1 图片生成',
          apiKey: WUYIN_API_KEY,
          apiSecret: null,
          endpoint: WUYIN_ENDPOINT,
          isActive: true,
          supportedModes: JSON.stringify(['text_to_image', 'image_to_image', 'inpainting']),
          models: JSON.stringify(WUYIN_MODELS),
          config: null,
          rateLimit: null,
          priority: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as unknown as typeof providerConfig;
      }

      if (!providerConfig || !providerConfig.isActive) {
        throw new AppError(`AI 服务商 ${providerName} 不可用`, 400);
      }

      const runtimeProviderConfig = (() => {
        try {
          return typeof providerConfig.config === 'string'
            ? JSON.parse(providerConfig.config)
            : providerConfig.config || {};
        } catch {
          return {};
        }
      })();
      const isCustomProvider = runtimeProviderConfig?.isCustomModel === true;
      if (providerName.startsWith('custom-image-') && !isCustomProvider) {
        throw new AppError('个人自定义图片模型配置无效', 400);
      }
      if (isCustomProvider && runtimeProviderConfig.createdByUserId !== req.userId) {
        throw new AppError('无权使用该用户自定义模型', 403);
      }
      if (isCustomProvider && runtimeProviderConfig.mediaType !== 'image') {
        throw new AppError('该自定义模型不是图片模型', 400);
      }
      const customModel =
        isCustomProvider && Array.isArray(runtimeProviderConfig.models)
          ? runtimeProviderConfig.models.find(
              (item: any) => String(item?.id || item) === String(validatedData.model || modelName)
            )
          : undefined;
      const rawCustomUpstreamModel =
        typeof customModel === 'object' ? String(customModel.providerModel || '').trim() : '';
      // 自定义模型直接使用用户在表单中填写的上游模型 ID。
      const customUpstreamModel = rawCustomUpstreamModel || undefined;
      const isCustomImageProvider = Boolean(isCustomProvider && customUpstreamModel);
      if (isCustomProvider && !isCustomImageProvider) {
        throw new AppError('用户自定义图片模型配置不完整', 400);
      }
      if (isCustomImageProvider && customModel && typeof customModel === 'object') {
        normalizeCustomImageCapabilities(validatedData as Record<string, any>, customModel);
      }
      // 自定义 provider 是用户配置/凭据的定位符，不是 UnifiedApiService 中可执行的
      // provider 名。执行、任务状态与失败记录都必须使用已注册的兼容协议适配器，
      // 否则异步任务会把 custom-image-model-* 当作实际服务商并报 “Provider not found”。
      const executionProviderName = isCustomImageProvider ? 'openaiCompatible' : providerName;

      const idempotencyKey = buildGenerationIdempotencyKey({
        userId: req.userId!,
        route: 'image.generate',
        body: validatedData as Record<string, unknown>,
        nodeId: validatedData.nodeId,
        // The 60-second node guard handles duplicate clicks. Once it permits a
        // retry, the retry must create an independent task, including after failure.
        clientRequestId: validatedData.nodeId ? crypto.randomUUID() : undefined,
      });
      const idempotentTask = await createIdempotentGenerationTask(idempotencyKey, {
        userId: req.userId!,
        type: 'image',
        prompt: validatedData.prompt,
        provider: executionProviderName,
        model: validatedData.model || 'default',
        status: 'pending',
        params: JSON.stringify({
          ...validatedData,
          configuredProvider: providerName,
          executionProvider: executionProviderName,
        }),
        progress: 0,
      });
      if (idempotentTask.reused) {
        return res.status(202).json({
          success: true,
          data: buildReusedGenerationResponse(idempotentTask.task),
        });
      }
      const task = idempotentTask.task;
      activeImageTaskId = task.id;

      // 构建 AI API 配置（优先使用多密钥轮换机制）
      const personalCredential = await getUserModelCredential(req.userId!, providerName);
      const secrets = isCustomImageProvider
        ? { apiKey: undefined, apiSecret: undefined }
        : decryptProviderSecrets(providerConfig);

      let apiKey: string | undefined;
      let activeKeyId: string | undefined;
      if (isCustomImageProvider) {
        apiKey = personalCredential?.apiKey || personalCredential?.accessKey;
      } else {

        const modelScopedKeys = await ProviderKeyManager.getActiveKeysForModel(
          providerName,
          validatedData.model || modelName || providerName
        );
        const activeModelKey = modelScopedKeys.find((item) => !!item.apiKey);
        // ProviderConfig 中的历史空字符串不应阻止模型专用环境密钥生效。
        apiKey =
          personalCredential?.apiKey ||
          personalCredential?.accessKey ||
          activeModelKey?.apiKey ||
          secrets.apiKey ||
          undefined;
        activeKeyId = activeModelKey?.id;
      }
      if (!apiKey) {
        throw new AppError(`${providerName} API Key 未配置或解密失败`, 400);
      }
      logger.info(
        `[Image] provider=${providerName}, model=${validatedData.model || modelName || 'default'}, keySource=${isCustomImageProvider ? 'UserVault' : activeKeyId ? 'ProviderApiKey(pool)' : 'ProviderConfig/env'}, keyId=${activeKeyId || 'none'}`
      );
      const apiConfig: ApiProviderConfig = {
        apiKey,
        apiSecret: isCustomImageProvider
          ? personalCredential?.apiSecret || personalCredential?.secretKey
          : personalCredential?.apiSecret ||
            personalCredential?.secretKey ||
            secrets.apiSecret ||
            undefined,
        endpoint: isCustomImageProvider
          ? personalCredential?.baseUrl
          : personalCredential?.baseUrl || providerConfig.endpoint || undefined,
        compatibilityMode: isCustomImageProvider
          ? runtimeProviderConfig.compatibilityMode || 'openai-image'
          : undefined,
      };

      // 处理参考图：保持图1/图2顺序，去重后逐张转换为远程 API 可访问的 URL。
      const normalizeReferenceImageUrl = async (rawUrl: string, index: number): Promise<string> => {
        let nextUrl = rawUrl.trim();
        if (!nextUrl) return nextUrl;

        if (nextUrl.startsWith('data:')) {
          try {
            const base64Match = nextUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
            if (base64Match?.[2]) {
              const ext =
                base64Match[1] === 'png' ? 'png' : base64Match[1] === 'gif' ? 'gif' : 'jpg';
              const buffer = Buffer.from(base64Match[2], 'base64');
              const filename = `ref_${Date.now()}_${index + 1}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
              logger.info(
                `[Image] 参考图${index + 1} base64 大小: ${(buffer.length / 1024).toFixed(1)}KB, 保存到本地...`
              );
              const uploadDir = path.join(
                process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'),
                'references',
                req.userId!
              );
              if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
              }
              const localPath = path.join(uploadDir, filename);
              fs.writeFileSync(localPath, buffer);
              const baseUrl =
                process.env.BASE_URL || `http://localhost:${process.env.PORT || 3200}`;
              const savedUrl = `${baseUrl}/uploads/references/${req.userId!}/${filename}`;

              // 优先尝试上传到 MinIO 获取公网/预签名 URL（远程 API 需要可访问的 URL）。
              let objectUploadSuccess = false;
              if (minioPublicStorageService.isEnabled()) {
                try {
                  const mimeType =
                    ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
                  const objectResult = await minioPublicStorageService.uploadGeneratedBuffer(
                    req.userId!,
                    'image',
                    buffer,
                    filename,
                    mimeType
                  );
                  if (objectResult?.url) {
                    nextUrl = objectResult.url;
                    objectUploadSuccess = true;
                    logger.info(
                      `[Image] 参考图${index + 1} 上传MinIO成功: ${objectResult.url.substring(0, 80)}`
                    );
                  }
                } catch (objectErr) {
                  logger.warn(
                    `[Image] 参考图${index + 1} MinIO上传失败:`,
                    objectErr instanceof Error ? objectErr.message : String(objectErr)
                  );
                }
              }

              if (!objectUploadSuccess) {
                nextUrl = savedUrl;
                const isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');
                if (!isLocalhost) {
                  logger.info(`[Image] 参考图${index + 1} 保存到本地并替换为公网URL: ${nextUrl}`);
                } else {
                  logger.warn(
                    `[Image] 参考图${index + 1} 使用本地URL: ${savedUrl}，远程API可能无法访问，建议配置MinIO公网地址或设置公网BASE_URL`
                  );
                }
              }
            }
          } catch (uploadErr) {
            console.warn(`[Image] 参考图${index + 1} 本地保存失败，保留原始数据:`, uploadErr);
          }
          return nextUrl;
        }

        // 非 base64 的参考图 URL：如果是相对路径或 localhost URL，需要转为公网绝对 URL 或代理上传到 MinIO。
        try {
          // 相对路径（如 /showcase-images/10.webp、/uploads/...）转为绝对 URL，否则外部 API 无法访问
          if (nextUrl.startsWith('/') && !nextUrl.startsWith('//')) {
            const publicBase = process.env.PUBLIC_APP_BASE_URL || process.env.BASE_URL || '';
            if (publicBase) {
              const oldUrl = nextUrl;
              nextUrl = `${publicBase}${nextUrl}`;
              logger.info(
                `[Image] 参考图${index + 1} 相对路径转为绝对URL: ${oldUrl.substring(0, 60)} -> ${nextUrl.substring(0, 100)}`
              );
            }
          }
          const refUrlParsed = new URL(nextUrl);
          const isRefLocalhost =
            refUrlParsed.hostname === 'localhost' || refUrlParsed.hostname === '127.0.0.1';
          if (isRefLocalhost && minioPublicStorageService.isEnabled()) {
            logger.info(
              `[Image] 参考图${index + 1} 是本地URL，尝试代理上传到MinIO: ${nextUrl.substring(0, 80)}`
            );
            const localFilePath = path.join(
              process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'),
              refUrlParsed.pathname.replace(/^\/uploads\//, '')
            );
            if (fs.existsSync(localFilePath)) {
              const fileBuffer = fs.readFileSync(localFilePath);
              const refFilename = path.basename(localFilePath);
              const refExt = path.extname(refFilename).toLowerCase();
              const mimeType =
                refExt === '.png' ? 'image/png' : refExt === '.gif' ? 'image/gif' : 'image/jpeg';
              const objectResult = await minioPublicStorageService.uploadGeneratedBuffer(
                req.userId!,
                'image',
                fileBuffer,
                refFilename,
                mimeType
              );
              if (objectResult?.url) {
                nextUrl = objectResult.url;
                logger.info(
                  `[Image] 本地参考图${index + 1} 代理上传MinIO成功: ${objectResult.url.substring(0, 80)}`
                );
              }
            } else {
              logger.warn(`[Image] 本地参考图${index + 1} 文件不存在: ${localFilePath}`);
            }
          }
        } catch (refUrlErr) {
          // URL 解析失败，保留原值；部分 provider 可直接处理非标准输入。
        }
        logger.info(`[Image] 参考图${index + 1} URL: ${nextUrl.substring(0, 100)}...`);
        return nextUrl;
      };

      const rawReferenceImages = [
        validatedData.referenceImage,
        ...(validatedData.referenceImages || []),
      ]
        .filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
        .map((url) => url.trim());
      const uniqueRawReferenceImages = Array.from(new Set(rawReferenceImages));
      const normalizedReferenceImages = Array.from(
        new Set(
          (
            await Promise.all(
              uniqueRawReferenceImages.map((url, index) => normalizeReferenceImageUrl(url, index))
            )
          )
            .map((url) => url.trim())
            .filter((url): url is string => Boolean(url))
        )
      );
      const rawEditSourceImages = (validatedData.editSourceImages || [])
        .filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
        .map((url) => url.trim());
      const normalizedEditSourceImages = Array.from(
        new Set(
          (
            await Promise.all(
              rawEditSourceImages.map((url, index) =>
                normalizeReferenceImageUrl(url, normalizedReferenceImages.length + index)
              )
            )
          )
            .map((url) => url.trim())
            .filter((url): url is string => Boolean(url))
        )
      );
      const normalizedMaskImageUrl = validatedData.maskImageUrl
        ? await normalizeReferenceImageUrl(
            validatedData.maskImageUrl,
            normalizedReferenceImages.length + normalizedEditSourceImages.length
          )
        : undefined;
      const referenceImageUrl = normalizedReferenceImages[0];

      // 构建生成参数
      const effectiveMode = (() => {
        if (referenceImageUrl && validatedData.generationMode === 'character_reference') {
          logger.info(
            `[Image] 使用角色一致性模式(generationMode=character_reference, hasRef=${!!referenceImageUrl})`
          );
          return 'character_reference';
        }
        return (validatedData.generationMode as ImageParams['mode']) || undefined;
      })();

      const normalizedAspectRatio = resolveImageAspectRatio(
        validatedData.aspectRatio,
        validatedData.resolution
      );
      const normalizedPixelResolution = resolveImagePixelResolution(
        validatedData.pixelResolution || validatedData.imageSize || validatedData.resolution
      );

      // 模型专用提示词增强: 为 SENXT1/STEXT2/AG3 自动优化提示词与负向提示词
      const enhanced = enhancePromptForModel(
        validatedData.prompt,
        validatedData.negativePrompt,
        validatedData.model,
        providerName,
        {}
      );
      if (enhanced.enhanced) {
        logger.info(
          `[Image] 提示词增强已应用: provider=${providerName}, model=${validatedData.model}`
        );
        validatedData.prompt = enhanced.prompt;
        validatedData.negativePrompt = enhanced.negativePrompt;
      }

      const imageParams: ImageParams = {
        provider: executionProviderName,
        prompt: validatedData.prompt,
        negativePrompt: validatedData.negativePrompt,
        resolution: normalizedAspectRatio as ImageParams['resolution'],
        size: isCustomImageProvider
          ? validatedData.size || validatedData.imageSize
          : validatedData.size,
        imageSize: validatedData.imageSize,
        pixelResolution: normalizedPixelResolution,
        style: validatedData.style,
        seed: validatedData.seed,
        steps: validatedData.steps,
        cfgStrength: validatedData.cfgScale,
        imageCount: validatedData.imageCount,
        referenceImageUrl,
        referenceImages: normalizedReferenceImages.length > 0
          ? normalizedReferenceImages
          : undefined,
        editSourceImages: normalizedEditSourceImages.length > 0
          ? normalizedEditSourceImages
          : undefined,
        maskImageUrl: normalizedMaskImageUrl,
        model: customUpstreamModel || validatedData.model,
        mode: effectiveMode,
        characterConsistency: validatedData.characterConsistency,
        promptOptimizer: validatedData.promptOptimizer,
        webSearch: validatedData.webSearch,
        seedreamCapability: validatedData.seedreamCapability,
        seedreamOptimizeMode: validatedData.seedreamOptimizeMode,
        sequentialImageGeneration: validatedData.sequentialImageGeneration,
        sequentialMaxImages: validatedData.sequentialMaxImages,
        outputFormat: validatedData.outputFormat,
        hdMode: validatedData.hdMode,
        gptQuality: validatedData.gptQuality,
        gptOutputFormat: validatedData.gptOutputFormat,
        gptBackground: validatedData.gptBackground,
        gptCompression: validatedData.gptCompression,
        gptOutputCompression: validatedData.gptOutputCompression,
        moderation: validatedData.moderation,
        providerExtensions: validatedData.providerExtensions,
        vipSize: validatedData.vipSize,
        n: validatedData.n,
        // 服务商原生水印样式不可控，统一关闭后由本服务使用品牌 LOGO 合成。
        watermark: false,
        strength: validatedData.strength,
        source: validatedData.source,
        promptEnhancer: (validatedData as any).promptEnhancer,
        quality: validatedData.quality,
        gptImageQuality: (validatedData as any).gptImageQuality,
        gptImageStyle: (validatedData as any).gptImageStyle,
        thinkingLevel: (validatedData as any).thinkingLevel,
        fluxFormat: (validatedData as any).fluxFormat,
        fluxSafety: (validatedData as any).fluxSafety,
        fluxSeed: (validatedData as any).fluxSeed,
        maskMode: (validatedData as any).maskMode,
        expandDirection: (validatedData as any).expandDirection,
        expandPixels: (validatedData as any).expandPixels,
        upscaleEngine: (validatedData as any).upscaleEngine,
        stylePreset: (validatedData as any).stylePreset,
        variationCount: (validatedData as any).variationCount,
        backgroundMode: (validatedData as any).backgroundMode,
        generationMode: validatedData.generationMode,
      };

      // 通知：任务处理中
      websocketPushService.notifyTaskProgress(req.userId!, task.id, 50).catch(() => {});

      logger.info(
        `[Image] 最终生成参数 provider=${imageParams.provider}, configuredProvider=${providerName}, model=${imageParams.model}, mode=${imageParams.mode}, size=${(imageParams as any).size || imageParams.imageSize || imageParams.resolution}, hasRefImage=${!!imageParams.referenceImageUrl}, refCount=${imageParams.referenceImages?.length || 0}, refImageUrl=${imageParams.referenceImageUrl ? imageParams.referenceImageUrl.substring(0, 100) : 'none'}`
      );

      // 调用 AI 服务图像分析服务暂不可用，请配置至少一个视觉模型API
      let result = await unifiedApiService.generateImage(imageParams, apiConfig);

      const isRateLimitedResult = (value: unknown): boolean => {
        const lower = String(value || '').toLowerCase();
        return (
          lower.includes('429') ||
          lower.includes('rate limit') ||
          lower.includes('too many requests') ||
          lower.includes('限流') ||
          lower.includes('频率限制')
        );
      };

      if (
        result.status === 'failed' &&
        isRateLimitedResult(result.error) &&
        (providerName === 'wuyinkeji')
      ) {
        const retryKeys = await ProviderKeyManager.getActiveKeysForModel(
          providerName,
          validatedData.model || modelName || providerName
        );
        for (const retryKey of retryKeys) {
          if (!retryKey.apiKey || retryKey.id === activeKeyId) continue;
          logger.warn(
            `[Image] ${providerName} 当前秘钥触发 429/限流，切换备用秘钥重试: current=${activeKeyId || 'main'}, next=${retryKey.id}`
          );
          const retryConfig: ApiProviderConfig = { ...apiConfig, apiKey: retryKey.apiKey };
          const retryResult = await unifiedApiService.generateImage(imageParams, retryConfig);
          if (retryResult.status !== 'failed') {
            result = retryResult;
            apiKey = retryKey.apiKey;
            activeKeyId = retryKey.id;
            logger.info(`[Image] ${providerName} 429 自动切 Key 重试成功: keyId=${retryKey.id}`);
            break;
          }
          result = retryResult;
        }
      }

      // Seedream V3 异步模式：自动轮询直到完成
      if (
        result.status === 'pending' &&
        result.taskId &&
        (providerName === 'doubao' || providerName === 'seedream')
      ) {
        const provider = unifiedApiService.getProvider(providerName);
        if (provider) {
          const maxPolls = 60;
          const pollInterval = 3000;
          for (let poll = 0; poll < maxPolls; poll++) {
            await new Promise((r) => setTimeout(r, pollInterval));
            result = await provider.getTaskStatus(result.taskId, apiConfig);
            logger.info(`[Image] Seedream 轮询 #${poll + 1}: status=${result.status}`);
            if (result.status === 'completed' || result.status === 'failed') break;
          }
          if (result.status !== 'completed' && result.status !== 'failed') {
            result = { ...result, status: 'failed', error: 'Seedream 图片生成超时' };
          }
        }
      }

      if (result.result) {
        result = {
          ...result,
          result: await normalizeImageResultAssets(
            {
              ...result.result,
              metadata: {
                ...(typeof result.result.metadata === 'object' && result.result.metadata
                  ? result.result.metadata
                  : {}),
              },
            },
            req.userId!
          ),
        };
        if (result.status === 'completed') {
          result = {
            ...result,
            result: await applyRequestedImageWatermark(result.result, {
              enabled: watermarkEnabled,
              userId: req.userId!,
              taskId: task.id,
              source: validatedData.source,
            }),
          };
        }
      }

      const updateData: any = {
        status: result.status,
        provider: executionProviderName,
        model: imageParams.model || validatedData.model || providerName,
        progress:
          typeof result.progress === 'number'
            ? Math.max(0, Math.min(100, Math.round(result.progress)))
            : result.status === 'completed'
              ? 100
              : undefined,
        result: result.result
          ? JSON.stringify({ ...result.result, apiTaskId: result.taskId })
          : result.taskId
            ? JSON.stringify({ apiTaskId: result.taskId })
            : undefined,
        error: result.status === 'completed' ? null : result.error || undefined,
      };
      if (result.taskId && !isLocalIdempotencyTaskId(task.taskId)) {
        const candidateTaskId = `${executionProviderName}-${result.taskId}`;
        try {
          const existing = await prisma.task.findFirst({
            where: { taskId: candidateTaskId, NOT: { id: task.id } },
          });
          if (!existing) {
            updateData.taskId = candidateTaskId;
          } else {
            updateData.taskId = `${candidateTaskId}-${task.id.substring(0, 8)}`;
          }
        } catch {
          updateData.taskId = `${candidateTaskId}-${Date.now()}`;
        }
      }
      await prisma.task.update({
        where: { id: task.id },
        data: updateData,
      });

      let savedPrimaryResultUrl: string | undefined;

      // 如果生成成功，保存素材并通知
      if (result.status === 'completed') {
        if (!isCustomImageProvider) {
          ProviderKeyManager.recordUsage(providerName, 1, activeKeyId).catch((err) =>
            console.error('[Image] 秘钥使用记录失败:', err)
          );
          ProviderKeyManager.reportSuccess(providerName, activeKeyId ?? '__fallback__').catch(
            () => {}
          );
        }

        // 自动保存素材到云空间（MinIO 主存储，本地备份）
        if (result.result?.url) {
          try {
            const savedResult = await autoSaveService.autoSaveUrl(
              req.userId!,
              result.result.url,
              'image',
              `图片_${Date.now()}`
            );
            if (savedResult.primaryUrl) {
              savedPrimaryResultUrl = savedResult.primaryUrl;
              await prisma.task
                .update({
                  where: { id: task.id },
                  data: {
                    outputUrl: savedResult.primaryUrl,
                    cosUrl: savedResult.objectUrl || savedResult.cosUrl,
                  },
                })
                .catch(() => {});
              logger.info(
                `[Image] 图片已保存 local=${!!savedResult.localUrl}, minio=${!!savedResult.objectUrl}`
              );
            }
          } catch (err) {
            console.error('[Image] 自动保存素材失败:', err);
          }
        }

        // 通知：任务完成
        websocketPushService
          .notifyTaskComplete(req.userId!, task.id, result.result)
          .catch(() => {});
      } else {
        if (!isCustomImageProvider) {
          ProviderKeyManager.reportFailure(
            providerName,
            activeKeyId ?? '__fallback__',
            result.error
          ).catch(() => {});
        }

        // 通知：任务失败
        websocketPushService
          .notifyTaskFailed(req.userId!, task.id, result.error || '生成失败')
          .catch(() => {});
      }

      // 构建用户友好的错误信息
      let userError = result.error || undefined;
      const promptViolationMetadata = result.result?.metadata;
      if (
        promptViolationMetadata?.code === 'PROMPT_VIOLATION' &&
        typeof promptViolationMetadata.matchedKeyword === 'string'
      ) {
        userError = `${userError || '提示词违反内容安全规范'}（命中关键词：${promptViolationMetadata.matchedKeyword}）`;
      }
      if (!result.result?.url && userError) {
        const errLower = userError.toLowerCase();
        // 注意：判断顺序很重要。"timeout of 120000ms exceeded" 包含 "exceed"，
        // 必须先判断 timeout，避免被误判为"配额不足"。
        if (
          errLower.includes('timeout') ||
          errLower.includes('abort') ||
          errLower.includes('timed out')
        ) {
          userError = `生成超时，请稍后重试 (${userError})`;
        } else if (
          errLower.includes('rate') ||
          errLower.includes('limit') ||
          errLower.includes('429') ||
          errLower.includes('too many')
        ) {
          userError = `服务商限流，请稍后重试(${userError})`;
        } else if (
          errLower.includes('quota') ||
          errLower.includes('insufficient') ||
          (errLower.includes('exceed') && !errLower.includes('timeout'))
        ) {
          userError = `服务商配额不足，请稍后重试(${userError})`;
        } else if (
          errLower.includes('invalid request') ||
          errLower.includes('invalid parameter') ||
          errLower.includes('field n invalid')
        ) {
          userError = `生成参数不被当前模型支持，已调整后请重试(${userError})`;
        } else if (
          errLower.includes('unauthorized') ||
          errLower.includes('invalid api key') ||
          errLower.includes('invalid token') ||
          errLower.includes('401') ||
          errLower.includes('403')
        ) {
          userError = `API秘钥无效或已过期，请联系管理员(${userError})`;
        }
      }

      const resultUrls = result.result?.urls || [];
      const safeResultUrls = resultUrls.slice(0, validatedData.imageCount || 1);
      const effectiveResultUrl =
        savedPrimaryResultUrl ||
        result.result?.url ||
        result.result?.imageUrl ||
        (safeResultUrls.length > 0 ? safeResultUrls[0] : undefined);
      if (!effectiveResultUrl) {
        if (result.status === 'pending' || result.status === 'processing') {
          return res.status(202).json({
            success: true,
            data: {
              taskId: task.id,
              status: result.status,
              progress: updateData.progress ?? task.progress ?? 0,
              actualProvider: providerName,
              actualModel: modelName,
              providerFallback,
            },
          });
        }
        return res.json({
          success: false,
          error: userError || '图片生成失败，未获取到结果',
          data: {
            taskId: task.id,
            status: result.status,
            actualProvider: providerName,
            actualModel: modelName,
            providerFallback,
          },
        });
      }
      res.json({
        success: true,
        data: {
          taskId: task.id,
          status: result.status,
          resultUrl: effectiveResultUrl,
          resultUrls: safeResultUrls.length > 1 ? safeResultUrls : undefined,
          error: userError,
          actualProvider: providerName,
          actualModel: modelName,
          providerFallback,
        },
      });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: '输入数据验证失败',
          details: error.errors,
        });
      }
      await markImageTaskFailed(prisma.task, activeImageTaskId, error).catch((updateError) => {
        logger.error(
          `[Image] 上游异常后标记任务失败异常: taskId=${activeImageTaskId || 'not-created'}`,
          updateError
        );
      });
      next(error);
    }
  }
);

imageRouter.get('/query/:taskId', authenticate, async (req, res, next) => {
  try {
    const { taskId } = req.params;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new AppError('任务不存在', 404);
    }

    if (task.userId !== req.userId) {
      throw new AppError('无权访问此任务', 403);
    }

    const parsedOutput = parseImageTaskOutput(task.result);
    const normalizedOutput = parsedOutput
      ? await normalizeImageResultAssets(parsedOutput, req.userId!)
      : null;
    const normalizedOutputUrl = task.outputUrl
      ? saveGeneratedImageBase64(req.userId!, task.outputUrl) || task.outputUrl
      : undefined;
    let storedParams: Record<string, unknown> = {};
    try {
      storedParams = task.params ? JSON.parse(task.params) : {};
    } catch {
      storedParams = {};
    }
    const watermarkEnabled = resolveWatermarkEnabled(
      storedParams.watermark,
      req.membershipLevel || 'trial'
    );
    const outputWithPrimary = normalizedOutput
      ? {
          ...normalizedOutput,
          url: normalizedOutputUrl || normalizedOutput.url || normalizedOutput.imageUrl,
        }
      : normalizedOutputUrl
        ? { url: normalizedOutputUrl, imageUrl: normalizedOutputUrl, urls: [normalizedOutputUrl] }
        : null;
    const finalOutput =
      task.status === 'completed'
        ? await applyRequestedImageWatermark(outputWithPrimary, {
            enabled: watermarkEnabled,
            userId: req.userId!,
            taskId: task.id,
            source: String(storedParams.source || ''),
          })
        : outputWithPrimary;
    const parsedUrls = finalOutput?.urls || [];
    const resultUrl = finalOutput?.url || finalOutput?.imageUrl || parsedUrls[0];

    if (finalOutput && JSON.stringify(finalOutput) !== JSON.stringify(parsedOutput)) {
      await prisma.task
        .update({
          where: { id: task.id },
          data: {
            result: JSON.stringify(finalOutput),
            outputUrl: resultUrl,
            cosUrl: watermarkEnabled ? resultUrl : task.cosUrl,
          },
        })
        .catch((err) => {
          logger.warn(`[Image] 修复历史任务结果失败: ${task.id}`, err);
        });
    }

    return res.json({
      success: true,
      data: {
        taskId: task.id,
        status: task.status,
        resultUrl,
        cosUrl: watermarkEnabled ? resultUrl : task.cosUrl,
        resultUrls: parsedUrls.length > 0 ? parsedUrls : undefined,
        error: task.error,
        progress: task.progress,
      },
    });
  } catch (error: unknown) {
    next(error);
  }
});

const imageToPromptSchema = z.object({
  imageUrl: z.string().url('无效的图片链接'),
  model: z.string().optional().default('qwen-vl-plus'),
});

async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
    });
    const contentType = response.headers['content-type'] || 'image/jpeg';
    const base64 = Buffer.from(response.data).toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (error: unknown) {
    throw new AppError(
      `无法获取图片: ${error instanceof Error ? error.message : String(error)}`,
      400
    );
  }
}

imageRouter.post('/image-to-prompt', authenticate, async (req, res, next) => {
  try {
    const { imageUrl, model } = imageToPromptSchema.parse(req.body);

    const base64Image = await fetchImageAsBase64(imageUrl);

    let promptResult: { prompt: string; model: string } | null = null;

    // 优先使用阿里云Qwen
    //  VL 模型
    const qwenConfig = await getApiProviderConfig('aliyun');

    if (qwenConfig?.apiKey) {
      try {
        logger.info('[image-to-prompt] 尝试使用阿里云Qwen VL 模型...');
        const prompt = await callQwenVLAPI(qwenConfig.apiKey, base64Image, model || 'qwen-vl-plus');
        promptResult = { prompt, model: 'qwen-vl-plus' };
      } catch (qwenError: unknown) {
        console.error(
          '[image-to-prompt] 阿里云Qwen VL 调用失败:',
          qwenError instanceof Error ? qwenError.message : String(qwenError)
        );
      }
    }

    // 备选方案：尝试使用Doubao VL 模型
    if (!promptResult) {
      const doubaoConfig = await getApiProviderConfig('doubao');
      if (doubaoConfig?.apiKey) {
        try {
          logger.info('[image-to-prompt] 尝试使用 Doubao VL 模型...');
          const prompt = await callDoubaoVLAPI(doubaoConfig.apiKey, base64Image);
          promptResult = { prompt, model: 'doubao-vl' };
        } catch (doubaoError: unknown) {
          console.error(
            '[image-to-prompt] Doubao VL 调用失败:',
            doubaoError instanceof Error ? doubaoError.message : String(doubaoError)
          );
        }
      }
    }

    if (!promptResult) {
      return res.status(503).json({
        success: false,
        error: '图生提示词服务暂不可用，请配置至少一个AI服务商的API Key（阿里云/豆包）',
      });
    }

    return res.json({
      success: true,
      prompt: promptResult.prompt,
      model: promptResult.model,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: '参数验证失败', details: error.errors });
    }
    if (error instanceof AppError) {
      return res
        .status(error.statusCode || 400)
        .json({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
    console.error(
      '[image-to-prompt] Error:',
      (error as any)?.response?.data || (error instanceof Error ? error.message : String(error))
    );
    return res.status(500).json({
      success: false,
      error: '图生提示词服务暂时不可用',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * 调用阿里云Qwen VL API
 */
async function callQwenVLAPI(apiKey: string, base64Image: string, model: string): Promise<string> {
  const messages = [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: '请仔细分析这张图片，然后用中文生成一段详细的AI绘图提示词（prompt）。提示词需要包含：主体描述、场景环境、光影效果、构图风格、色彩色调、情绪氛围等。请用中文输出，直接返回提示词内容，不需要额外解释。输出格式要求：约300字左右用换行分隔，方便阅读。',
        },
        {
          type: 'image_url',
          image_url: { url: base64Image },
        },
      ],
    },
  ];

  const response = await axios.post(
    'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    {
      model,
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 30000,
    }
  );

  const prompt = stripThinkingTags(response.data.choices?.[0]?.message?.content?.trim() || '');
  if (!prompt) {
    throw new AppError('Qwen VL 图生提示词生成失败', 500);
  }

  return prompt;
}

/**
 * 调用豆包 VL API（备用方案）
 */
async function callDoubaoVLAPI(apiKey: string, base64Image: string): Promise<string> {
  const messages = [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: '请仔细分析这张图片，然后用中文生成一段详细的AI绘图提示词（prompt）。提示词需要包含：主体描述、场景环境、光影效果、构图风格、色彩色调、情绪氛围等。请用中文输出，直接返回提示词内容，不需要额外解释。输出格式要求：约300字左右用换行分隔，方便阅读。',
        },
        {
          type: 'image_url',
          image_url: { url: base64Image },
        },
      ],
    },
  ];

  const response = await axios.post(
    'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    {
      model: 'doubao-vision',
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 30000,
    }
  );

  const prompt = stripThinkingTags(response.data.choices?.[0]?.message?.content?.trim() || '');
  if (!prompt) {
    throw new AppError('Doubao VL 图生提示词生成失败', 500);
  }

  return prompt;
}

// ==================== 高级图片生成路由 ====================

const advancedImageSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  negativePrompt: z.string().optional(),
  provider: z.string().optional().default('minimax'),
  model: z.string().optional().default('image-01'),
  generationMode: z.string().optional().default('text_to_image'),
  aspectRatio: z.string().optional(),
  imageSize: z.string().optional().default('1K'),
  vipSize: z.string().optional(),
  thinkingLevel: z.string().optional().default('minimal'),
  fluxSize: z.string().optional().default('1024x1024'),
  fluxSeed: z.number().optional(),
  fluxSafety: z.number().optional().default(2),
  fluxFormat: z.string().optional().default('jpeg'),
  referenceImages: z.array(z.string()).optional(),
  editSourceImages: z.array(z.string()).optional(),
  gptQuality: z.string().optional().default('auto'),
  gptOutputFormat: z.string().optional().default('png'),
  gptBackground: z.string().optional().default('opaque'),
  gptCompression: z.number().optional(),
  imageCount: z.coerce.number().int().min(1).max(MAX_IMAGE_GENERATION_COUNT).optional(),
  size: z.string().optional(),
  promptExtend: z.boolean().optional(),
  watermark: z.boolean().optional(),
  seed: z.number().optional(),
});

imageRouter.post(
  '/generate-advanced',
  authenticate,
  async (req, res, next) => {
    try {
      const validatedData = advancedImageSchema.parse(req.body);

      // SEC-AUDIT 修复：会员等级模型白名单校验，防止前端绕过调用 Pro 专属模型
      const membershipLevel = (req.membershipLevel || 'trial') as MembershipLevel;
      const requestModel = validatedData.model || 'image-01';
      const requestProvider = validatedData.provider || 'minimax';
      if (!isModelAllowedForMembership(requestModel, membershipLevel)) {
        return res
          .status(403)
          .json({ success: false, error: '当前会员等级无权使用该模型', code: 'MODEL_NOT_ALLOWED' });
      }
      if (!isProviderAllowedForMembership(requestProvider, membershipLevel)) {
        return res.status(403).json({
          success: false,
          error: '当前会员等级无权使用该服务商',
          code: 'PROVIDER_NOT_ALLOWED',
        });
      }

      const { websocketPushService } = await import('../services/websocket-push-service');
      websocketPushService.notifyTaskProgress(req.userId!, 'pending', 0).catch(() => {});

      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { isActive: true },
      });
      if (!user || !user.isActive) {
        throw new AppError('用户不存在或未激活', 404);
      }

      const model = validatedData.model || 'image-01';
      const isMinimax = model.startsWith('image-0') || validatedData.provider === 'minimax';
      const isWuyin = WUYIN_MODELS.includes(model);

      let providerName: string;
      if (isMinimax) {
        providerName = 'minimax';
      } else if (isWuyin) {
        providerName = 'wuyinkeji';
      } else {
        providerName = resolveApiyiProvider(model);
      }

      const providerConfig = await prisma.providerConfig.findUnique({
        where: { provider: providerName },
      });
      if (!providerConfig || !providerConfig.isActive) {
        throw new AppError(`AI 服务商${providerName} 未配置或未激活`, 400);
      }

      const idempotencyKey = buildGenerationIdempotencyKey({
        userId: req.userId!,
        route: 'image.generate-advanced',
        body: validatedData as Record<string, unknown>,
        nodeId: (validatedData as any).nodeId,
      });
      const idempotentTask = await createIdempotentGenerationTask(idempotencyKey, {
        userId: req.userId!,
        type: 'image',
        prompt: validatedData.prompt,
        provider: providerName,
        model,
        status: 'pending',
        params: JSON.stringify(validatedData),
        progress: 0,
      });
      if (idempotentTask.reused) {
        return res.status(202).json({
          success: true,
          data: buildReusedGenerationResponse(idempotentTask.task),
        });
      }
      const task = idempotentTask.task;

      let resultUrl: string | undefined;

      websocketPushService.notifyTaskProgress(req.userId!, task.id, 30).catch(() => {});

      if (isMinimax) {
        const secrets = decryptProviderSecrets(providerConfig);
        const activeKeyResult = await ProviderKeyManager.getActiveKey(providerName);
        const apiKey = activeKeyResult?.key ?? secrets.apiKey;
        const activeKeyId = activeKeyResult?.keyId;
        const apiConfig: ApiProviderConfig = {
          apiKey,
          apiSecret: secrets.apiSecret || undefined,
          endpoint: providerConfig.endpoint || undefined,
        };

        const refImages = validatedData.referenceImages || [];
        const editImages = validatedData.editSourceImages || [];
        const allRefImages = Array.from(new Set([...refImages, ...editImages].filter(Boolean)));
        let referenceImageUrl = allRefImages[0];

        if (referenceImageUrl && referenceImageUrl.startsWith('data:')) {
          try {
            const base64Match = referenceImageUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
            if (base64Match?.[2]) {
              const ext = base64Match[1] === 'png' ? 'png' : 'jpg';
              const buffer = Buffer.from(base64Match[2], 'base64');
              const filename = `ref_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
              const uploadDir = path.join(
                process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'),
                'references',
                req.userId!
              );
              if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
              }
              fs.writeFileSync(path.join(uploadDir, filename), buffer);
              const baseUrl =
                process.env.BASE_URL || `http://localhost:${process.env.PORT || 3200}`;
              const isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');
              const savedUrl = `${baseUrl}/uploads/references/${req.userId!}/${filename}`;
              if (!isLocalhost) {
                referenceImageUrl = savedUrl;
                logger.info(
                  `[AdvancedImage] 参考图保存到本地并替换为公网URL: ${referenceImageUrl}`
                );
              } else {
                logger.info(`[AdvancedImage] 参考图保存到本地 ${savedUrl}，保留 base64 供本地使用`);
              }
            }
          } catch (uploadErr) {
            console.warn('[AdvancedImage] 参考图上传失败:', uploadErr);
          }
        }

        const effectiveMode = (() => {
          if (editImages.length > 0 && referenceImageUrl) return 'reference';
          if (referenceImageUrl) return 'reference';
          return validatedData.generationMode as ImageParams['mode'];
        })();

        const imageParams: ImageParams = {
          provider: providerName,
          prompt: validatedData.prompt,
          negativePrompt: validatedData.negativePrompt,
          resolution: validatedData.aspectRatio as ImageParams['resolution'],
          model,
          mode: effectiveMode as ImageParams['mode'],
          referenceImageUrl,
          referenceImages: allRefImages.length > 0 ? allRefImages : undefined,
          imageCount: validatedData.imageCount,
          seed: validatedData.seed,
          watermark: validatedData.watermark,
          vipSize: validatedData.vipSize,
        };

        const result = await unifiedApiService.generateImage(imageParams, apiConfig);

        if (result.status === 'failed') {
          await prisma.task
            .update({
              where: { id: task.id },
              data: { status: 'failed', error: result.error || '图片生成失败' },
            })
            .catch(() => {});
          throw new AppError(result.error || '图片生成失败', 500);
        }

        if (result.status === 'completed' && result.result?.url) {
          resultUrl = result.result.url;
          const savedResult = await autoSaveService.autoSaveUrl(
            req.userId!,
            resultUrl,
            'image',
            `高级图片_${Date.now()}`
          );
          if (savedResult.primaryUrl) {
            await prisma.task
              .update({
                where: { id: task.id },
                data: { outputUrl: savedResult.primaryUrl, cosUrl: savedResult.cosUrl },
              })
              .catch(() => {});
          }
        } else if (result.status === 'pending' && result.taskId) {
          const provider = unifiedApiService.getProvider(providerName);
          if (provider) {
            for (let poll = 0; poll < 60; poll++) {
              await new Promise((r) => setTimeout(r, 3000));
              const pollResult = await provider.getTaskStatus(result.taskId, apiConfig);
              if (pollResult.status === 'completed' && pollResult.result?.url) {
                resultUrl = pollResult.result.url;
                const savedResult = await autoSaveService.autoSaveUrl(
                  req.userId!,
                  resultUrl,
                  'image',
                  `高级图片_${Date.now()}`
                );
                if (savedResult.primaryUrl) {
                  await prisma.task
                    .update({
                      where: { id: task.id },
                      data: { outputUrl: savedResult.primaryUrl, cosUrl: savedResult.cosUrl },
                    })
                    .catch(() => {});
                }
                break;
              }
              if (pollResult.status === 'failed') break;
            }
          }
        }

        ProviderKeyManager.recordUsage(providerName, 1, activeKeyId).catch(() => {});
        if (resultUrl) {
          ProviderKeyManager.reportSuccess(providerName, activeKeyId ?? '__fallback__').catch(
            () => {}
          );
        } else {
          ProviderKeyManager.reportFailure(
            providerName,
            activeKeyId ?? '__fallback__',
            'minimax 生成失败'
          ).catch(() => {});
        }
      } else if (isWuyin) {
        const secrets = decryptProviderSecrets(providerConfig);
        const apiKey = secrets.apiKey;
        if (!apiKey) {
          throw new AppError(
            '小天API服务未配图像分析服务暂不可用，请配置至少一个视觉模型API Key',
            400
          );
        }
        const apiEndpoint = providerConfig.endpoint || 'https://api.wuyinkeji.com';

        const wuyinEndpoints: Record<string, string> = {
          'Wan2.7_image': '/api/async/image_wan2.6',
          'Wan2.6': '/api/async/image_wan2.6',
        };

        const endpoint = wuyinEndpoints[model];
        if (!endpoint) {
          throw new AppError(`不支持的小天模型: ${model}`, 400);
        }

        const allRefImages = [
          ...(validatedData.editSourceImages || []),
          ...(validatedData.referenceImages || []),
        ];
        const convertedRefImages: string[] = [];
        for (const imgUrl of allRefImages) {
          try {
            let buffer: Buffer | null = null;
            let ext = 'jpg';
            let mimeType = 'image/jpeg';

            if (imgUrl.startsWith('data:')) {
              const dataMatch = imgUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
              if (dataMatch?.[2]) {
                ext =
                  dataMatch[1] === 'png'
                    ? 'png'
                    : dataMatch[1] === 'gif'
                      ? 'gif'
                      : dataMatch[1] === 'webp'
                        ? 'webp'
                        : 'jpg';
                buffer = Buffer.from(dataMatch[2], 'base64');
                mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
              }
            } else {
              const fetchUrl =
                imgUrl.includes('localhost') || imgUrl.includes('127.0.0.1')
                  ? imgUrl.replace(
                      /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/,
                      process.env.BASE_URL || 'https://aixt.website'
                    )
                  : imgUrl;
              const imgResp = await axios.get(fetchUrl, {
                responseType: 'arraybuffer',
                timeout: 30000,
              });
              buffer = Buffer.from(imgResp.data);
              const ct = (imgResp.headers['content-type'] as string) || 'image/jpeg';
              ext = ct.includes('png')
                ? 'png'
                : ct.includes('webp')
                  ? 'webp'
                  : ct.includes('gif')
                    ? 'gif'
                    : 'jpg';
              mimeType = ct;
            }

            if (!buffer) {
              convertedRefImages.push(imgUrl);
              continue;
            }

            const filename = `ref_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
            let publicUrl: string | null = null;

            if (minioPublicStorageService.isEnabled()) {
              const objectResult = await minioPublicStorageService.uploadGeneratedBuffer(
                req.userId!,
                'image',
                buffer,
                filename,
                mimeType
              );
              if (objectResult?.url) {
                publicUrl = objectResult.url;
              }
            }

            if (!publicUrl) {
              const uploadDir = path.join(
                process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'),
                'references',
                req.userId!
              );
              if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
              }
              fs.writeFileSync(path.join(uploadDir, filename), buffer);
              const baseUrl =
                process.env.BASE_URL || `http://localhost:${process.env.PORT || 3200}`;
              publicUrl = `${baseUrl}/uploads/references/${req.userId!}/${filename}`;
            }

            convertedRefImages.push(publicUrl);
          } catch (saveErr) {
            console.warn('[AdvancedImage] 小天参考图处理失败:', saveErr);
            if (!imgUrl.startsWith('data:')) {
              convertedRefImages.push(imgUrl);
            }
          }
        }

        const body: Record<string, any> = { prompt: validatedData.prompt };

        if (model === 'Wan2.7_image' || model === 'Wan2.6') {
          body.size = validatedData.size || '1280*1280';
          if (validatedData.negativePrompt) body.negative_prompt = validatedData.negativePrompt;
          if (validatedData.promptExtend !== undefined)
            body.prompt_extend = validatedData.promptExtend;
          if (validatedData.watermark !== undefined) body.watermark = validatedData.watermark;
          if (validatedData.seed !== undefined) body.seed = String(validatedData.seed);
          if (convertedRefImages.length > 0) {
            body.urls = convertedRefImages;
          }
        }

        if (
          model !== 'Wan2.7_image' &&
          model !== 'Wan2.6'
        ) {
          body.n =
            validatedData.imageCount && validatedData.imageCount > 0 ? validatedData.imageCount : 1;
        }

        let submitResponse: any;
        if (model === 'Wan2.7_image' || model === 'Wan2.6') {
          const formParams = new URLSearchParams();
          for (const [key, value] of Object.entries(body)) {
            if (Array.isArray(value)) {
              formParams.append(key, JSON.stringify(value));
            } else if (typeof value === 'boolean') {
              formParams.append(key, value ? 'true' : 'false');
            } else {
              formParams.append(key, String(value));
            }
          }
          submitResponse = await axios.post(`${apiEndpoint}${endpoint}`, formParams.toString(), {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: apiKey,
            },
            timeout: 30000,
          });
        } else {
          submitResponse = await axios.post(`${apiEndpoint}${endpoint}`, body, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: apiKey,
            },
            timeout: 30000,
          });
        }

        if (submitResponse.data?.code !== 200) {
          const errMsg = submitResponse.data?.msg || `HTTP ${submitResponse.data?.code || '未知'}`;
          const detail =
            submitResponse.data?.code === 400 && !submitResponse.data?.msg
              ? '请求参数错误或模型暂不可用(400)'
              : errMsg;
          throw new AppError(`小天API提交失败: ${detail}`, 500);
        }

        const taskId = submitResponse.data?.data?.id;
        if (!taskId) {
          throw new AppError('小天API未返回任务ID', 500);
        }

        const maxPollAttempts = 80;
        const pollInterval = 3000;
        for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, pollInterval));

          const pollResponse = await axios.get(`${apiEndpoint}/api/async/detail`, {
            params: { key: apiKey, id: taskId },
            timeout: 15000,
          });

          const pollData = pollResponse.data?.data;
          const taskStatus = pollData?.status;
          const taskResult = pollData?.result;

          if (taskStatus === 1 || taskStatus === 2) {
            if (typeof taskResult === 'string' && taskResult.startsWith('http')) {
              resultUrl = taskResult;
            } else if (Array.isArray(taskResult) && taskResult.length > 0) {
              resultUrl = typeof taskResult[0] === 'string' ? taskResult[0] : taskResult[0]?.url;
            } else if (typeof taskResult === 'object' && taskResult !== null) {
              resultUrl =
                taskResult.url || taskResult.image_url || taskResult.image || taskResult.output;
              if (!resultUrl && Array.isArray(taskResult.images) && taskResult.images.length > 0) {
                resultUrl = taskResult.images[0];
              }
              if (!resultUrl) {
                const urlField = Object.values(taskResult).find(
                  (v: any) =>
                    typeof v === 'string' && (v.startsWith('http://') || v.startsWith('https://'))
                );
                if (urlField) resultUrl = urlField as string;
              }
            }
            if (!resultUrl) {
              throw new AppError('小天API生成完成但未返回有效图片URL', 500);
            }
            break;
          } else if (
            taskStatus === 3 ||
            (taskStatus !== 0 && taskStatus !== 1 && taskStatus !== 2)
          ) {
            throw new AppError(
              `小天API生成失败: ${pollData?.message || pollResponse.data?.msg || '未知错误'}`,
              500
            );
          }

          websocketPushService
            .notifyTaskProgress(req.userId!, task.id, Math.min(30 + attempt, 85))
            .catch(() => {});
        }

        if (!resultUrl) {
          throw new AppError('小天API生成超时，请稍后查看任务结果', 504);
        }
      }

      websocketPushService.notifyTaskProgress(req.userId!, task.id, 90).catch(() => {});

      if (!resultUrl) {
        throw new AppError('图片生成失败：未获取到结果', 500);
      }

      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'completed',
          result: JSON.stringify({ url: resultUrl }),
          progress: 100,
        },
      });

      try {
        const savedResult = await autoSaveService.autoSaveUrl(
          req.userId!,
          resultUrl,
          'image',
          `高级图片_${Date.now()}`
        );
        if (savedResult.primaryUrl) {
          await prisma.task
            .update({
              where: { id: task.id },
              data: { outputUrl: savedResult.primaryUrl, cosUrl: savedResult.cosUrl },
            })
            .catch(() => {});
          resultUrl = savedResult.primaryUrl;
        }
      } catch (saveErr) {
        console.error('[AdvancedImage] 自动保存素材失败:', saveErr);
      }

      websocketPushService.notifyTaskComplete(req.userId!, task.id, { url: resultUrl }, {
        type: 'image',
        provider: task.provider || undefined,
        prompt: task.prompt,
      }).catch(() => {});

      res.json({
        success: true,
        data: {
          taskId: task.id,
          status: 'completed',
          resultAvailable: true,
          resultUrl,
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        next(error);
      } else {
        next(new AppError(error.message || '高级图片生成失败', 500));
      }
    }
  }
);

// ==================== 图像分析路由 ====================

const imageAnalyzeSchema = z.object({
  imageUrl: z.string().min(1, 'Image URL is required'),
  model: z.string().optional().default('gpt-4o'),
  analysisMode: z.string().optional().default('describe'),
  customPrompt: z.string().optional().default(''),
  language: z.string().optional().default('auto'),
  outputDetail: z.string().optional().default('detailed'),
  maxTokens: z.number().optional().default(1024),
  temperature: z.number().optional().default(0.3),
});

const ANALYSIS_PROMPTS: Record<string, string> = {
  describe:
    '请仔细分析这张图片，用详细的文字描述图片中的所有内容，包括主体、背景、光影、色彩、构图、情绪氛围等。请用结构化的方式输出。',
  ocr: '请识别这张图片中的所有文字内容，保持原始排版格式。如果有表格或列表，请保留其结构。',
  style_analyze:
    '请分析这张图片的艺术风格，包括：绘画/摄影类型、色彩运用、光影技法、构图方式、参考的艺术流派或风格、情绪表达等。',
  content_extract:
    '请提取这张图片中的关键信息要素，包括：主体对象、数量、位置关系、颜色特征、文字内容、品牌标志、场景类型等，以结构化方式列出。',
  prompt_generate:
    '请仔细分析这张图片，然后用中文生成一段详细的AI绘图提示词（prompt）。提示词需要包含：主体描述、场景环境、光影效果、构图风格、色彩色调、情绪氛围等。直接返回提示词内容，不需要额外解释。',
};

imageRouter.post('/analyze', authenticate, async (req, res, next) => {
  try {
    const validatedData = imageAnalyzeSchema.parse(req.body);
    const { websocketPushService } = await import('../services/websocket-push-service');
    websocketPushService.notifyTaskProgress(req.userId!, 'pending', 0).catch(() => {});

    // 构建分析提示
    let analysisPrompt = ANALYSIS_PROMPTS[validatedData.analysisMode] || ANALYSIS_PROMPTS.describe;
    if (validatedData.analysisMode === 'custom' && validatedData.customPrompt) {
      analysisPrompt = validatedData.customPrompt;
    }
    if (validatedData.language === 'zh') {
      analysisPrompt += '\n请用中文回答。';
    } else if (validatedData.language === 'en') {
      analysisPrompt += '\nPlease answer in English.';
    }
    if (validatedData.outputDetail === 'structured') {
      analysisPrompt += '\n请以结构化的方式输出，使用Markdown格式，包含标题和列表。';
    } else if (validatedData.outputDetail === 'brief') {
      analysisPrompt += '\n请简洁概括，控制在300字以内。';
    }

    // 处理图片URL（base64或远程URL）
    let imageContent: string;
    if (validatedData.imageUrl.startsWith('data:')) {
      imageContent = validatedData.imageUrl;
    } else {
      try {
        imageContent = await fetchImageAsBase64(validatedData.imageUrl);
      } catch {
        imageContent = validatedData.imageUrl; // 回退直接使用URL
      }
    }

    // 创建任务记录
    const task = await prisma.task.create({
      data: {
        userId: req.userId!,
        type: 'image-analysis',
        prompt: analysisPrompt,
        provider: 'vision',
        model: validatedData.model,
        status: 'processing',
        params: JSON.stringify(validatedData),
        progress: 30,
      },
    });

    websocketPushService.notifyTaskProgress(req.userId!, task.id, 30).catch(() => {});

    let analysisResult = '';

    // 按模型优先级尝试调用
    const model = validatedData.model;

    // 仅保留国内模型 Qwen VL / 豆包 VL 视觉分析

    // 通用回退：尝试阿里云 Qwen VL
    if (!analysisResult) {
      const qwenConfig = await getApiProviderConfig('aliyun');
      if (qwenConfig?.apiKey) {
        try {
          analysisResult = await callVisionAPI(
            'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
            qwenConfig.apiKey,
            model.includes('qwen') ? model : 'qwen-vl-plus',
            imageContent,
            analysisPrompt,
            validatedData.maxTokens,
            validatedData.temperature
          );
        } catch (e) {
          console.error('[ImageAnalyze] Qwen VL failed:', (e as Error).message);
        }
      }
    }

    // 最后回退：豆包VL
    if (!analysisResult) {
      const doubaoConfig = await getApiProviderConfig('doubao');
      if (doubaoConfig?.apiKey) {
        try {
          analysisResult = await callVisionAPI(
            'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
            doubaoConfig.apiKey,
            'doubao-vision',
            imageContent,
            analysisPrompt,
            validatedData.maxTokens,
            validatedData.temperature
          );
        } catch (e) {
          console.error('[ImageAnalyze] Doubao VL failed:', (e as Error).message);
        }
      }
    }

    if (!analysisResult) {
      await prisma.task.update({
        where: { id: task.id },
        data: { status: 'failed', error: '所有视觉模型均不可用，请检查API配置' },
      });
      throw new AppError('图像分析服务暂不可用，请配置至少一个视觉模型API', 503);
    }

    // 更新任务状态
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: 'completed',
        result: JSON.stringify({ analysis: analysisResult }),
        progress: 100,
      },
    });

    websocketPushService.notifyTaskProgress(req.userId!, task.id, 100).catch(() => {});

    res.json({
      success: true,
      data: {
        taskId: task.id,
        analysis: analysisResult,
        model: validatedData.model,
      },
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: '参数验证失败', details: error.errors });
    }
    next(error);
  }
});

// ==================== 局部重绘路由====================

const inpaintSchema = z.object({
  imageUrl: z.string().min(1, 'Image URL is required'),
  maskUrl: z.string().optional(),
  prompt: z.string().min(1, 'Prompt is required'),
  negativePrompt: z.string().optional(),
  model: z.string().optional().default('doubao-seedream-5-0-pro'),
  maskMode: z.string().optional().default('upload'),
  inpaintStrength: z.number().optional().default(0.75),
  featherEdge: z.number().optional().default(3),
  preserveBackground: z.boolean().optional().default(true),
  seed: z.number().optional(),
  cfgScale: z.number().optional().default(7.0),
  steps: z.number().optional().default(30),
  outputCount: z.number().optional().default(1),
});

imageRouter.post(
  '/inpaint',
  authenticate,
  async (req, res, next) => {
    try {
      const validatedData = inpaintSchema.parse(req.body);
      const { websocketPushService } = await import('../services/websocket-push-service');
      websocketPushService.notifyTaskProgress(req.userId!, 'pending', 0).catch(() => {});

      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { isActive: true },
      });
      if (!user || !user.isActive) {
        throw new AppError('用户不存在或未激活', 404);
      }

      const idempotencyKey = buildGenerationIdempotencyKey({
        userId: req.userId!,
        route: 'image.inpaint',
        body: validatedData as Record<string, unknown>,
        nodeId: (req.body as any).nodeId,
      });
      const idempotentTask = await createIdempotentGenerationTask(idempotencyKey, {
        userId: req.userId!,
        type: 'image',
        prompt: validatedData.prompt,
        provider: 'inpaint',
        model: validatedData.model,
        status: 'pending',
        params: JSON.stringify(validatedData),
        progress: 0,
      });
      if (idempotentTask.reused) {
        return res.status(202).json({
          success: true,
          data: buildReusedGenerationResponse(idempotentTask.task),
        });
      }
      const task = idempotentTask.task;

      websocketPushService.notifyTaskProgress(req.userId!, task.id, 20).catch(() => {});

      let resultUrl: string | undefined;

      // 根据模型选择API
      const model = validatedData.model;
      const resolvedApiyiProvider = resolveApiyiProvider(model);
      const apiEndpoint =
        (await getApiProviderConfig(resolvedApiyiProvider))?.endpoint ||
        'https://api.wuyinkeji.com';
      const apiConfig = await getApiProviderConfig(resolvedApiyiProvider);

      // 已删除 (2026-07-20): 国外模型 GPT Image / Flux Pro Inpainting 已下线，
      // 默认走豆包 Seedream 5.0 Pro 入口
      if (model.includes('gpt-image') || model.includes('flux')) {
        // 兼容入口：将 GPT-Image / Flux 请求重定向到豆包 Seedream
        if (apiConfig?.apiKey) {
          const FormData = (await import('form-data')).default;
          const form = new FormData();
          form.append('model', 'doubao-seedream-5-0-pro');
          form.append('prompt', validatedData.prompt);

          try {
            const imgResponse = await axios.get(validatedData.imageUrl, {
              responseType: 'arraybuffer',
              timeout: 30000,
            });
            const ext = ((imgResponse.headers['content-type'] as string) || 'image/png').includes(
              'jpeg'
            )
              ? 'jpg'
              : 'png';
            form.append('image[]', imgResponse.data, {
              filename: `source.${ext}`,
              contentType: `image/${ext}`,
            });
          } catch (e) {
            console.warn('[Inpaint] 下载源图失败:', e);
          }

          if (validatedData.maskUrl) {
            try {
              const maskResponse = await axios.get(validatedData.maskUrl, {
                responseType: 'arraybuffer',
                timeout: 30000,
              });
              form.append('image[]', maskResponse.data, {
                filename: 'mask.png',
                contentType: 'image/png',
              });
            } catch (e) {
              console.warn('[Inpaint] 下载蒙版失败:', e);
            }
          }

          const editResponse = await axios.post(`${apiEndpoint}/v1/images/edits`, form, {
            headers: {
              Authorization: `Bearer ${apiConfig.apiKey}`,
              ...form.getHeaders(),
            },
            timeout: 300000,
          });

          resultUrl = editResponse.data?.data?.[0]?.url;
        }
      } else {
        if (apiConfig?.apiKey) {
          const FormData = (await import('form-data')).default;
          const form = new FormData();
          form.append('model', 'doubao-seedream-5-0-pro');
          form.append('prompt', validatedData.prompt);

          try {
            const imgResponse = await axios.get(validatedData.imageUrl, {
              responseType: 'arraybuffer',
              timeout: 30000,
            });
            const ext = ((imgResponse.headers['content-type'] as string) || 'image/png').includes(
              'jpeg'
            )
              ? 'jpg'
              : 'png';
            form.append('image[]', imgResponse.data, {
              filename: `source.${ext}`,
              contentType: `image/${ext}`,
            });
          } catch (e) {
            console.warn('[Inpaint] 回退下载源图失败:', e);
          }

          if (validatedData.maskUrl) {
            try {
              const maskResponse = await axios.get(validatedData.maskUrl, {
                responseType: 'arraybuffer',
                timeout: 30000,
              });
              form.append('image[]', maskResponse.data, {
                filename: 'mask.png',
                contentType: 'image/png',
              });
            } catch (e) {
              console.warn('[Inpaint] 回退下载蒙版失败:', e);
            }
          }

          const endpoint = apiConfig.endpoint || apiEndpoint;
          const editResponse = await axios.post(`${endpoint}/v1/images/edits`, form, {
            headers: {
              Authorization: `Bearer ${apiConfig.apiKey}`,
              ...form.getHeaders(),
            },
            timeout: 300000,
          });

          resultUrl = editResponse.data?.data?.[0]?.url;
        }
      }

      if (!resultUrl) {
        await prisma.task
          .update({
            where: { id: task.id },
            data: { status: 'failed', error: '局部重绘失败：未获取到结果' },
          })
          .catch(() => {});
        throw new AppError('局部重绘失败：未获取到结果', 500);
      }

      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'completed',
          result: JSON.stringify({ url: resultUrl }),
          progress: 100,
        },
      });

      autoSaveService
        .autoSaveUrl(req.userId!, resultUrl, 'image', `重绘_${Date.now()}`)
        .then((sr) => {
          if (sr.primaryUrl) {
            prisma.task
              .update({
                where: { id: task.id },
                data: { outputUrl: sr.primaryUrl, cosUrl: sr.cosUrl },
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
      websocketPushService
        .notifyTaskComplete(req.userId!, task.id, { url: resultUrl })
        .catch(() => {});

      res.json({
        success: true,
        data: {
          taskId: task.id,
          status: 'completed',
          resultUrl,
        },
      });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ success: false, error: '参数验证失败', details: error.errors });
      }
      next(error);
    }
  }
);

// ==================== 画布扩展路由 ====================

const outpaintSchema = z.object({
  imageUrl: z.string().min(1, 'Image URL is required'),
  prompt: z.string().optional().default(''),
  negativePrompt: z.string().optional(),
  model: z.string().optional().default('flux-pro-outpaint'),
  expandDirection: z.string().optional().default('all'),
  expandPixels: z.number().optional().default(256),
  targetAspectRatio: z.string().optional().default('auto'),
  fillMode: z.string().optional().default('ai_generate'),
  blendStrength: z.number().optional().default(0.8),
  seed: z.number().optional(),
  outputCount: z.number().optional().default(1),
});

imageRouter.post(
  '/outpaint',
  authenticate,
  async (req, res, next) => {
    try {
      const validatedData = outpaintSchema.parse(req.body);
      const { websocketPushService } = await import('../services/websocket-push-service');
      websocketPushService.notifyTaskProgress(req.userId!, 'pending', 0).catch(() => {});

      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { isActive: true },
      });
      if (!user || !user.isActive) {
        throw new AppError('用户不存在或未激活', 404);
      }

      const idempotencyKey = buildGenerationIdempotencyKey({
        userId: req.userId!,
        route: 'image.outpaint',
        body: validatedData as Record<string, unknown>,
        nodeId: (req.body as any).nodeId,
      });
      const idempotentTask = await createIdempotentGenerationTask(idempotencyKey, {
        userId: req.userId!,
        type: 'image',
        prompt: validatedData.prompt || '画布扩展',
        provider: 'outpaint',
        model: validatedData.model,
        status: 'pending',
        params: JSON.stringify(validatedData),
        progress: 0,
      });
      if (idempotentTask.reused) {
        return res.status(202).json({
          success: true,
          data: buildReusedGenerationResponse(idempotentTask.task),
        });
      }
      const task = idempotentTask.task;

      websocketPushService.notifyTaskProgress(req.userId!, task.id, 20).catch(() => {});

      let resultUrl: string | undefined;
      const model = validatedData.model;
      const resolvedApiyiProvider = resolveApiyiProvider(model);
      const apiConfig = await getApiProviderConfig(resolvedApiyiProvider);
      const apiEndpoint = apiConfig?.endpoint || 'https://api.wuyinkeji.com';

      // 计算扩展后的尺寸
      const expandPx = validatedData.expandPixels;
      const direction = validatedData.expandDirection;
      const expandTop =
        direction === 'all' || direction === 'vertical' || direction === 'top' ? expandPx : 0;
      const expandBottom =
        direction === 'all' || direction === 'vertical' || direction === 'bottom' ? expandPx : 0;
      const expandLeft =
        direction === 'all' || direction === 'horizontal' || direction === 'left' ? expandPx : 0;
      const expandRight =
        direction === 'all' || direction === 'horizontal' || direction === 'right' ? expandPx : 0;

      // 构建提示
      const outpaintPrompt =
        validatedData.prompt ||
        'Continue the image naturally, maintaining the same style, lighting, and content coherence.';

      if (model.includes('flux') && apiConfig?.apiKey) {
        // Flux Pro Outpainting
        const fluxBody: Record<string, any> = {
          prompt: outpaintPrompt,
          image_url: validatedData.imageUrl,
          expand_top: expandTop,
          expand_bottom: expandBottom,
          expand_left: expandLeft,
          expand_right: expandRight,
          fill_mode: validatedData.fillMode,
          blend_strength: validatedData.blendStrength,
          seed:
            validatedData.seed !== undefined && validatedData.seed !== -1
              ? validatedData.seed
              : undefined,
          num_images: validatedData.outputCount,
        };

        const fluxResponse = await axios.post(`${apiEndpoint}/v1/images/outpaint`, fluxBody, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiConfig.apiKey}`,
          },
          timeout: 300000,
        });

        resultUrl = fluxResponse.data?.data?.[0]?.url;
      } else if (model.includes('gpt-image') && apiConfig?.apiKey) {
        const FormData = (await import('form-data')).default;
        const form = new FormData();
        form.append('model', 'doubao-seedream-5-0-pro');
        form.append('prompt', outpaintPrompt);
        form.append('response_format', 'url');

        try {
          const imgResponse = await axios.get(validatedData.imageUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
          });
          const ext = ((imgResponse.headers['content-type'] as string) || 'image/png').includes(
            'jpeg'
          )
            ? 'jpg'
            : 'png';
          form.append('image[]', imgResponse.data, {
            filename: `source.${ext}`,
            contentType: `image/${ext}`,
          });
        } catch (e) {
          console.warn('[Outpaint] 下载源图失败:', e);
        }

        const editResponse = await axios.post(`${apiEndpoint}/v1/images/edits`, form, {
          headers: {
            Authorization: `Bearer ${apiConfig.apiKey}`,
            ...form.getHeaders(),
          },
          timeout: 300000,
        });

        resultUrl = editResponse.data?.data?.[0]?.url;
      } else {
        // 通用回退：使用Flux
        const fallbackConfig = apiConfig;
        if (fallbackConfig?.apiKey) {
          const fluxBody: Record<string, any> = {
            prompt: outpaintPrompt,
            image_url: validatedData.imageUrl,
            expand_top: expandTop,
            expand_bottom: expandBottom,
            expand_left: expandLeft,
            expand_right: expandRight,
            fill_mode: validatedData.fillMode,
            blend_strength: validatedData.blendStrength,
          };

          const fluxResponse = await axios.post(`${apiEndpoint}/v1/images/outpaint`, fluxBody, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${fallbackConfig.apiKey}`,
            },
            timeout: 300000,
          });

          resultUrl = fluxResponse.data?.data?.[0]?.url;
        }
      }

      if (!resultUrl) {
        await prisma.task
          .update({
            where: { id: task.id },
            data: { status: 'failed', error: '画布扩展失败：未获取到结果' },
          })
          .catch(() => {});
        throw new AppError('画布扩展失败：未获取到结果', 500);
      }

      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'completed',
          result: JSON.stringify({ url: resultUrl }),
          progress: 100,
        },
      });

      autoSaveService
        .autoSaveUrl(req.userId!, resultUrl, 'image', `扩展_${Date.now()}`)
        .then((sr) => {
          if (sr.primaryUrl) {
            prisma.task
              .update({
                where: { id: task.id },
                data: { outputUrl: sr.primaryUrl, cosUrl: sr.cosUrl },
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
      websocketPushService
        .notifyTaskComplete(req.userId!, task.id, { url: resultUrl })
        .catch(() => {});

      res.json({
        success: true,
        data: {
          taskId: task.id,
          status: 'completed',
          resultUrl,
        },
      });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ success: false, error: '参数验证失败', details: error.errors });
      }
      next(error);
    }
  }
);

// ==================== 视觉模型调用辅助函数 ====================

/**
 * 通用 OpenAI 兼容视觉 API 调用
 */
async function callVisionAPI(
  endpoint: string,
  apiKey: string,
  model: string,
  imageContent: string,
  prompt: string,
  maxTokens: number,
  temperature: number
): Promise<string> {
  const isBase64 = imageContent.startsWith('data:');
  const imagePart = isBase64
    ? { type: 'image_url' as const, image_url: { url: imageContent } }
    : { type: 'image_url' as const, image_url: { url: imageContent } };

  const messages = [
    {
      role: 'user',
      content: [{ type: 'text' as const, text: prompt }, imagePart],
    },
  ];

  const response = await axios.post(
    endpoint,
    { model, messages, max_tokens: maxTokens, temperature },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 60000,
    }
  );

  const result = stripThinkingTags(response.data.choices?.[0]?.message?.content?.trim() || '');
  if (!result) {
    throw new AppError(`${model} 视觉分析失败`, 500);
  }
  return result;
}

// 已删除 (2026-07-20): 国外模型 callClaudeVisionAPI / callGeminiVisionAPI 函数已下线
// 视觉分析统一回退到国内 SenseNova / DeepSeek 等支持视觉的国内模型

imageRouter.get('/proxy-stream', authenticate, async (req: any, res) => {
  try {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      res.status(400).json({ success: false, error: '缺少 url 参数' });
      return;
    }

    const allowedHosts = [...IMAGE_PROXY_ALLOWED_HOSTS, ...getConfiguredPublicAssetHosts()];
    const parsed = new URL(targetUrl);
    const isAllowed = isAllowedRemoteHostname(parsed.hostname, allowedHosts);
    if (!isAllowed) {
      logger.warn(`[proxy-stream] 域名不在白名单 ${parsed.hostname}`);
      res.status(403).json({ success: false, error: '不允许代理此域名' });
      return;
    }

    const controller = new AbortController();
    const isVideoUrl =
      /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(targetUrl) ||
      targetUrl.includes('/video/') ||
      (targetUrl.includes('vidu') && !targetUrl.includes('image'));
    const timeout = setTimeout(() => controller.abort(), isVideoUrl ? 120000 : 30000);

    const isByteDance = [
      'byteimg.com',
      'byteimg.cn',
      'bytecdn.cn',
      'bytedance.com',
      'tiktokcdn.com',
      'snssdk.com',
      'douyinpic.com',
      'toutiao.com',
    ].some((d) => parsed.hostname.includes(d));

    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'image/webp,image/apng,image/*,video/*,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    };
    if (isByteDance) {
      headers['Referer'] = 'https://jimeng.jianying.com/';
    } else {
      headers['Referer'] = new URL(targetUrl).origin + '/';
    }

    const safeFetch = await fetchSafeRemoteResponse(targetUrl, {
      allowedHosts,
      signal: controller.signal,
      headers,
      maxBytes: IMAGE_PROXY_MAX_BYTES,
      timeoutMs: isVideoUrl ? 120000 : 30000,
    });
    const response = safeFetch.response;
    safeFetch.dispose();
    clearTimeout(timeout);
    if (!response.ok) {
      if (isByteDance && response.status === 403) {
        const retryFetch = await fetchSafeRemoteResponse(targetUrl, {
          allowedHosts,
          headers: { 'User-Agent': headers['User-Agent'] },
          maxBytes: IMAGE_PROXY_MAX_BYTES,
          timeoutMs: 30000,
        });
        const resp2 = retryFetch.response;
        retryFetch.dispose();
        if (resp2.ok) {
          const ct = resp2.headers.get('content-type') || 'application/octet-stream';
          res.setHeader('Content-Type', ct);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          applyProxyCors(req as any, res);
          if (resp2.body) {
            const reader = resp2.body.getReader();
            res.setHeader('Transfer-Encoding', 'chunked');
            try {
              for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(Buffer.from(value));
              }
            } finally {
              reader.releaseLock();
              res.end();
            }
          } else {
            const buf = Buffer.from(await resp2.arrayBuffer());
            res.setHeader('Content-Length', buf.length);
            res.send(buf);
          }
          return;
        }
      }
      res
        .status(response.status)
        .json({ success: false, error: `获取失败: ${response.statusText}` });
      return;
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const isVideoContent = contentType.startsWith('video/') || isVideoUrl;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    applyProxyCors(req as any, res);
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Accept-Ranges', 'bytes');

    if (isVideoContent) {
      // 视频内容：支持 Range 请求，让浏览器 <video> 标签可正常播放
      const contentLength = response.headers.get('content-length');
      const upstreamStatus = response.status;

      if (upstreamStatus === 206 && response.body) {
        // 上游已返回 206 Partial Content，直接透传
        const contentRange = response.headers.get('content-range');
        if (contentRange) res.setHeader('Content-Range', contentRange);
        if (contentLength) res.setHeader('Content-Length', contentLength);
        res.status(206);
        const reader = response.body.getReader();
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
          }
        } finally {
          reader.releaseLock();
          res.end();
        }
      } else if (contentLength && response.body) {
        // 上游返回 200 + Content-Length：支持客户端 Range 请求
        const totalSize = parseInt(contentLength, 10);
        const rangeHeader = req.headers.range as string | undefined;

        if (rangeHeader && totalSize > 0) {
          // 解析 Range: bytes=start-end
          const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
          if (match) {
            const start = parseInt(match[1], 10);
            const end = match[2] ? Math.min(parseInt(match[2], 10), totalSize - 1) : totalSize - 1;
            const chunkSize = end - start + 1;

            res.status(206);
            res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
            res.setHeader('Content-Length', chunkSize);

            // 请求上游的对应 Range
            const safeRangeFetch = await fetchSafeRemoteResponse(targetUrl, {
              allowedHosts,
              signal: controller.signal,
              maxBytes: IMAGE_PROXY_MAX_BYTES,
              timeoutMs: 120000,
              headers: {
                ...headers,
                Range: `bytes=${start}-${end}`,
              },
            });
            const rangeResponse = safeRangeFetch.response;
            safeRangeFetch.dispose();
            if (rangeResponse.body) {
              const reader = rangeResponse.body.getReader();
              try {
                for (;;) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  res.write(Buffer.from(value));
                }
              } finally {
                reader.releaseLock();
                res.end();
              }
            } else {
              const buf = Buffer.from(await rangeResponse.arrayBuffer());
              res.send(buf);
            }
            return;
          }
        }

        // 无 Range 请求或解析失败：全量返回
        res.setHeader('Content-Length', totalSize);
        const reader = response.body.getReader();
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
          }
        } finally {
          reader.releaseLock();
          res.end();
        }
      } else if (response.body) {
        // 无 Content-Length，chunked 流式转发
        const reader = response.body.getReader();
        res.setHeader('Transfer-Encoding', 'chunked');
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
          }
        } finally {
          reader.releaseLock();
          res.end();
        }
      } else {
        const buffer = Buffer.from(await response.arrayBuffer());
        res.setHeader('Content-Length', buffer.length);
        res.send(buffer);
      }
    } else {
      const buffer = Buffer.from(await response.arrayBuffer());
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    }
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: '代理获取失败',
    });
  }
});

imageRouter.get('/proxy-download', authenticate, async (req: any, res) => {
  try {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      res.status(400).json({ success: false, error: '缺少 url 参数' });
      return;
    }

    const allowedHosts = [...IMAGE_PROXY_ALLOWED_HOSTS, ...getConfiguredPublicAssetHosts()];
    const parsed = new URL(targetUrl);
    const isAllowed = isAllowedRemoteHostname(parsed.hostname, allowedHosts);
    if (!isAllowed) {
      res.status(403).json({ success: false, error: '不允许下载此域名的文件' });
      return;
    }

    const response = await fetchRemoteBuffer(targetUrl, {
      allowedHosts,
      maxBytes: 50 * 1024 * 1024,
      timeoutMs: 30000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: new URL(targetUrl).origin + '/',
      },
    });
    if (response.status < 200 || response.status >= 300) {
      res.status(response.status).json({ success: false, error: `下载失败: ${response.status}` });
      return;
    }

    const contentTypeHeader = response.headers['content-type'];
    const contentType = Array.isArray(contentTypeHeader)
      ? contentTypeHeader[0] || 'application/octet-stream'
      : typeof contentTypeHeader === 'string'
        ? contentTypeHeader
        : 'application/octet-stream';
    const buffer = Buffer.from(response.data);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Content-Disposition', `attachment; filename="image_${Date.now()}.png"`);
    res.send(buffer);
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: '代理下载失败',
    });
  }
});

