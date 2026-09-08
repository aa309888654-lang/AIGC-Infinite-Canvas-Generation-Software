import { cookieAuthModeHeaders, getAuthToken, clearAuthToken } from '@/lib/auth-check';
import { API_BASE_URL } from './api-config';

interface RequestConfig {
  headers?: Record<string, string>;
  responseType?: 'json' | 'blob';
  timeout?: number;
  maxRetries?: number;
  auth?: boolean;
}

const DEBUG = false;
const DEFAULT_TIMEOUT = 15000; // 统一超时设置：15秒
const DEFAULT_MAX_RETRIES = 3; // 默认重试次数
export const ADMIN_SESSION_EXPIRED_EVENT = 'admin-session-expired';

// 从 cookie 读取 CSRF token（与后端 app_csrf cookie 名一致）
function getCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = 'app_csrf=';
  for (const cookie of document.cookie.split(';')) {
    const trimmed = cookie.trim();
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length);
    }
  }
  return null;
}

class ApiRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

function expireAdminSession(): void {
  const hadAdminSession = typeof window !== 'undefined'
    && Boolean(localStorage.getItem('authToken') || localStorage.getItem('admin_token_v1'));

  clearAuthToken();
  if (typeof window === 'undefined') return;

  localStorage.removeItem('admin_token_v1');
  if (hadAdminSession) {
    window.dispatchEvent(new Event(ADMIN_SESSION_EXPIRED_EVENT));
  }
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private getAuthToken(): string | null {
    return getAuthToken();
  }

  private async request<T>(
    method: string,
    endpoint: string,
    data?: unknown,
    config: RequestConfig = {}
  ): Promise<T> {
    const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.singleRequest<T>(method, endpoint, data, config);
      } catch (error) {
        lastError = error as Error;
        
        // 如果是最后一次尝试，直接抛出错误
        if (attempt === maxRetries) {
          throw error;
        }

        // 写操作不能自动重放；GET 仅重试网络错误、429 和 5xx。
        if (method !== 'GET') {
          throw error;
        }
        if (error instanceof ApiRequestError && error.status < 500 && error.status !== 429) {
          throw error;
        }

        // 指数退避等待
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  private async singleRequest<T>(
    method: string,
    endpoint: string,
    data?: unknown,
    config: RequestConfig = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const token = this.getAuthToken();
    const timeout = config.timeout ?? DEFAULT_TIMEOUT;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...cookieAuthModeHeaders(),
      ...config.headers,
    };

    const hasExplicitAuthorization =
      Object.prototype.hasOwnProperty.call(headers, 'Authorization') ||
      Object.prototype.hasOwnProperty.call(headers, 'authorization');

    if (config.auth !== false && token && !hasExplicitAuthorization) {
      headers.Authorization = `Bearer ${token}`;
    }

    // 非 SAFE 方法（POST/PUT/PATCH/DELETE）自动注入 CSRF token
    // 从 app_csrf cookie 读取，与后端 csrfProtection 中间件配合
    const isWriteMethod = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
    if (isWriteMethod && !headers['X-CSRF-Token'] && !headers['x-csrf-token']) {
      const csrfToken = getCsrfTokenFromCookie();
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
    }

    const options: RequestInit = {
      method,
      headers,
      credentials: 'include',
    };

    if (DEBUG) {
      // console.log(`[API Request] ${method} ${endpoint}`, {
      //   url,
      //   hasToken: !!token,
      // });
    }

    const canAttachBody = method === 'POST' || method === 'PUT' || method === 'PATCH';
    if (data && canAttachBody) {
      if (typeof FormData !== 'undefined' && data instanceof FormData) {
        options.body = data;
        delete headers['Content-Type'];
      } else {
        options.body = JSON.stringify(data);
      }
    }

    // 添加超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    if (config.responseType === 'blob') {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: '请求失败' }));
        console.error(`[API Error] ${method} ${endpoint}`, error);
        throw new Error(this.getErrorMessage(error, response.status));
      }
      return response.blob() as unknown as T;
    }

    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '请求失败' }));
      if (response.status === 401) {
        console.warn(`[API] ${method} ${endpoint} - 未认证`);
        expireAdminSession();
      } else {
        console.error(`[API Error] ${method} ${endpoint}`, error);
      }
      throw new ApiRequestError(this.getErrorMessage(error, response.status), response.status);
    }

    const result = await response.json();
    if (DEBUG) {
      // console.log(`[API Success] ${method} ${endpoint}`, result);
    }
    return result;
  }

  private getErrorMessage(error: unknown, status: number): string {
    if (error && typeof error === 'object') {
      const payload = error as {
        error?: string | { message?: string };
        message?: string;
      };
      if (typeof payload.error === 'string') return payload.error;
      if (payload.error?.message) return payload.error.message;
      if (payload.message) return payload.message;
    }
    return `HTTP error! status: ${status}`;
  }

  async get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>('GET', endpoint, undefined, config);
  }

  async post<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>('POST', endpoint, data, config);
  }

  async put<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>('PUT', endpoint, data, config);
  }

  async patch<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>('PATCH', endpoint, data, config);
  }

  async delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>('DELETE', endpoint, undefined, config);
  }
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken() || '';
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export const apiClient = new ApiClient();
