export enum ErrorCategory {
  CREDIT_INSUFFICIENT = 'credit_insufficient',
  RATE_LIMITED = 'rate_limited',
  TEMPORARY_ERROR = 'temporary_error',
  PERMANENT_ERROR = 'permanent_error',
  INVALID_REQUEST = 'invalid_request',
  AUTH_FAILURE = 'auth_failure',
  NETWORK_ERROR = 'network_error',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown',
}

export enum RecoveryAction {
  SWITCH_KEY = 'switch_key',
  SWITCH_PROVIDER = 'switch_provider',
  RETRY_WITH_DELAY = 'retry_with_delay',
  RETRY_IMMEDIATELY = 'retry_immediately',
  ABORT = 'abort',
  COOLDOWN_AND_RETRY = 'cooldown_and_retry',
}

export interface ErrorClassification {
  category: ErrorCategory;
  action: RecoveryAction;
  retryDelay: number;
  shouldSwitchProvider: boolean;
  shouldSwitchKey: boolean;
  shouldMarkExhausted: boolean;
  cooldownMinutes: number;
  description: string;
}

interface ErrorPattern {
  pattern: RegExp;
  category: ErrorCategory;
  action: RecoveryAction;
  retryDelay: number;
  shouldSwitchProvider: boolean;
  shouldSwitchKey: boolean;
  shouldMarkExhausted: boolean;
  cooldownMinutes: number;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /credit.*insufficient|积分不足|余额不足|insufficient.*credit|quota.*exceeded|exceeded.*quota/i,
    category: ErrorCategory.CREDIT_INSUFFICIENT,
    action: RecoveryAction.SWITCH_PROVIDER,
    retryDelay: 0,
    shouldSwitchProvider: true,
    shouldSwitchKey: true,
    shouldMarkExhausted: true,
    cooldownMinutes: 60,
  },
  {
    pattern: /rate.*limit|限流|频率限制|too many requests|request.*limit|429/i,
    category: ErrorCategory.RATE_LIMITED,
    action: RecoveryAction.SWITCH_KEY,
    retryDelay: 5000,
    shouldSwitchProvider: false,
    shouldSwitchKey: true,
    shouldMarkExhausted: false,
    cooldownMinutes: 5,
  },
  {
    pattern: /unauthorized|authentication.*fail|invalid.*api.*key|invalid.*token|401|forbidden|403/i,
    category: ErrorCategory.AUTH_FAILURE,
    action: RecoveryAction.SWITCH_KEY,
    retryDelay: 0,
    shouldSwitchProvider: false,
    shouldSwitchKey: true,
    shouldMarkExhausted: true,
    cooldownMinutes: 1440,
  },
  {
    pattern: /timeout|timed.*out|ETIMEDOUT|request.*timeout/i,
    category: ErrorCategory.TIMEOUT,
    action: RecoveryAction.RETRY_WITH_DELAY,
    retryDelay: 3000,
    shouldSwitchProvider: false,
    shouldSwitchKey: false,
    shouldMarkExhausted: false,
    cooldownMinutes: 1,
  },
  {
    pattern: /temporarily.*unavailable|service.*unavailable|503|502|504|internal.*server.*error|500/i,
    category: ErrorCategory.TEMPORARY_ERROR,
    action: RecoveryAction.RETRY_WITH_DELAY,
    retryDelay: 2000,
    shouldSwitchProvider: false,
    shouldSwitchKey: false,
    shouldMarkExhausted: false,
    cooldownMinutes: 2,
  },
  {
    pattern: /network.*error|ECONNREFUSED|ECONNRESET|ENOTFOUND|socket.*hang.*up/i,
    category: ErrorCategory.NETWORK_ERROR,
    action: RecoveryAction.SWITCH_PROVIDER,
    retryDelay: 3000,
    shouldSwitchProvider: true,
    shouldSwitchKey: false,
    shouldMarkExhausted: false,
    cooldownMinutes: 5,
  },
  {
    pattern: /invalid.*request|bad.*request|400|parameter.*error|参数.*错误/i,
    category: ErrorCategory.INVALID_REQUEST,
    action: RecoveryAction.ABORT,
    retryDelay: 0,
    shouldSwitchProvider: false,
    shouldSwitchKey: false,
    shouldMarkExhausted: false,
    cooldownMinutes: 0,
  },
  {
    pattern: /model.*not.*found|model.*unavailable|不支持的模型/i,
    category: ErrorCategory.PERMANENT_ERROR,
    action: RecoveryAction.SWITCH_PROVIDER,
    retryDelay: 0,
    shouldSwitchProvider: true,
    shouldSwitchKey: false,
    shouldMarkExhausted: false,
    cooldownMinutes: 30,
  },
];

const CATEGORY_DESCRIPTIONS: Record<ErrorCategory, string> = {
  [ErrorCategory.CREDIT_INSUFFICIENT]: '积分/额度不足',
  [ErrorCategory.RATE_LIMITED]: '请求频率超限',
  [ErrorCategory.TEMPORARY_ERROR]: '服务暂时不可用',
  [ErrorCategory.PERMANENT_ERROR]: '永久性错误',
  [ErrorCategory.INVALID_REQUEST]: '请求参数无效',
  [ErrorCategory.AUTH_FAILURE]: '认证/鉴权失败',
  [ErrorCategory.NETWORK_ERROR]: '网络连接错误',
  [ErrorCategory.TIMEOUT]: '请求超时',
  [ErrorCategory.UNKNOWN]: '未知错误',
};

export class ErrorClassifier {
  classify(error: Error | string): ErrorClassification {
    const message = error instanceof Error ? error.message : error;

    for (const pattern of ERROR_PATTERNS) {
      if (pattern.pattern.test(message)) {
        return {
          category: pattern.category,
          action: pattern.action,
          retryDelay: pattern.retryDelay,
          shouldSwitchProvider: pattern.shouldSwitchProvider,
          shouldSwitchKey: pattern.shouldSwitchKey,
          shouldMarkExhausted: pattern.shouldMarkExhausted,
          cooldownMinutes: pattern.cooldownMinutes,
          description: CATEGORY_DESCRIPTIONS[pattern.category],
        };
      }
    }

    return {
      category: ErrorCategory.UNKNOWN,
      action: RecoveryAction.RETRY_WITH_DELAY,
      retryDelay: 1000,
      shouldSwitchProvider: false,
      shouldSwitchKey: false,
      shouldMarkExhausted: false,
      cooldownMinutes: 1,
      description: CATEGORY_DESCRIPTIONS[ErrorCategory.UNKNOWN],
    };
  }

  isRecoverable(classification: ErrorClassification): boolean {
    return classification.action !== RecoveryAction.ABORT;
  }

  shouldRetry(classification: ErrorClassification): boolean {
    return [
      RecoveryAction.RETRY_WITH_DELAY,
      RecoveryAction.RETRY_IMMEDIATELY,
      RecoveryAction.SWITCH_KEY,
      RecoveryAction.SWITCH_PROVIDER,
      RecoveryAction.COOLDOWN_AND_RETRY,
    ].includes(classification.action);
  }
}

export const errorClassifier = new ErrorClassifier();
