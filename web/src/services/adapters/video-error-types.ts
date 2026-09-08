/**
 * 统一视频生成错误类型系统
 * 基于 Seedance SDK 和 Vercel AI SDK 最佳实践
 */

// ==================== 错误码枚举 ====================
export enum VideoGenerationErrorCode {
  // 认证错误 (4xx)
  AUTHENTICATION_FAILED = 'AUTH_FAILED',
  INVALID_API_KEY = 'INVALID_API_KEY',
  INSUFFICIENT_PERMISSION = 'INSUFFICIENT_PERMISSION',
  
  // 请求参数错误 (400)
  INVALID_PROMPT = 'INVALID_PROMPT',
  INVALID_MODEL = 'INVALID_MODEL',
  INVALID_PARAMETERS = 'INVALID_PARAMS',
  IMAGE_TOO_LARGE = 'IMAGE_TOO_LARGE',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  
  // 内容审核失败 (特殊 400)
  CONTENT_MODERATION_FAILED = 'CONTENT_MODERATION',
  PROMPT_RISK_DETECTED = 'PROMPT_RISK',
  IMAGE_RISK_DETECTED = 'IMAGE_RISK',
  
  // 限流错误 (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMITED',
  DAILY_QUOTA_EXCEEDED = 'DAILY_QUOTA_EXCEEDED',
  QPS_LIMIT_EXCEEDED = 'QPS_LIMITED',
  
  // 服务端错误 (5xx)
  SERVER_ERROR = 'SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  MODEL_UNAVAILABLE = 'MODEL_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  
  // 任务状态错误
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  TASK_FAILED = 'TASK_FAILED',
  GENERATION_FAILED = 'GENERATION_FAILED',
  
  // 网络错误
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',
}

// ==================== 错误类定义 ====================
export class VideoGenerationError extends Error {
  constructor(
    public code: VideoGenerationErrorCode,
    message: string,
    public statusCode?: number,
    public retryable: boolean = false,
    public retryAfter?: number,
    public provider?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'VideoGenerationError';
    
    // 根据错误码自动判断是否可重试
    if (!retryable) {
      this.retryable = this.isRetryableByCode(code);
    }
  }
  
  private isRetryableByCode(code: VideoGenerationErrorCode): boolean {
    const retryableCodes = [
      VideoGenerationErrorCode.RATE_LIMIT_EXCEEDED,
      VideoGenerationErrorCode.SERVER_ERROR,
      VideoGenerationErrorCode.SERVICE_UNAVAILABLE,
      VideoGenerationErrorCode.TIMEOUT,
      VideoGenerationErrorCode.NETWORK_ERROR,
      VideoGenerationErrorCode.QPS_LIMIT_EXCEEDED,
    ];
    return retryableCodes.includes(code);
  }
  
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      retryable: this.retryable,
      retryAfter: this.retryAfter,
      provider: this.provider,
      stack: this.stack,
    };
  }
}

