import { APIProvider, APIAuthConfig, DEFAULT_PROVIDER_CONFIGS } from '@/types/api-controller';
import useUnifiedAPIConfigStore, { type ProviderConfig } from '@/store/useUnifiedAPIConfigStore';
import { modelRegistry, ModelInfo } from '@/services/model-registry';
import { logger } from '@/lib/logger';
import { useMembershipStore } from '@/store/useMembershipStore';

export interface UnifiedModelConfig {
  modelId: string;
  modelInfo: ModelInfo;
  provider: APIProvider;
  authConfig: APIAuthConfig | null;
  isConfigured: boolean;
  isAvailable: boolean;
}

export interface ProviderWithModels {
  provider: APIProvider;
  providerInfo: typeof DEFAULT_PROVIDER_CONFIGS[0];
  models: ModelInfo[];
  isConfigured: boolean;
}

class UnifiedAPIModelService {
  private static instance: UnifiedAPIModelService;
  private readonly fixedDefaultModelIds: Record<'image' | 'video', string[]> = {
    image: ['sensenova-u1-fast', 'step-image-edit-2', 'doubao-seedream-5-0-lite', 'doubao-seedream-5-0-pro', 'agnes-image-2.1-flash'],
    video: ['agnes-video-v2.0', 'viduq3-turbo', 'viduq3-pro', 'doubao-seedance-2-0', 'kling-3.0-turbo', 'kling-3.0'],
  };
  private readonly hiddenModels: Set<string> = new Set([
    'dall-e-3',
    'dall-e',
    'dalle',
    'dalle3',
    'nvidia-glm-5.1',
    'nvidia-gemma-4',
    'nvidia-kimi-k2.6',
    'kimi-k2-thinking',
  ]);
  private readonly aicg2ImageModelIds: string[] = [];
  private readonly membershipModelAllowList: Record<string, Set<string> | null> = {
    enterprise: null,
    pro: null,
    trial: null,
    basic: new Set([
      'doubao-seedance-2-0',
      'doubao-seedance-2.0',
      'doubao-seedance-2-0-260128',
      'doubao-seedance-2-0-fast',
      'doubao-seedance-2.0-fast',
      'doubao-seedance-2-0-fast-260128',
      'kling-3.0-turbo',
      'kling-3.0',
      'doubao-seedance-1-5-pro-251215',
      'doubao-seedance-1-5-pro',
      'doubao-seedream-5-0-lite',
      'doubao-seedream-5.0-lite',
      'doubao-seedream-5-0-pro',
      'doubao-seedream-5.0-pro',
      'doubao-seedream-4-5',
      'doubao-seedream-4.5',
      'doubao-seedance-1-5-pro',
      'viduq3-turbo',
      'viduq3-pro',
      'viduq3-pro-fast',
      'viduq3-mix',
      'viduq2-pro',
      'viduq2-pro-fast',
      'viduq2-turbo',
      'viduq2',
      'agnes-video-v2.0',
      'agnes-image-2.1-flash',
      'sensenova-u1-fast',
      'step-image-edit-2',
      'stepaudio-2.5-tts',
      'step-tts-mini',
      'step-tts-2',
      'stepaudio-2.5-asr',
      'stepaudio-2.5-chat',
      'step-1o-audio',
      'stepaudio-2.5-realtime',
      ...this.aicg2ImageModelIds,
    ]),
    free: new Set([
      'doubao-seedream-5-0-lite',
      'doubao-seedream-5.0-lite',
      'doubao-seedream-5-0-pro',
      'doubao-seedream-5.0-pro',
      'doubao-seedream-4-5',
      'doubao-seedream-4.5',
      'doubao-seedance-2-0',
      'doubao-seedance-2.0',
      'doubao-seedance-2-0-260128',
      'doubao-seedance-2-0-fast',
      'doubao-seedance-2.0-fast',
      'doubao-seedance-2-0-fast-260128',
      'kling-3.0-turbo',
      'kling-3.0',
      'doubao-seedance-1-5-pro',
      'viduq3-turbo',
      'viduq3-pro',
      'viduq3-pro-fast',
      'viduq3-mix',
      'viduq2-pro',
      'viduq2-pro-fast',
      'viduq2-turbo',
      'viduq2',
      'agnes-video-v2.0',
      'agnes-image-2.1-flash',
      'sensenova-u1-fast',
      'step-image-edit-2',
      'stepaudio-2.5-tts',
      'step-tts-mini',
      'step-tts-2',
      'stepaudio-2.5-asr',
      'stepaudio-2.5-chat',
      'step-1o-audio',
      'stepaudio-2.5-realtime',
      ...this.aicg2ImageModelIds,
    ]),
  };
  private readonly membershipDefaultModelPriority: Record<string, Record<'image' | 'video', string[]>> = {
    enterprise: {
      image: [
        'sensenova-u1-fast',
        'agnes-image-2.1-flash',
        'step-image-edit-2',
        'doubao-seedream-5-0-lite',
        'doubao-seedream-5.0-lite',
        'doubao-seedream-5-0-pro',
        'doubao-seedream-5.0-pro',
        'doubao-seedream-5-0',
        'doubao-seedream-5.0',
      ],
      video: [
        'agnes-video-v2.0',
        'doubao-seedance-2-0',
        'kling-3.0-turbo',
        'kling-3.0',
        'viduq3-turbo',
        'viduq3-pro',
      ],
    },
    pro: {
      image: [
        'sensenova-u1-fast',
        'agnes-image-2.1-flash',
        'step-image-edit-2',
        'doubao-seedream-5-0-lite',
        'doubao-seedream-5.0-lite',
        'doubao-seedream-5-0-pro',
        'doubao-seedream-5.0-pro',
        'doubao-seedream-5-0',
        'doubao-seedream-5.0',
      ],
      video: [
        'agnes-video-v2.0',
        'doubao-seedance-2-0',
        'kling-3.0-turbo',
        'kling-3.0',
        'viduq3-turbo',
        'viduq3-pro',
      ],
    },
    basic: {
      image: [
        'sensenova-u1-fast',
        'agnes-image-2.1-flash',
        'step-image-edit-2',
        'doubao-seedream-5-0-lite',
      ],
      video: [
        'agnes-video-v2.0',
        'doubao-seedance-2-0',
        'kling-3.0-turbo',
        'kling-3.0',
        'viduq3-turbo',
        'viduq3-pro',
      ],
    },
    free: {
      image: [
        'sensenova-u1-fast',
        'agnes-image-2.1-flash',
        'step-image-edit-2',
        'doubao-seedream-5-0-lite',
      ],
      video: ['agnes-video-v2.0', 'doubao-seedance-2-0', 'kling-3.0-turbo', 'kling-3.0', 'viduq3-turbo', 'viduq3-pro'],
    },
  };

