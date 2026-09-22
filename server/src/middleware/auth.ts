import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../types/env';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { isTokenRevoked } from '../utils/jwt';
import { redisService } from '../services/redis-service'; // PERF-04 修复：引入 Redis 缓存会员等级
import { getRequestAuthToken } from './security-session';
import { enforceUserAccess } from '../services/access-control-service';
import { sendAccessDenied } from './access-control';
import { isLocalOnlyMode } from '../utils/local-mode';
import { LOCAL_USER_ID, isLocalUser } from '../utils/local-user';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  membershipLevel?: string;
}

const DEFAULT_MEMBERSHIP_LEVEL = 'trial';
// 开源本地模式：所有匿名请求以本地用户身份放行，并直接解锁最高权限
const LOCAL_MEMBERSHIP_LEVEL = 'local';

function assignLocalUser(req: AuthRequest): boolean {
  if (!isLocalOnlyMode()) return false;
  req.userId = LOCAL_USER_ID;
  req.userRole = 'user';
  req.membershipLevel = LOCAL_MEMBERSHIP_LEVEL;
  return true;
}
const normalizeRole = (role?: string): string => (role || 'user').toLowerCase();

// PERF-04 修复：会员等级 Redis 缓存（TTL 5 分钟），避免每次请求查库
// 风险修复：添加 Redis 操作超时，防止 Redis 挂起导致所有认证请求阻塞
const MEMBERSHIP_CACHE_TTL = 300; // 5 分钟
const REDIS_TIMEOUT_MS = 100; // 100ms 超时

// P2 修复：缓存值结构化为 { level, endAt }，读取时校验 endAt 防止过期权益泄漏
interface MembershipCachePayload {
  level: string;
  endAt: string | null; // ISO 字符串；trial 用户为 null
}

// Membership cache and related functions removed after deleting membership login system
// Simplified auth no longer uses membershipLevel

const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token } = getRequestAuthToken(req);

    // 开源本地模式：无 token 的请求直接以本地用户放行，无需登录
    if (!token && assignLocalUser(req)) {
      return next();
    }

    if (!token) {
      return res.status(401).json({ 
        error: '未提供认证令牌',
        code: 'NO_TOKEN'
      });
    }
    
    if (!token || token.split('.').length !== 3) {
      // 开源本地模式：令牌格式异常也以本地用户放行
      if (assignLocalUser(req)) {
        return next();
      }
      return res.status(401).json({ 
        error: '无效的令牌格式',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }
    
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    
    // FIX-AUDIT-06: 兼容 decoded.id 和 decoded.userId 两种 JWT 载荷格式
    const resolvedUserId = decoded.userId || decoded.id;
    
    if (!resolvedUserId) {
      return res.status(401).json({ 
        error: '无效的令牌载荷',
        code: 'INVALID_TOKEN_PAYLOAD'
      });
    }

    const revoked = await isTokenRevoked(token, resolvedUserId, decoded.iat);
    if (revoked) {
      return res.status(401).json({
        error: '令牌已失效，请重新登录',
        code: 'TOKEN_REVOKED'
      });
    }
    
    req.userId = resolvedUserId;
    req.userRole = normalizeRole(decoded.role);

    const accessDecision = await enforceUserAccess({
      path: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userId: resolvedUserId,
      userRole: req.userRole,
    });
    if (!accessDecision.allowed) {
      return sendAccessDenied(res, accessDecision);
    }
    
    try {
      req.membershipLevel = DEFAULT_MEMBERSHIP_LEVEL;
    } catch (e) {
      req.membershipLevel = DEFAULT_MEMBERSHIP_LEVEL;
    }
    
    next();
  } catch (error: unknown) {
    // 开源本地模式：令牌解析失败也以本地用户放行
    if (assignLocalUser(req)) {
      return next();
    }
    if ((error instanceof Error ? error.name : 'Error') === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: '令牌已过期',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if ((error instanceof Error ? error.name : 'Error') === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: '无效的令牌',
        code: 'INVALID_TOKEN'
      });
    }
    
    return res.status(401).json({ 
      error: '认证失败',
      code: 'AUTH_FAILED'
    });
  }
};

export const adminMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  logger.debug('[Auth] adminMiddleware check:', req.userRole);
  // 开源本地模式：允许本地用户访问管理功能
  if (isLocalOnlyMode() && isLocalUser(req.userId)) {
    return next();
  }
  if (normalizeRole(req.userRole) !== 'admin') {
    return res.status(403).json({ 
      error: '需要管理员权限',
      code: 'FORBIDDEN'
    });
  }
  next();
};

export const requireRole = (role: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (isLocalOnlyMode() && isLocalUser(req.userId)) {
      return next();
    }
    if (normalizeRole(req.userRole) !== normalizeRole(role)) {
      return res.status(403).json({ 
        error: '权限不足',
        code: 'FORBIDDEN'
      });
    }
    next();
  };
};

export const requireAdmin = adminMiddleware;
export const requireAuth = authMiddleware;

export const getUserId = (req: AuthRequest): string | undefined => {
  return req.userId;
};

const optionalAuthMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token } = getRequestAuthToken(req);

    if (!token) {
      return next();
    }

    if (!token || token.split('.').length !== 3) {
      return next();
    }
    
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    
    // FIX-AUDIT-06: 兼容 decoded.id 和 decoded.userId
    const resolvedUserId = decoded.userId || decoded.id;
    
    if (resolvedUserId) {
      const revoked = await isTokenRevoked(token, resolvedUserId, decoded.iat);
      if (revoked) {
        return next();
      }

      req.userId = resolvedUserId;
      req.userRole = normalizeRole(decoded.role);

      const accessDecision = await enforceUserAccess({
        path: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userId: resolvedUserId,
        userRole: req.userRole,
      });
      if (!accessDecision.allowed) {
        return sendAccessDenied(res, accessDecision);
      }

      // 会员系统已移除：统一使用默认等级
      req.membershipLevel = DEFAULT_MEMBERSHIP_LEVEL;
    }
    
    next();
  } catch (error: unknown) {
    // ERR-04 修复：记录认证失败原因，区分"无 token"和"token 无效"
    if (error instanceof Error) {
      logger.debug('[Auth] optionalAuth token validation failed:', error.message);
    }
    next();
  }
};

export const authenticate = authMiddleware;
export const optionalAuth = optionalAuthMiddleware;
export { authMiddleware };

export function getUserIdFromPayload(user: any): string {
  if (!user) return '';
  if ('userId' in user) return user.userId;
  if ('id' in user) return user.id;
  return '';
}
