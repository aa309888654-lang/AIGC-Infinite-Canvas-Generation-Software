import { describe, expect, it } from 'vitest';
import {
  getPromptOptimizerLlmDefinition,
  isFixedPromptOptimizerEndpoint,
  isPromptOptimizerLlmProtocol,
  listPromptOptimizerLlmDefinitions,
} from './promptOptimizerLlmPolicy';

describe('prompt optimizer LLM policy', () => {
  it('contains only the eight supported models', () => {
    expect(listPromptOptimizerLlmDefinitions().map((definition) => definition.id)).toEqual([
      'deepseek-v4-flash',
      'deepseek-v4-pro',
      'gpt-5.5',
      'gpt-5.6-terra',
      'gpt-5.6-sol',
      'claude-fable-5',
      'claude-opus-5',
      'claude-opus-4-8',
    ]);
  });

  it('maps Claude to Anthropic and other models to OpenAI compatibility', () => {
    expect(isPromptOptimizerLlmProtocol('claude-opus-5', 'anthropic')).toBe(true);
    expect(isPromptOptimizerLlmProtocol('gpt-5.6-sol', 'openai')).toBe(true);
    expect(isPromptOptimizerLlmProtocol('claude-opus-5', 'openai')).toBe(false);
    expect(isPromptOptimizerLlmProtocol('auto', 'openai')).toBe(false);
  });

  it('rejects unknown models and endpoint overrides', () => {
    expect(getPromptOptimizerLlmDefinition('step-3.5-flash')).toBeNull();
    const definition = getPromptOptimizerLlmDefinition('deepseek-v4-pro')!;
    expect(isFixedPromptOptimizerEndpoint(definition.baseUrl, definition)).toBe(true);
    expect(isFixedPromptOptimizerEndpoint('https://attacker.example/v1', definition)).toBe(false);
  });
});
