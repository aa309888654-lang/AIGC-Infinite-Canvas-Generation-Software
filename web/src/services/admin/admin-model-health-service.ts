import { apiClient } from '@/lib/api-client';

export interface HealthSummary {
  total: number;
  healthy: number;
  invalid_key: number;
  insufficient_balance: number;
  timeout: number;
  unreachable: number;
  rate_limited: number;
  error: number;
  no_key: number;
  unknown: number;
  avgLatency: number;
}

export interface ApiKeyInfo {
  env: string;
  configured: boolean;
  preview: string;
}

// 模型项（含 isActive 状态，可用于在 UI 上显示启用/关闭按钮）
export interface HealthModelInfo {
  id: string;
  name: string;
  isActive: boolean;
}

export interface ProviderHealth {
  provider: string;
  providerId: string;
  displayName: string;
  type: string;
  status: string;
  latency: number;
  httpStatus?: number;
  message: string;
  models: HealthModelInfo[];
  modelCount: number;
  endpoint: string;
  apiKeys: ApiKeyInfo[];
}

export interface TextModelHealth {
  model: string;
  displayName: string;
  category: string;
  provider: string;
  type: string;
  status: string;
  latency: number;
  message: string;
  apiKeys: ApiKeyInfo[];
}

export interface HealthResponse {
  summary: HealthSummary;
  providers: ProviderHealth[];
  textModels: TextModelHealth[];
}

class AdminModelHealthService {
  check(): Promise<{ success: boolean; data: HealthResponse; error?: string }> {
    return apiClient.get('/admin/model-health/check', { timeout: 30000, maxRetries: 0 });
  }

  updateKey(envVar: string, apiKey: string): Promise<{ success: boolean; message?: string }> {
    return apiClient.post('/admin/model-health/update-key', { envVar, apiKey }, { maxRetries: 0 });
  }

  // 更新 Provider endpoint 地址（同步到数据库 ProviderConfig.endpoint）
  updateEndpoint(
    providerId: string,
    endpoint: string
  ): Promise<{
    success: boolean;
    message?: string;
    data?: { providerId: string; provider: string; displayName: string; endpoint: string };
  }> {
    return apiClient.post('/admin/model-health/update-endpoint', { providerId, endpoint }, { maxRetries: 0 });
  }
}

export const adminModelHealthService = new AdminModelHealthService();
