/**
 * 统一API配置Store
 * 合并配置管理和状态管理
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SecureStorage } from '@/services/secure-storage';
import { APIProvider, APIAuthConfig, APIEnvironment, DEFAULT_PROVIDER_CONFIGS, DEFAULT_AUTH_CONFIG } from './types';
import { logger } from '@/lib/logger';
import { purgeBrowserApiSecrets, stripSensitiveApiConfigFields } from '@/services/api-config-security';

const STORAGE_KEY = 'unified-api-config-v3';

purgeBrowserApiSecrets();

const sanitizeConfigs = (configs: Record<APIProvider, APIAuthConfig>): Record<APIProvider, APIAuthConfig> =>
  stripSensitiveApiConfigFields(configs) as Record<APIProvider, APIAuthConfig>;

// ==================== 配置状态接口 ====================
export interface APIConfigState {
  configs?: Record<APIProvider, APIAuthConfig>;
  currentEnvironment: APIEnvironment;
  environmentBaseUrls: Record<APIProvider, Record<APIEnvironment, string>>;
  activeProvider: APIProvider | null;
  lastSynced: Date | null;
  
  // 配置操作
  setConfig: (provider: APIProvider, config: Partial<APIAuthConfig>) => void;
  setParameterConfig: (
    provider: APIProvider,
    params: Pick<APIAuthConfig, 'model' | 'version' | 'temperature' | 'maxTokens' | 'topP'>
  ) => void;
  getConfig: (provider: APIProvider) => APIAuthConfig | null;
  getRuntimeConfig: (provider: APIProvider) => APIAuthConfig | null;
  clearConfig: (provider: APIProvider) => void;
  clearAllConfigs: () => void;
  
  // 环境管理
  setEnvironment: (environment: APIEnvironment) => void;
  setEnvironmentBaseUrl: (provider: APIProvider, environment: APIEnvironment, baseUrl: string) => void;
  setActiveProvider: (provider: APIProvider | null) => void;
  
  // 同步
  syncFromNode: (nodeConfigs: Partial<Record<APIProvider, APIAuthConfig>>) => void;
  syncToNode: () => Partial<Record<APIProvider, APIAuthConfig>>;
  markSynced: () => void;
}

// ==================== 创建默认配置 ====================
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

// ==================== 数据迁移 ====================
const migrateFromLegacyStorage = (): Partial<APIConfigState> => {
  const initialState: Partial<APIConfigState> = {
    configs: createDefaultConfigs(),
    currentEnvironment: 'production',
    environmentBaseUrls: createDefaultEnvironmentUrls(),
    lastSynced: null
  };

  // 尝试从加密存储加载
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

  // 尝试从统一存储加载
  try {
    const unifiedData = localStorage.getItem('unified-api-config-storage');
    if (unifiedData) {
      const parsed = JSON.parse(unifiedData) as { state?: Partial<APIConfigState> };
      if (parsed.state) {
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

    // 尝试从旧存储加载
    const legacyData = localStorage.getItem('infinite-flow-api-config');
    if (legacyData) {
      const parsed = JSON.parse(legacyData) as { state?: { configs?: Partial<Record<APIProvider, APIAuthConfig>> } };
      if (parsed.state?.configs) {
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

// ==================== 创建Store ====================
export const UnifiedAPIConfigStore = create<APIConfigState>()(
  persist(
    (set, get) => {
      const initial = migrateFromLegacyStorage();
      return {
        configs: initial.configs || createDefaultConfigs(),
        currentEnvironment: initial.currentEnvironment || 'production',
        environmentBaseUrls: initial.environmentBaseUrls || createDefaultEnvironmentUrls(),
        activeProvider: initial.activeProvider || null,
        lastSynced: initial.lastSynced || null,
        
        // 设置配置
        setConfig: (provider, config): void =>
          void set((state) => ({
            configs: {
              ...state.configs,
              [provider]: stripSensitiveApiConfigFields({ ...state.configs[provider], ...config })
            }
          })),
        
        // 设置参数配置
        setParameterConfig: (provider, params): void =>
          void set((state) => ({
            configs: {
              ...state.configs,
              [provider]: stripSensitiveApiConfigFields({ ...state.configs[provider], ...params })
            }
          })),
        
        // 获取配置
        getConfig: (provider) => get().configs[provider] || null,
        
        // 获取运行时配置（支持环境切换）
        getRuntimeConfig: (provider) => {
          const state = get();
          const config = state.configs[provider];
          if (!config) return null;
          
          const environmentBaseUrl = state.environmentBaseUrls[provider]?.[state.currentEnvironment];
          if (environmentBaseUrl && environmentBaseUrl !== config.baseUrl) {
            return stripSensitiveApiConfigFields({ ...config, baseUrl: environmentBaseUrl });
          }
          
          return stripSensitiveApiConfigFields(config);
        },
        
        // 清除配置
        clearConfig: (provider): void =>
          void set((state) => ({
            configs: {
              ...state.configs,
              [provider]: { ...DEFAULT_AUTH_CONFIG }
            }
          })),
        
        // 清除所有配置
        clearAllConfigs: (): void =>
          void set({
            configs: createDefaultConfigs()
          }),
        
        // 设置环境
        setEnvironment: (environment): void => void set({ currentEnvironment: environment }),
        
        // 设置环境URL
        setEnvironmentBaseUrl: (provider, environment, baseUrl): void =>
          void set((state) => ({
            environmentBaseUrls: {
              ...state.environmentBaseUrls,
              [provider]: {
                ...state.environmentBaseUrls[provider],
                [environment]: baseUrl
              }
            }
          })),
        
        // 设置活动提供商
        setActiveProvider: (provider): void => void set({ activeProvider: provider }),
        
        // 从节点同步
        syncFromNode: (nodeConfigs): void =>
          void set((state) => {
            const newConfigs = { ...state.configs };
            Object.entries(nodeConfigs).forEach(([provider, config]) => {
              if (newConfigs[provider as APIProvider]) {
                newConfigs[provider as APIProvider] = stripSensitiveApiConfigFields({
                  ...newConfigs[provider as APIProvider],
                  ...config
                });
              }
            });
            return { configs: newConfigs };
          }),
        
        // 同步到节点
        syncToNode: () => {
          const state = get();
          return sanitizeConfigs(state.configs || createDefaultConfigs());
        },
        
        // 标记已同步
        markSynced: (): void => void set({ lastSynced: new Date() })
      };
    },
    {
      name: STORAGE_KEY,
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          try {
            return JSON.parse(str);
          } catch {
            return str;
          }
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(stripSensitiveApiConfigFields(value)));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);

// ==================== Hook ====================
export const useUnifiedAPIConfig = () => UnifiedAPIConfigStore();
