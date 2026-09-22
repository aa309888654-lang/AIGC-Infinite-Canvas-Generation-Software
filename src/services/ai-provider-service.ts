import { getAuthToken } from '@/lib/auth-check';
import { apiClient } from '@/lib/api-client';

export type ModelType = 'image' | 'video' | 'audio' | 'both';

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  version?: string;
  type?: ModelType;
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
  maxResolution?: string;
  maxDuration?: number;
  supportedResolutions?: string[];
  supportedAspectRatios?: string[];
  supportedModes?: string[];
  defaultParams?: Record<string, unknown>;
  isActive?: boolean;
  isCustomModel?: boolean;
  customSortPriority?: number;
  mediaType?: 'image' | 'video';
  compatibilityMode?: 'openai-image' | 'openai-video' | 'official-image' | 'official-video';
}

export interface AIProvider {
  id: string;
  provider: string;
  name: string;
  displayName: string;
  description?: string;
  apiKey?: string;
  apiSecret?: string;
  endpoint?: string;
  isActive: boolean;
  supportedModes: string[];
  models: Array<string | ModelInfo>;
  config?: {
    authType?: 'ak-sk' | 'api-key' | 'bearer';
    baseUrl?: string;
    features?: {
      imageGeneration: boolean;
      videoGeneration: boolean;
      textToImage: boolean;
      imageToImage: boolean;
      imageToVideo: boolean;
      textToVideo: boolean;
      omniVideo?: boolean;
      multiImageToVideo?: boolean;
    };
    officialDocsUrl?: string;
    [key: string]: unknown;
  };
  rateLimit?: number;
  hasApiKey?: boolean;
  hasApiSecret?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AIModel {
  id: string;
  modelId: string;
  name: string;
  description?: string;
  version?: string;
  type?: ModelType;
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
  maxResolution?: string;
  maxDuration?: number;
  supportedResolutions?: string[];
  supportedAspectRatios?: string[];
  supportedModes?: string[];
  defaultParams?: Record<string, unknown>;
  provider: string;
  providerDisplayName: string;
  endpoint?: string;
  authType?: string;
  isActive?: boolean;
  isCustomModel?: boolean;
  customSortPriority?: number;
  mediaType?: 'image' | 'video';
  compatibilityMode?: 'openai-image' | 'openai-video' | 'official-image' | 'official-video';
}

export interface ProviderListResponse {
  success: boolean;
  data: AIProvider[];
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface AvailableModelsResponse {
  success: boolean;
  data: {
    providers: Array<{
      id: string;
      name: string;
      displayName: string;
      supportedModes: string[];
      modelCount: number;
    }>;
    models: AIModel[];
  };
}

export interface AIProviderDashboard {
  generatedAt: string;
  health: {
    score: number;
    status: 'excellent' | 'good' | 'warning' | 'critical';
  };
  summary: {
    totalProviders: number;
    databaseProviders: number;
    envOnlyProviders: number;
    activeProviders: number;
    configuredProviders: number;
    activeProvidersWithoutKey: number;
    totalModels: number;
  };
  keys: {
    total: number;
    active: number;
    exhausted: number;
    disabled: number;
    quotaTotal: number;
    quotaUsed: number;
    quotaRemaining: number;
    quotaUsagePercent: number;
  };
  modeDistribution: Record<string, number>;
  providers: Array<{
    id: string;
    provider: string;
    displayName: string;
    isActive: boolean;
    endpoint?: string | null;
    hasMainKey: boolean;
    hasEnvKey: boolean;
    hasAnyKey: boolean;
    modelCount: number;
    supportedModes: string[];
    keyPool: {
      total: number;
      active: number;
      exhausted: number;
      disabled: number;
      highFailure: number;
      quotaTotal: number;
      quotaUsed: number;
      quotaRemaining: number;
      quotaUsagePercent: number;
      lastUsedAt: string | null;
    };
  }>;
  recommendations: Array<{
    severity: 'critical' | 'warning' | 'info';
    title: string;
    message: string;
    provider?: string;
  }>;
}

export interface CustomModelDiagnosticCheck {
  id: 'endpoint' | 'authentication' | 'modelList' | 'modelAccess' | 'generationProtocol';
  label: string;
  status: 'passed' | 'warning' | 'failed';
  message: string;
}

export interface CustomModelDiagnostic {
  online: boolean;
  provider: string;
  protocol: 'openai-image' | 'openai-video';
  resolvedModel?: string;
  generationEndpoint: string;
  supportedModes: string[];
  checks: CustomModelDiagnosticCheck[];
  message: string;
}

class AIProviderService {
  async createCustomModelProvider(data: {
    provider: string;
    name: string;
    displayName: string;
    description?: string;
    endpoint: string;
    isActive: boolean;
    supportedModes: string[];
    models: Array<string | ModelInfo>;
    config: unknown;
  }): Promise<{ success: boolean; data: AIProvider }> {
    return apiClient.post('/ai-providers/custom-models', data, { maxRetries: 0 });
  }

