// 优化的拖放管理器 - 简化的兼容版本
import { FileProcessingItem } from './tauri-drag-drop';

class OptimizedDragDropManager {
  private static instance: OptimizedDragDropManager;
  private processingItems: Map<string, FileProcessingItem> = new Map();

  private constructor() { /* noop */ }

  static getInstance(): OptimizedDragDropManager {
    if (!OptimizedDragDropManager.instance) {
      OptimizedDragDropManager.instance = new OptimizedDragDropManager();
    }
    return OptimizedDragDropManager.instance;
  }

  // 获取处理状态
  getProcessingStatus(): FileProcessingItem[] {
    return Array.from(this.processingItems.values());
  }

  // 取消处理
  cancelProcessing(itemId: string): void {
    const item = this.processingItems.get(itemId);
    if (item) {
      item.status = 'cancelled';
      item.progress = 0;
      this.processingItems.delete(itemId);
    }
  }

  // 重置处理状态
  reset(): void {
    this.processingItems.clear();
  }

  // 处理Web文件
  async processWebFiles(files: FileList | File[]): Promise<FileProcessingItem[]> {
    const results: FileProcessingItem[] = [];
    const fileArray = Array.from(files);
    
    for (const file of fileArray) {
      const fileType = this.getFileCategory(file.type, file.name);
      
      if (fileType === 'other') {
        continue;
      }
      
      const item: FileProcessingItem = {
        id: `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        filePath: null,
        name: file.name,
        type: fileType,
        size: file.size,
        status: 'pending',
        progress: 0,
      };
      
      this.processingItems.set(item.id, item);
      results.push(item);
    }
    
    return results;
  }

  // 处理画布拖放文件
  async processCanvasDropFiles(files: FileList | File[], _position: { x: number; y: number }): Promise<FileProcessingItem[]> {
    return this.processWebFiles(files);
  }

  // 处理Tauri文件
  async processTauriFiles(_filePaths: string[]): Promise<FileProcessingItem[]> {
    return [];
  }

  // 检查文件类型是否支持
  isSupportedFileType(fileType: string): boolean {
    return fileType.startsWith('image/') || fileType.startsWith('video/');
  }

  // 检查文件扩展名是否支持
  isSupportedFileByExtension(fileName: string): boolean {
    const ext = fileName.toLowerCase().split('.').pop() || '';
    const supportedImageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
    const supportedVideoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv'];
    return [...supportedImageExts, ...supportedVideoExts].includes(ext);
  }

  // 获取文件类别
  getFileCategory(fileType: string, fileName?: string): 'image' | 'video' | 'other' {
    if (fileType.startsWith('image/')) return 'image';
    if (fileType.startsWith('video/')) return 'video';
    if (fileName) {
      const ext = fileName.toLowerCase().split('.').pop() || '';
      const supportedImageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
      const supportedVideoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv'];
      if (supportedImageExts.includes(ext)) return 'image';
      if (supportedVideoExts.includes(ext)) return 'video';
    }
    return 'other';
  }

  // 设置回调
  setCallbacks(_callbacks: {
    onProgress?: (item: FileProcessingItem) => void;
    onComplete?: (item: FileProcessingItem) => void;
    onError?: (item: FileProcessingItem, error: string) => void;
  }): void {
    // 回调存储（这里只是占位符，实际回调由使用方管理）
  }
}

// 导出单例实例和类型
export const optimizedDragDropManager = OptimizedDragDropManager.getInstance();
export type { FileProcessingItem } from './tauri-drag-drop';