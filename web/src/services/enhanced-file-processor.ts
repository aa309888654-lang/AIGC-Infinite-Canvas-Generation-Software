/**
 * 增强的文件处理服务
 * 支持拖拽、粘贴、多种文件处理
 */
import { generateId } from '@/lib/utils';
import { useFileStore } from '@/store/useFileStore';
import { useCanvasStore } from '@/store/useCanvasStore';

// 支持的文件类型
export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  'image/bmp', 'image/tiff', 'image/svg+xml', 'image/heic', 'image/avif'
];

export const SUPPORTED_VIDEO_TYPES = [
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
  'video/avi', 'video/mov', 'video/mkv', 'video/wmv', 'video/flv', 'video/3gpp'
];

export const SUPPORTED_AUDIO_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/flac'
];

// 文件大小限制
export const FILE_SIZE_LIMITS = {
  image: 50 * 1024 * 1024,  // 50MB
  video: 200 * 1024 * 1024,  // 200MB
  audio: 30 * 1024 * 1024,   // 30MB
};

// 文件处理选项
export interface FileProcessOptions {
  createThumbnail?: boolean;
  extractMetadata?: boolean;
  autoConnect?: boolean;
  position?: { x: number; y: number };
  onProgress?: (progress: number) => void;
}

// 文件元数据
export interface FileMetadata {
  width?: number;
  height?: number;
  duration?: number;
  format?: string;
  size?: number;
  name?: string;
  lastModified?: number;
  colorSpace?: string;
  hasAlpha?: boolean;
  frameRate?: number;
  bitRate?: number;
  codec?: string;
}

// 处理结果
export interface ProcessedFile {
  id: string;
  name: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  size: number;
  metadata?: FileMetadata;
  error?: string;
}

/**
 * 检查文件类型是否支持
 */
export function isSupportedFile(file: File): boolean {
  const type = file.type.toLowerCase();
  return [
    ...SUPPORTED_IMAGE_TYPES,
    ...SUPPORTED_VIDEO_TYPES,
    ...SUPPORTED_AUDIO_TYPES
  ].some(t => type.includes(t.split('/')[1]));
}

/**
 * 获取文件类型
 */
export function getFileType(file: File): 'image' | 'video' | 'audio' | null {
  const type = file.type.toLowerCase();
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  return null;
}

/**
 * 验证文件大小
 */
export function validateFileSize(file: File): { valid: boolean; error?: string } {
  const type = getFileType(file);
  if (!type) return { valid: false, error: '不支持的文件类型' };
  
  const limit = FILE_SIZE_LIMITS[type];
  if (file.size > limit) {
    const limitMB = (limit / 1024 / 1024).toFixed(0);
    return { valid: false, error: `文件过大，最大 ${limitMB}MB` };
  }
  return { valid: true };
}

/**
 * 创建图片缩略图
 */
export function createImageThumbnail(
  file: File, 
  maxWidth = 300, 
  maxHeight = 300,
  quality = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // 计算缩放
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const thumbnailUrl = canvas.toDataURL('image/jpeg', quality);
        URL.revokeObjectURL(url);
        resolve(thumbnailUrl);
      } catch (e) {
        reject(e);
      }
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片加载失败'));
    };
    
    img.src = url;
  });
}

/**
 * 创建视频缩略图
 */
export function createVideoThumbnail(
  file: File,
  timestamp = 1,
  width = 320,
  height = 180
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(timestamp, video.duration || 1);
    };
    
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        
        // 保持宽高比
        const aspectRatio = video.videoWidth / video.videoHeight;
        if (aspectRatio > width / height) {
          canvas.width = width;
          canvas.height = width / aspectRatio;
        } else {
          canvas.height = height;
          canvas.width = height * aspectRatio;
        }
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
        URL.revokeObjectURL(url);
        resolve(thumbnailUrl);
      } catch (e) {
        reject(e);
      }
    };
    
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('视频加载失败'));
    };
    
    video.src = url;
    video.load();
  });
}

/**
 * 提取图片元数据
 */
export function extractImageMetadata(file: File): Promise<FileMetadata> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        format: file.type.split('/')[1],
        size: file.size,
        name: file.name,
        lastModified: file.lastModified,
        hasAlpha: file.type.includes('png') || file.type.includes('webp'),
      });
      URL.revokeObjectURL(url);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('无法读取图片元数据'));
    };
    
    img.src = url;
  });
}

