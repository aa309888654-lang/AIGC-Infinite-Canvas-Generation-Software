/**
 * 指数退避重试机制和错误处理系统
 * 提供稳定的重试逻辑、断路器和错误恢复机制
 */

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ErrorCategory {
  NETWORK = 'network',
  PARSING = 'parsing',
  VALIDATION = 'validation',
  PROCESSING = 'processing',
  TIMEOUT = 'timeout',
  MEMORY = 'memory',
  UNKNOWN = 'unknown',
}

export interface RetryOptions {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: ErrorCategory[];
  enableJitter: boolean;
  onRetry?: (attempt: number, error: VideoEditorError, nextDelay: number) => void;
  onFailure?: (error: VideoEditorError, totalAttempts: number) => void;
  signal?: AbortSignal;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeout: number;
}

export interface VideoEditorError extends Error {
  severity: ErrorSeverity;
  category: ErrorCategory;
  retryable: boolean;
  context?: Record<string, unknown>;
  originalError?: Error;
  timestamp: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: [
    ErrorCategory.NETWORK,
    ErrorCategory.TIMEOUT,
    ErrorCategory.PROCESSING,
    ErrorCategory.MEMORY,
  ],
  enableJitter: true,
};

const DEFAULT_CIRCUIT_BREAKER_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000,
  resetTimeout: 30000,
};

type CircuitState = 'closed' | 'open' | 'half-open';

export class RetryHandler {
  private static instance: RetryHandler;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  private constructor() { /* noop */ }

  public static getInstance(): RetryHandler {
    if (!RetryHandler.instance) {
      RetryHandler.instance = new RetryHandler();
    }
    return RetryHandler.instance;
  }

  /**
   * 带重试的异步操作
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {},
    operationName: string = 'operation'
  ): Promise<T> {
    const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
    let lastError: VideoEditorError | null = null;
    let attempt = 0;

    const circuitBreaker = this.getCircuitBreaker(operationName);

    if (circuitBreaker.getState() === 'open') {
      throw this.createError(
        `Circuit breaker is open for ${operationName}`,
        ErrorSeverity.HIGH,
        ErrorCategory.PROCESSING,
        false
      );
    }

    while (attempt < opts.maxAttempts) {
      attempt++;

      if (opts.signal?.aborted) {
        throw this.createError(
          'Operation was cancelled',
          ErrorSeverity.LOW,
          ErrorCategory.UNKNOWN,
          false
        );
      }

      try {
        const result = await operation();
        circuitBreaker.recordSuccess();
        return result;
      } catch (error) {
        lastError = this.normalizeError(error);
        console.warn(`[重试] ${operationName} 失败 (${attempt}/${opts.maxAttempts}):`, lastError.message);

        if (!this.isRetryable(lastError, opts.retryableErrors)) {
          console.error(`[重试] 错误不可重试:`, lastError.category);
          circuitBreaker.recordFailure();
          throw lastError;
        }

        if (attempt >= opts.maxAttempts) {
          console.error(`[重试] 达到最大重试次数 ${opts.maxAttempts}`);
          circuitBreaker.recordFailure();
          opts.onFailure?.(lastError, attempt);
          throw lastError;
        }

        const delay = this.calculateDelay(attempt, opts);
        opts.onRetry?.(attempt, lastError, delay);

        await this.sleep(delay);
      }
    }

    throw lastError || this.createError(
      '重试机制未知错误',
      ErrorSeverity.HIGH,
      ErrorCategory.UNKNOWN,
      false
    );
  }

  /**
   * 批量操作带进度回调
   */
  async executeBatchWithRetry<T, R>(
    items: T[],
    operation: (item: T, index: number) => Promise<R>,
    options: Partial<RetryOptions & { concurrency?: number; onItemProgress?: (index: number, total: number) => void }> = {}
  ): Promise<{ results: R[]; errors: Array<{ item: T; error: VideoEditorError }> }> {
    const opts = {
      ...DEFAULT_RETRY_OPTIONS,
      ...options,
      concurrency: options.concurrency || 1,
    };

    const results: R[] = [];
    const errors: Array<{ item: T; error: VideoEditorError }> = [];
    let completed = 0;

    const processItem = async (item: T, index: number): Promise<void> => {
      try {
        const result = await this.executeWithRetry(
          () => operation(item, index),
          opts,
          `batch-item-${index}`
        );
        results[index] = result;
      } catch (error) {
        errors.push({ item, error: this.normalizeError(error) });
      } finally {
        completed++;
        opts.onItemProgress?.(completed, items.length);
      }
    };

    if (opts.concurrency === 1) {
      for (let i = 0; i < items.length; i++) {
        await processItem(items[i], i);
      }
    } else {
      const chunks: T[][] = [];
      for (let i = 0; i < items.length; i += opts.concurrency) {
        chunks.push(items.slice(i, i + opts.concurrency));
      }

      for (const chunk of chunks) {
        await Promise.all(chunk.map((item, idx) => processItem(item, items.indexOf(chunk[0]) + idx)));
      }
    }

    return { results, errors };
  }

