import { IApiProvider } from './base-provider';
import { DoubaoProvider } from './doubao-provider';
import { JimengProvider } from './jimeng-provider';
import { MinimaxProvider } from './minimax-provider';
import { SeedreamProvider } from './seedream-provider';
import { OpenAICompatibleProvider } from './openai-compatible-provider';
import { WuyinkejiProvider } from './wuyinkeji-provider';
import { AgnesProvider } from './agnes-provider';
import { ViduProvider } from './vidu-provider';
import { KlingProvider } from './kling-provider';
import { SenseNovaProvider } from './sensenova-provider';
import { StepFunProvider } from './stepfun-provider';
import { DeepSeekProvider } from './deepseek-provider';
import { ResilientProvider } from './resilient-provider';
import { VideoParams, ImageParams, AudioParams, GenerationResult, ApiProviderConfig } from '../types/api';
import { getRotator, initRotatorsFromEnv } from './promptSmart3/multiKeyRotator';
import { FallbackChain, getFallbackChain, TaskType } from './promptSmart3/fallbackChain';
import axios from 'axios';
import { logger } from '../utils/logger';
import { isLocalOnlyMode } from '../utils/local-mode';
import {
  checkPromptSafety,
  checkPromptSafetyForImageGeneration,
} from './prompt-firewall';

function getSingleImageRequestLimit(providerName: string, modelName?: string): number {
  const normalizedProvider = providerName.toLowerCase();
  const normalizedModel = (modelName || '').toLowerCase();
  if (
    normalizedProvider === 'sensenova' ||
    normalizedProvider === 'stepfun' ||
    normalizedModel.startsWith('sensenova-u1') ||
    normalizedModel === 'step-image-edit-2'
  ) {
    return 1;
  }
  return Number.POSITIVE_INFINITY;
}

function normalizeRequestedImageCount(imageCount?: number): number {
  if (!Number.isFinite(imageCount)) return 1;
  return Math.max(1, Math.floor(Number(imageCount)));
}

function isDisabledHailuoVideoModel(modelName?: string | null): boolean {
  const normalized = String(modelName || '').trim().toLowerCase();
  return (
    normalized === 'hailuo-video-2.3' ||
    normalized === 'hailuo-2.3-fast-768p-6s' ||
    normalized === 'hailuo-2.3-768p-6s' ||
    normalized === 'minimax-hailuo-2.3' ||
    normalized === 'minimax-hailuo-2.3-fast' ||
    normalized.startsWith('hailuo-')
  );
}

function isDisabledHailuoVideoRequest(providerName?: string | null, modelName?: string | null): boolean {
  const normalizedProvider = String(providerName || '').trim().toLowerCase();
  return (
    normalizedProvider === 'hailuo' ||
    (normalizedProvider === 'minimax' && (!modelName || isDisabledHailuoVideoModel(modelName))) ||
    isDisabledHailuoVideoModel(modelName)
  );
}

function buildPromptViolationResult(
  provider: string,
  model: string | undefined,
  field: string,
  text: string,
  source?: string,
): GenerationResult | null {
  if (!text || !text.trim()) return null;
  const safety =
    field === 'prompt'
      ? checkPromptSafetyForImageGeneration(text, source)
      : checkPromptSafety(text);
  if (safety.passed) return null;
  logger.warn('[UnifiedApiService] 生成参数被违规提示词防火墙拦截', {
    provider,
    model,
    field,
    category: safety.category,
    matchedKeyword: safety.matchedKeyword,
  });
  return {
    taskId: '',
    status: 'failed',
    provider,
    model,
    error: safety.message,
    result: {
      metadata: {
        code: 'PROMPT_VIOLATION',
        category: safety.category,
        matchedKeyword: safety.matchedKeyword,
        field,
      },
    },
  };
}

function checkGenerationPromptParams(
  provider: string,
  model: string | undefined,
  fields: Array<[field: string, value?: string | null]>,
  options?: { source?: string },
): GenerationResult | null {
  for (const [field, value] of fields) {
    const violation = buildPromptViolationResult(
      provider,
      model,
      field,
      value || '',
      options?.source,
    );
    if (violation) return violation;
  }
  return null;
}