  // Provider名称别名映射 - 与api-client.ts的mapProviderName保持一致
  private providerNameAliases: Record<string, string> = {
    haiperAI: 'haiper',
    minimaxVideo: 'minimax',
    minimax: 'minimax',
    'doubao-video': 'doubao',  // 豆包视频映射到豆包，与api-client.ts一致
    bytedance: 'doubao',  // 字节跳动映射到豆包
    seedream: 'doubao',   // Seedream (豆包图片) 映射到豆包
    // Vidu系列映射到 vidu（与后端ViduProvider.name保持一致）
    'viduq3-pro': 'vidu',
    'viduq3-pro-fast': 'vidu',
    'viduq3-turbo': 'vidu',
    'viduq3-mix': 'vidu',
    'kling-3.0-turbo': 'kling',
    'kling-3.0': 'kling',
    'viduq2-pro': 'vidu',
    'viduq2-pro-fast': 'vidu',
    'viduq2-turbo': 'vidu',
    viduq2: 'vidu',
    vidi2_i2v: 'vidu',
    vidi2_start_end: 'vidu',
    vidi2_reference: 'vidu',
    vidu20: 'vidu',
    hailuo: 'minimax',
  };

  /**
   * 同一服务商的 provider 关联组。
   * 组内任一 provider 在后端配置了秘钥，则组内所有 provider 都视为已配置。
   */
  private readonly providerAffinityGroups: string[][] = [
    // 豆包系列
    ['doubao', 'doubao-video', 'bytedance', 'seedream', 'jimeng'],
    // MiniMax 系列
    ['minimax', 'minimaxVideo', 'hailuo'],
    // Vidu 系列
    ['vidu'],
    ['kling'],
    ['stepfun'],
  ];

