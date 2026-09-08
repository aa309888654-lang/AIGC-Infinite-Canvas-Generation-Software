import { apiClient } from '@/lib/api-client';

export type AppSectionArea = 'home' | 'workspace' | 'canvas' | 'membership' | 'admin' | 'navigation';
export type AppModelType = 'image' | 'video' | 'audio' | 'text' | 'music' | 'both';
export type PricingTaskType = 'image' | 'video' | 'text' | 'audio' | 'music';

export interface AppSectionConfig {
  id: string;
  name: string;
  area: AppSectionArea;
  route?: string;
  description?: string;
  enabled: boolean;
  order: number;
  requiredRole?: 'guest' | 'user' | 'admin';
  featureFlag?: string;
}

export interface ModelParameterField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'boolean' | 'image' | 'file' | 'slider';
  required?: boolean;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string | number | boolean }>;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  helpText?: string;
}

export interface ModelParameterSchema {
  version: string;
  fields: ModelParameterField[];
}

export interface PricingRule {
  id: string;
  taskType: PricingTaskType;
  provider: string | null;
  model: string;
  pointsCost: number;
  isActive: boolean;
  effectiveAt: string;
  note?: string;
}

export interface AppModelConfig {
  id: string;
  modelId: string;
  providerModel: string;
  provider: string;
  configuredProvider: string;
  routeProvider: string;
  providerDisplayName: string;
  name: string;
  description?: string;
  type?: AppModelType;
  capabilities: string[];
  supportedModes: string[];
  supportedAspectRatios?: string[];
  supportedDurations?: number[];
  requiredInputs: string[];
  modelCategory?: 'generation' | 'edit' | 'action';
  maxResolution?: string;
  maxDuration?: number;
  defaultParams?: Record<string, unknown>;
  parameterSchema: ModelParameterSchema;
  pricing?: PricingRule | null;
  isActive: boolean;
  disabledReason?: string;
  fallbackProvider?: string;
  fallbackModelId?: string;
  keyScope?: string;
}

export interface RechargePackageConfig {
  id: string;
  name: string;
  points: number;
  price: number;
  originalPrice?: number;
  description?: string;
  bonusPoints?: number;
  isPopular?: boolean;
  isActive: boolean;
}

