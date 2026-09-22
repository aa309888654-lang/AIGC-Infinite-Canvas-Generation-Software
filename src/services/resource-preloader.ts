/**
 * 资源预加载和缓存管理器
 * 统一管理图片和视频的预加载、缓存、优先级队列
 */

type ResourceType = 'image' | 'video' | 'audio';

interface ResourceConfig {
  type: ResourceType;
  priority: 'low' | 'normal' | 'high';
  preload?: boolean;
  cache?: boolean;
  size?: number;
}

interface PreloadTask {
  url: string;
  config: ResourceConfig;
  status: 'pending' | 'loading' | 'completed' | 'error';
  progress: number;
  startTime?: number;
  endTime?: number;
  error?: Error;
  blob?: Blob;
}

class ResourcePreloader {
  private taskQueue: Map<string, PreloadTask> = new Map();
  private loadingPool: Set<string> = new Set();
  private cache: Map<string, Blob> = new Map();
  private maxConcurrent = 3;
  private maxCacheSize = 200 * 1024 * 1024; // 200MB
  private currentCacheSize = 0;
  private priorityOrder = ['high', 'normal', 'low'];
  private observers: Map<string, IntersectionObserver> = new Map();
  private bandwidth: number = 5;
  private networkInformation: any = null;

  constructor() {
    this.setupNetworkDetection();
    this.setupIdleCallback();
  }

  private setupNetworkDetection(): void {
    if (typeof window === 'undefined' || !('connection' in navigator)) return;

    this.networkInformation = navigator.connection as any;
    this.bandwidth = this.networkInformation.downlink || 5;

    this.networkInformation.addEventListener('change', () => {
      this.bandwidth = this.networkInformation.downlink || 5;
      // console.log('[ResourcePreloader] 网络状态变化:', {
      //   bandwidth: this.bandwidth,
      //   effectiveType: this.networkInformation.effectiveType,
      //   saveData: this.networkInformation.saveData,
      // });
      
      this.adjustConcurrentLoading();
    });
  }

