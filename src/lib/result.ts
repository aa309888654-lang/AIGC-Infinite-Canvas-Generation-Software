/**
 * Result<T, E> - 统一错误处理类型
 * Ok/Err 模式，类似 Rust 的 Result 类型
 */

/**
 * Ok 结果变体
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/**
 * Err 结果变体
 */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/**
 * Result 类型 - Ok 或 Err
 */
export type Result<T, E = Error> = Ok<T> | Err<E>;

/**
 * 创建 Ok 结果
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true as const, value };
}

/**
 * 创建 Err 结果
 */
export function err<E>(error: E): Err<E> {
  return { ok: false as const, error };
}

/**
 * 判断是否为 Ok
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok === true;
}

/**
 * 判断是否为 Err
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.ok === false;
}

/**
 * 映射 Ok 值
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (isOk(result)) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * 映射错误
 */
export function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  if (isOk(result)) {
    return result;
  }
  return err(fn(result.error));
}

/**
 * 链式调用（flatMap）
 */
export function andThen<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (isOk(result)) {
    return fn(result.value);
  }
  return result;
}

/**
 * 获取值或默认值
 */
export function getOrElse<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.value;
  }
  return defaultValue;
}

/**
 * 获取值或抛出错误（仅在 Ok 时安全）
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value;
  }
  throw result.error;
}

/**
 * 标准 API 错误结构
 */
export interface APIError {
  code: string;
  message: string;
  statusCode?: number;
  provider?: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
}

/**
 * 创建 API 错误的工厂函数
 */
export function apiError(
  code: string,
  message: string,
  options?: Partial<APIError>
): APIError {
  return {
    code,
    message,
    retryable: options?.retryable ?? ['RATE_LIMIT', 'NETWORK', 'TIMEOUT', 'SERVER_ERROR'].includes(code),
    ...options,
  };
}

/**
 * API 错误代码枚举
 */
export const APIErrorCode = {
  // 认证错误 (4xx)
  AUTH_FAILED: 'AUTH_FAILED',           // 401 认证失败
  INVALID_API_KEY: 'INVALID_API_KEY',   // API Key 无效
  PERMISSION_DENIED: 'PERMISSION_DENIED', // 权限不足
  
  // 请求错误 (4xx)
  BAD_REQUEST: 'BAD_REQUEST',           // 400 请求格式错误
  NOT_FOUND: 'NOT_FOUND',               // 404 资源不存在
  VALIDATION_ERROR: 'VALIDATION_ERROR', // 参数校验失败
  
  // 限流 (429)
  RATE_LIMIT: 'RATE_LIMIT',             // 请求频率限制
  
  // 服务器错误 (5xx)
  SERVER_ERROR: 'SERVER_ERROR',         // 服务器内部错误
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE', // 服务不可用
  GATEWAY_TIMEOUT: 'GATEWAY_TIMEOUT',   // 网关超时
  
  // 网络错误
  NETWORK: 'NETWORK',                   // 网络连接失败
  TIMEOUT: 'TIMEOUT',                  // 请求超时
  ABORT: 'ABORT',                       // 请求被中止
  
  // 业务错误
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS', // 余额不足
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',     // 配额超限
  MODEL_NOT_SUPPORTED: 'MODEL_NOT_SUPPORTED', // 模型不支持
  
  // 未知错误
  UNKNOWN: 'UNKNOWN',
} as const;

export type APIErrorCode = typeof APIErrorCode[keyof typeof APIErrorCode];

/**
 * 将 HTTP 状态码映射到 APIErrorCode
 */
export function httpStatusToErrorCode(status: number): APIErrorCode {
  switch (status) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'AUTH_FAILED';
    case 403: return 'PERMISSION_DENIED';
    case 404: return 'NOT_FOUND';
    case 422: return 'VALIDATION_ERROR';
    case 429: return 'RATE_LIMIT';
    case 500: return 'SERVER_ERROR';
    case 502: return 'SERVICE_UNAVAILABLE';
    case 503: return 'SERVICE_UNAVAILABLE';
    case 504: return 'GATEWAY_TIMEOUT';
    default:
      if (status >= 500) return 'SERVER_ERROR';
      if (status >= 400) return 'BAD_REQUEST';
      return 'UNKNOWN';
  }
}

/**
 * 统一适配器错误转换
 * 将各种错误格式转换为 Result 类型
 */
export function toAPIResult<T>(
  fn: () => T | Promise<T>
): Promise<Result<T, APIError>> {
  return (async () => {
    try {
      const value = await fn();
      return ok(value);
    } catch (error) {
      return err(parseError(error));
    }
  })();
}

/**
 * 解析任意错误为 APIError
 */
export function parseError(error: unknown): APIError {
  if (error instanceof Error) {
    // HTTP 状态码错误
    const statusMatch = error.message.match(/status[= ]*(\d{3})/i);
    if (statusMatch) {
      const status = parseInt(statusMatch[1], 10);
      return apiError(
        httpStatusToErrorCode(status),
        error.message,
        { statusCode: status }
      );
    }
    
    // 网络错误
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return apiError('NETWORK', '网络连接失败，请检查网络设置', { retryable: true });
    }
    
    // 超时错误
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return apiError('TIMEOUT', '请求超时，请稍后重试', { retryable: true });
    }
    
    return apiError('UNKNOWN', error.message);
  }
  
  return apiError('UNKNOWN', String(error));
}