  /**
   * 计算延迟时间
   */
  private calculateDelay(attempt: number, options: RetryOptions): number {
    const exponentialDelay = options.initialDelay * Math.pow(options.backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, options.maxDelay);
    
    if (options.enableJitter) {
      const jitter = cappedDelay * 0.2 * (Math.random() - 0.5);
      return Math.floor(cappedDelay + jitter);
    }
    
    return Math.floor(cappedDelay);
  }

  /**
   * 检查错误是否可重试
   */
  private isRetryable(error: VideoEditorError, retryableErrors: ErrorCategory[]): boolean {
    return error.retryable && retryableErrors.includes(error.category);
  }

  /**
   * 标准化错误
   */
  private normalizeError(error: unknown): VideoEditorError {
    if (error instanceof Error) {
      if ('severity' in error && 'category' in error) {
        return error as VideoEditorError;
      }

      const category = this.inferErrorCategory(error);
      const severity = this.inferErrorSeverity(error);
      const retryable = this.isErrorRetryable(error, category);

      const videoEditorError = error as VideoEditorError;
      videoEditorError.name = 'VideoEditorError';
      videoEditorError.severity = severity;
      videoEditorError.category = category;
      videoEditorError.retryable = retryable;
      videoEditorError.originalError = error;
      videoEditorError.timestamp = Date.now();

      return videoEditorError;
    }

    return this.createError(
      String(error),
      ErrorSeverity.HIGH,
      ErrorCategory.UNKNOWN,
      false
    );
  }

  /**
   * 推断错误类别
   */
  private inferErrorCategory(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return ErrorCategory.NETWORK;
    }
    if (message.includes('timeout')) {
      return ErrorCategory.TIMEOUT;
    }
    if (message.includes('parse') || message.includes('json') || message.includes('invalid')) {
      return ErrorCategory.PARSING;
    }
    if (message.includes('memory') || message.includes('heap')) {
      return ErrorCategory.MEMORY;
    }
    if (message.includes('validate') || message.includes('invalid')) {
      return ErrorCategory.VALIDATION;
    }
    if (message.includes('process') || message.includes('canvas') || message.includes('video')) {
      return ErrorCategory.PROCESSING;
    }
    
    return ErrorCategory.UNKNOWN;
  }

  /**
   * 推断错误严重程度
   */
  private inferErrorSeverity(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase();
    
    if (message.includes('critical') || message.includes('fatal')) {
      return ErrorSeverity.CRITICAL;
    }
    if (message.includes('fail') || message.includes('error')) {
      return ErrorSeverity.HIGH;
    }
    if (message.includes('warn')) {
      return ErrorSeverity.MEDIUM;
    }
    
    return ErrorSeverity.LOW;
  }

  /**
   * 判断错误是否可重试
   */
  private isErrorRetryable(error: Error, category: ErrorCategory): boolean {
    if (error.name === 'AbortError') return false;
    
    const unretryablePatterns = [
      'invalid argument',
      'not found',
      'unauthorized',
      'forbidden',
      'syntax error',
    ];
    
    const message = error.message.toLowerCase();
    if (unretryablePatterns.some(pattern => message.includes(pattern))) {
      return false;
    }
    
    return [
      ErrorCategory.NETWORK,
      ErrorCategory.TIMEOUT,
      ErrorCategory.MEMORY,
      ErrorCategory.PROCESSING,
    ].includes(category);
  }

  /**
   * 创建错误
   */
  createError(
    message: string,
    severity: ErrorSeverity,
    category: ErrorCategory,
    retryable: boolean,
    context?: Record<string, unknown>
  ): VideoEditorError {
    const error = new Error(message) as VideoEditorError;
    error.name = 'VideoEditorError';
    error.severity = severity;
    error.category = category;
    error.retryable = retryable;
    error.context = context;
    error.timestamp = Date.now();
    return error;
  }

  /**
   * 获取断路器
   */
  private getCircuitBreaker(name: string): CircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      this.circuitBreakers.set(name, new CircuitBreaker(DEFAULT_CIRCUIT_BREAKER_OPTIONS));
    }
    return this.circuitBreakers.get(name)!;
  }

  /**
   * 睡眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 重置所有断路器
   */
  resetAllCircuitBreakers(): void {
    this.circuitBreakers.forEach(cb => cb.reset());
  }

  /**
   * 获取断路器状态
   */
  getCircuitBreakerStatus(name?: string): Record<string, CircuitState> | CircuitState {
    if (name) {
      return this.circuitBreakers.get(name)?.getState() || 'closed';
    }
    const status: Record<string, CircuitState> = {};
    this.circuitBreakers.forEach((cb, key) => {
      status[key] = cb.getState();
    });
    return status;
  }
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private readonly options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = { ...DEFAULT_CIRCUIT_BREAKER_OPTIONS, ...options };
  }

  getState(): CircuitState {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.options.resetTimeout) {
        this.state = 'half-open';
      }
    }
    return this.state;
  }

  recordSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold) {
        this.state = 'closed';
        this.failureCount = 0;
        this.successCount = 0;
      }
    } else {
      this.failureCount = 0;
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'open';
    }
  }

  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }

  isOpen(): boolean {
    return this.getState() === 'open';
  }
}

export const retryHandler = RetryHandler.getInstance();
export default retryHandler;
