import { create } from 'zustand';
import { BaseLLMAdapter, LLMConfig, LLMCompletionParams, LLMCompletionResponse, LLMModelInfo, LLMStreamChunk } from './llm-adapters';
import { SecureStorage } from './secure-storage';
import { API_BASE_URL } from '@/lib/api-config';
import { getAuthToken } from '@/lib/auth-check';
import { purgeBrowserApiSecrets, stripSensitiveApiConfigFields } from './api-config-security';

export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'baidu' | 'aliyun' | 'minimax' | 'openaiCompatible' | 'anthropicCompatible';

export interface LLMProviderInfo {
  id: LLMProvider;
  name: string;
  icon: string;
  color: string;
  description?: string;
  models: LLMModelInfo[];
}

export interface LLMConnectionStatus {
  provider: LLMProvider;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastTest?: Date;
  latency?: number;
  error?: string;
}

export interface LLMServiceState {
  providers: Record<LLMProvider, LLMConfig>;
  activeProvider: LLMProvider | null;
  activeModel: string | null;
  connectionStatuses: Record<LLMProvider, LLMConnectionStatus>;
  adapters: Map<LLMProvider, BaseLLMAdapter>;

  setProviderConfig: (provider: LLMProvider, config: Partial<LLMConfig>) => void;
  getProviderConfig: (provider: LLMProvider) => LLMConfig;
  setActiveProvider: (provider: LLMProvider | null, model?: string) => void;
  testConnection: (provider: LLMProvider) => Promise<{ success: boolean; error?: string; latency?: number }>;
  complete: (params: LLMCompletionParams) => Promise<LLMCompletionResponse>;
  completeStream: (
    params: LLMCompletionParams,
    onChunk: (chunk: any) => void
  ) => Promise<void>;
  getAvailableProviders: () => LLMProviderInfo[];
  getProviderModels: (provider: LLMProvider) => LLMModelInfo[];
  clearProviderConfig: (provider: LLMProvider) => void;
  clearAllConfigs: () => void;
  hasValidConfig: (provider: LLMProvider) => boolean;
  getAllConfiguredProviders: () => LLMProvider[];
  updateConnectionStatus: (
    provider: LLMProvider,
    status: Partial<LLMConnectionStatus>
  ) => void;
}

const STORAGE_KEY = 'llm-service-config';

purgeBrowserApiSecrets();

const DEFAULT_CONFIGS: Record<LLMProvider, LLMConfig> = {
  openai: {
    apiKey: '',
    baseUrl: '',
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2048,
    topP: 1,
  },
  anthropic: {
    apiKey: '',
    baseUrl: '',
    model: 'claude-3-5-sonnet-latest',
    temperature: 0.7,
    maxTokens: 4096,
    topP: 0.9,
  },
  google: {
    apiKey: '',
    baseUrl: '',
    model: 'gemini-1.5-flash-latest',
    temperature: 0.7,
    maxTokens: 8192,
    topP: 0.95,
  },
  baidu: {
    accessKey: '',
    secretKey: '',
    baseUrl: '',
    model: 'ernie-3.5-8k-preview',
    temperature: 0.7,
    maxTokens: 2048,
    topP: 0.8,
  },
  aliyun: {
    apiKey: '',
    baseUrl: '',
    model: 'qwen-plus',
    temperature: 0.7,
    maxTokens: 2048,
    topP: 0.8,
  },
  minimax: {
    apiKey: '',
    baseUrl: '',
    model: 'ark-code-latest',
    temperature: 0.3,
    maxTokens: 16384,
    topP: 0.9,
  },
  openaiCompatible: {
    apiKey: '',
    baseUrl: '',
    model: 'gpt-image-1',
    temperature: 0.7,
    maxTokens: 2048,
    topP: 0.95,
  },
  anthropicCompatible: {
    apiKey: '',
    baseUrl: '',
    model: 'claude-image',
    temperature: 0.7,
    maxTokens: 2048,
    topP: 0.95,
    supportsImageGeneration: true,
    supportsVideoGeneration: true,
  },
};

