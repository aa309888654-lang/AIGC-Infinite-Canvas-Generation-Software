/**
 * @deprecated 浏览器端加密无法保护模型密钥；密钥仅允许保存在后端。
 * 保留这些导出只为兼容旧调用方，并在调用时清理历史残留。
 */

const STORAGE_KEY = 'infinite-flow-encrypted-api-keys';
const KEY_STORAGE_KEY = 'infinite-flow-crypto-key';

export function deleteEncryptedAPIKeys(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(KEY_STORAGE_KEY);
  } catch {
    // Storage may be unavailable in private browsing mode.
  }
}

export async function saveEncryptedAPIKeys(_apiKeys: Record<string, unknown>): Promise<void> {
  deleteEncryptedAPIKeys();
  console.warn('[CryptoAPIKeys] 已忽略浏览器保存请求，请使用后端 Provider 配置');
}

export async function loadEncryptedAPIKeys(): Promise<Record<string, unknown>> {
  deleteEncryptedAPIKeys();
  return {};
}

export function hasStoredEncryptedAPIKeys(): boolean {
  deleteEncryptedAPIKeys();
  return false;
}

export const encryptedApiKeyStorage = {
  save: saveEncryptedAPIKeys,
  load: loadEncryptedAPIKeys,
  has: hasStoredEncryptedAPIKeys,
  delete: deleteEncryptedAPIKeys,
};

export default encryptedApiKeyStorage;
