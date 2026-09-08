import { API_BASE_URL } from '@/lib/api-config';
/**
 * API密钥管理服务
 * 安全地管理用户的AI服务商API密钥
 * 核心功能：
 * 1. 与后端API通信，安全存储API密钥
 * 2. 加密传输，不在前端明文存储
 * 3. 支持21个主流AI服务商的密钥管理
 * 4. 提供密钥验证和状态检查
 */


export interface ApiKeyInfo {
  id: string;
  provider: string;
  apiKey: string;
  apiSecret?: string;
  endpoint?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKeyCreateRequest {
  provider: string;
  apiKey: string;
  apiSecret?: string;
  endpoint?: string;
}

export interface ApiKeyUpdateRequest {
  apiKey?: string;
  apiSecret?: string;
  endpoint?: string;
  isActive?: boolean;
}

export interface ProviderInfo {
  provider: string;
  name: string;
  displayName: string;
  description: string;
  supportedModes?: string;
  models?: string;
}

class ApiKeyManagementService {
  private static instance: ApiKeyManagementService;
  private token: string | null = null;
  private cachedKeys: Map<string, ApiKeyInfo> = new Map();
  private providerList: ProviderInfo[] = [];

  private constructor() { /* noop */ }

  public static getInstance(): ApiKeyManagementService {
    if (!ApiKeyManagementService.instance) {
      ApiKeyManagementService.instance = new ApiKeyManagementService();
    }
    return ApiKeyManagementService.instance;
  }

  public setToken(token: string): void {
    this.token = token;
    this.cachedKeys.clear();
  }

  public clearToken(): void {
    this.token = null;
    this.cachedKeys.clear();
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('未授权，请先登录');
      }
      const error = await response.json().catch(() => ({ error: '请求失败' }));
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  public async getAllKeys(): Promise<ApiKeyInfo[]> {
    try {
      const response = await this.request<{ success: boolean; data: ApiKeyInfo[] }>('/apikey/', {
        method: 'GET',
      });

      if (response.success && response.data) {
        this.cachedKeys.clear();
        response.data.forEach(key => {
          this.cachedKeys.set(key.provider, key);
        });
        return response.data;
      }

      return [];
    } catch (error: unknown) {
      console.error('Failed to fetch API keys:', error);
      return [];
    }
  }

  public async getKey(provider: string): Promise<ApiKeyInfo | null> {
    if (this.cachedKeys.has(provider)) {
      return this.cachedKeys.get(provider)!;
    }

    try {
      const response = await this.request<{ success: boolean; data: ApiKeyInfo }>(`/apikey/${provider}`, {
        method: 'GET',
      });

      if (response.success && response.data) {
        this.cachedKeys.set(provider, response.data);
        return response.data;
      }

      return null;
    } catch (error: unknown) {
      console.error(`Failed to fetch API key for ${provider}:`, error);
      return null;
    }
  }

  public async createKey(request: ApiKeyCreateRequest): Promise<ApiKeyInfo> {
    const response = await this.request<{ success: boolean; data: ApiKeyInfo }>('/apikey/', {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (response.success && response.data) {
      this.cachedKeys.set(response.data.provider, response.data);
      return response.data;
    }

    throw new Error('Failed to create API key');
  }

  public async updateKey(id: string, request: ApiKeyUpdateRequest): Promise<ApiKeyInfo> {
    const response = await this.request<{ success: boolean; data: ApiKeyInfo }>(`/apikey/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    });

    if (response.success && response.data) {
      this.cachedKeys.set(response.data.provider, response.data);
      return response.data;
    }

    throw new Error('Failed to update API key');
  }

  public async deleteKey(id: string): Promise<void> {
    await this.request('/apikey/' + id, {
      method: 'DELETE',
    });

    for (const [provider, key] of this.cachedKeys.entries()) {
      if (key.id === id) {
        this.cachedKeys.delete(provider);
        break;
      }
    }
  }

  public async getAllProviders(): Promise<ProviderInfo[]> {
    if (this.providerList.length > 0) {
      return this.providerList;
    }

    try {
      const response = await this.request<{ success: boolean; data: ProviderInfo[] }>('/ai-providers/active', {
        method: 'GET',
      });

      if (response.success && response.data) {
        this.providerList = response.data;
        return response.data;
      }

      return [];
    } catch (error: unknown) {
      console.error('Failed to fetch providers:', error);
      return [];
    }
  }

  public async testConnection(provider: string): Promise<{ success: boolean; message: string; latency?: number }> {
    try {
      const key = await this.getKey(provider);
      if (!key) {
        return { success: false, message: '未找到API密钥' };
      }

      const response = await this.request<{ success: boolean; message: string; latency?: number }>(
        `/ai-providers/${provider}/test`,
        {
          method: 'POST',
        }
      );

      return {
        success: response.success,
        message: response.message || (response.success ? '连接成功' : '连接失败'),
        latency: response.latency,
      };
    } catch (error: unknown) {
      return {
        success: false,
        message: (error instanceof Error ? error.message : String(error)) || '连接测试失败',
      };
    }
  }

  public hasKey(provider: string): boolean {
    return this.cachedKeys.has(provider);
  }

  public getCachedKey(provider: string): ApiKeyInfo | undefined {
    return this.cachedKeys.get(provider);
  }

  public getSupportedProviders(): string[] {
    return [
      'doubao',
      'doubao-video',
      'doubao-seedream',
      'minimax',
      'minimax-tts',
      'bytedance',
      'stability_ai',
      'adobe_firefly',
      'leonardo_ai',
      'ideogram',
      'recraft_ai',
      'hailuo',
      'huawei',
      'openai_compatible',
    ];
  }

  public getProviderDisplayName(provider: string): string {
    const displayNames: Record<string, string> = {
      doubao: '豆包',
      'doubao-video': '豆包视频',
      'doubao-seedream': '豆包Seedream',
      minimax: 'MiniMax',
      'minimax-tts': 'MiniMax TTS',
      bytedance: '字节跳动',
      stability_ai: 'Stability AI',
      haiper_ai: 'Haiper AI',
      adobe_firefly: 'Adobe Firefly',
      leonardo_ai: 'Leonardo AI',
      ideogram: 'Ideogram',
      recraft_ai: 'Recraft AI',
      hailuo: '海螺',
      wanx: '万相',
      huawei: '华为云',
      aliyun_wan: '阿里云万相',
      openai_compatible: 'OpenAI兼容',
    };

    return displayNames[provider] || provider;
  }
}

export const apiKeyService = ApiKeyManagementService.getInstance();
