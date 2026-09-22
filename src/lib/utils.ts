import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { transformLocalhostUrl, API_BASE_URL } from '@/lib/api-config';
import { getAuthToken } from '@/lib/auth-check';
import { getViteEnvValue } from '@/lib/vite-env';

// SEC M-3 修复：安全的 window.open 封装。
// 安全最佳实践：直接 window.open(不可信URL) 可被构造为 javascript: 协议执行脚本，
// 或重定向到钓鱼站点。本函数仅允许 http/https 协议，并附加 noopener/noreferrer
// 防止 window.opener 劫持（反向 tabnabbing）。
export function safeOpen(url: string, target: string = '_blank'): void {
  try {
    // 相对 URL 解析为绝对 URL（基于当前 origin）
    const parsed = new URL(url, window.location.origin);
    // 仅允许 http/https 协议，阻止 javascript:/data:/vbscript: 等
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      console.warn('[safeOpen] 拒绝非 http(s) 协议:', parsed.protocol);
      return;
    }
    // noopener 防止新窗口通过 window.opener 访问原窗口
    // noreferrer 防止 Referer 头泄露原页面 URL
    window.open(parsed.toString(), target, 'noopener,noreferrer');
  } catch (error) {
    console.warn('[safeOpen] URL 解析失败，拒绝打开:', error);
  }
}

// 合并类名工具函数
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 生成唯一ID - 使用 Web Crypto API
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // 降级方案：使用 crypto.getRandomValues
  const array = new Uint32Array(4);
  crypto.getRandomValues(array);
  return Array.from(array, (n) => n.toString(36).padStart(8, '0')).join('-');
}

// 下载文件到本地
export function downloadFile(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 格式化消息内容，过滤掉 <think> 标签及其内容，并处理加粗等 Markdown 语法
 */
export function formatMessageContent(content: string): string {
  if (!content) return '';
  
  // 1. 过滤掉 <think>...</think> 标签及其内容
  // 使用 [^]* 以匹配包括换行符在内的所有字符
  let formatted = content.replace(/<think>[^]*?<\/think>/gi, '');
  
  // 2. 处理加粗 **text** -> <strong>text</strong>
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // 3. 去除前后多余的空白
  return formatted.trim();
}

export async function downloadImageViaProxy(url: string, filename: string): Promise<void> {
  try {
    const token = getAuthToken();
    const proxyUrl = `${API_BASE_URL}/image/proxy-download?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (response.ok) {
      const blob = await response.blob();
      const objUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objUrl);
    } else {
      safeOpen(url);
    }
  } catch {
    safeOpen(url);
  }
}

const configuredStaticHost = (() => {
  try {
    const value = getViteEnvValue('VITE_STATIC_BASE_URL');
    return value ? new URL(value).hostname : '';
  } catch {
    return '';
  }
})();
const CORS_PROXY_HOSTS = ['aliyuncs.com', 'hailuoai.com', 'volces.com', 'byteimg.com', 'bytecdn.cn', 'doubaocdn.com', 'vidu.cn', 'minimaxi.com', 'minimax.com', configuredStaticHost].filter(Boolean);

export function needsCorsProxy(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return CORS_PROXY_HOSTS.some((h) => hostname.endsWith(h));
  } catch {
    return false;
  }
}

export function getProxiedImageUrl(url: string): string {
  const sourceUrl = url.includes('/image/proxy-stream?url=') || url.includes('/image/proxy-download?url=')
    ? extractOriginalUrl(url)
    : url;
  const normalizedUrl = transformLocalhostUrl(sourceUrl);
  if (!normalizedUrl || !needsCorsProxy(normalizedUrl)) return normalizedUrl;
  try {
    const base = API_BASE_URL || '/api/v1';
    return `${base}/image/proxy-stream?url=${encodeURIComponent(normalizedUrl)}`;
  } catch {
    return normalizedUrl;
  }
}

/**
 * 从代理后的 URL 中提取原始 URL
 */
export function extractOriginalUrl(url: string): string {
  if (!url) return url;
  
  // 处理 /image/proxy-stream?url=... 或 /image/proxy-download?url=...
  if (url.includes('/image/proxy-stream?url=') || url.includes('/image/proxy-download?url=')) {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `http://localhost${url}`);
      const originalUrl = urlObj.searchParams.get('url');
      if (originalUrl) return originalUrl;
    } catch (e) {
      console.warn('[extractOriginalUrl] 解析代理 URL 失败:', e);
    }
  }
  
  return url;
}

// 格式化文件大小
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 格式化日期
export function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 模型提供商显示名称
export const modelProviderLabels: Record<string, string> = {
  doubao: '豆包 AI',
  stability_ai: 'Stability AI',
  haiper_ai: 'Haiper AI',
  minimax: 'MiniMax',
  adobe_firefly: 'Adobe Firefly',
  leonardo_ai: 'Leonardo.AI',
  ideogram: 'Ideogram',
  recraft_ai: 'Recraft.AI',
};

// 视频分辨率选项
export const videoResolutionOptions = [
  { label: '16:9 (横版)', ratio: '16:9', width: 1920, height: 1080 },
  { label: '9:16 (竖版)', ratio: '9:16', width: 1080, height: 1920 },
  { label: '1:1 (方形)', ratio: '1:1', width: 1024, height: 1024 },
  { label: '4:3 (传统)', ratio: '4:3', width: 1024, height: 768 },
  { label: '21:9 (超宽)', ratio: '21:9', width: 2560, height: 1080 },
];

// 视频时长选项
export const videoDurationOptions = [
  { label: '3秒', value: 3 },
  { label: '5秒', value: 5 },
  { label: '8秒', value: 8 },
  { label: '10秒', value: 10 },
  { label: '15秒', value: 15 },
  { label: '30秒', value: 30 },
];

// 视频生成模式选项
export const videoModeOptions = [
  { label: '标准', value: 'standard' },
  { label: '高性能', value: 'high_quality' },
  { label: '快速', value: 'fast' },
];

// 视频生成方式选项
export const generationModeOptions = [
  { label: '文生视频', value: 'text_to_video', icon: '✍️' },
  { label: '图生视频', value: 'image_to_video', icon: '🖼️' },
  { label: '首尾帧', value: 'first_last_frame', icon: '🔄' },
];

// 图片比例选项
export const imageAspectRatioOptions = [
  { value: '1:1', label: '1:1 (方形)' },
  { value: '3:4', label: '3:4 (竖版)' },
  { value: '4:3', label: '4:3 (横版)' },
  { value: '16:9', label: '16:9 (宽屏)' },
  { value: '9:16', label: '9:16 (手机竖版)' },
  { value: '4:5', label: '4:5 (Instagram)' },
];

// 视频模型选项
export const videoModelOptions = [
  { value: 'doubao', label: '豆包 Seedance 1.5 Pro' },
  { value: 'stability_ai', label: 'Stability AI (Stable Video Diffusion)' },
  { value: 'minimax', label: 'MiniMax Video' },
];

// 图片模型选项
export const imageModelOptions = [
  { value: 'doubao', label: '豆包 AI (Doubao)' },
  { value: 'stability_ai', label: 'Stable Diffusion 3 (Stability AI)' },
  { value: 'adobe_firefly', label: 'Adobe Firefly' },
  { value: 'leonardo_ai', label: 'Leonardo.AI' },
  { value: 'ideogram', label: 'Ideogram' },
  { value: 'recraft_ai', label: 'Recraft.AI' },
];
