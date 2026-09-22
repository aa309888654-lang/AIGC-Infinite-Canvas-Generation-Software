import { BaseLLMAdapter, LLMConfig, LLMCompletionParams, LLMCompletionResponse, LLMModelInfo } from './base-llm-adapter';

const BAIDU_MODELS: LLMModelInfo[] = [
  {
    id: 'ernie-4.0-8k-latest',
    name: '文心一言 4.0',
    provider: 'baidu',
    description: '百度最新最强大的大语言模型',
    maxTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
  },
  {
    id: 'ernie-3.5-8k-preview',
    name: '文心一言 3.5',
    provider: 'baidu',
    description: '百度高性能大语言模型',
    maxTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
  },
  {
    id: 'ernie-speed-128k',
    name: '文心一言 速度版',
    provider: 'baidu',
    description: '高速响应的大语言模型',
    maxTokens: 128000,
    supportsStreaming: true,
    supportsVision: false,
  },
  {
    id: 'ernie-lite-8k',
    name: '文心一言 轻量版',
    provider: 'baidu',
    description: '轻量级高性价比模型',
    maxTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
  },
];

export class BaiduAdapter extends BaseLLMAdapter {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: LLMConfig) {
    super(config, 'baidu');
  }

  getProviderName(): string {
    return '百度文心一言';
  }

  getModels(): LLMModelInfo[] {
    return BAIDU_MODELS;
  }

  validateConfig(): { valid: boolean; error?: string } {
    if (!this.config.accessKey) {
      return { valid: false, error: 'API Key不能为空' };
    }
    if (!this.config.secretKey) {
      return { valid: false, error: 'Secret Key不能为空' };
    }
    return { valid: true };
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const tokenUrl = `${this.config.baseUrl || '/llm-proxy/baidu'}/oauth/2.0/token`;
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.accessKey!,
      client_secret: this.config.secretKey!,
    });

    const response = await fetch(`${tokenUrl}?${params}`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('获取Access Token失败');
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;

    return this.accessToken;
  }

  async testConnection(): Promise<{ success: boolean; error?: string; latency?: number }> {
    const startTime = Date.now();
    try {
      await this.getAccessToken();
      const latency = Date.now() - startTime;
      return { success: true, latency };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '连接测试失败',
      };
    }
  }

  async complete(params: LLMCompletionParams): Promise<LLMCompletionResponse> {

    const response = await fetch(
      `${this.config.baseUrl || '/llm-proxy/baidu'}/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/${params.model || 'ernie-3.5-8k-preview'}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: params.messages,
          temperature: params.temperature ?? this.config.temperature ?? 0.7,
          top_p: params.topP ?? this.config.topP ?? 0.8,
          stream: false,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_msg || '请求失败');
    }

    const data = await response.json();

    return {
      id: `baidu-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: params.model || 'ernie-3.5-8k-preview',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: data.result,
          },
          finish_reason: 'stop',
        },
      ],
    };
  }

  async completeStream(
    params: LLMCompletionParams,
    onChunk: (chunk: any) => void
  ): Promise<void> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(
      `${this.config.baseUrl || '/llm-proxy/baidu'}/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/${params.model || 'ernie-3.5-8k-preview'}?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: params.messages,
          temperature: params.temperature ?? this.config.temperature ?? 0.7,
          top_p: params.topP ?? this.config.topP ?? 0.8,
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_msg || '请求失败');
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
            if (chunk.result) {
              onChunk({
                id: `baidu-${Date.now()}`,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: params.model || 'ernie-3.5-8k-preview',
                choices: [
                  {
                    index: 0,
                    delta: {
                      content: chunk.result,
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
