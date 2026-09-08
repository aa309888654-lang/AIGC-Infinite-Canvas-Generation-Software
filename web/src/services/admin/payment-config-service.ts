import { apiClient } from '@/lib/api-client';

export interface YunGouOSConfig {
  mchId: string;
  appId: string;
  apiKeyConfigured: boolean;
  apiKeyPreview: string;
  notifyUrl: string;
  isConfigured: boolean;
}

export interface WechatConfig {
  enabled: boolean;
  type: string;
}

export interface AlipayConfig {
  enabled: boolean;
  appId: string;
  privateKeyConfigured: boolean;
  publicKeyConfigured: boolean;
}

export interface PaymentGeneralConfig {
  globalEnabled: boolean;
  minAmount: number;
  maxAmount: number;
  currency: string;
  autoActivateMembership: boolean;
  orderExpireMinutes: number;
}

export interface PaymentConfigData {
  yungouos: YunGouOSConfig;
  wechat: WechatConfig;
  alipay: AlipayConfig;
  general: PaymentGeneralConfig;
  runtime: {
    mchId: string;
    apiKeyConfigured: boolean;
    notifyUrl: string;
    gateway: string;
    isConfigured: boolean;
  };
}

export interface PaymentConfigStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  todayRevenue: number;
  totalRevenue: number;
}

export const paymentConfigService = {
  async getConfig(): Promise<{ success: boolean; data: PaymentConfigData }> {
    return apiClient.get('/admin/payment-config');
  },

  async updateConfig(config: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
    return apiClient.post('/admin/payment-config', config);
  },

  async testYunGouOS(): Promise<{ success: boolean; message: string; data?: Record<string, unknown> }> {
    return apiClient.post('/admin/payment-config/test-yungouos');
  },

  async getStats(): Promise<{ success: boolean; data: PaymentConfigStats }> {
    return apiClient.get('/admin/payment-config/stats');
  },
};