// ==================== 特定错误子类 ====================
export class AuthenticationError extends VideoGenerationError {
  constructor(message: string, provider?: string) {
    super(VideoGenerationErrorCode.AUTHENTICATION_FAILED, message, 401, false, undefined, provider);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends VideoGenerationError {
  constructor(retryAfter: number = 60, provider?: string) {
    super(
      VideoGenerationErrorCode.RATE_LIMIT_EXCEEDED,
      `请求频率超限，请在 ${retryAfter} 秒后重试`,
      429,
      true,
      retryAfter,
      provider
    );
    this.name = 'RateLimitError';
  }
}

export class ContentModerationError extends VideoGenerationError {
  constructor(reason: string, provider?: string) {
    super(
      VideoGenerationErrorCode.CONTENT_MODERATION_FAILED,
      `内容审核未通过: ${reason}`,
      400,
      false,
      undefined,
      provider
    );
    this.name = 'ContentModerationError';
  }
}

export class TaskTimeoutError extends VideoGenerationError {
  constructor(taskId: string, timeout: number, provider?: string) {
    super(
      VideoGenerationErrorCode.TIMEOUT,
      `任务 ${taskId} 在 ${timeout} 秒内未完成`,
      undefined,
      true,
      undefined,
      provider
    );
    this.name = 'TaskTimeoutError';
  }
}

// ==================== 错误映射工具 ====================
interface ProviderErrorResponse {
  code?: string | number;
  message?: string;
  error?: string | { message?: string; code?: string };
  status?: string;
}

export function mapProviderError(
  error: any,
  provider: string = 'any',
  statusCode?: number
): VideoGenerationError {
  const response: ProviderErrorResponse = error?.response?.data || error || {};
  const respData = typeof response === 'string' ? {} : response as Record<string, any>;
  const errorCode = (respData as any).code || (respData as any).error?.code;
  const errorMessage = 
    (respData as any).message ||
    (respData as any).error?.message ||
    error?.message ||
    '未知错误';

  // 火山引擎/豆包 特有错误码映射
  const volcengineErrorMap: Record<string, VideoGenerationErrorCode> = {
    AuthN_AuthenticationError: VideoGenerationErrorCode.AUTHENTICATION_FAILED,
    AuthZ_PermissionDenied: VideoGenerationErrorCode.INSUFFICIENT_PERMISSION,
    PostTextRiskNotPass: VideoGenerationErrorCode.PROMPT_RISK_DETECTED,
    PostImageRiskNotPass: VideoGenerationErrorCode.IMAGE_RISK_DETECTED,
    RequestHasReachedApiLimit: VideoGenerationErrorCode.RATE_LIMIT_EXCEEDED,
    ModelNotFound: VideoGenerationErrorCode.INVALID_MODEL,
    InvalidParameter: VideoGenerationErrorCode.INVALID_PARAMETERS,
    TaskNotFound: VideoGenerationErrorCode.TASK_NOT_FOUND,
    TaskFailed: VideoGenerationErrorCode.TASK_FAILED,
    InternalError: VideoGenerationErrorCode.SERVER_ERROR,
    ServiceUnavailable: VideoGenerationErrorCode.SERVICE_UNAVAILABLE,
  };

  let mappedCode: VideoGenerationErrorCode;

  // 根据 HTTP 状态码初步判断
  if (statusCode === 401) {
    mappedCode = VideoGenerationErrorCode.AUTHENTICATION_FAILED;
  } else if (statusCode === 429) {
    mappedCode = VideoGenerationErrorCode.RATE_LIMIT_EXCEEDED;
  } else if (statusCode && statusCode >= 500) {
    mappedCode = VideoGenerationErrorCode.SERVER_ERROR;
  } else if (statusCode === 400) {
    // 尝试从提供商特定错误码映射
    if (provider === 'doubao' || provider === 'volcengine') {
      mappedCode = volcengineErrorMap[errorCode as string] || VideoGenerationErrorCode.INVALID_PARAMETERS;
    } else {
      mappedCode = VideoGenerationErrorCode.INVALID_PARAMETERS;
    }
  } else {
    mappedCode = VideoGenerationErrorCode.GENERATION_FAILED;
  }

  return new VideoGenerationError(
    mappedCode,
    `[${provider}] ${errorMessage}`,
    statusCode,
    undefined,
    undefined,
    provider,
    error instanceof Error ? error : undefined
  );
}

// ==================== 重试策略配置 ====================
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // 初始延迟（毫秒）
  maxDelay: number; // 最大延迟（毫秒）
  backoffMultiplier: number; // 指数退避倍数
  retryableErrors: VideoGenerationErrorCode[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryableErrors: [
    VideoGenerationErrorCode.RATE_LIMIT_EXCEEDED,
    VideoGenerationErrorCode.SERVER_ERROR,
    VideoGenerationErrorCode.SERVICE_UNAVAILABLE,
    VideoGenerationErrorCode.TIMEOUT,
    VideoGenerationErrorCode.NETWORK_ERROR,
    VideoGenerationErrorCode.QPS_LIMIT_EXCEEDED,
  ],
};

// ==================== 智能重试执行器 ====================
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  onRetry?: (attempt: number, error: VideoGenerationError, delay: number) => void
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: VideoGenerationError | null = null;

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const videoError = error instanceof VideoGenerationError
        ? error
        : mapProviderError(error);

      lastError = videoError;

      // 如果不可重试或已达最大重试次数，直接抛出
      if (!videoError.retryable || attempt === finalConfig.maxRetries) {
        throw videoError;
      }

      // 计算延迟时间（指数退避 + 抖动）
      const delay = Math.min(
        finalConfig.baseDelay * Math.pow(finalConfig.backoffMultiplier, attempt),
        finalConfig.maxDelay
      );

      // 如果是限流错误，使用服务器返回的 retry-after 时间
      const actualDelay = videoError instanceof RateLimitError
        ? (videoError.retryAfter || delay) * 1000
        : delay;

      console.warn(`[withRetry] 第 ${attempt + 1} 次重试，等待 ${actualDelay}ms...`);
      
      if (onRetry) {
        onRetry(attempt + 1, videoError, actualDelay);
      }

      await new Promise(resolve => setTimeout(resolve, actualDelay));
    }
  }

  throw lastError!;
}
