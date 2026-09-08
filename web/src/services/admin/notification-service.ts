import { apiClient } from '@/lib/api-client';

export interface Notification {
  id: string;
  userId: string;
  username?: string;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  priority: string;
  createdAt: string;
  readAt?: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface NotificationsResponse {
  success: boolean;
  data: Notification[];
  meta: PaginationMeta;
  notifications?: Notification[];
  pagination?: PaginationMeta;
}

interface StatsResponse {
  success: boolean;
  data: NotificationStats;
}

export const notificationService = {
  async getNotifications(params?: {
    page?: number;
    pageSize?: number;
    type?: string;
    isRead?: boolean;
    userId?: string;
  }): Promise<NotificationsResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.type) query.set('type', params.type);
    const res = await apiClient.get<NotificationsResponse>(`/admin/notifications?${query.toString()}`);
    return res;
  },

  async getNotificationStats(): Promise<StatsResponse> {
    const res = await apiClient.get<StatsResponse>('/admin/notifications/stats');
    return res;
  },

  async markAsRead(notificationId: string): Promise<{ success: boolean }> {
    const res = await apiClient.put<{ success: boolean }>(`/admin/notifications/${notificationId}/read`);
    return res;
  },

  async markAllAsRead(): Promise<{ success: boolean }> {
    const res = await apiClient.post<{ success: boolean }>('/admin/notifications/read-all');
    return res;
  },

  async deleteNotification(notificationId: string): Promise<{ success: boolean }> {
    const res = await apiClient.delete<{ success: boolean }>(`/admin/notifications/${notificationId}`);
    return res;
  },

  async sendNotification(params: {
    userId?: string;
    type?: string;
    title: string;
    content: string;
    priority?: string;
    data?: Record<string, unknown>;
  }): Promise<{ success: boolean; data: Notification; message: string }> {
    const res = await apiClient.post<{ success: boolean; data: Notification; message: string }>('/admin/notifications/send', params);
    return res;
  },

  async sendBatchNotification(params: {
    userIds: string[];
    type?: string;
    title: string;
    content: string;
    priority?: string;
    data?: Record<string, unknown>;
  }): Promise<{ success: boolean; data: { count: number }; message: string }> {
    const res = await apiClient.post<{ success: boolean; data: { count: number }; message: string }>('/admin/notifications/send-batch', params);
    return res;
  }
};
