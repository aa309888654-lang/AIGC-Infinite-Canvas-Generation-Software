// @ts-nocheck
import { APIProvider } from '@/types/api-controller';
import { getAuthToken } from '@/lib/auth-check';
import { logger } from '@/lib/logger';
import { aiProviderService } from './ai-provider-service';
import { appConfigService } from './app-config-service';

export interface ModelInfo {
  id: string;
  modelId?: string; // 后端使用的真实模型ID
  providerModel?: string; // provider 实际执行模型ID
  name: string;
  provider: APIProvider;
  // 与后端 zod modelPayloadSchema.type 保持一致：
  // image / video / audio / music / text / both
  type: 'image' | 'video' | 'audio' | 'music' | 'text' | 'both';
  description: string;
  capabilities: string[];
  modelCategory?: 'generation' | 'edit' | 'action';
  requiredInputs?: string[];
  routeProvider?: APIProvider | string;
  configuredProvider?: string;
  disabledReason?: string;
  fallbackModelId?: string;
  fallbackProvider?: string;
  keyScope?: string;
  /** 自定义模型组中的模型必须在图片/视频节点优先展示。 */
  isCustomModel?: boolean;
  customSortPriority?: number;
  mediaType?: 'image' | 'video';
  compatibilityMode?: 'openai-image' | 'openai-video' | 'official-image' | 'official-video';
  maxResolution?: string;
  maxDuration?: number;
  costPerImage?: number;
  costPerMinute?: number;
  estimatedSpeed?: 'fast' | 'medium' | 'slow';
  qualityRating?: number;
  isActive: boolean;
  isPopular?: boolean;
  tags: string[];
  releasedAt?: Date;
  supportedModes?:
    | {
        textToImage: boolean;
        imageToImage: boolean;
        reference: boolean;
        characterReference: boolean;
      }
    | string[];
  supportedResolutions?: string[];
  supportedAspectRatios?: string[];
  supportedDurations?: number[];
  defaultParams?: Record<string, any>;
  parameterSchema?: Record<string, any>;
  pricing?: Record<string, any> | null;
  // 音频特有配置
  voiceOptions?: VoiceOption[];
}

export interface VoiceOption {
  voice_id: string;
  name: string;
  gender: 'male' | 'female';
  language: string;
  description?: string;
}

export interface ProviderModels {
  provider: APIProvider;
  models: ModelInfo[];
}

class ModelRegistry {
  private static instance: ModelRegistry;
  private models: Map<string, ModelInfo> = new Map();
  private hiddenModelIds = new Set<string>();
  private userPreferences: Map<
    string,
    {
      favoriteModels: string[];
      recentUsed: string[];
      usageCount: Record<string, number>;
    }
  > = new Map();
  private isBackendSynced = false;
  private syncPromise: Promise<void> | null = null;
  private lastSyncFailureAt = 0;
  private static readonly SYNC_FAILURE_COOLDOWN_MS = 60_000;
  // 追踪后端同步的模型 ID，refreshFromBackend 时清除避免旧模型残留
  private backendModelIds: Set<string> = new Set();
  // 变更订阅机制：refreshFromBackend / syncWithBackendImpl 完成后递增 revision，
  // 通过 listeners 通知所有订阅方（如 useNodeModels）触发重渲染。
  private revision = 0;
  private listeners: Set<() => void> = new Set();

  private isHiddenModelIdentity(
    provider: APIProvider | string,
    id?: string | null,
    modelId?: string | null
  ): boolean {
    const normalizedProvider = String(provider || '').toLowerCase();
    const candidates = [id, modelId].filter(Boolean).map((value) => String(value).toLowerCase());
    const removedModelIds = new Set([
      'image-01',
      'step-image-edit-2',
      'agnes-image-2.1-flash',
      'agnes-video-v2.0',
    ]);
    return (
      (normalizedProvider === 'apipaths' &&
        candidates.some((candidate) => this.hiddenModelIds.has(candidate))) ||
      candidates.some((candidate) => removedModelIds.has(candidate))
    );
  }

  private constructor() {
    this.initializeDefaultModels();
    this.loadUserPreferences();
  }

  private async syncWithBackend(): Promise<void> {
    if (this.isBackendSynced) return;
    if (this.syncPromise) return this.syncPromise;
    if (Date.now() - this.lastSyncFailureAt < ModelRegistry.SYNC_FAILURE_COOLDOWN_MS) return;

    this.syncPromise = this.syncWithBackendImpl();
    try {
      await this.syncPromise;
    } finally {
      this.syncPromise = null;
    }
  }

  private async syncWithBackendImpl(): Promise<void> {
    if (this.isBackendSynced) return;

    try {
      logger.info('[ModelRegistry] 开始同步后端Provider配置...');

      const hasAuth = !!getAuthToken();

      if (hasAuth) {
        // 已登录：从私有 API 获取完整模型列表
        const response = await aiProviderService.getAvailableModels();
        if (response.success && response.data?.models) {
          for (const model of response.data.models) {
            const provider = model.provider as APIProvider;
            const rawModelId = model.modelId || model.providerModel || model.id;
            if (this.isHiddenModelIdentity(provider, model.id, rawModelId)) continue;
            const existingModel = Array.from(this.models.values()).find(
              (item) =>
                item.provider === provider &&
                (item.id === rawModelId ||
                  item.modelId === rawModelId ||
                  item.providerModel === rawModelId)
            );
            const uniqueId = model.id || existingModel?.id || `${provider}-${rawModelId}`;

            const modelInfo: ModelInfo = {
              id: uniqueId,
              modelId: rawModelId,
              providerModel: model.providerModel || rawModelId,
              name: model.name,
              provider,
              // 优先使用后端显式指定的 type，否则按 ID/能力推断
              type: (model.type as ModelInfo['type']) || this.inferModelType(model),
              description: model.description || '',
              capabilities: model.capabilities || model.supportedModes || [],
              modelCategory: model.modelCategory,
              requiredInputs: model.requiredInputs || [],
              routeProvider: model.routeProvider,
              configuredProvider: model.configuredProvider,
              disabledReason: model.disabledReason,
              fallbackModelId: model.fallbackModelId,
              fallbackProvider: model.fallbackProvider,
              keyScope: model.keyScope,
              isCustomModel: model.isCustomModel,
              customSortPriority: model.customSortPriority,
              mediaType: model.mediaType,
              compatibilityMode: model.compatibilityMode,
              maxResolution: model.maxResolution,
              maxDuration: model.maxDuration,
              supportedResolutions: model.supportedResolutions,
              supportedAspectRatios: model.supportedAspectRatios,
              supportedModes: model.supportedModes as any,
              defaultParams: model.defaultParams,
              // 读取后端模型级开关状态（isActive !== false 才活跃，兼容旧数据无此字段）
              isActive: (model as any).isActive !== false && !model.disabledReason,
              tags: [model.providerDisplayName || model.provider],
            };

            this.models.set(modelInfo.id, modelInfo);
            this.backendModelIds.add(modelInfo.id);
          }
          logger.info(`[ModelRegistry] 同步了 ${response.data.models.length} 个后端模型`);
        }
      }

      const appConfigResp = await appConfigService.getAvailableModels();
      if (appConfigResp.success && appConfigResp.data?.models) {
        for (const model of appConfigResp.data.models) {
          const provider = model.provider as APIProvider;
          const rawModelId = model.modelId || model.providerModel || model.id;
          if (this.isHiddenModelIdentity(provider, model.id, rawModelId)) continue;
          const uniqueId = model.id || `${model.configuredProvider || provider}_${rawModelId}`;
          // 公共应用配置可能包含同一 ID 的精简记录；不得覆盖认证接口返回的个人模型元数据。
          if (this.models.get(uniqueId)?.isCustomModel === true) continue;
          const modelInfo: ModelInfo = {
            id: uniqueId,
            modelId: rawModelId,
            providerModel: model.providerModel || rawModelId,
            name: model.name,
            provider,
            type: (model.type as ModelInfo['type']) || this.inferModelType(model),
            description: model.description || '',
            capabilities: model.capabilities || model.supportedModes || [],
            modelCategory: model.modelCategory,
            requiredInputs: model.requiredInputs || [],
            routeProvider: model.routeProvider,
            configuredProvider: model.configuredProvider,
            disabledReason: model.disabledReason,
            fallbackModelId: model.fallbackModelId,
            fallbackProvider: model.fallbackProvider,
            keyScope: model.keyScope,
            maxResolution: model.maxResolution,
            maxDuration: model.maxDuration,
            supportedAspectRatios: model.supportedAspectRatios,
            supportedDurations: model.supportedDurations,
            supportedModes: model.supportedModes as any,
            defaultParams: model.defaultParams,
            parameterSchema: model.parameterSchema,
            pricing: model.pricing,
            isActive: model.isActive !== false && !model.disabledReason,
            tags: [model.providerDisplayName || model.provider],
          };
          this.models.set(modelInfo.id, modelInfo);
          this.backendModelIds.add(modelInfo.id);
        }
        logger.info(
          `[ModelRegistry] 同步了 ${appConfigResp.data.models.length} 个应用配置中心模型`
        );
      }

      // 未登录或已登录：从公共 API 补充模型信息
      const publicResp = await aiProviderService.getPublicProviders();
      if (publicResp.success && publicResp.data) {
        let syncedCount = 0;
        for (const p of publicResp.data) {
          if (!p.available || !p.models?.length) continue;
          const provider = p.name as APIProvider;
          for (const m of p.models) {
            const modelId = typeof m === 'string' ? m : m.id;
            const modelName = typeof m === 'string' ? m : m.name || m.id;
            if (!modelId) continue;
            if (this.isHiddenModelIdentity(provider, modelId, modelId)) continue;
            // 不覆盖已有模型
            const exists = Array.from(this.models.values()).find(
              (item) =>
                item.provider === provider &&
                (item.id === modelId || item.modelId === modelId || item.providerModel === modelId)
            );
            if (exists) {
              const disabledReason = typeof m === 'object' ? m.disabledReason : undefined;
              const nextActive =
                (typeof m === 'object' && m.isActive !== undefined ? m.isActive !== false : true) &&
                !disabledReason;
              this.models.set(exists.id, { ...exists, isActive: nextActive, disabledReason });
              syncedCount++;
              continue;
            }
            const uniqueId = `${provider}-${modelId}`;
            // 优先使用后端对象中的 type，否则按 ID 推断
            const explicitType = typeof m === 'object' && m.type ? m.type : null;
            const disabledReason = typeof m === 'object' ? m.disabledReason : undefined;
            const modelInfo: ModelInfo = {
              id: uniqueId,
              modelId,
              providerModel: typeof m === 'object' ? m.providerModel || modelId : modelId,
              name: modelName,
              provider,
              type:
                (explicitType as ModelInfo['type']) ||
                this.inferModelType({ id: modelId, modelId, supportedModes: [] }),
              description: typeof m === 'object' && m.description ? m.description : '',
              capabilities: typeof m === 'object' ? m.capabilities || m.supportedModes || [] : [],
              modelCategory: typeof m === 'object' ? m.modelCategory : undefined,
              requiredInputs: typeof m === 'object' ? m.requiredInputs || [] : [],
              routeProvider: typeof m === 'object' ? m.routeProvider : undefined,
              configuredProvider: typeof m === 'object' ? m.configuredProvider : undefined,
              disabledReason,
              fallbackModelId: typeof m === 'object' ? m.fallbackModelId : undefined,
              fallbackProvider: typeof m === 'object' ? m.fallbackProvider : undefined,
              keyScope: typeof m === 'object' ? m.keyScope : undefined,
              maxResolution: typeof m === 'object' ? m.maxResolution : undefined,
              maxDuration: typeof m === 'object' ? m.maxDuration : undefined,
              supportedAspectRatios: typeof m === 'object' ? m.supportedAspectRatios : undefined,
              // 读取后端模型级开关状态（公共API，默认活跃）
              isActive:
                (typeof m === 'object' && m.isActive !== undefined ? m.isActive !== false : true) &&
                !disabledReason,
              tags: [p.displayName || p.name],
            };
            this.models.set(modelInfo.id, modelInfo);
            this.backendModelIds.add(modelInfo.id);
            syncedCount++;
          }
        }
        if (syncedCount > 0) {
          logger.info(`[ModelRegistry] 从公共 API 补充了 ${syncedCount} 个模型`);
        }
      }

      this.isBackendSynced = true;
      // 同步成功后通知所有订阅方（useNodeModels 等）触发重渲染
      this.bumpRevision();
    } catch (error) {
      this.lastSyncFailureAt = Date.now();
      logger.warn('[ModelRegistry] 同步后端配置失败:', error);
    }
  }

