// 生成完成回调事件管理
export interface GenerationCallback {
  onSuccess?: (result: { url: string; type: 'image' | 'video'; prompt: string }) => void;
  onError?: (error: string) => void;
  onProgress?: (progress: number) => void;
}

// 存储回调函数
let currentCallback: GenerationCallback | null = null;

// 设置回调
export function setGenerationCallback(callback: GenerationCallback | null) {
  currentCallback = callback;
}

// 获取回调
export function getGenerationCallback(): GenerationCallback | null {
  return currentCallback;
}

// 触发成功回调
export function triggerSuccessCallback(result: { url: string; type: 'image' | 'video'; prompt: string }) {
  if (currentCallback?.onSuccess) {
    currentCallback.onSuccess(result);
  }
}

// 触发错误回调
export function triggerErrorCallback(error: string) {
  if (currentCallback?.onError) {
    currentCallback.onError(error);
  }
}

// 触发进度回调
export function triggerProgressCallback(progress: number) {
  if (currentCallback?.onProgress) {
    currentCallback.onProgress(progress);
  }
}

// 清除回调
export function clearGenerationCallback() {
  currentCallback = null;
}

// 存储待生成的数据
export interface PendingGeneration {
  prompt: string;
  mode: 'image' | 'video';
  timestamp: number;
}

const PENDING_KEY = 'ai_clipping_pending_generation';

// 保存待生成数据
export function savePendingGeneration(data: PendingGeneration) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('保存待生成数据失败:', e);
  }
}

// 获取待生成数据
export function getPendingGeneration(): PendingGeneration | null {
  try {
    const data = localStorage.getItem(PENDING_KEY);
    if (!data) return null;
    
    const parsed = JSON.parse(data) as PendingGeneration;
    // 5分钟内有效
    if (Date.now() - parsed.timestamp > 5 * 60 * 1000) {
      clearPendingGeneration();
      return null;
    }
    return parsed;
  } catch (e) {
    console.error('获取待生成数据失败:', e);
    return null;
  }
}

// 清除待生成数据
export function clearPendingGeneration() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch (e) {
    console.error('清除待生成数据失败:', e);
  }
}
