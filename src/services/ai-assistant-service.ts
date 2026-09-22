// @ts-nocheck
import { LLMMessage, LLMToolDefinition } from './llm-adapters';
import { API_BASE_URL } from '@/lib/api-config';
import { getAuthToken } from '@/lib/auth-check';
import { purgeBrowserApiSecrets } from './api-config-security';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date | string;
}

export interface AIAssistantOptions {
  modelId?: string;
  provider?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  tools?: LLMToolDefinition[];
  toolChoice?: 'auto' | 'none';
  enablePromptCaching?: boolean;
}

interface MiniMaxResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: { content?: string };
    messages?: Array<{ content?: string }>;
    delta?: { content?: string };
  }>;
  base_resp?: {
    status_code: number;
    status_msg: string;
  };
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const DEFAULT_MINIMAX_MODEL = 'MiniMax-M2.7-highspeed';
const ASSISTANT_PREFERENCES_STORAGE_KEY = 'ai-assistant-preferences';

function isM2Model(model: string): boolean {
  return /^MiniMax-M2(?:\.5|\.7)(?:-highspeed)?$/i.test(model);
}

function resolveRequestOptions(model: string, options: AIAssistantOptions): {
  temperature: number;
  maxTokens: number;
  topP: number;
} {
  if (/MiniMax-M2\.5/i.test(model)) {
    return {
      temperature: options.temperature ?? 0.1,
      maxTokens: options.maxTokens ?? 8192,
      topP: 0.9,
    };
  }

  if (/MiniMax-M2\.7/i.test(model)) {
    return {
      temperature: options.temperature ?? 0.3,
      maxTokens: options.maxTokens ?? 16384,
      topP: 0.9,
    };
  }

  return {
    temperature: options.temperature ?? 0.7,
    maxTokens: options.maxTokens ?? 2048,
    topP: 0.95,
  };
}

class AIAssistantService {
  private static instance: AIAssistantService;
  private defaultModel: string = DEFAULT_MINIMAX_MODEL;

  private constructor() {
    purgeBrowserApiSecrets();
    this.loadConfig();
  }

  public static getInstance(): AIAssistantService {
    if (!AIAssistantService.instance) {
      AIAssistantService.instance = new AIAssistantService();
    }
    return AIAssistantService.instance;
  }

  private loadConfig(): void {
    try {
      const stored = localStorage.getItem(ASSISTANT_PREFERENCES_STORAGE_KEY);
      if (stored) {
        const config = JSON.parse(stored);
        this.defaultModel = config.model || DEFAULT_MINIMAX_MODEL;
      }
    } catch (error) {
      console.error('[AIAssistantService] 加载配置失败:', error);
    }
  }

  /**
   * 仅保留非敏感模型偏好。历史调用传入的 API Key 会被主动忽略，
   * 所有模型通信与密钥管理均由后端完成。
   */
  public setConfig(_legacyApiKey = '', _baseUrl?: string, model?: string): void {
    if (model) this.defaultModel = model;

    localStorage.setItem(ASSISTANT_PREFERENCES_STORAGE_KEY, JSON.stringify({
      model: this.defaultModel,
    }));
  }

  public hasValidConfig(): boolean {
    // 修复 T-3：增加对实际可用 provider 的检查，避免后端不可用时仍返回 true
    return !!API_BASE_URL && _providerAvailable;
  }

  public async sendMessage(
    messages: Message[],
    options: AIAssistantOptions = {},
    onStreamChunk?: (chunk: string) => void
  ): Promise<string> {
    this.loadConfig();

    const model = options.modelId || this.defaultModel;
    const systemPrompt = options.systemPrompt || `你是一个专业的AI视频创作助手。

你可以分析用户需求、推荐工作流、优化提示词、解答问题。`;

    const formattedMessages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
    ];

