/**
 * 节点输出统一类型与提取工具
 *
 * 解决问题：节点输出 URL 存在 11+ 个字段变体（imageUrl/videoUrl/resultUrl/url/output/receivedVideoUrl...），
 * 下游必须用 fallback 链兜底，新增节点极易遗漏。
 *
 * 规范：所有 AI 生成节点执行完成后，必须按此规范写入 node.data：
 *   - resultUrl: 单结果 URL（图片/视频/音频通用）
 *   - resultUrls: 多结果 URL 数组（批量/多角度/多格生成）
 *   - mediaType: 媒体类型
 *
 * 旧字段（imageUrl/videoUrl/audioUrl/url/output/receivedVideoUrl）保留写入以兼容旧工作流，
 * 但读取时应优先使用本模块的 extractResultUrl / extractAllResultUrls。
 */

export type NodeMediaType = 'image' | 'video' | 'audio' | 'text';

export interface NodeOutput {
  /** 单结果 URL（图片/视频/音频通用） */
  resultUrl?: string;
  /** 多结果 URL 数组（批量/多角度/多格生成） */
  resultUrls?: string[];
  /** 媒体类型 */
  mediaType?: NodeMediaType;
  /** 原始任务对象 */
  task?: Record<string, unknown>;
}

/** 旧字段列表，用于 fallback 读取（迁移期保留） */
const LEGACY_URL_FIELDS = [
  'imageUrl',
  'videoUrl',
  'audioUrl',
  'url',
  'output',
  'receivedVideoUrl',
  'receivedImageUrl',
  'receivedAudioUrl',
] as const;

/**
 * 从 node.data 提取结果 URL（统一入口）
 * 优先级：resultUrl > resultUrls[0] > 旧字段 fallback > task.resultUrl > task.resultUrls[0]
 */
export function extractResultUrl(data: Record<string, unknown> | undefined | null): string | null {
  if (!data || typeof data !== 'object') return null;

  // 新字段优先
  const directUrl = data.resultUrl;
  if (typeof directUrl === 'string' && directUrl.length > 0 && !directUrl.startsWith('__')) {
    return directUrl;
  }

  const resultUrls = data.resultUrls;
  if (Array.isArray(resultUrls) && resultUrls.length > 0) {
    const first = resultUrls[0];
    if (typeof first === 'string' && first.length > 0 && !first.startsWith('__')) {
      return first;
    }
  }

  // 旧字段 fallback
  for (const field of LEGACY_URL_FIELDS) {
    const val = data[field];
    if (typeof val === 'string' && val.length > 0 && !val.startsWith('__')) {
      return val;
    }
  }

  // task.resultUrl / task.resultUrls fallback
  const task = data.task as Record<string, unknown> | undefined;
  if (task && typeof task === 'object') {
    if (typeof task.resultUrl === 'string' && task.resultUrl.length > 0 && !task.resultUrl.startsWith('__')) {
      return task.resultUrl as string;
    }
    if (Array.isArray(task.resultUrls) && task.resultUrls.length > 0) {
      const first = task.resultUrls[0];
      if (typeof first === 'string' && first.length > 0 && !first.startsWith('__')) {
        return first as string;
      }
    }
  }

  return null;
}

/**
 * 提取所有结果 URL（多结果场景）
 * 优先级：resultUrls（数组）> resultUrl + 旧字段去重合并
 */
export function extractAllResultUrls(data: Record<string, unknown> | undefined | null): string[] {
  if (!data || typeof data !== 'object') return [];

  const urls: string[] = [];
  const seen = new Set<string>();

  const push = (url: unknown): void => {
    if (typeof url === 'string' && url.length > 0 && !url.startsWith('__') && !seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  };

  // resultUrls 数组优先
  if (Array.isArray(data.resultUrls)) {
    data.resultUrls.forEach(push);
  }

  // 单结果
  push(data.resultUrl);

  // 旧字段
  for (const field of LEGACY_URL_FIELDS) {
    push(data[field]);
  }

  // task 内
  const task = data.task as Record<string, unknown> | undefined;
  if (task && typeof task === 'object') {
    push(task.resultUrl);
    if (Array.isArray(task.resultUrls)) {
      task.resultUrls.forEach(push);
    }
  }

  return urls;
}

/**
 * 推断 node.data 的媒体类型
 * 优先级：显式 mediaType > 根据 URL 后缀推断 > 根据 task 类型字段推断
 */
export function inferMediaType(data: Record<string, unknown> | undefined | null): NodeMediaType | null {
  if (!data || typeof data !== 'object') return null;

  const explicit = data.mediaType;
  if (explicit === 'image' || explicit === 'video' || explicit === 'audio' || explicit === 'text') {
    return explicit;
  }

  const url = extractResultUrl(data);
  if (url) {
    const lower = url.toLowerCase().split('?')[0];
    if (/\.(mp4|mov|webm|mkv|avi|m4v)$/.test(lower)) return 'video';
    if (/\.(mp3|wav|m4a|aac|flac|ogg)$/.test(lower)) return 'audio';
    if (/\.(txt|md|srt|vtt|json)$/.test(lower)) return 'text';
    return 'image';
  }

  return null;
}

/**
 * 构造节点输出的统一 patch（用于 updateNodeData）
 * 同时保留旧字段以兼容旧工作流读取
 */
export function buildNodeOutputPatch(params: {
  resultUrl?: string;
  resultUrls?: string[];
  mediaType?: NodeMediaType;
  isVideo?: boolean;
  isImage?: boolean;
  isAudio?: boolean;
}): Record<string, unknown> {
  const { resultUrl, resultUrls, mediaType, isVideo, isImage, isAudio } = params;
  const patch: Record<string, unknown> = {};

  if (typeof resultUrl === 'string' && resultUrl.length > 0) {
    patch.resultUrl = resultUrl;
    // 旧字段兼容
    if (isVideo || mediaType === 'video') {
      patch.videoUrl = resultUrl;
      patch.receivedVideoUrl = resultUrl;
    } else if (isImage || mediaType === 'image') {
      patch.imageUrl = resultUrl;
      patch.receivedImageUrl = resultUrl;
    } else if (isAudio || mediaType === 'audio') {
      patch.audioUrl = resultUrl;
      patch.receivedAudioUrl = resultUrl;
    }
  }

  if (Array.isArray(resultUrls) && resultUrls.length > 0) {
    patch.resultUrls = resultUrls;
  }

  if (mediaType) {
    patch.mediaType = mediaType;
  }

  return patch;
}
