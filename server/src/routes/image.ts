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
import { withCreditDeduction, executeCreditDeduction } from '../middleware/credit-deduction';
import { creditService } from '../services/credit-service';
import { getBalance } from '../services/points-service';
import storageService from '../services/storage-service';
import { ProviderKeyManager } from '../services/provider-key-manager';
import { getUserModelCredential } from '../services/user-model-credential-service';
import { promptLogService } from '../services/prompt-log-service';
import {
  enforcePosterGenerationPolicy,
} from '../services/poster-generation-policy';
import { posterAgentOptimize } from '../services/poster-agent-service';
import { getRequestAuthToken } from '../middleware/security-session';
import {
  fetchRemoteBuffer,
  fetchSafeRemoteResponse,
  isAllowedRemoteHostname,
} from '../utils/safe-remote-fetch';

function enforcePosterGenerationRequest(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void {
  req.body = enforcePosterGenerationPolicy(req.body || {});
  next();
}

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
import {
  resolveSensenovaApiKey,
  resolveSensenovaBackupApiKey,
  resolveStepfunApiKey,
  resolveStepfunBackupApiKeys,
} from '../utils/provider-env-keys';
import { enhancePromptForModel } from '../services/prompt-enhancer';
import { checkPromptSafetyForImageGeneration } from '../services/prompt-firewall';
import { resolveImageModelChannel } from '../services/model-channel-registry';
import { resolvePosterImageRequestPoints } from '../services/poster-image-pricing';
import { resolveCustomImagePoints } from '../services/custom-model-points';
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
import { isContentReviewEnabled, isTaskAwaitingReview } from '../services/content-review-service';
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
const HOME_PHOTO_GENERATION_POINTS = 30;
const XIAOTIAN4_IMAGE_NODE_POINTS = 30;
const POSTER_GENERATION_POINTS = 60;
const MOBILE_POSTER_GENERATION_POINTS = 20;
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

function normalizeImageCount(value: unknown, fallback: unknown = 1): number {
  const parsed = Number(value ?? fallback ?? 1);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(MAX_IMAGE_GENERATION_COUNT, Math.max(1, Math.floor(parsed)));
}

function normalizePointKey(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function resolveImageRequestFixedPoints(options: {
  source?: string;
  model: string;
  resolvedModel: string;
  imageCount: number;
  isPoster: boolean;
}): number | undefined {
  const count = normalizeImageCount(options.imageCount);
  const source = normalizePointKey(options.source);

  // 首页海报固定按页面公示价计费，包含海报方案与一次豆包 Seedream 出图。
  if (options.isPoster) {
    return POSTER_GENERATION_POINTS * count;
  }

  // AI 图片节点公示价：模型在路由到实际渠道前后都必须得到相同的扣费结果。
  const modelKey = normalizePointKey(options.resolvedModel || options.model);
  if (modelKey === 'wan2.7_image' || modelKey === 'wan2.6') {
    return 60 * count;
  }
  if (modelKey.includes('seedream-5-0-pro')) {
    return 80 * count;
  }
  if (modelKey.includes('seedream-5-0-lite') || modelKey === 'seedream-5.0-lite') {
    return 60 * count;
  }

  if (source === 'home-image' || source === 'photo' || source === 'image') {
    return HOME_PHOTO_GENERATION_POINTS * count;
  }

  return undefined;
}

async function resolveImageRequestCustomPoints(
  req: AuthRequest,
  options: {
    provider: string;
    model: string;
    resolvedProvider: string;
    resolvedModel: string;
    imageCount: number;
    isPoster: boolean;
  }
): Promise<number | undefined> {
  // 自定义模型按每张图片 1 积分计费。
  // 只读取配置标识，不读取或记录 API Key。
  const customProvider = await prisma.providerConfig
    .findFirst({
      where: {
        provider: {
          in: Array.from(new Set([options.provider, options.resolvedProvider])).filter(Boolean),
        },
        isActive: true,
      },
      select: { config: true },
    })
    .catch(() => null);
  if (customProvider?.config) {
    try {
      const config =
        typeof customProvider.config === 'string'
          ? JSON.parse(customProvider.config)
          : customProvider.config;
      if (config?.isCustomModel === true && config?.mediaType === 'image') {
        return resolveCustomImagePoints(options.imageCount);
      }
    } catch {
      // 配置异常时回退到既有积分规则，避免错误放行。
    }
  }
  return resolveImageRequestFixedPoints({
    source: req.body?.source,
    model: options.model,
    resolvedModel: options.resolvedModel,
    imageCount: options.imageCount,
    isPoster: options.isPoster,
  });
}

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
const MINIMAX_ENDPOINT = process.env.MINIMAX_BASE_URL || 'https://api.minimax.chat/v1';
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';
const SENSENOVA_ENDPOINT = process.env.SENSENOVA_BASE_URL || 'https://token.sensenova.cn/v1';
const STEPFUN_ENDPOINT = process.env.STEPFUN_BASE_URL || 'https://api.stepfun.com/step_plan/v1';
const ALLOW_CHARGEABLE_MODEL_RETRY = process.env.ALLOW_CHARGEABLE_MODEL_RETRY === 'true';

type AiImageNodeFailoverCandidate = {
  provider: 'wuyinkeji' | 'doubao';
  model: string;
  label: string;
  orderedKeys?: boolean;
};

/** Only the four consolidated AI-image-node choices use this route plan. */
function resolveAiImageNodeFailoverCandidates(
  provider: string,
  model: string,
  _source?: string
): AiImageNodeFailoverCandidate[] | null {
  if (provider !== 'ai-node-router') return null;
  switch (model) {
    case 'ai-node-nano-banana-2':
    case 'ai-node-nano-banana-pro':
      return [
        {
          provider: 'doubao',
          model: 'doubao-seedream-5-0-pro',
          label: '豆包 Seedream 5.0 Pro',
        },
      ];
    case 'doubao-seedream-5-0-pro':
      // 海报与故事版统一走豆包 Seedream 5.0 Pro 单通道
      return [
        {
          provider: 'doubao',
          model: 'doubao-seedream-5-0-pro',
          label: '豆包 Seedream 5.0 Pro',
        },
      ];
    default:
      return null;
  }
}

function getAiImageNodeFailoverEnvKey(candidate: AiImageNodeFailoverCandidate): string | undefined {
  if (candidate.provider === 'doubao') return process.env.DOUBAO_API_KEY || '';
  return WUYIN_API_KEY;
}

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

function getAiImageNodeFailoverEndpoint(candidate: AiImageNodeFailoverCandidate): string {
  if (candidate.provider === 'doubao')
    return process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
  return WUYIN_ENDPOINT;
}

async function getAiImageNodeFailoverCredentials(candidate: AiImageNodeFailoverCandidate) {
  const providerConfig = await prisma.providerConfig.findUnique({
    where: { provider: candidate.provider },
  });
  const secrets = providerConfig?.isActive ? decryptProviderSecrets(providerConfig) : null;
  const modelKeys = candidate.orderedKeys
    ? await ProviderKeyManager.getActiveKeysForModel(candidate.provider, candidate.model)
    : await ProviderKeyManager.getBalancedActiveKeysForModel(candidate.provider, candidate.model);
  const seen = new Set<string>();
  const credentials: Array<{ apiKey: string; keyId?: string; label: string }> = [];
  const add = (apiKey: string | undefined, label: string, keyId?: string) => {
    const value = String(apiKey || '').trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    credentials.push({ apiKey: value, keyId, label });
  };
  modelKeys.forEach((key) => add(key.apiKey, key.keyLabel || key.id, key.id));
  add(secrets?.apiKey, 'ProviderConfig');
  add(getAiImageNodeFailoverEnvKey(candidate), 'ENV');
  return { providerConfig, apiSecret: secrets?.apiSecret || undefined, credentials };
}

const WUYIN_MODELS = [
  'Wan2.7_image',
  'Wan2.6',
];

const STEPFUN_MODELS = ['step-image-edit-2'];

function resolveApiyiProvider(model: string, requestedProvider?: string): string {
  if (requestedProvider === 'wuyinkeji') return 'wuyinkeji';
  if (requestedProvider === 'agnes') return 'agnes';

  const m = (model || '').toLowerCase();
  if (m === 'agnes-image-2.1-flash') return 'agnes';
  if (STEPFUN_MODELS.some((s) => m === s.toLowerCase())) return 'stepfun';
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

  const normalizedModel = cleanModel.toLowerCase();
  if (normalizedModel === 'sensenova-u1-fast' || normalizedModel.startsWith('sensenova-u1')) {
    return { provider: 'sensenova', model: cleanModel || 'sensenova-u1-fast' };
  }
  if (normalizedModel === 'step-image-edit-2') {
    return { provider: 'stepfun', model: 'step-image-edit-2' };
  }
  if (provider === 'sensenova' && !cleanModel) {
    return { provider: 'sensenova', model: 'sensenova-u1-fast' };
  }
  if (provider === 'stepfun' && !cleanModel) {
    return { provider: 'stepfun', model: 'step-image-edit-2' };
  }
  return { provider, model: cleanModel };
}

export function resolvePosterImagePoints(
  provider: string,
  model: string,
  imageCount: number,
  candidateCount?: unknown
): number | undefined {
  return resolvePosterImageRequestPoints({
    provider,
    model,
    imageCount,
    candidateCount,
  });
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
    posterQualityTier: z.string().optional(),
    posterWorkflowMode: z.string().optional(),
    posterCandidateCount: z.coerce.number().int().min(1).max(MAX_IMAGE_GENERATION_COUNT).optional(),
    posterCandidateIndex: z.number().optional(),
    posterCreditMultiplier: z.number().optional(),
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
  enforcePosterGenerationRequest,
  withCreditDeduction(async (req) => {
    const model = String(req.body?.model || '');
    const provider = String(req.body?.provider || '');
    const isPoster = req.body?.source === 'poster';
    const isMobilePoster = isPoster && req.body?.clientSurface === 'mobile';
    const imageCount = normalizeImageCount(req.body?.imageCount, req.body?.n);
    const resolvedPair = resolveImageProviderModelPair(provider, model);
    const requestCustomPoints = await resolveImageRequestCustomPoints(req, {
      provider,
      model,
      resolvedProvider: resolvedPair.provider,
      resolvedModel: resolvedPair.model,
      imageCount,
      isPoster,
    });
    const posterPoints = isPoster
      ? resolvePosterImagePoints(
          resolvedPair.provider || provider,
          resolvedPair.model || model,
          imageCount,
          req.body?.posterCandidateCount
        )
      : undefined;
    const senxt1Points =
      resolvedPair.model === 'sensenova-u1-fast' || resolvedPair.provider === 'sensenova'
        ? 5 * imageCount
        : undefined;
    const stext2Points =
      resolvedPair.model === 'step-image-edit-2' || resolvedPair.provider === 'stepfun'
        ? 5 * imageCount
        : undefined;
    const isMinimaxImage =
      model === 'image-01' || model.startsWith('image-0') || provider === 'minimax';
    const image01Points = isMinimaxImage ? HOME_PHOTO_GENERATION_POINTS * imageCount : undefined;

    return {
      type: 'image',
      amount: imageCount,
      reason: isPoster ? 'AI海报生成' : '图片生成',
      provider: resolvedPair.provider || provider || 'default',
      model: resolvedPair.model || model || undefined,
      customPoints:
        requestCustomPoints ??
        (isMobilePoster ? MOBILE_POSTER_GENERATION_POINTS * imageCount : posterPoints) ??
        senxt1Points ??
        stext2Points ??
        image01Points,
    };
  }),
  async (req, res, next) => {
    let activeImageTaskId: string | undefined;
    try {
      const validatedData = generateImageSchema.parse(req.body);

      // Poster workflows that provide a mode already send a compiled prompt.
      // Only raw legacy requests without a workflow marker need one server-side optimization pass.
      if (validatedData.source === 'poster' && !validatedData.posterWorkflowMode) {
        try {
          const { token: authToken } = getRequestAuthToken(req);
          const reasoningResult = await posterAgentOptimize(validatedData.prompt, {
            model: 'auto',
            aspectRatio: validatedData.aspectRatio,
            authToken,
          });
          const optimizedPrompt = reasoningResult.content.trim();
          if (optimizedPrompt) validatedData.prompt = optimizedPrompt;
          logger.info(`[Image] 海报文字推理完成: model=${reasoningResult.usedModel}`);
        } catch (error) {
          logger.warn(
            `[Image] 海报文字推理不可用，保留原始提示词继续生图: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      // SEC-AUDIT 修复：会员等级模型白名单校验，防止前端绕过调用 Pro 专属模型
      const membershipLevel = (req.membershipLevel || 'trial') as MembershipLevel;
      // 海报是可下载的交付成品，默认不叠加系统品牌水印；Logo 与二维码只由用户显式上传后合成。
      // 其他图片生成入口仍保留原有的会员水印策略。
      const watermarkEnabled =
        validatedData.source === 'poster'
          ? false
          : resolveWatermarkEnabled(validatedData.watermark, membershipLevel);
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
      const aiNodeFailoverCandidates = resolveAiImageNodeFailoverCandidates(
        providerName,
        modelName,
        String(validatedData.source || '')
      );
      const aiNodeFailoverErrors: string[] = [];
      let aiNodePrimaryCredential: { apiKey: string; keyId?: string; label: string } | null = null;
      if (aiNodeFailoverCandidates) {
        const availableRoutes: Array<{
          candidate: AiImageNodeFailoverCandidate;
          credential: { apiKey: string; keyId?: string; label: string };
        }> = [];
        for (const candidate of aiNodeFailoverCandidates) {
          const credentials = await getAiImageNodeFailoverCredentials(candidate);
          if (credentials.credentials.length > 0) {
            availableRoutes.push({ candidate, credential: credentials.credentials[0] });
          } else {
            aiNodeFailoverErrors.push(`${candidate.label}：未配置可用密钥`);
          }
        }
        if (availableRoutes.length === 0) {
          throw new AppError(`所选模型没有可用通道：${aiNodeFailoverErrors.join('；')}`, 400);
        }
        const useStrictPriority = aiNodeFailoverCandidates.every(
          (candidate) => candidate.orderedKeys
        );
        const selectedRoute = useStrictPriority
          ? availableRoutes[0]
          : availableRoutes[
              await ProviderKeyManager.getRoundRobinIndex(
                `ai-node-router:${modelName}`,
                availableRoutes.length
              )
            ];
        providerName = selectedRoute.candidate.provider;
        modelName = selectedRoute.candidate.model;
        aiNodePrimaryCredential = selectedRoute.credential;
        validatedData.provider = providerName;
        validatedData.model = modelName;
        logger.info(
          `[Image] AI图片节点合并模型路由: ${selectedRoute.candidate.label}, key=${selectedRoute.credential.label}`
        );
      }
      // `source` is set by the dedicated storyboard generator.  Enforce the
      // restriction server-side so a stale or modified browser client cannot
      // select a different image model for this workflow.
      const forceStoryboardDoubaoSeedreamOnly =
        validatedData.source === 'storyboard-maker-single-sheet';
      if (forceStoryboardDoubaoSeedreamOnly) {
        providerName = 'doubao';
        modelName = 'doubao-seedream-5-0-pro';
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

      // liblib 平台已下线，统一迁移到 SenseNova (U1 Fast)
      if (providerName === 'liblib') {
        providerName = 'sensenova';
        if (!modelName || modelName === 'lib-navo-pro') {
          validatedData.model = 'sensenova-u1-fast';
          modelName = validatedData.model;
        }
        logger.info('[Image] liblib provider 已下线，请求转发到 sensenova-u1-fast');
        markProviderFallback('liblib provider migrated to sensenova');
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

      if (modelName === 'step-image-edit-2') {
        providerName = 'stepfun';
        logger.info('[Image] StepFun 图片模型: step-image-edit-2，使用 stepfun provider');
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

      if (
        (!providerConfig || !providerConfig.isActive) &&
        providerName === 'sensenova' &&
        resolveSensenovaApiKey()
      ) {
        providerConfig = {
          id: 'sensenova-env',
          provider: 'sensenova',
          name: 'sensenova',
          displayName: 'SenseNova',
          description: 'SenseNova U1 Fast 信息图生成',
          apiKey: resolveSensenovaApiKey(),
          apiSecret: null,
          endpoint: SENSENOVA_ENDPOINT,
          isActive: true,
          supportedModes: JSON.stringify(['text_to_image']),
          models: JSON.stringify(['sensenova-u1-fast']),
          config: null,
          rateLimit: null,
          priority: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as unknown as typeof providerConfig;
      }

      if (
        (!providerConfig || !providerConfig.isActive) &&
        providerName === 'stepfun' &&
        resolveStepfunApiKey()
      ) {
        providerConfig = {
          id: 'stepfun-env',
          provider: 'stepfun',
          name: 'stepfun',
          displayName: 'StepFun',
          description: 'StepFun step-image-edit-2 图片生成与编辑',
          apiKey: resolveStepfunApiKey(),
          apiSecret: null,
          endpoint: STEPFUN_ENDPOINT,
          isActive: true,
          supportedModes: JSON.stringify(['text_to_image', 'image_to_image', 'image_edit']),
          models: JSON.stringify(['step-image-edit-2']),
          config: JSON.stringify({
            supportedModes: ['text-to-image', 'image-to-image', 'image-edit'],
            models: ['step-image-edit-2'],
            authType: 'bearer',
          }),
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
      } else if (providerName === 'agnes') {
        // agnes 独立通道：4 个密钥轮询共用，避免单 key 打满
        const activeKeyResult = await ProviderKeyManager.getActiveKey(providerName);
        apiKey = activeKeyResult?.key ?? secrets.apiKey;
        activeKeyId = activeKeyResult?.keyId;
      } else if (aiNodePrimaryCredential) {
        apiKey = aiNodePrimaryCredential.apiKey;
        activeKeyId = aiNodePrimaryCredential.keyId;
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
      const hasLockedSubjectReference =
        validatedData.source === 'poster' &&
        validatedData.lockReferenceSubject === true &&
        (normalizedReferenceImages.length > 0 || normalizedEditSourceImages.length > 0);

      if (hasLockedSubjectReference) {
        validatedData.generationMode = 'character_reference';
        validatedData.characterConsistency = 1;
        validatedData.useEditEndpointWhenReferenceExists = true;
        validatedData.prompt = `${validatedData.prompt}\n\nMANDATORY SUBJECT IDENTITY LOCK: The supplied reference image is the only permitted source for the main person. Preserve the exact real person's facial identity, hairstyle, skin tone, body proportions, clothing, and visible accessories. Do not replace, blend, beautify into, stylize into, or add any virtual/generated person.`;
        validatedData.negativePrompt =
          `${validatedData.negativePrompt || ''}, virtual person, invented portrait, different face, face swap, identity change, extra person`.replace(
            /^,\s*/,
            ''
          );
      }

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
      const preservePosterInImageText =
        validatedData.source === 'poster' &&
        /in-image|directly inside the image|Render all supplied Chinese copy|Chinese typography|完整含字海报|模型直出文字/i.test(
          validatedData.prompt
        );
      const enhanced = enhancePromptForModel(
        validatedData.prompt,
        validatedData.negativePrompt,
        validatedData.model,
        providerName,
        { preserveText: preservePosterInImageText }
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

      // AI 图片节点的合并模型：候选通道失败后在同能力组内轮换，
      // 包含控制器中配置的小天6 4K 与多个 2K 通道，不会切换到其它图片模型。
      if (aiNodeFailoverCandidates && result.status === 'failed') {
        const primaryIndex = aiNodeFailoverCandidates.findIndex(
          (candidate) => candidate.provider === providerName && candidate.model === modelName
        );
        aiNodeFailoverErrors.push(
          `${aiNodeFailoverCandidates[Math.max(primaryIndex, 0)]?.label || '首选通道'}：${result.error || '生成失败'}`
        );
        const orderedCandidates =
          primaryIndex >= 0
            ? [
                ...aiNodeFailoverCandidates.slice(primaryIndex),
                ...aiNodeFailoverCandidates.slice(0, primaryIndex),
              ]
            : aiNodeFailoverCandidates;

        for (const candidate of orderedCandidates) {
          const fallback = await getAiImageNodeFailoverCredentials(candidate);
          if (fallback.credentials.length === 0) {
            aiNodeFailoverErrors.push(`${candidate.label}：未配置可用密钥`);
            continue;
          }

          const fallbackParams = {
            ...imageParams,
            provider: candidate.provider,
            model: candidate.model,
          };
          for (const credential of fallback.credentials) {
            if (
              candidate.provider === providerName &&
              candidate.model === modelName &&
              (credential.keyId === activeKeyId || credential.apiKey === apiKey)
            ) {
              continue;
            }
            const fallbackResult = await unifiedApiService.generateImage(fallbackParams, {
              apiKey: credential.apiKey,
              apiSecret: fallback.apiSecret,
              endpoint:
                fallback.providerConfig?.endpoint || getAiImageNodeFailoverEndpoint(candidate),
            });
            if (fallbackResult.status !== 'failed') {
              result = fallbackResult;
              providerName = candidate.provider;
              modelName = candidate.model;
              imageParams.provider = candidate.provider;
              imageParams.model = candidate.model;
              validatedData.provider = candidate.provider;
              validatedData.model = candidate.model;
              activeKeyId = credential.keyId;
              markProviderFallback(`AI图片节点自动轮换至 ${candidate.label}`);
              logger.info(`[Image] AI图片节点自动轮换成功: ${candidate.label}/${credential.label}`);
              break;
            }
            const message = fallbackResult.error || '生成失败';
            aiNodeFailoverErrors.push(`${candidate.label}/${credential.label}：${message}`);
            if (credential.keyId) {
              ProviderKeyManager.reportFailure(candidate.provider, credential.keyId, message).catch(
                () => {}
              );
            }
          }
          if (result.status !== 'failed') break;
        }

        if (result.status === 'failed') {
          result = {
            ...result,
            error: `所选模型的全部通道均不可用：${aiNodeFailoverErrors.join('；')}`,
          };
        }
      }

      // SenseNova 多密钥重试: 当前秘钥失败自动切换备用秘钥
      const sensenovaBackupKey = resolveSensenovaBackupApiKey(apiKey);
      if (
        !forceStoryboardDoubaoSeedreamOnly &&
        !aiNodeFailoverCandidates &&
        ALLOW_CHARGEABLE_MODEL_RETRY &&
        result.status === 'failed' &&
        providerName === 'sensenova' &&
        sensenovaBackupKey
      ) {
        const errLower = String(result.error || '').toLowerCase();
        const isQuotaError =
          errLower.includes('quota') ||
          errLower.includes('insufficient') ||
          errLower.includes('余额') ||
          errLower.includes('额度') ||
          errLower.includes('unauthorized') ||
          errLower.includes('invalid api key') ||
          errLower.includes('exceeded') ||
          errLower.includes('401') ||
          errLower.includes('402') ||
          errLower.includes('403') ||
          errLower.includes('429');
        if (isQuotaError) {
          logger.warn(`[Image] SenseNova 当前秘钥失败，切换到备用秘钥重试: ${result.error}`);
          const retryConfig: ApiProviderConfig = { ...apiConfig, apiKey: sensenovaBackupKey };
          const retryResult = await unifiedApiService.generateImage(imageParams, retryConfig);
          if (retryResult.status !== 'failed') {
            result = retryResult;
            apiKey = sensenovaBackupKey;
            logger.info('[Image] SenseNova 备用秘钥重试成功');
          } else {
            logger.error(`[Image] SenseNova 备用秘钥也失败: ${retryResult.error}`);
          }
        }
      }

      if (
        !forceStoryboardDoubaoSeedreamOnly &&
        !aiNodeFailoverCandidates &&
        ALLOW_CHARGEABLE_MODEL_RETRY &&
        result.status === 'failed' &&
        providerName === 'stepfun'
      ) {
        const errLower = String(result.error || '').toLowerCase();
        const isRecoverableKeyError =
          errLower.includes('quota') ||
          errLower.includes('insufficient') ||
          errLower.includes('余额') ||
          errLower.includes('额度') ||
          errLower.includes('unauthorized') ||
          errLower.includes('invalid api key') ||
          errLower.includes('exceeded') ||
          errLower.includes('401') ||
          errLower.includes('402') ||
          errLower.includes('403') ||
          errLower.includes('429') ||
          errLower.includes('rate limit') ||
          errLower.includes('invalid request format');
        const retryKeys = resolveStepfunBackupApiKeys(apiKey);
        if (isRecoverableKeyError && retryKeys.length > 0) {
          for (const retryKey of retryKeys) {
            logger.warn(`[Image] StepFun 当前秘钥失败，切换备用秘钥重试: ${result.error}`);
            const retryConfig: ApiProviderConfig = { ...apiConfig, apiKey: retryKey };
            const retryResult = await unifiedApiService.generateImage(imageParams, retryConfig);
            if (retryResult.status !== 'failed') {
              result = retryResult;
              apiKey = retryKey;
              logger.info('[Image] StepFun 备用秘钥重试成功');
              break;
            }
            logger.error(`[Image] StepFun 备用秘钥也失败: ${retryResult.error}`);
          }
        }

        // StepFun 所有密钥均失败时，回退到 SenseNova U1 Fast
        if (result.status === 'failed') {
          const sensenovaKey = resolveSensenovaApiKey();
          if (sensenovaKey) {
            logger.warn(`[Image] StepFun 所有密钥失败，回退到 SenseNova U1 Fast: ${result.error}`);
            const sensenovaConfig: ApiProviderConfig = {
              apiKey: sensenovaKey,
              endpoint: SENSENOVA_ENDPOINT,
            };
            const fallbackParams = {
              ...imageParams,
              provider: 'sensenova',
              model: 'sensenova-u1-fast',
            };
            const fallbackResult = await unifiedApiService.generateImage(
              fallbackParams,
              sensenovaConfig
            );
            if (fallbackResult.status !== 'failed') {
              result = fallbackResult;
              providerName = 'sensenova';
              apiKey = sensenovaKey;
              logger.info('[Image] StepFun 回退到 SenseNova 成功');
            } else {
              logger.error(`[Image] SenseNova 回退也失败: ${fallbackResult.error}`);
            }
          }
        }
      }

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

      // wuyinkeji 失败时回退到 SenseNova U1 Fast
      // 已删除 (2026-07-20): 国外 apipaths 失败回退已下线
      if (
        !forceStoryboardDoubaoSeedreamOnly &&
        ALLOW_CHARGEABLE_MODEL_RETRY &&
        result.status === 'failed' &&
        (providerName === 'wuyinkeji')
      ) {
        const sensenovaKey = resolveSensenovaApiKey();
        if (sensenovaKey) {
          logger.warn(
            `[Image] ${providerName} 失败，回退到 SenseNova U1 Fast: ${result.error}`
          );
          const failedProvider = providerName;
          const sensenovaConfig: ApiProviderConfig = {
            apiKey: sensenovaKey,
            endpoint: SENSENOVA_ENDPOINT,
          };
          const fallbackParams = {
            ...imageParams,
            provider: 'sensenova',
            model: 'sensenova-u1-fast',
          };
          const fallbackResult = await unifiedApiService.generateImage(
            fallbackParams,
            sensenovaConfig
          );
          if (fallbackResult.status !== 'failed') {
            result = fallbackResult;
            providerName = 'sensenova';
            apiKey = sensenovaKey;
            markProviderFallback(`${failedProvider} failed, fallback to SenseNova`);
            logger.info(`[Image] ${failedProvider} 回退到 SenseNova 成功`);
          } else {
            logger.error(`[Image] SenseNova 回退也失败: ${fallbackResult.error}`);
          }
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

      // 如果生成成功，原子化扣除积分
      if (result.status === 'completed') {
        try {
          await executeCreditDeduction(req, task.id);
        } catch (pointsError) {
          console.error('[Image] 积分扣除失败:', pointsError);
          logger.error(`[Image] 用户 ${req.userId} 任务 ${task.id} 积分扣除失败:`, pointsError);
          await prisma.task
            .update({
              where: { id: task.id },
              data: {
                status: 'failed',
                error: '积分扣除失败，图片已生成但未扣费，请充值后重试或联系客服',
              },
            })
            .catch((updateError) =>
              logger.error('[Image] 积分扣除失败后标记任务失败异常:', updateError)
            );
          return res.status(402).json({
            success: false,
            error: '积分扣除失败，请充值后重试',
            taskId: task.id,
          });
        }

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
      let pointsBalance: number | undefined;
      if (result.status === 'completed') {
        try {
          const balance = await getBalance(req.userId!);
          pointsBalance = Math.floor(balance.pointsBalance);
        } catch (balanceError) {
          logger.warn('[Image] 读取扣费后积分余额失败', balanceError);
        }
      }
      if (!effectiveResultUrl) {
        if (result.status === 'pending' || result.status === 'processing') {
          return res.status(202).json({
            success: true,
            data: {
              taskId: task.id,
              status: result.status,
              progress: updateData.progress ?? task.progress ?? 0,
              points: (req as any).creditCheck?.pointsNeeded,
              pointsBalance,
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
            pointsBalance,
            actualProvider: providerName,
            actualModel: modelName,
            providerFallback,
          },
        });
      }
      const reviewPending = isTaskAwaitingReview(
        { type: 'image', status: result.status, reviewStatus: task.reviewStatus },
        await isContentReviewEnabled(),
      );
      res.json({
        success: true,
        data: {
          taskId: task.id,
          status: result.status,
          reviewStatus: task.reviewStatus,
          resultAvailable: !reviewPending,
          resultUrl: reviewPending ? undefined : effectiveResultUrl,
          resultUrls: reviewPending ? undefined : (safeResultUrls.length > 1 ? safeResultUrls : undefined),
          error: userError,
          points: (req as any).creditCheck?.pointsNeeded,
          pointsBalance,
          remainingQuota: pointsBalance,
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

    const reviewPending = isTaskAwaitingReview(task, await isContentReviewEnabled());
    if (reviewPending) {
      return res.json({
        success: true,
        data: {
          taskId: task.id,
          status: task.status,
          reviewStatus: task.reviewStatus,
          resultAvailable: false,
          progress: task.progress,
          error: task.error,
        },
      });
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

    // 积分预检
    const membershipLevel = req.membershipLevel || 'trial';
    const creditCheck = await creditService.preCheck({
      userId: req.userId!,
      membershipLevel,
      type: 'prompt',
      customPoints: 80,
      taskId: `img2prompt_${Date.now()}`,
      reason: '图生提示词预检',
    });

    if (!creditCheck.allowed) {
      return res.status(402).json({ success: false, error: creditCheck.reason });
    }

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

    // 成功生成，扣除积分
    await creditService.consume({
      userId: req.userId!,
      membershipLevel,
      type: 'prompt',
      customPoints: 80,
      taskId: `img2prompt_${Date.now()}`,
      reason: '图生提示词',
    });

    return res.json({
      success: true,
      prompt: promptResult.prompt,
      model: promptResult.model,
      points: 80,
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
  withCreditDeduction((req) => {
    const model = String(req.body?.model || 'image-01');
    const provider = String(req.body?.provider || 'minimax');
    const imageCount = normalizeImageCount(req.body?.imageCount);
    const isMinimaxImage = model.startsWith('image-0') || provider === 'minimax';
    return {
      type: 'image' as const,
      amount: imageCount,
      reason: '高级图片生成',
      provider: provider || model || 'minimax',
      customPoints: isMinimaxImage ? 10 * imageCount : undefined,
    };
  }),
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

      try {
        await executeCreditDeduction(req, task.id);
      } catch (pointsError) {
        console.error('[AdvancedImage] 积分扣除失败:', pointsError);
        logger.error(
          `[AdvancedImage] 用户 ${req.userId} 任务 ${task.id} 积分扣除失败:`,
          pointsError
        );
        await prisma.task
          .update({
            where: { id: task.id },
            data: {
              status: 'failed',
              error: '积分扣除失败，图片已生成但未扣费，请充值后重试或联系客服',
            },
          })
          .catch((updateError) =>
            logger.error('[AdvancedImage] 积分扣除失败后标记任务失败异常:', updateError)
          );
        return res.status(402).json({
          success: false,
          error: '积分扣除失败，请充值后重试',
          taskId: task.id,
        });
      }

      websocketPushService.notifyTaskComplete(req.userId!, task.id, { url: resultUrl }, {
        type: 'image',
        provider: task.provider || undefined,
        prompt: task.prompt,
      }).catch(() => {});

      const reviewPending = isTaskAwaitingReview(
        { type: 'image', status: 'completed', reviewStatus: task.reviewStatus },
        await isContentReviewEnabled(),
      );
      res.json({
        success: true,
        data: {
          taskId: task.id,
          status: 'completed',
          reviewStatus: task.reviewStatus,
          resultAvailable: !reviewPending,
          resultUrl: reviewPending ? undefined : resultUrl,
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

    // 积分预检
    const membershipLevel = req.membershipLevel || 'trial';
    const creditCheck = await creditService.preCheck({
      userId: req.userId!,
      membershipLevel,
      type: 'prompt',
      customPoints: 80,
      taskId: `analyze_${Date.now()}`,
      reason: '图片分析预检',
    });

    if (!creditCheck.allowed) {
      return res.status(402).json({ success: false, error: creditCheck.reason });
    }

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

    // 扣除积分
    try {
      await creditService.consume({
        userId: req.userId!,
        membershipLevel,
        type: 'prompt',
        customPoints: 80,
        taskId: task.id,
        reason: '图片分析',
      });
    } catch (err) {
      console.error('[ImageAnalyze] 积分扣除失败:', (err as Error).message);
      await prisma.task
        .update({
          where: { id: task.id },
          data: {
            status: 'failed',
            error: '积分扣除失败，图片分析已生成但未扣费，请充值后重试或联系客服',
          },
        })
        .catch(() => {});
      return res.status(402).json({
        success: false,
        error: '积分扣除失败，请充值后重试',
        taskId: task.id,
      });
    }

    websocketPushService.notifyTaskProgress(req.userId!, task.id, 100).catch(() => {});

    res.json({
      success: true,
      data: {
        taskId: task.id,
        analysis: analysisResult,
        model: validatedData.model,
        points: 80,
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
  withCreditDeduction((req) => ({ type: 'image', reason: '局部重绘', customPoints: 80 })),
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

      try {
        await executeCreditDeduction(req, task.id);
      } catch (pointsError) {
        console.error('[Inpaint] 积分扣除失败:', pointsError);
        await prisma.task
          .update({
            where: { id: task.id },
            data: {
              status: 'failed',
              error: '积分扣除失败，图片已生成但未扣费，请充值后重试或联系客服',
            },
          })
          .catch(() => {});
        return res.status(402).json({
          success: false,
          error: '积分扣除失败，请充值后重试',
          taskId: task.id,
        });
      }

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
  withCreditDeduction((req) => ({ type: 'image', reason: '画布扩展', customPoints: 10 })),
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

      try {
        await executeCreditDeduction(req, task.id);
      } catch (pointsError) {
        console.error('[Outpaint] 积分扣除失败:', pointsError);
        await prisma.task
          .update({
            where: { id: task.id },
            data: {
              status: 'failed',
              error: '积分扣除失败，图片已生成但未扣费，请充值后重试或联系客服',
            },
          })
          .catch(() => {});
        return res.status(402).json({
          success: false,
          error: '积分扣除失败，请充值后重试',
          taskId: task.id,
        });
      }

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

/** POST /composite-poster —
服务端合成Logo和二维码到海报上（使用sharp，绕过浏览器CORS）*/
imageRouter.post('/composite-poster', authenticate, async (req, res, next) => {
  let posterGenerationRunId: string | undefined;
  try {
    const {
      imageUrl,
      logoBase64,
      qrCodeBase64,
      logoSettings,
      qrSettings,
      textOverlays,
      watermark,
      borderStyle,
      requiredLayers,
      generationRunId,
    } = req.body as {
      imageUrl?: string;
      logoBase64?: string;
      qrCodeBase64?: string;
      logoSettings?: {
        scale?: number;
        offsetX?: number;
        offsetY?: number;
        opacity?: number;
        borderRadius?: number;
      };
      qrSettings?: {
        scale?: number;
        offsetX?: number;
        offsetY?: number;
        opacity?: number;
        borderRadius?: number;
      };
      textOverlays?: Array<{
        text: string;
        x: number;
        y: number;
        fontSize?: number;
        color?: string;
        fontFamily?: string;
        fontWeight?: string;
        opacity?: number;
        variant?:
          | 'title'
          | 'solar-title'
          | 'festival-title'
          | 'subtitle'
          | 'meta'
          | 'body'
          | 'seal'
          | 'ornament'
          | 'header-band'
          | 'decor-svg'
          | 'divider-line'
          | 'info-icon-strip'
          | 'info-card'
          | 'meta-strip'
          | 'badge'
          | 'couplet'
          | 'couplet-scroll';
        bandPalette?: { bandTop?: string; bandMid?: string; lineAccent?: string };
        decorId?: string;
        accentColor?: string;
        infoStripItems?: Array<{ icon?: string; text?: string }>;
        cardIndex?: number;
        sealShape?: 'circle' | 'square';
        layoutId?: string;
        letterSpacing?: number;
        tiltAngle?: number;
      }>;
      watermark?: { text: string; opacity?: number; fontSize?: number; color?: string };
      borderStyle?: { width?: number; color?: string; radius?: number };
      requiredLayers?: Array<'logo' | 'qr' | 'watermark'>;
      generationRunId?: string;
    };
    posterGenerationRunId = generationRunId;
    if (!imageUrl || typeof imageUrl !== 'string') {
      throw new AppError('缺少imageUrl参数', 400);
    }
    if (posterGenerationRunId) {
      const run = await prisma.posterGenerationRun.findFirst({
        where: { id: posterGenerationRunId, project: { userId: req.userId! } },
        select: { id: true },
      });
      if (!run) throw new AppError('海报生成任务不存在或无权访问', 404);
    }
    const requestedRequiredLayers = Array.isArray(requiredLayers) ? requiredLayers : [];
    const missingRequiredInputs = requestedRequiredLayers.filter(
      (layer) =>
        (layer === 'logo' && !logoBase64) ||
        (layer === 'qr' && !qrCodeBase64) ||
        (layer === 'watermark' && !watermark?.text)
    );
    if (missingRequiredInputs.length) {
      throw new AppError(`缺少必需合成图层：${missingRequiredInputs.join('、')}`, 400);
    }

    // 动态导入sharp
    const sharp = (await import('sharp')).default;

    // 1. 获取底图
    let baseBuffer: Buffer;
    if (imageUrl.startsWith('data:')) {
      const dataMatch = imageUrl.match(/^data:[^;]+;base64,(.+)$/);
      if (!dataMatch) throw new AppError('无效的data URL', 400);
      baseBuffer = Buffer.from(dataMatch[1], 'base64');
    } else {
      // 通过代理获取远程图片
      const imgResp = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'image/*,*/*;q=0.8',
        },
      });
      baseBuffer = Buffer.from(imgResp.data);
    }

    const baseMeta = await sharp(baseBuffer).metadata();
    const baseWidth = baseMeta.width || 800;
    const baseHeight = baseMeta.height || 1200;

    const cornerSpec = {
      // Keep the visible brand mark compact and high in the reserved corner.
      // Logo assets are trimmed below, so transparent source padding never
      // makes the mark look low or oversized on the finished poster.
      logo: { marginX: 0.04, marginY: 0.012, width: 0.14 },
      qr: { marginX: 0.04, marginY: 0.03, width: 0.16 },
    } as const;
    const logoPadX = Math.round(baseWidth * cornerSpec.logo.marginX);
    const logoPadY = Math.round(baseHeight * cornerSpec.logo.marginY);
    const qrPadX = Math.round(baseWidth * cornerSpec.qr.marginX);
    const qrPadY = Math.round(baseHeight * cornerSpec.qr.marginY);

    const composites: Array<{ input: Buffer; left: number; top: number }> = [];
    // Brand assets must remain above any optional text/watermark overlays.
    const cornerComposites: Array<{ input: Buffer; left: number; top: number }> = [];

    // 2. 合成Logo（左上角，与前端预留区一致：4%/1.2%边距，宽14%）
    if (logoBase64 && typeof logoBase64 === 'string') {
      let logoBuffer: Buffer;
      if (logoBase64.startsWith('data:')) {
        const m = logoBase64.match(/^data:[^;]+;base64,(.+)$/);
        if (!m) throw new AppError('无效的Logo data URL', 400);
        logoBuffer = Buffer.from(m[1], 'base64');
      } else {
        // 如果是URL，获取图片
        const logoResp = await axios.get(logoBase64, {
          responseType: 'arraybuffer',
          timeout: 15000,
        });
        logoBuffer = Buffer.from(logoResp.data);
      }

      // Brand files often include a transparent export canvas. Trim it before
      // measuring and resizing so the visible mark, not its blank padding,
      // controls the final size and top-left placement.
      logoBuffer = await sharp(logoBuffer)
        .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      const logoMeta = await sharp(logoBuffer).metadata();
      const logoW = logoMeta.width || 100;
      const logoH = logoMeta.height || 100;
      const logoScale = logoSettings?.scale ?? 1;
      const targetW = Math.round(baseWidth * cornerSpec.logo.width * logoScale);
      const targetH = Math.round((logoH / logoW) * targetW);

      let resizedLogo = await sharp(logoBuffer)
        .resize(targetW, targetH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

      if (logoSettings?.borderRadius && logoSettings.borderRadius > 0) {
        const r = Math.min(logoSettings.borderRadius, Math.round(targetW / 2));
        const roundedMask = Buffer.from(
          `<svg width="${targetW}" height="${targetH}"><rect width="${targetW}" height="${targetH}" rx="${r}" ry="${r}" fill="white"/></svg>`
        );
        resizedLogo = await sharp(resizedLogo)
          .composite([{ input: roundedMask, blend: 'dest-in' as any }])
          .png()
          .toBuffer();
      }

      const logoOpacity = logoSettings?.opacity ?? 1;
      if (logoOpacity < 1) {
        const opacityBuf = await sharp(resizedLogo).metadata();
        const ow = opacityBuf.width || targetW;
        const oh = opacityBuf.height || targetH;
        const overlay = Buffer.from(
          `<svg width="${ow}" height="${oh}"><rect width="${ow}" height="${oh}" fill="white" opacity="${logoOpacity}"/></svg>`
        );
        resizedLogo = await sharp(resizedLogo)
          .composite([{ input: overlay, blend: 'dest-in' as any }])
          .png()
          .toBuffer();
      }

      cornerComposites.push({
        input: resizedLogo,
        left: logoPadX + (logoSettings?.offsetX ?? 0),
        top: logoPadY + (logoSettings?.offsetY ?? 0),
      });
    }

    // 3. 合成二维码（右下角，与前端预留区一致：4%/3%边距，宽16%）
    if (qrCodeBase64 && typeof qrCodeBase64 === 'string') {
      let qrBuffer: Buffer;
      if (qrCodeBase64.startsWith('data:')) {
        const m = qrCodeBase64.match(/^data:[^;]+;base64,(.+)$/);
        if (!m) throw new AppError('无效的二维码data URL', 400);
        qrBuffer = Buffer.from(m[1], 'base64');
      } else {
        const qrResp = await axios.get(qrCodeBase64, {
          responseType: 'arraybuffer',
          timeout: 15000,
        });
        qrBuffer = Buffer.from(qrResp.data);
      }

      const qrMeta = await sharp(qrBuffer).metadata();
      const qrW = qrMeta.width || 100;
      const qrH = qrMeta.height || 100;
      const qrScale = qrSettings?.scale ?? 1;
      const targetW = Math.round(baseWidth * cornerSpec.qr.width * qrScale);
      const targetH = Math.round((qrH / qrW) * targetW);

      let resizedQr = await sharp(qrBuffer)
        .resize(targetW, targetH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

      if (qrSettings?.borderRadius && qrSettings.borderRadius > 0) {
        const r = Math.min(qrSettings.borderRadius, Math.round(targetW / 2));
        const roundedMask = Buffer.from(
          `<svg width="${targetW}" height="${targetH}"><rect width="${targetW}" height="${targetH}" rx="${r}" ry="${r}" fill="white"/></svg>`
        );
        resizedQr = await sharp(resizedQr)
          .composite([{ input: roundedMask, blend: 'dest-in' as any }])
          .png()
          .toBuffer();
      }

      const qrOpacity = qrSettings?.opacity ?? 1;
      if (qrOpacity < 1) {
        const opacityMeta = await sharp(resizedQr).metadata();
        const ow = opacityMeta.width || targetW;
        const oh = opacityMeta.height || targetH;
        const overlay = Buffer.from(
          `<svg width="${ow}" height="${oh}"><rect width="${ow}" height="${oh}" fill="white" opacity="${qrOpacity}"/></svg>`
        );
        resizedQr = await sharp(resizedQr)
          .composite([{ input: overlay, blend: 'dest-in' as any }])
          .png()
          .toBuffer();
      }

      const left = baseWidth - targetW - qrPadX + (qrSettings?.offsetX ?? 0);
      const top = baseHeight - targetH - qrPadY + (qrSettings?.offsetY ?? 0);
      cornerComposites.push({
        input: resizedQr,
        left,
        top,
      });
    }

    // 3.5 文字叠加
    if (textOverlays && Array.isArray(textOverlays) && textOverlays.length > 0) {
      const aspect = baseHeight / Math.max(baseWidth, 1);
      const isTallPoster = aspect >= 1.45;
      const holidayVariants = new Set([
        'title',
        'solar-title',
        'festival-title',
        'subtitle',
        'meta',
        'badge',
        'body',
        'couplet',
        'couplet-scroll',
        'seal',
        'ornament',
        'header-band',
      ]);
      const isCommercialOverlay = (overlay: { layoutId?: string }) =>
        String(overlay.layoutId || '').startsWith('commercial-');
      const resolveFontScale = (variant: string, overlay: { layoutId?: string }) => {
        if (isTallPoster && holidayVariants.has(variant) && !isCommercialOverlay(overlay)) {
          return Math.max(0.95, Math.min(2.95, baseHeight / 2000));
        }
        return Math.max(0.72, Math.min(2.25, baseWidth / 800));
      };

      const hasHolidayHeader = textOverlays.some((overlay) => overlay.variant === 'header-band');
      const isSolarHeader = textOverlays.some((overlay) => overlay.variant === 'solar-title');
      const headerBandOverlay = textOverlays.find((overlay) => overlay.variant === 'header-band');
      const bandTop =
        headerBandOverlay?.bandPalette?.bandTop ||
        (isSolarHeader ? 'rgba(8,32,24,0.58)' : 'rgba(72,12,12,0.62)');
      const bandMid =
        headerBandOverlay?.bandPalette?.bandMid ||
        (isSolarHeader ? 'rgba(8,32,24,0.28)' : 'rgba(72,12,12,0.26)');
      const lineAccent =
        headerBandOverlay?.bandPalette?.lineAccent ||
        (isSolarHeader ? 'rgba(201,220,169,0.55)' : 'rgba(231,201,106,0.72)');
      const headerBandSvg = hasHolidayHeader
        ? `<defs><linearGradient id="posterHeaderBand" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="${bandTop}"/><stop offset="55%" stop-color="${bandMid}"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></linearGradient></defs><rect x="0" y="0" width="${baseWidth}" height="${Math.round(baseHeight * 0.34)}" fill="url(#posterHeaderBand)"/><line x1="${Math.round(baseWidth * 0.12)}" y1="${Math.round(baseHeight * 0.31)}" x2="${Math.round(baseWidth * 0.88)}" y2="${Math.round(baseHeight * 0.31)}" stroke="${lineAccent}" stroke-width="${Math.max(1.5, Math.round(baseWidth * 0.0015))}" opacity="0.85"/>`
        : '';

      const textSvgParts = textOverlays
        .map((overlay) => {
          const variant = overlay.variant || 'body';
          if (variant === 'header-band') return '';

          const normalizedText = String(overlay.text || '')
            .replace(/\s+/g, ' ')
            .trim();
          if (!normalizedText && variant !== 'decor-svg' && variant !== 'divider-line') return '';
          const x = Math.round((overlay.x / 100) * baseWidth);
          // Keep the primary title optically closer to the fixed upper-left logo.
          // This affects title text only; QR code, logo, subtitle and main visual remain unchanged.
          const y = Math.round((overlay.y / 100) * baseHeight) - (variant === 'title' ? 5 : 0);
          const commercialOverlay = isCommercialOverlay(overlay);
          const fontScale = resolveFontScale(variant, overlay);
          const fontSize = Math.round((overlay.fontSize || 32) * fontScale);
          const color = overlay.color || '#FFFFFF';
          const fontWeight = overlay.fontWeight || 'bold';
          const opacity = overlay.opacity ?? 1;
          const textAnchor =
            overlay.x >= 45 && overlay.x <= 55 ? 'middle' : overlay.x >= 70 ? 'middle' : 'start';
          const isCommercialTitle = commercialOverlay && variant === 'title';
          const isHolidayTitle = variant === 'title' && !commercialOverlay;
          const isCommercialSubtitle = commercialOverlay && variant === 'subtitle';
          const titleLike =
            variant === 'title' || variant === 'solar-title' || variant === 'festival-title';
          const lineHeight = Math.round(fontSize * (titleLike ? 1.08 : 1.22));
          const isCjk = /[\u4e00-\u9fa5]/.test(normalizedText);
          const maxTextWidth =
            baseWidth * (titleLike ? 0.72 : fontSize >= 40 * fontScale ? 0.76 : 0.72);
          const maxChars = Math.max(
            4,
            Math.floor(maxTextWidth / (fontSize * (isCjk ? 0.96 : 0.56)))
          );
          const chunks = isCjk ? Array.from(normalizedText) : normalizedText.split(' ');
          const lines: string[] = [];
          let current = '';

          const escapeSvg = (value: string) =>
            value
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;');

          if (variant === 'decor-svg' && overlay.decorId) {
            const decorPaths: Record<string, string> = {
              cloud:
                'M18 38 C8 38 4 30 10 24 C6 16 16 12 24 16 C30 8 44 8 50 16 C58 10 72 14 74 24 C84 22 92 30 86 38 Z',
              lantern:
                'M40 6 L46 14 L34 14 Z M32 14 H48 V22 H32 Z M28 22 H52 C56 22 58 26 58 30 V86 C58 94 52 100 44 102 V110 H36 V102 C28 100 22 94 22 86 V30 C22 26 24 22 28 22 Z',
              osmanthus:
                'M50 18 C54 30 62 34 72 32 C64 40 64 50 72 58 C62 54 54 58 50 70 C46 58 38 54 28 58 C36 50 36 40 28 32 C38 34 46 30 50 18 Z',
              plum: 'M50 20 C46 34 36 40 24 38 C34 46 36 58 30 68 C42 60 50 66 50 80 C50 66 58 60 70 68 C64 58 66 46 76 38 C64 40 54 34 50 20 Z',
            };
            const decorPath = decorPaths[String(overlay.decorId)] || decorPaths.cloud;
            const size = Math.round(baseWidth * 0.12);
            const tx = x - size / 2;
            const ty = y - size / 2;
            const scale = size / 100;
            return `<g opacity="${opacity}" transform="translate(${tx} ${ty}) scale(${scale})"><path d="${decorPath}" fill="${color}" stroke="rgba(231,201,106,0.65)" stroke-width="2"/></g>`;
          }

          if (variant === 'divider-line') {
            const accent = overlay.accentColor || '#60A5FA';
            const lineWidth = Math.round(baseWidth * 0.22);
            return `<line x1="${x - lineWidth / 2}" y1="${y}" x2="${x + lineWidth / 2}" y2="${y}" stroke="${accent}" stroke-width="2" opacity="0.85"/>`;
          }

          if (
            variant === 'info-icon-strip' &&
            Array.isArray(overlay.infoStripItems) &&
            overlay.infoStripItems.length > 0
          ) {
            const stripWidth = Math.round(baseWidth * 0.84);
            const padY = Math.round(fontSize * 0.45);
            const boxH = fontSize + padY * 2;
            const boxX = x - stripWidth / 2;
            const slotWidth = stripWidth / overlay.infoStripItems.length;
            const itemSvg = overlay.infoStripItems
              .map((item: { icon?: string; text?: string }, index: number) => {
                const slotX = boxX + slotWidth * index + slotWidth / 2;
                return `<circle cx="${slotX - fontSize * 0.95}" cy="${y + padY + fontSize * 0.48}" r="${Math.round(fontSize * 0.41)}" fill="rgba(231,201,106,0.82)"/><text x="${slotX - fontSize * 0.95}" y="${y + padY + fontSize * 0.52}" font-size="${Math.round(fontSize * 0.55)}" fill="#5C1A07" font-weight="700" text-anchor="middle">${escapeSvg(String(item.icon || ''))}</text><text x="${slotX - fontSize * 0.35}" y="${y + padY + fontSize}" font-size="${fontSize}" fill="${color}" font-weight="${fontWeight}" text-anchor="start">${escapeSvg(String(item.text || ''))}</text>`;
              })
              .join('');
            return `<g opacity="${opacity}"><rect x="${boxX}" y="${y}" width="${stripWidth}" height="${boxH}" rx="${Math.round(boxH * 0.35)}" fill="rgba(72,12,12,0.32)" stroke="rgba(231,201,106,0.38)" stroke-width="1"/>${itemSvg}</g>`;
          }

          if (variant === 'info-card') {
            const accent = overlay.accentColor || '#60A5FA';
            const cardIndex = Number(overlay.cardIndex || 0);
            const padX = Math.round(fontSize * 0.55);
            const padY = Math.round(fontSize * 0.38);
            const cardWidth = Math.round(baseWidth * (cardIndex === 0 ? 0.42 : 0.78));
            const textWidth = Math.round(normalizedText.length * fontSize * 0.92);
            const boxW = Math.min(
              cardWidth,
              textWidth + padX * 2 + (cardIndex > 0 ? fontSize * 1.2 : 0)
            );
            const boxH = fontSize + padY * 2;
            const boxX = overlay.x >= 45 ? x - boxW / 2 : x;
            const badgeSvg =
              cardIndex > 0
                ? `<circle cx="${boxX + Math.round(padX * 0.55 + fontSize * 0.58)}" cy="${y + Math.round(boxH / 2)}" r="${Math.round(fontSize * 0.58)}" fill="${accent}"/><text x="${boxX + Math.round(padX * 0.55 + fontSize * 0.58)}" y="${y + Math.round(boxH / 2 + fontSize * 0.18)}" font-size="${Math.round(fontSize * 0.72)}" fill="#0B1220" font-weight="700" text-anchor="middle">${cardIndex}</text>`
                : '';
            const textX = cardIndex > 0 ? boxX + padX + Math.round(fontSize * 1.2) : boxX + padX;
            return `<g opacity="${opacity}"><rect x="${boxX}" y="${y}" width="${boxW}" height="${boxH}" rx="${Math.round(boxH * 0.28)}" fill="rgba(8,14,28,0.58)" stroke="rgba(148,163,184,0.28)" stroke-width="1"/><rect x="${boxX}" y="${y}" width="${Math.max(4, Math.round(fontSize * 0.12))}" height="${boxH}" fill="${accent}"/>${badgeSvg}<text x="${textX}" y="${y + padY + fontSize}" font-size="${fontSize}" fill="${color}" font-weight="${fontWeight}" text-anchor="start" font-family="Microsoft YaHei, sans-serif">${escapeSvg(normalizedText)}</text></g>`;
          }

          if (variant === 'meta-strip') {
            const accent = overlay.accentColor || '#60A5FA';
            const stripWidth = Math.round(baseWidth * 0.84);
            const padY = Math.round(fontSize * 0.42);
            const boxH = fontSize + padY * 2;
            const boxX = x - stripWidth / 2;
            return `<g opacity="${opacity}"><rect x="${boxX}" y="${y}" width="${stripWidth}" height="${boxH}" rx="${Math.round(boxH * 0.35)}" fill="rgba(8,14,28,0.5)" stroke="rgba(148,163,184,0.22)" stroke-width="1"/><rect x="${boxX}" y="${y + boxH - 3}" width="${stripWidth}" height="3" fill="${accent}"/><text x="${x}" y="${y + padY + fontSize}" font-size="${fontSize}" fill="${color}" font-weight="${fontWeight}" text-anchor="middle" font-family="Microsoft YaHei, sans-serif">${escapeSvg(normalizedText)}</text></g>`;
          }

          if (variant === 'badge') {
            const padX = Math.round(fontSize * 0.55);
            const padY = Math.round(fontSize * 0.28);
            const boxW = Math.round(normalizedText.length * fontSize * 0.92 + padX * 2);
            const boxH = fontSize + padY * 2;
            if (commercialOverlay) {
              return `<g opacity="${opacity}"><rect x="${x - boxW / 2}" y="${y - Math.round(padY * 0.35)}" width="${boxW}" height="${boxH}" rx="${Math.round(boxH * 0.45)}" fill="rgba(8,14,28,0.42)" stroke="rgba(231,201,106,0.72)" stroke-width="${Math.max(1, Math.round(fontSize * 0.05))}"/><text x="${x}" y="${y + fontSize * 0.82}" font-size="${fontSize}" fill="${color}" font-weight="${fontWeight}" text-anchor="middle" font-family="Microsoft YaHei, PingFang SC, Noto Sans CJK SC, sans-serif" filter="url(#posterCommercialTextShadow)">${escapeSvg(normalizedText)}</text></g>`;
            }
            return `<g opacity="${opacity}"><rect x="${x - boxW / 2}" y="${y - Math.round(padY * 0.35)}" width="${boxW}" height="${boxH}" rx="${Math.round(boxH * 0.45)}" fill="rgba(0,0,0,0.22)" stroke="rgba(231,201,106,0.72)" stroke-width="${Math.max(1.5, Math.round(fontSize * 0.06))}"/><text x="${x}" y="${y + fontSize * 0.82}" font-size="${fontSize}" fill="${color}" font-weight="${fontWeight}" text-anchor="middle" font-family="STKaiti, KaiTi, Microsoft YaHei, serif" filter="url(#posterTextShadow)">${escapeSvg(normalizedText)}</text></g>`;
          }

          if (variant === 'seal') {
            const boxSize = Math.round(fontSize * 2.35);
            const isCircle = overlay.sealShape === 'circle';
            const chars = Array.from(normalizedText).slice(0, 4);
            const rows =
              chars.length > 2
                ? [chars.slice(0, 2).join(''), chars.slice(2).join('')]
                : [chars.join('')];
            const rowSvg = rows
              .map((line, index) => {
                const dy = (index - (rows.length - 1) / 2) * fontSize * 0.95;
                return `<text x="0" y="${dy}" font-size="${fontSize}" fill="${color}" font-weight="${fontWeight}" text-anchor="middle" dominant-baseline="middle" font-family="STKaiti, KaiTi, Microsoft YaHei, serif">${escapeSvg(line)}</text>`;
              })
              .join('');
            const shapeSvg = isCircle
              ? `<circle cx="0" cy="0" r="${boxSize / 2}" fill="rgba(127,29,29,0.2)" stroke="rgba(248,113,113,0.92)" stroke-width="${Math.max(2.5, Math.round(fontSize * 0.1))}"/>`
              : `<rect x="${-boxSize / 2}" y="${-boxSize / 2}" width="${boxSize}" height="${boxSize}" rx="${Math.round(boxSize * 0.1)}" fill="rgba(127,29,29,0.2)" stroke="rgba(248,113,113,0.92)" stroke-width="${Math.max(2.5, Math.round(fontSize * 0.1))}"/>`;
            return `<g transform="translate(${x} ${y}) rotate(-5)">${shapeSvg}${rowSvg}</g>`;
          }

          if (variant === 'ornament') {
            const lineWidth = Math.round(baseWidth * 0.34);
            return `<g opacity="${opacity}"><line x1="${x - lineWidth / 2}" y1="${y + fontSize * 0.42}" x2="${x + lineWidth / 2}" y2="${y + fontSize * 0.42}" stroke="url(#posterOrnamentGradient)" stroke-width="${Math.max(2.5, Math.round(fontSize * 0.09))}" stroke-linecap="round"/><text x="${x}" y="${y + fontSize * 0.46}" font-size="${fontSize}" fill="${color}" text-anchor="middle" dominant-baseline="middle" filter="url(#posterTextShadow)">${escapeSvg(normalizedText)}</text></g>`;
          }

          if (variant === 'couplet') {
            const bracketed = `「${normalizedText}」`;
            return `<g opacity="${opacity}"><text x="${x}" y="${y + fontSize}" font-size="${fontSize}" fill="${color}" font-weight="${fontWeight}" text-anchor="${textAnchor}" dominant-baseline="text-before-edge" font-family="STKaiti, KaiTi, Microsoft YaHei, serif" stroke="#5C1A07" stroke-opacity="0.72" stroke-width="${Math.max(2, Math.round(fontSize * 0.09))}" paint-order="stroke fill" filter="url(#posterTextShadow)">${escapeSvg(bracketed)}</text></g>`;
          }

          if (variant === 'couplet-scroll') {
            const chars = Array.from(normalizedText)
              .filter((ch) => ch.trim())
              .slice(0, 8);
            const charGap = Math.round(fontSize * 0.18);
            const panelPadX = Math.round(fontSize * 0.42);
            const panelPadY = Math.round(fontSize * 0.35);
            const panelW = fontSize + panelPadX * 2;
            const panelH = chars.length * (fontSize * 0.96 + charGap) + panelPadY * 2;
            const panelX = x - panelW / 2;
            const panelY = y - Math.round(panelPadY * 0.2);
            const charSpans = chars
              .map((char, index) => {
                const lineY = panelY + panelPadY + index * (fontSize * 0.96 + charGap);
                return `<text x="${x}" y="${lineY + fontSize}" font-size="${fontSize}" fill="${color}" font-weight="${fontWeight}" text-anchor="middle" dominant-baseline="text-before-edge" font-family="STKaiti, KaiTi, Microsoft YaHei, serif" stroke="#5C1A07" stroke-opacity="0.72" stroke-width="${Math.max(1.5, Math.round(fontSize * 0.07))}" paint-order="stroke fill" filter="url(#posterTextShadow)">${escapeSvg(char)}</text>`;
              })
              .join('');
            return `<g opacity="${opacity}"><rect x="${panelX}" y="${panelY}" width="${panelW}" height="${panelH}" rx="${Math.round(fontSize * 0.16)}" fill="rgba(72,12,12,0.35)" stroke="rgba(231,201,106,0.78)" stroke-width="${Math.max(2, Math.round(fontSize * 0.07))}"/><rect x="${panelX + Math.round(fontSize * 0.08)}" y="${panelY + Math.round(fontSize * 0.08)}" width="${panelW - Math.round(fontSize * 0.16)}" height="${panelH - Math.round(fontSize * 0.16)}" rx="${Math.round(fontSize * 0.12)}" fill="none" stroke="rgba(255,236,180,0.42)" stroke-width="${Math.max(1, Math.round(fontSize * 0.03))}"/>${charSpans}</g>`;
          }

          chunks.forEach((chunk) => {
            const separator = isCjk ? '' : ' ';
            const next = current ? `${current}${separator}${chunk}` : chunk;
            if (next.length <= maxChars || !current) {
              current = next;
            } else {
              lines.push(current);
              current = chunk;
            }
          });
          if (current) lines.push(current);

          const tSpans = lines
            .slice(
              0,
              isHolidayTitle
                ? 1
                : variant === 'solar-title' || variant === 'festival-title'
                  ? 2
                  : fontSize >= 40 * fontScale
                    ? 2
                    : 3
            )
            .map((line, index) => {
              return `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeSvg(line)}</tspan>`;
            })
            .join('');

          const fill = isCommercialTitle
            ? 'url(#posterCommercialTitleGradient)'
            : variant === 'title' || variant === 'festival-title'
              ? 'url(#posterTitleGradient)'
              : variant === 'solar-title'
                ? 'url(#posterSolarTitleGradient)'
                : isCommercialSubtitle
                  ? color
                  : variant === 'subtitle'
                    ? 'url(#posterSubtitleGradient)'
                    : color;
          const stroke = isCommercialTitle
            ? '#071426'
            : variant === 'title' || variant === 'festival-title'
              ? '#5C1A07'
              : variant === 'solar-title'
                ? '#2F4F2F'
                : isCommercialSubtitle
                  ? '#071426'
                  : variant === 'subtitle'
                    ? '#033630'
                    : '#000000';
          const strokeOpacity = isCommercialTitle
            ? 0.62
            : isCommercialSubtitle
              ? 0.45
              : variant === 'title' || variant === 'festival-title'
                ? 0.88
                : variant === 'solar-title'
                  ? 0.8
                  : variant === 'subtitle'
                    ? 0.72
                    : 0.45;
          const strokeWidth = Math.max(
            2,
            Math.round(
              fontSize *
                (isCommercialTitle
                  ? 0.075
                  : isCommercialSubtitle
                    ? 0.055
                    : variant === 'title' || variant === 'festival-title'
                      ? 0.15
                      : variant === 'solar-title'
                        ? 0.12
                        : variant === 'subtitle'
                          ? 0.1
                          : 0.08)
            )
          );
          const sparkWidth = Math.max(12, Math.round(fontSize * 0.2));
          const sparkleOffset = Math.min(maxTextWidth * 0.44, fontSize * 2.3);
          const sparkle = isHolidayTitle
            ? `<text x="${x - sparkleOffset}" y="${y + fontSize * 0.44}" font-size="${sparkWidth}" fill="rgba(255,255,255,0.58)" text-anchor="middle">◆</text><text x="${x + sparkleOffset}" y="${y + fontSize * 0.44}" font-size="${sparkWidth}" fill="rgba(255,255,255,0.58)" text-anchor="middle">◆</text>`
            : '';
          const fontFamily = commercialOverlay
            ? 'Microsoft YaHei, PingFang SC, Noto Sans CJK SC, sans-serif'
            : 'STKaiti, KaiTi, Microsoft YaHei, SimHei, Noto Sans CJK SC, Arial Unicode MS, sans-serif';
          const textFilter = commercialOverlay
            ? 'url(#posterCommercialTextShadow)'
            : 'url(#posterTextShadow)';

          if (variant === 'solar-title' || variant === 'festival-title') {
            const chars = Array.from(normalizedText)
              .filter((ch) => ch.trim())
              .slice(0, 4);
            const colGap = Math.round(fontSize * 0.14);
            const vertical = chars
              .map((char, index) => {
                const lineY = y + index * (fontSize * 0.94 + colGap);
                const esc = escapeSvg(char);
                return `<text x="${x}" y="${lineY}" font-size="${fontSize}" fill="${fill}" font-weight="${fontWeight}" text-anchor="middle" dominant-baseline="text-before-edge" font-family="STKaiti, KaiTi, Microsoft YaHei, serif" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}" paint-order="stroke fill" filter="url(#posterTextShadow)">${esc}</text>`;
              })
              .join('');
            const railX = variant === 'festival-title' ? x - fontSize * 0.72 : x + fontSize * 0.74;
            return `<g opacity="${opacity}">${vertical}<path d="M${railX} ${y - fontSize * 0.12} L${railX} ${y + chars.length * fontSize * 0.96}" stroke="${variant === 'festival-title' ? 'rgba(231,201,106,0.72)' : 'rgba(220,234,210,0.72)'}" stroke-width="${Math.max(1, Math.round(fontSize * 0.028))}" stroke-linecap="round" opacity="0.58"/></g>`;
          }

          return `<g opacity="${opacity}">${sparkle}<text x="${x}" y="${y}" font-size="${fontSize}" fill="${fill}" font-weight="${fontWeight}" text-anchor="${textAnchor}" dominant-baseline="text-before-edge" font-family="${fontFamily}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}" paint-order="stroke fill" filter="${textFilter}">${tSpans}</text></g>`;
        })
        .join('');
      const textSvg = Buffer.from(
        `<svg width="${baseWidth}" height="${baseHeight}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="posterCommercialTitleGradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="46%" stop-color="#F7E7A1"/><stop offset="100%" stop-color="#D7A84A"/></linearGradient><linearGradient id="posterTitleGradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFF7C7"/><stop offset="46%" stop-color="#FFE28A"/><stop offset="100%" stop-color="#E5A93B"/></linearGradient><linearGradient id="posterSolarTitleGradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="52%" stop-color="#F8F4DA"/><stop offset="100%" stop-color="#B7CA8A"/></linearGradient><linearGradient id="posterSubtitleGradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFF8D7"/><stop offset="100%" stop-color="#FFD77A"/></linearGradient><linearGradient id="posterOrnamentGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#E7C96A" stop-opacity="0"/><stop offset="50%" stop-color="#E7C96A" stop-opacity="1"/><stop offset="100%" stop-color="#E7C96A" stop-opacity="0"/></linearGradient><filter id="posterTextShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="${Math.max(2, Math.round(baseHeight * 0.004))}" stdDeviation="${Math.max(2, Math.round(baseWidth * 0.007))}" flood-color="#3B1206" flood-opacity="0.68"/></filter><filter id="posterCommercialTextShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="${Math.max(2, Math.round(baseHeight * 0.004))}" stdDeviation="${Math.max(2, Math.round(baseWidth * 0.006))}" flood-color="#020817" flood-opacity="0.68"/></filter></defs>${headerBandSvg}${textSvgParts}</svg>`
      );
      composites.push({ input: textSvg, left: 0, top: 0 });
    }

    // 3.6 水印
    if (watermark?.text) {
      const wmFontSize = watermark.fontSize || 24;
      const wmColor = watermark.color || '#FFFFFF';
      const wmOpacity = watermark.opacity ?? 0.15;
      const wmEscaped = watermark.text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const wmSvg = Buffer.from(
        `<svg width="${baseWidth}" height="${baseHeight}"><text x="${baseWidth / 2}" y="${baseHeight / 2}" font-size="${wmFontSize}" fill="${wmColor}" opacity="${wmOpacity}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-30 ${baseWidth / 2} ${baseHeight / 2})" font-family="sans-serif">${wmEscaped}</text></svg>`
      );
      composites.push({ input: wmSvg, left: 0, top: 0 });
    }

    // 4. 执行合成
    let pipeline = sharp(baseBuffer);
    const finalComposites = [...composites, ...cornerComposites];
    if (finalComposites.length > 0) {
      pipeline = pipeline.composite(finalComposites);
    }

    // 4.5 边框效果
    if (borderStyle?.width && borderStyle.width > 0) {
      const bw = borderStyle.width;
      const bc = borderStyle.color || '#FFFFFF';
      const br = borderStyle.radius || 0;
      const borderSvg = Buffer.from(
        `<svg width="${baseWidth}" height="${baseHeight}"><rect x="${bw / 2}" y="${bw / 2}" width="${baseWidth - bw}" height="${baseHeight - bw}" rx="${br}" ry="${br}" fill="none" stroke="${bc}" stroke-width="${bw}"/></svg>`
      );
      pipeline = pipeline.composite([{ input: borderSvg, left: 0, top: 0 }]);
    }

    const outputBuffer = await pipeline.png().toBuffer();

    // 5. 保存并返回URL
    const uploadDir = path.join(
      process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'),
      'images',
      req.userId!
    );
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const filename = `poster_composited_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.png`;
    fs.writeFileSync(path.join(uploadDir, filename), outputBuffer);

    const resultUrl = `/uploads/images/${req.userId!}/${filename}`;

    const appliedLayers = [
      logoBase64 ? 'logo' : null,
      qrCodeBase64 ? 'qr' : null,
      watermark?.text ? 'watermark' : null,
    ].filter(Boolean);
    if (posterGenerationRunId) {
      await prisma.posterGenerationRun.update({
        where: { id: posterGenerationRunId },
        data: { status: 'ready', error: null },
      });
    }
    res.json({ success: true, url: resultUrl, compositionStatus: 'completed', appliedLayers });
  } catch (error: any) {
    if (posterGenerationRunId) {
      await prisma.posterGenerationRun
        .updateMany({
          where: { id: posterGenerationRunId, project: { userId: req.userId! } },
          data: { status: 'composition_failed', error: error?.message || '海报合成失败' },
        })
        .catch((persistError) => {
          logger.error('[composite-poster] 合成失败状态写入失败:', persistError);
        });
    }
    if (error instanceof AppError) {
      next(error);
    } else {
      console.error('[composite-poster] 合成失败:', error.message || error);
      next(new AppError(error.message || '海报合成失败', 500));
    }
  }
});

/** POST /stitch-ultra-poster —
将多张图片纵向拼接为超长海报（使用sharp，支持重叠渐变融合） */
imageRouter.post('/stitch-ultra-poster', authenticate, async (req, res, next) => {
  try {
    const {
      imageUrls,
      overlapPixels = 40,
      blendStrength = 0.6,
      textOverlays = [],
      logoBase64,
      qrCodeBase64,
    } = req.body as {
      imageUrls: string[];
      overlapPixels?: number;
      blendStrength?: number;
      textOverlays?: Array<{
        text: string;
        x: number;
        y: number;
        fontSize?: number;
        color?: string;
        fontFamily?: string;
      }>;
      logoBase64?: string;
      qrCodeBase64?: string;
    };

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length < 2) {
      throw new AppError('至少需要2张图片进行拼接', 400);
    }
    if (imageUrls.length > 5) {
      throw new AppError('最多支持5张图片拼接', 400);
    }

    const sharp = (await import('sharp')).default;

    const buffers: Buffer[] = [];
    const metas: Array<{ width: number; height: number }> = [];

    for (const url of imageUrls) {
      let buf: Buffer;
      if (url.startsWith('data:')) {
        const m = url.match(/^data:[^;]+;base64,(.+)$/);
        if (!m) throw new AppError('无效的data URL', 400);
        buf = Buffer.from(m[1], 'base64');
      } else {
        const imgResp = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 60000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Accept: 'image/*,*/*;q=0.8',
          },
        });
        buf = Buffer.from(imgResp.data);
      }
      buffers.push(buf);
      const meta = await sharp(buf).metadata();
      metas.push({ width: meta.width || 1024, height: meta.height || 1536 });
    }

    const targetWidth = metas[0].width;
    const normalizedBuffers: Buffer[] = [];

    for (let i = 0; i < buffers.length; i++) {
      const h =
        metas[i].width === targetWidth
          ? metas[i].height
          : Math.round(metas[i].height * (targetWidth / metas[i].width));
      const resized = await sharp(buffers[i])
        .resize(targetWidth, h, { fit: 'cover', position: 'top' })
        .png()
        .toBuffer();
      normalizedBuffers.push(resized);
      metas[i] = { width: targetWidth, height: h };
    }

    const overlap = Math.min(overlapPixels, 100);
    const totalHeight = metas.reduce((sum, m) => sum + m.height, 0) - overlap * (metas.length - 1);

    const blendComposites: Array<{ input: Buffer; left: number; top: number }> = [];

    for (let i = 1; i < normalizedBuffers.length; i++) {
      const prevAccumH = metas.slice(0, i).reduce((s, m) => s + m.height, 0) - overlap * i;
      const blendRegionH = overlap;

      const topSlice = await sharp(normalizedBuffers[i - 1])
        .extract({
          left: 0,
          top: metas[i - 1].height - blendRegionH,
          width: targetWidth,
          height: blendRegionH,
        })
        .raw()
        .toBuffer();

      const bottomSlice = await sharp(normalizedBuffers[i])
        .extract({ left: 0, top: 0, width: targetWidth, height: blendRegionH })
        .raw()
        .toBuffer();

      const blended = Buffer.alloc(topSlice.length);
      const pixels = topSlice.length / 3;
      for (let p = 0; p < pixels; p++) {
        const alpha = (p / pixels) * blendStrength;
        const r = Math.round(topSlice[p * 3] * (1 - alpha) + bottomSlice[p * 3] * alpha);
        const g = Math.round(topSlice[p * 3 + 1] * (1 - alpha) + bottomSlice[p * 3 + 1] * alpha);
        const b = Math.round(topSlice[p * 3 + 2] * (1 - alpha) + bottomSlice[p * 3 + 2] * alpha);
        blended[p * 3] = Math.min(255, Math.max(0, r));
        blended[p * 3 + 1] = Math.min(255, Math.max(0, g));
        blended[p * 3 + 2] = Math.min(255, Math.max(0, b));
      }

      const blendBuf = await sharp(blended, {
        raw: { width: targetWidth, height: blendRegionH, channels: 3 },
      })
        .png()
        .toBuffer();

      blendComposites.push({
        input: blendBuf,
        left: 0,
        top: prevAccumH,
      });
    }

    const segmentComposites: Array<{ input: Buffer; left: number; top: number }> = [];
    let currentTop = 0;
    for (let i = 0; i < normalizedBuffers.length; i++) {
      segmentComposites.push({ input: normalizedBuffers[i], left: 0, top: currentTop });
      currentTop += metas[i].height - (i < normalizedBuffers.length - 1 ? overlap : 0);
    }

    let pipeline = sharp({
      create: {
        width: targetWidth,
        height: totalHeight,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    });

    pipeline = pipeline.composite([...segmentComposites, ...blendComposites]);

    const finalBuffer = await pipeline.png().toBuffer();

    const userId = req.userId!;
    if (!userId) {
      throw new AppError('用户未认证', 401);
    }
    const userDir = path.join(
      process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'),
      'images',
      userId
    );
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    const filename = `ultra_poster_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.png`;
    const filePath = path.join(userDir, filename);
    fs.writeFileSync(filePath, finalBuffer);

    const imageUrl = `/uploads/images/${userId}/${filename}`;

    res.json({
      success: true,
      url: imageUrl,
      width: targetWidth,
      height: totalHeight,
      segmentCount: imageUrls.length,
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      next(error);
    } else {
      console.error('[stitch-ultra-poster] 拼接失败:', error.message || error);
      next(new AppError(error.message || '超长海报拼接失败', 500));
    }
  }
});