  // 模型ID别名映射 - 解决模型ID不匹配问题
  private modelIdAliases: Record<string, string[]> = {
    'image-01': ['image_01'],
    image_01: ['image-01'],
    'doubao-seedream-5.0': ['doubao-seedream-5-0'],
    'doubao-seedream-5-0': ['doubao-seedream-5.0'],
    'doubao-seedance-2-0': ['doubao-seedance-2.0', 'doubao-seedance-2-0-260128'],
    'doubao-seedance-2.0': ['doubao-seedance-2-0', 'doubao-seedance-2-0-260128'],
    'doubao-seedance-2-0-fast': ['doubao-seedance-2-0', 'doubao-seedance-2-0-260128'],
    'doubao-seedance-2.0-fast': ['doubao-seedance-2-0', 'doubao-seedance-2-0-260128'],
    'kling-3.0': ['kling-3.0-omni'],
    'kling-3.0-omni': ['kling-3.0'],
    'doubao-seedream-5.0-lite': ['doubao-seedream-5-0-lite'],
    'doubao-seedream-5-0-lite': ['doubao-seedream-5.0-lite'],
    'doubao-seedream-5.0-pro': ['doubao-seedream-5-0-pro'],
    'doubao-seedream-5-0-pro': ['doubao-seedream-5.0-pro', 'seedream-5-0-pro', 'seedream-5.0-pro'],
    'doubao-seedream-4.5': ['doubao-seedream-4-5'],
    'doubao-seedream-4-5': ['doubao-seedream-4.5'],
    'viduq3-pro': ['viduq3_pro'],
    'viduq3-pro-fast': ['viduq3_pro_fast'],
    'viduq3-turbo': ['viduq3_turbo'],
    'viduq3-mix': ['viduq3_mix'],
    'viduq2-pro': ['viduq2_pro'],
    'viduq2-pro-fast': ['viduq2_pro_fast'],
    'viduq2-turbo': ['viduq2_turbo'],
    };

  private constructor() {
    logger.info('统一API-模型服务初始化完成');
  }

  private normalizeProviderName(provider: string): APIProvider {
    return (this.providerNameAliases[provider] || provider) as APIProvider;
  }

  private normalizeMembershipLevel(level?: string | null): string {
    const normalizedLevel = (level || 'free').toLowerCase();
    return ['enterprise', 'pro', 'trial', 'basic', 'free'].includes(normalizedLevel) ? normalizedLevel : 'free';
  }

  private getCurrentMembershipLevel(): string {
    const membership = useMembershipStore.getState().membership;
    return this.normalizeMembershipLevel(membership?.membershipLevel);
  }

  private getModelIdCandidates(modelId: string): string[] {
    const candidates = new Set<string>([modelId]);
    const directAliases = this.modelIdAliases[modelId] || [];

    for (const alias of directAliases) {
      candidates.add(alias);
    }

    for (const [sourceId, aliases] of Object.entries(this.modelIdAliases)) {
      if (aliases.includes(modelId)) {
        candidates.add(sourceId);
      }
    }

    return Array.from(candidates);
  }

  private isModelAllowedByMembership(model: ModelInfo): boolean {
    // 用户自购并绑定个人 Key 的模型对所有会员等级开放；系统内置模型仍走会员白名单。
    if (model.isCustomModel === true) {
      return true;
    }

    const membershipLevel = this.getCurrentMembershipLevel();

    if (membershipLevel === 'enterprise') {
      return true;
    }

    if (membershipLevel === 'pro') {
      return model.type === 'image' || model.type === 'video' || model.type === 'both';
    }

    const allowList = this.membershipModelAllowList[membershipLevel];
    if (!allowList) {
      return true;
    }

    const candidateIds = new Set([
      ...this.getModelIdCandidates(model.id),
      ...(model.modelId ? this.getModelIdCandidates(model.modelId) : []),
    ]);

    return Array.from(candidateIds).some(candidateId => allowList.has(candidateId));
  }

  private isModelHidden(model: ModelInfo): boolean {
    const candidateIds = new Set([
      ...this.getModelIdCandidates(model.id),
      ...(model.modelId ? this.getModelIdCandidates(model.modelId) : []),
    ]);

    return Array.from(candidateIds).some(candidateId => this.hiddenModels.has(candidateId));
  }

