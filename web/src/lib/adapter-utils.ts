/**
 * 适配器共享工具函数
 * 提供适配器通用的工具函数
 */

// ==================== 比例尺映射表 ====================

/**
 * 比例尺到像素尺寸的映射
 */
export const ASPECT_RATIO_TO_SIZE: Record<string, string> = {
  '1:1': '1024x1024',
  '3:4': '768x1024',
  '4:3': '1024x768',
  '16:9': '1792x1024',
  '9:16': '1024x1792',
  '21:9': '2048x768',
  '9:21': '768x2048',
};

/**
 * 默认比例尺
 */
export const DEFAULT_ASPECT_RATIO = '1:1';
export const DEFAULT_SIZE = '1024x1024';

/**
 * 支持的比例尺列表
 */
export const SUPPORTED_ASPECT_RATIOS = Object.keys(ASPECT_RATIO_TO_SIZE);

/**
 * 支持的分辨率列表
 */
export const SUPPORTED_RESOLUTIONS = [
  '512x512',
  '768x768',
  '1024x1024',
  '1536x1536',
  '2048x2048',
  '1792x1024',
  '1024x1792',
];

// ==================== 工具函数 ====================

/**
 * 转换比例尺为尺寸
 */
export function convertAspectRatioToSize(aspectRatio?: string): string {
  if (!aspectRatio) return DEFAULT_SIZE;
  return ASPECT_RATIO_TO_SIZE[aspectRatio] || DEFAULT_SIZE;
}

/**
 * 从尺寸提取宽度
 */
export function getWidthFromSize(size: string): number {
  const [width] = size.split('x').map(Number);
  return width || 1024;
}

/**
 * 从尺寸提取高度
 */
export function getHeightFromSize(size: string): number {
  const [, height] = size.split('x').map(Number);
  return height || 1024;
}

/**
 * 从比例尺提取宽度
 */
export function getWidthFromAspectRatio(aspectRatio: string): number {
  const size = convertAspectRatioToSize(aspectRatio);
  return getWidthFromSize(size);
}

/**
 * 从比例尺提取高度
 */
export function getHeightFromAspectRatio(aspectRatio: string): number {
  const size = convertAspectRatioToSize(aspectRatio);
  return getHeightFromSize(size);
}

/**
 * 验证比例尺
 */
export function isValidAspectRatio(aspectRatio: string): boolean {
  return SUPPORTED_ASPECT_RATIOS.includes(aspectRatio);
}

/**
 * 验证分辨率
 */
export function isValidResolution(resolution: string): boolean {
  return SUPPORTED_RESOLUTIONS.includes(resolution);
}

/**
 * 标准化比例尺格式
 */
export function normalizeAspectRatio(aspectRatio: string): string {
  // 移除空格，转小写
  const normalized = aspectRatio.trim().toLowerCase();
  
  // 如果包含冒号，转换为标准格式
  if (normalized.includes(':')) {
    const [w, h] = normalized.split(':').map(Number);
    // 确保宽度 >= 高度（比例尺通常是宽:高）
    if (w >= h) {
      return `${w}:${h}`;
    } else {
      return `${h}:${w}`;
    }
  }
  
  return normalized;
}

/**
 * 获取质量参数
 */
export function getQualityParam(quality?: string): string {
  switch (quality?.toLowerCase()) {
    case 'high':
    case 'hd':
    case 'pro':
      return 'hd';
    case 'standard':
    case 'normal':
    case 'lite':
      return 'standard';
    default:
      return 'standard';
  }
}

/**
 * 验证提示词
 */
export function validatePrompt(prompt?: string): { valid: boolean; error?: string } {
  if (!prompt || prompt.trim().length === 0) {
    return { valid: false, error: '提示词不能为空' };
  }
  
  if (prompt.length > 4000) {
    return { valid: false, error: '提示词长度不能超过4000字符' };
  }
  
  return { valid: true };
}

/**
 * 清理提示词
 */
export function cleanPrompt(prompt: string): string {
  return prompt
    .trim()
    .replace(/\s+/g, ' ')  // 合并多个空格
    .slice(0, 4000);  // 截断超长内容
}

/**
 * 生成随机ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 延迟函数
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 指数退避延迟
 */
export async function exponentialBackoff(
  attempt: number,
  baseDelay: number = 1000,
  maxDelay: number = 8000
): Promise<void> {
  const delayTime = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  await delay(delayTime);
}

// ==================== API相关工具 ====================

/**
 * 解析API错误消息
 */
export function parseAPIError(error: unknown): string {
  if (error instanceof Error) {
    // 尝试解析JSON错误
    try {
      const jsonMatch = error.message.match(/\{.*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.error?.message) {
          return parsed.error.message;
        }
        if (parsed.message) {
          return parsed.message;
        }
      }
    } catch {
      // 不是JSON，直接返回消息
    }
    
    return error.message;
  }
  
  return String(error);
}

/**
 * 检查是否为认证错误
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('401') || 
           error.message.includes('Unauthorized') ||
           error.message.includes('AuthenticationError');
  }
  return false;
}

/**
 * 检查是否为超时错误
 */
export function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('timeout') || 
           error.message.includes('Timeout') ||
           error.message.includes('ETIMEDOUT');
  }
  return false;
}

/**
 * 检查是否为网络错误
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('fetch') ||
           error.message.includes('network') ||
           error.message.includes('NetworkError') ||
           error.message.includes('ENOTFOUND') ||
           error.message.includes('ECONNREFUSED');
  }
  return false;
}

// ==================== URL工具 ====================

/**
 * 从URL提取文件名
 */
export function extractFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const segments = pathname.split('/');
    return segments[segments.length - 1] || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * 从URL提取文件扩展名
 */
export function extractExtensionFromUrl(url: string): string {
  const filename = extractFilenameFromUrl(url);
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.substring(lastDot + 1) : '';
}

/**
 * 生成带时间戳的文件名
 */
export function generateTimestampedFilename(prefix: string, extension: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}-${timestamp}.${extension}`;
}