  private setupIdleCallback(): void {
    if (typeof window === 'undefined') return;

    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => {
        this.processQueue();
      }, { timeout: 5000 });
    }
  }

  private adjustConcurrentLoading(): void {
    if (this.bandwidth < 2) {
      this.maxConcurrent = 1;
    } else if (this.bandwidth < 5) {
      this.maxConcurrent = 2;
    } else if (this.bandwidth < 10) {
      this.maxConcurrent = 3;
    } else {
      this.maxConcurrent = 5;
    }
    
    // console.log('[ResourcePreloader] 并发加载数调整为:', this.maxConcurrent);
  }

  addTask(url: string, config: ResourceConfig): Promise<Blob> {
    if (this.taskQueue.has(url)) {
      const task = this.taskQueue.get(url)!;
      if (task.status === 'completed' && task.blob) {
        return Promise.resolve(task.blob);
      }
      if (task.status === 'loading') {
        return this.waitForTask(url);
      }
    }

    const task: PreloadTask = {
      url,
      config,
      status: 'pending',
      progress: 0,
    };

    this.taskQueue.set(url, task);

    if (config.preload) {
      this.processQueue();
    }

    return this.waitForTask(url);
  }

  private async waitForTask(url: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const checkTask = () => {
        const task = this.taskQueue.get(url);
        
        if (!task) {
          reject(new Error('Task not found'));
          return;
        }

        if (task.status === 'completed' && task.blob) {
          resolve(task.blob);
          return;
        }

        if (task.status === 'error') {
          reject(task.error || new Error('Load failed'));
          return;
        }

        setTimeout(checkTask, 100);
      };

      checkTask();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.loadingPool.size >= this.maxConcurrent) return;

    const pendingTasks = Array.from(this.taskQueue.values())
      .filter((task) => task.status === 'pending')
      .sort((a, b) => {
        const aIndex = this.priorityOrder.indexOf(a.config.priority);
        const bIndex = this.priorityOrder.indexOf(b.config.priority);
        return aIndex - bIndex;
      });

    const toLoad = pendingTasks.slice(0, this.maxConcurrent - this.loadingPool.size);

    toLoad.forEach((task) => {
      this.loadResource(task);
    });
  }

  private async loadResource(task: PreloadTask): Promise<void> {
    task.status = 'loading';
    task.startTime = Date.now();
    this.loadingPool.add(task.url);

    try {
      const response = await fetch(task.url, {
        method: 'GET',
        mode: 'cors',
        cache: 'force-cache',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength) : 0;
      let loaded = 0;

      const reader = response.body?.getReader();
      if (!reader) {
        const blob = await response.blob();
        task.blob = blob;
        task.progress = 100;
        task.status = 'completed';
        task.endTime = Date.now();
        
        if (task.config.cache) {
          this.cacheResource(task.url, blob);
        }
        
        this.loadingPool.delete(task.url);
        this.processQueue();
        return;
      }

      const chunks: Uint8Array[] = [];

      while (true) { // eslint-disable-line no-constant-condition
        const { done, value } = await reader.read();
        
        if (done) break;

        chunks.push(value);
        loaded += value.length;

        if (total > 0) {
          task.progress = Math.round((loaded / total) * 100);
        }

        this.dispatchProgressEvent(task);
      }

      const blob = new Blob(chunks as BlobPart[], { type: this.getMimeType(task.url) });
      task.blob = blob;
      task.status = 'completed';
      task.endTime = Date.now();

      if (task.config.cache) {
        this.cacheResource(task.url, blob);
      }

      // console.log(`[ResourcePreloader] 加载完成: ${task.url}`, {
      //   size: (blob.size / 1024).toFixed(2) + 'KB',
      //   duration: (task.endTime - task.startTime) + 'ms',
      //   speed: ((blob.size / 1024) / ((task.endTime - task.startTime) / 1000)).toFixed(2) + 'KB/s',
      // });
    } catch (error) {
      task.status = 'error';
      task.error = error as Error;
      console.error('[ResourcePreloader] 加载失败:', task.url, error);
    } finally {
      this.loadingPool.delete(task.url);
      this.processQueue();
    }
  }

  private dispatchProgressEvent(task: PreloadTask): void {
    const event = new CustomEvent('resource-progress', {
      detail: {
        url: task.url,
        progress: task.progress,
        status: task.status,
      },
    });
    window.dispatchEvent(event);
  }

  private cacheResource(url: string, blob: Blob): void {
    if (this.currentCacheSize + blob.size > this.maxCacheSize) {
      this.evictCache(blob.size);
    }

    this.cache.set(url, blob);
    this.currentCacheSize += blob.size;
  }

  private evictCache(requiredSpace: number): void {
    const entries = Array.from(this.cache.entries());
    let freedSpace = 0;

    while (freedSpace < requiredSpace && entries.length > 0) {
      const [url, blob] = entries.shift()!;
      freedSpace += blob.size;
      this.cache.delete(url);
      URL.revokeObjectURL(url);
    }

    this.currentCacheSize -= freedSpace;
    // console.log(`[ResourcePreloader] 缓存清理，释放: ${(freedSpace / 1024 / 1024).toFixed(2)}MB`);
  }

  private getMimeType(url: string): string {
    const ext = url.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      mp4: 'video/mp4',
      webm: 'video/webm',
      mov: 'video/quicktime',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  getFromCache(url: string): Blob | undefined {
    return this.cache.get(url);
  }

  hasInCache(url: string): boolean {
    return this.cache.has(url);
  }

  getTaskStatus(url: string): PreloadTask | undefined {
    return this.taskQueue.get(url);
  }

  cancelTask(url: string): void {
    const task = this.taskQueue.get(url);
    if (task && task.status === 'pending') {
      task.status = 'error';
      task.error = new Error('Cancelled');
      this.taskQueue.delete(url);
    }
  }

  cancelAllTasks(): void {
    this.taskQueue.forEach((task) => {
      if (task.status === 'pending') {
        task.status = 'error';
        task.error = new Error('Cancelled');
      }
    });
    this.loadingPool.clear();
  }

  clearCache(): void {
    this.cache.forEach((_, url) => {
      URL.revokeObjectURL(url);
    });
    this.cache.clear();
    this.currentCacheSize = 0;
  }

  getStats(): {
    queueSize: number;
    loadingCount: number;
    cacheSize: number;
    cacheCount: number;
    maxConcurrent: number;
    bandwidth: number;
  } {
    return {
      queueSize: this.taskQueue.size,
      loadingCount: this.loadingPool.size,
      cacheSize: this.currentCacheSize,
      cacheCount: this.cache.size,
      maxConcurrent: this.maxConcurrent,
      bandwidth: this.bandwidth,
    };
  }

  observeIntersection(
    element: HTMLElement,
    onIntersect: (entry: IntersectionObserverEntry) => void,
    options?: IntersectionObserverInit
  ): void {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(onIntersect);
      },
      {
        rootMargin: '100px',
        threshold: 0.01,
        ...options,
      }
    );

    observer.observe(element);
    this.observers.set(this.getElementKey(element), observer);
  }

  unobserve(element: HTMLElement): void {
    const key = this.getElementKey(element);
    const observer = this.observers.get(key);
    if (observer) {
      observer.disconnect();
      this.observers.delete(key);
    }
  }

  private getElementKey(element: HTMLElement): string {
    return element.dataset.preloadId || Math.random().toString(36);
  }

  destroy(): void {
    this.cancelAllTasks();
    this.clearCache();
    this.observers.forEach((observer) => observer.disconnect());
    this.observers.clear();
  }
}

export const resourcePreloader = new ResourcePreloader();

export function preloadImage(
  url: string,
  options: { priority?: 'low' | 'normal' | 'high'; cache?: boolean } = {}
): Promise<Blob> {
  return resourcePreloader.addTask(url, {
    type: 'image',
    priority: options.priority || 'normal',
    cache: options.cache ?? true,
    preload: true,
  });
}

export function preloadVideo(
  url: string,
  options: { priority?: 'low' | 'normal' | 'high'; cache?: boolean } = {}
): Promise<Blob> {
  return resourcePreloader.addTask(url, {
    type: 'video',
    priority: options.priority || 'normal',
    cache: options.cache ?? true,
    preload: true,
  });
}

export function getPreloadedResource(url: string): Blob | undefined {
  return resourcePreloader.getFromCache(url);
}
