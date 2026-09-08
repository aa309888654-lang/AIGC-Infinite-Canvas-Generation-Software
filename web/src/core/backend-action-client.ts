import { getAuthToken } from '@/lib/auth-check';

type BackendActionOptions = {
  confirmed?: boolean;
  signal?: AbortSignal;
};

function readBackendError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const data = payload as Record<string, unknown>;
  const detail = data.detail ?? data.errorDetail ?? data.message ?? data.error;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(data.details)) return JSON.stringify(data.details);
  return fallback;
}

async function parseJsonSafely(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export async function callBackendAction(
  actionId: string,
  input: Record<string, unknown>,
  options: BackendActionOptions = {},
): Promise<any> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch('/api/v1/actions/execute', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      actionId,
      input,
      confirmed: options.confirmed,
    }),
    signal: options.signal,
  });
  const payload = await parseJsonSafely(response);

  if (!response.ok) {
    throw new Error(readBackendError(payload, `动作 ${actionId} 执行失败: HTTP ${response.status}`));
  }
  if (payload && typeof payload === 'object' && (payload as Record<string, unknown>).success === false) {
    throw new Error(readBackendError(payload, `动作 ${actionId} 执行失败`));
  }

  const data = payload && typeof payload === 'object'
    ? ((payload as Record<string, unknown>).data ?? payload)
    : payload;
  if (data && typeof data === 'object' && (data as Record<string, unknown>).success === false) {
    throw new Error(readBackendError(data, `动作 ${actionId} 执行失败`));
  }

  return data;
}

export function getErrorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
