import { apiClient } from '@/lib/api-client';

export interface SmsConfigData {
  provider: string;
  accessKeyId: string;
  accessKeySecret: string;
  signName: string;
  templateCode: string;
  schemeName: string;
  isActive: boolean;
  isConfigured: boolean;
  runtimeProvider: string;
}

export interface SmsStats {
  totalSent: number;
  sentSuccess: number;
  sentFailed: number;
  successRate: string;
  byType: Array<{ type: string; _count: number }>;
  byStatus: Array<{ status: string; _count: number }>;
  recentLogs: Array<{
    id: string;
    phone: string;
    countryCode: string;
    type: string;
    status: string;
    attempts: number;
    createdAt: string;
  }>;
}

export interface SmsConfigPayload {
  provider: string;
  accessKeyId?: string;
  accessKeySecret?: string;
  signName?: string;
  templateCode?: string;
  schemeName?: string;
}

class AdminSmsConfigService {
  getConfig(): Promise<{ success: boolean; data: SmsConfigData }> {
    return apiClient.get('/admin/sms-config');
  }

  getStats(): Promise<{ success: boolean; data: SmsStats }> {
    return apiClient.get('/admin/sms-config/stats');
  }

  saveConfig(config: SmsConfigPayload): Promise<{ success: boolean; message?: string; error?: string }> {
    return apiClient.post('/admin/sms-config', config);
  }

  sendTest(phone: string): Promise<{ success: boolean; message?: string; error?: string }> {
    return apiClient.post('/admin/sms-config/test-send', { phone });
  }
}

export const adminSmsConfigService = new AdminSmsConfigService();
