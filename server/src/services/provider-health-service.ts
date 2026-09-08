import { decryptFromStorage, isEncrypted } from '../utils/encryption';

export type ProviderHealthStatus = 'inactive' | 'ready' | 'no_key' | 'invalid_key';

export interface ProviderKeyHealthInput {
  encryptedKey: string;
  isActive: boolean;
  isExhausted: boolean;
}

export interface ProviderHealthAssessment {
  status: ProviderHealthStatus;
  activeKeys: number;
  usableKeys: number;
  invalidKeys: number;
  exhaustedKeys: number;
}

function isUsableKey(encryptedKey: string): boolean {
  try {
    const decrypted = decryptFromStorage(encryptedKey);
    return Boolean(decrypted?.trim()) && !isEncrypted(decrypted);
  } catch {
    return false;
  }
}

/**
 * Checks that active provider keys can be decrypted without exposing their values.
 * In non-production environments decryptFromStorage returns the original ciphertext
 * after a failure, so an encrypted-shaped result is also considered unusable.
 */
export function assessProviderHealth(
  isProviderActive: boolean,
  keys: ProviderKeyHealthInput[]
): ProviderHealthAssessment {
  const activeKeyRows = keys.filter((key) => key.isActive && !key.isExhausted);
  const invalidKeys = activeKeyRows.filter((key) => !isUsableKey(key.encryptedKey)).length;
  const usableKeys = activeKeyRows.length - invalidKeys;
  const exhaustedKeys = keys.filter((key) => key.isExhausted).length;

  const status: ProviderHealthStatus = !isProviderActive
    ? 'inactive'
    : usableKeys > 0
      ? 'ready'
      : invalidKeys > 0
        ? 'invalid_key'
        : 'no_key';

  return {
    status,
    activeKeys: activeKeyRows.length,
    usableKeys,
    invalidKeys,
    exhaustedKeys,
  };
}
