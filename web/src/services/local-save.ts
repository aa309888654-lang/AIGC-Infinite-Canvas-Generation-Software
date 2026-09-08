/**
 * 本地文件保存服务
 * 将AI生成的图片/视频保存到本地文件夹
 */

import { invoke } from '@tauri-apps/api/core';

// 保存结果类型
export interface SaveResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const tauriWindow = window as Window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };

  return Boolean(tauriWindow.__TAURI__ || tauriWindow.__TAURI_INTERNALS__);
}

/**
 * 从URL下载文件并保存到本地文件夹
 */
export async function saveFileFromUrl(
  url: string,
  destFolder: string,
  filename?: string
): Promise<SaveResult> {
  try {
    if (!isTauriRuntime()) {
      return { success: false, error: '当前为网页环境，跳过本地保存' };
    }
    const filePath = await invoke<string>('save_file_from_url', {
      url,
      destFolder,
      filename,
    });
    return { success: true, filePath };
  } catch (error) {
    console.error('保存文件失败:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 保存Base64数据到文件
 */
export async function saveBase64ToFile(
  base64Data: string,
  destFolder: string,
  filename: string
): Promise<SaveResult> {
  try {
    if (!isTauriRuntime()) {
      return { success: false, error: '当前为网页环境，跳过本地保存' };
    }
    const filePath = await invoke<string>('save_base64_to_file', {
      base64Data,
      destFolder,
      filename,
    });
    return { success: true, filePath };
  } catch (error) {
    console.error('保存文件失败:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 复制文件
 */
export async function copyFileToFolder(
  sourcePath: string,
  destFolder: string,
  filename?: string
): Promise<SaveResult> {
  try {
    if (!isTauriRuntime()) {
      return { success: false, error: '当前为网页环境，跳过本地保存' };
    }
    // 使用简单的字符串拼接处理路径
    const destPath = filename 
      ? `${destFolder.replace(/\\/g, '/')}/${filename}`
      : destFolder;
    
    const result = await invoke<string>('copy_file', {
      source: sourcePath,
      dest: destPath,
    });
    return { success: true, filePath: result };
  } catch (error) {
    console.error('复制文件失败:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 保存图片到本地文件夹（支持URL或Blob）
 */
export async function saveImageToLocal(
  imageUrl: string,
  storagePath: string,
  filename?: string
): Promise<SaveResult> {
  const outputFolder = `${storagePath}/outputs/${getDateString()}`;
  const finalFilename = filename || generateFilename(imageUrl, 'image');
  
  if (imageUrl.startsWith('http')) {
    const result = await saveFileFromUrl(imageUrl, outputFolder, finalFilename);
    if (!result.success && !isTauriRuntime()) {
      return downloadViaBrowser(imageUrl, finalFilename);
    }
    return result;
  }
  
  if (imageUrl.startsWith('data:')) {
    const base64 = imageUrl.split(',')[1];
    return saveBase64ToFile(base64, outputFolder, finalFilename);
  }
  
  return { success: false, error: '不支持的图片格式' };
}

/**
 * 保存视频到本地文件夹
 */
export async function saveVideoToLocal(
  videoUrl: string,
  storagePath: string,
  filename?: string
): Promise<SaveResult> {
  const outputFolder = `${storagePath}/outputs/${getDateString()}`;
  const finalFilename = filename || generateFilename(videoUrl, 'video');
  
  if (videoUrl.startsWith('http')) {
    const result = await saveFileFromUrl(videoUrl, outputFolder, finalFilename);
    if (!result.success && !isTauriRuntime()) {
      return downloadViaBrowser(videoUrl, finalFilename);
    }
    return result;
  }
  
  return { success: false, error: '不支持的视频格式' };
}

export async function saveAudioToLocal(
  audioUrl: string,
  storagePath: string,
  filename?: string
): Promise<SaveResult> {
  const outputFolder = `${storagePath}/outputs/${getDateString()}`;
  const finalFilename = filename || generateFilename(audioUrl, 'audio');

  if (audioUrl.startsWith('http')) {
    const result = await saveFileFromUrl(audioUrl, outputFolder, finalFilename);
    if (!result.success && !isTauriRuntime()) {
      return downloadViaBrowser(audioUrl, finalFilename);
    }
    return result;
  }

  return { success: false, error: '不支持的音频格式' };
}

/**
 * 将Blob保存到本地文件
 */
export async function saveBlobToLocal(
  blob: Blob,
  storagePath: string,
  filename: string
): Promise<SaveResult> {
  try {
    if (!isTauriRuntime()) {
      return { success: false, error: '当前为网页环境，跳过本地保存' };
    }
    // 转换为Base64
    const base64 = await blobToBase64(blob);
    
    // 获取文件扩展名
    const ext = getExtensionFromMime(blob.type);
    const fullFilename = filename.includes('.') ? filename : `${filename}.${ext}`;
    
    // 使用简单的字符串拼接处理路径
    const outputFolder = `${storagePath}/outputs/${getDateString()}`;
    return saveBase64ToFile(base64, outputFolder, fullFilename);
  } catch (error) {
    console.error('保存Blob失败:', error);
    return { success: false, error: String(error) };
  }
}

// ===== 辅助函数 =====

// 获取当前日期字符串
function getDateString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0]; // YYYY-MM-DD
}

// 从URL生成文件名
function generateFilename(url: string, type: 'image' | 'video' | 'audio'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  
  // 从URL提取扩展名
  let ext = '';
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const parts = pathname.split('.');
    if (parts.length > 1) {
      ext = parts[parts.length - 1].split('?')[0];
    }
  } catch {
    // URL解析失败，使用默认
  }
  
  const prefix = type === 'image' ? 'img' : type === 'audio' ? 'audio' : 'video';
  return ext ? `${prefix}_${timestamp}_${random}.${ext}` : `${prefix}_${timestamp}_${random}`;
}

// 从MIME类型获取扩展名
function getExtensionFromMime(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  };
  return mimeMap[mimeType] || 'bin';
}

// Blob转Base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // 移除data:前缀
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function downloadViaBrowser(url: string, filename: string): Promise<SaveResult> {
  try {
    // 检查是否需要通过代理下载
    let finalUrl = url;
    try {
      const { getProxiedImageUrl } = await import('@/lib/utils');
      finalUrl = getProxiedImageUrl(url);
    } catch (e) {
      console.warn('[local-save] 无法加载代理工具，将尝试直接下载:', e);
    }

    const response = await fetch(finalUrl);
    if (!response.ok) {
      return { success: false, error: `下载失败: HTTP ${response.status}` };
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
    return { success: true, filePath: filename };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
