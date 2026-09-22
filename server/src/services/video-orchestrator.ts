import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { smartRouter } from './smart-router';
import { videoTaskBindingService, type VideoTaskBinding } from './video-task-binding-service';
import { unifiedApiService } from './unified-service';
import { decryptProviderSecrets } from '../routes/ai-provider';
import { decrypt } from '../utils/encryption';
import { autoSaveService } from './auto-save-service';
import { ProviderKeyManager } from './provider-key-manager';
import { videoModelKeyScheduler } from './video-model-key-scheduler';
import type { VideoKeyLease } from './video-model-key-scheduler';
import { videoKeyHealthService } from './video-key-health-service';
import { websocketPushService } from './websocket-push-service';
import { logger } from '../utils/logger';
import { enhanceVideoPromptForModel } from './video-prompt-enhancer';
import type { VideoParams, ApiProviderConfig, GenerationResult } from '../types/api';
import { getCompatibleLeaseModels } from './video-compatible-models';
import { resolveVideoModelChannel } from './model-channel-registry';
import {
  buildReusedGenerationResponse,
  createIdempotentGenerationTask,
  isLocalIdempotencyTaskId,
} from './generation-idempotency';
import {
  resolveWatermarkEnabled,
  safelyApplyVideoWatermark,
} from './watermark-service';
import { getUserModelCredential } from './user-model-credential-service';
import {
  buildPersonalModelKeyId,
  isPersonalModelKeyId,
  resolvePersonalModelCredentialAuth,
} from './personal-model-key';
export const MODEL_POOL_BUSY_ERROR = 'MODEL_POOL_BUSY';

export class ModelPoolBusyError extends AppError {
  public readonly attemptedModels: string[];

  constructor(attemptedModels: string[] = [], message: string = '所有可用视频模型均繁忙，请稍后重试') {
    super(message, 429);
    this.name = 'ModelPoolBusyError';
    this.attemptedModels = attemptedModels;
    (this as any).code = MODEL_POOL_BUSY_ERROR;
  }
}

export interface CreateVideoTaskInput {
  userId: string;
  membershipLevel: string;
  validatedData: Record<string, any>;
  idempotencyKey?: string;
}

export interface CreateVideoTaskResult {
  localTaskId: string;
  providerTaskId?: string;
  provider: string;
  status: 'pending' | 'processing' | 'failed';
  progress: number;
  reused?: boolean;
}

export interface QueryVideoTaskOptions {
  source?: 'api' | 'poller';
}

interface RecoverVideoTaskContext extends QueryVideoTaskOptions {
  task?: any;
  binding?: VideoTaskBinding | null;
  taskResult?: GenerationResult;
  existingResultForFallback?: Record<string, unknown>;
}

const VIDEO_TASK_AGE_LIMIT_MS = 24 * 60 * 60 * 1000;
const ALLOW_CHARGEABLE_MODEL_RETRY = process.env.ALLOW_CHARGEABLE_MODEL_RETRY === 'true';

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
  // ✅ P1-8：移除 'rate limit' / 'too many requests'
  // 限流是临时状态，切换 provider 会浪费其他 provider 的配额
  // 限流时应排队等待，而非切换 provider
  'busy',
  'MODEL_POOL_BUSY',
  'server error',
  'bad gateway',
  'service unavailable',
];

const TRANSIENT_SERVICE_ERRORS = [
  'InternalServiceFailure',
  'Internal Server Error',
  'timeout',
  // ✅ P1-8：限流作为临时错误，触发同 provider 重试（带退避）
  'rate limit',
  'too many requests',
  'RATE_LIMIT_EXCEEDED',
  'busy',
  'server error',
  'bad gateway',
  'service unavailable',
];

