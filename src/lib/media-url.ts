import { API_BASE_URL, BACKEND_URL } from './api-config';

const DEV_ORIGIN_PREFIXES = [
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3100',
  'http://127.0.0.1:3100',
  'http://localhost:3200',
  'http://127.0.0.1:3200',
];

const LOCAL_AUDIO_PATH_RE = /^\/(music|audio)\/([^?#/]+\.(?:mp3|wav|ogg|flac|aac|m4a|webm))(?:([?#].*)?)$/i;

function buildAudioFileUrl(kind: string, fileName: string, suffix = ''): string {
  const encodedFileName = encodeURIComponent(fileName);
  return `${API_BASE_URL}/audio/files/${kind}/${encodedFileName}${suffix}`;
}

function normalizeLocalAudioFileUrl(url: string): string | null {
  const relativeMatch = url.match(LOCAL_AUDIO_PATH_RE);
  if (relativeMatch) {
    return buildAudioFileUrl(relativeMatch[1], relativeMatch[2], relativeMatch[3] || '');
  }

  try {
    const parsed = new URL(url);
    const isKnownOrigin =
      (typeof window !== 'undefined' && parsed.origin === window.location.origin) ||
      parsed.origin === BACKEND_URL ||
      DEV_ORIGIN_PREFIXES.includes(parsed.origin);

    if (!isKnownOrigin) return null;

    const match = parsed.pathname.match(LOCAL_AUDIO_PATH_RE);
    if (!match) return null;

    return buildAudioFileUrl(match[1], match[2], `${parsed.search}${parsed.hash}`);
  } catch {
    return null;
  }
}

export function normalizeMediaUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '';

  const audioFileUrl = normalizeLocalAudioFileUrl(url);
  if (audioFileUrl) return audioFileUrl;

  if (url.startsWith('blob:')) return '';

  if (
    url.startsWith('/') ||
    url.startsWith('data:') ||
    url.startsWith('about:')
  ) {
    return url;
  }

  if (!import.meta.env.DEV) {
    return url;
  }

  for (const prefix of DEV_ORIGIN_PREFIXES) {
    if (url.startsWith(prefix)) {
      try {
        const parsed = new URL(url);
        if (parsed.pathname.startsWith('/uploads/')) {
          return parsed.pathname + parsed.search + parsed.hash;
        }
        return url;
      } catch {
        return url;
      }
    }
  }

  return url;
}

export function isRuntimeBlobUrl(url: string | undefined | null): boolean {
  return typeof url === 'string' && url.startsWith('blob:');
}

export function getSafeRenderableMediaUrl(url: string | undefined | null): string {
  if (isRuntimeBlobUrl(url)) return '';
  return normalizeMediaUrl(url);
}

export function normalizeMediaUrls(urls: Array<string | undefined | null>): string[] {
  return urls.map(normalizeMediaUrl).filter((u): u is string => u.length > 0);
}