function getFallbackVideoModel(providerName: string, sourceModel?: string): string | undefined {
  const normalizedProvider = providerName.toLowerCase();
  const normalizedModel = String(sourceModel || '').trim();
  if (normalizedProvider === 'wuyinkeji') {
    if (!normalizedModel || isDisabledHailuoVideoModel(normalizedModel)) return 'Wan2.7';
    return normalizedModel;
  }
  if (normalizedProvider === 'doubao') return 'doubao-seedance-2-0';
  if (normalizedProvider === 'vidu') return 'viduq3-turbo';
  return undefined;
}

function mergeImageGenerationResults(
  results: GenerationResult[],
  params: ImageParams,
  providerName: string,
): GenerationResult {
  const firstFailed = results.find((item) => item.status === 'failed');
  if (firstFailed) return firstFailed;

  const firstResult = results[0];
  if (!firstResult) {
    return {
      taskId: '',
      status: 'failed',
      provider: providerName,
      model: params.model,
      error: '图片生成未返回结果',
    };
  }

  const urls = results.flatMap((item) => {
    const result = item.result || {};
    const rawUrls = Array.isArray(result.urls) ? result.urls : [];
    return [
      result.url,
      result.imageUrl,
      ...rawUrls,
    ].filter((url): url is string => typeof url === 'string' && url.length > 0);
  });
  const uniqueUrls = Array.from(new Set(urls));
  const status: GenerationResult['status'] = uniqueUrls.length > 0 ? 'completed' : firstResult.status;

  return {
    ...firstResult,
    taskId: firstResult.taskId || results.map((item) => item.taskId).filter(Boolean).join(','),
    status,
    provider: firstResult.provider || providerName,
    model: firstResult.model || params.model,
    result: {
      ...(firstResult.result || {}),
      url: uniqueUrls[0] || firstResult.result?.url || firstResult.result?.imageUrl,
      imageUrl: uniqueUrls[0] || firstResult.result?.imageUrl,
      urls: uniqueUrls,
      metadata: {
        ...(typeof firstResult.result?.metadata === 'object' && firstResult.result?.metadata
          ? firstResult.result.metadata
          : {}),
        batchedSingleImageRequests: results.length,
      },
    },
  };
}

export class UnifiedApiService {
  private providers: Map<string, IApiProvider> = new Map();
  private fallbackChain: FallbackChain;
  private rotatorsInitialized = false;

  constructor() {
    this.registerProvider(new ResilientProvider(new DoubaoProvider()));
    this.registerProvider(new ResilientProvider(new JimengProvider()));
    this.registerProvider(new ResilientProvider(new MinimaxProvider()));
    this.registerProvider(new ResilientProvider(new SeedreamProvider()));
    this.registerProvider(new ResilientProvider(new OpenAICompatibleProvider()));
    this.registerProvider(new ResilientProvider(new WuyinkejiProvider()));
    this.registerProvider(new ResilientProvider(new AgnesProvider()));
    this.registerProvider(new ResilientProvider(new ViduProvider()));
    this.registerProvider(new ResilientProvider(new KlingProvider()));
    this.registerProvider(new ResilientProvider(new SenseNovaProvider()));
    this.registerProvider(new ResilientProvider(new StepFunProvider()));
    this.registerProvider(new ResilientProvider(new DeepSeekProvider()));
    this.fallbackChain = getFallbackChain();
  }

  initRotators(): void {
    if (this.rotatorsInitialized) return;
    if (isLocalOnlyMode()) {
      this.rotatorsInitialized = true;
      logger.debug('[UnifiedApiService] Local-only mode: MultiKeyRotators skipped');
      return;
    }
    initRotatorsFromEnv();
    this.rotatorsInitialized = true;
    logger.info('[UnifiedApiService] MultiKeyRotators initialized from env');
  }

  private registerProvider(provider: IApiProvider): void {
    this.providers.set(provider.name, provider);
  }

  getProvider(name: string): IApiProvider | undefined {
    return this.providers.get(name);
  }

  getAllProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  getProviderInfo(name: string): { name: string; supportedModes: string[] } | null {
    const provider = this.providers.get(name);
    if (!provider) return null;
    return {
      name: provider.name,
      supportedModes: provider.supportedModes,
    };
  }

  private async tryRotateApiKey(providerName: string, config: ApiProviderConfig): Promise<ApiProviderConfig> {
    const rotator = getRotator(providerName);
    if (!rotator) return config;

    // ✅ P1-7：优先使用 Least-Active 选 key（Redis 原子计数）
    const nextKey = await rotator.getNextKeyLeastActive();
    if (!nextKey) {
      console.warn(`[UnifiedApiService] No available key for "${providerName}", using original`);
      return config;
    }

    return { ...config, apiKey: nextKey };
  }