/**
 * 提取视频元数据
 */
export function extractVideoMetadata(file: File): Promise<FileMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
        format: file.type.split('/')[1],
        size: file.size,
        name: file.name,
        lastModified: file.lastModified,
      });
      URL.revokeObjectURL(url);
    };
    
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('无法读取视频元数据'));
    };
    
    video.src = url;
    video.load();
  });
}

/**
 * 处理单个文件
 */
export async function processFile(
  file: File,
  options: FileProcessOptions = {}
): Promise<ProcessedFile> {
  const {
    createThumbnail = true,
    extractMetadata = true,
    onProgress
  } = options;
  
  const fileType = getFileType(file) as 'image' | 'video';
  if (!fileType) {
    throw new Error('不支持的文件类型');
  }
  
  const id = generateId();
  const url = URL.createObjectURL(file);
  let thumbnailUrl = '';
  let metadata: FileMetadata | undefined;
  
  try {
    if (createThumbnail) {
      onProgress?.(30);
      if (fileType === 'image') {
        thumbnailUrl = await createImageThumbnail(file);
      } else if (fileType === 'video') {
        thumbnailUrl = await createVideoThumbnail(file);
      }
    }
    
    if (extractMetadata) {
      onProgress?.(60);
      if (fileType === 'image') {
        metadata = await extractImageMetadata(file);
      } else if (fileType === 'video') {
        metadata = await extractVideoMetadata(file);
      }
    }
    
    onProgress?.(100);
    
    return {
      id,
      name: file.name,
      type: fileType as 'image' | 'video',
      url,
      thumbnailUrl,
      size: file.size,
      metadata,
    };
  } catch (error) {
    return {
      id,
      name: file.name,
      type: fileType as 'image' | 'video',
      url,
      size: file.size,
      error: String(error),
    };
  }
}

/**
 * 批量处理文件
 */
export async function processFiles(
  files: File[],
  options: FileProcessOptions = {}
): Promise<ProcessedFile[]> {
  const results: ProcessedFile[] = [];
  const total = files.length;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const progress = Math.round(((i + 1) / total) * 100);
    
    try {
      const result = await processFile(file, {
        ...options,
        onProgress: (p) => options.onProgress?.(Math.round((progress / 100) * p)),
      });
      results.push(result);
    } catch (error) {
      console.error(`处理文件失败: ${file.name}`, error);
    }
  }
  
  return results;
}

/**
 * 将处理后的文件添加到画布节点
 */
export function addFileToCanvas(
  processedFile: ProcessedFile,
  position: { x: number; y: number }
): void {
  const { addNode } = useCanvasStore.getState();
  const { addFile } = useFileStore.getState();
  
  // 添加到文件存储
  addFile({
    id: processedFile.id,
    name: processedFile.name,
    type: processedFile.type as 'image' | 'video',
    size: processedFile.size,
    url: processedFile.url,
    thumbnailUrl: processedFile.thumbnailUrl,
    createdAt: new Date().toISOString(),
  });
  
  // 创建对应的输入节点
  if (processedFile.type === 'image') {
    addNode({
      id: `image-input-${processedFile.id}`,
      type: 'imageInput',
      position,
      data: {
        type: 'imageInput',
        imageUrl: processedFile.url,
        thumbnailUrl: processedFile.thumbnailUrl,
        fileName: processedFile.name,
        width: processedFile.metadata?.width,
        height: processedFile.metadata?.height,
      },
    });
  } else if (processedFile.type === 'video') {
    addNode({
      id: `video-input-${processedFile.id}`,
      type: 'videoInput',
      position,
      data: {
        type: 'videoInput',
        videoUrl: processedFile.url,
        thumbnailUrl: processedFile.thumbnailUrl,
        fileName: processedFile.name,
        duration: processedFile.metadata?.duration,
      },
    });
  }
}

export default {
  isSupportedFile,
  getFileType,
  validateFileSize,
  createImageThumbnail,
  createVideoThumbnail,
  extractImageMetadata,
  extractVideoMetadata,
  processFile,
  processFiles,
  addFileToCanvas,
  SUPPORTED_IMAGE_TYPES,
  SUPPORTED_VIDEO_TYPES,
  SUPPORTED_AUDIO_TYPES,
  FILE_SIZE_LIMITS,
};