const PROVIDER_INFO: Record<LLMProvider, Omit<LLMProviderInfo, 'models'>> = {
  openai: {
    id: 'openai',
    name: '第三方GPT',
    icon: '🤖',
    color: '#10A37F',
    description: '通过兼容接口接入 GPT 系列模型',
  },
  anthropic: {
    id: 'anthropic',
    name: '第三方Claude',
    icon: '🧠',
    color: '#CC785C',
    description: '通过兼容接口接入 Claude 系列模型',
  },
  google: {
    id: 'google',
    name: 'Google Gemini',
    icon: '💎',
    color: '#4285F4',
    description: 'Gemini 1.5、2.0 系列模型',
  },
  baidu: {
    id: 'baidu',
    name: '百度文心一言',
    icon: '📝',
    color: '#6B7280',
    description: '文心一言 4.0、3.5 等模型',
  },
  aliyun: {
    id: 'aliyun',
    name: '阿里通义千问',
    icon: '🔮',
    color: '#FF6A00',
    description: 'Qwen Max、Plus、Turbo 等模型',
  },
  minimax: {
    id: 'minimax',
    name: '火山方舟',
    icon: '🤖',
    color: '#00D4AA',
    description: '火山方舟 ark-code-latest，适合低延迟对话与编码助手',
  },
  openaiCompatible: {
    id: 'openaiCompatible',
    name: 'GPT兼容接口',
    icon: '🔗',
    color: '#10A37F',
    description: '通用 BaseURL 接口，支持高质量大模型（图片/视频生成）',
  },
  anthropicCompatible: {
    id: 'anthropicCompatible',
    name: 'Claude兼容接口',
    icon: '🧠',
    color: '#CC785C',
    description: '只支持图片大模型与视频大模型',
  },
};

const loadConfigs = (): Record<LLMProvider, LLMConfig> => {
  try {
    const stored = SecureStorage.getItemSync<Record<LLMProvider, LLMConfig>>(STORAGE_KEY);
    if (stored) {
      return stripSensitiveApiConfigFields({ ...DEFAULT_CONFIGS, ...stored }) as Record<LLMProvider, LLMConfig>;
    }
  } catch (error) {
    console.error('加载LLM配置失败:', error);
  }
  return { ...DEFAULT_CONFIGS };
};

const saveConfigs = (configs: Record<LLMProvider, LLMConfig>) => {
  try {
    SecureStorage.setItemSync(STORAGE_KEY, stripSensitiveApiConfigFields(configs));
  } catch (error) {
    console.error('保存LLM配置失败:', error);
  }
};

const BACKEND_PROVIDER_MAP: Record<LLMProvider, string> = {
  openai: 'openai',
  anthropic: 'claude',
  google: 'gemini',
  baidu: 'doubao',
  aliyun: 'qwen',
  minimax: 'deepseek-v4-flash',
  openaiCompatible: 'openai',
  anthropicCompatible: 'claude',
};

class BackendLLMAdapter extends BaseLLMAdapter {
  constructor(
    config: LLMConfig,
    private readonly llmProvider: LLMProvider
  ) {
    super(config, `backend-${llmProvider}`);
  }

  getProviderName(): string {
    return `backend-${this.llmProvider}`;
  }

  getModels(): LLMModelInfo[] {
    return [
      {
        id: this.config.model || this.llmProvider,
        name: this.config.model || PROVIDER_INFO[this.llmProvider].name,
        provider: `backend-${this.llmProvider}`,
        description: '后端托管模型，密钥、配额与审计由后端统一管理',
        maxTokens: this.config.maxTokens || 4096,
        supportsStreaming: true,
        supportsVision: false,
        supportsToolCalling: true,
      },
    ];
  }

  validateConfig(): { valid: boolean; error?: string } {
    return { valid: true };
  }