  private isFailedResult(result: any): result is GenerationResult {
    return result && result.status === 'failed' && typeof result.error === 'string';
  }

  private async executeWithFallback<T>(
    taskType: TaskType,
    primaryProvider: string,
    executeFn: (providerName: string, config: ApiProviderConfig) => Promise<T>,
    buildConfigFn: (providerName: string) => ApiProviderConfig | null,
    maxFallbacks: number = 3,
    checkCapabilityFn?: (providerName: string) => boolean
  ): Promise<T & { provider?: string; fallbackUsed?: boolean }> {
    this.initRotators();

    const tried = new Set<string>();
    let lastError: any;

    const primaryConfig = buildConfigFn(primaryProvider);
    if (primaryConfig) {
      const rotatedConfig = await this.tryRotateApiKey(primaryProvider, primaryConfig);
      try {
        const result = await executeFn(primaryProvider, rotatedConfig);
        if (this.isFailedResult(result)) {
          const rotator = getRotator(primaryProvider);
          if (rotator) {
            rotator.reportFailure(rotatedConfig.apiKey);
            await rotator.releaseKey(rotatedConfig.apiKey).catch(() => {});
          }
          this.fallbackChain.reportFailure(taskType, primaryProvider);
          lastError = new Error(result.error);
          tried.add(primaryProvider);
          console.warn(`[UnifiedApiService] Primary provider "${primaryProvider}" returned failed: ${result.error}`);
        } else {
          const rotator = getRotator(primaryProvider);
          if (rotator) {
            rotator.reportSuccess(rotatedConfig.apiKey);
            await rotator.releaseKey(rotatedConfig.apiKey).catch(() => {});
          }
          this.fallbackChain.reportSuccess(taskType, primaryProvider, Date.now());
          return { ...result, provider: primaryProvider, fallbackUsed: false };
        }
      } catch (error: unknown) {
        const rotator = getRotator(primaryProvider);
        if (rotator) {
          rotator.reportFailure(rotatedConfig.apiKey);
          await rotator.releaseKey(rotatedConfig.apiKey).catch(() => {});
        }
        this.fallbackChain.reportFailure(taskType, primaryProvider);
        lastError = error;
        tried.add(primaryProvider);
        console.warn(`[UnifiedApiService] Primary provider "${primaryProvider}" failed: ${(error instanceof Error ? error.message : String(error))}`);
      }
    }

    for (let i = 0; i < maxFallbacks; i++) {
      const nextEntry = this.fallbackChain.getNextProvider(taskType, tried);
      if (!nextEntry) {
        console.warn('[UnifiedApiService] No more fallback providers available');
        break;
      }

      const fallbackProvider = nextEntry.provider;
      tried.add(fallbackProvider);

      // Enterprise Feature: Semantic Routing / Capability Check
      // Only fallback to this provider if it can satisfy the requested capabilities
      if (checkCapabilityFn && !checkCapabilityFn(fallbackProvider)) {
        logger.info(`[UnifiedApiService] Skipping fallback provider "${fallbackProvider}" due to capability mismatch`);
        continue;
      }

      const fallbackConfig = buildConfigFn(fallbackProvider);
      if (!fallbackConfig) continue;

      const rotatedConfig = await this.tryRotateApiKey(fallbackProvider, fallbackConfig);
      logger.debug(`[UnifiedApiService] Trying fallback provider "${fallbackProvider}" (attempt ${i + 1})`);

      try {
        const result = await executeFn(fallbackProvider, rotatedConfig);
        if (this.isFailedResult(result)) {
          const rotator = getRotator(fallbackProvider);
          if (rotator) {
            rotator.reportFailure(rotatedConfig.apiKey);
            await rotator.releaseKey(rotatedConfig.apiKey).catch(() => {});
          }
          this.fallbackChain.reportFailure(taskType, fallbackProvider);
          lastError = new Error(result.error);
          console.warn(`[UnifiedApiService] Fallback provider "${fallbackProvider}" returned failed: ${result.error}`);
          continue;
        }
        const rotator = getRotator(fallbackProvider);
        if (rotator) {
          rotator.reportSuccess(rotatedConfig.apiKey);
          await rotator.releaseKey(rotatedConfig.apiKey).catch(() => {});
        }
        this.fallbackChain.reportSuccess(taskType, fallbackProvider, Date.now());
        return { ...result, provider: fallbackProvider, fallbackUsed: true };
      } catch (error: unknown) {
        const rotator = getRotator(fallbackProvider);
        if (rotator) {
          rotator.reportFailure(rotatedConfig.apiKey);
          await rotator.releaseKey(rotatedConfig.apiKey).catch(() => {});
        }
        this.fallbackChain.reportFailure(taskType, fallbackProvider);
        lastError = error;
        console.warn(`[UnifiedApiService] Fallback provider "${fallbackProvider}" failed: ${(error instanceof Error ? error.message : String(error))}`);
      }
    }

    throw lastError || new Error('All providers failed');
  }