    if (onStreamChunk) {
      return this.streamRequest(formattedMessages, model, options, onStreamChunk);
    } else {
      return this.normalRequest(formattedMessages, model, options);
    }
  }

  private async normalRequest(
    messages: LLMMessage[],
    model: string,
    options: AIAssistantOptions
  ): Promise<string> {
    const proxyResult = await this.tryProxyRequest(messages, model, options);
    if (proxyResult !== null) return proxyResult;
    throw new Error('AI 服务不可用：后端代理未响应或后端未配置模型 API');
  }

  private async streamRequest(
    messages: LLMMessage[],
    model: string,
    options: AIAssistantOptions,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const proxyResult = await this.tryProxyStreamRequest(messages, model, options, onChunk);
    if (proxyResult !== null) return proxyResult;
    throw new Error('AI 服务不可用：后端代理未响应或后端未配置模型 API');
  }

  /**
   * 尝试通过后端代理发送请求（非流式）
   * 返回 null 表示代理不可用，由调用方直接报错。
   */
  private async tryProxyRequest(
    messages: LLMMessage[],
    model: string,
    options: AIAssistantOptions
  ): Promise<string | null> {
    try {
      const provider = options.provider || 'minimax';
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages,
          model,
          temperature: resolveRequestOptions(model, options).temperature,
          maxTokens: resolveRequestOptions(model, options).maxTokens,
          stream: false,
          provider,
          tools: options.tools,
          toolChoice: options.toolChoice,
          enablePromptCaching: options.enablePromptCaching,
        }),
      });

      if (!response.ok) {
        // 修复 T-3：后端 503 表示 provider 不可用，标记并快速失败
        if (response.status === 503) _providerAvailable = false;
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || `后端 AI 请求失败: ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.content) {
        // 修复 T-3：成功调用后标记 provider 可用
        _providerAvailable = true;
        return data.content;
      }
      throw new Error(data.error || '后端 AI 响应为空');
    } catch (err) {
      // 修复 T-5：保留原始错误信息向上抛出，而非吞掉错误返回 null
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[ai-assistant-service] 请求失败:', message);
      throw new Error(message);
    }
  }

  /**
   * 尝试通过后端代理发送流式请求
   * 返回 null 表示代理不可用，由调用方直接报错。
   */
  private async tryProxyStreamRequest(
    messages: LLMMessage[],
    model: string,
    options: AIAssistantOptions,
    onChunk: (chunk: string) => void
  ): Promise<string | null> {
    try {
      const provider = options.provider || 'minimax';
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages,
          model,
          temperature: resolveRequestOptions(model, options).temperature,
          maxTokens: resolveRequestOptions(model, options).maxTokens,
          stream: true,
          provider,
          tools: options.tools,
          toolChoice: options.toolChoice,
          enablePromptCaching: options.enablePromptCaching,
        }),
      });

      if (!response.ok) {
        // 修复 T-3：后端 503 表示 provider 不可用，标记并快速失败
        if (response.status === 503) _providerAvailable = false;
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || `后端 AI 流式请求失败: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) return null;

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) { // eslint-disable-line no-constant-condition
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return fullContent;
            try {
              const parsed: MiniMaxResponse = JSON.parse(data);
              if (parsed.choices && parsed.choices[0]?.delta?.content) {
                const content = parsed.choices[0].delta.content;
                fullContent += content;
                onChunk(content);
              }
            } catch {
              // 忽略单行 SSE 解析错误，不影响整体流
            }
          }
        }
      }

      // 修复 T-3：成功调用后标记 provider 可用
      _providerAvailable = true;
      return fullContent;
    } catch (err) {
      // 修复 T-5：保留原始错误信息向上抛出，而非吞掉错误返回 null
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[ai-assistant-service] 流式请求失败:', message);
      throw new Error(message);
    }
  }

  public async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/ai/providers`, {
        method: 'GET',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) return { success: false, error: `后端连接失败: ${response.status}` };
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '连接测试失败' 
      };
    }
  }
}

export const aiAssistantService = AIAssistantService.getInstance();
