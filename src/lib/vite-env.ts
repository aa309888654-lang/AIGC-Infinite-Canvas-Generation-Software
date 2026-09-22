export type ViteEnvMap = Record<string, string | boolean | undefined>;

export function getViteEnv(): ViteEnvMap {
  try {
    return Function('return import.meta.env')() as ViteEnvMap;
  } catch {
    const fallback = (globalThis as typeof globalThis & {
      import?: { meta?: { env?: ViteEnvMap } };
    }).import?.meta?.env;

    if (fallback) {
      return fallback;
    }

    if (typeof process !== 'undefined' && process.env) {
      return process.env;
    }

    return {};
  }
}

export function getViteEnvValue(key: string, fallback = ''): string {
  const value = getViteEnv()[key];
  return typeof value === 'string' ? value : fallback;
}

export function isViteDevMode(): boolean {
  const env = getViteEnv();
  const dev = env.DEV;

  if (typeof dev === 'boolean') {
    return dev;
  }

  if (typeof dev === 'string') {
    return dev === 'true';
  }

  return env.MODE === 'development' || env.NODE_ENV === 'development';
}