  async generateVideo(
    params: VideoParams,
    config: ApiProviderConfig
  ): Promise<GenerationResult> {
    const promptViolation = checkGenerationPromptParams(params.provider, params.model, [
      ['prompt', params.prompt],
      ['templateStory', params.templateStory],
      ['templateName', params.templateName],
      ['templateArea', params.templateArea],
      ['templateBeast', params.templateBeast],
      ['style', params.style],
      ['creativeStyle', params.creativeStyle],
      ['videoName', params.videoName],
    ]);
    if (promptViolation) return promptViolation;

    const provider = this.providers.get(params.provider);
    if (!provider) {
      return {
        taskId: '',
        status: 'failed',
        provider: params.provider,
        error: `Provider ${params.provider} not found`,
      };
    }

    return provider.generateVideo(params, config);
  }

  async generateVideoWithFallback(
    params: VideoParams,
    buildConfigFn: (providerName: string) => ApiProviderConfig | null,
    maxFallbacks: number = 3,
  ): Promise<GenerationResult & { provider?: string; fallbackUsed?: boolean }> {
    const promptViolation = checkGenerationPromptParams(params.provider, params.model, [
      ['prompt', params.prompt],
      ['templateStory', params.templateStory],
      ['templateName', params.templateName],
      ['templateArea', params.templateArea],
      ['templateBeast', params.templateBeast],
      ['style', params.style],
      ['creativeStyle', params.creativeStyle],
      ['videoName', params.videoName],
    ]);
    if (promptViolation) return promptViolation;

    const taskType: TaskType = 'video';
    const routingParams: VideoParams = isDisabledHailuoVideoRequest(params.provider, params.model)
      ? { ...params, provider: 'wuyinkeji', model: 'google_omni' }
      : params;
    
    // Enterprise Semantic Routing: Capability Check
    const requiredMode = routingParams.mode ||
      (routingParams.firstFrameUrl && routingParams.lastFrameUrl ? 'first_last_frame' :
      (routingParams.imageUrl || routingParams.firstFrameUrl ? 'image_to_video' : 'text_to_video'));

    return this.executeWithFallback(
      taskType,
      routingParams.provider,
      async (providerName, config) => {
        const provider = this.providers.get(providerName);
        if (!provider) throw new Error(`Provider ${providerName} not found`);
        const adaptedParams = { ...routingParams, provider: providerName };
        if (providerName !== routingParams.provider) {
          adaptedParams.model = getFallbackVideoModel(providerName, routingParams.model);
        } else if (isDisabledHailuoVideoModel(adaptedParams.model)) {
          adaptedParams.model = 'google_omni';
        }
        return provider.generateVideo(adaptedParams, config);
      },
      buildConfigFn,
      maxFallbacks,
      (providerName) => {
        const p = this.providers.get(providerName);
        if (!p) return false;
        if (p.supportedModes && !p.supportedModes.includes(requiredMode)) {
          return false;
        }
        return true;
      }
    );
  }

  async generateImage(
    params: ImageParams,
    config: ApiProviderConfig
  ): Promise<GenerationResult> {
    const promptViolation = checkGenerationPromptParams(params.provider, params.model, [
      ['prompt', params.prompt],
      ['style', params.style],
      ['stylePreset', params.stylePreset],
    ], { source: params.source });
    if (promptViolation) return promptViolation;

    const provider = this.providers.get(params.provider);
    if (!provider) {
      return {
        taskId: '',
        status: 'failed',
        provider: params.provider,
        error: `Provider ${params.provider} not found`,
      };
    }

    const requestedCount = normalizeRequestedImageCount(params.imageCount);
    const requestLimit = getSingleImageRequestLimit(params.provider, params.model);
    if (requestedCount > requestLimit) {
      const results: GenerationResult[] = [];
      for (let index = 0; index < requestedCount; index += 1) {
        const singleParams = { ...params, imageCount: requestLimit };
        const result = await provider.generateImage(singleParams, config);
        results.push(result);
        if (result.status === 'failed') break;
      }
      return mergeImageGenerationResults(results, params, params.provider);
    }

    return provider.generateImage(params, config);
  }

