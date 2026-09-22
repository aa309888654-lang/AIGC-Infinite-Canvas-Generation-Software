import { create } from 'zustand';
import {
  APIProvider,
  APIAuthConfig,
  DEFAULT_PROVIDER_CONFIGS,
  DEFAULT_AUTH_CONFIG
} from '@/types/api-controller';
import type { APIEnvironment } from '@/types/core';
import { logger } from '@/lib/logger';
import { SecureStorage } from '@/services/secure-storage';
import { aiProviderService } from '@/services/ai-provider-service';
import { purgeBrowserApiSecrets, stripSensitiveApiConfigFields } from '@/services/api-config-security';
import { userModelCredentialService, type UserModelCredentialMeta } from '@/services/user-model-credential-service';

/** Provider 配置（从 enhanced-api-config-store 迁移） */
export interface ProviderConfig {
  providerId: string;
  enabled: boolean;
  accessKey?: string;
  secretKey?: string;
  apiKey?: string;
  selectedModel?: string;
  customBaseUrl?: string;
  parameters: Record<string, unknown>;
  connectionStatus?: 'connected' | 'disconnected' | 'testing' | 'error';
  lastTested?: Date;
}

/** Provider 官方配置（从后端获取） */
export interface ProviderOfficialConfig {
  dbId?: string;
  hasApiKey?: boolean;
  hasApiSecret?: boolean;
  name: string;
  description: string;
  baseUrl: string;
  authType: string;
  models: Array<{
    id: string;
    name: string;
    description?: string;
    type?: 'image' | 'video' | 'audio' | 'both';
    providerModel?: string;
    capabilities?: string[];
    modelCategory?: 'generation' | 'edit' | 'action';
    requiredInputs?: string[];
    routeProvider?: string;
    configuredProvider?: string;
    disabledReason?: string;
    fallbackModelId?: string;
    fallbackProvider?: string;
    keyScope?: string;
    isActive?: boolean;
    maxResolution?: string;
    maxDuration?: number;
    supportedResolutions?: string[];
    supportedAspectRatios?: string[];
    supportedModes?: string[];
    defaultParams?: Record<string, unknown>;
  }>;
  features?: Record<string, boolean>;
  officialDocsUrl?: string;
  isCustomModel?: boolean;
  mediaType?: 'image' | 'video';
}

const STORAGE_KEY = 'api-config-v2';

// 历史版本曾把 Provider 密钥保存在浏览器；启动时仅保留模型和参数偏好。
purgeBrowserApiSecrets();

const sanitizeConfigs = (configs: Record<APIProvider, APIAuthConfig>): Record<APIProvider, APIAuthConfig> =>
  stripSensitiveApiConfigFields(configs) as Record<APIProvider, APIAuthConfig>;

const createDefaultConfigs = (): Record<APIProvider, APIAuthConfig> =>
  DEFAULT_PROVIDER_CONFIGS.reduce((acc, provider) => {
    acc[provider.id] = { ...DEFAULT_AUTH_CONFIG };
    return acc;
  }, {} as Record<APIProvider, APIAuthConfig>);

const createDefaultEnvironmentUrls = (): Record<APIProvider, Record<APIEnvironment, string>> =>
  DEFAULT_PROVIDER_CONFIGS.reduce((acc, provider) => {
    const defaultUrl = provider.authFields.find(field => field.key === 'baseUrl')?.placeholder || '';
    acc[provider.id] = {
      development: defaultUrl,
      staging: defaultUrl,
      production: defaultUrl
    };
    return acc;
  }, {} as Record<APIProvider, Record<APIEnvironment, string>>);