  async testCustomModelProvider(provider: string, apiKey: string): Promise<{ success: boolean; data: CustomModelDiagnostic }> {
    return apiClient.post(`/ai-providers/custom-models/${encodeURIComponent(provider)}/test`, { apiKey }, { maxRetries: 0 });
  }

  async deleteCustomModelProvider(provider: string): Promise<{ success: boolean; message: string }> {
    return apiClient.delete(`/ai-providers/custom-models/${encodeURIComponent(provider)}`, { maxRetries: 0 });
  }

  async getDashboard(): Promise<{ success: boolean; data: AIProviderDashboard }> {
    return apiClient.get<{ success: boolean; data: AIProviderDashboard }>('/ai-providers/dashboard');
  }

  async getProviders(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    isActive?: boolean;
  }): Promise<ProviderListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', String(params.page));
    if (params?.pageSize) queryParams.set('pageSize', String(params.pageSize));
    if (params?.search) queryParams.set('search', params.search);
    if (params?.isActive !== undefined) queryParams.set('isActive', String(params.isActive));

    try {
      return await apiClient.get<ProviderListResponse>(`/ai-providers?${queryParams.toString()}`);
    } catch {
      return {
        success: true,
        data: [],
        meta: {
          page: params?.page || 1,
          pageSize: params?.pageSize || 20,
          total: 0,
          totalPages: 0,
        },
      };
    }
  }

  async getActiveProviders(): Promise<{ success: boolean; data: AIProvider[] }> {
    return apiClient.get<{ success: boolean; data: AIProvider[] }>('/ai-providers/active');
  }

  async getAvailableModels(): Promise<AvailableModelsResponse> {
    const token = getAuthToken();
    if (!token) {
      return {
        success: true,
        data: {
          providers: [],
          models: [],
        },
      };
    }

    try {
      return await apiClient.get<AvailableModelsResponse>('/ai-providers/available-models');
    } catch {
      return {
        success: true,
        data: {
          providers: [],
          models: [],
        },
      };
    }
  }

  async getProvider(id: string): Promise<{ success: boolean; data: AIProvider }> {
    return apiClient.get<{ success: boolean; data: AIProvider }>(`/ai-providers/${id}`);
  }

  async createProvider(data: {
    provider: string;
    name: string;
    displayName: string;
    description?: string;
    apiKey?: string;
    apiSecret?: string;
    endpoint?: string;
    isActive?: boolean;
    supportedModes?: string[];
    models?: Array<string | ModelInfo>;
    config?: unknown;
    rateLimit?: number;
  }): Promise<{ success: boolean; data: AIProvider }> {
    return apiClient.post<{ success: boolean; data: AIProvider }>('/ai-providers', data);
  }

  async updateProvider(
    id: string,
    data: Partial<{
      name: string;
      displayName: string;
      description: string;
      apiKey: string;
      apiSecret: string;
      endpoint: string;
      isActive: boolean;
      supportedModes: string[];
      models: Array<string | ModelInfo>;
      config: unknown;
      rateLimit: number;
    }>
  ): Promise<{ success: boolean; data: AIProvider }> {
    return apiClient.put<{ success: boolean; data: AIProvider }>(`/ai-providers/${id}`, data);
  }

  async deleteProvider(id: string): Promise<{ success: boolean; message: string }> {
    return apiClient.delete<{ success: boolean; message: string }>(`/ai-providers/${id}`);
  }

  async toggleProvider(id: string): Promise<{ success: boolean; data: AIProvider; message: string }> {
    return apiClient.patch<{ success: boolean; data: AIProvider; message: string }>(
      `/ai-providers/${id}/toggle`
    );
  }

  /**
   * 切换单个模型的启用/禁用状态
   * 后端会在 ProviderConfig.config.models JSON 中为该模型设置 isActive 字段。
   */
  async toggleModel(
    providerId: string,
    modelId: string
  ): Promise<{
    success: boolean;
    data: {
      providerId: string;
      providerName: string;
      models: Array<{ id: string; name: string; isActive: boolean }>;
    };
    message: string;
  }> {
    return apiClient.patch(
      `/ai-providers/${providerId}/models/${encodeURIComponent(modelId)}/toggle`,
      {}
    );
  }

  async getProviderModels(providerId: string): Promise<{ success: boolean; data: AIModel[] }> {
    return apiClient.get<{ success: boolean; data: AIModel[] }>(
      `/ai-providers/${providerId}/models`
    );
  }

  async getProviderStatus(providerId: string): Promise<{
    success: boolean;
    data: {
      online: boolean;
      latency?: number;
      error?: string;
      provider: string;
      displayName?: string;
      isActive?: boolean;
    };
  }> {
    return apiClient.get(`/ai-providers/${providerId}/status`);
  }

  async updateCredentials(
    id: string,
    credentials: { apiKey?: string; apiSecret?: string }
  ): Promise<{ success: boolean; data: { id: string; provider: string; hasApiKey: boolean; hasApiSecret: boolean }; message: string }> {
    return apiClient.patch<{
      success: boolean;
      data: { id: string; provider: string; hasApiKey: boolean; hasApiSecret: boolean };
      message: string;
    }>(`/ai-providers/${id}/credentials`, credentials);
  }

