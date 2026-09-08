/**
 * SEC H-2 修复：本模块已"诚实化"。
 *
 * ⚠️ 安全警告 ⚠️
 * 本模块名为 SecureStorage，但实际行为是 **明文 localStorage 封装**，
 * 不提供任何加密保护。任何能访问 localStorage 的代码（XSS、恶意扩展、共享设备）
 * 都可读取此处存储的所有数据。
 *
 * 安全最佳实践：
 * - 敏感凭据（API keys、Provider secret、用户密码等）**不应**存于此处，
 *   应由后端加密存储（参考 backend/src/utils/encryption.ts 的 AES-256-GCM 实现）。
 * - 新代码请勿使用本模块存储敏感数据，应通过后端代理调用第三方 API。
 * - 本模块保留仅为向后兼容，后续应迁移至后端存储 + 短期 token 方案。
 *
 * @deprecated 本模块不提供加密保护，新代码不应使用。敏感数据请存于后端。
 */

// 存储前缀
const STORAGE_PREFIX = 'secure_';

// 旧版 XOR 加密密钥（仅用于读取旧数据，不可用于新数据"加密"——XOR 与密钥同存无保护意义）
const SIMPLE_KEY = 'ifs-fallback-key-2024';

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 旧版 XOR 解密（仅用于读取历史加密数据）
 */
function simpleDecrypt(encryptedText: string): string {
  // UTF-8 密文
  try {
    const xored = base64ToBytes(encryptedText);
    const data = new Uint8Array(xored.length);
    for (let i = 0; i < xored.length; i++) {
      data[i] = xored[i] ^ SIMPLE_KEY.charCodeAt(i % SIMPLE_KEY.length);
    }
    const decoded = new TextDecoder().decode(data);
    if (decoded) return decoded;
  } catch {
    // fall through
  }

  // 旧版 Latin1 密文
  try {
    const text = atob(encryptedText);
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ SIMPLE_KEY.charCodeAt(i % SIMPLE_KEY.length));
    }
    return result;
  } catch {
    return '';
  }
}

/**
 * 旧版 AES-GCM 解密（仅用于读取历史加密数据）
 */
async function legacyAesDecrypt(ciphertext: string): Promise<string> {
  try {
    const salt = localStorage.getItem(STORAGE_PREFIX + 'salt');
    if (!salt) return '';
    const machineKey = localStorage.getItem(STORAGE_PREFIX + 'machine_key');
    if (!machineKey) return '';

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(machineKey),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    const combined = new Uint8Array(atob(ciphertext).split('').map(c => c.charCodeAt(0)));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(decrypted);
  } catch {
    return '';
  }
}

/**
 * 尝试从历史加密格式中还原明文（XOR 或 AES-GCM）
 */
async function tryDecryptLegacy(raw: string): Promise<string> {
  // 先尝试当作明文 JSON
  try {
    JSON.parse(raw);
    return raw;
  } catch {
    // 不是合法 JSON，继续尝试解密
  }

  // 尝试 XOR 解密
  const simple = simpleDecrypt(raw);
  if (simple) {
    try {
      JSON.parse(simple);
      return simple;
    } catch {
      // 解密结果不是 JSON，继续
    }
  }

  // 尝试 AES-GCM 解密
  const aes = await legacyAesDecrypt(raw);
  if (aes) {
    try {
      JSON.parse(aes);
      return aes;
    } catch {
      // 解密结果不是 JSON
    }
  }

  return '';
}

export class SecureStorage {
  /**
   * SEC H-2 修复：本类不提供加密，仅是 localStorage 封装。
   * @deprecated 请勿用于存储敏感数据，新代码应使用后端加密存储。
   */
  static async setItem(key: string, value: unknown): Promise<void> {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch (error) {
      console.error('SecureStorage.setItem failed:', error);
    }
  }

  /**
   * SEC H-2 修复：明文读取，兼容旧加密数据并自动迁移为明文。
   * @deprecated 请勿用于存储敏感数据。
   */
  static async getItem<T = unknown>(key: string): Promise<T | null> {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      if (!raw) return null;

      // 先尝试明文 JSON
      try {
        return JSON.parse(raw) as T;
      } catch {
        // 不是明文 JSON，尝试旧加密格式
      }

      const decrypted = await tryDecryptLegacy(raw);
      if (decrypted) {
        // 自动迁移为明文存储
        localStorage.setItem(STORAGE_PREFIX + key, decrypted);
        return JSON.parse(decrypted) as T;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 异步删除数据
   */
  static async removeItem(key: string): Promise<void> {
    localStorage.removeItem(STORAGE_PREFIX + key);
    localStorage.removeItem(STORAGE_PREFIX + key + '_fallback');
    localStorage.removeItem(STORAGE_PREFIX + key + '_sync');
    localStorage.removeItem(STORAGE_PREFIX + key + '_raw');
  }

  /**
   * 清除所有安全存储数据
   */
  static async clear(): Promise<void> {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  /**
   * 同步存储数据（明文）
   */
  static setItemSync(key: string, value: unknown): void {
    try {
      localStorage.setItem(STORAGE_PREFIX + key + '_sync', JSON.stringify(value));
    } catch (error) {
      console.error('SecureStorage.setItemSync failed:', error);
    }
  }

  /**
   * 同步获取数据（明文，兼容旧加密数据）
   */
  static getItemSync<T = unknown>(key: string): T | null {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key + '_sync');
      if (!raw) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    } catch {
      return null;
    }
  }

  /**
   * 同步获取加密数据（兼容旧加密格式，返回原始字符串）
   */
  static getItemSyncEncrypted(key: string): string | null {
    try {
      return localStorage.getItem(STORAGE_PREFIX + key + '_sync');
    } catch {
      return null;
    }
  }
}