  private inferModelType(model: any): 'image' | 'video' | 'audio' | 'music' | 'text' | 'both' {
    const modelId = (model.modelId || model.id || '').toLowerCase();
    const capabilities = (model.supportedModes || model.capabilities || []).map((s: string) =>
      s.toLowerCase()
    );

    // 文本/对话模型识别（优先识别，避免文本模型被误判为 image）
    const textIdPatterns = [
      'gpt',
      'claude',
      'gemini',
      'deepseek',
      'qwen',
      'kimi',
      'llama',
      'mistral',
      'glm',
      'chat',
      'reasoning',
      'spark',
      'ernie',
      'baichuan',
      'yi-',
      'jamba',
    ];
    const textCapPatterns = [
      'text-generation',
      'text-generation-',
      'chat',
      'reasoning',
      'code-generation',
      'function-calling',
      'tool-use',
      'prompt-optimization',
      'prompt-enhance',
      'copywriting',
      'image-understanding',
      'multimodal',
    ];
    const isTextById = textIdPatterns.some((p) => modelId.includes(p));
    const isTextByCap = capabilities.some((c: string) =>
      textCapPatterns.some((p) => c.includes(p))
    );

    // 音乐模型识别（区别于语音合成 audio）
    const musicIdPatterns = ['music', 'song', 'minimax-music', 'sun', 'udio'];
    const musicCapPatterns = ['music-generation', 'music-composition', 'song-generation'];
    const isMusicById = musicIdPatterns.some((p) => modelId.includes(p));
    const isMusicByCap = capabilities.some((c: string) =>
      musicCapPatterns.some((p) => c.includes(p))
    );

    const audioIdPatterns = ['speech', 'tts', 'audio', 'voice', 'sound', 'minimax-tts'];
    const videoIdPatterns = [
      'seedance',
      'vidu',
      'hailuo',
      'video',
      'cogvideox',
      'wanx',
      'pixverse',
      'kling',
      'package',
      'wan2.6_video',
    ];
    const imageIdPatterns = [
      'seedream',
      'flux',
      'stable-diffusion',
      'dall',
      'midjourney',
      'imagen',
      'minimax-image',
      'wan2',
      'image-eraser',
      'image-upscaler',
      'image-remove-background',
      'mj-txt2img',
      'mj-variation',
      'mj-upscale',
      'mj-reroll',
      'mj-outpaint',
      'mj-inpaint',
      'mj-remix',
      'mj-remove-background',
      'image-01',
      'image-01-live',
    ];

    const isAudioById = audioIdPatterns.some((p) => modelId.includes(p));
    const isVideoById = videoIdPatterns.some((p) => modelId.includes(p));
    const isImageById = imageIdPatterns.some((p) => modelId.includes(p));

    const isVideoByCap = capabilities.some(
      (c: string) =>
        c.includes('video') || c.includes('text_to_video') || c.includes('image_to_video')
    );

    const isImageByCap = capabilities.some(
      (c: string) => c.includes('image') || c.includes('text_to_image')
    );

    const isAudioByCap = capabilities.some(
      (c: string) => c.includes('audio') || c.includes('speech') || c.includes('tts')
    );

    const isAudio = isAudioById || isAudioByCap;
    const isVideo = isVideoById || isVideoByCap;
    const isImage = isImageById || isImageByCap;
    const isMusic = isMusicById || isMusicByCap;
    const isText = isTextById || isTextByCap;

    // 优先级：music（与 audio 分开）> text > 视音频 > image 兜底
    if (isMusic && !isVideo && !isImage) return 'music';
    if (isText && !isVideo && !isImage && !isMusic) return 'text';
    if (isAudio && !isVideo && !isImage) return 'audio';
    if (isVideo && isImage) return 'both';
    if (isVideo) return 'video';
    if (isImage) return 'image';
    if (isAudio) return 'audio';
    if (isMusic) return 'music';
    if (isText) return 'text';
    return 'image';
  }

  public async refreshFromBackend(): Promise<void> {
    // 清除上次后端同步的模型，避免禁用的模型残留
    for (const id of this.backendModelIds) {
      this.models.delete(id);
    }
    this.backendModelIds.clear();
    this.isBackendSynced = false;
    await this.syncWithBackend();
    // 兜底通知：即使 syncWithBackend 因缓存/冷却未真正执行同步，
    // 也向订阅方广播一次变更，确保 UI 有机会刷新。
    this.bumpRevision();
  }

  /**
   * 订阅 modelRegistry 变更。返回取消订阅函数。
   * 当 refreshFromBackend / syncWithBackend / applyProviderModelStates 触发时，
   * 所有 listener 会被调用，订阅方（如 useNodeModels）据此触发重渲染。
   */
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 获取当前 revision 号。订阅方可用于判断是否需要重新计算派生数据。
   */
  public getRevision(): number {
    return this.revision;
  }

