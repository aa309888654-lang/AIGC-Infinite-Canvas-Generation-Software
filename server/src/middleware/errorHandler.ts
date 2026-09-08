import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

import {
  AppError,
  ErrorCode,
  ErrorDetail,
  ErrorResponse,
  ErrorMessages,
  HttpStatusCode,
  isAppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  QuotaExceededError,
  AIProviderError,
  AIProviderTimeoutError,
  AIProviderAuthError,
  AIProviderQuotaError,
  PaymentError,
  ExternalServiceError,
  DatabaseError,
  StorageServiceError,
} from '../types/error';
import { logger } from '../utils/logger';
import { captureException } from '../services/sentry-service';

function generateRequestId(): string {
  return uuidv4();
}

function getRequestId(req?: Request): string {
  const incomingRequestId = req?.headers['x-request-id'];
  if (Array.isArray(incomingRequestId)) return incomingRequestId[0] || generateRequestId();
  if (typeof incomingRequestId === 'string' && incomingRequestId.trim()) return incomingRequestId.trim();
  return generateRequestId();
}

function shouldExposeDetails(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.EXPOSE_ERROR_DETAILS === 'true';
}

function normalizeStatusCode(statusCode?: number): number {
  if (!statusCode || Number.isNaN(statusCode)) return HttpStatusCode.INTERNAL_SERVER_ERROR;
  if (statusCode < 400 || statusCode > 599) return HttpStatusCode.INTERNAL_SERVER_ERROR;
  return statusCode;
}

function buildErrorResponse(
  errorCode: ErrorCode,
  message: string,
  statusCode: number,
  details?: ErrorDetail[],
  path?: string,
  method?: string,
  requestId: string = generateRequestId(),
): ErrorResponse {
  const safeDetails = statusCode >= 500 && !shouldExposeDetails() ? undefined : details;
  const resolvedMessage = message || ErrorMessages[errorCode] || '未知错误';

  return {
    success: false,
    message: resolvedMessage, // 风险修复：添加顶层 message 字段，与 400 错误格式保持一致，前端可统一读取 response.message
    error: {
      code: errorCode,
      message: resolvedMessage,
      details: safeDetails,
      timestamp: new Date().toISOString(),
      path,
      method,
      requestId,
    },
  };
}

const ERROR_FIELD_MAPPINGS: Record<string, Record<string, string>> = {
  User: {
    email: '邮箱',
    username: '用户名',
    password: '密码',
    phone: '手机号',
  },
  Payment: {
    orderNo: '订单号',
    amount: '金额',
    mch_id: '商户号',
  },
  Membership: {
    name: '会员名称',
    duration: '会员时长',
    price: '会员价格',
  },
};

function translateFieldName(model: string, field: string): string {
  return ERROR_FIELD_MAPPINGS[model]?.[field] || field || '字段';
}

function toLoggableError(err: Error, requestId: string, req: Request): Record<string, unknown> {
  return {
    requestId,
    name: err.name,
    message: err.message,
    stack: shouldExposeDetails() ? err.stack : undefined,
    path: req.path,
    method: req.method,
    query: req.query,
    userId: (req as any).userId,
  };
}

function handleZodError(error: ZodError, path?: string, method?: string, requestId?: string): ErrorResponse {
  const details: ErrorDetail[] = error.errors.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
    value: (issue as any).input,
  }));

  return buildErrorResponse(
    ErrorCode.VALIDATION_ERROR,
    '输入数据验证失败',
    HttpStatusCode.BAD_REQUEST,
    details,
    path,
    method,
    requestId,
  );
}

