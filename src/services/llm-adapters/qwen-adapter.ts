import { BaseLLMAdapter, LLMConfig, LLMCompletionParams, LLMCompletionResponse, LLMModelInfo } from './base-llm-adapter';

const QWEN_MODELS: LLMModelInfo[] = [
  {
    id: 'qwen-max',
    name: '通义千问 Max',
    provider: 'aliyun',
    description: '阿里云最强大的通义千问模型',
    maxTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
  },
  {
    id: 'qwen-plus',
    name: '通义千问 Plus',
    provider: 'aliyun',
    description: '高性能通义千问模型',
    maxTokens: 131072,
    supportsStreaming: true,
    supportsVision: false,
  },
  {
    id: 'qwen-turbo',
    name: '通义千问 Turbo',
    provider: 'aliyun',
    description: '快速响应的通义千问模型',
    maxTokens: 131072,
    supportsStreaming: true,
    supportsVision: false,
  },
  {
    id: 'qwen-long',
    name: '通义千问 Long',
    provider: 'aliyun',
    description: '超长上下文通义千问模型',
    maxTokens: 1048576,
    supportsStreaming: true,
    supportsVision: false,
  },
  {
    id: 'qwen-vl-plus',
    name: '通义千问 VL Plus',
    provider: 'aliyun',
    description: '支持视觉的多模态模型',
    maxTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: 'qwen-vl-max',
    name: '通义千问 VL Max',
    provider: 'aliyun',
    description: '最强大的视觉语言模型',
    maxTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
  },
];

export class QwenAdapter extends BaseLLMAdapter {
  constructor(config: LLMConfig) {
    super(config, 'aliyun');
  }

  getProviderName(): string {
    return '阿里通义千问';
  }

  getModels(): LLMModelInfo[] {
    return QWEN_MODELS;
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
        `${this.config.baseUrl || '/llm-proxy/qwen'}/api/v1/services/aigments/text-generation/generation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: 'qwen-turbo',
            input: {
              messages: [{ role: 'user', content: 'test' }],
            },
            parameters: {
              max_tokens: 10,
            },
          }),
        }
      );

      const latency = Date.now() - startTime;

      if (response.ok || response.status === 400) {
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
      `${this.config.baseUrl || '/llm-proxy/qwen'}/api/v1/services/aigments/text-generation/generation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: params.model || 'qwen-plus',
          input: {
            messages: params.messages,
          },
          parameters: {
            temperature: params.temperature ?? this.config.temperature ?? 0.7,
            top_p: params.topP ?? this.config.topP ?? 0.8,
            max_tokens: params.maxTokens ?? this.config.maxTokens ?? 2048,
            result_format: 'message',
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || '请求失败');
    }

    const data = await response.json();

    return {
      id: `qwen-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: params.model || 'qwen-plus',
      choices: [
        {
          index: 0,
          message: {
            role: data.output?.choices?.[0]?.message?.role || 'assistant',
            content: data.output?.choices?.[0]?.message?.content || data.output?.text || '',
          },
          finish_reason: data.output?.choices?.[0]?.finish_reason || 'stop',
        },
      ],
    };
  }

  async completeStream(
    params: LLMCompletionParams,
    onChunk: (chunk: any) => void
  ): Promise<void> {
    const response = await fetch(
      `${this.config.baseUrl || '/llm-proxy/qwen'}/api/v1/services/aigments/text-generation/generation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: params.model || 'qwen-plus',
          input: {
            messages: params.messages,
          },
          parameters: {
            temperature: params.temperature ?? this.config.temperature ?? 0.7,
            top_p: params.topP ?? this.config.topP ?? 0.8,
            max_tokens: params.maxTokens ?? this.config.maxTokens ?? 2048,
            result_format: 'message',
            incremental_output: true,
          },
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
        if (line.trim()) {
          try {
            const chunk = JSON.parse(line);
            if (chunk.output?.choices?.[0]?.message?.content) {
              onChunk({
                id: `qwen-${Date.now()}`,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: params.model || 'qwen-plus',
                choices: [
                  {
                    index: 0,
                    delta: {
                      content: chunk.output.choices[0].message.content,
                    },
                  },
                ],
              });
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  }
}
