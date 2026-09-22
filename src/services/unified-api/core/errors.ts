/**
 * 统一错误定义
 * 合并 lib/api-core/errors.ts
 */

export class UnifiedAPIError extends Error {
  public retryable: boolean;
  public statusCode?: number;
  
  constructor(message: string, retryable: boolean = true, statusCode?: number) {
    super(message);
    this.name = 'UnifiedAPIError';
    this.retryable = retryable;
    this.statusCode = statusCode;
  }
}

export class ParamValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParamValidationError';
  }
}

export class ApiNetworkError extends Error {
  public retryable: boolean;
  public statusCode?: number;
  
  constructor(message: string, retryable: boolean = true, statusCode?: number) {
    super(message);
    this.name = 'ApiNetworkError';
    this.retryable = retryable;
    this.statusCode = statusCode;
  }
}

export class CircuitBreakerError extends Error {
  constructor(message: string = 'Circuit breaker is open') {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export class AdapterError extends Error {
  public provider: string;
  
  constructor(message: string, provider: string) {
    super(message);
    this.name = 'AdapterError';
    this.provider = provider;
  }
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}
