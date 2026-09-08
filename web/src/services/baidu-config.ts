/**
 * 百度AI API配置管理
 * 密钥从后端获取，不再在前端硬编码
 */

import { baiduAIService } from './baidu-ai-service';
import { purgeBrowserApiSecrets } from './api-config-security';

export interface BaiduAPIConfig {
  apiKey: string;
  secretKey: string;
  isConfigured: boolean;
}

class BaiduConfigService {
  private config: BaiduAPIConfig = { apiKey: '', secretKey: '', isConfigured: false };

  public constructor() {
    purgeBrowserApiSecrets();
  }

  /**
   * 获取API配置
   */
  public getConfig(): BaiduAPIConfig {
    return this.config;
  }

  /**
   * 从后端获取并应用百度 API 密钥
   */
  public async fetchAndApplyFromBackend(): Promise<boolean> {
    const configured = await baiduAIService.testConnection();
    this.config = {
      apiKey: '',
      secretKey: '',
      isConfigured: configured,
    };
    return configured;
  }

  /**
   * 保存API配置
   */
  public async saveConfig(_apiKey: string, _secretKey: string): Promise<void> {
    purgeBrowserApiSecrets();
    await this.fetchAndApplyFromBackend();
  }

  /**
   * 清除配置
   */
  public async clearConfig(): Promise<void> {
    purgeBrowserApiSecrets();

    this.config = {
      apiKey: '',
      secretKey: '',
      isConfigured: false,
    };
  }

  /**
   * 检查是否已配置
   */
  public isConfigured(): boolean {
    return this.getConfig().isConfigured;
  }

  /**
   * 获取API Key
   */
  public getAPIKey(): string {
    return this.getConfig().apiKey;
  }

  /**
   * 获取Secret Key
   */
  public getSecretKey(): string {
    return this.getConfig().secretKey;
  }

  /**
   * 初始化服务（尝试从后端获取密钥，如果本地没有则自动获取）
   */
  public async initialize(): Promise<void> {
    await this.fetchAndApplyFromBackend();
  }
}

export const baiduConfigService = new BaiduConfigService();

// 异步初始化（不阻塞模块加载）
baiduConfigService.initialize();