  /**
   * 递增 revision 并同步通知所有 listener。
   * 内部方法：在模型列表发生变更后调用。
   */
  private bumpRevision(): void {
    this.revision++;
    // 复制一份避免回调中 unsubscribe 导致迭代异常
    const snapshot = Array.from(this.listeners);
    for (const listener of snapshot) {
      try {
        listener();
      } catch (err) {
        logger.warn('[ModelRegistry] subscribe listener 执行异常:', err);
      }
    }
  }

  public async ensureSyncedWithBackend(): Promise<void> {
    await this.syncWithBackend();
  }

  /**
   * 按 provider 批量覆盖模型启用状态。
   * 管理后台 toggle 模型后调用，确保默认注册表中的同名模型
   * 也能立即反映禁用状态，避免出现"后端已禁用但前端仍显示"的问题。
   * @param provider Provider 名称（如 'agnes'）
   * @param modelStates 该 provider 下所有模型的 { id, isActive } 列表
   */
  public applyProviderModelStates(
    provider: APIProvider,
    modelStates: Array<{ id: string; isActive: boolean }>
  ): void {
    const stateMap = new Map(modelStates.map((s) => [s.id, s.isActive]));
    let changed = false;
    // 同时匹配 id 和 modelId，覆盖默认模型与后端追加模型
    for (const model of this.models.values()) {
      if (model.provider !== provider) continue;
      const candidates = [model.id, model.modelId, model.providerModel]
        .filter(Boolean)
        .map((value) => String(value));
      const matchedKey = candidates.find((candidate) => stateMap.has(candidate));
      if (matchedKey) {
        const newActive = stateMap.get(matchedKey)!;
        if (model.isActive !== newActive) {
          this.models.set(model.id, { ...model, isActive: newActive });
          changed = true;
        }
      }
    }
    if (changed) {
      this.bumpRevision();
    }
  }

  /**
   * 按服务商整体启用/禁用所有模型。
   * 管理后台切换服务商状态后立即调用，避免默认内置模型继续显示导致“启用按钮无效”的错觉。
   */
  public applyProviderAvailability(provider: APIProvider, isActive: boolean): void {
    let changed = false;
    for (const model of this.models.values()) {
      if (model.provider !== provider) continue;
      if (model.isActive !== isActive) {
        this.models.set(model.id, { ...model, isActive });
        changed = true;
      }
    }
    if (changed) {
      this.bumpRevision();
    }
  }

  public static getInstance(): ModelRegistry {
    if (!ModelRegistry.instance) {
      ModelRegistry.instance = new ModelRegistry();
    }
    return ModelRegistry.instance;
  }

