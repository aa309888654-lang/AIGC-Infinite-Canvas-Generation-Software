const SENSITIVE_CONFIG_FIELDS = new Set([
  'apikey',
  'apisecret',
  'accesskey',
  'secretkey',
  'clientsecret',
  'accesstoken',
  'refreshtoken',
  'bearertoken',
  'authorization',
  'password',
  'encryptedkey',
  'encryptedapikey',
  'encryptedapisecret',
]);

const SECRET_ONLY_STORAGE_KEYS = [
  'baidu_api_key',
  'baidu_secret_key',
  'minimax-api-config',
  'infinite-flow-api-keys',
  'infinite-flow-encrypted-api-keys',
  'infinite-flow-crypto-key',
];

const STRUCTURED_API_CONFIG_STORAGE_KEYS = [
  'secure_api-config-v2',
  'secure_api-config-v2_fallback',
  'secure_api-config-v2_raw',
  'secure_api-config-v2_sync',
  'secure_unified-api-config-v3',
  'secure_unified-api-config-v3_fallback',
  'secure_unified-api-config-v3_raw',
  'secure_unified-api-config-v3_sync',
  'secure_llm-service-config',
  'secure_llm-service-config_fallback',
  'secure_llm-service-config_raw',
  'secure_llm-service-config_sync',
  'unified-api-config-storage',
  'unified-api-config-v3',
  'infinite-flow-api-config',
  'infinite-flow-config',
];

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function normalizeFieldName(field: string): string {
  return field.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

export function isSensitiveApiConfigField(field: string): boolean {
  return SENSITIVE_CONFIG_FIELDS.has(normalizeFieldName(field));
}

export function stripSensitiveApiConfigFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => stripSensitiveApiConfigFields(item)) as T;
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const clean: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveApiConfigField(key)) continue;
    clean[key] = stripSensitiveApiConfigFields(nestedValue);
  }
  return clean as T;
}

export function purgeBrowserApiSecrets(storage?: StorageLike): void {
  const target = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
  if (!target) return;

  for (const key of SECRET_ONLY_STORAGE_KEYS) {
    try {
      target.removeItem(key);
    } catch {
      // Storage may be unavailable in private browsing mode.
    }
  }

  for (const key of STRUCTURED_API_CONFIG_STORAGE_KEYS) {
    try {
      const raw = target.getItem(key);
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw) as unknown;
        target.setItem(key, JSON.stringify(stripSensitiveApiConfigFields(parsed)));
      } catch {
        // Legacy encrypted blobs cannot be proven secret-free, so discard them.
        target.removeItem(key);
      }
    } catch {
      // Best-effort migration; runtime config still comes from the backend.
    }
  }
}