function handlePrismaError(
  error: Prisma.PrismaClientKnownRequestError,
  path?: string,
  method?: string,
  requestId?: string,
): ErrorResponse {
  const modelName = (error.meta?.modelName as string) || '';
  const targets = Array.isArray(error.meta?.target) ? (error.meta?.target as string[]) : [];

  switch (error.code) {
    case 'P2002': {
      const fields = targets.map((target) => translateFieldName(modelName, target));
      const fieldMessage = fields.length > 0 ? fields.join('、') : '唯一字段';
      return buildErrorResponse(
        ErrorCode.DUPLICATE_RESOURCE,
        `${modelName || '资源'}中 ${fieldMessage} 已存在`,
        HttpStatusCode.CONFLICT,
        [],
        path,
        method,
        requestId,
      );
    }

    case 'P2025': {
      return buildErrorResponse(
        ErrorCode.NOT_FOUND,
        `${modelName || '资源'}不存在`,
        HttpStatusCode.NOT_FOUND,
        [],
        path,
        method,
        requestId,
      );
    }

    case 'P2003': {
      const field = translateFieldName(modelName, (error.meta?.field_name as string) || '');
      return buildErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `${field} 所引用的 ${modelName || '关联资源'}不存在`,
        HttpStatusCode.BAD_REQUEST,
        [],
        path,
        method,
        requestId,
      );
    }

    case 'P2014': {
      return buildErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        '存在关联数据，无法删除',
        HttpStatusCode.CONFLICT,
        [],
        path,
        method,
        requestId,
      );
    }

    default: {
      return buildErrorResponse(
        ErrorCode.DATABASE_ERROR,
        '数据库操作失败',
        HttpStatusCode.INTERNAL_SERVER_ERROR,
        [{ field: 'database', message: error.message, code: error.code }],
        path,
        method,
        requestId,
      );
    }
  }
}

function handlePrismaValidationError(
  _error: Prisma.PrismaClientValidationError,
  path?: string,
  method?: string,
  requestId?: string,
): ErrorResponse {
  return buildErrorResponse(
    ErrorCode.DATABASE_ERROR,
    '数据格式错误',
    HttpStatusCode.BAD_REQUEST,
    [{ message: '数据库查询参数格式不正确' }],
    path,
    method,
    requestId,
  );
}

function handlePrismaUnknownError(
  _error: Prisma.PrismaClientUnknownRequestError,
  path?: string,
  method?: string,
  requestId?: string,
): ErrorResponse {
  return buildErrorResponse(
    ErrorCode.DATABASE_ERROR,
    '数据库操作异常',
    HttpStatusCode.INTERNAL_SERVER_ERROR,
    [{ message: '数据库连接可能存在问题' }],
    path,
    method,
    requestId,
  );
}

function getPrismaErrorStatusCode(error: Prisma.PrismaClientKnownRequestError): number {
  switch (error.code) {
    case 'P2002':
      return HttpStatusCode.CONFLICT;
    case 'P2025':
      return HttpStatusCode.NOT_FOUND;
    case 'P2003':
      return HttpStatusCode.BAD_REQUEST;
    case 'P2014':
      return HttpStatusCode.CONFLICT;
    default:
      return HttpStatusCode.INTERNAL_SERVER_ERROR;
  }
}

