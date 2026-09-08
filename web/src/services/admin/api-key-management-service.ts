import { apiClient } from '@/lib/api-client';

export interface UserApiKey {
  id: string;
  userId: string;
  keyName: string;
  apiKey: string;
  apiSecret?: string;
  provider?: string;
  models?: string[];
  permissions?: string[];
  isActive: boolean;
  isPrimary: boolean;
  rateLimit: number;
  rateLimitWindow: string;
  expiresAt?: string;
  lastUsedAt?: string;
  totalCalls: number;
  totalCost: number;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    username: string;
    email: string;
    points?: number;
  };
}

export interface ApiKeyStats {
  totalCalls: number;
  totalCost: number;
  totalPointsCost: number;
  providerStats: Array<{
    provider: string;
    calls: number;
    cost: number;
  }>;
  dailyStats: Array<{
    date: string;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    cost: number;
  }>;
}

export interface ApiCallLog {
  id: string;
  userApiKeyId: string;
  userId: string;
  provider: string;
  model?: string;
  endpoint: string;
  method: string;
  inputTokens?: number;
  outputTokens?: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  pointsCost: number;
  latencyMs?: number;
  statusCode?: number;
  requestId?: string;
  errorMessage?: string;
  ipAddress?: string;
  createdAt: string;
}

export const apiKeyManagementService = {
  async getApiKeys(params?: {
    page?: number;
    pageSize?: number;
    userId?: string;
    provider?: string;
    isActive?: boolean;
    search?: string;
  }): Promise<{
    data: UserApiKey[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const queryString = new URLSearchParams(params as Record<string, string>).toString();
    return apiClient.get(`/user-api-keys${queryString ? `?${queryString}` : ''}`);
  },

  async createApiKey(data: {
    userId: string;
    keyName: string;
    provider?: string;
    models?: string[];
    permissions?: string[];
    isPrimary?: boolean;
    rateLimit?: number;
    rateLimitWindow?: 'second' | 'minute' | 'hour' | 'day';
    expiresAt?: string;
  }): Promise<{ success: boolean; data: UserApiKey }> {
    return apiClient.post('/user-api-keys', data);
  },

  async updateApiKey(id: string, data: Partial<UserApiKey>): Promise<{ success: boolean; data: UserApiKey }> {
    return apiClient.put(`/user-api-keys/${id}`, data);
  },

  async deleteApiKey(id: string): Promise<{ success: boolean }> {
    return apiClient.delete(`/user-api-keys/${id}`);
  },

  async toggleApiKey(id: string): Promise<{ success: boolean; data: UserApiKey }> {
    return apiClient.patch(`/user-api-keys/${id}/toggle`);
  },

  async getApiKeyStats(id: string, days?: number): Promise<{
    success: boolean;
    data: { key: UserApiKey; stats: ApiKeyStats };
  }> {
    return apiClient.get(days ? `/user-api-keys/${id}/stats?days=${days}` : `/user-api-keys/${id}/stats`);
  },

  async getApiKeyLogs(id: string, params?: {
    page?: number;
    pageSize?: number;
    provider?: string;
    statusCode?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    data: ApiCallLog[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const queryString = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiClient.get(`/user-api-keys/${id}/logs${queryString}`);
  },

  async rotateApiKey(id: string): Promise<{ success: boolean; data: { apiKey: string; apiSecret: string } }> {
    return apiClient.post(`/user-api-keys/${id}/rotate`);
  },
};
