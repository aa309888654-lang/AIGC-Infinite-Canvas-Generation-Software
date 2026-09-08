import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../types/env';
import { redisService } from '../services/redis-service';

export interface TokenPayload {
  userId: string;
  username: string;
  role: string;
}

const DEFAULT_REVOKED_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const TOKEN_BLACKLIST_PREFIX = 'jwt:blacklist';
const USER_TOKENS_VALID_AFTER_PREFIX = 'jwt:user-valid-after';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getBlacklistKey(token: string): string {
  return `${TOKEN_BLACKLIST_PREFIX}:${hashToken(token)}`;
}

function getUserValidAfterKey(userId: string): string {
  return `${USER_TOKENS_VALID_AFTER_PREFIX}:${userId}`;
}

function getTokenTtlSeconds(token: string): number {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  if (!decoded?.exp) {
    return DEFAULT_REVOKED_TOKEN_TTL_SECONDS;
  }

  return Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
}

export function getBearerToken(authHeader?: string | string[]): string | null {
  if (!authHeader || Array.isArray(authHeader)) {
    return null;
  }

  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  return token || null;
}

export const generateToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, config.jwt.secret) as TokenPayload;
};

// P3 修复 #24：Refresh Token 机制
// - Access Token 短期有效（默认 7d，建议缩短为 15m~2h）
// - Refresh Token 长期有效（默认 30d），仅用于换取新的 Access Token
// - Refresh Token 使用独立密钥，泄露后无法直接访问 API
// - 存储于 Redis 白名单，吊销时删除即可
const REFRESH_TOKEN_PREFIX = 'jwt:refresh';
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export async function generateRefreshToken(payload: TokenPayload): Promise<string> {
  const refreshSecret = config.jwt.refreshSecret || config.jwt.secret;
  const token = jwt.sign({ ...payload, type: 'refresh' }, refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
  });
  // 存入 Redis 白名单，支持主动吊销
  const tokenHash = hashToken(token);
  await redisService.set(
    `${REFRESH_TOKEN_PREFIX}:${payload.userId}:${tokenHash}`,
    '1',
    REFRESH_TOKEN_TTL_SECONDS
  );
  return token;
}

export async function verifyRefreshToken(token: string): Promise<TokenPayload | null> {
  const refreshSecret = config.jwt.refreshSecret || config.jwt.secret;
  try {
    const decoded = jwt.verify(token, refreshSecret) as TokenPayload & { type?: string };
    if (decoded.type !== 'refresh') return null;
    // 校验 Redis 白名单（是否已被吊销）
    const tokenHash = hashToken(token);
    const exists = await redisService.get(`${REFRESH_TOKEN_PREFIX}:${decoded.userId}:${tokenHash}`);
    if (!exists) return null;
    return { userId: decoded.userId, username: decoded.username, role: decoded.role };
  } catch {
    return null;
  }
}

export async function revokeRefreshToken(token: string): Promise<boolean> {
  try {
    const refreshSecret = config.jwt.refreshSecret || config.jwt.secret;
    const decoded = jwt.verify(token, refreshSecret) as TokenPayload & { type?: string };
    if (decoded.type !== 'refresh') return false;
    const tokenHash = hashToken(token);
    const result = await redisService.del(`${REFRESH_TOKEN_PREFIX}:${decoded.userId}:${tokenHash}`);
    return result > 0;
  } catch {
    return false;
  }
}

export async function blacklistToken(token: string): Promise<boolean> {
  const ttlSeconds = getTokenTtlSeconds(token);
  if (ttlSeconds <= 0) {
    return true;
  }

  const result = await redisService.set(getBlacklistKey(token), '1', ttlSeconds);
  return result === 'OK';
}

export async function revokeUserTokens(userId: string): Promise<boolean> {
  const validAfter = String(Math.floor(Date.now() / 1000));
  const result = await redisService.set(getUserValidAfterKey(userId), validAfter);
  return result === 'OK';
}

export async function isTokenRevoked(
  token: string,
  userId: string,
  issuedAt?: number
): Promise<boolean> {
  const blacklisted = await redisService.get(getBlacklistKey(token));
  if (blacklisted) {
    return true;
  }

  const validAfterRaw = await redisService.get(getUserValidAfterKey(userId));
  if (!validAfterRaw) {
    return false;
  }

  const validAfter = Number(validAfterRaw);
  if (!Number.isFinite(validAfter)) {
    return false;
  }

  if (!issuedAt) {
    return true;
  }

  return issuedAt < validAfter;
}
