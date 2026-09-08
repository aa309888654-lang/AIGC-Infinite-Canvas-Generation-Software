import { getViteEnvValue } from './vite-env';

const isLocalDev = typeof window !== 'undefined' && /^5\d{3}$/.test(window.location.port || '');
const envBackendUrl = getViteEnvValue('VITE_BACKEND_URL');
const envApiBaseUrl = getViteEnvValue('VITE_API_BASE_URL');
const envDirectApiUrl = getViteEnvValue('VITE_DIRECT_API_URL');

function getBackendUrl(): string {
  if (envBackendUrl) return envBackendUrl;
  if (typeof window !== 'undefined' && window.location.origin) {
    const origin = window.location.origin;
    const port = window.location.port;
    const backendPort = getViteEnvValue('VITE_BACKEND_PORT', '3200');
    if (port && port !== backendPort) {
      const backendOrigin = origin.replace(new RegExp(`:${port}$`), `:${backendPort}`);
      return backendOrigin;
    }
    return origin;
  }
  return 'http://localhost:3200';
}

function getDirectApiUrl(): string {
  return envDirectApiUrl || '';
}

export const BACKEND_URL = getBackendUrl();

export const API_BASE_URL = isLocalDev
  ? '/api/v1'
  : (envApiBaseUrl && envApiBaseUrl.startsWith('http') 
      ? envApiBaseUrl 
      : (envApiBaseUrl && envApiBaseUrl.startsWith('/')
          ? envApiBaseUrl
          : `${BACKEND_URL}/api/v1`));

export const DIRECT_API_URL = getDirectApiUrl();

function isIpv4Host(hostname: string): boolean {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);
}

export function transformLocalhostUrl(url: string): string {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('/uploads/')) {
    return typeof window !== 'undefined' ? `${window.location.origin}${url}` : url;
  }

  try {
    const parsed = new URL(url);
    const isBackendUpload = parsed.pathname.startsWith('/uploads/');
    const isLocalBackendHost =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      isIpv4Host(parsed.hostname);

    if (isBackendUpload && typeof window !== 'undefined' && isLocalBackendHost) {
      return `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      const backendOrigin = getBackendUrl();
      return `${backendOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return url;
  }

  return url;
}
