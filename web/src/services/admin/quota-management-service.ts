import { apiClient } from '@/lib/api-client';

export interface QuotaOverview {
  totalQuota: number;
  usedQuota: number;
  remainingQuota: number;
  totalUsers: number;
  usersWithQuota: number;
  utilizationRate: number;
  byMembership: Array<{
    role: string;
    count: number;
    totalQuota: number;
    usedQuota: number;
    remainingQuota: number;
  }>;
}

export interface UserQuota {
  id: string;
  username: string;
  email: string;
  role: string;
  apiQuota: number;
  usedQuota: number;
  isActive: boolean;
  createdAt: string;
  remainingQuota: number;
  utilizationRate: number;
}

export interface QuotaTransaction {
  id: string;
  userId: string;
  user?: {
    id: string;
    username: string;
    email: string;
  };
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reason?: string;
  adminId?: string;
  createdAt: string;
}

export interface QuotaListResponse {
  success: boolean;
  data: UserQuota[];
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface TransactionListResponse {
  success: boolean;
  data: QuotaTransaction[];
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

class QuotaManagementService {
  async getOverview(): Promise<{ success: boolean; data: QuotaOverview }> {
    return apiClient.get<{ success: boolean; data: QuotaOverview }>('/admin/quotas/overview');
  }

  async consumePoints(amount: number, reason: string): Promise<{ success: boolean; remainingQuota: number }> {
    try {
      const response = await apiClient.post<{
      success: boolean;
      data: { remainingQuota: number };
    }>('/quota/consume', { amount, reason });
      return {
        success: response.success,
        remainingQuota: response.data?.remainingQuota || 0,
      };
    } catch (error) {
      console.error('Consume points error:', error);
      return { success: false, remainingQuota: 0 };
    }
  }

  async getUsers(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    hasRemaining?: boolean;
    role?: string;
  }): Promise<QuotaListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', String(params.page));
    if (params?.pageSize) queryParams.set('pageSize', String(params.pageSize));
    if (params?.search) queryParams.set('search', params.search);
    if (params?.hasRemaining !== undefined) queryParams.set('hasRemaining', String(params.hasRemaining));
    if (params?.role) queryParams.set('role', params.role);

    return apiClient.get<QuotaListResponse>(`/admin/quotas/users?${queryParams.toString()}`);
  }

  async getTransactions(params?: {
    page?: number;
    pageSize?: number;
    userId?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<TransactionListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', String(params.page));
    if (params?.pageSize) queryParams.set('pageSize', String(params.pageSize));
    if (params?.userId) queryParams.set('userId', params.userId);
    if (params?.type) queryParams.set('type', params.type);
    if (params?.startDate) queryParams.set('startDate', params.startDate);
    if (params?.endDate) queryParams.set('endDate', params.endDate);

    return apiClient.get<TransactionListResponse>(`/admin/quotas/transactions?${queryParams.toString()}`);
  }

  async getUserQuota(userId: string): Promise<{ success: boolean; data: Record<string, unknown> }> {
    return apiClient.get<{ success: boolean; data: Record<string, unknown> }>(`/admin/quotas/user/${userId}`);
  }

  async adjustQuota(data: {
    userId: string;
    amount: number;
    reason: string;
    type?: 'add' | 'deduct' | 'set';
  }): Promise<{ success: boolean; data: unknown; message: string }> {
    return apiClient.post<{ success: boolean; data: unknown; message: string }>('/admin/quotas/adjust', data);
  }

  async batchAdjustQuota(data: {
    userIds: string[];
    amount: number;
    reason: string;
    type?: 'add' | 'deduct' | 'set';
  }): Promise<{ success: boolean; data: unknown; message: string }> {
    return apiClient.post<{ success: boolean; data: unknown; message: string }>('/admin/quotas/batch-adjust', data);
  }

  async resetUserUsage(
    userId: string,
    reason?: string
  ): Promise<{ success: boolean; data: unknown; message: string }> {
    return apiClient.post<{ success: boolean; data: unknown; message: string }>(`/admin/quotas/reset/${userId}`, {
      reason,
    });
  }

  async resetAllUsage(params?: {
    role?: string;
    activeOnly?: boolean;
  }): Promise<{ success: boolean; data: unknown; message: string }> {
    return apiClient.post<{ success: boolean; data: unknown; message: string }>('/admin/quotas/reset-all', params || {});
  }

  async getUsageStats(params?: { days?: number }): Promise<{ success: boolean; data: Record<string, unknown> }> {
    const query = params?.days ? `?days=${params.days}` : '';
    return apiClient.get<{ success: boolean; data: Record<string, unknown> }>(`/admin/quotas/stats/usage${query}`);
  }
}

export const quotaManagementService = new QuotaManagementService();
