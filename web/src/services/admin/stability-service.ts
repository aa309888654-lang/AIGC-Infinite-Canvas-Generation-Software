import { apiClient } from '@/lib/api-client';

export interface HealthCheck {
  status: string;
  uptime: number;
  checks: {
    database: boolean;
    redis?: boolean;
    minio?: boolean;
    loki?: boolean;
  };
  timestamp: string;
}

export interface StabilityStats {
  uptime: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
  cpuUsage: number;
  requestCount: number;
  errorRate: number;
  avgResponseTime: number;
}

interface HealthCheckResponse extends HealthCheck {}

interface StabilityStatsResponse {
  success: boolean;
  data: StabilityStats;
}

export const stabilityService = {
  async getHealthCheck(): Promise<HealthCheckResponse> {
    const res = await apiClient.get<HealthCheckResponse>('/admin/stability/health');
    return res;
  },

  async getStabilityStats(): Promise<StabilityStatsResponse> {
    const res = await apiClient.get<StabilityStatsResponse>('/admin/stability/stats');
    return res;
  }
};
