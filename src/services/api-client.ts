// @ts-nocheck
import { BaseGenerator } from './adapters/base';
import { backendProxyAdapter } from './adapters/backend-proxy-adapter';
import {
  AIModelProvider,
  VideoGenerationParams,
  ImageGenerationParams,
  AudioGenerationParams,
  GenerationResult,
  APIKeys,
} from '@/types/ai-models';
import type { UnifiedAPIProvider } from '@/types/core';

const toProvider = (p: AIModelProvider): UnifiedAPIProvider => p as any as UnifiedAPIProvider;

// 连接状态管理
import { ConnectionManager, ConnectionStatus } from './connection-manager';

const connectionManager = ConnectionManager.getInstance();

// 名称映射函数 - 将 APIProvider 转换为 AIModelProvider
// @deprecated 使用 @/types/core 中的 toUnifiedProvider 代替
function mapProviderName(provider: string): AIModelProvider {
  const nameMap: Record<string, AIModelProvider> = {
    stableDiffusion: 'stable_diffusion',
    stabilityAI: 'stability_ai',
    leonardoAI: 'leonardo_ai',
    recraftAI: 'recraft_ai',
    haiperAI: 'stable_diffusion',
    minimaxVideo: 'minimax',
    adobeFirefly: 'adobe_firefly',
    bytedance: 'doubao',
    'doubao-video': 'doubao',
    huawei: 'huawei',
    huaweiVideo: 'huawei_video',
    'huawei-video': 'huawei_video',
    viduq2: 'vidu',
    'viduq2-pro': 'vidu',
  };
  return nameMap[provider] || (provider as AIModelProvider);
}

// 根据提供商获取对应的生成器
export function getGenerator(
  provider: AIModelProvider | string,
  _apiKeys: APIKeys,
  _requestedModelId?: string
): BaseGenerator | null {
  console.info(`[api-client] ${provider} 已切换为后端托管生成器`);
  return backendProxyAdapter as any as BaseGenerator;
}

// 获取连接状态
export function getConnectionStatus(provider: AIModelProvider): ConnectionStatus {
  return connectionManager.getConnectionStatus(toProvider(provider));
}

// 获取所有连接状态
export function getAllConnectionStatuses(): Record<AIModelProvider, ConnectionStatus> {
  return connectionManager.getAllConnectionStatuses() as any as Record<AIModelProvider, ConnectionStatus>;
}

