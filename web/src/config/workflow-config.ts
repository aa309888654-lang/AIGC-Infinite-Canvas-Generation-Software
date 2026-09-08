/**
 * 工作流配置常量
 * 集中管理所有可配置参数，便于维护和调整
 */

export const WORKFLOW_CONFIG = {
  // ===== 并行执行配置 =====
  /** 最大并行任务数 - 控制同时执行的节点数量 */
  MAX_PARALLEL_TASKS: 3,
  
  // ===== 轮询配置 =====
  /** 最大轮询尝试次数 - 用于检查任务状态 */
  MAX_POLL_ATTEMPTS: 120,
  
  /** 轮询间隔(毫秒) - 每次状态检查的间隔时间 */
  POLL_INTERVAL_MS: 3000,
  
  // ===== 重试配置 =====
  /** 最大重试次数 - API调用失败时的重试次数 */
  MAX_RETRIES: 3,
  
  /** 重试延迟(毫秒) - 重试前的等待时间 */
  RETRY_DELAY_MS: 1000,
  
  // ===== 超时配置 =====
  /** 节点执行超时(毫秒) - 单个节点的最大执行时间 (5分钟) */
  NODE_EXECUTION_TIMEOUT_MS: 5 * 60 * 1000,
  
  /** 工作流总超时(毫秒) - 整个工作流的最大执行时间 (30分钟) */
  WORKFLOW_TIMEOUT_MS: 30 * 60 * 1000,
  
  // ===== 存储配置 =====
  /** 最大错误数量 - 存储的错误记录上限 */
  MAX_ERRORS: 100,
  
  /** 最大版本历史数 - 工作流版本历史保存上限 */
  MAX_VERSION_HISTORY: 50,
  
  /** 最大工作流存储数 - 本地保存的工作流数量上限 */
  MAX_SAVED_WORKFLOWS: 20,
  
  // ===== 输入验证配置 =====
  /** 最大提示词长度 */
  MAX_PROMPT_LENGTH: 5000,
  
  /** 最大负向提示词长度 */
  MAX_NEGATIVE_PROMPT_LENGTH: 2000,
  
  // ===== 执行循环配置 =====
  /** 执行循环间隔(毫秒) - 主执行循环的休眠时间 */
  EXECUTION_LOOP_INTERVAL_MS: 100,
  
  /** 死锁检测超时(毫秒) - 等待死锁恢复的超时时间 */
  DEADLOCK_RECOVERY_TIMEOUT_MS: 5000,
  
} as const;

/**
 * API提供商配置
 */
export const API_CONFIG = {
  /** 各提供商的默认超时时间 */
  DEFAULT_TIMEOUT_MS: 30000,
  
  /** 豆包视频API配置 */
  DOUBAO: {
    DEFAULT_MODEL: 'doubao-video-1',
    MAX_VIDEO_DURATION: 10,  // 秒
  },
  
  /** Seedream图像API配置 */
  SEEDREAM: {
    DEFAULT_MODEL: 'doubao-seedream-5-0-260128',
  },
  
} as const;

/**
 * 类型定义辅助函数
 */
export function getConfigValue<K extends keyof typeof WORKFLOW_CONFIG>(
  key: K
): (typeof WORKFLOW_CONFIG)[K] {
  return WORKFLOW_CONFIG[key];
}
