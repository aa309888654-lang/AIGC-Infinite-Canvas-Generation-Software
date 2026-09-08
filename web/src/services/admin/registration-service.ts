import { apiClient } from '@/lib/api-client';

export interface PendingRegistration {
  id: string;
  username: string;
  email: string;
  phone?: string;
  status: string;
  ipAddress?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegistrationStats {
  pending: number;
  verified: number;
  approved: number;
  rejected: number;
}

export interface SendCodeParams {
  email: string;
  type?: 'register' | 'reset_password' | 'bind_email';
}

export const registrationService = {
  async sendVerificationCode(params: SendCodeParams): Promise<{ success: boolean; token?: string; expiresIn?: number }> {
    return apiClient.post('/registration/send-code', params);
  },

  async verifyCode(email: string, code: string, type?: string): Promise<{ success: boolean }> {
    return apiClient.post('/registration/verify-code', { email, code, type });
  },

  async register(data: {
    username: string;
    email: string;
    phone?: string;
    password: string;
    code?: string;
  }): Promise<{ success: boolean; user?: { id: string; username: string; email: string } }> {
    return apiClient.post('/registration/register', data);
  },

  async getPendingRegistrations(params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    data: PendingRegistration[];
    stats: RegistrationStats;
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const queryString = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiClient.get(`/registration/pending${queryString}`);
  },

  async approveRegistration(id: string, note?: string): Promise<{ success: boolean; userId?: string }> {
    return apiClient.post(`/registration/${id}/approve`, { note });
  },

  async rejectRegistration(id: string, reason?: string): Promise<{ success: boolean }> {
    return apiClient.post(`/registration/${id}/reject`, { reason });
  },

  async verifyRegistration(id: string, code: string): Promise<{ success: boolean }> {
    return apiClient.post(`/registration/${id}/verify`, { code });
  },
};