function getErrorResponse(err: Error, req: Request, requestId: string): { statusCode: number; body: ErrorResponse } {
  if (err.name === 'PayloadTooLargeError') {
    return {
      statusCode: HttpStatusCode.PAYLOAD_TOO_LARGE,
      body: buildErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        '上传文件过大',
        HttpStatusCode.PAYLOAD_TOO_LARGE,
        undefined,
        req.path,
        req.method,
        requestId,
      ),
    };
  }

  if (err instanceof SyntaxError && 'body' in err) {
    return {
      statusCode: HttpStatusCode.BAD_REQUEST,
      body: buildErrorResponse(
        ErrorCode.INVALID_INPUT,
        'JSON格式错误',
        HttpStatusCode.BAD_REQUEST,
        undefined,
        req.path,
        req.method,
        requestId,
      ),
    };
  }

  if (err instanceof AppError) {
    const statusCode = normalizeStatusCode(err.statusCode);
    return {
      statusCode,
      body: buildErrorResponse(
        err.errorCode,
        err.message,
        statusCode,
        err.details,
        req.path,
        req.method,
        requestId,
      ),
    };
  }

  if (err instanceof ZodError) {
    return {
      statusCode: HttpStatusCode.BAD_REQUEST,
      body: handleZodError(err, req.path, req.method, requestId),
    };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      statusCode: getPrismaErrorStatusCode(err),
      body: handlePrismaError(err, req.path, req.method, requestId),
    };
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.error('[PrismaValidationError]', toLoggableError(err, requestId, req));
    return {
      statusCode: HttpStatusCode.BAD_REQUEST,
      body: handlePrismaValidationError(err, req.path, req.method, requestId),
    };
  }

  if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    logger.error('[PrismaUnknownError]', toLoggableError(err, requestId, req));
    return {
      statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
      body: handlePrismaUnknownError(err, req.path, req.method, requestId),
    };
  }

  if (err instanceof TokenExpiredError) {
    return {
      statusCode: HttpStatusCode.UNAUTHORIZED,
      body: buildErrorResponse(
        ErrorCode.AUTHENTICATION_ERROR,
        '登录已过期，请重新登录',
        HttpStatusCode.UNAUTHORIZED,
        undefined,
        req.path,
        req.method,
        requestId,
      ),
    };
  }

  if (err instanceof JsonWebTokenError) {
    return {
      statusCode: HttpStatusCode.UNAUTHORIZED,
      body: buildErrorResponse(
        ErrorCode.AUTHENTICATION_ERROR,
        '无效的认证令牌',
        HttpStatusCode.UNAUTHORIZED,
        undefined,
        req.path,
        req.method,
        requestId,
      ),
    };
  }

  if (err.name === 'AbortError' || err.name === 'TimeoutError') {
    return {
      statusCode: HttpStatusCode.GATEWAY_TIMEOUT,
      body: buildErrorResponse(
        ErrorCode.TIMEOUT,
        '请求处理超时，请稍后重试',
        HttpStatusCode.GATEWAY_TIMEOUT,
        undefined,
        req.path,
        req.method,
        requestId,
      ),
    };
  }

  const statusCode = normalizeStatusCode((err as any).statusCode || (err as any).status);
  const message = statusCode >= 500 && !shouldExposeDetails()
    ? '服务器内部错误，请稍后重试'
    : err.message || '服务器内部错误，请稍后重试';

  return {
    statusCode,
    body: buildErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      message,
      statusCode,
      shouldExposeDetails() ? [{ message: err.stack || err.message }] : undefined,
      req.path,
      req.method,
      requestId,
    ),
  };
}

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  const requestId = getRequestId(req);

  if (!res.headersSent) {
    res.setHeader('X-Request-Id', requestId);
  }

  if (res.headersSent) {
    logger.warn('[ErrorHandler] 响应头已发送，交给 Express 默认错误处理', toLoggableError(err, requestId, req));
    next(err);
    return;
  }

  const { statusCode, body } = getErrorResponse(err, req, requestId);

  if (statusCode >= 500) {
    logger.error('[ErrorHandler] 服务端错误', toLoggableError(err, requestId, req));
    // P0 修复：5xx 错误上报 Sentry
    captureException(err, {
      requestId,
      path: req.path,
      method: req.method,
      userId: (req as any).userId,
    });
  } else {
    logger.warn('[ErrorHandler] 请求处理失败', {
      requestId,
      statusCode,
      code: body.error.code,
      message: body.error.message,
      path: req.path,
      method: req.method,
      userId: (req as any).userId,
    });
  }

  res.status(statusCode).json(body);
}

export const asyncHandler = <T extends RequestHandler>(handler: T): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError('接口不存在'));
}

// 导出所有错误类便于统一导入
export {
  AppError,
  ErrorCode,
  ErrorDetail,
  ErrorResponse,
  ErrorMessages,
  HttpStatusCode,
  isAppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  QuotaExceededError,
  AIProviderError,
  AIProviderTimeoutError,
  AIProviderAuthError,
  AIProviderQuotaError,
  PaymentError,
  ExternalServiceError,
  DatabaseError,
  StorageServiceError,
} from '../types/error';
