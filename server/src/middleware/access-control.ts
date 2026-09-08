import type { NextFunction, Request, Response } from 'express';
import { enforceIpAccess, type AccessDecision } from '../services/access-control-service';
import { logger } from '../utils/logger';

export function sendAccessDenied(res: Response, decision: AccessDecision): Response {
  if (decision.retryAfterSeconds) {
    res.setHeader('Retry-After', String(decision.retryAfterSeconds));
  }
  return res.status(decision.status || 403).json({
    success: false,
    error: decision.message || '访问被拒绝',
    code: decision.code || 'ACCESS_BLOCKED',
    details: {
      reason: decision.reason,
      expiresAt: decision.expiresAt,
      retryAfterSeconds: decision.retryAfterSeconds,
    },
  });
}

export async function accessControlIpMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const decision = await enforceIpAccess({
      path: req.originalUrl,
      method: req.method,
      ip: req.ip,
    });
    if (!decision.allowed) return sendAccessDenied(res, decision);
    next();
  } catch (error) {
    logger.error('[AccessControl] IP middleware failed open:', error instanceof Error ? error.message : String(error));
    next();
  }
}

