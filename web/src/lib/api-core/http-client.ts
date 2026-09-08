import { networkClient } from './network-client';
import { ApiNetworkError } from './errors';

export interface HttpRequestConfig {
  baseURL?: string;
  headers?: Record<string, string>;
  timeout?: number;
  withCredentials?: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: number;
}

export class HttpClient {
  private baseURL: string = '';
  private defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  private authToken: string | null = null;
  private onUnauthorized: (() => void) | null = null;

  public configure(config: HttpRequestConfig): void {
    if (config.baseURL) {
      this.baseURL = config.baseURL.replace(/\/$/, '');
    }
    if (config.headers) {
      this.defaultHeaders = { ...this.defaultHeaders, ...config.headers };
    }
  }

  /**
   * 设置401未授权处理器
   */
  public setUnauthorizedHandler(handler: () => void): void {
    this.onUnauthorized = handler;
    networkClient.setUnauthorizedHandler(handler);
  }

  public setAuthToken(token: string | null): void {
    this.authToken = token;
  }

  public getAuthToken(): string | null {
    return this.authToken;
  }

  private getHeaders(customHeaders?: Record<string, string>): Record<string, string> {
    const headers = { ...this.defaultHeaders };
    
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    
    if (customHeaders) {
      return { ...headers, ...customHeaders };
    }
    
    return headers;
  }

  private buildURL(url: string, params?: Record<string, unknown>): string {
    let fullURL = url.startsWith('http') ? url : `${this.baseURL}${url}`;
    
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        fullURL += `?${queryString}`;
      }
    }
    
    return fullURL;
  }

  public async get<T = unknown>(
    url: string,
    params?: Record<string, unknown>,
    config?: { headers?: Record<string, string>; timeout?: number }
  ): Promise<ApiResponse<T>> {
    const fullURL = this.buildURL(url, params);
    
    try {
      const data = await networkClient.request<T>(fullURL, {
        method: 'GET',
        headers: this.getHeaders(config?.headers),
        timeoutMs: config?.timeout,
      });
      
      return {
        success: true,
        data,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  public async post<T = unknown>(
    url: string,
    body?: unknown,
    config?: { headers?: Record<string, string>; timeout?: number }
  ): Promise<ApiResponse<T>> {
    const fullURL = url.startsWith('http') ? url : `${this.baseURL}${url}`;

    try {
      const data = await networkClient.request<T>(fullURL, {
        method: 'POST',
        headers: this.getHeaders(config?.headers),
        body: body ? JSON.stringify(body) : undefined,
        timeoutMs: config?.timeout,
      });

      return {
        success: true,
        data,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  public async put<T = unknown>(
    url: string,
    body?: unknown,
    config?: { headers?: Record<string, string>; timeout?: number }
  ): Promise<ApiResponse<T>> {
    const fullURL = url.startsWith('http') ? url : `${this.baseURL}${url}`;

    try {
      const data = await networkClient.request<T>(fullURL, {
        method: 'PUT',
        headers: this.getHeaders(config?.headers),
        body: body ? JSON.stringify(body) : undefined,
        timeoutMs: config?.timeout,
      });

      return {
        success: true,
        data,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  public async delete<T = unknown>(
    url: string,
    config?: { headers?: Record<string, string>; timeout?: number }
  ): Promise<ApiResponse<T>> {
    const fullURL = url.startsWith('http') ? url : `${this.baseURL}${url}`;
    
    try {
      const data = await networkClient.request<T>(fullURL, {
        method: 'DELETE',
        headers: this.getHeaders(config?.headers),
        timeoutMs: config?.timeout,
      });
      
      return {
        success: true,
        data,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  public async patch<T = unknown>(
    url: string,
    body?: unknown,
    config?: { headers?: Record<string, string>; timeout?: number }
  ): Promise<ApiResponse<T>> {
    const fullURL = url.startsWith('http') ? url : `${this.baseURL}${url}`;

    try {
      const data = await networkClient.request<T>(fullURL, {
        method: 'PATCH',
        headers: this.getHeaders(config?.headers),
        body: body ? JSON.stringify(body) : undefined,
        timeoutMs: config?.timeout,
      });

      return {
        success: true,
        data,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  private handleError<T>(error: unknown): ApiResponse<T> {
    if (error instanceof ApiNetworkError) {
      return {
        success: false,
        error: error.message,
        code: error.statusCode,
      };
    }

    if (error instanceof Error) {
      return {
        success: false,
        error: error.message || 'Unknown error occurred',
      };
    }

    return {
      success: false,
      error: 'Unknown error occurred',
    };
  }

  public async request<T = unknown>(
    url: string,
    config: {
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      body?: unknown;
    } & HttpRequestConfig
  ): Promise<ApiResponse<T>> {
    const { method, body, headers, timeout } = config;

    switch (method) {
      case 'GET':
        return this.get<T>(url, body as Record<string, unknown>, { headers, timeout });
      case 'POST':
        return this.post<T>(url, body as Record<string, unknown>, { headers, timeout });
      case 'PUT':
        return this.put<T>(url, body as Record<string, unknown>, { headers, timeout });
      case 'DELETE':
        return this.delete<T>(url, { headers, timeout });
      case 'PATCH':
        return this.patch<T>(url, body as Record<string, unknown>, { headers, timeout });
      default:
        return { success: false, error: `Unsupported method: ${method}` };
    }
  }
}

export const httpClient = new HttpClient();
export default httpClient;
