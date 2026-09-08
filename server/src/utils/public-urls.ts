function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function getAbsoluteBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return normalizeBaseUrl(trimmed);
  } catch {
    return null;
  }
}

export function getPublicAppBaseUrl(): string {
  return (
    getAbsoluteBaseUrl(process.env.PUBLIC_APP_BASE_URL) ||
    getAbsoluteBaseUrl(process.env.APP_BASE_URL) ||
    getAbsoluteBaseUrl(process.env.BASE_URL) ||
    `http://localhost:${process.env.PORT || 3200}`
  );
}

export function buildPublicUrl(pathname: string): string {
  return new URL(pathname, getPublicAppBaseUrl()).toString();
}