  async testConnection(): Promise<{ success: boolean; error?: string; latency?: number }> {
    const start = Date.now();
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/ai/providers`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      return {
        success: response.ok,
        error: response.ok ? undefined : `后端连接失败: ${response.status}`,
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '后端连接失败',
        latency: Date.now() - start,
      };
    }
  }

  async complete(params: LLMCompletionParams): Promise<LLMCompletionResponse> {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        messages: params.messages,
        model: params.model || this.config.model,
        temperature: params.temperature ?? this.config.temperature,
        maxTokens: params.maxTokens ?? this.config.maxTokens,
        stream: false,
        provider: BACKEND_PROVIDER_MAP[this.llmProvider] || 'minimax',
        tools: params.tools,
        toolChoice: params.toolChoice,
        enablePromptCaching: params.enablePromptCaching,
        enableThinking: params.enableThinking,
        thinkingConfig: params.thinkingConfig,
        responseFormat: params.responseFormat,
        seed: params.seed,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || `后端 LLM 请求失败: ${response.status}`);
    }

    const data = await response.json();
    return {
      id: `backend-llm-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: data.model || params.model || this.config.model || 'backend-managed',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: data.content || '',
            tool_calls: data.toolCalls,
          },
          finish_reason: data.toolCalls?.length ? 'tool_calls' : 'stop',
        },
      ],
      usage: data.usage,
    };
  }

  async completeStream(params: LLMCompletionParams, onChunk: (chunk: LLMStreamChunk) => void): Promise<void> {
    const response = await this.complete(params);
    onChunk({
      id: response.id,
      object: 'chat.completion.chunk',
      created: response.created,
      model: response.model,
      choices: [
        {
          index: 0,
          delta: {
            role: 'assistant',
            content: response.choices[0]?.message?.content || '',
          },
          finish_reason: 'stop',
        },
      ],
    });
  }
}

const createAdapter = (provider: LLMProvider, config: LLMConfig): BaseLLMAdapter | null => {
  return new BackendLLMAdapter(config, provider);
};