const migrateFromLegacyStorage = (): Partial<APIConfigState> => {
  const initialState: Partial<APIConfigState> = {
    configs: createDefaultConfigs(),
    currentEnvironment: 'production',
    environmentBaseUrls: createDefaultEnvironmentUrls()
  };

  // 尝试从SecureStorage加载配置
  const storedState = SecureStorage.getItemSync<Partial<APIConfigState>>(STORAGE_KEY);
  if (storedState && typeof storedState === 'object' && !Array.isArray(storedState)) {
    return {
      ...initialState,
      ...storedState,
      configs: sanitizeConfigs({
        ...(initialState.configs || createDefaultConfigs()),
        ...(storedState.configs || {}),
      }),
    };
  }

  try {
    // 尝试从统一API配置存储加载
    const unifiedData = localStorage.getItem('unified-api-config-storage');
    if (unifiedData) {
      const parsed = JSON.parse(unifiedData) as { state?: Partial<APIConfigState> };
      if (parsed && parsed.state) {
        return {
          ...initialState,
          ...parsed.state,
          configs: sanitizeConfigs({
            ...(initialState.configs || createDefaultConfigs()),
            ...(parsed.state.configs || {}),
          }),
        };
      }
    }

    // 尝试从旧格式加载
    const legacyData = localStorage.getItem('infinite-flow-api-config');
    if (legacyData) {
      const parsed = JSON.parse(legacyData) as { state?: { configs?: Partial<Record<APIProvider, APIAuthConfig>> } };
      if (parsed && parsed.state?.configs) {
        Object.entries(parsed.state.configs).forEach(([provider, config]) => {
          if (initialState.configs?.[provider as APIProvider]) {
            initialState.configs[provider as APIProvider] = {
              ...initialState.configs[provider as APIProvider],
              ...stripSensitiveApiConfigFields(config || {})
            };
          }
        });
      }
      return initialState;
    }
  } catch (error) {
    logger.warn('[API Config] 迁移数据时出错:', error);
  }

  return initialState;
};

export interface APIConfigState {
  configs: Record<APIProvider, APIAuthConfig>;
  currentEnvironment: APIEnvironment;
  environmentBaseUrls: Record<APIProvider, Record<APIEnvironment, string>>;
  activeProvider: APIProvider | null;
  lastSynced: Date | null;
  /** 从后端获取的 Provider 官方配置 */
  providerConfigs: Record<string, ProviderOfficialConfig>;
  isLoadingConfigs: boolean;
  configLoadError: string | null;
  userCredentialConfigs: Record<string, UserModelCredentialMeta>;
  userCredentialStorage: { usedBytes: number; limitBytes: number };
  fetchUserCredentialConfigs: () => Promise<void>;
  fetchProviderConfigs: (options?: { force?: boolean }) => Promise<void>;
  setConfig: (provider: APIProvider, config: Partial<APIAuthConfig>) => void;
  setParameterConfig: (
    provider: APIProvider,
    params: Pick<APIAuthConfig, 'model' | 'version' | 'temperature' | 'maxTokens' | 'topP'>
  ) => void;
  getConfig: (provider: APIProvider) => APIAuthConfig | null;
  getRuntimeConfig: (provider: APIProvider) => APIAuthConfig | null;
  clearConfig: (provider: APIProvider) => void;
  clearAllConfigs: () => void;
  setEnvironment: (environment: APIEnvironment) => void;
  setEnvironmentBaseUrl: (provider: APIProvider, environment: APIEnvironment, baseUrl: string) => void;
  setActiveProvider: (provider: APIProvider | null) => void;
  syncFromNode: (nodeConfigs: Partial<Record<APIProvider, APIAuthConfig>>) => void;
  syncToNode: () => Partial<Record<APIProvider, APIAuthConfig>>;
  markSynced: () => void;
  setAPIConfig: (provider: APIProvider, config: Partial<APIAuthConfig>) => void;
  getAPIConfig: (provider: APIProvider) => APIAuthConfig | null;
  clearAPIConfig: (provider: APIProvider) => void;
  clearAllAPIConfigs: () => void;
  hasValidConfig: (provider: APIProvider) => boolean;
  getAllConfiguredProviders: () => APIProvider[];
  getAllConfigs: () => Record<string, APIAuthConfig>;
  setProviderEnabled: (provider: string, enabled: boolean) => void;
  setAccessKey: (provider: string, accessKey: string) => void;
  setSecretKey: (provider: string, secretKey: string) => void;
  setAPIKey: (provider: string, apiKey: string) => void;
  setSelectedModel: (provider: string, model: string) => void;
  setCustomBaseUrl: (provider: string, baseUrl: string) => void;
  setConnectionStatus: (provider: string, status: ProviderConfig['connectionStatus']) => void;
  setLastTested: (provider: string, date: Date) => void;
}

const persistSecurely = (state: APIConfigState) => {
  SecureStorage.setItemSync(STORAGE_KEY, {
    configs: sanitizeConfigs(state.configs),
    currentEnvironment: state.currentEnvironment,
    environmentBaseUrls: state.environmentBaseUrls,
    activeProvider: state.activeProvider
  });
};

