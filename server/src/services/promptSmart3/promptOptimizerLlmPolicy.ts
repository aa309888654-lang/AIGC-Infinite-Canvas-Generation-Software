export const PROMPT_OPTIMIZER_CREDENTIAL_PROVIDER = 'prompt-optimizer-llm';

export type PromptOptimizerLlmProtocol = 'openai' | 'anthropic';

export interface PromptOptimizerLlmDefinition {
  id: string;
  label: string;
  group: 'DeepSeek' | 'GPT' | 'Claude' | 'SenseNova';
  protocol: PromptOptimizerLlmProtocol;
  providerName: string;
  baseUrl: string;
}

const DEFINITIONS: readonly PromptOptimizerLlmDefinition[] = [
  {
    id: 'deepseek-v4-flash',
    label: 'DeepSeek V4 Flash',
    group: 'DeepSeek',
    protocol: 'openai',
    providerName: 'prompt-optimizer-deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
  },
  {
    id: 'deepseek-v4-pro',
    label: 'DeepSeek V4 Pro',
    group: 'DeepSeek',
    protocol: 'openai',
    providerName: 'prompt-optimizer-deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
  },
  {
    id: 'gpt-5.5',
    label: 'GPT-5.5',
    group: 'GPT',
    protocol: 'openai',
    providerName: 'prompt-optimizer-gpt',
    baseUrl: 'https://apipaths.com/v1',
  },
  {
    id: 'gpt-5.6-terra',
    label: 'GPT-5.6 Terra',
    group: 'GPT',
    protocol: 'openai',
    providerName: 'prompt-optimizer-gpt',
    baseUrl: 'https://apipaths.com/v1',
  },
  {
    id: 'gpt-5.6-sol',
    label: 'GPT-5.6 Sol',
    group: 'GPT',
    protocol: 'openai',
    providerName: 'prompt-optimizer-gpt',
    baseUrl: 'https://apipaths.com/v1',
  },
  {
    id: 'claude-fable-5',
    label: 'Claude Fable 5',
    group: 'Claude',
    protocol: 'anthropic',
    providerName: 'prompt-optimizer-claude',
    baseUrl: 'https://api.anthropic.com',
  },
  {
    id: 'claude-opus-5',
    label: 'Claude Opus 5',
    group: 'Claude',
    protocol: 'anthropic',
    providerName: 'prompt-optimizer-claude',
    baseUrl: 'https://api.anthropic.com',
  },
  {
    id: 'claude-opus-4-8',
    label: 'Claude Opus 4.8',
    group: 'Claude',
    protocol: 'anthropic',
    providerName: 'prompt-optimizer-claude',
    baseUrl: 'https://api.anthropic.com',
  },
  {
    id: 'sensenova-6.8-flash-lite',
    label: 'SenseNova 6.8 Flash Lite',
    group: 'SenseNova',
    protocol: 'openai',
    providerName: 'prompt-optimizer-sensenova',
    baseUrl: 'https://aicgxt.xyz/v1',
  },
] as const;

const DEFINITIONS_BY_ID = new Map(DEFINITIONS.map((definition) => [definition.id, definition]));

export function listPromptOptimizerLlmDefinitions(): readonly PromptOptimizerLlmDefinition[] {
  return DEFINITIONS;
}

export function getPromptOptimizerLlmDefinition(model?: string): PromptOptimizerLlmDefinition | null {
  if (!model) return null;
  return DEFINITIONS_BY_ID.get(model.trim().toLowerCase()) || null;
}

export function isPromptOptimizerLlmModel(model?: string): boolean {
  return getPromptOptimizerLlmDefinition(model) !== null;
}

export function isPromptOptimizerLlmProtocol(model: string, protocol: string): boolean {
  const definition = getPromptOptimizerLlmDefinition(model);
  return definition?.protocol === protocol;
}

export function isFixedPromptOptimizerEndpoint(baseUrl: string, definition: PromptOptimizerLlmDefinition): boolean {
  return baseUrl === definition.baseUrl;
}
