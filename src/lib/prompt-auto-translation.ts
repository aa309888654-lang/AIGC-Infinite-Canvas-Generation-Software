import { DEFAULT_PROMPT_TEXT_MODEL_ID } from '@/config/prompt-optimizer-models';
import { API_BASE_URL } from '@/lib/api-config';
import { getAuthToken } from '@/lib/auth-check';

const CJK_PATTERN = /[\u3400-\u9fff]/;

const FOREIGN_MODEL_PATTERNS = [
  'gpt',
  'openai',
  'dall',
  'sora',
  'google',
  'gemini',
  'veo',
  'imagen',
  'flux',
  'midjourney',
  'mj',
  'nano',
  'banana',
  'stable',
  'stability',
  'sdxl',
  'ideogram',
  'leonardo',
  'runway',
  'luma',
  'pika',
  'haiper',
  'recraft',
  'grok',
];

const DOMESTIC_MODEL_PATTERNS = [
  'doubao',
  'seedream',
  'jimeng',
  'wan',
  'wanx',
  'minimax',
  'hailuo',
  'kling',
  'vidu',
  'step',
  'sensenova',
  'sense',
  'agnes',
  'qwen',
  'deepseek',
  'hunyuan',
  'baidu',
  'ernie',
  'zhipu',
];

const FOREIGN_PROVIDERS = new Set([
  'openai',
  'google',
  'anthropic',
  'stability',
  'midjourney',
  'ideogram',
  'leonardo',
  'runway',
  'luma',
  'pika',
  'haiper',
  'recraft',
  'xai',
]);

const DOMESTIC_PROVIDERS = new Set([
  'doubao',
  'jimeng',
  'minimax',
  'hailuo',
  'kling',
  'vidu',
  'stepfun',
  'sensenova',
  'agnes',
  'qwen',
  'deepseek',
  'hunyuan',
  'baidu',
  'zhipu',
]);

function normalizeModelText(value?: string | null): string {
  return String(value || '').trim().toLowerCase();
}

function matchesAny(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => value.includes(pattern));
}

export function hasChineseText(text: string): boolean {
  return CJK_PATTERN.test(text);
}

export function isForeignGenerationModel(provider?: string | null, modelId?: string | null): boolean {
  const normalizedProvider = normalizeModelText(provider);
  const normalizedModelId = normalizeModelText(modelId);
  const identity = `${normalizedProvider} ${normalizedModelId}`;

  if (matchesAny(identity, FOREIGN_MODEL_PATTERNS)) return true;
  if (matchesAny(identity, DOMESTIC_MODEL_PATTERNS)) return false;
  if (FOREIGN_PROVIDERS.has(normalizedProvider)) return true;
  if (DOMESTIC_PROVIDERS.has(normalizedProvider)) return false;

  return false;
}

export function shouldAutoTranslatePromptForModel(params: {
  prompt: string;
  provider?: string | null;
  modelId?: string | null;
}): boolean {
  return hasChineseText(params.prompt) && isForeignGenerationModel(params.provider, params.modelId);
}

async function translatePrompt(text: string, targetLanguage: '英文' | '中文'): Promise<string> {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}/public/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: `请将以下内容翻译为${targetLanguage}，只输出译文：\n\n${text}`,
      model: DEFAULT_PROMPT_TEXT_MODEL_ID,
    }),
  });
  const res = await response.json();
  if (!res.content) {
    throw new Error(res.error || '翻译失败');
  }

  return String(res.content).trim();
}

export function translatePromptToEnglish(text: string): Promise<string> {
  return translatePrompt(text, '英文');
}

export function translatePromptToChinese(text: string): Promise<string> {
  return translatePrompt(text, '中文');
}
