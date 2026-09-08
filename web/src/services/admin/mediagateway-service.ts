import { apiClient } from '@/lib/api-client';

export interface ViduKeyStatus {
  key_idx: number;
  failure_count: number;
  is_active: boolean;
  masked_key?: string;
  label?: string;
  last_used_at?: string;
  last_failure_at?: string;
}

export interface GatewayStatus {
  vidu: ViduKeyStatus[];
  doubao: {
    has_key: boolean;
  };
}

export interface GatewayHealth {
  status: 'healthy' | 'degraded' | 'offline' | 'disabled';
  uptime: number;
  version: string;
  viduKeys: number;
  viduActive: number;
  doubaoConfigured: boolean;
  timestamp: string;
}

export interface GatewayStats {
  totalKeys: number;
  activeKeys: number;
  totalRequests: number;
  successRate: number;
  avgResponseTime: number;
  totalFailures: number;
  viduKeys: number;
  viduActive: number;
  doubaoKey: boolean;
  failureThreshold: number;
  recoveryCooldown: number;
}

export interface GatewayEnabledState {
  enabled: boolean;
}

export interface BatchAddResult {
  successCount: number;
  failCount: number;
  errors: string[];
}

export interface MGLogEntry {
  time: string;
  action: string;
  detail: string;
  userId?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export const mediagatewayService = {
  async getEnabled(): Promise<boolean> {
    const res = await apiClient.get<ApiResponse<GatewayEnabledState>>('/admin/mediagateway/enabled');
    return res.data?.enabled ?? false;
  },

  async toggle(enabled: boolean): Promise<boolean> {
    const res = await apiClient.post<ApiResponse<GatewayEnabledState>>('/admin/mediagateway/toggle', { enabled });
    return res.data?.enabled ?? false;
  },

  async getHealth(): Promise<GatewayHealth> {
    const res = await apiClient.get<ApiResponse<GatewayHealth>>('/admin/mediagateway/health');
    return res.data;
  },

  async getStats(): Promise<GatewayStats> {
    const res = await apiClient.get<ApiResponse<GatewayStats>>('/admin/mediagateway/stats');
    return res.data;
  },

  async getStatus(): Promise<GatewayStatus> {
    const res = await apiClient.get<ApiResponse<GatewayStatus>>('/admin/mediagateway/status');
    return res.data;
  },

  async resetFailures(provider: string): Promise<void> {
    await apiClient.post('/admin/mediagateway/reset-failures', { provider });
  },

  async addKey(key: string): Promise<void> {
    await apiClient.post('/admin/mediagateway/add-key', { key });
  },

  async batchAddKeys(keys: string[]): Promise<BatchAddResult> {
    const res = await apiClient.post<ApiResponse<BatchAddResult>>('/admin/mediagateway/batch-add-keys', { keys });
    return res.data;
  },

  async deleteKey(idx: number): Promise<void> {
    await apiClient.post('/admin/mediagateway/delete-key', { idx });
  },

  async setDoubaoKey(key: string): Promise<{ has_key: boolean }> {
    const res = await apiClient.post<ApiResponse<{ has_key: boolean }>>('/admin/mediagateway/doubao/set-key', { key });
    return res.data;
  },

  async deleteDoubaoKey(): Promise<{ has_key: boolean }> {
    const res = await apiClient.post<ApiResponse<{ has_key: boolean }>>('/admin/mediagateway/doubao/delete-key');
    return res.data;
  },

  async getLogs(limit: number = 50): Promise<MGLogEntry[]> {
    const res = await apiClient.get<ApiResponse<MGLogEntry[]>>(`/admin/mediagateway/logs?limit=${limit}`);
    return res.data;
  },
};
