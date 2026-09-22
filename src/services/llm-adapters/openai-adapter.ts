import { BaseLLMAdapter, LLMConfig, LLMCompletionParams, LLMCompletionResponse, LLMModelInfo } from './base-llm-adapter';

const OPENAI_MODELS: LLMModelInfo[] = [
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    description: '兼容模型接入，支持128K上下文',
    maxTokens: 128000,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: 'openai',
    description: '兼容模型接入，支持视觉',
    maxTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: '兼容模型接入，速度更快',
    maxTokens: 128000,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: '兼容模型接入，性价比高',
    maxTokens: 128000,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    description: '兼容模型接入，响应快速',
    maxTokens: 16385,
    supportsStreaming: true,
    supportsVision: false,
  },
];

export class OpenAIAdapter extends BaseLLMAdapter {
  constructor(config: LLMConfig) {
    super(config, 'openai');
  }

  getProviderName(): string {
    return '第三方GPT';
  }

  getModels(): LLMModelInfo[] {
    return OPENAI_MODELS;
  }

  validateConfig(): { valid: boolean; error?: string } {
    if (!this.config.apiKey) {
      return { valid: false, error: 'API密钥不能为空' };
    }
    if (!this.config.apiKey.startsWith('sk-')) {
      return { valid: false, error: 'API密钥格式不正确，应以sk-开头' };
    }
    return { valid: true };
  }

  async testConnection(): Promise<{ success: boolean; error?: string; latency?: number }> {
    const startTime = Date.now();
    try {
      const response = await fetch(
        `${this.config.baseUrl || '/llm-proxy/openai'}/v1/models`,
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
          },
        }
      );

      const latency = Date.now() - startTime;

      if (response.ok) {
        return { success: true, latency };
      } else {
        const error = await response.json();
        return { success: false, error: error.error?.message || '连接失败', latency };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '连接测试失败',
      };
    }
  }

  async complete(params: LLMCompletionParams): Promise<LLMCompletionResponse> {
    const response = await fetch(
      `${this.config.baseUrl || '/llm-proxy/openai'}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: params.model || 'gpt-4',
          messages: params.messages,
          temperature: params.temperature ?? this.config.temperature ?? 0.7,
          max_tokens: params.maxTokens ?? this.config.maxTokens ?? 2048,
          top_p: params.topP ?? this.config.topP ?? 1,
          stream: false,
          stop: params.stop,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || '请求失败');
    }

    return response.json();
  }

  async completeStream(
    params: LLMCompletionParams,
    onChunk: (chunk: any) => void
  ): Promise<void> {
    const response = await fetch(
      `${this.config.baseUrl || '/llm-proxy/openai'}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: params.model || 'gpt-4',
          messages: params.messages,
          temperature: params.temperature ?? this.config.temperature ?? 0.7,
          max_tokens: params.maxTokens ?? this.config.maxTokens ?? 2048,
          top_p: params.topP ?? this.config.topP ?? 1,
          stream: true,
          stop: params.stop,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || '请求失败');
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法读取响应流');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            return;
          }
          try {
            const chunk = JSON.parse(data);
            onChunk(chunk);
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  }
}
