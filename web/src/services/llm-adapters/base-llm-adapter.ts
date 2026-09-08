export interface LLMConfig {
  apiKey?: string;
  accessKey?: string;
  secretKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  timeout?: number;
  supportsImageGeneration?: boolean;
  supportsVideoGeneration?: boolean;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  cache_control?: {
    type: 'ephemeral';
  };
  reasoning_content?: string;
}

export interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMToolDefinition {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface LLMToolChoice {
  type: 'function';
  function: {
    name: string;
  };
}

export interface LLMCompletionParams {
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  stop?: string[];
  tools?: LLMToolDefinition[];
  toolChoice?: 'auto' | 'none' | 'required' | LLMToolChoice;
  enablePromptCaching?: boolean;
  cacheConfig?: {
    type: 'summary';
    max_prefix_tokens?: number;
    max_cache_tokens?: number;
  };
  enableThinking?: boolean;
  thinkingConfig?: {
    type: 'enabled' | 'disabled';
    budget_tokens?: number;
  };
  responseFormat?: {
    type: 'json_object' | 'text';
  };
  seed?: number;
}

export interface LLMCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: LLMMessage & {
      tool_calls?: LLMToolCall[];
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | string;
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

export interface LLMStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: Partial<LLMMessage> & {
      tool_calls?: Array<Partial<LLMToolCall> & { index: number }>;
    };
    finish_reason?: string;
  }>;
}

export interface LLMModelInfo {
  id: string;
  name: string;
  provider: string;
  description: string;
  maxTokens: number;
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsToolCalling?: boolean;
  supportsPromptCaching?: boolean;
  supportsThinking?: boolean;
  supportsJsonMode?: boolean;
  supportsSeed?: boolean;
  recommendedTemperature?: number;
  recommendedMaxTokens?: number;
  contextWindow?: number;
}

export abstract class BaseLLMAdapter {
  protected config: LLMConfig;
  protected provider: string;

  constructor(config: LLMConfig, provider: string) {
    this.config = config;
    this.provider = provider;
  }

  abstract getProviderName(): string;

  abstract getModels(): LLMModelInfo[];

  abstract validateConfig(): { valid: boolean; error?: string };

  abstract testConnection(): Promise<{ success: boolean; error?: string; latency?: number }>;

  abstract complete(params: LLMCompletionParams): Promise<LLMCompletionResponse>;

  async completeStream(
    _params: LLMCompletionParams,
    _onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<void> {
    throw new Error(`Provider ${this.provider} does not support streaming`);
  }

  protected getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
    };
  }

  protected getRequestTimeout(): number {
    return this.config.timeout || 30000;
  }
}
