export interface PersonalModelCredentialAuth {
  apiKey: string;
  apiSecret?: string;
  baseUrl?: string;
}

type PersonalModelCredential = {
  apiKey?: string;
  apiSecret?: string;
  accessKey?: string;
  secretKey?: string;
  baseUrl?: string;
};

const PERSONAL_KEY_PREFIX = '__user_main__:';
const CUSTOM_KEY_PREFIX = '__custom_main__:';

export function resolvePersonalModelCredentialAuth(
  credential?: PersonalModelCredential | null,
): PersonalModelCredentialAuth | null {
  const apiKey = credential?.apiKey || credential?.accessKey;
  if (!apiKey) return null;

  return {
    apiKey,
    apiSecret: credential?.apiSecret || credential?.secretKey,
    baseUrl: credential?.baseUrl,
  };
}

export function buildPersonalModelKeyId(provider: string, customModel: boolean): string {
  return `${customModel ? CUSTOM_KEY_PREFIX : PERSONAL_KEY_PREFIX}${provider}`;
}

export function isPersonalModelKeyId(keyId: string | null | undefined, provider: string): boolean {
  return keyId === `${PERSONAL_KEY_PREFIX}${provider}` || keyId === `${CUSTOM_KEY_PREFIX}${provider}`;
}