export interface AppBootstrapConfig {
  configVersion: string;
  generatedAt: string;
  sections: AppSectionConfig[];
  featureFlags: Record<string, boolean>;
  providers: Array<{
    id: string;
    name: string;
    displayName: string;
    supportedModes: string[];
    modelCount: number;
    activeModelCount: number;
  }>;
  models: AppModelConfig[];
  pointsPolicy: Record<string, number>;
  pointsDefinitions: Array<{
    key: string;
    label: string;
    description: string;
    defaultValue: number;
    group: string;
    type: string;
    min: number;
  }>;
  pointsDefaults: Record<string, number>;
  inviteRewardPolicy: {
    registrationReward: number;
    rechargeReward: number;
    rechargeThreshold: number;
    expiryDays: number;
  };
  rechargePackages: RechargePackageConfig[];
  pricingRules: PricingRule[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export const appConfigService = {
  async getBootstrap(): Promise<ApiResponse<AppBootstrapConfig>> {
    return apiClient.get<ApiResponse<AppBootstrapConfig>>('/app-config/bootstrap', { auth: true, maxRetries: 0 });
  },

  async getAvailableModels(): Promise<ApiResponse<{
    providers: AppBootstrapConfig['providers'];
    models: AppModelConfig[];
    pricingRules: PricingRule[];
  }>> {
    return apiClient.get('/app-config/models/available', { auth: true, maxRetries: 0 });
  },
};

export const adminAppConfigService = {
  async getBootstrap(): Promise<ApiResponse<AppBootstrapConfig>> {
    return apiClient.get<ApiResponse<AppBootstrapConfig>>('/admin/app-config/bootstrap', { maxRetries: 0 });
  },

  async getModels(): Promise<ApiResponse<{
    providers: AppBootstrapConfig['providers'];
    models: AppModelConfig[];
    pricingRules: PricingRule[];
  }>> {
    return apiClient.get('/admin/app-config/models', { maxRetries: 0 });
  },

  async createModel(payload: Partial<AppModelConfig> & { provider: string; modelId: string }): Promise<ApiResponse<AppModelConfig>> {
    return apiClient.post('/admin/app-config/models', payload, { maxRetries: 0 });
  },

  async updateModel(provider: string, modelId: string, payload: Partial<AppModelConfig>): Promise<ApiResponse<AppModelConfig>> {
    return apiClient.put(
      `/admin/app-config/models/${encodeURIComponent(provider)}/${encodeURIComponent(modelId)}`,
      payload,
      { maxRetries: 0 }
    );
  },

  async setModelStatus(provider: string, modelId: string, isActive: boolean, disabledReason?: string): Promise<ApiResponse<AppModelConfig>> {
    return apiClient.patch(
      `/admin/app-config/models/${encodeURIComponent(provider)}/${encodeURIComponent(modelId)}/status`,
      { isActive, disabledReason },
      { maxRetries: 0 }
    );
  },

  async archiveModel(provider: string, modelId: string): Promise<ApiResponse<AppModelConfig>> {
    return apiClient.delete(`/admin/app-config/models/${encodeURIComponent(provider)}/${encodeURIComponent(modelId)}`, { maxRetries: 0 });
  },

  async updateModelParameters(provider: string, modelId: string, schema: ModelParameterSchema): Promise<ApiResponse<ModelParameterSchema>> {
    return apiClient.put(
      `/admin/app-config/models/${encodeURIComponent(provider)}/${encodeURIComponent(modelId)}/parameters`,
      schema,
      { maxRetries: 0 }
    );
  },

  async updateModelPricing(provider: string, modelId: string, payload: {
    taskType: PricingTaskType;
    pointsCost: number;
    isActive?: boolean;
    note?: string;
  }): Promise<ApiResponse<PricingRule>> {
    return apiClient.put(
      `/admin/app-config/models/${encodeURIComponent(provider)}/${encodeURIComponent(modelId)}/pricing`,
      payload,
      { maxRetries: 0 }
    );
  },

  async saveSections(sections: AppSectionConfig[]): Promise<ApiResponse<AppSectionConfig[]>> {
    return apiClient.put('/admin/app-config/sections', { sections }, { maxRetries: 0 });
  },

  async saveFeatureFlags(flags: Record<string, boolean>): Promise<ApiResponse<Record<string, boolean>>> {
    return apiClient.put('/admin/app-config/feature-flags', { flags }, { maxRetries: 0 });
  },

  async savePointsPolicy(config: Record<string, number>): Promise<ApiResponse<Record<string, number>>> {
    return apiClient.put('/admin/app-config/points-policy', { config }, { maxRetries: 0 });
  },

  async saveInvitePolicy(config: Record<string, number>): Promise<ApiResponse<Record<string, number>>> {
    return apiClient.put('/admin/app-config/invite-policy', { config }, { maxRetries: 0 });
  },

  async saveRechargePackages(packages: RechargePackageConfig[]): Promise<ApiResponse<RechargePackageConfig[]>> {
    return apiClient.put('/admin/app-config/recharge-packages', { packages }, { maxRetries: 0 });
  },

  async resetRechargePackages(): Promise<ApiResponse<RechargePackageConfig[]>> {
    return apiClient.post('/admin/app-config/recharge-packages/reset', undefined, { maxRetries: 0 });
  },

  async publish(): Promise<ApiResponse<{ version: string; snapshotCount: number }>> {
    return apiClient.post('/admin/app-config/publish', undefined, { maxRetries: 0 });
  },
};