  private getMembershipDefaultPriority(type: 'image' | 'video' | 'audio' | 'music' | 'text' | 'both'): string[] {
    if (type === 'audio') {
      return [];
    }

    const membershipLevel = this.getCurrentMembershipLevel();
    return this.membershipDefaultModelPriority[membershipLevel]?.[type] || [];
  }

  private getPriorityRank(modelId: string, type: 'image' | 'video' | 'audio' | 'music' | 'text' | 'both'): number {
    const priorityList = this.getMembershipDefaultPriority(type);
    if (priorityList.length === 0) {
      return Number.MAX_SAFE_INTEGER;
    }

    const candidates = this.getModelIdCandidates(modelId);
    for (const candidateId of candidates) {
      const index = priorityList.indexOf(candidateId);
      if (index !== -1) {
        return index;
      }
    }

    return Number.MAX_SAFE_INTEGER;
  }

  private sortModelsByMembershipPriority(
    models: UnifiedModelConfig[],
    type: 'image' | 'video' | 'audio' | 'music' | 'text' | 'both'
  ): UnifiedModelConfig[] {
    return [...models].sort((leftModel, rightModel) => {
      const leftCustom = leftModel.modelInfo?.isCustomModel ? 0 : 1;
      const rightCustom = rightModel.modelInfo?.isCustomModel ? 0 : 1;
      if (leftCustom !== rightCustom) return leftCustom - rightCustom;
      if (leftCustom === 0) {
        const leftCustomPriority = leftModel.modelInfo?.customSortPriority ?? 0;
        const rightCustomPriority = rightModel.modelInfo?.customSortPriority ?? 0;
        if (leftCustomPriority !== rightCustomPriority) return leftCustomPriority - rightCustomPriority;
      }
      const leftRank = this.getPriorityRank(leftModel.modelId, type);
      const rightRank = this.getPriorityRank(rightModel.modelId, type);

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return 0;
    });
  }

  private findFirstMatchingModel(
    models: UnifiedModelConfig[],
    preferredModelIds: string[]
  ): UnifiedModelConfig | null {
    for (const preferredModelId of preferredModelIds) {
      const matchedModel = models.find(model =>
        this.getModelIdCandidates(model.modelId).includes(preferredModelId)
      );

      if (matchedModel) {
        return matchedModel;
      }
    }

    return null;
  }

  public static getInstance(): UnifiedAPIModelService {
    if (!UnifiedAPIModelService.instance) {
      UnifiedAPIModelService.instance = new UnifiedAPIModelService();
    }
    return UnifiedAPIModelService.instance;
  }

  public getAllProvidersWithModels(): ProviderWithModels[] {
    const configStore = useUnifiedAPIConfigStore.getState();
    const allDecryptedConfigs = configStore.getAllConfigs();
    
    const result: ProviderWithModels[] = [];

    for (const providerInfo of DEFAULT_PROVIDER_CONFIGS) {
      const normalizedProvider = this.normalizeProviderName(providerInfo.id);
      const models = modelRegistry
        .getModelsByProvider(normalizedProvider)
        .filter((model) => !this.isModelHidden(model) && this.isModelAllowedByMembership(model));
      const authConfig = allDecryptedConfigs[normalizedProvider];
      const isConfigured = this.isProviderConfigured(providerInfo.id, authConfig);

      result.push({
        provider: providerInfo.id,
        providerInfo,
        models,
        isConfigured
      });
    }

    return result;
  }

  public getAvailableProvidersWithModels(): ProviderWithModels[] {
    return this.getAllProvidersWithModels().filter(p => p.isConfigured && p.models.length > 0);
  }

  public getModelsByType(type: 'image' | 'video' | 'audio' | 'music' | 'text' | 'both'): UnifiedModelConfig[] {
    const configStore = useUnifiedAPIConfigStore.getState();
    const allDecryptedConfigs = configStore.getAllConfigs();
    
    const models = modelRegistry.getModelsByType(type);
    const result: UnifiedModelConfig[] = [];

    for (const model of models) {
      if (this.isModelHidden(model)) {
        continue;
      }

      if (!this.isModelAllowedByMembership(model)) {
        continue;
      }

      const normalizedProvider = this.normalizeProviderName(model.provider);
      const providerConfig = allDecryptedConfigs[normalizedProvider];
      
      const isConfigured = this.isProviderConfigured(model.provider, providerConfig);

      result.push({
        // 优先使用 modelId（后端真实模型ID，如 'image-01'），避免使用 id（如 'minimax_image-01'）导致 provider 拒绝
        modelId: model.modelId || model.id,
        modelInfo: model,
        provider: model.provider,
        authConfig: isConfigured ? (providerConfig as APIAuthConfig) : null,
        isConfigured,
        isAvailable: isConfigured
      });
    }

    return this.sortModelsByMembershipPriority(result, type);
  }

