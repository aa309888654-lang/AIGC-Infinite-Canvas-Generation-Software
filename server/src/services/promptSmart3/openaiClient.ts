import axios from 'axios';
import { ProviderConfig } from './providerTypes';
import { logger } from '../../utils/logger';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function callOpenAICompatible(
  config: ProviderConfig,
  messages: ChatMessage[],
  timeout?: number,
): Promise<string> {
  const apiKey = config.apiKey || process.env[config.apiKeyEnv || ''];
  if (!apiKey) throw new Error(`Missing API key for provider: ${config.name}`);

  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const effectiveTimeout = timeout || config.timeout || 30000;

  const url = baseUrl.match(/\/v\d+$/)
    ? `${baseUrl}/chat/completions`
    : `${baseUrl}/v1/chat/completions`;
  logger.debug(`[PromptSmart3] Calling ${config.name}: ${url}, model=${config.model}`);

  const isGoogleApi = config.baseUrl.includes('googleapis.com');
  const requestConfig = isGoogleApi
    ? {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        timeout: effectiveTimeout,
      }
    : {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: effectiveTimeout,
      };

  try {
    const response = await axios.post(
      url,
      {
        model: config.model,
        messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 4096,
        ...(config.topP !== undefined ? { top_p: config.topP } : {}),
        ...(config.extraBody || {}),
      },
      requestConfig,
    );

    const msg = response.data.choices?.[0]?.message;
    const content = msg?.content || msg?.reasoning_content || '';
    logger.debug(`[PromptSmart3] ${config.name} response OK, content length=${content.length}`);
    return content;
  } catch (err: unknown) {
    const errAxios = err as any;
    const status = errAxios?.response?.status;
    const data = errAxios?.response?.data;
    console.error(`[PromptSmart3] ${config.name} API error: status=${status}, data=${JSON.stringify(data)?.substring(0, 500)}`);
    throw new Error(`${config.name} API error: ${status} - ${typeof data === 'object' ? JSON.stringify(data) : data}`);
  }
}
