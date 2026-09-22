export interface ProviderConfig {
  name: string;
  apiKeyEnv?: string;
  baseUrl: string;
  anthropicBaseUrl?: string;
  model: string;
  supportedModels?: string[];
  weight: number;
  maxConcurrency?: number;
  timeout?: number;
  apiKey?: string;
  authType?: 'bearer' | 'appid-key';
  protocol?: 'openai' | 'anthropic';
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  extraBody?: Record<string, unknown>;
}
