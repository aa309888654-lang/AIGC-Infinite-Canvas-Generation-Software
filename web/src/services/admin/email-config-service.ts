import { apiClient } from '@/lib/api-client';

export interface EmailConfig {
  secretId: string;
  secretKey: string;
  region: string;
  domain: string;
  sender: string;
  templateId: number;
  callbackUrl: string;
  callbackSecret: string;
  isActive: boolean;
  isConfigured: boolean;
}

export interface EmailTestResult {
  success: boolean;
  message: string;
}

export const emailConfigService = {
  async getConfig(): Promise<{ success: boolean; data: EmailConfig }> {
    return apiClient.get('/admin/email-config');
  },

  async updateConfig(config: Partial<EmailConfig>): Promise<{ success: boolean }> {
    return apiClient.post('/admin/email-config', config);
  },

  async testConnection(): Promise<{ success: boolean; message: string }> {
    return apiClient.post('/admin/email-config/test');
  },

  async sendTestEmail(to: string): Promise<{ success: boolean; message: string }> {
    return apiClient.post('/admin/email-config/test-send', { to });
  },
};
