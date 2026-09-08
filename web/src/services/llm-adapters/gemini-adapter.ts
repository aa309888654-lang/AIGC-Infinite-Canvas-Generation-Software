import { BaseLLMAdapter, LLMConfig, LLMCompletionParams, LLMCompletionResponse, LLMModelInfo } from './base-llm-adapter';

const GEMINI_MODELS: LLMModelInfo[] = [
  {
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    description: '最新最快的Gemini模型',
    maxTokens: 1000000,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: 'gemini-1.5-pro-latest',
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    description: '最适合复杂任务的Gemini模型',
    maxTokens: 1000000,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: 'gemini-1.5-flash-latest',
    name: 'Gemini 1.5 Flash',
    provider: 'google',
    description: '快速且多功能的模型',
    maxTokens: 1000000,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: 'gemini-1.5-flash-8b',
    name: 'Gemini 1.5 Flash 8B',
    provider: 'google',
    description: '轻量级快速模型',
    maxTokens: 1000000,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    provider: 'google',
    description: 'Google AI Pro模型',
    maxTokens: 32768,
    supportsStreaming: true,
    supportsVision: true,
  },
];

export class GeminiAdapter extends BaseLLMAdapter {
  constructor(config: LLMConfig) {
    super(config, 'google');
  }

  getProviderName(): string {
    return 'Google Gemini';
  }

  getModels(): LLMModelInfo[] {
    return GEMINI_MODELS;
  }

  validateConfig(): { valid: boolean; error?: string } {
    if (!this.config.apiKey) {
      return { valid: false, error: 'API密钥不能为空' };
    }
    return { valid: true };
  }

  async testConnection(): Promise<{ success: boolean; error?: string; latency?: number }> {
    const startTime = Date.now();
    try {
      const response = await fetch(
        `${this.config.baseUrl || '/llm-proxy/gemini'}/v1beta/models`,
        {
          method: 'GET',
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

    const contents = otherMessages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const generationConfig: Record<string, any> = {
      temperature: params.temperature ?? this.config.temperature ?? 0.7,
      topP: params.topP ?? this.config.topP ?? 0.95,
    };

    if (params.maxTokens) {
      generationConfig.maxOutputTokens = params.maxTokens;
    }

    const response = await fetch(
      `${this.config.baseUrl || '/llm-proxy/gemini'}/v1beta/models/${params.model || 'gemini-1.5-flash-latest'}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          systemInstruction: systemMessage
            ? { parts: [{ text: systemMessage.content }] }
            : undefined,
          generationConfig,
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || '请求失败');
    }

    const data = await response.json();

    return {
      id: `gemini-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: params.model || 'gemini-1.5-flash-latest',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
          },
          finish_reason: data.candidates?.[0]?.finishReason || 'stop',
        },
      ],
    };
  }

  async completeStream(
    params: LLMCompletionParams,
    onChunk: (chunk: any) => void
  ): Promise<void> {
    const systemMessage = params.messages.find((m) => m.role === 'system');
    const otherMessages = params.messages.filter((m) => m.role !== 'system');

    const contents = otherMessages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const generationConfig: Record<string, any> = {
      temperature: params.temperature ?? this.config.temperature ?? 0.7,
      topP: params.topP ?? this.config.topP ?? 0.95,
    };

    if (params.maxTokens) {
      generationConfig.maxOutputTokens = params.maxTokens;
    }

    const response = await fetch(
      `${this.config.baseUrl || '/llm-proxy/gemini'}/v1beta/models/${params.model || 'gemini-1.5-flash-latest'}:streamGenerateContent?alt=sse`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          systemInstruction: systemMessage
            ? { parts: [{ text: systemMessage.content }] }
            : undefined,
          generationConfig,
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
            if (chunk.candidates?.[0]?.content?.parts?.[0]?.text) {
              onChunk({
                id: `gemini-${Date.now()}`,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: params.model || 'gemini-1.5-flash-latest',
                choices: [
                  {
                    index: 0,
                    delta: {
                      content: chunk.candidates[0].content.parts[0].text,
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
