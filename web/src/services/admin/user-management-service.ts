import { apiClient } from '@/lib/api-client';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
  apiQuota: number;
  usedQuota: number;
  points: number;
  pointsBalance: number;
  frozenPoints: number;
  totalPoints: number;
  isActive: boolean;
  phone?: string;
  avatar?: string;
  lastLoginAt?: string;
  lastLoginIp?: string;
  createdAt: string;
  updatedAt: string;
  taskCount?: number;
  apiKeyCount?: number;
  paymentCount?: number;
  remainingQuota?: number;
  currentMembership?: {
    id: string;
    name: string;
    displayName?: string;
    description?: string;
    price: number;
    monthlyPrice?: number;
    quarterlyPrice?: number;
    yearlyPrice?: number;
    quota: number;
    features?: unknown[];
  } | null;
  userMembershipLevel?: string;
  storageUsed?: number;
  storageLimit?: number;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  vipUsers: number;
  recentRegistrations: number;
  userGrowth: Array<{ date: string; count: number }>;
}

export interface UserListResponse {
  success: boolean;
  data: AdminUser[];
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface UserDetailResponse {
  success: boolean;
  data: AdminUser & {
    tasks: unknown[];
    apiKeys: unknown[];
    payments: unknown[];
    quotaTransactions: unknown[];
  };
}

class UserManagementService {
  async getUsers(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    role?: string;
    isActive?: boolean;
    startDate?: string;
    endDate?: string;
  }): Promise<UserListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', String(params.page));
    if (params?.pageSize) queryParams.set('pageSize', String(params.pageSize));
    if (params?.search) queryParams.set('search', params.search);
    if (params?.role) queryParams.set('role', params.role);
    if (params?.isActive !== undefined) queryParams.set('isActive', String(params.isActive));
    if (params?.startDate) queryParams.set('startDate', params.startDate);
    if (params?.endDate) queryParams.set('endDate', params.endDate);

    return apiClient.get<UserListResponse>(`/admin/users?${queryParams.toString()}`);
  }

  async getStats(): Promise<{ success: boolean; data: UserStats }> {
    return apiClient.get<{ success: boolean; data: UserStats }>('/admin/users/stats');
  }

  async getUser(id: string): Promise<UserDetailResponse> {
    return apiClient.get<UserDetailResponse>(`/admin/users/${id}`);
  }

  async createUser(data: {
    username: string;
    email: string;
    password: string;
    role?: string;
    apiQuota?: number;
    phone?: string;
    avatar?: string;
  }): Promise<{ success: boolean; data: AdminUser }> {
    return apiClient.post<{ success: boolean; data: AdminUser }>('/admin/users', data);
  }

  async updateUser(
    id: string,
    data: Partial<{
      username: string;
      email: string;
      password: string;
      role: string;
      apiQuota: number;
      isActive: boolean;
      phone: string;
      avatar: string;
      reason: string;
    }>
  ): Promise<{ success: boolean; data: AdminUser }> {
    return apiClient.put<{ success: boolean; data: AdminUser }>(`/admin/users/${id}`, data);
  }

  async updateUserMembership(
    id: string,
    data: {
      membershipId: string | null;
      level?: string;
      duration?: 'monthly' | 'quarterly' | 'yearly';
    }
  ): Promise<{ success: boolean; data?: unknown; message?: string; error?: string }> {
    return apiClient.post<{ success: boolean; data?: unknown; message?: string; error?: string }>(
      `/admin/users/${id}/membership`,
      data
    );
  }

  async recalculateUserStorageQuota(
    id: string
  ): Promise<{
    success: boolean;
    data?: {
      userId: string;
      membershipLevel: string;
      storageUsed: number;
      storageLimit: number;
    };
    message?: string;
    error?: string;
  }> {
    return apiClient.post(`/admin/users/${id}/recalculate-storage-quota`);
  }

  async deleteUser(id: string): Promise<{ success: boolean; message: string }> {
    return apiClient.delete<{ success: boolean; message: string }>(`/admin/users/${id}`);
  }

  async batchUpdateUsers(
    userIds: string[],
    action: 'activate' | 'deactivate' | 'delete'
  ): Promise<{ success: boolean; data: unknown; message: string }> {
    return apiClient.post<{ success: boolean; data: unknown; message: string }>('/admin/users/batch', {
      userIds,
      action,
    });
  }

  async getUserUsage(
    id: string,
    params?: { startDate?: string; endDate?: string }
  ): Promise<{ success: boolean; data: Record<string, unknown> }> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.set('startDate', params.startDate);
    if (params?.endDate) queryParams.set('endDate', params.endDate);

    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return apiClient.get<{ success: boolean; data: Record<string, unknown> }>(`/admin/users/${id}/usage${query}`);
  }

  async exportUsers(params?: {
    startDate?: string;
    endDate?: string;
    role?: string;
  }): Promise<Blob> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.set('startDate', params.startDate);
    if (params?.endDate) queryParams.set('endDate', params.endDate);
    if (params?.role) queryParams.set('role', params.role);

    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return apiClient.get<Blob>(`/admin/users/export${query}`, { responseType: 'blob' });
  }
}

export const userManagementService = new UserManagementService();