  private initializeDefaultModels() {
    const defaultModels: ModelInfo[] = [
      {
        id: 'doubao-seedream-5-0-lite',
        name: '豆包 Seedream 5.0 Lite',
        provider: 'doubao',
        type: 'image',
        description: '字节跳动轻量级图片生成模型5.0版本，适合快速生成',
        capabilities: [
          'text-to-image',
          'image-to-image',
          'reference',
          'instruction-following',
          'infographic',
          'multi-image-fusion',
          'sequential-image-generation',
          'streaming-output',
          'web-search',
          'prompt-enhancer',
          'watermark',
        ],
        maxResolution: '4K',
        costPerImage: 0.005,
        estimatedSpeed: 'fast',
        qualityRating: 4.2,
        isActive: true,
        tags: [
          '指令遵循',
          '信息图',
          '多图融合',
          '组图输出',
          '流式输出',
          '联网搜索',
          'Seedream 5.0 Lite',
        ],
        supportedModes: {
          textToImage: true,
          imageToImage: true,
          reference: true,
          characterReference: false,
        },
      },
      {
        id: 'doubao-seedream-5-0-pro',
        name: '豆包 Seedream 5.0 Pro',
        provider: 'doubao',
        type: 'image',
        description:
          '字节跳动专业级图片生成模型5.0 Pro，支持交互式精准编辑、多图融合和原生多语种文字生成',
        capabilities: [
          'text-to-image',
          'image-to-image',
          'reference',
          'inpaint',
          'outpaint',
          'instruction-following',
          'infographic',
          'interactive-edit',
          'layer-separation',
          'precise-coordinate',
          'arbitrary-marking',
          'multi-image-fusion',
          'multilingual-text',
          'prompt-enhancer',
          'watermark',
        ],
        maxResolution: '2K',
        costPerImage: 0.02,
        estimatedSpeed: 'medium',
        qualityRating: 4.8,
        isActive: true,
        tags: [
          '专业',
          '交互编辑',
          '点选',
          '框选',
          '图层分离',
          '精准坐标',
          '任意标记',
          '多图融合',
          '多语种文字',
          'Seedream 5.0 Pro',
        ],
        supportedModes: {
          textToImage: true,
          imageToImage: true,
          reference: true,
          characterReference: true,
        },
      },
      {
        id: 'doubao-seedream-4-5',
        name: '豆包 Seedream 4.5',
        provider: 'doubao',
        type: 'image',
        description: '豆包经典图片生成模型4.5版本，生成效果稳定',
        capabilities: ['text-to-image', 'reference', 'prompt-enhancer'],
        maxResolution: '1024x1024',
        costPerImage: 0.008,
        estimatedSpeed: 'medium',
        qualityRating: 4.4,
        isActive: true,
        tags: ['经典', '稳定', 'Seedream 4.5'],
        supportedModes: {
          textToImage: true,
          imageToImage: true,
          reference: true,
          characterReference: false,
        },
      },
      {
        id: 'sensenova-6.7-flash-lite',
        modelId: 'sensenova-6.7-flash-lite',
        name: 'SenseNova 6.7 Flash Lite',
        provider: 'sensenova',
        type: 'text',
        description: '轻量多模态文本模型，256K上下文，支持图像理解，中文理解强',
        capabilities: [
          'text-generation',
          'chat',
          'prompt-optimization',
          'copywriting',
          'image-understanding',
        ],
        estimatedSpeed: 'fast',
        qualityRating: 4.0,
        isActive: true,
        isPopular: true,
        tags: ['文本', 'SenseNova', 'Flash Lite', '轻量', '多模态', '优先'],
      },
      {
        id: 'deepseek-v4-flash',
        modelId: 'deepseek-v4-flash',
        name: 'DeepSeek V4 Flash',
        provider: 'sensenova',
        type: 'text',
        description:
          'DeepSeek V4 Flash 高性能对话模型，1M超长上下文，支持思考模式与工具调用，经 SenseNova 平台调用',
        capabilities: [
          'text-generation',
          'chat',
          'prompt-optimization',
          'function-calling',
          'reasoning',
        ],
        estimatedSpeed: 'fast',
        qualityRating: 4.5,
        isActive: true,
        isPopular: true,
        tags: ['文本', 'DeepSeek', 'SenseNova', '1M上下文', '思考模式', '优先'],
      },
      {
        id: 'step-3.7-flash',
        modelId: 'step-3.7-flash',
        name: 'Step 3.7 Flash',
        provider: 'stepfun',
        type: 'text',
        description:
          '长上下文多模态推理旗舰，198B MoE架构，256K上下文，原生支持图片和视频理解，400 TPS高速推理',
        capabilities: [
          'text-generation',
          'chat',
          'reasoning',
          'image-understanding',
          'video-understanding',
          'function-calling',
        ],
        estimatedSpeed: 'fast',
        qualityRating: 4.8,
        isActive: true,
        isPopular: true,
        tags: ['文本', 'StepFun', '多模态', '推理', '256K', '优先'],
      },
      {
        id: 'step-3.5-flash',
        modelId: 'step-3.5-flash',
        name: 'Step 3.5 Flash',
        provider: 'stepfun',
        type: 'text',
        description:
          '长上下文纯文本推理模型，专为智能体构建，256K上下文，稳定可靠的工具调用与长程任务执行',
        capabilities: ['text-generation', 'chat', 'reasoning', 'function-calling', 'agent'],
        estimatedSpeed: 'fast',
        qualityRating: 4.6,
        isActive: true,
        tags: ['文本', 'StepFun', '推理', 'Agent', '256K', '优先'],
      },
      {
        id: 'Package_1.0',
        modelId: 'Package_1.0',
        name: '视频字幕包装 (豆包)',
        provider: 'doubao',
        type: 'video',
        description: '视频包装模型，AI一键添加标题、字幕、音效，提供30种丰富模板，满足各类口播场景',
        capabilities: ['subtitle', 'video-packaging'],
        costPerMinute: 0.06,
        estimatedSpeed: 'fast',
        qualityRating: 4.4,
        isActive: true,
        tags: ['视频', '字幕', '包装', '模板', '小天'],
        supportedModes: ['subtitle'],
        defaultParams: {
          templateId: 1,
        },
      },
      {
        id: 'doubao-seedance-2-0',
        modelId: 'doubao-seedance-2-0-260128',
        name: 'Seedance 2.0 官方（火山方舟）',
        provider: 'doubao',
        type: 'video',
        description: '豆包新一代视频模型，支持文生、图生、首尾帧、多模态参考、视频编辑与联网增强。',
        capabilities: [
          'text-to-video',
          'image-to-video',
          'first-last-frame',
          'multi-reference',
          'video-reference',
          'audio-reference',
          'video-to-video',
          'motion-control',
          'camera-control',
          'audio-generation',
          'web-search',
          'return-last-frame',
          'sample-mode',
        ],
        maxResolution: '1920x1080',
        maxDuration: 15,
        supportedDurations: [4, 5, 6, 8, 10, 15],
        costPerMinute: 0.7,
        estimatedSpeed: 'medium',
        qualityRating: 4.9,
        isActive: true,
        isPopular: true,
        tags: ['视频生成', 'Seedance 2.0', '多模态', '视频编辑', '联网增强', '推荐'],
        supportedModes: [
          'text_to_video',
          'image_to_video',
          'first_last_frame',
          'reference_to_video',
          'video_to_video',
        ],
        supportedAspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
        supportedResolutions: ['480p', '720p', '1080p'],
      },
      {
        id: 'doubao-seedance-2-0-fast',
        modelId: 'doubao-seedance-2-0-fast-260128',
        name: 'Doubao Seedance 2.0 Fast',
        provider: 'doubao',
        type: 'video',
        description: '豆包 Seedance 2.0 快速版，能力与 2.0 一致，更偏向低成本和快速出片。',
        capabilities: [
          'text-to-video',
          'image-to-video',
          'first-last-frame',
          'multi-reference',
          'video-reference',
          'audio-reference',
          'video-to-video',
          'motion-control',
          'camera-control',
          'audio-generation',
          'web-search',
          'return-last-frame',
          'sample-mode',
        ],
        maxResolution: '1280x720',
        maxDuration: 15,
        supportedDurations: [4, 5, 6, 8, 10, 15],
        costPerMinute: 0.45,
        estimatedSpeed: 'fast',
        qualityRating: 4.7,
        isActive: false,
        isPopular: true,
        tags: ['视频生成', 'Seedance 2.0', '极速', '多模态', '推荐'],
        supportedModes: [
          'text_to_video',
          'image_to_video',
          'first_last_frame',
          'reference_to_video',
          'video_to_video',
        ],
        supportedAspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
        supportedResolutions: ['480p', '720p'],
      },
      {
        id: 'doubao-seedance-1-5-pro',
        modelId: 'doubao-seedance-1-5-pro-251215',
        name: '豆包 Seedance 1.5 Pro',
        provider: 'doubao',
        type: 'video',
        description: '豆包专业视频生成模型，支持高质量文生视频、图生视频及原生音效',
        capabilities: [
          'text-to-video',
          'image-to-video',
          'motion-control',
          'camera-control',
          'audio-generation',
          'watermark',
        ],
        maxResolution: '1920x1080',
        maxDuration: 12,
        supportedDurations: [5, 10, 12],
        costPerMinute: 0.5,
        estimatedSpeed: 'medium',
        qualityRating: 4.8,
        isActive: true,
        isPopular: true,
        tags: ['视频生成', '高质量', '专业', '推荐', '原生音效'],
        supportedModes: ['text_to_video', 'image_to_video'],
        supportedAspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
      },

      {
        id: 'hailuo-video-2.3',
        name: 'Hailuo Video-2.3',
        provider: 'hailuo',
        type: 'video',
        description: '海螺AI最新视频生成模型 2.3版本',
        capabilities: [
          'text-to-video',
          'image-to-video',
          'motion-control',
          'film-emulation',
          'grain-control',
        ],
        maxResolution: '1920x1080',
        maxDuration: 15,
        supportedDurations: [6, 10, 15],
        costPerMinute: 0.55,
        estimatedSpeed: 'fast',
        qualityRating: 4.6,
        isActive: false,
        isPopular: false,
        tags: ['视频', '高清', '海螺AI'],
      },
      {
        id: 'hailuo-2.3-fast-768p-6s',
        name: 'Hailuo-2.3-Fast-768P 6s',
        provider: 'hailuo',
        type: 'video',
        description: '海螺AI极速视频生成模型，768P分辨率，6秒时长，适合快速预览',
        capabilities: [
          'text-to-video',
          'image-to-video',
          'first-last-frame',
          'video-to-video',
          'motion-control',
          'film-emulation',
          'grain-control',
          'creative-style',
          'cfg-control',
        ],
        maxResolution: '1280x768',
        maxDuration: 6,
        supportedDurations: [6],
        costPerMinute: 0.4,
        estimatedSpeed: 'fast',
        qualityRating: 4.4,
        isActive: false,
        isPopular: false,
        tags: ['极速', '768P', '6秒', '海螺AI', '预览'],
        supportedModes: ['text_to_video', 'image_to_video', 'first_last_frame', 'video_to_video'],
      },
      {
        id: 'hailuo-2.3-768p-6s',
        name: 'Hailuo-2.3-768P 6s',
        provider: 'hailuo',
        type: 'video',
        description: '海螺AI标准视频生成模型，768P分辨率，6秒时长，平衡速度与质量',
        capabilities: [
          'text-to-video',
          'image-to-video',
          'first-last-frame',
          'video-to-video',
          'motion-control',
          'film-emulation',
          'grain-control',
          'creative-style',
          'cfg-control',
        ],
        maxResolution: '1280x768',
        maxDuration: 6,
        supportedDurations: [6],
        costPerMinute: 0.5,
        estimatedSpeed: 'medium',
        qualityRating: 4.7,
        isActive: false,
        isPopular: false,
        tags: ['标准', '768P', '6秒', '海螺AI', '平衡'],
        supportedModes: ['text_to_video', 'image_to_video', 'first_last_frame', 'video_to_video'],
      },

      {
        id: 'kling-3.0-turbo',
        modelId: 'kling-3.0-turbo',
        name: 'Kling 3.0 Turbo',
        provider: 'kling',
        type: 'video',
        description: '可灵旗舰极速图生视频模型，支持 3-15 秒和 720p/1080p 输出',
        capabilities: ['image-to-video', 'motion-control', 'style-control'],
        maxResolution: '1920x1080',
        maxDuration: 15,
        supportedDurations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        costPerMinute: 0.8,
        estimatedSpeed: 'medium',
        qualityRating: 4.7,
        isActive: true,
        isPopular: true,
        tags: ['可灵', 'Kling', '3.0', 'Turbo', '旗舰'],
        supportedModes: ['image_to_video'],
        supportedAspectRatios: ['16:9', '9:16', '1:1'],
        supportedResolutions: ['720p', '1080p'],
      },

      {
        id: 'kling-3.0',
        modelId: 'kling-3.0',
        name: 'Kling 3.0 / 3.0 Omni',
        provider: 'kling',
        type: 'video',
        description: '可灵旗舰全能图生视频模型，支持首尾帧、原生音频、多镜头与 4K 输出',
        capabilities: [
          'image-to-video',
          'first-last-frame',
          'audio-generation',
          'multi-shot',
          'motion-control',
        ],
        maxResolution: '3840x2160',
        maxDuration: 15,
        supportedDurations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        costPerMinute: 0.8,
        estimatedSpeed: 'medium',
        qualityRating: 4.5,
        isActive: true,
        isPopular: true,
        tags: ['可灵', 'Kling', '3.0', 'Omni', '旗舰'],
        supportedModes: ['image_to_video', 'first_last_frame'],
        supportedAspectRatios: ['16:9', '9:16', '1:1'],
        supportedResolutions: ['720p', '1080p', '4K'],
      },

      {
        id: 'viduq3-pro',
        modelId: 'viduq3-pro',
        name: 'Vidu Q3 Pro',
        provider: 'vidu',
        type: 'video',
        description: 'Vidu 旗舰模型，支持智能切镜、音画同出，多机位一致性出色，效果最好',
        capabilities: [
          'text-to-video',
          'image-to-video',
          'first-last-frame',
          'reference-to-video',
          'audio-generation',
          'smart-cut',
          'multi-frame',
          'template',
          'template-story',
        ],
        maxResolution: '1920x1080',
        maxDuration: 16,
        supportedDurations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
        costPerMinute: 1.0,
        estimatedSpeed: 'medium',
        qualityRating: 4.9,
        isActive: true,
        isPopular: true,
        tags: ['最新', '旗舰', '视频生成', '音画同出', '智能切镜', '推荐'],
        supportedModes: [
          'text_to_video',
          'image_to_video',
          'first_last_frame',
          'reference_to_video',
          'multi_frame',
          'template',
          'template_story',
        ],
        supportedAspectRatios: ['16:9', '9:16', '3:4', '4:3', '1:1'],
        supportedResolutions: ['540p', '720p', '1080p'],
      },
      {
        id: 'viduq3-turbo',
        modelId: 'viduq3-turbo',
        name: 'Vidu Q3 Turbo',
        provider: 'vidu',
        type: 'video',
        description: 'Vidu Q3 快速版，支持智能切镜和音画同出，生成速度最快，性价比最高',
        capabilities: [
          'text-to-video',
          'image-to-video',
          'first-last-frame',
          'reference-to-video',
          'audio-generation',
          'smart-cut',
          'multi-frame',
          'template',
          'template-story',
        ],
        maxResolution: '1920x1080',
        maxDuration: 16,
        supportedDurations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
        costPerMinute: 0.7,
        estimatedSpeed: 'fastest',
        qualityRating: 4.8,
        isActive: false,
        isPopular: true,
        tags: ['最新', '快速', '性价比', '推荐'],
        supportedModes: [
          'text_to_video',
          'image_to_video',
          'first_last_frame',
          'reference_to_video',
          'multi_frame',
          'template',
          'template_story',
        ],
        supportedAspectRatios: ['16:9', '9:16', '3:4', '4:3', '1:1'],
        supportedResolutions: ['540p', '720p', '1080p'],
      },
      {
        id: 'viduq3-pro-fast',
        modelId: 'viduq3-pro-fast',
        name: 'Vidu Q3 Pro Fast',
        provider: 'vidu',
        type: 'video',
        description: 'Vidu Q3 Pro快速版，高效生成优质音视频，生成速度更快，性价比高',
        capabilities: ['image-to-video', 'audio-generation'],
        maxResolution: '1920x1080',
        maxDuration: 16,
        supportedDurations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
        costPerMinute: 0.7,
        estimatedSpeed: 'fast',
        qualityRating: 4.6,
        isActive: true,
        tags: ['快速', '图生视频', '音画同出'],
        supportedModes: ['image_to_video'],
        supportedAspectRatios: ['16:9', '9:16', '3:4', '4:3', '1:1'],
        supportedResolutions: ['720p', '1080p'],
      },
      {
        id: 'viduq3-mix',
        modelId: 'viduq3-mix',
        name: 'Vidu Q3 Mix',
        provider: 'vidu',
        type: 'video',
        description: 'Vidu Q3 Mix，画面质感强，支持智能切镜、音画同出，动态效果好，均衡性最强',
        capabilities: ['reference-to-video', 'audio-generation', 'smart-cut'],
        maxResolution: '1920x1080',
        maxDuration: 16,
        supportedDurations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
        costPerMinute: 0.8,
        estimatedSpeed: 'medium',
        qualityRating: 4.8,
        isActive: true,
        tags: ['最新', '均衡', '音画同出', '智能切镜', '参考视频'],
        supportedModes: ['reference_to_video'],
        supportedAspectRatios: ['16:9', '9:16', '3:4', '4:3', '1:1'],
        supportedResolutions: ['720p', '1080p'],
      },
      {
        id: 'viduq2-pro',
        modelId: 'viduq2-pro',
        name: 'Vidu Q2 Pro',
        provider: 'vidu',
        type: 'video',
        description: 'Vidu Q2 专业版，画质细腻，支持长视频生成',
        capabilities: [
          'text-to-video',
          'image-to-video',
          'first-last-frame',
          'reference-to-video',
          'multi-frame',
          'template',
          'template-story',
        ],
        maxResolution: '1920x1080',
        maxDuration: 10,
        supportedDurations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        costPerMinute: 0.5,
        estimatedSpeed: 'medium',
        qualityRating: 4.5,
        isActive: false,
        tags: ['经典', '专业', '视频生成', '细节丰富'],
        supportedModes: [
          'text_to_video',
          'image_to_video',
          'first_last_frame',
          'reference_to_video',
          'multi_frame',
          'template',
          'template_story',
        ],
        supportedAspectRatios: ['16:9', '9:16', '3:4', '4:3', '1:1'],
        supportedResolutions: ['540p', '720p', '1080p'],
      },
      {
        id: 'viduq2-turbo',
        modelId: 'viduq2-turbo',
        name: 'Vidu Q2 Turbo',
        provider: 'vidu',
        type: 'video',
        description: 'Vidu Q2 快速版，经典快速视频生成模型，细节丰富，动态连贯',
        capabilities: ['text-to-video', 'image-to-video', 'first-last-frame', 'reference-to-video'],
        maxResolution: '1920x1080',
        maxDuration: 10,
        supportedDurations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        costPerMinute: 0.4,
        estimatedSpeed: 'fast',
        qualityRating: 4.3,
        isActive: false,
        tags: ['经典', '快速', '性价比'],
        supportedModes: [
          'text_to_video',
          'image_to_video',
          'first_last_frame',
          'reference_to_video',
        ],
        supportedAspectRatios: ['16:9', '9:16', '3:4', '4:3', '1:1'],
        supportedResolutions: ['540p', '720p', '1080p'],
      },
      {
        id: 'viduq2-pro-fast',
        modelId: 'viduq2-pro-fast',
        name: 'Vidu Q2 Pro Fast',
        provider: 'vidu',
        type: 'video',
        description: 'Vidu Q2 Pro快速版，价格触底、效果稳定，生成速度较Q2 Turbo提高2-3倍',
        capabilities: ['image-to-video', 'first-last-frame'],
        maxResolution: '1920x1080',
        maxDuration: 10,
        supportedDurations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        costPerMinute: 0.3,
        estimatedSpeed: 'fast',
        qualityRating: 4.3,
        isActive: false,
        tags: ['快速', '性价比', '图生视频'],
        supportedModes: ['image_to_video', 'first_last_frame'],
        supportedAspectRatios: ['16:9', '9:16', '3:4', '4:3', '1:1'],
        supportedResolutions: ['720p', '1080p'],
      },
      {
        id: 'viduq2',
        modelId: 'viduq2',
        name: 'Vidu Q2',
        provider: 'vidu',
        type: 'video',
        description: 'Vidu Q2，动态效果好，生成细节丰富',
        capabilities: ['text-to-video', 'reference-to-video'],
        maxResolution: '1920x1080',
        maxDuration: 10,
        supportedDurations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        costPerMinute: 0.35,
        estimatedSpeed: 'medium',
        qualityRating: 4.3,
        isActive: false,
        supportedModes: ['text_to_video', 'reference_to_video'],
        supportedAspectRatios: ['16:9', '9:16', '3:4', '4:3', '1:1'],
        supportedResolutions: ['540p', '720p', '1080p'],
      },
      {
        id: 'MiniMax-M2.7-highspeed',
        name: 'MiniMax M2.7 Highspeed',
        provider: 'minimax',
        type: 'text',
        description:
          '高速旗舰模型，100tps输出速度，230B/10B MoE架构，SWE-bench 78%，支持思考模式/函数调用/JSON模式/提示词缓存',
        capabilities: [
          'text-generation',
          'chat',
          'reasoning',
          'tool-calling',
          'thinking',
          'json-mode',
          'prompt-caching',
          'code-generation',
        ],
        costPerMinute: 0.06,
        estimatedSpeed: 'fast',
        qualityRating: 4.9,
        isActive: true,
        isPopular: true,
        tags: ['MiniMax', 'M2.7', '旗舰', '推理', '代码', '推荐'],
      },
      {
        id: 'MiniMax-M2.7',
        name: 'MiniMax M2.7',
        provider: 'minimax',
        type: 'text',
        description:
          '标准旗舰模型，230B总参/10B激活，适合高复杂度推理/工程/长文档分析，支持思考模式/函数调用/JSON模式',
        capabilities: [
          'text-generation',
          'chat',
          'reasoning',
          'tool-calling',
          'thinking',
          'json-mode',
          'prompt-caching',
          'code-generation',
        ],
        costPerMinute: 0.06,
        estimatedSpeed: 'medium',
        qualityRating: 4.9,
        isActive: true,
        isPopular: false,
        tags: ['MiniMax', 'M2.7', '旗舰', '深度推理'],
      },
      {
        id: 'MiniMax-M2.5-highspeed',
        name: 'MiniMax M2.5 Highspeed',
        provider: 'minimax',
        type: 'text',
        description:
          '高速代码强化模型，偏代码与结构化生成，适合提示词优化/函数调用/工作流编排，支持提示词缓存',
        capabilities: [
          'text-generation',
          'chat',
          'code-generation',
          'tool-calling',
          'json-mode',
          'prompt-caching',
        ],
        costPerMinute: 0.04,
        estimatedSpeed: 'fast',
        qualityRating: 4.7,
        isActive: true,
        isPopular: true,
        tags: ['MiniMax', 'M2.5', '代码', '结构化', '推荐'],
      },
      {
        id: 'MiniMax-M2.5',
        name: 'MiniMax M2.5',
        provider: 'minimax',
        type: 'text',
        description: '标准代码强化模型，适合稳定的工程生成任务，支持函数调用与提示词缓存',
        capabilities: [
          'text-generation',
          'chat',
          'code-generation',
          'tool-calling',
          'json-mode',
          'prompt-caching',
        ],
        costPerMinute: 0.04,
        estimatedSpeed: 'medium',
        qualityRating: 4.7,
        isActive: true,
        isPopular: false,
        tags: ['MiniMax', 'M2.5', '代码', '工程'],
      },
      {
        id: 'image-01',
        name: 'MiniMax Image-01',
        provider: 'minimax',
        type: 'image',
        description:
          'MiniMax Image-01 高质量图片生成模型，支持文生图和图生图，最高 2048x2048 分辨率，支持参考图',
        capabilities: ['text_to_image', 'image_to_image', 'reference'],
        maxResolution: '2048x2048',
        supportedResolutions: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9'],
        supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9'],
        estimatedSpeed: 'fast',
        qualityRating: 4.7,
        isActive: true,
        isPopular: false,
        tags: ['MiniMax Image-01', '图片生成', '2K高清', '图生图', '参考图'],
        defaultParams: {
          model: 'image-01',
          aspect_ratio: '16:9',
          n: 1,
          response_format: 'url',
          prompt_optimizer: true,
        },
      },
      {
        id: 'speech-01-hd',
        name: 'MiniMax Speech-01 HD',
        provider: 'minimax',
        type: 'audio',
        description: 'MiniMax 最新代高质量文本转语音，支持情绪控制、声音克隆和设计',
        capabilities: [
          'text-to-speech',
          'voice-cloning',
          'voice-design',
          'voice-management',
          'emotion-control',
          'latency-control',
        ],
        costPerMinute: 0.12,
        estimatedSpeed: 'fast',
        qualityRating: 4.9,
        isActive: true,
        isPopular: true,
        tags: ['音频', 'TTS', '高清', 'MiniMax', '推荐'],
        voiceOptions: [
          {
            voice_id: 'female-tianmei',
            name: '甜妹',
            gender: 'female',
            language: '中文',
            description: '甜美可爱的女声',
          },
          {
            voice_id: 'female-shaonv',
            name: '少女',
            gender: 'female',
            language: '中文',
            description: '清新活泼的女声',
          },
          {
            voice_id: 'female-yujie',
            name: '御姐',
            gender: 'female',
            language: '中文',
            description: '成熟稳重的女声',
          },
          {
            voice_id: 'male-xiaohei',
            name: '小黑',
            gender: 'male',
            language: '中文',
            description: '磁性沉稳的男声',
          },
          {
            voice_id: 'male-xiaobai',
            name: '小白',
            gender: 'male',
            language: '中文',
            description: '清亮活泼的男声',
          },
          {
            voice_id: 'male-xiaogang',
            name: '小刚',
            gender: 'male',
            language: '中文',
            description: '硬朗有力的男声',
          },
          {
            voice_id: 'male-xiaoyang',
            name: '小阳',
            gender: 'male',
            language: '中文',
            description: '温暖阳光的男声',
          },
          {
            voice_id: 'female-xiaoyuan',
            name: '小媛',
            gender: 'female',
            language: '中文',
            description: '温柔亲切的女声',
          },
        ],
      },
      {
        id: 'speech-01-turbo',
        name: 'MiniMax Speech-01 Turbo',
        provider: 'minimax',
        type: 'audio',
        description: 'MiniMax 极速文本转语音，低延迟，适合实时对话场景',
        capabilities: ['text-to-speech', 'latency-control'],
        costPerMinute: 0.08,
        estimatedSpeed: 'fast',
        qualityRating: 4.5,
        isActive: true,
        tags: ['音频', 'TTS', '极速', '低延迟', 'MiniMax'],
        voiceOptions: [
          { voice_id: 'female-tianmei', name: '甜妹', gender: 'female', language: '中文' },
          { voice_id: 'male-xiaohei', name: '小黑', gender: 'male', language: '中文' },
        ],
      },
      {
        id: 'speech-2.8-hd',
        name: 'MiniMax TTS 2.8 HD',
        provider: 'minimax',
        type: 'audio',
        description: 'MiniMax 经典高质量文本转语音，2.8版本',
        capabilities: ['text-to-speech'],
        costPerMinute: 0.1,
        estimatedSpeed: 'fast',
        qualityRating: 4.8,
        isActive: true,
        tags: ['音频', 'TTS', '经典', 'MiniMax'],
        voiceOptions: [
          { voice_id: 'female-tianmei', name: '甜妹', gender: 'female', language: '中文' },
          { voice_id: 'male-xiaohei', name: '小黑', gender: 'male', language: '中文' },
        ],
      },
      {
        id: 'step-tts-mini',
        modelId: 'step-tts-mini',
        name: 'Step TTS Mini',
        provider: 'stepfun',
        type: 'audio',
        description: '轻量文本转语音模型，支持高情绪表现力和风格控制',
        capabilities: ['text-to-speech', 'style-control'],
        costPerMinute: 0.08,
        estimatedSpeed: 'fast',
        qualityRating: 4.6,
        isActive: true,
        isPopular: true,
        tags: ['音频', 'TTS', 'StepFun', '优先'],
        voiceOptions: [
          { voice_id: 'cixingnansheng', name: '磁性男声', gender: 'male', language: '中文' },
          { voice_id: 'linjiajiejie', name: '邻家姐姐', gender: 'female', language: '中文' },
        ],
      },
      {
        id: 'step-tts-2',
        modelId: 'step-tts-2',
        name: 'Step TTS 2',
        provider: 'stepfun',
        type: 'audio',
        description: '高质量文本转语音模型，适合通用高质量配音合成',
        capabilities: ['text-to-speech', 'style-control'],
        costPerMinute: 0.08,
        estimatedSpeed: 'fast',
        qualityRating: 4.7,
        isActive: true,
        tags: ['音频', 'TTS', 'StepFun'],
        voiceOptions: [
          { voice_id: 'cixingnansheng', name: '磁性男声', gender: 'male', language: '中文' },
          { voice_id: 'linjiajiejie', name: '邻家姐姐', gender: 'female', language: '中文' },
        ],
      },
      {
        id: 'stepaudio-2.5-asr',
        modelId: 'stepaudio-2.5-asr',
        name: 'StepAudio 2.5 ASR',
        provider: 'stepfun',
        type: 'audio',
        description: '4B MTP 极速语音识别模型，支持 HTTP SSE 流式返回文本',
        capabilities: ['speech-to-text', 'asr'],
        costPerMinute: 0.05,
        estimatedSpeed: 'fast',
        qualityRating: 4.8,
        isActive: true,
        tags: ['音频', 'ASR', '语音识别', 'StepFun', '优先'],
      },
      {
        id: 'stepaudio-2-asr-pro',
        modelId: 'stepaudio-2-asr-pro',
        name: 'StepAudio 2 ASR Pro',
        provider: 'stepfun',
        type: 'audio',
        description: '32B 参数 ASR Pro 大参数语音识别模型，更高精度转写，支持 HTTP SSE 流式',
        capabilities: ['speech-to-text', 'asr'],
        costPerMinute: 0.1,
        estimatedSpeed: 'medium',
        qualityRating: 4.9,
        isActive: true,
        isPopular: true,
        tags: ['音频', 'ASR', '语音识别', 'StepFun', 'Pro', '优先'],
      },
      {
        id: 'stepaudio-2.5-chat',
        modelId: 'stepaudio-2.5-chat',
        name: 'StepAudio 2.5 Chat',
        provider: 'stepfun',
        type: 'text',
        description: '自然语音对话模型，Chat Completions 文本返回',
        capabilities: ['chat', 'audio-chat', 'text-generation'],
        costPerMinute: 0.06,
        estimatedSpeed: 'fast',
        qualityRating: 4.7,
        isActive: true,
        tags: ['StepFun', '语音对话', '文本'],
      },
      {
        id: 'step-1o-audio',
        modelId: 'step-1o-audio',
        name: 'Step-1o Audio',
        provider: 'stepfun',
        type: 'audio',
        description: '端到端音频理解与语音对话模型，适合语音交互场景',
        capabilities: ['audio-chat', 'voice-agent', 'speech-understanding'],
        costPerMinute: 0.12,
        estimatedSpeed: 'fast',
        qualityRating: 4.7,
        isActive: true,
        tags: ['StepFun', '语音对话', '音频理解'],
      },
      {
        id: 'stepaudio-2.5-realtime',
        modelId: 'stepaudio-2.5-realtime',
        name: 'StepAudio 2.5 Realtime',
        provider: 'stepfun',
        type: 'audio',
        description: '实时语音对话模型，WebSocket 双向实时语音',
        capabilities: ['realtime-audio', 'websocket', 'voice-agent'],
        costPerMinute: 0.12,
        estimatedSpeed: 'fast',
        qualityRating: 4.8,
        isActive: true,
        tags: ['StepFun', '实时语音', 'Voice Agent'],
      },
      {
        id: 'lyrics_generation',
        name: '歌词生成',
        provider: 'minimax',
        type: 'audio',
        description: '根据描述或主题自动生成歌词内容',
        capabilities: ['lyrics-generation'],
        costPerMinute: 0.05,
        estimatedSpeed: 'fast',
        qualityRating: 4.5,
        isActive: true,
        tags: ['音频', '歌词生成', 'MiniMax'],
      },
      {
        id: 'music-cover',
        name: '音乐封面生成',
        provider: 'minimax',
        type: 'audio',
        description: '为音乐生成封面图片',
        capabilities: ['music-cover', 'image-generation'],
        maxResolution: '1024x1024',
        costPerImage: 0.01,
        estimatedSpeed: 'fast',
        qualityRating: 4.6,
        isActive: true,
        tags: ['音频', '封面生成', 'MiniMax'],
      },
      {
        id: 'music-2.6',
        name: 'Music 2.6',
        provider: 'minimax',
        type: 'audio',
        description: 'MiniMax 最新音乐生成模型，支持歌词和风格描述生成完整歌曲',
        capabilities: ['music-generation', 'lyrics'],
        costPerMinute: 0.15,
        estimatedSpeed: 'medium',
        qualityRating: 4.8,
        isActive: true,
        isPopular: true,
        tags: ['音频', '音乐生成', 'MiniMax', '推荐'],
      },
      {
        id: 'speech-2.8-hd-tts',
        name: 'TTS HD (完整版)',
        provider: 'minimax',
        type: 'audio',
        description: 'MiniMax TTS HD 完整版，支持声音克隆、声音设计、声音管理',
        capabilities: ['text-to-speech', 'voice-cloning', 'voice-design', 'voice-management'],
        costPerMinute: 0.12,
        estimatedSpeed: 'fast',
        qualityRating: 4.9,
        isActive: true,
        isPopular: true,
        tags: ['音频', 'TTS', '语音合成', '声音克隆', '声音设计', 'MiniMax', '推荐'],
        voiceOptions: [
          {
            voice_id: 'female-tianmei',
            name: '甜妹',
            gender: 'female',
            language: '中文',
            description: '甜美可爱的女声',
          },
          {
            voice_id: 'female-shaonv',
            name: '少女',
            gender: 'female',
            language: '中文',
            description: '清新活泼的女声',
          },
          {
            voice_id: 'female-yujie',
            name: '御姐',
            gender: 'female',
            language: '中文',
            description: '成熟稳重的女声',
          },
          {
            voice_id: 'male-xiaohei',
            name: '小黑',
            gender: 'male',
            language: '中文',
            description: '磁性沉稳的男声',
          },
          {
            voice_id: 'male-xiaobai',
            name: '小白',
            gender: 'male',
            language: '中文',
            description: '清亮活泼的男声',
          },
          {
            voice_id: 'male-xiaogang',
            name: '小刚',
            gender: 'male',
            language: '中文',
            description: '硬朗有力的男声',
          },
          {
            voice_id: 'male-xiaoyang',
            name: '小阳',
            gender: 'male',
            language: '中文',
            description: '温暖阳光的男声',
          },
          {
            voice_id: 'female-xiaoyuan',
            name: '小媛',
            gender: 'female',
            language: '中文',
            description: '温柔亲切的女声',
          },
          {
            voice_id: 'male-john',
            name: 'John',
            gender: 'male',
            language: '英文',
            description: '英式英语男声',
          },
          {
            voice_id: 'male-davis',
            name: 'Davis',
            gender: 'male',
            language: '英文',
            description: '美式英语男声',
          },
          {
            voice_id: 'female-emma',
            name: 'Emma',
            gender: 'female',
            language: '英文',
            description: '英式英语女声',
          },
          {
            voice_id: 'female-bella',
            name: 'Bella',
            gender: 'female',
            language: '英文',
            description: '美式英语女声',
          },
        ],
      },
    ];

    const actionModelRequirements: Record<string, string[]> = {
      'image-eraser': ['image', 'mask'],
      'image-upscaler': ['image'],
      'image-remove-background': ['image'],
      'midjourney-variation': ['task_id', 'image_no'],
      'midjourney-upscale': ['task_id', 'image_no'],
      'midjourney-reroll': ['task_id'],
      'midjourney-outpaint': ['task_id', 'image_no'],
      'midjourney-inpaint': ['task_id', 'image_no', 'mask'],
      'midjourney-remix': ['task_id', 'image_no'],
      'midjourney-remove-background': ['image'],
      'mj-variation': ['task_id', 'image_no'],
      'mj-upscale': ['task_id', 'image_no'],
      'mj-reroll': ['task_id'],
      'mj-outpaint': ['task_id', 'image_no'],
      'mj-inpaint': ['task_id', 'image_no', 'mask'],
      'mj-remix': ['task_id', 'image_no'],
      'mj-remove-background': ['image'],
      'Package_1.0': ['video'],
    };

    defaultModels.push(
      {
        id: 'hidream-o1-image-1.5', modelId: 'HiDream-O1-Image-1.5', name: 'HiDream-O1-Image-1.5', provider: 'hidream', type: 'image',
        description: 'HiDream 热门旗舰图片模型', capabilities: ['text-to-image', 'image-to-image', 'reference'], maxResolution: '2K', qualityRating: 4.9, isActive: true, isPopular: true, tags: ['热门', '旗舰', 'HiDream'], supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'], supportedResolutions: ['1K', '2K'],
      },
      {
        id: 'hunyuan-image-3.0-instruct', modelId: 'Hunyuan-Image-3.0-Instruct', name: 'Hunyuan-Image-3.0-Instruct', provider: 'hunyuan', type: 'image',
        description: '混元旗舰指令图片模型', capabilities: ['text-to-image', 'image-to-image', 'reference', 'image-edit'], maxResolution: '2K', qualityRating: 4.9, isActive: true, isPopular: true, tags: ['热门', '旗舰', '指令编辑'], supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'], supportedResolutions: ['1K', '2K'],
      },
      {
        id: 'qwen-image-3.0-pro', modelId: 'Qwen-Image-3.0-Pro', name: 'Qwen-Image-3.0 Pro', provider: 'qwen', type: 'image',
        description: 'Qwen 旗舰图片模型，适合高质量文字渲染', capabilities: ['text-to-image', 'image-to-image', 'reference'], maxResolution: '2K', qualityRating: 4.8, isActive: true, isPopular: true, tags: ['热门', '旗舰', '文字渲染'], supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'], supportedResolutions: ['1K', '2K'],
      },
      {
        id: 'minimax-h3', modelId: 'minimax-h3', name: 'MiniMax H3', provider: 'minimax', type: 'video',
        description: 'MiniMax H3 热门旗舰视频模型', capabilities: ['text-to-video', 'image-to-video'], maxResolution: '1920x1080', maxDuration: 10, supportedDurations: [5, 6, 10], qualityRating: 4.9, isActive: true, isPopular: true, tags: ['热门', '旗舰', 'MiniMax H3'], supportedModes: ['text_to_video', 'image_to_video'], supportedAspectRatios: ['16:9', '9:16', '1:1'], supportedResolutions: ['720p', '1080p'],
      },
      {
        id: 'doubao-seedance-2-5', modelId: 'doubao-seedance-2-5', name: 'Seedance 2.5', provider: 'doubao', type: 'video',
        description: 'Seedance 2.5 热门旗舰视频模型', capabilities: ['text-to-video', 'image-to-video', 'first-last-frame', 'reference-to-video'], maxResolution: '1920x1080', maxDuration: 10, supportedDurations: [5, 10], qualityRating: 4.9, isActive: true, isPopular: true, tags: ['热门', '旗舰', 'Seedance 2.5'], supportedModes: ['text_to_video', 'image_to_video', 'first_last_frame', 'reference_to_video'], supportedAspectRatios: ['16:9', '9:16', '1:1'], supportedResolutions: ['720p', '1080p'],
      },
      {
        id: 'happyhorse-1.1', modelId: 'happyhorse-1.1', name: 'HappyHorse 1.1', provider: 'happyhorse', type: 'video',
        description: 'HappyHorse 1.1 热门旗舰视频模型', capabilities: ['text-to-video', 'image-to-video'], maxResolution: '1920x1080', maxDuration: 10, supportedDurations: [5, 10], qualityRating: 4.8, isActive: true, isPopular: true, tags: ['热门', '旗舰', 'HappyHorse'], supportedModes: ['text_to_video', 'image_to_video'], supportedAspectRatios: ['16:9', '9:16', '1:1'], supportedResolutions: ['720p', '1080p'],
      },
      {
        id: 'wan2.7-video', modelId: 'wan2.7-video', name: '通义万相 Wan 2.7', provider: 'wan', type: 'video',
        description: '通义万相 Wan 2.7 热门旗舰视频模型', capabilities: ['text-to-video', 'image-to-video'], maxResolution: '1920x1080', maxDuration: 10, supportedDurations: [5, 10], qualityRating: 4.8, isActive: true, isPopular: true, tags: ['热门', '旗舰', 'Wan 2.7'], supportedModes: ['text_to_video', 'image_to_video'], supportedAspectRatios: ['16:9', '9:16', '1:1'], supportedResolutions: ['720p', '1080p'],
      },
      {
        id: 'viduq3-pro', modelId: 'viduq3-pro', name: 'Vidu Q3 Pro', provider: 'vidu', type: 'video',
        description: 'Vidu Q3 Pro 热门旗舰视频模型', capabilities: ['text-to-video', 'image-to-video', 'first-last-frame', 'reference-to-video'], maxResolution: '1920x1080', maxDuration: 16, supportedDurations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], qualityRating: 4.9, isActive: true, isPopular: true, tags: ['热门', '旗舰', 'Vidu Q3'], supportedModes: ['text_to_video', 'image_to_video', 'first_last_frame', 'reference_to_video'], supportedAspectRatios: ['16:9', '9:16', '3:4', '4:3', '1:1'], supportedResolutions: ['540p', '720p', '1080p'],
      },
      {
        id: 'skyreels-v4', modelId: 'skyreels-v4', name: 'SkyReels V4', provider: 'skyreels', type: 'video',
        description: 'SkyReels V4 热门旗舰视频模型', capabilities: ['text-to-video', 'image-to-video'], maxResolution: '1920x1080', maxDuration: 10, supportedDurations: [5, 10], qualityRating: 4.8, isActive: true, isPopular: true, tags: ['热门', '旗舰', 'SkyReels'], supportedModes: ['text_to_video', 'image_to_video'], supportedAspectRatios: ['16:9', '9:16', '1:1'], supportedResolutions: ['720p', '1080p'],
      },
      {
        id: 'hailuo-video-2.3', modelId: 'hailuo-video-2.3', name: '海螺 Hailuo 2.3', provider: 'hailuo', type: 'video',
        description: '海螺 Hailuo 2.3 热门旗舰视频模型', capabilities: ['text-to-video', 'image-to-video', 'first-last-frame', 'video-to-video'], maxResolution: '1920x1080', maxDuration: 10, supportedDurations: [6, 10], qualityRating: 4.8, isActive: true, isPopular: true, tags: ['热门', '旗舰', 'Hailuo 2.3'], supportedModes: ['text_to_video', 'image_to_video', 'first_last_frame', 'video_to_video'], supportedAspectRatios: ['16:9', '9:16', '1:1'], supportedResolutions: ['768p', '1080p'],
      },
    );

