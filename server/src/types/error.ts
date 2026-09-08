import { ErrorCode } from '../shared/types';

export { ErrorCode };

export enum HttpStatusCode {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  TOO_MANY_REQUESTS = 429,
  UNPROCESSABLE_ENTITY = 422,
  PAYLOAD_TOO_LARGE = 413,
  INTERNAL_SERVER_ERROR = 500,
  SERVICE_UNAVAILABLE = 503,
  BAD_GATEWAY = 502,
  GATEWAY_TIMEOUT = 504,
}

export interface ErrorDetail {
  field?: string;
  message: string;
  code?: string;
  value?: unknown;
}

export interface ErrorResponse {
  success: false;
  message?: string; // 顶层 message 字段，供前端统一读取错误信息
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
    timestamp: string;
    path?: string;
    method?: string;
    requestId: string;
  };
}

export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCode.VALIDATION_ERROR]: '数据验证失败',
  [ErrorCode.AUTHENTICATION_ERROR]: '认证失败',
  [ErrorCode.AUTHORIZATION_ERROR]: '权限不足',
  [ErrorCode.NOT_FOUND]: '资源不存在',
  [ErrorCode.CONFLICT]: '资源冲突',
  [ErrorCode.INTERNAL_ERROR]: '服务器内部错误',
  [ErrorCode.SERVICE_UNAVAILABLE]: '服务不可用',
  [ErrorCode.RATE_LIMIT_EXCEEDED]: '请求过于频繁',
  [ErrorCode.QUOTA_EXCEEDED]: '配额不足',
  [ErrorCode.INVALID_INPUT]: '输入无效',
  [ErrorCode.DUPLICATE_RESOURCE]: '资源已存在',
  [ErrorCode.RESOURCE_LOCKED]: '资源被锁定',
  [ErrorCode.PAYMENT_FAILED]: '支付失败',
  [ErrorCode.PROVIDER_ERROR]: '提供商错误',
  [ErrorCode.TIMEOUT]: '请求超时',
  [ErrorCode.DATABASE_ERROR]: '数据库错误',
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: '外部服务错误',
};

// ==================== 基础错误类 ====================

export class AppError extends Error {
  public statusCode: number;
  public errorCode: ErrorCode;
  public readonly details?: ErrorDetail[];
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = HttpStatusCode.INTERNAL_SERVER_ERROR,
    errorCode: ErrorCode = ErrorCode.INTERNAL_ERROR,
    details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ==================== 通用业务错误 ====================

export class ValidationError extends AppError {
  constructor(message: string = '数据验证失败', details?: ErrorDetail[]) {
    super(message, HttpStatusCode.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = '资源不存在') {
    super(message, HttpStatusCode.NOT_FOUND, ErrorCode.NOT_FOUND);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = '认证失败') {
    super(message, HttpStatusCode.UNAUTHORIZED, ErrorCode.AUTHENTICATION_ERROR);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = '权限不足') {
    super(message, HttpStatusCode.FORBIDDEN, ErrorCode.AUTHORIZATION_ERROR);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string = '资源冲突') {
    super(message, HttpStatusCode.CONFLICT, ErrorCode.CONFLICT);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = '请求过于频繁') {
    super(message, HttpStatusCode.TOO_MANY_REQUESTS, ErrorCode.RATE_LIMIT_EXCEEDED);
    this.name = 'RateLimitError';
  }
}

export class TimeoutError extends AppError {
  constructor(message: string = '请求超时') {
    super(message, HttpStatusCode.GATEWAY_TIMEOUT, ErrorCode.TIMEOUT);
    this.name = 'TimeoutError';
  }
}

// ==================== 数据库错误 ====================

export class DatabaseError extends AppError {
  constructor(message: string = '数据库操作失败', details?: ErrorDetail[]) {
    super(
      message,
      HttpStatusCode.INTERNAL_SERVER_ERROR,
      ErrorCode.DATABASE_ERROR,
      details,
    );
    this.name = 'DatabaseError';
  }
}

// ==================== 配额与点数错误 ====================

export class QuotaExceededError extends AppError {
  constructor(message: string = '配额不足') {
    super(message, HttpStatusCode.BAD_REQUEST, ErrorCode.QUOTA_EXCEEDED);
    this.name = 'QuotaExceededError';
  }
}

export class PointsInsufficientError extends AppError {
  constructor(message: string = '点数不足') {
    super(message, HttpStatusCode.BAD_REQUEST, ErrorCode.QUOTA_EXCEEDED);
    this.name = 'PointsInsufficientError';
  }
}

// ==================== 支付错误 ====================

export class PaymentError extends AppError {
  constructor(message: string = '支付失败', details?: ErrorDetail[]) {
    super(
      message,
      HttpStatusCode.BAD_REQUEST,
      ErrorCode.PAYMENT_FAILED,
      details,
    );
    this.name = 'PaymentError';
  }
}

export class PaymentCallbackError extends AppError {
  constructor(message: string = '支付回调处理失败', details?: ErrorDetail[]) {
    super(
      message,
      HttpStatusCode.INTERNAL_SERVER_ERROR,
      ErrorCode.PAYMENT_FAILED,
      details,
    );
    this.name = 'PaymentCallbackError';
  }
}

// ==================== AI Provider 错误 ====================

export class AIProviderError extends AppError {
  public readonly provider: string;

  constructor(provider: string, message: string, details?: ErrorDetail[]) {
    super(
      `[${provider}] ${message}`,
      HttpStatusCode.BAD_REQUEST,
      ErrorCode.PROVIDER_ERROR,
      details,
    );
    this.name = 'AIProviderError';
    this.provider = provider;
  }
}

export class AIProviderAuthError extends AIProviderError {
  constructor(provider: string, message: string = 'API密钥无效或已过期') {
    super(provider, message);
    this.name = 'AIProviderAuthError';
  }
}

export class AIProviderTimeoutError extends AIProviderError {
  constructor(provider: string, message: string = '请求超时') {
    super(provider, message);
    this.name = 'AIProviderTimeoutError';
    this.statusCode = HttpStatusCode.GATEWAY_TIMEOUT;
    this.errorCode = ErrorCode.TIMEOUT;
  }
}

export class AIProviderQuotaError extends AIProviderError {
  constructor(provider: string, message: string = 'AI服务配额已用完') {
    super(provider, message);
    this.name = 'AIProviderQuotaError';
    this.errorCode = ErrorCode.QUOTA_EXCEEDED;
  }
}

export class AIGenerationError extends AIProviderError {
  constructor(provider: string, message: string = 'AI生成失败') {
    super(provider, message);
    this.name = 'AIGenerationError';
  }
}

// ==================== 外部服务错误 ====================

export class ExternalServiceError extends AppError {
  public readonly service: string;

  constructor(service: string, message: string, details?: ErrorDetail[]) {
    super(
      `[${service}] ${message}`,
      HttpStatusCode.BAD_GATEWAY,
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      details,
    );
    this.name = 'ExternalServiceError';
    this.service = service;
  }
}

export class StorageServiceError extends ExternalServiceError {
  constructor(service: string, message: string = '存储服务异常') {
    super(service, message);
    this.name = 'StorageServiceError';
  }
}

// ==================== 辅助函数 ====================

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isOperationalError(error: unknown): boolean {
  return error instanceof AppError && error.isOperational;
}
