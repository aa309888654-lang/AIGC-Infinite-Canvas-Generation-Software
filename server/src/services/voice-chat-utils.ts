import * as path from 'path';

/** The maximum amount of client supplied context accepted by voice chat. */
export const VOICE_CHAT_MAX_HISTORY_MESSAGES = 12;
export const VOICE_CHAT_MAX_MESSAGE_LENGTH = 2000;
export const VOICE_CHAT_MAX_HISTORY_CHARACTERS = 12000;
export const VOICE_CHAT_MAX_SESSION_ID_LENGTH = 128;

export type VoiceChatHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

/**
 * Multipart requests carry JSON fields as strings. Parse both forms while
 * treating malformed optional history as an empty history.
 */
function toHistoryArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') {
    if (value && typeof value === 'object' && Array.isArray((value as any).messages)) {
      return (value as any).messages;
    }
    return [];
  }

  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.messages)) {
      return parsed.messages;
    }
  } catch {
    // History is optional; an invalid optional field should not break audio
    // recognition. The route still validates the current voice input.
  }
  return [];
}

/**
 * Keep only ordinary user/assistant turns. In particular, callers cannot
 * inject a second system message through the history field.
 */
export function normalizeVoiceChatHistory(value: unknown): VoiceChatHistoryMessage[] {
  const normalized: VoiceChatHistoryMessage[] = [];
  for (const item of toHistoryArray(value)) {
    if (!item || typeof item !== 'object') continue;
    const role = String((item as any).role || '').trim().toLowerCase();
    if (role !== 'user' && role !== 'assistant') continue;

    const rawContent = (item as any).content ?? (item as any).text;
    if (typeof rawContent !== 'string') continue;
    const content = rawContent.trim().slice(0, VOICE_CHAT_MAX_MESSAGE_LENGTH);
    if (!content) continue;
    normalized.push({ role, content });
  }

  const recent = normalized.slice(-VOICE_CHAT_MAX_HISTORY_MESSAGES);
  const result: VoiceChatHistoryMessage[] = [];
  let characterCount = 0;
  // Retain the newest turns when both message and aggregate limits apply.
  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const item = recent[index];
    if (characterCount + item.content.length > VOICE_CHAT_MAX_HISTORY_CHARACTERS) break;
    result.unshift(item);
    characterCount += item.content.length;
  }
  return result;
}

/** Return a bounded, safe session key or undefined when no session was sent. */
export function normalizeVoiceChatSessionId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const sessionId = value.trim().slice(0, VOICE_CHAT_MAX_SESSION_ID_LENGTH);
  if (!sessionId || !/^[a-zA-Z0-9._:-]+$/u.test(sessionId)) return undefined;
  return sessionId;
}

const MIME_EXTENSION_MAP: Record<string, string> = {
  'audio/webm': '.webm',
  'audio/ogg': '.ogg',
  'audio/opus': '.opus',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/mp4': '.m4a',
  'audio/aac': '.aac',
  'audio/flac': '.flac',
};

export function audioUploadExtension(mimeType?: string, originalName?: string): string {
  const cleanMime = String(mimeType || '').split(';')[0].trim().toLowerCase();
  if (MIME_EXTENSION_MAP[cleanMime]) return MIME_EXTENSION_MAP[cleanMime];

  const originalExt = path.extname(String(originalName || '')).toLowerCase();
  if (/^\.(webm|ogg|opus|wav|mp3|m4a|aac|flac)$/u.test(originalExt)) return originalExt;
  return '.webm';
}

function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

/**
 * Resolve an audio URL to a local path whenever it points at our upload/static
 * directories. External HTTPS URLs and audio data URLs are returned as-is for
 * backwards compatibility; importantly, the voice-chat route never creates a
 * URL pointing back to itself for a newly uploaded file.
 */
export function resolveVoiceChatAudioSource(
  value: unknown,
  uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')
): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  const input = value.trim();
  if (/^data:(?:audio|video)\/[a-z0-9.+-]+(?:;[a-z0-9._=-]+)*;base64,[a-z0-9+/=\r\n]+$/iu.test(input)) return input;

  const uploadRoot = path.resolve(uploadDir);
  const publicRoot = path.resolve(process.cwd(), 'public');

  const resolveCandidate = (candidate: string, allowedRoot: string): string => {
    const resolved = path.resolve(candidate);
    if (!isPathInside(allowedRoot, resolved)) {
      throw new Error('音频文件路径无效');
    }
    return resolved;
  };

  // On Windows, `/uploads/...` is considered an absolute path by Node. Check
  // virtual HTTP paths before the platform-specific absolute-path branch.
  if (input.startsWith('/uploads/')) {
    const relative = decodeURIComponent(input.slice('/uploads/'.length));
    return resolveCandidate(path.join(uploadRoot, relative), uploadRoot);
  }
  if (input.startsWith('/audio/')) {
    const relative = decodeURIComponent(input.slice('/audio/'.length));
    return resolveCandidate(path.join(publicRoot, 'audio', relative), path.join(publicRoot, 'audio'));
  }

  // Inspect the raw URL path before URL normalization (URL would collapse
  // `/uploads/../x` and hide a traversal attempt).
  const localUrlMatch = input.match(/^https?:\/\/[^/]+(\/(?:uploads|audio)\/[^?#]*)/iu);
  if (localUrlMatch?.[1]) {
    const rawPath = localUrlMatch[1];
    if (rawPath.toLowerCase().startsWith('/uploads/')) {
      const relative = decodeURIComponent(rawPath.slice('/uploads/'.length));
      return resolveCandidate(path.join(uploadRoot, relative), uploadRoot);
    }
    const relative = decodeURIComponent(rawPath.slice('/audio/'.length));
    return resolveCandidate(path.join(publicRoot, 'audio', relative), path.join(publicRoot, 'audio'));
  }

  try {
    const parsed = new URL(input, 'http://localhost');
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      if (parsed.pathname.startsWith('/uploads/')) {
        const relative = decodeURIComponent(parsed.pathname.slice('/uploads/'.length));
        return resolveCandidate(path.join(uploadRoot, relative), uploadRoot);
      }
      if (parsed.pathname.startsWith('/audio/')) {
        const relative = decodeURIComponent(parsed.pathname.slice('/audio/'.length));
        return resolveCandidate(path.join(publicRoot, 'audio', relative), path.join(publicRoot, 'audio'));
      }
      // A caller supplied remote URL is intentionally left for the provider to
      // fetch. It is not a URL synthesized from the just-uploaded file.
      return input;
    }
  } catch (error) {
    if (error instanceof Error && error.message === '音频文件路径无效') throw error;
  }

  if (path.isAbsolute(input)) {
    if (isPathInside(uploadRoot, input) || isPathInside(publicRoot, input)) return path.resolve(input);
    throw new Error('音频文件路径无效');
  }

  throw new Error('音频文件路径无效');
}
