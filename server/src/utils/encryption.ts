/**
 * 加密工具模块
 * 使用AES-256-GCM算法加密敏感数据
 * 符合GDPR和行业最佳实践
 */

import crypto from 'crypto';
import { config } from '../types/env';
import logger from './logger';
import { isLocalOnlyMode } from './local-mode';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits for key derivation

/**
 * 缓存加密密钥，避免每次加密/解密都重新派生（PBKDF2 10000 次迭代非常昂贵）
 * 密钥在进程生命周期内不变，安全缓存
 */
let _cachedPrimaryKey: Buffer | null = null;
let _cachedFallbackKeys: Buffer[] | null = null;
let _keyWarningLogged = false;

/**
 * 已知无法解密的密文前缀（IV 前 16 字符）集合，用于抑制重复的解密失败日志。
 * 仅用于日志去重，不影响解密逻辑本身。
 */
const _decryptFailureLogged = new Set<string>();

function getEncryptionKey(): Buffer {
  if (_cachedPrimaryKey !== null) {
    return _cachedPrimaryKey;
  }

  const keyHex = process.env.ENCRYPTION_KEY;
  
  if (!keyHex) {
    // 生产环境必须设置加密密钥
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '⚠️ 生产环境错误: ENCRYPTION_KEY 必须设置\n' +
        '⚠️ 请运行: openssl rand -hex 32\n' +
        '⚠️ 并将生成的密钥设置为 ENCRYPTION_KEY 环境变量'
      );
    }
    
    // 开发环境使用稳定的默认密钥（基于项目路径生成）
    if (!_keyWarningLogged) {
      const message = 'ENCRYPTION_KEY环境变量未设置，使用开发环境默认密钥（基于项目路径 PBKDF2 派生）';
      if (isLocalOnlyMode()) {
        logger.debug(message);
      } else {
        logger.warn(message);
      }
      _keyWarningLogged = true;
    }
    
    // 使用 PBKDF2 从项目路径派生稳定的开发密钥
    const devSalt = process.cwd() || 'aicg-dev-salt';
    _cachedPrimaryKey = crypto.pbkdf2Sync(devSalt, 'aicg-dev-salt', 10000, 32, 'sha256');
    return _cachedPrimaryKey;
  }
  
  if (/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    _cachedPrimaryKey = Buffer.from(keyHex, 'hex');
    return _cachedPrimaryKey;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'ENCRYPTION_KEY长度必须为64个十六进制字符（32字节），' +
      '请运行: openssl rand -hex 32'
    );
  }

  // 非标准 hex 格式：使用 PBKDF2 派生（仅警告一次，避免日志洪水）
  if (!_keyWarningLogged) {
    const message = 'ENCRYPTION_KEY非标准hex格式，使用PBKDF2派生密钥（已缓存，仅派生一次）';
    if (isLocalOnlyMode()) {
      logger.debug(message);
    } else {
      logger.warn(message);
    }
    _keyWarningLogged = true;
  }
  _cachedPrimaryKey = crypto.pbkdf2Sync(keyHex, 'aicg-key-salt', 10000, 32, 'sha256');
  return _cachedPrimaryKey;
}

function deriveEncryptionKey(value: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Buffer.from(value, 'hex');
  }
  return crypto.pbkdf2Sync(value, 'aicg-key-salt', 10000, 32, 'sha256');
}

function getFallbackDecryptionKeys(): Buffer[] {
  if (_cachedFallbackKeys !== null) {
    return _cachedFallbackKeys;
  }
  if (process.env.NODE_ENV === 'production') {
    _cachedFallbackKeys = [];
    return _cachedFallbackKeys;
  }
  const primary = getEncryptionKey();
  const keys: Buffer[] = [];
  const legacyKeys = (process.env.LEGACY_ENCRYPTION_KEYS || '')
    .split(/[;,]/)
    .map(key => key.trim())
    .filter(Boolean);

  for (const legacyKey of legacyKeys) {
    const key = deriveEncryptionKey(legacyKey);
    if (!primary.equals(key) && !keys.some(existing => existing.equals(key))) {
      keys.push(key);
    }
  }

  const cwdKey = deriveEncryptionKey(process.cwd() || 'aicg-dev-salt');
  if (!primary.equals(cwdKey) && !keys.some(existing => existing.equals(cwdKey))) {
    keys.push(cwdKey);
  }

  _cachedFallbackKeys = keys;
  return _cachedFallbackKeys;
}

