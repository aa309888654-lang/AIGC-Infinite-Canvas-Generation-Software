import { apiClient } from '@/lib/api-client';

export interface Payment {
  id: string;
  orderNo: string | null;
  userId: string;
  user?: {
    id: string;
    username: string;
    email: string;
  };
  amount: number;
  currency: string;
  method: string;
  paymentMethod?: string;
  type?: string;
  planName?: string;
  status: 'pending' | 'completed' | 'paid' | 'failed' | 'refunded' | 'expired';
  transactionId?: string;
  errorMessage?: string;
  metadata?: unknown;
  createdAt: string;
  updatedAt: string;
}

export type PaymentOrder = Payment;

export interface PaymentStats {
  overview: {
    totalPayments: number;
    completedPayments: number;
    pendingPayments: number;
    failedPayments: number;
    totalAmount: number;
    completedAmount: number;
    averageAmount: number;
  };
  byMethod: Array<{
    method: string;
    count: number;
    amount: number;
  }>;
  recentTrend: Array<{ date: string; count: number; total: number }>;
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  totalRevenue: number;
}

export interface PaymentListResponse {
  success: boolean;
  data: Payment[];
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class PaymentManagementService {
  async getPayments(params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    paymentMethod?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    orderNo?: string;
  }): Promise<PaymentListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', String(params.page));
    if (params?.pageSize) queryParams.set('pageSize', String(params.pageSize));
    if (params?.status) queryParams.set('status', params.status);
    if (params?.paymentMethod) queryParams.set('paymentMethod', params.paymentMethod);
    if (params?.startDate) queryParams.set('startDate', params.startDate);
    if (params?.endDate) queryParams.set('endDate', params.endDate);
    if (params?.search) queryParams.set('search', params.search);
    if (params?.orderNo) queryParams.set('search', params.orderNo);

    return apiClient.get<PaymentListResponse>(`/admin/payments?${queryParams.toString()}`);
  }

  async getOrders(params?: unknown) {
    return this.getPayments(params);
  }

  async getStats(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{ success: boolean; data: PaymentStats }> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.set('startDate', params.startDate);
    if (params?.endDate) queryParams.set('endDate', params.endDate);

    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return apiClient.get<{ success: boolean; data: PaymentStats }>(`/admin/payments/stats${query}`);
  }

  async getPayment(id: string): Promise<{ success: boolean; data: Payment }> {
    return apiClient.get<{ success: boolean; data: Payment }>(`/admin/payments/${id}`);
  }

  async createPayment(data: {
    userId: string;
    amount: number;
    currency?: string;
    paymentMethod: string;
    transactionId?: string;
    metadata?: unknown;
  }): Promise<{ success: boolean; data: Payment; message: string }> {
    return apiClient.post<{ success: boolean; data: Payment; message: string }>('/admin/payments', data);
  }

  async updatePayment(
    id: string,
    data: Partial<{
      status: 'pending' | 'completed' | 'failed' | 'refunded';
      transactionId: string;
      errorMessage: string;
      metadata: unknown;
    }>
  ): Promise<{ success: boolean; data: Payment }> {
    return apiClient.put<{ success: boolean; data: Payment }>(`/admin/payments/${id}`, data);
  }

  async deletePayment(id: string): Promise<{ success: boolean; message: string }> {
    return apiClient.delete<{ success: boolean; message: string }>(`/admin/payments/${id}`);
  }

  async refundPayment(id: string, reason?: string): Promise<{ success: boolean; message: string }> {
    return apiClient.post<{ success: boolean; message: string }>(`/admin/payments/${id}/refund`, {
      reason,
    });
  }

  async refundOrder(id: string, reason?: string) {
    return this.refundPayment(id, reason);
  }

  async exportPayments(params?: {
    startDate?: string;
    endDate?: string;
    status?: string;
  }): Promise<Blob> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.set('startDate', params.startDate);
    if (params?.endDate) queryParams.set('endDate', params.endDate);
    if (params?.status) queryParams.set('status', params.status);

    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return apiClient.get<Blob>(`/admin/payments/export/csv${query}`, { responseType: 'blob' });
  }
}

export const paymentManagementService = new PaymentManagementService();
