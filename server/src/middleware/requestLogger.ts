import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { loggingService } from '../services/logging-service';
import { maskRequestBody, maskRequestHeaders, maskQueryParams } from '../utils/dataMasking';

// FIX-AUDIT-04: 不再使用 getUserIdFromPayload(req.user)，因为 auth 中间件
// 只设置 req.userId 而非 req.user。直接使用 req.userId 获取已认证用户 ID。

// CFG-04 修复：移除分散的 Express.Request 全局声明，统一到 types/express.d.ts

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  const startTime = Date.now();

  req.requestId = requestId;
  req.startTime = startTime;

  req.originalBody = req.body;
  req.originalQuery = req.query;

  res.setHeader('X-Request-Id', requestId);

  const clientIp = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'Unknown';

  loggingService.info(`${req.method} ${req.path} - Request`, {
    requestId,
    method: req.method,
    path: req.path,
    query: maskQueryParams(req.query as Record<string, any>),
    params: req.params,
    body: maskRequestBody(req.body),
    headers: maskRequestHeaders(req.headers as Record<string, any>),
    ip: clientIp,
    userAgent,
    userId: req.userId || '',
    apiVersion: req.apiVersion,
    startTime,
  });

  const originalJson = res.json.bind(res);
  res.json = function(body: any) {
    const duration = Date.now() - startTime;
    // PERF-03 修复：使用 res.getHeader 获取已设置的 Content-Length，避免 JSON.stringify
    const contentLength = typeof body === 'string' ? Buffer.byteLength(body) : (res.getHeader('Content-Length') as number || JSON.stringify(body).length);

    if (res.statusCode >= 500) {
      loggingService.error(`${req.method} ${req.path} ${res.statusCode} ${duration}ms - Response`, {
        requestId,
        statusCode: res.statusCode,
        duration,
        contentLength,
        error: body.error,
        method: req.method,
        path: req.path,
        query: maskQueryParams(req.originalQuery as Record<string, any>),
        params: req.params,
        body: maskRequestBody(req.originalBody),
        headers: maskRequestHeaders(req.headers as Record<string, any>),
        ip: clientIp,
        userAgent,
        userId: req.userId || '',
        apiVersion: req.apiVersion,
        startTime,
      });
    } else if (res.statusCode >= 400) {
      loggingService.warn(`${req.method} ${req.path} ${res.statusCode} ${duration}ms - Response`, {
        requestId,
        statusCode: res.statusCode,
        duration,
        contentLength,
        error: body.error,
        method: req.method,
        path: req.path,
        query: maskQueryParams(req.originalQuery as Record<string, any>),
        params: req.params,
        body: maskRequestBody(req.originalBody),
        headers: maskRequestHeaders(req.headers as Record<string, any>),
        ip: clientIp,
        userAgent,
        userId: req.userId || '',
        apiVersion: req.apiVersion,
        startTime,
      });
    } else {
      loggingService.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms - Response`, {
        requestId,
        statusCode: res.statusCode,
        duration,
        contentLength,
        method: req.method,
        path: req.path,
        query: maskQueryParams(req.originalQuery as Record<string, any>),
        params: req.params,
        body: maskRequestBody(req.originalBody),
        headers: maskRequestHeaders(req.headers as Record<string, any>),
        ip: clientIp,
        userAgent,
        userId: req.userId || '',
        apiVersion: req.apiVersion,
        startTime,
      });
    }

    if (duration > 3000) {
      loggingService.warn('Slow request detected', {
        requestId,
        method: req.method,
        path: req.path,
        duration,
        threshold: 3000,
      });
    }

    return originalJson(body);
  };

  next();
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  
  if (forwarded) {
    const ips = Array.isArray(forwarded) 
      ? forwarded[0] 
      : forwarded.split(',')[0];
    return ips.trim();
  }
  
  return req.ip || 
         req.socket.remoteAddress || 
         'Unknown';
}