const initialState = migrateFromLegacyStorage();

const patchLegacyProviderConfig = (
  set: (partial: Partial<APIConfigState> | ((state: APIConfigState) => Partial<APIConfigState> | APIConfigState)) => void,
  provider: string,
  patch: Record<string, unknown>
) => {
  set((state) => {
    const providerKey = provider as APIProvider;
    const nextState = {
      ...state,
      configs: {
        ...state.configs,
          [providerKey]: stripSensitiveApiConfigFields({
            ...(state.configs[providerKey] || {}),
            ...patch,
          }),
      },
      lastSynced: null,
    };
    persistSecurely(nextState as APIConfigState);
    return nextState;
  });
};

// 用于去重 fetchProviderConfigs 请求
let providerConfigsFetchPromise: Promise<void> | null = null;
let lastProviderConfigsFetchedAt = 0;
const PROVIDER_CONFIG_FETCH_COOLDOWN_MS = 10_000;

export const useUnifiedAPIConfigStore = create<APIConfigState>()((set, get) => ({
  configs: initialState.configs || createDefaultConfigs(),
  currentEnvironment: initialState.currentEnvironment || 'production',
  environmentBaseUrls: initialState.environmentBaseUrls || createDefaultEnvironmentUrls(),
  activeProvider: initialState.activeProvider || null,
  lastSynced: null,
  providerConfigs: {},
  isLoadingConfigs: false,
  configLoadError: null,
  userCredentialConfigs: {},
  userCredentialStorage: { usedBytes: 0, limitBytes: 2 * 1024 * 1024 },

  fetchUserCredentialConfigs: async () => {
    try {
      const cloud = await userModelCredentialService.list();
      const byProvider = Object.fromEntries(cloud.entries.map((entry) => [entry.provider, entry]));
      set((state) => {
        const configs = { ...state.configs };
        const providerConfigs = { ...state.providerConfigs };
        for (const entry of cloud.entries) {
          const provider = entry.provider as APIProvider;
          configs[provider] = stripSensitiveApiConfigFields({
            ...(configs[provider] || DEFAULT_AUTH_CONFIG),
            enabled: entry.enabled !== false && entry.hasCredentials,
            model: entry.selectedModel || undefined,
            baseUrl: entry.baseUrl || undefined,
          });
          if (providerConfigs[entry.provider]) {
            providerConfigs[entry.provider] = {
              ...providerConfigs[entry.provider],
              hasApiKey: entry.enabled && entry.hasCredentials,
            };
          }
        }
        const nextState = { ...state, configs, providerConfigs };
        persistSecurely(nextState as APIConfigState);
        return {
          configs,
          providerConfigs,
          userCredentialConfigs: byProvider,
          userCredentialStorage: { usedBytes: cloud.usedBytes, limitBytes: cloud.limitBytes },
        };
      });
    } catch (error) {
      logger.warn('[API Config] 读取用户云端模型配置失败:', error);
    }
  },

  fetchProviderConfigs: async (options) => {
    const force = options?.force === true;
    const now = Date.now();
    if (!force && now - lastProviderConfigsFetchedAt < PROVIDER_CONFIG_FETCH_COOLDOWN_MS) return;
    if (providerConfigsFetchPromise) return providerConfigsFetchPromise;

    set({ isLoadingConfigs: true, configLoadError: null });
    providerConfigsFetchPromise = (async () => {
      try {
        const configs: Record<string, ProviderOfficialConfig> = {};

        // 从公共 API 获取活跃 provider 信息（后端已配置密钥的 provider 标记为可用）
        try {
          const publicResp = await aiProviderService.getPublicProviders();
          if (publicResp.success && publicResp.data) {
            for (const p of publicResp.data) {
              if (!p.available) continue;
              // 已有私有 API 数据的 provider 保留（数据更完整）
              if (configs[p.name]) continue;
              // 公共 API 数据：标记 hasApiKey = true（后端已配置）
              configs[p.name] = {
                dbId: '',
                hasApiKey: true,
                hasApiSecret: false,
                name: p.displayName || p.name,
                description: '',
                baseUrl: '',
                authType: 'api-key',
                models: (p.models || []).map(m => {
                  if (typeof m === 'string') {
                    return { id: m, name: m };
                  }
                  return {
                    id: m.id,
                    name: m.name,
                    description: m.description,
                    type: m.type,
                    providerModel: m.providerModel,
                    capabilities: m.capabilities,
                    modelCategory: m.modelCategory,
                    requiredInputs: m.requiredInputs,
                    routeProvider: m.routeProvider,
                    configuredProvider: m.configuredProvider,
                    disabledReason: m.disabledReason,
                    fallbackModelId: m.fallbackModelId,
                    fallbackProvider: m.fallbackProvider,
                    keyScope: m.keyScope,
                    isActive: m.isActive,
                    maxResolution: m.maxResolution,
                    maxDuration: m.maxDuration,
                    supportedAspectRatios: m.supportedAspectRatios,
                  };
                }),
              };
            }
          }
        } catch {
          // 公共 API 失败不影响主流程
        }

        set({ providerConfigs: configs, isLoadingConfigs: false, configLoadError: null });
        // 登录后自动恢复用户的模型选择与云端凭据状态。密钥本身不会回传浏览器。
        await get().fetchUserCredentialConfigs();
        lastProviderConfigsFetchedAt = Date.now();
      } catch (err) {
        logger.warn('[API Config] 获取Provider配置失败:', err);
        set({
          isLoadingConfigs: false,
          configLoadError: err instanceof Error ? err.message : '获取 Provider 配置失败',
        });
      } finally {
        providerConfigsFetchPromise = null;
      }
    })();
    return providerConfigsFetchPromise;
  },

  setConfig: (provider: APIProvider, config: Partial<APIAuthConfig>) => {
    set((state) => {
      const nextState = {
        ...state,
        configs: {
          ...state.configs,
          [provider]: stripSensitiveApiConfigFields({
            ...state.configs[provider],
            ...config
          })
        },
        lastSynced: null
      };
      persistSecurely(nextState);
      return nextState;
    });
    const rawConfig = config as Record<string, unknown>;
    const credentialInput = {
      enabled: true,
      selectedModel: typeof config.model === 'string' ? config.model : undefined,
      baseUrl: typeof config.baseUrl === 'string' ? config.baseUrl : undefined,
      apiKey: typeof config.apiKey === 'string' ? config.apiKey : undefined,
      apiSecret: typeof rawConfig.apiSecret === 'string' ? rawConfig.apiSecret : undefined,
      accessKey: typeof config.accessKey === 'string' ? config.accessKey : undefined,
      secretKey: typeof config.secretKey === 'string' ? config.secretKey : undefined,
    };
    if (Object.values(credentialInput).some((value) => typeof value === 'string' && value.length > 0)) {
      void userModelCredentialService.save(String(provider), credentialInput)
        .then(() => get().fetchUserCredentialConfigs())
        .catch((error) => logger.warn('[API Config] 保存用户云端模型配置失败:', error));
    }
    logger.info(`API配置已更新: ${provider}`);
  },

  setParameterConfig: (provider, params) => {
    get().setConfig(provider, params);
  },

  getConfig: (provider: APIProvider) => get().configs[provider] || null,

  getRuntimeConfig: (provider: APIProvider) => {
    const state = get();
    const config = state.configs[provider];
    if (!config) {
      return null;
    }
    const environmentUrl = state.environmentBaseUrls[provider]?.[state.currentEnvironment];
    return stripSensitiveApiConfigFields({
      ...config,
      environment: state.currentEnvironment,
      baseUrl: environmentUrl || config.baseUrl
    });
  },

  clearConfig: (provider: APIProvider) => {
    set((state) => {
      const nextState = {
        ...state,
        configs: {
          ...state.configs,
          [provider]: { ...DEFAULT_AUTH_CONFIG }
        },
        lastSynced: null
      };
      persistSecurely(nextState);
      return nextState;
    });
    void userModelCredentialService.remove(String(provider))
      .then(() => get().fetchUserCredentialConfigs())
      .catch((error) => logger.warn('[API Config] 删除用户云端模型配置失败:', error));
    logger.info(`API配置已清除: ${provider}`);
  },

  clearAllConfigs: () => {
    set((state) => {
      const nextState = {
        ...state,
        configs: createDefaultConfigs(),
        activeProvider: null,
        lastSynced: null
      };
      persistSecurely(nextState);
      return nextState;
    });
    logger.info('所有API配置已清除');
  },

  setEnvironment: (environment: APIEnvironment) => {
    set((state) => {
      const nextState = {
        ...state,
        currentEnvironment: environment
      };
      persistSecurely(nextState);
      return nextState;
    });
    logger.info(`API环境已切换: ${environment}`);
  },

  setEnvironmentBaseUrl: (provider, environment, baseUrl) => {
    set((state) => {
      const nextState = {
        ...state,
        environmentBaseUrls: {
          ...state.environmentBaseUrls,
          [provider]: {
            ...state.environmentBaseUrls[provider],
            [environment]: baseUrl
          }
        }
      };
      persistSecurely(nextState);
      return nextState;
    });
  },

  setActiveProvider: (provider: APIProvider | null) => {
    set((state) => {
      const nextState = {
        ...state,
        activeProvider: provider
      };
      persistSecurely(nextState);
      return nextState;
    });
    if (provider) {
      logger.info(`激活API提供商: ${provider}`);
    }
  },

  syncFromNode: (nodeConfigs: Partial<Record<APIProvider, APIAuthConfig>>) => {
    set((state) => {
      const newConfigs = { ...state.configs };
      Object.entries(nodeConfigs).forEach(([provider, config]) => {
        if (config) {
          newConfigs[provider as APIProvider] = stripSensitiveApiConfigFields({
            ...newConfigs[provider as APIProvider],
            ...config
          });
        }
      });
      const nextState = {
        ...state,
        configs: newConfigs,
        lastSynced: new Date()
      };
      persistSecurely(nextState);
      return nextState;
    });
    logger.info('已从节点同步API配置');
  },

  syncToNode: () => {
    const state = get();
    const nodeConfigs: Partial<Record<APIProvider, APIAuthConfig>> = {};
    DEFAULT_PROVIDER_CONFIGS.forEach(provider => {
      const config = state.configs[provider.id];
      const hasValue = provider.authFields.some(field => {
        const value = config[field.key as keyof APIAuthConfig];
        return typeof value === 'string' && value.length > 0;
      });
      if (hasValue) {
        nodeConfigs[provider.id] = stripSensitiveApiConfigFields(state.getRuntimeConfig(provider.id) || config);
      }
    });
    logger.info('已准备节点同步的API配置');
    return nodeConfigs;
  },

  markSynced: () => {
    set({ lastSynced: new Date() });
  },

  setAPIConfig: (provider, config) => get().setConfig(provider, config),
  getAPIConfig: (provider) => get().getConfig(provider),
  clearAPIConfig: (provider) => get().clearConfig(provider),
  clearAllAPIConfigs: () => get().clearAllConfigs(),
  hasValidConfig: (provider) => {
    return get().providerConfigs[provider]?.hasApiKey === true;
  },
  getAllConfiguredProviders: () => {
    return DEFAULT_PROVIDER_CONFIGS
      .filter(provider => get().providerConfigs[provider.id]?.hasApiKey === true)
      .map(provider => provider.id);
  },

  getAllConfigs: () => sanitizeConfigs(get().configs),

  setProviderEnabled: (provider, enabled) => {
    patchLegacyProviderConfig(set, provider, { enabled });
  },

  setAccessKey: (provider) => {
    logger.warn(`[API Config] 已忽略浏览器端 Access Key: ${provider}`);
  },

  setSecretKey: (provider) => {
    logger.warn(`[API Config] 已忽略浏览器端 Secret Key: ${provider}`);
  },

  setAPIKey: (provider) => {
    logger.warn(`[API Config] 已忽略浏览器端 API Key: ${provider}`);
  },

  setSelectedModel: (provider, model) => {
    patchLegacyProviderConfig(set, provider, { model, selectedModel: model });
  },

  setCustomBaseUrl: (provider, baseUrl) => {
    patchLegacyProviderConfig(set, provider, { baseUrl, customBaseUrl: baseUrl });
  },

  setConnectionStatus: (provider, connectionStatus) => {
    patchLegacyProviderConfig(set, provider, { connectionStatus });
  },

  setLastTested: (provider, lastTested) => {
    patchLegacyProviderConfig(set, provider, { lastTested });
  },
}));

export default useUnifiedAPIConfigStore;
