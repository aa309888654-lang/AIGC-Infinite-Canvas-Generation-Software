// @ts-nocheck
import {
  BaseLLMAdapter,
  LLMConfig,
  LLMCompletionParams,
  LLMCompletionResponse,
  LLMModelInfo,
  LLMToolCall,
} from './base-llm-adapter';

const MINIMAX_MODELS: LLMModelInfo[] = [
  {
    id: 'MiniMax-M2.7-highspeed',
    name: 'MiniMax M2.7 Highspeed',
    provider: 'minimax',
    description: '高速旗舰模型，100 tps输出速度，适合实时交互、IDE代码补全、Agent循环，支持函数调用/思考模式/提示词缓存/JSON模式',
    maxTokens: 16384,
    contextWindow: 204800,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    supportsPromptCaching: true,
    supportsThinking: true,
    supportsJsonMode: true,
    supportsSeed: true,
    recommendedTemperature: 0.3,
    recommendedMaxTokens: 16384,
  },
  {
    id: 'MiniMax-M2.7',
    name: 'MiniMax M2.7',
    provider: 'minimax',
    description: '标准旗舰模型，230B总参/10B激活MoE架构，SWE-bench 78%，适合高复杂度推理/工程/长文档分析，支持函数调用/思考模式/提示词缓存/JSON模式',
    maxTokens: 16384,
    contextWindow: 204800,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    supportsPromptCaching: true,
    supportsThinking: true,
    supportsJsonMode: true,
    supportsSeed: true,
    recommendedTemperature: 0.3,
    recommendedMaxTokens: 16384,
  },
  {
    id: 'MiniMax-M2.5-highspeed',
    name: 'MiniMax M2.5 Highspeed',
    provider: 'minimax',
    description: '高速代码强化模型，偏代码与结构化生成，适合提示词优化/函数调用/工作流编排，支持函数调用与提示词缓存',
    maxTokens: 8192,
    contextWindow: 204800,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    supportsPromptCaching: true,
    supportsThinking: false,
    supportsJsonMode: true,
    supportsSeed: true,
    recommendedTemperature: 0.1,
    recommendedMaxTokens: 8192,
  },
  {
    id: 'MiniMax-M2.5',
    name: 'MiniMax M2.5',
    provider: 'minimax',
    description: '标准代码强化模型，适合稳定的工程生成任务，支持函数调用与提示词缓存',
    maxTokens: 8192,
    contextWindow: 204800,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: true,
    supportsPromptCaching: true,
    supportsThinking: false,
    supportsJsonMode: true,
    supportsSeed: true,
    recommendedTemperature: 0.1,
    recommendedMaxTokens: 8192,
  },
  {
    id: 'MiniMax-Text-01',
    name: 'MiniMax Text-01',
    provider: 'minimax',
    description: '旧版文本模型，保留兼容',
    maxTokens: 4096,
    contextWindow: 32768,
    supportsStreaming: true,
    supportsVision: false,
    supportsToolCalling: false,
    supportsPromptCaching: false,
    supportsThinking: false,
    supportsJsonMode: false,
    supportsSeed: false,
    recommendedTemperature: 0.7,
    recommendedMaxTokens: 2048,
  },
];

interface MiniMaxOpenAIResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: { content?: string };
    delta?: { content?: string };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// 所有环境统一走后端代理，不暴露外部API地址
const DEFAULT_MINIMAX_CHAT_BASE_URL = '/llm-proxy/minimax-chat';
const DEFAULT_MINIMAX_MEDIA_BASE_URL = '/minimax-api';
const DEFAULT_MINIMAX_MODEL = 'MiniMax-M2.7-highspeed';

function normalizeBaseUrl(baseUrl?: string): string {
  return (baseUrl || DEFAULT_MINIMAX_CHAT_BASE_URL).replace(/\/+$/, '');
}

function isM2Model(model: string): boolean {
  return /^MiniMax-M2(?:\.5|\.7)(?:-highspeed)?$/i.test(model);
}

function isM27Model(model: string): boolean {
  return /^MiniMax-M2\.7(?:-highspeed)?$/i.test(model);
}

function buildLegacyUrl(baseUrl?: string): string {
  const normalized = normalizeBaseUrl(baseUrl);
  return normalized.endsWith('/v1/text/chatcompletion_v2')
    ? normalized
    : normalized.endsWith('/v1')
    ? `${normalized}/text/chatcompletion_v2`
    : `${normalized}/v1/text/chatcompletion_v2`;
}

function buildOpenAICompatibleUrl(baseUrl?: string): string {
  const normalized = normalizeBaseUrl(baseUrl);
  return normalized.endsWith('/v1/chat/completions')
    ? normalized
    : normalized.endsWith('/v1')
    ? `${normalized}/chat/completions`
    : `${normalized}/v1/chat/completions`;
}