/**
 * 加密文本
 * @param plaintext - 要加密的明文
 * @returns 加密后的字符串格式: iv:authTag:ciphertext (全部hex编码)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext || plaintext.trim().length === 0) {
    throw new Error('加密内容不能为空');
  }
  
  try {
    const key = getEncryptionKey();
    
    // 生成随机IV
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // 创建cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH
    });
    
    // 加密数据
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // 获取认证标签
    const authTag = cipher.getAuthTag();
    
    // 组合: IV + AuthTag + Ciphertext
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error: unknown) {
    logger.error('加密失败', { error: (error instanceof Error ? error.message : String(error)) });
    throw new Error('数据加密失败');
  }
}

export function encryptForStorage(text: string): string {
  // SEC-12 修复：所有环境都强制加密
  // P0 修复：DEBUG_ENCRYPTION 旁路仅在非生产环境生效，防止误配导致明文落库
  if (process.env.DEBUG_ENCRYPTION === 'true' && process.env.NODE_ENV !== 'production') {
    return text;
  }
  return encrypt(text);
}

export function decryptFromStorage(text: string): string {
  if (!isEncrypted(text)) {
    return text;
  }
  try {
    return decrypt(text);
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      throw err;
    }
    const failureKey = text.substring(0, 32);
    if (!_decryptFailureLogged.has(failureKey)) {
      logger.warn('decryptFromStorage 解密失败，开发环境下返回原始密文以允许登录排查（同一密文后续不再重复记录）', {
        error: err instanceof Error ? err.message : String(err),
        preview: text.substring(0, 40) + '...',
      });
      _decryptFailureLogged.add(failureKey);
    }
    return text;
  }
}

/**
 * 解密文本
 * @param encryptedText - 加密字符串格式: iv:authTag:ciphertext
 * @returns 解密后的明文
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText || !encryptedText.includes(':')) {
    throw new Error('无效的加密数据格式');
  }
  
  // 尝试用主密钥解密，失败后依次尝试回退密钥
  const primary = getEncryptionKey();
  const fallbacks = getFallbackDecryptionKeys();
  const keysToTry = [primary, ...fallbacks];
  
  let lastError: Error | null = null;
  
  for (const key of keysToTry) {
    try {
      return decryptWithKey(encryptedText, key);
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      continue;
    }
  }
  
  const failureKey = encryptedText.substring(0, 32);
  if (!_decryptFailureLogged.has(failureKey)) {
    logger.error('解密失败（所有密钥均无法解密，同一密文后续不再重复记录）', { error: lastError?.message });
    _decryptFailureLogged.add(failureKey);
  }
  throw new Error('数据解密失败');
}

function decryptWithKey(encryptedText: string, key: Buffer): string {
  // 分割加密字符串
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('加密数据格式错误');
  }
  
  const [ivHex, authTagHex, ciphertext] = parts;
  
  // 转换hex到Buffer
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  // 验证IV长度
  if (iv.length !== IV_LENGTH) {
    throw new Error('IV长度不正确');
  }
  
  // 创建decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH
  });
  
  // 设置认证标签
  decipher.setAuthTag(authTag);
  
  // 解密数据
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * 检查数据是否已加密
 * @param text - 要检查的文本
 * @returns 是否已加密
 */
export function isEncrypted(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }
  
  // 检查格式: 32hex:32hex:hex
  const parts = text.split(':');
  if (parts.length !== 3) {
    return false;
  }
  
  const [iv, authTag, ciphertext] = parts;
  
  // IV应该是32个hex字符 (16字节)
  // AuthTag应该是32个hex字符 (16字节)
  // Ciphertext应该是有效的hex
  const hexRegex = /^[a-f0-9]+$/i;
  
  return (
    iv.length === 32 && 
    authTag.length === 32 && 
    hexRegex.test(ciphertext) &&
    ciphertext.length > 0
  );
}

/**
 * 生成强随机密钥
 * 用于生成ENCRYPTION_KEY环境变量值
 * @returns 64个十六进制字符的密钥
 */

export function maskApiKey(apiKey: string, visibleChars: number = 4): string {
  if (!apiKey || apiKey.length <= visibleChars * 2) {
    return '****';
  }
  
  const prefix = apiKey.substring(0, visibleChars);
  const suffix = apiKey.substring(apiKey.length - visibleChars);
  const maskedLength = apiKey.length - visibleChars * 2;
  
  return `${prefix}${'*'.repeat(Math.min(maskedLength, 8))}${suffix}`;
}

/**
 * 验证API密钥格式（不暴露内容）
 * @param apiKey - API密钥
 * @returns 是否有效
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }
  
  const minLength = 8;
  const maxLength = 512;
  
  return apiKey.length >= minLength && apiKey.length <= maxLength;
}

const DEV_HASH_PEPPER = 'aicg-pepper-2024';
const HASH_PEPPER_HEX_PATTERN = /^[0-9a-fA-F]{64}$/;

function getHashSalt(): Buffer {
  const pepperHex = process.env.HASH_PEPPER;
  if (pepperHex && HASH_PEPPER_HEX_PATTERN.test(pepperHex)) {
    return Buffer.from(pepperHex, 'hex');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('HASH_PEPPER 未设置或格式不正确（需 64 位 hex），生产环境拒绝执行查询哈希');
  }

  return crypto.pbkdf2Sync(pepperHex || DEV_HASH_PEPPER, 'aicg-hash-salt', 10000, 32, 'sha256');
}

export function hashForLookup(plaintext: string): string {
  if (!plaintext || plaintext.trim().length === 0) {
    throw new Error('待哈希内容不能为空');
  }
  
  const salt = getHashSalt();
  const hash = crypto.pbkdf2Sync(plaintext.toLowerCase().trim(), salt, 100000, 32, 'sha256');
  return hash.toString('hex');
}

export function normalizePhone(phone: string, countryCode: string = '86'): string {
  if (!phone) return phone;
  let normalized = phone.replace(/\s+/g, '').replace(/-/g, '');
  if (countryCode === '86' && !normalized.startsWith('+86') && !normalized.startsWith('86')) {
    normalized = '+86' + normalized;
  }
  return normalized;
}

export function normalizeEmail(email: string): string {
  if (!email) return email;
  return email.toLowerCase().trim();
}
