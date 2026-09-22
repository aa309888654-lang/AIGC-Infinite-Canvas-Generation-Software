import axios from 'axios';
import { ProviderConfig } from './providerTypes';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function callAnthropicCompatible(
  config: ProviderConfig,
  messages: ChatMessage[],
  timeout?: number,
): Promise<string> {
  const apiKey = config.apiKey || process.env[config.apiKeyEnv || ''];
  if (!apiKey) throw new Error(`Missing API key for provider: ${config.name}`);

  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const effectiveTimeout = timeout || config.timeout || 30000;
  const system = messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n\n');
  const userMessages = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({ role: message.role, content: message.content }));

  const response = await axios.post(
    `${baseUrl}/v1/messages`,
    {
      model: config.model,
      ...(system ? { system } : {}),
      messages: userMessages,
      max_tokens: config.maxTokens ?? 4096,
      temperature: config.temperature ?? 0.7,
      ...(config.topP !== undefined ? { top_p: config.topP } : {}),
      ...(config.extraBody || {}),
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      timeout: effectiveTimeout,
    },
  );

  const content = Array.isArray(response.data?.content)
    ? response.data.content.filter((item: any) => item?.type === 'text').map((item: any) => item.text).join('')
    : '';
  if (!content) throw new Error(`${config.name} returned an empty response`);
  return content;
}
