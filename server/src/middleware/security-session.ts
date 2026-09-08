import { randomBytes, timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { config } from '../types/env';

const SESSION_COOKIE = 'app_session';
const CSRF_COOKIE = 'app_csrf';
const COOKIE_SESSION_SENTINEL = 'cookie-session';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function parseCookies(header?: string): Record<string, string> {
  if (!header) return {};
  const result: Record<string, string> = {};
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    try {
      result[key] = decodeURIComponent(value);
    } catch {
      result[key] = value;
    }
  }
  return result;
}

function readBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice(7).trim() || undefined;
}

export function getRequestAuthToken(req: Request): { token?: string; source: 'bearer' | 'cookie' | 'none' } {
  const bearer = readBearerToken(req);
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (bearer && bearer !== COOKIE_SESSION_SENTINEL) return { token: bearer, source: 'bearer' };
  // Web 客户端只持久化非敏感哨兵。自定义 Authorization Header 同时提供
  // CSRF 防护，真实 JWT 仅从 HttpOnly Cookie 读取。
  if (bearer === COOKIE_SESSION_SENTINEL && token) return { token, source: 'bearer' };
  return token ? { token, source: 'cookie' } : { source: 'none' };
}

function safeTokenEqual(left?: string, right?: string): boolean {
  if (!left || !right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function findToken(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const value = body as Record<string, any>;
  if (typeof value.token === 'string') return value.token;
  if (value.data && typeof value.data.token === 'string') return value.data.token;
  return undefined;
}

function setSessionCookies(res: Response, token: string): void {
  const secure = config.nodeEnv === 'production';
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_MS,
  });
  res.cookie(CSRF_COOKIE, randomBytes(32).toString('base64url'), {
    httpOnly: false,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_MS,
  });
}

export function sessionCookieBridge(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);
  // Express strips the router mount path from req.path. Use originalUrl so
  // /api/v1/auth/login and /api/v1/auth/logout are recognized inside authRouter.
  const requestPath = (req.originalUrl || `${req.baseUrl || ''}${req.path || ''}`).split('?', 1)[0];
  const isAuthRoute = requestPath.includes('/auth/');
  const isLogout = requestPath.endsWith('/auth/logout');
  const usesCookieSession = req.get('X-Auth-Mode') === 'cookie';
  res.json = function secureJson(body: any) {
    if (isLogout) {
      const secure = config.nodeEnv === 'production';
      res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
      res.clearCookie(CSRF_COOKIE, { httpOnly: false, secure, sameSite: 'lax', path: '/' });
    } else if (isAuthRoute) {
      const token = findToken(body);
      if (token) setSessionCookies(res, token);
    }

    if (!usesCookieSession || !isAuthRoute || !body || typeof body !== 'object') {
      return originalJson(body);
    }

    const sanitizedBody = { ...body };
    if (typeof sanitizedBody.token === 'string') {
      sanitizedBody.token = COOKIE_SESSION_SENTINEL;
    }
    delete sanitizedBody.refreshToken;
    if (sanitizedBody.data && typeof sanitizedBody.data === 'object') {
      sanitizedBody.data = { ...sanitizedBody.data };
      if (typeof sanitizedBody.data.token === 'string') {
        sanitizedBody.data.token = COOKIE_SESSION_SENTINEL;
      }
      delete sanitizedBody.data.refreshToken;
    }
    return originalJson(sanitizedBody);
  };
  next();
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return next();
  // 认证路由（登录/注册/登出）豁免 CSRF 校验：
  // 这些路由本身有密码/凭据保护，且用户可能在持有旧 session cookie 时重新登录
  const requestPath = (req.originalUrl || `${req.baseUrl || ''}${req.path || ''}`).split('?', 1)[0];
  if (requestPath.includes('/auth/')) return next();
  const auth = getRequestAuthToken(req);
  if (auth.source !== 'cookie') return next();

  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[CSRF_COOKIE];
  const headerValue = req.headers['x-csrf-token'];
  const headerToken = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!safeTokenEqual(cookieToken, headerToken)) {
    res.status(403).json({
      success: false,
      error: 'CSRF验证失败',
      code: 'CSRF_VALIDATION_FAILED',
    });
    return;
  }
  next();
}
