import { APIKeys } from '@/types/ai-models';

declare global {
  interface Window {
    __TAURI__?: unknown;
  }
}

/** @deprecated Provider 密钥现在仅由后端加密存储。 */
class FileStorageService {
  private readonly API_KEYS_FILE = 'api-keys.json';

  async saveApiKeysToFile(_apiKeys: APIKeys): Promise<void> {
    await this.clearApiKeys();
    console.warn('[FileStorage] 已忽略客户端密钥保存请求，请使用后端 Provider 配置');
  }

  async loadApiKeysFromFile(): Promise<APIKeys | null> {
    await this.clearApiKeys();
    return null;
  }

  async clearApiKeys(): Promise<void> {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('infinite-flow-api-keys');
      } catch {
        // Storage may be unavailable in private browsing mode.
      }
    }

    if (typeof window !== 'undefined' && window.__TAURI__) {
      try {
        const fsModule = await import('@tauri-apps/plugin-fs');
        const pathModule = await import('@tauri-apps/api/path');
        const appDir = await pathModule.appDataDir();
        const filePath = await pathModule.join(appDir, this.API_KEYS_FILE);
        await fsModule.remove(filePath);
      } catch {
        // The legacy file may not exist.
      }
    }
  }
}

export const fileStorageService = new FileStorageService();