function parseProviderConfig(configValue?: any): Record<string, unknown> {
  if (!configValue) return {};
  if (typeof configValue === 'object') return configValue as Record<string, unknown>;
  if (typeof configValue === 'string') {
    try {
      const parsed = JSON.parse(configValue);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return {};
}

function getCustomVideoModel(configValue: unknown, modelId: string): { providerModel: string } | null {
  const config = parseProviderConfig(configValue);
  if (config.isCustomModel !== true || config.mediaType !== 'video') return null;
  const models = Array.isArray(config.models) ? config.models : [];
  const matched = models.find((item: any) => String(item?.id || item) === String(modelId));
  return matched && typeof matched === 'object' && typeof matched.providerModel === 'string'
    ? { providerModel: matched.providerModel }
    : null;
}

function parseTaskOutput(
  outputResult?: any
): { videoUrl?: string; url?: string; urls?: string[]; apiTaskId?: string; thumbnailUrl?: string; metadata?: Record<string, any> } | null {
  if (!outputResult) return null;
  let parsed = outputResult;
  if (typeof outputResult === 'string') {
    try {
      parsed = JSON.parse(outputResult);
    } catch {
      return null;
    }
  }
  if (typeof parsed !== 'object' || !parsed) return null;
  return parsed as { videoUrl?: string; url?: string; urls?: string[]; apiTaskId?: string; thumbnailUrl?: string; metadata?: Record<string, any> };
}

function parseStoredTaskParams(paramsValue?: any): Record<string, any> {
  if (!paramsValue) return {};
  if (typeof paramsValue === 'string') {
    try {
      const parsed = JSON.parse(paramsValue);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, any> : {};
    } catch {
      return {};
    }
  }
  return typeof paramsValue === 'object' ? paramsValue as Record<string, any> : {};
}

function normalizeResultUrls(...sources: unknown[]): string[] | undefined {
  const urls = sources.flatMap((source) => {
    if (!source) return [];
    if (typeof source === 'string') return [source];
    if (Array.isArray(source)) return source.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    return [];
  });
  const deduped = Array.from(new Set(urls.filter((url) => url.trim().length > 0)));
  return deduped.length > 0 ? deduped : undefined;
}

const DISABLED_HAILUO_VIDEO_MODELS = new Set([
  'hailuo-video-2.3',
  'hailuo-2.3-fast-768p-6s',
  'hailuo-2.3-768p-6s',
  'minimax-hailuo-2.3',
  'minimax-hailuo-2.3-fast',
]);

function isDisabledHailuoVideoRequest(provider?: unknown, model?: unknown): boolean {
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  const normalizedModel = String(model || '').trim().toLowerCase();
  return (
    normalizedProvider === 'hailuo' ||
    (normalizedProvider === 'minimax' && normalizedModel.includes('hailuo')) ||
    DISABLED_HAILUO_VIDEO_MODELS.has(normalizedModel) ||
    normalizedModel.startsWith('hailuo-')
  );
}

function getDefaultVideoDurationForModel(_model?: unknown): number {
  return 5;
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

class VideoOrchestrator {
  async createVideoTask(input: CreateVideoTaskInput): Promise<CreateVideoTaskResult> {
    if (isDisabledHailuoVideoRequest(input.validatedData.provider, input.validatedData.model)) {
      throw new AppError('海螺视频模型当前不可用', 400);
    }
    const removedModel = String(input.validatedData.model || '').trim().toLowerCase();
    if (
      String(input.validatedData.provider || '').trim().toLowerCase() === 'agnes' ||
      removedModel === 'agnes-video-v2.0' ||
      removedModel === 'agnes_video_v2'
    ) {
      throw new AppError('所选视频模型已下线，请选择当前可用的视频模型', 400);
    }
    const sanitizedData = { ...input.validatedData };
    const resolvedChannel = resolveVideoModelChannel(sanitizedData.provider, sanitizedData.model);
    if (resolvedChannel) {
      sanitizedData.provider = resolvedChannel.provider;
      sanitizedData.model = resolvedChannel.model;
    }
    const requestedProvider = sanitizedData.provider || 'wuyinkeji';
    const requestedModel = sanitizedData.model || 'google_omni';

    const taskCreateData = {
        userId: input.userId,
        type: 'video',
        prompt: sanitizedData.prompt,
        provider: requestedProvider,
        model: requestedModel,
        status: 'pending',
        params: JSON.stringify(sanitizedData),
        progress: 0,
      };
    const idempotentTask = input.idempotencyKey
      ? await createIdempotentGenerationTask(input.idempotencyKey, taskCreateData)
      : { task: await prisma.task.create({ data: taskCreateData }), reused: false, key: '' };
    if (idempotentTask.reused) {
      const reused = buildReusedGenerationResponse(idempotentTask.task);
      return {
        localTaskId: idempotentTask.task.id,
        providerTaskId: reused.providerTaskId as string | undefined,
        provider: idempotentTask.task.provider || requestedProvider,
        status: idempotentTask.task.status,
        progress: idempotentTask.task.progress ?? 0,
        reused: true,
      };
    }
    const task = idempotentTask.task;

    const requestedProviderRow = await prisma.providerConfig.findUnique({
      where: { provider: requestedProvider },
    });
    const requestedProviderConfig = parseProviderConfig(requestedProviderRow?.config);
    const isCustomVideoProvider = requestedProviderConfig.isCustomModel === true;
    if (requestedProvider.startsWith('custom-video-') && !isCustomVideoProvider) {
      throw new AppError('个人自定义视频模型配置无效', 400);
    }
    if (isCustomVideoProvider && requestedProviderConfig.createdByUserId !== input.userId) {
      throw new AppError('无权使用该用户自定义模型', 403);
    }
    const customVideoModel = getCustomVideoModel(requestedProviderRow?.config, requestedModel);
    const storedPersonalCredential = await getUserModelCredential(input.userId, requestedProvider);
    const personalCredentialAuth = resolvePersonalModelCredentialAuth(storedPersonalCredential);
    const compatibleModels = customVideoModel ? [requestedModel] : getCompatibleLeaseModels({
      provider: requestedProvider,
      requestedModel,
    });
    const attemptedModels: string[] = [];
    let lease: VideoKeyLease | null = null;
    let lastAcquireError: Error | null = null;

    if (customVideoModel && requestedProviderRow?.isActive && !personalCredentialAuth) {
        throw new AppError(`AI 服务商 ${requestedProvider} API Key 未配置`, 400);
    }
    if (personalCredentialAuth && requestedProviderRow?.isActive) {
      // 个人 Key 仅从加密凭据库读取。租约与任务只保存来源标识，不保存密钥。
      lease = {
        keyId: buildPersonalModelKeyId(requestedProvider, Boolean(customVideoModel)),
        apiKey: personalCredentialAuth.apiKey,
        leaseToken: `personal:${task.id}:${Date.now()}`,
        provider: requestedProvider,
        model: requestedModel,
      };
    }

    for (const model of lease ? [] : compatibleModels) {
      attemptedModels.push(model);
      try {
        lease = await videoModelKeyScheduler.acquire({
          provider: requestedProvider,
          model,
          localTaskId: task.id,
        });
        if (lease) {
          lastAcquireError = null;
          break;
        }
      } catch (e) {
        lastAcquireError = e as Error;
        if (e instanceof Error && e.message === MODEL_POOL_BUSY_ERROR) {
          logger.warn(
            `[VideoOrchestrator] Provider ${requestedProvider}/${model} 池繁忙，尝试下一个兼容模型`
          );
          continue;
        }
        throw e;
      }
    }

    if (!lease) {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'failed',
          error: lastAcquireError?.message || MODEL_POOL_BUSY_ERROR,
        },
      }).catch(e => logger.error('[VideoOrchestrator] Failed to update task status to failed:', e)); // ERR-02 修复
      throw new ModelPoolBusyError(
        attemptedModels,
        lastAcquireError?.message || '所有可用视频模型均繁忙，请稍后重试'
      );
    }

    // 视频提示词增强: 为所有视频模型自动优化提示词与负向提示词
    const videoPromptEnhanced = enhanceVideoPromptForModel(
      sanitizedData.prompt,
      sanitizedData.negativePrompt,
      lease.model || requestedModel,
      requestedProvider
    );
    if (videoPromptEnhanced.enhanced) {
      logger.info(`[VideoOrchestrator] 视频提示词增强已应用: provider=${requestedProvider}, model=${lease.model || requestedModel}`);
    }

    // seed 兼容: 前端可能传 string 或 number
    const resolvedSeed = (() => {
      if (typeof sanitizedData.seed === 'number') return sanitizedData.seed;
      if (typeof sanitizedData.seed === 'string') {
        const parsed = parseInt(sanitizedData.seed, 10);
        return isNaN(parsed) ? undefined : parsed;
      }
      return undefined;
    })();

    const params: VideoParams = {
      provider: customVideoModel ? 'openaiCompatible' : requestedProvider,
      model: customVideoModel?.providerModel || lease.model || requestedModel,
      prompt: videoPromptEnhanced.prompt,
      duration: typeof sanitizedData.duration === 'number'
        ? sanitizedData.duration
        : sanitizedData.duration
          ? parseInt(sanitizedData.duration, 10)
          : getDefaultVideoDurationForModel(lease.model || requestedModel),
      resolution: sanitizedData.resolution,
      aspectRatio: sanitizedData.aspectRatio || '16:9',
      // BUG-2 修复：imageUrl 用于 image_to_video，可以是 referenceImage 或 startImage
      imageUrl: sanitizedData.referenceImage || sanitizedData.startImage,
      // BUG-2 修复：firstFrameUrl 严格只接受 startImage，避免参考图被误判为首帧
      firstFrameUrl: sanitizedData.startImage,
      lastFrameUrl: sanitizedData.endImage,
      // BUG-2 配套：referenceImage 单独存在时，合并到 referenceImages 数组供 reference_to_video 使用
      referenceImages: sanitizedData.referenceImages && sanitizedData.referenceImages.length > 0
        ? sanitizedData.referenceImages
        : (sanitizedData.referenceImage ? [sanitizedData.referenceImage] : undefined),
      referenceVideos: sanitizedData.referenceVideos,
      referenceAudios: sanitizedData.referenceAudios,
      mode: sanitizedData.generationMode || 'text_to_video',
      negativePrompt: videoPromptEnhanced.negativePrompt,
      // BUG-6 修复：统一 audioGeneration -> generateAudio，兼容前端两种字段
      generateAudio: sanitizedData.generateAudio !== undefined
        ? sanitizedData.generateAudio
        : (typeof sanitizedData.audioGeneration === 'string'
            ? sanitizedData.audioGeneration !== 'none'
            : undefined),
      // BUG-6 配套：保留 audioGeneration 原字段供 doubao-provider fallback
      audioGeneration: sanitizedData.audioGeneration,
      returnLastFrame: sanitizedData.returnLastFrame,
      webSearch: sanitizedData.webSearch || sanitizedData.enableWebSearch,
      seed: resolvedSeed,
      fps: typeof sanitizedData.fps === 'number' ? sanitizedData.fps : undefined,
      cfgScale: typeof sanitizedData.cfgScale === 'number' ? sanitizedData.cfgScale : (typeof sanitizedData.cfgStrength === 'number' ? sanitizedData.cfgStrength : undefined),
      cfgStrength: typeof sanitizedData.cfgStrength === 'number' ? sanitizedData.cfgStrength : (typeof sanitizedData.cfgScale === 'number' ? sanitizedData.cfgScale : undefined),
      steps: typeof sanitizedData.steps === 'number' ? sanitizedData.steps : undefined,
      motionIntensity: typeof sanitizedData.motionIntensity === 'number' ? sanitizedData.motionIntensity : undefined,
      quality: sanitizedData.quality,
      pixelResolution: sanitizedData.pixelResolution,
      cameraMovement: sanitizedData.cameraMovement,
      motionStrength: sanitizedData.motionStrength,
      promptEnhancer: sanitizedData.promptEnhancer,
      style: sanitizedData.style,
      viduStyle: sanitizedData.viduStyle,
      creativeStyle: sanitizedData.creativeStyle,
      motionAmplitude: sanitizedData.motionAmplitude,
      minimaxMotionLevel: typeof sanitizedData.minimaxMotionLevel === 'number' ? sanitizedData.minimaxMotionLevel : undefined,
      filmEmulation: sanitizedData.filmEmulation,
      grainSize: typeof sanitizedData.grainSize === 'number' ? sanitizedData.grainSize : undefined,
      multiShot: sanitizedData.multiShot,
      referenceType: sanitizedData.referenceType,
      characterConsistency: sanitizedData.characterConsistency,
      styleStrength: sanitizedData.styleStrength,
      keepOriginalSound: sanitizedData.keepOriginalSound,
      videoPreset: sanitizedData.videoPreset,
      bgm: sanitizedData.bgm,
      offPeak: sanitizedData.offPeak,
      // 服务商原生水印无法保证品牌、位置与透明度，统一由完成阶段合成。
      // 设为 undefined 而非 false，避免 buildVideoBody 中 `p.watermark !== undefined` 判断误将 watermark 发送给不支持的模型
      watermark: undefined,
      wmPosition: undefined,
      wmUrl: undefined,
      metaData: sanitizedData.metaData,
      callbackUrl: sanitizedData.callbackUrl,
      payload: sanitizedData.payload,
      templateMode: sanitizedData.templateMode,
      templateStory: sanitizedData.templateStory,
      templateName: sanitizedData.templateName,
      templateArea: sanitizedData.templateArea,
      templateBeast: sanitizedData.templateBeast,
      templateBgm: sanitizedData.templateBgm,
      clipCount: Math.max(1, Math.min(4, Number(sanitizedData.clipCount || sanitizedData.videoCount || 1))),
      videoCount: Math.max(1, Math.min(4, Number(sanitizedData.clipCount || sanitizedData.videoCount || 1))),
      videoUrl: sanitizedData.videoUrl,
      audioUrl: sanitizedData.audioUrl,
      templateId: typeof sanitizedData.templateId === 'number'
        ? sanitizedData.templateId
        : sanitizedData.templateId
          ? parseInt(sanitizedData.templateId, 10)
          : undefined,
      videoName: sanitizedData.videoName,
      avatarId: typeof sanitizedData.avatarId === 'string' ? sanitizedData.avatarId : undefined,
      avatarName: typeof sanitizedData.avatarName === 'string' ? sanitizedData.avatarName : undefined,
      avatarImageUrl: typeof sanitizedData.avatarImageUrl === 'string' ? sanitizedData.avatarImageUrl : undefined,
      lipSyncStrength: typeof sanitizedData.lipSyncStrength === 'number' ? sanitizedData.lipSyncStrength : undefined,
      language: typeof sanitizedData.language === 'string' ? sanitizedData.language : undefined,
    } as VideoParams;

    const providerRow = requestedProviderRow || await prisma.providerConfig.findUnique({
      where: { provider: requestedProvider },
    });

    if (!providerRow || !providerRow.isActive) {
      await videoModelKeyScheduler.release(lease.keyId, lease.leaseToken).catch(e => logger.error('[VideoOrchestrator] Failed to release key lease:', e));
      await prisma.task.update({
        where: { id: task.id },
        data: { status: 'failed', error: `AI 服务商 ${requestedProvider} 不可用` },
      }).catch(e => logger.error('[VideoOrchestrator] Failed to update task status:', e));
      throw new AppError(`AI 服务商 ${requestedProvider} 不可用`, 400);
    }

    const extraConfig = parseProviderConfig(providerRow.config);
    const apiConfig: ApiProviderConfig = {
      apiKey: lease.apiKey,
      apiSecret: personalCredentialAuth?.apiSecret,
      endpoint: personalCredentialAuth?.baseUrl || providerRow.endpoint || undefined,
      compatibilityMode: customVideoModel
        ? (extraConfig.compatibilityMode as ApiProviderConfig['compatibilityMode']) || 'openai-video'
        : undefined,
      hailuoEndpoint:
        typeof extraConfig.hailuoEndpoint === 'string' ? extraConfig.hailuoEndpoint : undefined,
      hailuoApiKey:
        typeof extraConfig.hailuoApiKey === 'string'
          ? extraConfig.hailuoApiKey.startsWith('enc:')
            ? decrypt(extraConfig.hailuoApiKey.replace('enc:', ''))
            : extraConfig.hailuoApiKey
          : undefined,
      model: lease.model || requestedModel,
    };

    let result: GenerationResult;
    try {
      result = await unifiedApiService.generateVideo(params, apiConfig);
    } catch (apiError) {
      await videoModelKeyScheduler.release(lease.keyId, lease.leaseToken).catch(e => logger.error('[VideoOrchestrator] Failed to release key lease:', e));
      await videoKeyHealthService.recordFailure(lease.keyId, 0, `${lease.provider}:${lease.model}`).catch(e => logger.error('[VideoOrchestrator] Failed to record key failure:', e));
      const errorMessage = apiError instanceof Error ? apiError.message : String(apiError);
      await prisma.task.update({
        where: { id: task.id },
        data: { status: 'failed', error: errorMessage },
      }).catch(e => logger.error('[VideoOrchestrator] Failed to update task status:', e));
      throw new AppError(errorMessage || '视频生成请求失败', 500);
    }

    if (!result?.taskId || result.status === 'failed') {
      await videoModelKeyScheduler.release(lease.keyId, lease.leaseToken).catch(e => logger.error('[VideoOrchestrator] Failed to release key lease:', e));
      await videoKeyHealthService.recordFailure(lease.keyId, 0, `${lease.provider}:${lease.model}`).catch(e => logger.error('[VideoOrchestrator] Failed to record key failure:', e));
      const errorMessage = result?.error || '视频任务创建失败';
      // 即使失败也保存providerTaskId，以便后续恢复查询
      const updateData: Record<string, unknown> = { status: 'failed', error: errorMessage };
      if (result?.taskId) {
        updateData.taskId = result.taskId;
        updateData.result = JSON.stringify({ apiTaskId: result.taskId, activeKeyId: lease.keyId });
      }
      await prisma.task.update({
        where: { id: task.id },
        data: updateData,
      }).catch(e => logger.error('[VideoOrchestrator] Failed to update task status:', e));
      throw new AppError(errorMessage, 500);
    }

    const providerTaskId = result.taskId;
    const status = result.status === 'processing' ? 'processing' : 'pending';

    await prisma.task.update({
      where: { id: task.id },
      data: {
        status,
        provider: requestedProvider,
        ...(isLocalIdempotencyTaskId(task.taskId) ? {} : { taskId: providerTaskId }),
        result: JSON.stringify({
          ...(result.result || {}),
          apiTaskId: providerTaskId,
          activeKeyId: lease.keyId,
        }),
      },
    });

    await videoTaskBindingService.bind({
      localTaskId: task.id,
      providerTaskId,
      provider: requestedProvider,
      model: lease.model || requestedModel,
      keyId: lease.keyId,
      leaseToken: lease.leaseToken,
      status,
    });

    return {
      localTaskId: task.id,
      providerTaskId,
      provider: requestedProvider,
      status,
      progress: result.progress || 0,
    };
  }

  async queryVideoTask(taskId: string, userId: string, options: QueryVideoTaskOptions = {}) {
    const source = options.source || 'api';

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new AppError('任务不存在', 404);
    }

    if (task.userId !== userId) {
      throw new AppError('无权访问此任务', 403);
    }

    if (task.status === 'completed') {
      const parsedOutput = parseTaskOutput(task.result);
      const taskParams = parseStoredTaskParams(task.params);
      const watermarkEnabled = resolveWatermarkEnabled(taskParams.watermark);
      const watermarkMetadata = parsedOutput?.metadata?.watermark as
        | { applied?: boolean }
        | undefined;
      const storedUrls = normalizeResultUrls(
        task.outputUrl,
        parsedOutput?.videoUrl,
        parsedOutput?.url,
        parsedOutput?.urls
      );
      let finalUrls = storedUrls;
      if (watermarkEnabled && !watermarkMetadata?.applied && storedUrls?.length) {
        finalUrls = await Promise.all(
          storedUrls.map((url, index) =>
            safelyApplyVideoWatermark(url, task.userId, {
              opacity: 0.2,
              outputKey: `${task.id}-${index + 1}`,
            })
          )
        );
        const finalPrimaryUrl = finalUrls[0];
        const finalResult = {
          ...(parsedOutput || {}),
          videoUrl: finalPrimaryUrl,
          url: finalPrimaryUrl,
          urls: finalUrls,
          metadata: {
            ...(parsedOutput?.metadata || {}),
            watermark: { applied: true, position: 'bottom-right', opacity: 0.2 },
          },
        };
        await prisma.task.update({
          where: { id: task.id },
          data: {
            result: JSON.stringify(finalResult),
            outputUrl: finalPrimaryUrl,
            cosUrl: finalPrimaryUrl,
          },
        }).catch((error) => logger.warn('[VideoOrchestrator] 修复已完成任务水印失败:', error));
      }
      const finalPrimaryUrl = finalUrls?.[0] || task.outputUrl || parsedOutput?.videoUrl || parsedOutput?.url;
      return {
        success: true,
        data: {
          taskId: task.id,
          status: task.status,
          resultUrl: finalPrimaryUrl,
          resultUrls: finalUrls,
          thumbnailUrl: task.thumbnailUrl || parsedOutput?.thumbnailUrl || undefined,
          cosUrl: watermarkEnabled ? finalPrimaryUrl : task.cosUrl,
          error: task.error,
          progress: task.progress,
        },
      };
    }

    let existingResultForFallbackEarly: Record<string, unknown> = {};
    try {
      existingResultForFallbackEarly =
        typeof task.result === 'string'
          ? JSON.parse(task.result)
          : (task.result as Record<string, unknown>) || {};
    } catch {
      existingResultForFallbackEarly = {};
    }

    if (task.status === 'failed' && existingResultForFallbackEarly._fallbackAttempted) {
      const parsedOutput = parseTaskOutput(task.result);
      return {
        success: true,
        data: {
          taskId: task.id,
          status: task.status,
          resultUrl: task.outputUrl || parsedOutput?.videoUrl || parsedOutput?.url,
          resultUrls: normalizeResultUrls(task.outputUrl, parsedOutput?.videoUrl, parsedOutput?.url, parsedOutput?.urls),
          thumbnailUrl: task.thumbnailUrl || parsedOutput?.thumbnailUrl || undefined,
          cosUrl: task.cosUrl,
          error: task.error,
          progress: task.progress,
        },
      };
    }

    const resolvedTaskChannel = resolveVideoModelChannel(task.provider, task.model);
    const taskProvider = resolvedTaskChannel?.provider || task.provider;
    const taskModel = resolvedTaskChannel?.model || task.model;

    const providerConfig = await prisma.providerConfig.findUnique({
      where: { provider: taskProvider },
    });

    if (!providerConfig || !providerConfig.isActive) {
      throw new AppError(`AI 服务商 ${taskProvider} 不可用`, 400);
    }

    const extraConfig = parseProviderConfig(providerConfig.config);
    const customTaskModel = getCustomVideoModel(providerConfig.config, taskModel || '');
    if (customTaskModel && extraConfig.createdByUserId !== userId) {
      throw new AppError('无权查询该用户自定义模型任务', 403);
    }
    const binding = await videoTaskBindingService.getByLocalTaskId(task.id);
    const boundKey = binding ? await ProviderKeyManager.getKeyById(binding.keyId) : null;

    let existingResultForQuery: Record<string, any> = {};
    try {
      existingResultForQuery =
        typeof task.result === 'string' ? JSON.parse(task.result) : (task.result as any) || {};
    } catch {
      existingResultForQuery = {};
    }

    const persistedKeyId = binding?.keyId || existingResultForQuery.activeKeyId;
    const usesPersonalCredential = Boolean(
      customTaskModel || isPersonalModelKeyId(persistedKeyId, taskProvider)
    );
    const personalCredential = usesPersonalCredential
      ? resolvePersonalModelCredentialAuth(await getUserModelCredential(userId, taskProvider))
      : null;
    const secrets = customTaskModel
      ? { apiKey: undefined, apiSecret: undefined }
      : decryptProviderSecrets(providerConfig);

    const modelScopedKeys = !usesPersonalCredential && !existingResultForQuery.customApiKey && !boundKey?.key
      ? await ProviderKeyManager.getActiveKeysForModel(taskProvider, taskModel || '')
      : [];
    const activeModelKey = modelScopedKeys.find((item) => !!item.apiKey);
    const queryApiKey = usesPersonalCredential
      ? personalCredential?.apiKey
      : existingResultForQuery.customApiKey || boundKey?.key || activeModelKey?.apiKey || secrets.apiKey;
    if (!queryApiKey) {
      throw new AppError(`AI 服务商 ${taskProvider} API Key 未配置`, 400);
    }
    const apiConfig: ApiProviderConfig = {
      apiKey: queryApiKey,
      apiSecret: usesPersonalCredential
        ? personalCredential?.apiSecret
        : secrets.apiSecret || undefined,
      endpoint: personalCredential?.baseUrl || providerConfig.endpoint || undefined,
      compatibilityMode: customTaskModel
        ? (extraConfig.compatibilityMode as ApiProviderConfig['compatibilityMode']) || 'openai-video'
        : undefined,
      hailuoEndpoint:
        typeof extraConfig.hailuoEndpoint === 'string' ? extraConfig.hailuoEndpoint : undefined,
      hailuoApiKey:
        typeof extraConfig.hailuoApiKey === 'string'
          ? extraConfig.hailuoApiKey.startsWith('enc:')
            ? decrypt(extraConfig.hailuoApiKey.replace('enc:', ''))
            : extraConfig.hailuoApiKey
          : undefined,
      model: taskModel || undefined,
    };

    const providerTaskId = this.resolveProviderTaskId(task, binding);
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      providerTaskId
    );
    const isViduOrDoubaoOrWuyinkeji = taskProvider === 'vidu' || taskProvider === 'doubao' || taskProvider === 'wuyinkeji' || taskProvider === 'agnes';
    if (isUUID && !isViduOrDoubaoOrWuyinkeji) {
      const parsedOutput = parseTaskOutput(task.result);
      return {
        success: true,
        data: {
          taskId: task.id,
          status: task.status as string,
          resultUrl: parsedOutput?.videoUrl || parsedOutput?.url || task.outputUrl,
          resultUrls: normalizeResultUrls(task.outputUrl, parsedOutput?.videoUrl, parsedOutput?.url, parsedOutput?.urls),
          thumbnailUrl: task.thumbnailUrl || parsedOutput?.thumbnailUrl || undefined,
          cosUrl: task.cosUrl,
          error: task.error || '任务处理中，暂无AI服务商任务ID',
          progress: task.progress,
        },
      };
    }

    let taskResult: GenerationResult;
    try {
      taskResult = await unifiedApiService.getTaskStatus(
        providerTaskId,
        customTaskModel ? 'openaiCompatible' : taskProvider,
        apiConfig
      );
    } catch (apiError: unknown) {
      logger.error(`[VideoOrchestrator] Error getting task status for ${providerTaskId}:`, apiError);
      taskResult = {
        taskId: providerTaskId,
        status: task.status as 'pending' | 'processing',
        provider: taskProvider,
        error: '查询任务状态失败，请稍后重试',
        progress: task.progress,
      } as GenerationResult;
    }

    let existingResultForFallback: Record<string, unknown> = {};
    try {
      existingResultForFallback =
        typeof task.result === 'string'
          ? JSON.parse(task.result)
          : (task.result as Record<string, unknown>) || {};
    } catch {
      existingResultForFallback = {};
    }

    const recoverableError =
      isRecoverableProviderError(taskResult.error) || isRecoverableProviderError(task.error);

    if (
      taskResult.status === 'failed' &&
      recoverableError &&
      !existingResultForFallback._fallbackAttempted
    ) {
      return this.recoverVideoTask(taskId, {
        task,
        binding,
        taskResult,
        existingResultForFallback,
        source,
      });
    }

    return this.finalizeTaskState(task, providerTaskId, taskResult, binding, {
      source,
    });
  }

  async recoverVideoTask(taskId: string, context: RecoverVideoTaskContext = {}) {
    const task =
      context.task ||
      (await prisma.task.findUnique({
        where: { id: taskId },
      }));
    if (!task) {
      throw new AppError('任务不存在', 404);
    }

    const binding =
      context.binding !== undefined
        ? context.binding
        : await videoTaskBindingService.getByLocalTaskId(task.id);
    const taskResult = context.taskResult;
    const displayError = taskResult?.error || task.error;
    const existingResultForFallback = context.existingResultForFallback || {};
    const source = context.source || 'api';

    logger.warn(
      `[VideoOrchestrator] Provider "${task.provider}" 不可用 (${displayError}), 启动两级自动恢复`
    );

    let taskActiveKeyId = existingResultForFallback.activeKeyId as string | undefined;

    if (!taskActiveKeyId || taskActiveKeyId === '__env__' || taskActiveKeyId === '__fallback__') {
      const currentKey = await ProviderKeyManager.getActiveKey(task.provider);
      if (currentKey && currentKey.keyId !== '__fallback__') {
        taskActiveKeyId = currentKey.keyId;
      }
    }

    let nextKeyId: string | null = null;
    let nextApiKey: string | null = null;
    let newLease: VideoKeyLease | null = null;

    if (taskActiveKeyId && taskActiveKeyId !== '__fallback__') {
      if (isProviderAuthError(displayError) || isProviderCreditError(displayError)) {
        await ProviderKeyManager.markKeyExhausted(
          task.provider,
          taskActiveKeyId,
          displayError || 'ProviderError'
        );
      } else {
        await videoKeyHealthService.recordFailure(taskActiveKeyId, 0, `${task.provider}:${task.model}`);
      }
    }

    const retryParams = this.buildVideoParamsFromTask(task);

    try {
      newLease = await videoModelKeyScheduler.acquire({
        provider: task.provider,
        model: retryParams.model || 'viduq3-turbo',
        localTaskId: task.id,
      });
      nextKeyId = newLease.keyId;
      nextApiKey = newLease.apiKey;
    } catch (e) {
      logger.warn(`[VideoOrchestrator] 同Provider重试获取租约失败: ${e}`);
    }

    const canRetrySameKey = isTransientServiceError(displayError);
    const hasValidLease = nextKeyId && nextApiKey && nextKeyId !== '__fallback__';
    const canRetry = hasValidLease && (nextKeyId !== taskActiveKeyId || canRetrySameKey);

    if (canRetry) {
      const providerRow = await prisma.providerConfig.findUnique({ where: { provider: task.provider } });
      const secrets = decryptProviderSecrets(providerRow!);
      const extra = parseProviderConfig(providerRow?.config);
      const newApiConfig: ApiProviderConfig = {
        apiKey: nextApiKey!,
        apiSecret: secrets?.apiSecret || undefined,
        endpoint: providerRow?.endpoint || undefined,
        hailuoEndpoint: typeof extra.hailuoEndpoint === 'string' ? extra.hailuoEndpoint : undefined,
        hailuoApiKey:
          typeof extra.hailuoApiKey === 'string'
            ? extra.hailuoApiKey.startsWith('enc:')
              ? decrypt(extra.hailuoApiKey.replace('enc:', ''))
              : extra.hailuoApiKey
            : undefined,
      };

      try {
        if (!ALLOW_CHARGEABLE_MODEL_RETRY) {
          throw new AppError('视频任务恢复需要重新提交外部生成请求，已为避免重复扣费而阻止', 409);
        }
        const retryResult = await unifiedApiService.generateVideo(retryParams, newApiConfig);
        if (retryResult.taskId && retryResult.status !== 'failed') {
          if (binding) {
            await videoTaskBindingService
              .clear({
                localTaskId: binding.localTaskId,
                provider: binding.provider,
                providerTaskId: binding.providerTaskId,
              })
              .catch(() => {});
          }

          await videoTaskBindingService.bind({
            localTaskId: task.id,
            providerTaskId: retryResult.taskId,
            provider: task.provider,
            model: retryParams.model || 'viduq3-turbo',
            keyId: nextKeyId!,
            leaseToken: newLease!.leaseToken,
            status: retryResult.status === 'processing' ? 'processing' : 'pending',
          });

          await prisma.task.update({
            where: { id: taskId },
            data: {
              status: retryResult.status || 'pending',
              result: JSON.stringify({
                ...retryResult.result,
                apiTaskId: retryResult.taskId,
                activeKeyId: nextKeyId,
                previousKeyId: taskActiveKeyId,
                previousError: taskResult?.error,
              }),
              taskId: retryResult.taskId,
              error: null,
              progress: 0,
            },
          });

          websocketPushService.notifyTaskProgress(task.userId, taskId, 0).catch(e => logger.error('[VideoOrchestrator] WS notifyTaskProgress failed:', e)); // ERR-02 修复
          return {
            success: true,
            data: {
              taskId: task.id,
              status: retryResult.status || 'pending',
              progress: 0,
              keyRotated: true,
              provider: task.provider,
            },
          };
        }

        if (newLease) {
          await videoModelKeyScheduler.release(newLease.keyId, newLease.leaseToken).catch(e => logger.error('[VideoOrchestrator] Failed to release key:', e)); // ERR-02 修复
          await videoKeyHealthService.recordFailure(newLease.keyId, 0, `${newLease.provider}:${newLease.model}`).catch(e => logger.error('[VideoOrchestrator] Failed to record failure:', e)); // ERR-02 修复
        }
      } catch (retryErr) {
        logger.warn(`[VideoOrchestrator] 同Provider换密钥重试失败: ${(retryErr as Error).message}`);
        if (newLease) {
          await videoModelKeyScheduler.release(newLease.keyId, newLease.leaseToken).catch(e => logger.error('[VideoOrchestrator] Failed to release key (retry):', e)); // ERR-02 修复
          await videoKeyHealthService.recordFailure(newLease.keyId, 0, `${newLease.provider}:${newLease.model}`).catch(e => logger.error('[VideoOrchestrator] Failed to record failure (retry):', e)); // ERR-02 修复
        }
      }
    }

    logger.warn(`[VideoOrchestrator] 同Provider密钥全部不可用，尝试 fallback 到其他服务商`);

    const allProviders = await prisma.providerConfig.findMany({ where: { isActive: true } });
    const fallbackCache = new Map<string, ApiProviderConfig>();
    for (const pc of allProviders) {
      try {
        const secrets = decryptProviderSecrets(pc);
        const activeKeyRes = await ProviderKeyManager.getActiveKey(pc.provider);
        const key = activeKeyRes?.key ?? secrets.apiKey;
        const extra = parseProviderConfig(pc.config);
        fallbackCache.set(pc.provider, {
          apiKey: key,
          apiSecret: secrets.apiSecret || undefined,
          endpoint: pc.endpoint || undefined,
          hailuoEndpoint: typeof extra.hailuoEndpoint === 'string' ? extra.hailuoEndpoint : undefined,
          hailuoApiKey:
            typeof extra.hailuoApiKey === 'string'
              ? extra.hailuoApiKey.startsWith('enc:')
                ? decrypt(extra.hailuoApiKey.replace('enc:', ''))
                : extra.hailuoApiKey
              : undefined,
        });
      } catch (e) {
        // ERR-02 修复：记录错误而非静默吞掉
        logger.error('[VideoOrchestrator] Failed to build fallback cache:', e);
      }
    }

    try {
      if (!ALLOW_CHARGEABLE_MODEL_RETRY) {
        throw new AppError('视频任务回退需要重新提交外部生成请求，已为避免重复扣费而阻止', 409);
      }
      const fallbackResult = await unifiedApiService.generateVideoWithFallback(
        retryParams,
        (pName) => fallbackCache.get(pName) || null,
        3
      );

      if (fallbackResult.taskId && fallbackResult.status !== 'failed') {
        const fbProvider = fallbackResult.provider || task.provider;
        let fbActiveKeyId: string | undefined;
        let fbLeaseToken = '';

        try {
          const fbLease = await videoModelKeyScheduler.acquire({
            provider: fbProvider,
            model: retryParams.model || 'viduq3-turbo',
            localTaskId: task.id,
          });
          fbActiveKeyId = fbLease.keyId;
          fbLeaseToken = fbLease.leaseToken;
        } catch {
          const key = await ProviderKeyManager.getActiveKey(fbProvider);
          fbActiveKeyId = key?.keyId;
        }

        if (binding) {
          await videoTaskBindingService
            .clear({
              localTaskId: binding.localTaskId,
              provider: binding.provider,
              providerTaskId: binding.providerTaskId,
            })
            .catch(() => {});
        }

        if (fbActiveKeyId) {
          await videoTaskBindingService.bind({
            localTaskId: task.id,
            providerTaskId: fallbackResult.taskId,
            provider: fbProvider,
            model: retryParams.model || 'viduq3-turbo',
            keyId: fbActiveKeyId,
            leaseToken: fbLeaseToken,
            status: fallbackResult.status === 'processing' ? 'processing' : 'pending',
          });
        }

        await prisma.task.update({
          where: { id: taskId },
          data: {
            status: fallbackResult.status || 'pending',
            provider: fbProvider,
            result: JSON.stringify({
              ...fallbackResult.result,
              apiTaskId: fallbackResult.taskId,
              activeKeyId: fbActiveKeyId,
              fallbackFrom: task.provider,
              fallbackReason: taskResult?.error,
            }),
            taskId: fallbackResult.taskId,
            error: null,
            progress: 0,
          },
        });

        websocketPushService.notifyTaskProgress(task.userId, taskId, 0).catch(() => {});
        return {
          success: true,
          data: {
            taskId: task.id,
            status: fallbackResult.status || 'pending',
            progress: 0,
            fallbackUsed: true,
            originalProvider: task.provider,
            newProvider: fallbackResult.provider,
          },
        };
      }
    } catch (fbErr) {
      logger.warn(`[VideoOrchestrator] Fallback 重新生成也失败: ${(fbErr as Error).message}`);
      const fbErrorMsg = `${taskResult?.error} (Fallback重试也失败: ${(fbErr as Error).message})`;

      if (binding) {
        ProviderKeyManager.reportFailure(task.provider, binding.keyId, fbErrorMsg).catch(() => {});
        videoKeyHealthService.recordFailure(binding.keyId, 0, `${binding.provider}:${binding.model}`).catch(() => {});
        await videoModelKeyScheduler.release(binding.keyId, binding.leaseToken).catch(() => {});
        await videoTaskBindingService
          .clear({
            localTaskId: binding.localTaskId,
            provider: binding.provider,
            providerTaskId: binding.providerTaskId,
          })
          .catch(() => {});
      }

      await prisma.task.update({
        where: { id: taskId },
        data: {
          result: JSON.stringify({
            ...existingResultForFallback,
            _fallbackAttempted: true,
            _fallbackError: (fbErr as Error).message,
          }),
          error: fbErrorMsg,
        },
      });

      if (source === 'poller') {
        websocketPushService.notifyTaskFailed(task.userId, task.id, fbErrorMsg).catch(() => {});
      }

      return {
        success: false,
        data: {
          taskId: task.id,
          status: 'failed',
          error: fbErrorMsg,
          progress: task.progress,
        },
      };
    }

    return {
      success: false,
      data: {
        taskId: task.id,
        status: 'failed',
        error: displayError,
        progress: task.progress,
      },
    };
  }

  async pollPendingTasks() {
    const cutoffTime = new Date(Date.now() - VIDEO_TASK_AGE_LIMIT_MS);
    await prisma.task.updateMany({
      where: {
        status: { in: ['pending', 'processing'] },
        type: 'video',
        createdAt: { lt: cutoffTime },
      },
      data: {
        status: 'failed',
        error: '视频任务超过24小时未完成，已自动结束',
        updatedAt: new Date(),
      },
    });

    const tasks = await prisma.task.findMany({
      where: {
        status: { in: ['pending', 'processing'] },
        type: 'video',
        createdAt: { gte: cutoffTime },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    let processed = 0;
    let errors = 0;

    // PERF-02 修复：改为并发处理（并发度限制 4），替代串行 for 循环
    // 风险修复：从 8 降为 4，避免并发外部 API 调用触发限流
    const CONCURRENCY = 4;
    for (let i = 0; i < tasks.length; i += CONCURRENCY) {
      const batch = tasks.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (task) => {
          await this.queryVideoTask(task.id, task.userId, {
            source: 'poller',
          });
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled') {
          processed += 1;
        } else {
          errors += 1;
          logger.error(`[VideoOrchestrator] pollPendingTasks failed:`, r.reason);
        }
      }
    }

    return { processed, errors };
  }

  private resolveProviderTaskId(task: any, binding?: VideoTaskBinding | null): string {
    if (task.providerTaskId) {
      return task.providerTaskId;
    }
    let providerTaskId: string = binding?.providerTaskId || task.id;
    const output = parseTaskOutput(task.result);
    if (!binding && output) {
      providerTaskId =
        output.metadata?.video_id ||
        output.metadata?.videoId ||
        output.apiTaskId ||
        output.metadata?.task_id ||
        output.metadata?.id ||
        output.metadata?.request_id ||
        task.id;
    }

    if (task.provider === 'minimax' && output?.metadata?.task_id) {
      providerTaskId = 'hailuo_' + output.metadata.task_id;
    }

    if (task.taskId && task.taskId !== task.id && !isLocalIdempotencyTaskId(task.taskId)) {
      providerTaskId = task.taskId;
    }

    return providerTaskId;
  }

  private buildVideoParamsFromTask(task: any): VideoParams {
    const parsedParams = parseStoredTaskParams(task.params);
    const requestedCount = Math.max(
      1,
      Math.min(4, Number(parsedParams.clipCount || parsedParams.videoCount || 1))
    );
    const durationValue = Number.parseInt(String(parsedParams.duration || ''), 10);
    const referenceImageStr = (parsedParams.referenceImage as string) || undefined;
    const referenceImagesArr = (parsedParams.referenceImages as string[] | undefined);
    return {
      provider: task.provider,
      prompt: parsedParams.prompt || '',
      duration: Number.isFinite(durationValue) ? durationValue : undefined,
      resolution: parsedParams.resolution as VideoParams['resolution'],
      aspectRatio: parsedParams.aspectRatio as string,
      // BUG-2 修复：imageUrl 用于 image_to_video，可来自 referenceImage/startImage/imageUrl
      imageUrl: referenceImageStr || (parsedParams.startImage as string) || (parsedParams.imageUrl as string),
      // BUG-2 修复：firstFrameUrl 严格只接受 startImage，避免参考图被误判为首帧
      firstFrameUrl: (parsedParams.startImage as string) || (parsedParams.firstFrameUrl as string),
      lastFrameUrl: parsedParams.endImage as string,
      // BUG-2 配套：referenceImage 单独存在时合并到 referenceImages
      referenceImages: referenceImagesArr && referenceImagesArr.length > 0
        ? referenceImagesArr
        : (referenceImageStr ? [referenceImageStr] : undefined),
      model: parsedParams.model as string,
      negativePrompt: parsedParams.negativePrompt as string,
      referenceVideos: parsedParams.referenceVideos as string[] | undefined,
      referenceAudios: parsedParams.referenceAudios as string[] | undefined,
      generateAudio: parsedParams.generateAudio as boolean | undefined,
      returnLastFrame: parsedParams.returnLastFrame as boolean | undefined,
      webSearch: (parsedParams.webSearch || parsedParams.enableWebSearch) as boolean | undefined,
      seed: typeof parsedParams.seed === 'number' ? parsedParams.seed : undefined,
      cameraMovement: parsedParams.cameraMovement as string | undefined,
      motionStrength: parsedParams.motionStrength as number | undefined,
      promptEnhancer: parsedParams.promptEnhancer as boolean | undefined,
      referenceType: parsedParams.referenceType as string | undefined,
      characterConsistency: parsedParams.characterConsistency as number | undefined,
      styleStrength: parsedParams.styleStrength as number | undefined,
      keepOriginalSound: parsedParams.keepOriginalSound as boolean | undefined,
      videoPreset: parsedParams.videoPreset as string | undefined,
      style: parsedParams.style as string | undefined,
      viduStyle: parsedParams.viduStyle as string | undefined,
      creativeStyle: parsedParams.creativeStyle as string | undefined,
      motionAmplitude: parsedParams.motionAmplitude as string | undefined,
      bgm: parsedParams.bgm as boolean | undefined,
      offPeak: parsedParams.offPeak as boolean | undefined,
      watermark: false,
      wmPosition: undefined,
      wmUrl: undefined,
      metaData: parsedParams.metaData as string | undefined,
      callbackUrl: parsedParams.callbackUrl as string | undefined,
      payload: parsedParams.payload as string | undefined,
      templateMode: parsedParams.templateMode as VideoParams['templateMode'],
      templateStory: parsedParams.templateStory as string | undefined,
      templateName: parsedParams.templateName as string | undefined,
      templateArea: parsedParams.templateArea as string | undefined,
      templateBeast: parsedParams.templateBeast as string | undefined,
      templateBgm: parsedParams.templateBgm as boolean | undefined,
      clipCount: requestedCount,
      videoCount: requestedCount,
      mode: (parsedParams.generationMode as VideoParams['mode']) || 'text_to_video',
    };
  }

  private async finalizeTaskState(
    task: any,
    providerTaskId: string,
    taskResult: GenerationResult,
    binding: VideoTaskBinding | null,
    options: Required<QueryVideoTaskOptions>
  ) {
    const newStatus = taskResult.status;
    const providerResultUrls = normalizeResultUrls(
      taskResult.result?.videoUrl,
      taskResult.result?.url,
      taskResult.result?.urls,
    );
    const providerPrimaryUrl =
      taskResult.result?.videoUrl || taskResult.result?.url || providerResultUrls?.[0];
    let existingResult: Record<string, unknown> = {};
    try {
      existingResult =
        typeof task.result === 'string'
          ? JSON.parse(task.result)
          : (task.result as Record<string, unknown>) || {};
    } catch {
      existingResult = {};
    }

    const mergedResult = { ...taskResult.result, apiTaskId: existingResult.apiTaskId || providerTaskId };
    const newOutput = JSON.stringify(mergedResult);
    const newError = taskResult.error || null;

    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: newStatus,
        result: newOutput,
        error: newError || task.error || undefined,
        progress: taskResult.progress ?? task.progress,
        ...(task.taskId ? {} : { taskId: providerTaskId }),
      },
    });

    let localVideoUrl: string | undefined;
    let newCosUrl: string | undefined = task.cosUrl || undefined;
    let finalizedProviderUrls = providerResultUrls;
    let finalizedProviderPrimaryUrl = providerPrimaryUrl;

    if (newStatus === 'completed') {
      const taskParams = parseStoredTaskParams(task.params);
      const watermarkEnabled = resolveWatermarkEnabled(taskParams.watermark);
      if (watermarkEnabled && providerResultUrls?.length) {
        finalizedProviderUrls = await Promise.all(
          providerResultUrls.map((url, index) =>
            safelyApplyVideoWatermark(url, task.userId, {
              opacity: 0.2,
              outputKey: `${task.id}-${index + 1}`,
            })
          )
        );
        finalizedProviderPrimaryUrl = finalizedProviderUrls[0] || providerPrimaryUrl;
      }

      if (finalizedProviderPrimaryUrl) {
        try {
          let downloadHeaders: Record<string, string> | undefined;
          if (task.provider === 'apipaths' && binding?.keyId) {
            const boundKey = await ProviderKeyManager.getKeyById(binding.keyId);
            if (boundKey?.key) {
              downloadHeaders = { Authorization: `Bearer ${boundKey.key}` };
            }
          }
          const savedResult = await autoSaveService.autoSaveUrl(
            task.userId,
            finalizedProviderPrimaryUrl,
            'video',
            `视频_${Date.now()}`,
            { headers: downloadHeaders },
          );
          if (savedResult.primaryUrl) {
            localVideoUrl = savedResult.primaryUrl;
            newCosUrl = savedResult.cosUrl;
            await prisma.task.update({
              where: { id: task.id },
              data: {
                outputUrl: savedResult.primaryUrl,
                cosUrl: savedResult.cosUrl,
                thumbnailUrl: taskResult.result?.thumbnailUrl || undefined,
              },
            }).catch(() => {});
          }
        } catch (err) {
          logger.error('[VideoOrchestrator] 自动保存素材失败:', err);
        }
      } else if (taskResult.result?.thumbnailUrl) {
        await prisma.task.update({
          where: { id: task.id },
          data: {
            thumbnailUrl: taskResult.result.thumbnailUrl,
          },
        }).catch(() => {});
      }

      const finalPrimaryUrl = localVideoUrl || finalizedProviderPrimaryUrl;
      const finalResultUrls = normalizeResultUrls(localVideoUrl, finalizedProviderUrls);
      const finalizedResult = {
        ...mergedResult,
        ...(finalPrimaryUrl ? { videoUrl: finalPrimaryUrl, url: finalPrimaryUrl } : {}),
        ...(finalResultUrls ? { urls: finalResultUrls } : {}),
        metadata: {
          ...(typeof mergedResult.metadata === 'object' && mergedResult.metadata
            ? mergedResult.metadata
            : {}),
          watermark: {
            applied: watermarkEnabled,
            position: 'bottom-right',
            opacity: 0.2,
          },
        },
      };
      await prisma.task.update({
        where: { id: task.id },
        data: {
          result: JSON.stringify(finalizedResult),
          outputUrl: finalPrimaryUrl,
          cosUrl: watermarkEnabled ? newCosUrl || finalPrimaryUrl : newCosUrl,
        },
      }).catch((error) => logger.warn('[VideoOrchestrator] 保存最终水印结果失败:', error));

      websocketPushService
        .notifyTaskComplete(task.userId, task.id, {
          ...finalizedResult,
          videoUrl: finalPrimaryUrl,
          urls: finalResultUrls,
        })
        .catch(() => {});
    } else if (newStatus === 'failed') {
      websocketPushService.notifyTaskFailed(task.userId, task.id, taskResult.error || '生成失败').catch(() => {});
    } else {
      websocketPushService.notifyTaskProgress(task.userId, task.id, taskResult.progress || 50).catch(() => {});
    }

    if ((newStatus === 'completed' || newStatus === 'failed') && binding) {
      if (newStatus === 'completed') {
        ProviderKeyManager.reportSuccess(task.provider, binding.keyId).catch(() => {});
        videoKeyHealthService.recordSuccess(binding.keyId, 0, `${binding.provider}:${binding.model}`).catch(() => {});
      } else {
        ProviderKeyManager.reportFailure(task.provider, binding.keyId, taskResult.error || '生成失败').catch(() => {});
        videoKeyHealthService.recordFailure(binding.keyId, 0, `${binding.provider}:${binding.model}`).catch(() => {});
      }
      await videoModelKeyScheduler.release(binding.keyId, binding.leaseToken).catch(() => {});
      await videoTaskBindingService
        .clear({
          localTaskId: binding.localTaskId,
          provider: binding.provider,
          providerTaskId: binding.providerTaskId,
        })
        .catch(() => {});
    }

    return {
      success: true,
      data: {
        taskId: task.id,
        status: newStatus,
        resultUrl: localVideoUrl || finalizedProviderPrimaryUrl,
        resultUrls: normalizeResultUrls(localVideoUrl, finalizedProviderUrls),
        thumbnailUrl: taskResult.result?.thumbnailUrl || task.thumbnailUrl || undefined,
        cosUrl: newCosUrl,
        error: taskResult.error,
        progress: taskResult.progress,
      },
    };
  }
}

export const videoOrchestrator = new VideoOrchestrator();