  public getAvailableModelsByType(type: 'image' | 'video' | 'audio' | 'music' | 'text' | 'both'): UnifiedModelConfig[] {
    return this.getModelsByType(type).filter(m => m.isAvailable);
  }

  public getFixedDefaultModelByType(type: 'image' | 'video'): UnifiedModelConfig | null {
    const preferredModelIds = this.fixedDefaultModelIds[type];
    const availableModels = this.getAvailableModelsByType(type);
    const availableMatch = this.findFirstMatchingModel(availableModels, preferredModelIds);
    if (availableMatch) {
      return availableMatch;
    }

    return this.findFirstMatchingModel(this.getModelsByType(type), preferredModelIds);
  }

  public getModelConfig(modelId: string): UnifiedModelConfig | null {
    const configStore = useUnifiedAPIConfigStore.getState();
    const allDecryptedConfigs = configStore.getAllConfigs();
    
    // 应用模型ID别名映射
    const normalizedModelId =
      this.getModelIdCandidates(modelId).find(candidateId => modelRegistry.getModelById(candidateId)) || modelId;
    const modelInfo = modelRegistry.getModelById(normalizedModelId);

    if (!modelInfo) {
      logger.warn(`模型 ${modelId} (尝试过: ${normalizedModelId}) 未找到`);
      return null;
    }

    if (!this.isModelAllowedByMembership(modelInfo)) {
      logger.warn(`模型 ${modelId} 当前会员等级无权使用`);
      return null;
    }

    const normalizedProvider = this.normalizeProviderName(modelInfo.provider);
    const providerConfig = allDecryptedConfigs[normalizedProvider];
    
    const isConfigured = this.isProviderConfigured(modelInfo.provider, providerConfig);

    return {
      // 优先使用 modelId（后端真实模型ID），避免使用 id 导致 provider 拒绝
      modelId: modelInfo.modelId || modelInfo.id,
      modelInfo,
      provider: modelInfo.provider,
      authConfig: isConfigured ? (providerConfig as APIAuthConfig) : null,
      isConfigured,
      isAvailable: isConfigured
    };
  }

  public getModelsByProvider(provider: APIProvider): UnifiedModelConfig[] {
    const configStore = useUnifiedAPIConfigStore.getState();
    const allDecryptedConfigs = configStore.getAllConfigs();
    const normalizedProvider = this.normalizeProviderName(provider);
    const models = modelRegistry
      .getModelsByProvider(normalizedProvider)
      .filter((model) => this.isModelAllowedByMembership(model));
    const providerConfig = allDecryptedConfigs[normalizedProvider];
    
    const unifiedModels = models.map(model => {
      const isConfigured = this.isProviderConfigured(provider, providerConfig);
      
      return {
        // 优先使用 modelId（后端真实模型ID），避免使用 id 导致 provider 拒绝
        modelId: model.modelId || model.id,
        modelInfo: model,
        provider: model.provider,
        authConfig: isConfigured ? (providerConfig as APIAuthConfig) : null,
        isConfigured,
        isAvailable: isConfigured
      };
    });

    const providerType = unifiedModels[0]?.modelInfo.type;
    if (providerType === 'image' || providerType === 'video' || providerType === 'audio') {
      return this.sortModelsByMembershipPriority(unifiedModels, providerType);
    }

    return unifiedModels;
  }

  public getAvailableModelsByProvider(provider: APIProvider): UnifiedModelConfig[] {
    return this.getModelsByProvider(provider).filter(m => m.isAvailable);
  }

  /**
   * 获取与指定 provider 关联的所有 provider name（包括自身）。
   * 用于在 providerConfigs 中查找后端已配置的秘钥。
   */
  private getAffinityProviders(provider: string): string[] {
    const normalized = this.normalizeProviderName(provider);
    for (const group of this.providerAffinityGroups) {
      if (group.includes(normalized)) {
        return group;
      }
    }
    return [normalized];
  }

