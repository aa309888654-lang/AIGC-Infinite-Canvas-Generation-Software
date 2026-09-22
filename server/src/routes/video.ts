import express, { Router } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { z } from 'zod';
import { unifiedApiService } from '../services/unified-service';
import { VideoParams, ApiProviderConfig } from '../types/api';
import type { GenerationResult } from '../types/api';
import { decryptProviderSecrets } from './ai-provider';
import { decrypt } from '../utils/encryption';
import { autoSaveService } from '../services/auto-save-service';
import { ProviderKeyManager } from '../services/provider-key-manager';
import { videoModelKeyScheduler } from '../services/video-model-key-scheduler';
import type { VideoKeyLease } from '../services/video-model-key-scheduler';
import { videoTaskBindingService } from '../services/video-task-binding-service';
import { videoKeyHealthService } from '../services/video-key-health-service';
import { videoOrchestrator, ModelPoolBusyError, MODEL_POOL_BUSY_ERROR } from '../services/video-orchestrator';
import { minioPublicStorageService } from '../services/minio-public-storage-service';
import { logger } from '../utils/logger';
import { promptLogService } from '../services/prompt-log-service';
import { checkPromptSafety } from '../services/prompt-firewall';
import { resolveVideoModelChannel } from '../services/model-channel-registry';
import { WuyinkejiProvider } from '../services/wuyinkeji-provider';
import {
  buildGenerationIdempotencyKey,
  buildReusedGenerationResponse,
  createIdempotentGenerationTask,
  isLocalIdempotencyTaskId,
} from '../services/generation-idempotency';
import { fetchRemoteBuffer } from '../utils/safe-remote-fetch';

export const videoRouter = Router();
// 图生视频等接口可能接收 base64 data URL 作为 referenceImage/startImage，单独放宽 body 限制到 20mb
videoRouter.use(express.json({ limit: '20mb' }));
const DEFAULT_MEMBERSHIP_LEVEL = 'trial';

const PROVIDER_CREDIT_ERRORS = [
  'CreditInsufficient',
  'Insufficient credits',
  'insufficient_credit',
  'quota exceeded',
  '余额不足',
  '账户积分不足',
];

const PROVIDER_AUTH_ERRORS = [
  'forbidden',
  'unauthorized',
  'invalid api key',
  'invalid token',
  'authentication failed',
  'access denied',
  'invalid_credential',
  'account_suspended',
  'account suspended',
  'api key expired',
  'api_key_invalid',
];

const PROVIDER_SERVICE_ERRORS = [
  'InternalServiceFailure',
  'Internal Server Error',
  'timeout',
  'rate limit',
  'too many requests',
  'busy',
  'MODEL_POOL_BUSY',
  'server error',
  'bad gateway',
  'service unavailable'
];

const TRANSIENT_SERVICE_ERRORS = [
  'InternalServiceFailure',
  'Internal Server Error',
  'timeout',
  'busy',
  'server error',
  'bad gateway',
  'service unavailable'
];

const DISABLED_HAILUO_VIDEO_MODELS = new Set([
  'hailuo-video-2.3',
  'hailuo-2.3-fast-768p-6s',
  'hailuo-2.3-768p-6s',
  'minimax-hailuo-2.3',
  'minimax-hailuo-2.3-fast',
]);

function isDisabledHailuoVideoRequest(model?: unknown, provider?: unknown): boolean {
  const normalizedModel = String(model || '').trim().toLowerCase();
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  return (
    normalizedProvider === 'hailuo' ||
    (normalizedProvider === 'minimax' && normalizedModel.includes('hailuo')) ||
    DISABLED_HAILUO_VIDEO_MODELS.has(normalizedModel) ||
    normalizedModel.startsWith('hailuo-')
  );
}

function isProviderCreditError(error?: string | null): boolean {
  if (!error) return false;
  const lower = error.toLowerCase();
  return PROVIDER_CREDIT_ERRORS.some((e) => lower.includes(e.toLowerCase()));
}

