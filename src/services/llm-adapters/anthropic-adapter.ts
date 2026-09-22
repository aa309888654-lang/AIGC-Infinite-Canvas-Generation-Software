import { BaseLLMAdapter, LLMConfig, LLMCompletionParams, LLMCompletionResponse, LLMModelInfo } from './base-llm-adapter';

const ANTHROPIC_MODELS: LLMModelInfo[] = [
  {
    id: 'claude-3-5-sonnet-latest',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    description: '高质量模型接入，速度与智能平衡',
    maxTokens: 200000,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: 'claude-3-opus-latest',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    description: '高质量模型接入，适合复杂推理',
    maxTokens: 200000,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: 'claude-3-sonnet-latest',
    name: 'Claude 3 Sonnet',
    provider: 'anthropic',
    description: '平衡性能和速度',
    maxTokens: 200000,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: 'claude-3-haiku-latest',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    description: '快速且经济实惠的模型',
    maxTokens: 200000,
    supportsStreaming: true,
    supportsVision: true,
  },
];

export class AnthropicAdapter extends BaseLLMAdapter {
  constructor(config: LLMConfig) {
    super(config, 'anthropic');
  }

  getProviderName(): string {
    return '第三方Claude';
  }

  getModels(): LLMModelInfo[] {
    return ANTHROPIC_MODELS;
  }

  validateConfig(): { valid: boolean; error?: string } {
    if (!this.config.apiKey) {
      return { valid: false, error: 'API密钥不能为空' };
    }
    if (!this.config.apiKey.startsWith('sk-ant-')) {
      return { valid: false, error: 'API密钥格式不正确，应以sk-ant-开头' };
    }
    return { valid: true };
  }

  async testConnection(): Promise<{ success: boolean; error?: string; latency?: number }> {
    const startTime = Date.now();
    try {
      const response = await fetch(
        `${this.config.baseUrl || '/llm-proxy/anthropic'}/v1/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey!,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-latest',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'test' }],
          }),
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
    const systemMessage = params.messages.find((m) => m.role === 'system');
    const otherMessages = params.messages.filter((m) => m.role !== 'system');

    const anthropicMessages = otherMessages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

    const response = await fetch(
      `${this.config.baseUrl || '/llm-proxy/anthropic'}/v1/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: params.model || 'claude-3-5-sonnet-latest',
          messages: anthropicMessages,
          system: systemMessage?.content,
          temperature: params.temperature ?? this.config.temperature ?? 0.7,
          max_tokens: params.maxTokens ?? this.config.maxTokens ?? 4096,
          top_p: params.topP ?? this.config.topP,
          stop_sequences: params.stop,
          stream: false,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || '请求失败');
    }

    const data = await response.json();

    return {
      id: `anthropic-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: params.model || 'claude-3-5-sonnet-latest',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: data.content[0].text,
          },
          finish_reason: data.stop_reason,
        },
      ],
      usage: {
        prompt_tokens: data.usage.input_tokens,
        completion_tokens: data.usage.output_tokens,
        total_tokens: data.usage.input_tokens + data.usage.output_tokens,
      },
    };
  }

  async completeStream(
    params: LLMCompletionParams,
    onChunk: (chunk: any) => void
  ): Promise<void> {
    const systemMessage = params.messages.find((m) => m.role === 'system');
    const otherMessages = params.messages.filter((m) => m.role !== 'system');

    const anthropicMessages = otherMessages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

    const response = await fetch(
      `${this.config.baseUrl || '/llm-proxy/anthropic'}/v1/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: params.model || 'claude-3-5-sonnet-latest',
          messages: anthropicMessages,
          system: systemMessage?.content,
          temperature: params.temperature ?? this.config.temperature ?? 0.7,
          max_tokens: params.maxTokens ?? this.config.maxTokens ?? 4096,
          top_p: params.topP ?? this.config.topP,
          stop_sequences: params.stop,
          stream: true,
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
          try {
            const chunk = JSON.parse(data);
            if (chunk.type === 'content_block_delta') {
              onChunk({
                id: `anthropic-${Date.now()}`,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: params.model || 'claude-3-5-sonnet-latest',
                choices: [
                  {
                    index: 0,
                    delta: {
                      content: chunk.delta.text,
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