    defaultModels.forEach((model) => {
      const requiredInputs = actionModelRequirements[model.modelId || model.id];
      const modelInfo = requiredInputs
        ? { ...model, modelCategory: 'action' as const, requiredInputs }
        : model;
      this.models.set(modelInfo.id, modelInfo);
    });

    logger.info(`模型注册表初始化完成，共 ${defaultModels.length} 个模型`);
  }

  public getAllModels(): ModelInfo[] {
    return Array.from(this.models.values()).filter((m) => m.isActive && !this.isHiddenModelIdentity(m.provider, m.id, m.modelId));
  }

  public getModelsByProvider(provider: APIProvider): ModelInfo[] {
    return Array.from(this.models.values()).filter((m) => m.provider === provider && m.isActive && !this.isHiddenModelIdentity(m.provider, m.id, m.modelId));
  }

  public getModelsByType(
    type: 'image' | 'video' | 'audio' | 'music' | 'text' | 'both'
  ): ModelInfo[] {
    return Array.from(this.models.values())
      .filter(
        (m) =>
          (type === 'both' && m.type === 'both') ||
          m.type === type ||
          (type === 'image' && m.type === 'both') ||
          (type === 'video' && m.type === 'both') ||
          // audio 查询同时包含 music 类型模型，保证音频节点可见音乐生成模型
          (type === 'audio' && (m.type === 'both' || m.type === 'music')) ||
          (type === 'music' && m.type === 'both')
      )
      .filter((m) => m.isActive);
  }

  public getModelById(id: string): ModelInfo | undefined {
    return this.models.get(id);
  }

  public getPopularModels(limit: number = 10): ModelInfo[] {
    return this.getAllModels()
      .filter((m) => m.isPopular)
      .sort((a, b) => (b.qualityRating || 0) - (a.qualityRating || 0))
      .slice(0, limit);
  }

  public searchModels(query: string): ModelInfo[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllModels().filter(
      (m) =>
        m.name.toLowerCase().includes(lowerQuery) ||
        m.description.toLowerCase().includes(lowerQuery) ||
        m.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  }

  public getModelsByTags(tags: string[]): ModelInfo[] {
    return this.getAllModels().filter((m) => tags.some((tag) => m.tags.includes(tag)));
  }

  public addModel(model: ModelInfo): void {
    this.models.set(model.id, model);
    logger.info(`添加新模型: ${model.name}`);
  }

  public updateModel(id: string, updates: Partial<ModelInfo>): void {
    const model = this.models.get(id);
    if (model) {
      this.models.set(id, { ...model, ...updates });
      logger.info(`更新模型: ${model.name}`);
    }
  }

  public markModelAsUsed(modelId: string, userId: string = 'default'): void {
    const prefs = this.getUserPreferences(userId);
    prefs.usageCount[modelId] = (prefs.usageCount[modelId] || 0) + 1;

    prefs.recentUsed = [modelId, ...prefs.recentUsed.filter((id) => id !== modelId)].slice(0, 20);

    this.saveUserPreferences();
  }

  public addToFavorites(modelId: string, userId: string = 'default'): void {
    const prefs = this.getUserPreferences(userId);
    if (!prefs.favoriteModels.includes(modelId)) {
      prefs.favoriteModels.push(modelId);
      this.saveUserPreferences();
      logger.info(`添加收藏模型: ${modelId}`);
    }
  }

  public removeFromFavorites(modelId: string, userId: string = 'default'): void {
    const prefs = this.getUserPreferences(userId);
    prefs.favoriteModels = prefs.favoriteModels.filter((id) => id !== modelId);
    this.saveUserPreferences();
    logger.info(`移除收藏模型: ${modelId}`);
  }

  public getFavoriteModels(userId: string = 'default'): ModelInfo[] {
    const prefs = this.getUserPreferences(userId);
    return prefs.favoriteModels
      .map((id) => this.models.get(id))
      .filter((m): m is ModelInfo => m !== undefined);
  }

  public getRecentUsedModels(userId: string = 'default'): ModelInfo[] {
    const prefs = this.getUserPreferences(userId);
    return prefs.recentUsed
      .map((id) => this.models.get(id))
      .filter((m): m is ModelInfo => m !== undefined);
  }

  private getUserPreferences(userId: string) {
    if (!this.userPreferences.has(userId)) {
      this.userPreferences.set(userId, {
        favoriteModels: [],
        recentUsed: [],
        usageCount: {},
      });
    }
    return this.userPreferences.get(userId)!;
  }

  private loadUserPreferences() {
    try {
      const saved = localStorage.getItem('model-registry-preferences');
      if (saved) {
        const data = JSON.parse(saved);
        Object.entries(data).forEach(([userId, prefs]) => {
          this.userPreferences.set(userId, prefs as any);
        });
      }
    } catch (error) {
      logger.warn('加载用户偏好失败:', error);
    }
  }

  private saveUserPreferences() {
    try {
      const data = Object.fromEntries(this.userPreferences);
      localStorage.setItem('model-registry-preferences', JSON.stringify(data));
    } catch (error) {
      logger.warn('保存用户偏好失败:', error);
    }
  }

  public getAllProviders(): ProviderModels[] {
    const providers: Map<APIProvider, ModelInfo[]> = new Map();

    this.getAllModels().forEach((model) => {
      if (!providers.has(model.provider)) {
        providers.set(model.provider, []);
      }
      providers.get(model.provider)!.push(model);
    });

    return Array.from(providers.entries()).map(([provider, models]) => ({
      provider,
      models,
    }));
  }
}

const modelRegistryGlobal = globalThis as typeof globalThis & {
  __xiaotianModelRegistry?: ModelRegistry;
};

// Vite may resolve extensionless and explicit `.ts` imports to different module URLs.
// Keep one registry on globalThis so every consumer observes the same refreshed models.
export const modelRegistry =
  modelRegistryGlobal.__xiaotianModelRegistry || ModelRegistry.getInstance();
modelRegistryGlobal.__xiaotianModelRegistry = modelRegistry;
export default ModelRegistry;