function isProviderAuthError(error?: string | null): boolean {
  if (!error) return false;
  const lower = error.toLowerCase();
  return PROVIDER_AUTH_ERRORS.some((e) => lower.includes(e.toLowerCase()));
}

function isProviderServiceError(error?: string | null): boolean {
  if (!error) return false;
  const lower = error.toLowerCase();
  return PROVIDER_SERVICE_ERRORS.some((e) => lower.includes(e.toLowerCase()));
}

function isRecoverableProviderError(error?: string | null): boolean {
  return isProviderCreditError(error) || isProviderAuthError(error) || isProviderServiceError(error);
}

function isTransientServiceError(error?: string | null): boolean {
  if (!error) return false;
  const lower = error.toLowerCase();
  return TRANSIENT_SERVICE_ERRORS.some((e) => lower.includes(e.toLowerCase()));
}

function parseProviderConfig(configValue?: any): Record<string, unknown> {
  if (!configValue || typeof configValue !== 'object') return {};
  return configValue as Record<string, unknown>;
}

async function ensurePublicUrl(imageUrl: string, userId: string): Promise<string> {
  if (!imageUrl) return imageUrl;

  // 处理 base64 Data URL：解码 → 本地落盘备份 → 上传 MinIO 换公网 URL
  if (imageUrl.startsWith('data:')) {
    try {
      const base64Match = imageUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
      if (!base64Match?.[2]) return imageUrl;
      const ext = base64Match[1] === 'png' ? 'png' : base64Match[1] === 'gif' ? 'gif' : 'jpg';
      const buffer = Buffer.from(base64Match[2], 'base64');
      const filename = `ref_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
      logger.info(`[Video] 参考图 base64 大小: ${(buffer.length / 1024).toFixed(1)}KB, 上传MinIO...`);

      if (!minioPublicStorageService.isEnabled()) {
        logger.warn(`[Video] MinIO 未启用，base64 参考图无法转换为公网 URL，保留原值`);
        return imageUrl;
      }
      const mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
      const objectResult = await minioPublicStorageService.uploadGeneratedBuffer(userId, 'video', buffer, filename, mimeType);
      if (objectResult?.url) {
        logger.info(`[Video] base64 参考图上传MinIO成功: ${objectResult.url.substring(0, 80)}`);
        return objectResult.url;
      }
    } catch (e) {
      logger.warn(`[Video] base64 参考图转换失败: ${e instanceof Error ? e.message : String(e)}`);
    }
    return imageUrl;
  }

  // 处理 localhost URL：读本地文件 → 上传 MinIO
  try {
    const parsed = new URL(imageUrl);
    const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (!isLocal) return imageUrl;
    if (!minioPublicStorageService.isEnabled()) return imageUrl;

    const relativePath = parsed.pathname.replace(/^\/uploads\//, '');
    const localFilePath = path.join(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'), relativePath);
    if (!fs.existsSync(localFilePath)) {
      logger.warn(`[Video] 本地图片文件不存在: ${localFilePath}`);
      return imageUrl;
    }

    const fileBuffer = fs.readFileSync(localFilePath);
    const filename = path.basename(localFilePath);
    const ext = path.extname(filename).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
    const objectResult = await minioPublicStorageService.uploadGeneratedBuffer(userId, 'video', fileBuffer, filename, mimeType);
    if (objectResult?.url) {
      logger.info(`[Video] 本地图片上传MinIO成功: ${objectResult.url.substring(0, 80)}`);
      return objectResult.url;
    }
  } catch (e) {
    logger.warn(`[Video] 图片URL转换失败: ${e instanceof Error ? e.message : String(e)}`);
  }
  return imageUrl;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseTaskOutput(
  outputResult?: any
): { videoUrl?: string; apiTaskId?: string; metadata?: Record<string, any> } | null {
  if (!outputResult) return null;
  let parsed = outputResult;
  if (typeof outputResult === 'string') {
    try { parsed = JSON.parse(outputResult); } catch { return null; }
  }
  if (typeof parsed !== 'object') return null;
  return parsed as { videoUrl?: string; apiTaskId?: string; metadata?: Record<string, any> };
}

const parseNumber = (v: unknown) => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const parsed = parseFloat(v);
    return isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

const parseBoolean = (v: unknown) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true';
  return undefined;
};

// ERR-01 修复：使用严格的 zod schema 替代 z.any()，防止恶意输入
const generateVideoSchema = z.object({
  prompt: z.string().min(1, '提示词不能为空').max(5000, '提示词过长'),
  model: z.string().min(1, '模型不能为空'),
  provider: z.string().optional(),
  // duration 兼容 string ("5s" / "5") 与 number
  duration: z.union([z.string(), z.number()]).optional(),
  resolution: z.string().optional(),
  aspectRatio: z.string().optional(),
  negativePrompt: z.string().max(1000).optional(),
  // BUG-1 修复：前端 real-api-executor 传 number，schema 改为兼容 string/number
  seed: z.union([z.string(), z.number()]).optional(),
  // BUG-10 修复：字段命名与前端对齐 (前端传 referenceImage/startImage)
  image: z.string().optional(),
  referencedImage: z.string().optional(),
  referenceImage: z.string().optional(),
  startImage: z.string().optional(),
  endImage: z.string().optional(),
  referenceImages: z.array(z.string()).optional(),
  generationMode: z.string().optional(),
  nodeId: z.string().optional(), // 添加 nodeId 到 schema 以确保类型安全
  videoUrl: z.string().optional(),
  audioUrl: z.string().optional(),
  templateId: z.union([z.string(), z.number()]).optional(),
  videoName: z.string().optional(),
}).passthrough(); // 允许额外字段以保持兼容性

/**
 * @swagger
 * /api/video/generate:
 *   post:
 *     summary: 生成视频
 *     description: 使用 AI 模型生成视频
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
 *                 description: 生成提示词
 *               duration:
 *                 type: string
 *                 description: 视频时长
 *               resolution:
 *                 type: string
 *                 description: 分辨率
 *               aspectRatio:
 *                 type: string
 *                 description: 宽高比
 *               referenceImage:
 *                 type: string
 *                 description: 参考图片 URL
 *               referenceImages:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 参考图片 URL 列表
 *               startImage:
 *                 type: string
 *                 description: 起始帧图片
 *               endImage:
 *                 type: string
 *                 description: 结束帧图片
 *               generationMode:
 *                 type: string
 *                 description: 生成模式
 *               provider:
 *                 type: string
 *                 description: 服务提供商
 *               model:
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
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
videoRouter.post('/generate', authenticate, async (req, res, next) => {
  try {
    const validatedData = generateVideoSchema.parse(req.body);

    // 提示词内容安全审核：依据《生成式人工智能服务管理暂行办法》拦截违规提示词
    const safetyResult = checkPromptSafety(validatedData.prompt);
    if (!safetyResult.passed) {
      logger.warn(
        `[prompt-firewall] 视频生成提示词被拦截: category=${safetyResult.category}, keyword=${safetyResult.matchedKeyword}, userId=${req.userId}`
      );
      return res.status(400).json({
        success: false,
        error: safetyResult.message,
        code: 'PROMPT_VIOLATION',
        category: safetyResult.category,
      });
    }
    // 自动保存提示词
    promptLogService.create({
      userId: req.userId || undefined,
      prompt: validatedData.prompt || '',
      model: validatedData.model || '',
      provider: validatedData.provider || '',
      type: 'video',
      source: 'ai-view',
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'] as string,
    }).catch(() => {});

    // 通知：任务开始
    const { websocketPushService } = await import('../services/websocket-push-service');
    websocketPushService.notifyTaskProgress(req.userId!, 'pending', 0).catch(() => {});

    const removedVideoModelIds = new Set(['agnes-video-v2.0', 'agnes_video_v2']);
    const requestedModel = validatedData.model || 'doubao-seedance-2-0';
    if (
      removedVideoModelIds.has(String(requestedModel).trim().toLowerCase()) ||
      String(validatedData.provider || '').trim().toLowerCase() === 'agnes'
    ) {
      throw new AppError('所选视频模型已下线，请选择当前可用的视频模型', 400);
    }
    const resolvedChannel = resolveVideoModelChannel(validatedData.provider, requestedModel);
    if (resolvedChannel) {
      if (!resolvedChannel.channel.enabled && !resolvedChannel.fallbackApplied) {
        throw new AppError(resolvedChannel.channel.disabledReason || '该视频模型暂不可用', 400);
      }
      if (resolvedChannel.fallbackApplied) {
        logger.info(
          `[Video] 模型通道降级: ${validatedData.provider || 'unknown'}/${requestedModel} -> ${resolvedChannel.provider}/${resolvedChannel.model}`
        );
      } else if (resolvedChannel.provider !== validatedData.provider || resolvedChannel.model !== requestedModel) {
        logger.info(
          `[Video] 模型通道解析: ${validatedData.provider || 'unknown'}/${requestedModel} -> ${resolvedChannel.provider}/${resolvedChannel.model}`
        );
      }
      validatedData.provider = resolvedChannel.provider;
      validatedData.model = resolvedChannel.model;
    } else {
      validatedData.model = requestedModel;
    }
    const providerName = validatedData.provider || 'vidu';

    // 检查用户
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { isActive: true },
    });

    if (!user || !user.isActive) {
      throw new AppError('用户不存在或未激活', 404);
    }

    // 防重复提交：同一用户同一节点已有pending/processing任务时拒绝
    const nodeId = validatedData.nodeId;
    if (nodeId) {
      // BUG-8 修复：使用 JSON 精确匹配 `"nodeId":"xxx"` 替代字符串 contains，
      // 避免 nodeId="n1" 误匹配到 "n10"/"n11" 等子串
      const nodeIdJsonPattern = `"nodeId":"${nodeId}"`;
      const existingTask = await prisma.task.findFirst({
        where: {
          userId: req.userId!,
          type: 'video',
          status: { in: ['pending', 'processing'] },
          params: { contains: nodeIdJsonPattern },
        },
        select: { id: true, status: true, createdAt: true },
      });
      if (existingTask) {
        return res.status(429).json({
          success: false,
          error: '该节点已有正在进行的视频生成任务，请等待完成后再试',
          data: { taskId: existingTask.id, status: existingTask.status },
        });
      }
    }

    // 自定义视频服务商：根据其模型能力声明自动归一化 resolution/aspectRatio
    const customProviderRow = providerName.startsWith('custom-video-')
      ? await prisma.providerConfig.findUnique({ where: { provider: providerName }, select: { config: true, isActive: true } })
      : null;
    try {
      const customConfig = customProviderRow?.config
        ? (typeof customProviderRow.config === 'string' ? JSON.parse(customProviderRow.config) : customProviderRow.config)
        : null;
      if (customProviderRow?.isActive && customConfig?.isCustomModel === true && customConfig?.mediaType === 'video') {
        const modelCapabilities = Array.isArray(customConfig.models)
          ? customConfig.models.find((item: any) => String(item?.id || item) === String(validatedData.model || ''))
          : undefined;
        if (modelCapabilities && typeof modelCapabilities === 'object') {
          const resolutions = Array.isArray(modelCapabilities.supportedResolutions)
            ? modelCapabilities.supportedResolutions.map((value: unknown) => String(value).trim()).filter(Boolean)
            : [];
          const ratios = Array.isArray(modelCapabilities.supportedAspectRatios)
            ? modelCapabilities.supportedAspectRatios.map((value: unknown) => String(value).trim()).filter(Boolean)
            : [];
          const defaults = modelCapabilities.defaultParams || {};
          if (ratios.length > 0 && !ratios.includes(String(validatedData.aspectRatio || ''))) {
            validatedData.aspectRatio = ratios.includes(String(defaults.aspectRatio || ''))
              ? String(defaults.aspectRatio)
              : ratios[0];
          }
          if (resolutions.length > 0 && !resolutions.includes(String(validatedData.resolution || ''))) {
            validatedData.resolution = resolutions.includes(String(defaults.resolution || ''))
              ? String(defaults.resolution)
              : resolutions[0];
          }
        }
      }
    } catch {
      // 配置异常时忽略，继续按用户参数生成。
    }
    // 参考图归一化：把 base64 / localhost URL 转换为 MinIO 公网 URL，供远程大模型 API 访问
    const videoUserId = req.userId!;
    if (validatedData.referenceImage) {
      validatedData.referenceImage = await ensurePublicUrl(validatedData.referenceImage, videoUserId);
    }
    if (validatedData.startImage) {
      validatedData.startImage = await ensurePublicUrl(validatedData.startImage, videoUserId);
    }
    if (validatedData.endImage) {
      validatedData.endImage = await ensurePublicUrl(validatedData.endImage, videoUserId);
    }
    if (validatedData.image) {
      validatedData.image = await ensurePublicUrl(validatedData.image, videoUserId);
    }
    if (validatedData.videoUrl) {
      validatedData.videoUrl = await ensurePublicUrl(validatedData.videoUrl, videoUserId);
    }
    if (validatedData.audioUrl) {
      validatedData.audioUrl = await ensurePublicUrl(validatedData.audioUrl, videoUserId);
    }
    if (Array.isArray(validatedData.referenceImages) && validatedData.referenceImages.length > 0) {
      validatedData.referenceImages = await Promise.all(
        validatedData.referenceImages.map((img) => ensurePublicUrl(img, videoUserId))
      );
    }

    const orchestrationResult = await videoOrchestrator.createVideoTask({
      userId: req.userId!,
      membershipLevel: req.membershipLevel || DEFAULT_MEMBERSHIP_LEVEL,
      validatedData: {
        ...validatedData,
        provider: providerName,
      },
      idempotencyKey: buildGenerationIdempotencyKey({
        userId: req.userId!,
        route: 'video.generate',
        body: { ...validatedData, provider: providerName },
        nodeId: validatedData.nodeId,
      }),
    });

    return res.json({
      success: true,
      data: {
        taskId: orchestrationResult.localTaskId,
        status: orchestrationResult.status,
        progress: orchestrationResult.progress ?? 0,
        provider: orchestrationResult.provider,
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
    if (error instanceof ModelPoolBusyError || (error as any)?.code === MODEL_POOL_BUSY_ERROR) {
      return res.status(429).json({
        success: false,
        error: {
          code: MODEL_POOL_BUSY_ERROR,
          message: (error as Error)?.message || '所有可用视频模型均繁忙，请稍后重试',
        },
      });
    }
    next(error);
  }
});

videoRouter.get('/proxy-download', authenticate, async (req: any, res) => {
  try {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      res.status(400).json({ success: false, error: '缺少 url 参数' });
      return;
    }

    const allowedHosts = [
      // SEC-11 修复：移除 localhost/127.0.0.1，防止内网 SSRF
      'volces.com', 'ark.cn-beijing.volces.com',
      'aliyuncs.com', 'minimax.com', 'minimaxi.com',
      'hailuoai.com', 'jimeng.jianying.com',
      'bilibili.com', 'huawei.com',
      'byteimg.com', 'byteimg.cn', 'bytecdn.cn',
      'bytedance.com', 'bytedance.net',
      'tiktokcdn.com', 'tiktokv.com',
      'snssdk.com', 'douyinpic.com',
      'toutiao.com', 'toutiaovod.com',
      'vlabstatic.com', 'volccdn.com',
      'wuyinkeji.com', 'doubaocdn.com',
      'vidu.cn', 'api.vidu.cn',
      'sensecoreapi-oss.cn', 'sensecoreapi.cn',
      'amazonaws.com',
    ];
    const configuredHosts = [
      process.env.MINIO_PUBLIC_URL,
    ]
      .map((value) => {
        try { return value ? new URL(value).hostname : ''; } catch { return ''; }
      })
      .filter(Boolean);
    const response = await fetchRemoteBuffer(targetUrl, {
      allowedHosts: [...allowedHosts, ...configuredHosts],
      maxBytes: 500 * 1024 * 1024,
      timeoutMs: 120000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: new URL(targetUrl).origin + '/',
      },
    });
    if (response.status < 200 || response.status >= 300) {
      res.status(response.status).json({ success: false, error: `下载失败: ${response.status}` });
      return;
    }

    const contentTypeHeader = response.headers['content-type'];
    const contentType = Array.isArray(contentTypeHeader)
      ? contentTypeHeader[0] || 'video/mp4'
      : typeof contentTypeHeader === 'string'
        ? contentTypeHeader
        : 'video/mp4';
    const buffer = Buffer.from(response.data);

    const ext = contentType.includes('mp4') ? 'mp4' : contentType.includes('webm') ? 'webm' : 'mp4';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Content-Disposition', `attachment; filename="video_${Date.now()}.${ext}"`);
    res.send(buffer);
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: '代理下载失败' });
  }
});

const viduTemplateGenerateSchema = z.object({
  templateMode: z.enum(['template-story', 'template', 'one-click']),
  images: z.array(z.string()).min(1, '至少需要提供一张图片'),
  prompt: z.string().max(3000).optional(),
  templateStory: z.string().optional(),
  templateName: z.string().optional(),
  templateArea: z.string().optional(),
  templateBeast: z.string().optional(),
  templateBgm: z.boolean().optional(),
  aspectRatio: z.string().optional(),
  duration: z.number().min(10).max(180).optional(),
  seed: z.number().optional(),
  // 防重复提交幂等键（与 /api/video/generate 保持一致）
  nodeId: z.string().optional(),
});

videoRouter.post('/vidu-template', authenticate, async (req, res, next) => {
  try {
    const validatedData = viduTemplateGenerateSchema.parse(req.body);
    const { templateMode } = validatedData;

    if (templateMode === 'template-story' && !validatedData.templateStory) {
      return res.status(400).json({ success: false, error: '模板成片模式需要指定 templateStory 参数' });
    }
    if (templateMode === 'template' && !validatedData.templateName) {
      return res.status(400).json({ success: false, error: '场景特效模板模式需要指定 templateName 参数' });
    }

    // 防重复提交：同一用户同一节点已有 pending/processing 的 Vidu 模板任务时拒绝
    // 避免用户双击或网络重试导致重复扣费与重复消耗 provider 配额
    const viduNodeId = validatedData.nodeId;
    if (viduNodeId) {
      const nodeIdJsonPattern = `"nodeId":"${viduNodeId}"`;
      const existingTask = await prisma.task.findFirst({
        where: {
          userId: req.userId!,
          type: 'video',
          status: { in: ['pending', 'processing'] },
          params: { contains: nodeIdJsonPattern },
        },
        select: { id: true, status: true, createdAt: true },
      });
      if (existingTask) {
        return res.status(429).json({
          success: false,
          error: '该节点已有正在进行的视频生成任务，请等待完成后再试',
          data: { taskId: existingTask.id, status: existingTask.status },
        });
      }
    }

    const viduConfig = await prisma.providerConfig.findFirst({
      where: { provider: 'vidu', isActive: true },
    });

    if (!viduConfig) {
      return res.status(400).json({ success: false, error: 'Vidu 服务未配置，请先在 API 密钥管理中配置 Vidu 密钥' });
    }

    const configObj = parseProviderConfig(viduConfig.config);
    const secrets = decryptProviderSecrets(viduConfig);
    const activeKeyResult = await ProviderKeyManager.getActiveKey('vidu');
    const apiKey = activeKeyResult?.key ?? secrets.apiKey;
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'Vidu API Key 未配置' });
    }

    const apiConfig: ApiProviderConfig = {
      provider: 'vidu',
      apiKey,
      endpoint: configObj.endpoint as string || viduConfig.endpoint || 'https://api.vidu.cn',
    } as ApiProviderConfig;

    const processedImages = await Promise.all(
      validatedData.images.map((img: string) => ensurePublicUrl(img, req.userId!))
    );

    logger.info(`[Video] 一键成片图片处理: ${validatedData.images.length} 张, 首张=${processedImages[0]?.substring(0, 80)}`);

    const videoParams: VideoParams = {
      provider: 'vidu',
      model: templateMode,
      prompt: validatedData.prompt || '',
      templateMode,
      templateStory: validatedData.templateStory,
      templateName: validatedData.templateName,
      templateArea: validatedData.templateArea,
      templateBeast: validatedData.templateBeast,
      templateBgm: validatedData.templateBgm,
      aspectRatio: validatedData.aspectRatio,
      duration: validatedData.duration,
      seed: validatedData.seed,
      imageUrl: processedImages[0],
      referenceImages: processedImages.slice(1),
    };

    const idempotencyKey = buildGenerationIdempotencyKey({
      userId: req.userId!,
      route: 'video.vidu-template',
      body: { ...validatedData, templateMode, images: processedImages },
      nodeId: validatedData.nodeId,
    });
    const idempotentTask = await createIdempotentGenerationTask(idempotencyKey, {
      userId: req.userId!,
      type: 'video',
      status: 'pending',
      prompt: validatedData.prompt || `[Vidu模板] ${templateMode}`,
      params: JSON.stringify(validatedData),
      provider: 'vidu',
      model: templateMode,
    });
    if (idempotentTask.reused) {
      return res.status(202).json({
        success: true,
        data: buildReusedGenerationResponse(idempotentTask.task),
      });
    }
    const task = idempotentTask.task;

    let result: GenerationResult;
    try {
      result = await unifiedApiService.generateVideo(videoParams, apiConfig);
    } catch (apiErr) {
      await (prisma.task as any).update({
        where: { id: task.id },
        data: { status: 'failed', error: '视频生成请求异常' },
      }).catch(() => {});
      logger.error('[ViduTemplate] generateVideo 异常:', apiErr);
      return res.status(500).json({ success: false, error: '生成失败', taskId: task.id });
    }

    if (result.status === 'failed') {
      await (prisma.task as any).update({
        where: { id: task.id },
        data: { status: 'failed', error: typeof result.error === 'string' ? result.error : JSON.stringify(result.error), result: JSON.stringify(result) },
      });
      return res.status(400).json({ success: false, error: typeof result.error === 'string' ? result.error : '生成失败', taskId: task.id });
    }

    const providerTaskId = result.taskId;
    await (prisma.task as any).update({
      where: { id: task.id },
      data: {
        status: 'processing',
        ...(isLocalIdempotencyTaskId(task.taskId) ? {} : { taskId: providerTaskId }),
        result: JSON.stringify(result),
      },
    });

    try {
      await videoTaskBindingService.bind({
        localTaskId: task.id,
        providerTaskId,
        provider: 'vidu',
        model: templateMode,
        keyId: apiConfig.apiKey?.substring(0, 8) || 'default',
        leaseToken: '',
        status: 'processing',
      });
    } catch (bindErr) {
      logger.warn(`[ViduTemplate] 任务绑定失败: ${bindErr}`);
    }

    res.json({
      success: true,
      data: {
        taskId: task.id,
        providerTaskId,
        status: 'processing',
        templateMode,
      },
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: '输入数据验证失败', details: error.errors });
    }
    next(error);
  }
});

const queryTaskSchema = z.object({
  taskId: z.string().min(1, 'taskId is required'),
});

videoRouter.get('/query/:taskId', authenticate, async (req, res, next) => {
  try {
    const { taskId } = queryTaskSchema.parse(req.params);
    const orchestrated = await videoOrchestrator.queryVideoTask(taskId, req.userId!, {
      source: 'api',
    });
    return res.json(orchestrated);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: '输入数据验证失败',
        details: error.errors,
      });
    }
    next(error);
  }
});

// ✅ P1-9：节点超时时后端取消任务，释放密钥租约
videoRouter.post('/cancel/:taskId', authenticate, async (req, res, next) => {
  try {
    const { taskId } = queryTaskSchema.parse(req.params);

    // 1. 标记任务为 cancelled
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return res.status(404).json({ success: false, error: '任务不存在' });
    }
    if (task.userId !== req.userId) {
      return res.status(403).json({ success: false, error: '无权操作此任务' });
    }
    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
      return res.json({ success: true, message: `任务已处于终态: ${task.status}`, skipped: true });
    }

    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'cancelled',
        error: '节点执行超时或用户主动取消',
      },
    });

    // 2. 释放密钥租约
    try {
      const binding = await videoTaskBindingService.getByLocalTaskId(taskId);
      if (binding) {
        await videoModelKeyScheduler.release(binding.keyId, binding.leaseToken);
        await videoTaskBindingService.clear(binding);
        logger.info(`[VideoCancel] 任务 ${taskId} 租约已释放 (keyId=${binding.keyId})`);
      }
    } catch (releaseErr) {
      logger.warn(`[VideoCancel] 释放任务 ${taskId} 租约失败:`, releaseErr);
    }

    return res.json({ success: true, message: '任务已取消' });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: '输入数据验证失败',
        details: error.errors,
      });
    }
    next(error);
  }
});

// 视频超分：调用 wuyinkeji Video_Upscaling (video_processing) 将视频提升至 1080P
const videoUpscaleSchema = z.object({
  video_url: z.string().url(),
  duration: z.number().optional(),
  source: z.string().optional(),
});

videoRouter.post('/upscale', authenticate, async (req, res, next) => {
  try {
    const { video_url } = videoUpscaleSchema.parse(req.body);

    const providerConfig = await prisma.providerConfig.findUnique({
      where: { provider: 'wuyinkeji' },
    });

    if (!providerConfig || !providerConfig.isActive) {
      return res.status(503).json({ success: false, error: '小天API(wuyinkeji) 未配置或未启用' });
    }

    const secrets = decryptProviderSecrets(providerConfig);
    const config: ApiProviderConfig = {
      apiKey: secrets.apiKey || '',
      apiSecret: secrets.apiSecret || undefined,
      endpoint: providerConfig.endpoint || undefined,
    };

    const provider = new WuyinkejiProvider();
    const result: GenerationResult = await provider.generateVideoUpscale(video_url, config);

    const resultUrl = result.result?.url || result.result?.videoUrl;

    if (result.status === 'failed' || (result.status !== 'completed' && !resultUrl)) {
      logger.warn(`[VideoUpscale] 失败: taskId=${result.taskId}, error=${result.error}`);
      return res.status(500).json({
        success: false,
        error: result.error || '视频超分失败',
        taskId: result.taskId,
      });
    }

    if (result.status === 'processing') {
      return res.json({
        success: true,
        status: 'processing',
        taskId: result.taskId,
        message: '视频超分任务已提交，正在处理中，请稍后查询',
      });
    }

    logger.info(`[VideoUpscale] 成功: userId=${req.userId}, taskId=${result.taskId}`);

    return res.json({
      success: true,
      video_url: resultUrl,
      original_url: video_url,
      taskId: result.taskId,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: '输入数据验证失败：video_url 必须是合法的公网可访问 URL',
        details: error.errors,
      });
    }
    next(error);
  }
});
