/** @deprecated API 密钥仅允许保存在后端。 */

const STORAGE_KEY = 'infinite-flow-api-keys';

// 保存API密钥到本地
export function saveAPIKeysToLocal(_apiKeys: Record<string, unknown>): void {
  deleteAPIKeysFromLocal();
  console.warn('[APIKeys] 已忽略本地保存请求，请使用后端 Provider 配置');
}

// 从本地读取API密钥
export function loadAPIKeysFromLocal(): Record<string, unknown> {
  deleteAPIKeysFromLocal();
  return {};
}

// 检查是否已保存
export function hasStoredAPIKeys(): boolean {
  deleteAPIKeysFromLocal();
  return false;
}

// 删除API密钥
export function deleteAPIKeysFromLocal(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.warn('[APIKeys] 已删除');
  } catch (error) {
    console.error('[APIKeys] 删除失败:', error);
  }
}

// 导出统一接口
export const apiKeyStorage = {
  save: saveAPIKeysToLocal,
  load: loadAPIKeysFromLocal,
  has: hasStoredAPIKeys,
  delete: deleteAPIKeysFromLocal,
};

export default apiKeyStorage;