export const useLLMServiceStore = create<LLMServiceState>()((set, get) => ({
  providers: loadConfigs(),
  activeProvider: null,
  activeModel: null,
  connectionStatuses: {
    openai: { provider: 'openai', status: 'disconnected' },
    anthropic: { provider: 'anthropic', status: 'disconnected' },
    google: { provider: 'google', status: 'disconnected' },
    baidu: { provider: 'baidu', status: 'disconnected' },
    aliyun: { provider: 'aliyun', status: 'disconnected' },
    minimax: { provider: 'minimax', status: 'disconnected' },
    openaiCompatible: { provider: 'openaiCompatible', status: 'disconnected' },
    anthropicCompatible: { provider: 'anthropicCompatible', status: 'disconnected' },
  },
  adapters: new Map(),

  setProviderConfig: (provider, config) => {
    set((state) => {
      const newProviders = stripSensitiveApiConfigFields({
        ...state.providers,
        [provider]: {
          ...state.providers[provider],
          ...config,
        },
      }) as Record<LLMProvider, LLMConfig>;
      saveConfigs(newProviders);

      const newAdapters = new Map(state.adapters);
      newAdapters.delete(provider);

      return {
        providers: newProviders,
        adapters: newAdapters,
        connectionStatuses: {
          ...state.connectionStatuses,
          [provider]: {
            ...state.connectionStatuses[provider],
            status: 'disconnected',
          },
        },
      };
    });
  },

  getProviderConfig: (provider) => {
    return get().providers[provider];
  },

  setActiveProvider: (provider, model) => {
    set((state) => ({
      activeProvider: provider,
      activeModel: model || state.providers[provider]?.model || null,
    }));
  },

  testConnection: async (provider) => {
    const state = get();
    const config = state.providers[provider];

    set((state) => ({
      connectionStatuses: {
        ...state.connectionStatuses,
        [provider]: {
          ...state.connectionStatuses[provider],
          status: 'connecting',
        },
      },
    }));

    try {
      let adapter = state.adapters.get(provider);
      if (!adapter) {
        adapter = createAdapter(provider, config);
        if (adapter) {
          set((state) => {
            const newAdapters = new Map(state.adapters);
            newAdapters.set(provider, adapter!);
            return { adapters: newAdapters };
          });
        }
      }

      if (!adapter) {
        throw new Error('无法创建适配器');
      }

      const result = await adapter.testConnection();

      set((state) => ({
        connectionStatuses: {
          ...state.connectionStatuses,
          [provider]: {
            provider,
            status: result.success ? 'connected' : 'error',
            lastTest: new Date(),
            latency: result.latency,
            error: result.error,
          },
        },
      }));

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '连接测试失败';

      set((state) => ({
        connectionStatuses: {
          ...state.connectionStatuses,
          [provider]: {
            provider,
            status: 'error',
            lastTest: new Date(),
            error: errorMessage,
          },
        },
      }));

      return { success: false, error: errorMessage };
    }
  },

  complete: async (params) => {
    const state = get();
    const provider = state.activeProvider;

    if (!provider) {
      throw new Error('未选择提供商');
    }

    let adapter = state.adapters.get(provider);
    if (!adapter) {
      adapter = createAdapter(provider, state.providers[provider]);
      if (adapter) {
        const newAdapters = new Map(state.adapters);
        newAdapters.set(provider, adapter);
        set({ adapters: newAdapters });
      }
    }

    if (!adapter) {
      throw new Error('无法创建适配器');
    }

    return await adapter.complete(params);
  },

  completeStream: async (params, onChunk) => {
    const state = get();
    const provider = state.activeProvider;

    if (!provider) {
      throw new Error('未选择提供商');
    }

    let adapter = state.adapters.get(provider);
    if (!adapter) {
      adapter = createAdapter(provider, state.providers[provider]);
      if (adapter) {
        const newAdapters = new Map(state.adapters);
        newAdapters.set(provider, adapter);
        set({ adapters: newAdapters });
      }
    }

    if (!adapter) {
      throw new Error('无法创建适配器');
    }

    await adapter.completeStream(params, onChunk);
  },

  getAvailableProviders: () => {
    const state = get();
    return Object.entries(PROVIDER_INFO).map(([id, info]) => {
      const provider = id as LLMProvider;
      const adapter = createAdapter(provider, state.providers[provider]);
      return {
        ...info,
        models: adapter?.getModels() || [],
      };
    });
  },

  getProviderModels: (provider) => {
    const config = get().providers[provider];
    const adapter = createAdapter(provider, config);
    return adapter?.getModels() || [];
  },

  clearProviderConfig: (provider) => {
    set((state) => {
      const newProviders = {
        ...state.providers,
        [provider]: { ...DEFAULT_CONFIGS[provider] },
      };
      saveConfigs(newProviders);

      const newAdapters = new Map(state.adapters);
      newAdapters.delete(provider);

      return {
        providers: newProviders,
        adapters: newAdapters,
        activeProvider:
          state.activeProvider === provider ? null : state.activeProvider,
        activeModel:
          state.activeProvider === provider ? null : state.activeModel,
        connectionStatuses: {
          ...state.connectionStatuses,
          [provider]: {
            provider,
            status: 'disconnected',
          },
        },
      };
    });
  },

  clearAllConfigs: () => {
    set((_state) => ({
      providers: { ...DEFAULT_CONFIGS },
      adapters: new Map(),
      activeProvider: null,
      activeModel: null,
      connectionStatuses: {
        openai: { provider: 'openai', status: 'disconnected' },
        anthropic: { provider: 'anthropic', status: 'disconnected' },
        google: { provider: 'google', status: 'disconnected' },
        baidu: { provider: 'baidu', status: 'disconnected' },
        aliyun: { provider: 'aliyun', status: 'disconnected' },
        minimax: { provider: 'minimax', status: 'disconnected' },
        openaiCompatible: { provider: 'openaiCompatible', status: 'disconnected' },
        anthropicCompatible: { provider: 'anthropicCompatible', status: 'disconnected' },
      },
    }));
    SecureStorage.removeItem(STORAGE_KEY);
  },

  hasValidConfig: (provider) => {
    try {
      const config = get().providers[provider];
      const adapter = createAdapter(provider, config);
      if (!adapter) return false;
      const validation = adapter.validateConfig();
      return validation?.valid || false;
    } catch (error) {
      console.error('[hasValidConfig] 验证配置失败:', error);
      return false;
    }
  },

  getAllConfiguredProviders: () => {
    const state = get();
    return (Object.keys(state.providers) as LLMProvider[]).filter((provider) =>
      state.hasValidConfig(provider)
    );
  },

  updateConnectionStatus: (provider, status) => {
    set((state) => ({
      connectionStatuses: {
        ...state.connectionStatuses,
        [provider]: {
          ...state.connectionStatuses[provider],
          ...status,
        },
      },
    }));
  },
}));

export default useLLMServiceStore;
