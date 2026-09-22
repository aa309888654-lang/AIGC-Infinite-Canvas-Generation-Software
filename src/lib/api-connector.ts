import { APIAuthConfig, APIProvider } from '@/types/api-controller';
import { API_BASE_URL } from '@/lib/api-config';

interface TestConnectionResult {
  success: boolean;
  message?: string;
  latency?: number;
}

class APIConnector {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  private getToken(): string | null {
    return localStorage.getItem('token') || localStorage.getItem('authToken');
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || err.message || `HTTP ${res.status}`);
    }

    return res.json();
  }

  async testConnection(providerId: APIProvider, config: APIAuthConfig): Promise<TestConnectionResult> {
    try {
      const result = await this.request<{ success: boolean; data?: { success: boolean; message?: string } }>(
        'POST',
        '/ai-providers/test-connection',
        { providerId, config }
      );
      return {
        success: result.data?.success ?? result.success,
        message: result.data?.message,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '连接测试失败',
      };
    }
  }

  async getProviderStatus(providerId: APIProvider): Promise<{ online: boolean; latency?: number }> {
    try {
      const start = Date.now();
      const result = await this.request<{ success: boolean; data?: { online: boolean } }>(
        'GET',
        `/ai-providers/${providerId}/status`
      );
      return {
        online: result.data?.online ?? false,
        latency: Date.now() - start,
      };
    } catch {
      return { online: false };
    }
  }
}

export const apiConnector = new APIConnector();