  async generateImageWithFallback(
    params: ImageParams,
    buildConfigFn: (providerName: string) => ApiProviderConfig | null,
    maxFallbacks: number = 3,
  ): Promise<GenerationResult & { provider?: string; fallbackUsed?: boolean }> {
    const promptViolation = checkGenerationPromptParams(params.provider, params.model, [
      ['prompt', params.prompt],
      ['style', params.style],
      ['stylePreset', params.stylePreset],
    ], { source: params.source });
    if (promptViolation) return promptViolation;

    const taskType: TaskType = 'image';
    return this.executeWithFallback(
      taskType,
      params.provider,
      async (providerName, config) => {
        const provider = this.providers.get(providerName);
        if (!provider) throw new Error(`Provider ${providerName} not found`);
        const adaptedParams = { ...params, provider: providerName };
        const requestedCount = normalizeRequestedImageCount(adaptedParams.imageCount);
        const requestLimit = getSingleImageRequestLimit(providerName, adaptedParams.model);
        if (requestedCount > requestLimit) {
          const results: GenerationResult[] = [];
          for (let index = 0; index < requestedCount; index += 1) {
            const result = await provider.generateImage({ ...adaptedParams, imageCount: requestLimit }, config);
            results.push(result);
            if (result.status === 'failed') break;
          }
          return mergeImageGenerationResults(results, adaptedParams, providerName);
        }
        return provider.generateImage(adaptedParams, config);
      },
      buildConfigFn,
      maxFallbacks,
    );
  }

  async generateAudio(
    params: AudioParams,
    config: ApiProviderConfig
  ): Promise<GenerationResult> {
    const promptViolation = checkGenerationPromptParams(params.provider, params.model, [
      ['text', params.text],
      ['prompt', params.prompt],
      ['lyrics', params.lyrics],
      ['clonePromptText', params.clonePromptText],
      ['voiceDesignPrompt', params.voiceDesignPrompt],
      ['emotion', params.emotion],
    ]);
    if (promptViolation) return promptViolation;

    const provider = this.providers.get(params.provider);
    if (!provider) {
      return {
        taskId: '',
        status: 'failed',
        provider: params.provider,
        error: `Provider ${params.provider} not found`,
      };
    }

    return provider.generateAudio(params, config);
  }

  async getTaskStatus(
    taskId: string,
    provider: string,
    config: ApiProviderConfig
  ): Promise<GenerationResult> {
    // 如果是 Vidu 或 Doubao，优先走 MediaGateway Python 网关轮询
    if (provider === 'vidu' || provider === 'doubao') {
      const MEDIAGATEWAY_URL = process.env.MEDIAGATEWAY_URL || 'http://localhost:3002';
      try {
        const response = await axios.get(`${MEDIAGATEWAY_URL}/api/v1/video/status/${taskId}`, {
          params: { provider },
          timeout: 3000
        });
        
        if (response.data) {
          return {
            taskId,
            status: response.data.status,
            provider,
            progress: response.data.progress,
            result: response.data.result,
            error: response.data.error
          };
        }
      } catch (e: any) {
        logger.debug(`[UnifiedService] MediaGateway 不可用，回退到本地查询 (${provider}): ${e.code || e.message}`);
      }
    }

    const providerInstance = this.providers.get(provider);
    if (!providerInstance) {
      return {
        taskId,
        status: 'failed',
        provider,
        error: `Provider ${provider} not found`,
      };
    }

    return providerInstance.getTaskStatus(taskId, config);
  }

  getFallbackChainStatus(taskType: TaskType) {
    return this.fallbackChain.getChainStatus(taskType);
  }

  getRotatorStatus(providerName: string) {
    const rotator = getRotator(providerName);
    return rotator ? rotator.getStatus() : null;
  }
}

export const unifiedApiService = new UnifiedApiService();
