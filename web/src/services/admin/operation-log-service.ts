import { apiClient } from '@/lib/api-client';

export interface OperationLog {
  id: string;
  adminId: string;
  adminUsername: string;
  action: string;
  targetType: string;
  targetId?: string;
  targetName?: string;
  beforeValue?: unknown;
  afterValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
  status: string;
  errorMessage?: string;
  metadata?: unknown;
  createdAt: string;
}

export interface OperationLogStats {
  total: number;
  successCount: number;
  failedCount: number;
  successRate: number;
  byAction: Array<{ action: string; count: number }>;
}

export interface ActionOption {
  value: string;
  label: string;
}

export const operationLogService = {
  async getLogs(params?: {
    page?: number;
    pageSize?: number;
    adminId?: string;
    action?: string;
    targetType?: string;
    targetId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    success: boolean;
    data: OperationLog[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const queryString = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiClient.get(`/admin/operation-logs${queryString}`);
  },

  async getStats(adminId?: string, days?: number): Promise<{
    success: boolean;
    data: OperationLogStats;
  }> {
    const queryParts: string[] = [];
    if (adminId) queryParts.push(`adminId=${adminId}`);
    if (days) queryParts.push(`days=${days}`);
    const queryString = queryParts.length > 0 ? '?' + queryParts.join('&') : '';
    return apiClient.get(`/admin/operation-logs/stats${queryString}`);
  },

  async getActions(): Promise<{
    success: boolean;
    data: ActionOption[];
  }> {
    return apiClient.get('/admin/operation-logs/actions');
  },
};
