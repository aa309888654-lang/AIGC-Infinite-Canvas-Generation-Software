import { apiClient } from '@/lib/api-client';

export interface PointsConfig {
  [key: string]: {
    value: number | string;
    description?: string;
    isActive?: boolean;
  };
}

export interface PointsTransaction {
  id: string;
  userId: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  pointsCost: number;
  reason?: string;
  relatedType?: string;
  relatedId?: string;
  adminId?: string;
  adminUsername?: string;
  orderNo?: string;
  createdAt: string;
}

export interface PointsOrder {
  id: string;
  userId: string;
  orderNo: string;
  points: number;
  amount: number;
  paymentMethod: string;
  status: string;
  transactionId?: string;
  paidAt?: string;
  expiredAt?: string;
  createdAt: string;
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

export interface PointsAlert {
  id: string;
  userId: string;
  threshold: number;
  isEnabled: boolean;
  lastAlertAt?: string;
  alertCount: number;
  user?: {
    id: string;
    username: string;
    email: string;
    points: number;
  };
}

export interface PointsExpiration {
  id: string;
  userId: string;
  points: number;
  expiredAt: string;
  status: string;
  processedAt?: string;
  createdAt: string;
  user?: {
    id: string;
    username: string;
    email: string;
    points: number;
  };
}

export interface PointsOrderStats {
  totalOrders: number;
  totalPoints: number;
  totalAmount: number;
}

// ==================== JSON 配置（数组/对象型） ====================

export interface JsonConfig {
  daily_claim_rewards: number[];
}

export interface JsonConfigDefinition {
  key: string;
  label: string;
  description: string;
  defaultValue: unknown;
  group: string;
  type: string;
}

export interface JsonConfigResponse {
  success: boolean;
  data: {
    config: JsonConfig;
    definitions: JsonConfigDefinition[];
    defaults: JsonConfig;
  };
}

export const pointsManagementService = {
  async getConfig(): Promise<{ success: boolean; data: PointsConfig }> {
    return apiClient.get('/points-management/config');
  },

  async updateConfig(key: string, value: string | number, description?: string): Promise<{ success: boolean }> {
    return apiClient.put('/points-management/config', { key, value, description });
  },

  async adjustPoints(userId: string, amount: number, reason: string): Promise<{
    success: boolean;
    data: { transactionId: string; newBalance: number; change: number };
  }> {
    return apiClient.post('/points-management/adjust', { userId, amount, reason });
  },

  async batchAdjustPoints(adjustments: Array<{ userId: string; amount: number; reason: string }>): Promise<{
    success: boolean;
    data: { results: Array<{ userId: string; success: boolean; transactionId?: string; newBalance?: number }>; errors: Array<{ userId: string; error: string }> };
  }> {
    return apiClient.post('/points-management/batch-adjust', { adjustments });
  },

  async deductPoints(userId: string, amount: number, type: string, relatedId?: string, description?: string): Promise<{
    success: boolean;
    data: { transactionId: string; newBalance: number };
  }> {
    return apiClient.post('/points-management/deduct', { userId, amount, type, relatedId, description });
  },

  async createOrder(userId: string, points: number, amount: number, paymentMethod: string): Promise<{
    success: boolean;
    data: PointsOrder;
  }> {
    return apiClient.post('/points-management/order', { userId, points, amount, paymentMethod });
  },

  async completeOrder(orderId: string, transactionId?: string): Promise<{
    success: boolean;
    data: { order: PointsOrder; newBalance: number; transactionId: string };
  }> {
    return apiClient.post(`/points-management/order/${orderId}/complete`, { transactionId });
  },

  async cancelOrder(orderId: string): Promise<{ success: boolean; data: PointsOrder }> {
    return apiClient.post(`/points-management/order/${orderId}/cancel`);
  },

  async getOrders(params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    success: boolean;
    data: PointsOrder[];
    stats: PointsOrderStats;
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const queryString = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiClient.get(`/points-management/orders${queryString}`);
  },

  async getAlerts(params?: {
    page?: number;
    pageSize?: number;
    isEnabled?: boolean;
  }): Promise<{
    success: boolean;
    data: PointsAlert[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const queryString = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiClient.get(`/points-management/alerts${queryString}`);
  },

  async getTransactions(params?: {
    page?: number;
    pageSize?: number;
    userId?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    success: boolean;
    data: PointsTransaction[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const queryString = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiClient.get(`/admin/points/transactions${queryString}`);
  },

  async updateAlert(userId: string, threshold: number, isEnabled?: boolean): Promise<{
    success: boolean;
    data: PointsAlert;
  }> {
    return apiClient.put(`/points-management/alerts/${userId}`, { threshold, isEnabled });
  },

  async getExpirations(params?: {
    page?: number;
    pageSize?: number;
    status?: string;
  }): Promise<{
    success: boolean;
    data: PointsExpiration[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const queryString = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiClient.get(`/points-management/expirations${queryString}`);
  },

  async autoDeduct(userId: string, amount: number, type: string, relatedId?: string, description?: string): Promise<{
    success: boolean;
    data: { transactionId: string; newBalance: number };
  }> {
    return apiClient.post('/points-management/auto-deduct', { userId, amount, type, relatedId, description });
  },

  // ==================== JSON 配置（签到奖励档位） ====================

  async getJsonConfig(): Promise<JsonConfigResponse> {
    return apiClient.get('/admin/points/json-config');
  },

  async updateJsonConfig(config: Partial<JsonConfig>): Promise<{ success: boolean; message?: string }> {
    return apiClient.put('/admin/points/json-config', config);
  },
};