  private isProviderConfigured(provider: APIProvider, config?: APIAuthConfig | ProviderConfig): boolean {
    const normalizedProvider = this.normalizeProviderName(provider);
    const providerInfo = DEFAULT_PROVIDER_CONFIGS.find(p => p.id === normalizedProvider);
    const configStore = useUnifiedAPIConfigStore.getState();

    if (!providerInfo) {
      const backendConfig = configStore.providerConfigs[normalizedProvider];
      if (backendConfig?.isCustomModel !== true) {
        return false;
      }

      const cloudCredential = configStore.userCredentialConfigs[normalizedProvider];
      const isEnabled = (config as ProviderConfig | undefined)?.enabled !== false
        && cloudCredential?.enabled !== false;
      return isEnabled && cloudCredential?.hasCredentials === true;
    }

    // 检查后端是否已经配置了该提供商 (通过 providerConfigs)
    // 不仅检查 normalizedProvider，还检查关联组内的所有 provider
    const affinityProviders = this.getAffinityProviders(normalizedProvider);

    for (const affinityProvider of affinityProviders) {
      const backendConfig = configStore.providerConfigs[affinityProvider];
      if (backendConfig) {
        const authType = backendConfig.authType || providerInfo.authType;
        if (authType === 'ak-sk' || authType === 'aksk') {
          if (backendConfig.hasApiKey && backendConfig.hasApiSecret) {
            return true;
          }
        } else {
          if (backendConfig.hasApiKey) {
            return true;
          }
        }
      }
    }

    if (!config) {
      return false;
    }

    // APIAuthConfig 没有 enabled 字段，默认视为启用；ProviderConfig.enabled = false 才视为未启用
    const isEnabled = (config as ProviderConfig).enabled === undefined
      ? true
      : (config as ProviderConfig).enabled === true;
    if (!isEnabled) {
      return false;
    }

    const apiKey = typeof config.apiKey === 'string' ? config.apiKey : '';
    const accessKey = typeof config.accessKey === 'string' ? config.accessKey : '';
    const secretKey = typeof config.secretKey === 'string' ? config.secretKey : '';

    const isBackendManaged = apiKey.startsWith('backend-managed-');
    if (isBackendManaged) {
      return true;
    }

    const authType = providerInfo.authType;

    if (authType === 'bearer') {
      return apiKey.trim().length > 0;
    } else if (authType === 'aksk') {
      return accessKey.trim().length > 0 && secretKey.trim().length > 0;
    } else if (authType === 'custom') {
      return apiKey.trim().length > 0;
    }

    return false;
  }

  public isModelAvailable(modelId: string): boolean {
    const config = this.getModelConfig(modelId);
    return config?.isAvailable || false;
  }

  public getProviderInfo(provider: APIProvider) {
    return DEFAULT_PROVIDER_CONFIGS.find(p => p.id === provider);
  }

  public getPopularModelsByType(type: 'image' | 'video', limit: number = 5): UnifiedModelConfig[] {
    const allModels = this.getAvailableModelsByType(type);
    return allModels
      .filter(m => m.modelInfo.isPopular)
      .sort((a, b) => (b.modelInfo.qualityRating || 0) - (a.modelInfo.qualityRating || 0))
      .slice(0, limit);
  }

  public searchModels(query: string, type?: 'image' | 'video'): UnifiedModelConfig[] {
    let models: UnifiedModelConfig[];
    
    if (type) {
      models = this.getModelsByType(type);
    } else {
      const imageModels = this.getModelsByType('image');
      const videoModels = this.getModelsByType('video');
      models = [...imageModels, ...videoModels];
    }

    const lowerQuery = query.toLowerCase();
    return models.filter(m => 
      m.modelInfo.name.toLowerCase().includes(lowerQuery) ||
      m.modelInfo.description.toLowerCase().includes(lowerQuery) ||
      m.modelInfo.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  public getModelLabel(model: UnifiedModelConfig): string {
    const providerInfo = this.getProviderInfo(model.provider);
    return `${providerInfo?.name || model.provider} - ${model.modelInfo.name}`;
  }

  public getModelShortLabel(model: UnifiedModelConfig): string {
    return model.modelInfo.name;
  }
}

export const unifiedAPIModelService = UnifiedAPIModelService.getInstance();
export default UnifiedAPIModelService;