// 增强的API请求方法，带重试、超时控制和熔断概念
export async function requestWithRetry<T>(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3,
  retryDelay: number = 1000,
  timeoutMs: number = 30000 // 默认 30s 超时
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // 简单熔断：如果是 429 或 5xx 错误，触发退避
        if (response.status === 429) {
          console.warn('API 限流 (429)，触发熔断退避...');
        }
        
        let errorMessage = `API Error: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          // 忽略 JSON 解析错误
        }
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('any error');
      
      // 记录错误日志
      console.error(`API请求失败 (尝试 ${attempt + 1}/${maxRetries + 1}):`, lastError.message);
      
      // 如果不是最后一次尝试，等待后重试
      if (attempt < maxRetries) {
        const delay = retryDelay * Math.pow(2, attempt); // 指数退避
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('API请求失败');
}

// 增强的连接测试
export async function testConnection(
  provider: AIModelProvider,
  _apiKey: string | { access_key: string; secret_key: string } | { ak: string; sk: string }
): Promise<{ success: boolean; error?: string; responseTime?: number }> {
  // 更新状态为测试中
  connectionManager.updateConnectionStatus(toProvider(provider), { status: 'testing' });
  
  try {
    const startTime = Date.now();
    const ok = await backendProxyAdapter.testConnection();
    const responseTime = Date.now() - startTime;
    
    if (ok) {
      connectionManager.updateConnectionStatus(toProvider(provider), {
        status: 'connected',
        responseTime,
        error: undefined
      });
      return { success: true, responseTime };
    } else {
      const error = '后端代理连接失败';
      connectionManager.updateConnectionStatus(toProvider(provider), {
        status: 'error',
        error,
        responseTime
      });
      return { success: false, error, responseTime };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '连接测试失败';
    connectionManager.updateConnectionStatus(toProvider(provider), {
      status: 'error',
      error: errorMessage
    });
    return {
      success: false,
      error: errorMessage
    };
  }
}

// 批量测试所有配置的提供商
export async function testAllConnections(apiKeys: APIKeys): Promise<Record<AIModelProvider, { success: boolean; error?: string; responseTime?: number }>> {
  const results: Record<AIModelProvider, { success: boolean; error?: string; responseTime?: number }> = {} as any;
  
  const testPromises = Object.entries(apiKeys).map(async ([provider, config]) => {
    try {
      const result = await testConnection(provider as AIModelProvider, config as any);
      results[provider as AIModelProvider] = result;
    } catch (error) {
      results[provider as AIModelProvider] = {
        success: false,
        error: error instanceof Error ? error.message : '测试失败'
      };
    }
  });
  
  await Promise.allSettled(testPromises);
  return results;
}



// 增强的视频生成，带连接状态监控
export async function generateVideo(
  params: VideoGenerationParams,
  _apiKeys: APIKeys,
  onProgress?: (progress: number) => void
): Promise<GenerationResult> {
  try {
    connectionManager.updateConnectionStatus(toProvider(params.modelProvider), { status: 'connected' });
    const result = await backendProxyAdapter.generateVideo(params);
    
    if (result.status === 'failed') {
      connectionManager.updateConnectionStatus(toProvider(params.modelProvider), {
        status: 'error',
        error: result.error
      });
      return result;
    }

    if (!result.taskId || result.status === 'completed') {
      connectionManager.updateConnectionStatus(toProvider(params.modelProvider), { status: 'connected' });
      return result;
    }

    const finalResult = await backendProxyAdapter.pollTaskStatus(result.taskId, onProgress);
    
    if (finalResult.status === 'completed') {
      connectionManager.updateConnectionStatus(toProvider(params.modelProvider), { status: 'connected' });
    } else if (finalResult.status === 'failed') {
      connectionManager.updateConnectionStatus(toProvider(params.modelProvider), {
        status: 'error',
        error: finalResult.error
      });
    }
    
    return finalResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'any error';
    connectionManager.updateConnectionStatus(toProvider(params.modelProvider), {
      status: 'error',
      error: errorMessage
    });
    return {
      taskId: '',
      status: 'failed',
      error: errorMessage,
    };
  }
}

// 增强的图片生成，带连接状态监控
export async function generateImage(
  params: ImageGenerationParams,
  _apiKeys: APIKeys,
  onProgress?: (progress: number) => void
): Promise<GenerationResult> {
  try {
    connectionManager.updateConnectionStatus(toProvider(params.modelProvider), { status: 'connected' });
    const result = await backendProxyAdapter.generateImage(params);
    
    if (result.status === 'failed') {
      connectionManager.updateConnectionStatus(toProvider(params.modelProvider), {
        status: 'error',
        error: result.error
      });
      return result;
    }

    // 如果是同步完成（已有结果URL），直接返回
    if (result.status === 'completed') {
      connectionManager.updateConnectionStatus(toProvider(params.modelProvider), { status: 'connected' });
      return result;
    }

    if (result.taskId) {
      const finalResult = await backendProxyAdapter.pollTaskStatus(result.taskId, onProgress);
      
      if (finalResult.status === 'completed') {
        connectionManager.updateConnectionStatus(toProvider(params.modelProvider), { status: 'connected' });
      } else if (finalResult.status === 'failed') {
        connectionManager.updateConnectionStatus(toProvider(params.modelProvider), {
          status: 'error',
          error: finalResult.error
        });
      }
      
      return finalResult;
    }
    
    // 如果没有taskId或不支持轮询，返回pending状态
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'any error';
    connectionManager.updateConnectionStatus(toProvider(params.modelProvider), {
      status: 'error',
      error: errorMessage
    });
    return {
      taskId: '',
      status: 'failed',
      error: errorMessage,
    };
  }
}

// 增强的音频生成，带连接状态监控
export async function generateAudio(
  params: AudioGenerationParams,
  _apiKeys: APIKeys,
  _onProgress?: (progress: number) => void
): Promise<GenerationResult> {
  const provider = params.modelProvider;

  try {
    connectionManager.updateConnectionStatus(toProvider(provider), { status: 'connected' });
    const result = await backendProxyAdapter.generateAudio(params);
    connectionManager.updateConnectionStatus(toProvider(provider), {
      status: result.status === 'failed' ? 'error' : 'connected',
      error: result.error,
    });
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'any error';
    connectionManager.updateConnectionStatus(toProvider(provider), {
      status: 'error',
      error: errorMessage
    });
    return {
      taskId: '',
      status: 'failed',
      error: errorMessage,
    };
  }
}
