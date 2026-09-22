/**
 * 节点执行统一错误类型
 *
 * 取代散落的 `new Error(string)` 与 `setEarlyFailTask(string)`，
 * 使错误可分类、可重试判定、可被 UI 按 code 显示不同图标与文案。
 */

export enum NodeExecutionErrorCode {
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  UPSTREAM_EMPTY = 'UPSTREAM_EMPTY',
  MODEL_UNAVAILABLE = 'MODEL_UNAVAILABLE',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  CIRCUIT_OPEN = 'CIRCUIT_OPEN',
  RATE_LIMITED = 'RATE_LIMITED',
  CONTENT_BLOCKED = 'CONTENT_BLOCKED',
  UNKNOWN = 'UNKNOWN',
}

/** 错误码 → 是否可重试（仅网络/超时/限流/Provider 5xx 可重试） */
export const RETRYABLE_CODES: ReadonlySet<NodeExecutionErrorCode> = new Set([
  NodeExecutionErrorCode.NETWORK_ERROR,
  NodeExecutionErrorCode.TIMEOUT,
  NodeExecutionErrorCode.PROVIDER_ERROR,
  NodeExecutionErrorCode.RATE_LIMITED,
]);

/** 错误码 → 用户可读文案 */
export const ERROR_CODE_USER_MESSAGE: Record<NodeExecutionErrorCode, string> = {
  [NodeExecutionErrorCode.AUTH_REQUIRED]: '请先登录后再使用此功能',
  [NodeExecutionErrorCode.QUOTA_EXCEEDED]: '额度不足，请升级会员或充值积分',
  [NodeExecutionErrorCode.UPSTREAM_EMPTY]: '上游节点未提供有效输入，请检查连接',
  [NodeExecutionErrorCode.MODEL_UNAVAILABLE]: '当前模型暂时不可用，请稍后再试或切换模型',
  [NodeExecutionErrorCode.NETWORK_ERROR]: '网络请求失败，请检查网络连接后重试',
  [NodeExecutionErrorCode.TIMEOUT]: '生成超时，请稍后重试',
  [NodeExecutionErrorCode.VALIDATION_ERROR]: '参数校验失败，请检查节点配置',
  [NodeExecutionErrorCode.PROVIDER_ERROR]: 'AI 服务暂时繁忙，请稍后重试',
  [NodeExecutionErrorCode.CIRCUIT_OPEN]: '该节点连续失败已熔断，请稍后 60s 后重试',
  [NodeExecutionErrorCode.RATE_LIMITED]: '请求过于频繁，请稍后重试',
  [NodeExecutionErrorCode.CONTENT_BLOCKED]: '内容触发安全限制，请修改提示词或素材后重试',
  [NodeExecutionErrorCode.UNKNOWN]: '生成失败，请稍后重试',
};

export class NodeExecutionError extends Error {
  constructor(
    public code: NodeExecutionErrorCode,
    message: string,
    public nodeId: string,
    public retryable: boolean = false,
    public cause?: unknown,
  ) {
    super(message);
    this.name = 'NodeExecutionError';
    // 维持 V8 调用栈（Node 与 Chrome）
    const ErrorWithStackTrace = Error as ErrorConstructor & {
      captureStackTrace?: (targetObject: object, constructorOpt?: unknown) => void;
    };
    if (typeof ErrorWithStackTrace.captureStackTrace === 'function') {
      ErrorWithStackTrace.captureStackTrace(this, NodeExecutionError);
    }
  }

  /** 用户可读文案（优先返回 code 对应文案，回退到 message） */
  get userMessage(): string {
    return ERROR_CODE_USER_MESSAGE[this.code] || this.message;
  }

  /** 是否可重试（code 与 retryable 任一为 true 即可重试） */
  get shouldRetry(): boolean {
    return this.retryable || RETRYABLE_CODES.has(this.code);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      nodeId: this.nodeId,
      retryable: this.retryable,
      shouldRetry: this.shouldRetry,
      cause: this.cause instanceof Error ? this.cause.message : this.cause,
    };
  }
}

/** 从任意错误推断 NodeExecutionErrorCode */
export function inferErrorCode(error: unknown): NodeExecutionErrorCode {
  if (!error) return NodeExecutionErrorCode.UNKNOWN;
  if (error instanceof NodeExecutionError) return error.code;

  const msg = error instanceof Error ? error.message : String(error);

  // 网络错误
  if (
    error instanceof TypeError &&
    /fetch|network|load failed/i.test(msg)
  ) {
    return NodeExecutionErrorCode.NETWORK_ERROR;
  }
  if (/网络|network|fetch failed|load failed/i.test(msg)) {
    return NodeExecutionErrorCode.NETWORK_ERROR;
  }

  // 超时
  if (/timeout|超时|abort/i.test(msg)) {
    return NodeExecutionErrorCode.TIMEOUT;
  }

  // 限流
  if (/rate limit|too many requests|429|频繁/i.test(msg)) {
    return NodeExecutionErrorCode.RATE_LIMITED;
  }

  // 内容安全
  if (/content.*safe|安全|违规|policy violation|audit/i.test(msg)) {
    return NodeExecutionErrorCode.CONTENT_BLOCKED;
  }

  // 配额
  if (/quota|额度|积分|credit|余额/i.test(msg)) {
    return NodeExecutionErrorCode.QUOTA_EXCEEDED;
  }

  // 鉴权
  if (/auth|登录|unauthorized|401/i.test(msg)) {
    return NodeExecutionErrorCode.AUTH_REQUIRED;
  }

  // 模型不可用
  if (/model.*unavailable|模型.*不可用|model not found/i.test(msg)) {
    return NodeExecutionErrorCode.MODEL_UNAVAILABLE;
  }

  return NodeExecutionErrorCode.UNKNOWN;
}

/** 将任意错误包装为 NodeExecutionError */
export function wrapAsNodeExecutionError(
  error: unknown,
  nodeId: string,
  fallbackCode: NodeExecutionErrorCode = NodeExecutionErrorCode.UNKNOWN,
): NodeExecutionError {
  if (error instanceof NodeExecutionError) return error;
  const code = inferErrorCode(error);
  const message = error instanceof Error ? error.message : String(error);
  const retryable = RETRYABLE_CODES.has(code) || RETRYABLE_CODES.has(fallbackCode);
  return new NodeExecutionError(
    code === NodeExecutionErrorCode.UNKNOWN ? fallbackCode : code,
    message,
    nodeId,
    retryable,
    error,
  );
}