function resolveMiniMaxDefaults(model: string, config: LLMConfig, params: LLMCompletionParams): {
  temperature: number;
  maxTokens: number;
  topP: number;
} {
  if (/MiniMax-M2\.7/i.test(model)) {
    return {
      temperature: params.temperature ?? config.temperature ?? 0.3,
      maxTokens: params.maxTokens ?? config.maxTokens ?? 16384,
      topP: params.topP ?? config.topP ?? 0.9,
    };
  }

  if (/MiniMax-M2\.5/i.test(model)) {
    return {
      temperature: params.temperature ?? config.temperature ?? 0.1,
      maxTokens: params.maxTokens ?? config.maxTokens ?? 8192,
      topP: params.topP ?? config.topP ?? 0.9,
    };
  }

  return {
    temperature: params.temperature ?? config.temperature ?? 0.7,
    maxTokens: params.maxTokens ?? config.maxTokens ?? 2048,
    topP: params.topP ?? config.topP ?? 0.95,
  };
}

interface MiniMaxToolCallResponse extends MiniMaxOpenAIResponse {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_cache_hit_tokens?: number;
    prompt_cache_miss_tokens?: number;
    completion_tokens_details?: {
      reasoning_tokens?: number;
    };
  };
}

function extractToolCalls(data: MiniMaxToolCallResponse): LLMToolCall[] {
  const toolCalls = data.choices?.[0]?.message?.tool_calls;
  if (!toolCalls) return [];
  return toolCalls.map((tc) => ({
    id: tc.id || `call_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    type: 'function',
    function: {
      name: tc.function?.name || '',
      arguments: tc.function?.arguments || '{}',
    },
  }));
}

function extractFinishReason(data: MiniMaxToolCallResponse): string {
  return data.choices?.[0]?.finish_reason || 'stop';
}

function buildRequestBody(
  model: string,
  messages: LLMCompletionParams['messages'],
  optimized: { temperature: number; maxTokens: number; topP: number },
  useOpenAICompatibleApi: boolean,
  params: LLMCompletionParams
): Record<string, any> {
  const mappedMessages = messages.map((msg) => {
    const mapped: Record<string, any> = { role: msg.role, content: msg.content };
    if (msg.cache_control) {
      mapped.cache_control = msg.cache_control;
    }
    return mapped;
  });

  const baseBody: Record<string, any> = {
    model,
    messages: mappedMessages,
    temperature: optimized.temperature,
    max_tokens: optimized.maxTokens,
    top_p: optimized.topP,
    stream: false,
  };

  if (useOpenAICompatibleApi) {
    if (params.tools?.length) {
      baseBody.tools = params.tools;
    }
    if (params.toolChoice) {
      baseBody.tool_choice = params.toolChoice;
    }
    if (isM27Model(model)) {
      if (params.enableThinking !== false) {
        baseBody.thinking = params.thinkingConfig || {
          type: 'enabled',
          budget_tokens: Math.min(8192, Math.floor(optimized.maxTokens * 0.4)),
        };
      } else if (params.enableThinking === false) {
        baseBody.thinking = { type: 'disabled' };
      }
      if (params.responseFormat) {
        baseBody.response_format = params.responseFormat;
      }
      if (params.seed !== undefined) {
        baseBody.seed = params.seed;
      }
      if (params.enablePromptCaching) {
        baseBody.cache_config = params.cacheConfig || {
          type: 'summary',
          max_prefix_tokens: Math.min(8192, Math.floor(optimized.maxTokens * 0.5)),
          max_cache_tokens: Math.floor(optimized.maxTokens * 0.9),
        };
      }
    } else if (params.enablePromptCaching && isM2Model(model)) {
      baseBody.cache_config = params.cacheConfig || {
        type: 'summary',
        max_prefix_tokens: Math.min(4096, Math.floor(optimized.maxTokens * 0.5)),
        max_cache_tokens: Math.floor(optimized.maxTokens * 0.9),
      };
    }
  }

  return baseBody;
}

export class MiniMaxAdapter extends BaseLLMAdapter {
  constructor(config: LLMConfig) {
    super(config, 'minimax');
  }

  getProviderName(): string {
    return 'MiniMax';
  }

  getModels(): LLMModelInfo[] {
    return MINIMAX_MODELS;
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
      const baseUrl = this.config.baseUrl || DEFAULT_MINIMAX_CHAT_BASE_URL;
      const response = await fetch(
        `${baseUrl}/v1/models`,
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
    const model = params.model || this.config.model || DEFAULT_MINIMAX_MODEL;
    const optimized = resolveMiniMaxDefaults(model, this.config, params);
    const useOpenAICompatibleApi = isM2Model(model);
    const endpoint = useOpenAICompatibleApi
      ? buildOpenAICompatibleUrl(this.config.baseUrl)
      : buildLegacyUrl(this.config.baseUrl);

    const body = buildRequestBody(model, params.messages, optimized, useOpenAICompatibleApi, params);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `请求失败: ${response.status}`);
    }

    const data: MiniMaxToolCallResponse = await response.json();
    const toolCalls = extractToolCalls(data);
    const hasToolCalls = toolCalls.length > 0;
    const content = data.choices?.[0]?.message?.content ?? null;
    const reasoningContent = data.choices?.[0]?.message?.reasoning_content ?? undefined;

    return {
      id: data.id || `minimax-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: data.model || model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: hasToolCalls ? null : (content || ''),
            tool_calls: hasToolCalls ? toolCalls : undefined,
            reasoning_content: reasoningContent,
          },
          finish_reason: hasToolCalls ? 'tool_calls' : extractFinishReason(data),
        },
      ],
      usage: data.usage ? {
        prompt_tokens: data.usage.prompt_tokens,
        completion_tokens: data.usage.completion_tokens,
        total_tokens: data.usage.total_tokens,
        prompt_cache_hit_tokens: data.usage.prompt_cache_hit_tokens,
        prompt_cache_miss_tokens: data.usage.prompt_cache_miss_tokens,
        completion_tokens_details: data.usage.completion_tokens_details,
      } : undefined,
    };
  }

  async completeStream(
    params: LLMCompletionParams,
    onChunk: (chunk: any) => void
  ): Promise<void> {
    const model = params.model || this.config.model || DEFAULT_MINIMAX_MODEL;
    const optimized = resolveMiniMaxDefaults(model, this.config, params);
    const useOpenAICompatibleApi = isM2Model(model);
    const endpoint = useOpenAICompatibleApi
      ? buildOpenAICompatibleUrl(this.config.baseUrl)
      : buildLegacyUrl(this.config.baseUrl);

    const streamBody: Record<string, any> = {
      ...buildRequestBody(model, params.messages, optimized, useOpenAICompatibleApi, params),
      stream: true,
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(streamBody),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `请求失败: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法读取响应流');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let currentToolCallIndex = -1;
    let currentToolCallName = '';
    let currentToolCallArgs = '';
    let inToolCall = false;

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
            if (inToolCall && currentToolCallName) {
              onChunk({
                id: `minimax-stream-${Date.now()}`,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [
                  {
                    index: currentToolCallIndex,
                    delta: {
                      tool_calls: [
                        {
                          index: currentToolCallIndex,
                          id: `call_${Date.now()}`,
                          type: 'function',
                          function: { name: currentToolCallName, arguments: currentToolCallArgs },
                        },
                      ],
                    },
                    finish_reason: 'tool_calls',
                  },
                ],
              });
            }
            return;
          }
          try {
            const parsed: any = JSON.parse(data);
            const choice = parsed.choices?.[0];
            if (!choice) continue;

            const delta = choice.delta;
            if (!delta) continue;

            if (delta.reasoning_content) {
              onChunk({
                id: parsed.id || `minimax-stream-${Date.now()}`,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: parsed.model || model,
                choices: [
                  {
                    index: 0,
                    delta: {
                      reasoning_content: delta.reasoning_content,
                    },
                  },
                ],
              });
            }

            if (delta.tool_calls && delta.tool_calls.length > 0) {
              for (const tc of delta.tool_calls) {
                if (tc.index !== undefined) currentToolCallIndex = tc.index;
                if (tc.function?.name) {
                  inToolCall = true;
                  currentToolCallName = tc.function.name;
                  currentToolCallArgs = tc.function.arguments || '';
                } else if (tc.function?.arguments) {
                  currentToolCallArgs += tc.function.arguments;
                }

                onChunk({
                  id: parsed.id || `minimax-stream-${Date.now()}`,
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: parsed.model || model,
                  choices: [
                    {
                      index: tc.index ?? 0,
                      delta: {
                        tool_calls: [tc],
                      },
                    },
                  ],
                });
              }
            } else if (delta.content) {
              if (inToolCall) {
                inToolCall = false;
              }

              onChunk({
                id: parsed.id || `minimax-stream-${Date.now()}`,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: parsed.model || model,
                choices: [
                  {
                    index: 0,
                    delta: {
                      role: 'assistant',
                      content: delta.content,
                    },
                  },
                ],
              });
            }

            if (choice.finish_reason === 'tool_calls' && inToolCall) {
              onChunk({
                id: parsed.id || `minimax-stream-${Date.now()}`,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: parsed.model || model,
                choices: [
                  {
                    index: currentToolCallIndex,
                    delta: {},
                    finish_reason: 'tool_calls',
                  },
                ],
              });
              inToolCall = false;
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  }
}

export {
  DEFAULT_MINIMAX_CHAT_BASE_URL,
  DEFAULT_MINIMAX_MEDIA_BASE_URL,
  DEFAULT_MINIMAX_MODEL,
  isM2Model,
  isM27Model,
  normalizeBaseUrl,
  buildOpenAICompatibleUrl,
  buildLegacyUrl,
  resolveMiniMaxDefaults,
};
