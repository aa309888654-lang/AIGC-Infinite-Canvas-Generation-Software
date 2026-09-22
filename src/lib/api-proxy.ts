/**
 * API代理工具 - 通过Tauri后端代理API请求，绕过CORS
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * 通过Tauri后端代理API请求
 */
export async function apiProxy(
  url: string,
  method: string = 'GET',
  headers?: Record<string, string>,
  body?: string
): Promise<{
  status: number;
  headers: Record<string, string>;
  body: string;
}> {
  try {
    const response = await invoke<{
      status: number;
      headers: Record<string, string>;
      body: string;
    }>('api_proxy', {
      request: {
        url,
        method,
        headers,
        body,
      },
    });
    return response;
  } catch (error) {
    console.error('[API Proxy] 请求失败:', error);
    throw error;
  }
}

/**
 * 豆包API专用代理
 */
export async function douyinApiProxy(
  endpoint: string,
  body: string,
  accessKey: string,
  secretKey: string
): Promise<string> {
  try {
    const response = await invoke<string>('douyin_api_proxy', {
      endpoint,
      body,
      accessKey,
      secretKey,
    });
    return response;
  } catch (error) {
    console.error('[Douyin API Proxy] 请求失败:', error);
    throw error;
  }
}

/**
 * 检查Tauri是否可用
 */
export function isTauriAvailable(): boolean {
  return !!(window as any as Record<string, unknown>).__TAURI__;
}

/**
 * 通用API调用（自动选择直接调用或代理）
 */
export async function makeApiRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    useProxy?: boolean;
  } = {}
): Promise<any> {
  const { method = 'POST', headers = {}, body, useProxy = true } = options;

  // 如果Tauri可用且启用代理，则使用代理
  if (isTauriAvailable() && useProxy) {
    try {
      const response = await apiProxy(
        url,
        method,
        headers,
        body ? JSON.stringify(body) : undefined
      );
      return JSON.parse(response.body);
    } catch (error) {
      console.warn('[API] 代理调用失败，尝试直接调用:', error);
      // 如果代理失败，回退到直接调用
    }
  }

  // 直接调用（可能会遇到CORS问题）
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API请求失败: ${response.status} - ${error}`);
  }

  return response.json();
}
