import { apiClient } from '@/lib/api-client';
import type { SiteMessage } from '@/services/site-message-service';

export interface AdminSiteMessage extends SiteMessage {
  isActive: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}

interface ListResponse {
  success: boolean;
  data: AdminSiteMessage[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export const adminSiteMessageService = {
  async list(params?: { page?: number; pageSize?: number; isActive?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.isActive) query.set('isActive', params.isActive);
    return apiClient.get<ListResponse>(`/admin/site-messages?${query.toString()}`);
  },

  async create(payload: Partial<AdminSiteMessage>) {
    return apiClient.post<{ success: boolean; data: AdminSiteMessage }>('/admin/site-messages', payload);
  },

  async update(id: string, payload: Partial<AdminSiteMessage>) {
    return apiClient.put<{ success: boolean; data: AdminSiteMessage }>(`/admin/site-messages/${id}`, payload);
  },

  async remove(id: string) {
    return apiClient.delete<{ success: boolean }>(`/admin/site-messages/${id}`);
  },
};