  async getExportFrontendConfig(): Promise<{
    success: boolean;
    data: Record<string, {
      providerId: string;
      displayName: string;
      enabled: boolean;
      hasApiKey: boolean;
      hasApiSecret: boolean;
      maskedApiKey: string | null;
      maskedApiSecret: string | null;
      endpoint: string | null;
      authType: string;
      modelCount: number;
    }>;
    message: string;
  }> {
    return apiClient.get<{
      success: boolean;
      data: Record<string, {
        providerId: string;
        displayName: string;
        enabled: boolean;
        hasApiKey: boolean;
        hasApiSecret: boolean;
        maskedApiKey: string | null;
        maskedApiSecret: string | null;
        endpoint: string | null;
        authType: string;
        modelCount: number;
      }>;
      message: string;
    }>('/ai-providers/export-frontend-config');
  }

  async getProviderKeys(providerId: string): Promise<{
    success: boolean;
    data: {
      keys: ProviderKeyInfo[];
      stats: ProviderKeyStats;
    };
  }> {
    return apiClient.get(`/ai-providers/${providerId}/keys`);
  }

  async addProviderKey(providerId: string, data: {
    keyLabel: string;
    apiKey: string;
    modelScope?: string | null;
    weight?: number;
    maxConcurrency?: number;
    quotaTotal?: number;
    priority?: number;
  }): Promise<{ success: boolean; data: ProviderKeyInfo }> {
    return apiClient.post(`/ai-providers/${providerId}/keys`, data);
  }

  async updateProviderKey(providerId: string, keyId: string, data: {
    keyLabel?: string;
    apiKey?: string;
    modelScope?: string | null;
    weight?: number;
    maxConcurrency?: number;
    quotaTotal?: number;
    quotaUsed?: number;
    isActive?: boolean;
    priority?: number;
  }): Promise<{ success: boolean; data: ProviderKeyInfo }> {
    return apiClient.put(`/ai-providers/${providerId}/keys/${keyId}`, data);
  }

  async deleteProviderKey(providerId: string, keyId: string): Promise<{ success: boolean; message: string }> {
    return apiClient.delete(`/ai-providers/${providerId}/keys/${keyId}`);
  }

  async resetProviderKeyQuota(providerId: string, keyId: string, quotaTotal?: number): Promise<{ success: boolean; data: ProviderKeyInfo }> {
    return apiClient.post(`/ai-providers/${providerId}/keys/${keyId}/reset`, { quotaTotal });
  }

  async reorderProviderKeys(providerId: string, keyIds: string[]): Promise<{
    success: boolean;
    data: { keys: ProviderKeyInfo[] };
  }> {
    return apiClient.patch(`/ai-providers/${providerId}/keys/reorder`, { keyIds });
  }

  async moveProviderKey(providerId: string, keyId: string, direction: 'up' | 'down'): Promise<{
    success: boolean;
    data: { keys: ProviderKeyInfo[] };
  }> {
    return apiClient.patch(`/ai-providers/${providerId}/keys/${keyId}/move`, { direction });
  }

  async batchImportKeys(
    providerId: string,
    keys: string[],
    quotaPerKey?: number,
    defaults?: {
      modelScope?: string | null;
      weight?: number;
      maxConcurrency?: number;
    }
  ): Promise<{
    success: boolean;
    data: { imported: number; skipped: number; errors: string[] };
  }> {
    return apiClient.post(`/ai-providers/${providerId}/keys/batch-import`, {
      keys,
      quotaPerKey,
      ...defaults,
    });
  }

  /** 获取公共 provider 列表（无需认证），返回后端已配置的活跃 provider */
  async getPublicProviders(): Promise<{
    success: boolean;
    data: Array<{
      name: string;
      displayName: string;
      available: boolean;
      models: Array<string | {
        id: string;
        name: string;
        description?: string;
        type?: ModelType;
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
        supportedAspectRatios?: string[];
        supportedModes?: string[];
      }>;
    }>;
  }> {
    try {
      return await apiClient.get('/public/ai-providers', { auth: true, maxRetries: 0 });
    } catch {
      return { success: false, data: [] };
    }
  }
}

export interface ProviderKeyInfo {
  id: string;
  providerName: string;
  keyLabel: string;
  maskedKey: string;
  modelScope: string | null;
  weight: number;
  maxConcurrency: number;
  quotaTotal: number;
  quotaUsed: number;
  quotaRemaining: number;
  isActive: boolean;
  isExhausted: boolean;
  failureCount: number;
  lastFailureAt: string | null;
  disabledAt: string | null;
  priority: number;
  lastUsedAt: string | null;
  exhaustedAt: string | null;
  createdAt: string;
}

export interface ProviderKeyStats {
  totalKeys: number;
  activeKeys: number;
  exhaustedKeys: number;
  disabledKeys: number;
  totalQuota: number;
  usedQuota: number;
  remainingQuota: number;
}

export const aiProviderService = new AIProviderService();
