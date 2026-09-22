/**
 * 视频优化工具类
 * 提供视频压缩、流式加载、智能缩略图、预加载等功能
 */

const VIDEO_CONFIG = {
  thumbnailTimestamp: 0.1,
  thumbnailWidth: 320,
  thumbnailHeight: 180,
  thumbnailQuality: 0.7,
  maxCacheSize: 100 * 1024 * 1024, // 100MB
  preloadBufferSize: 1024 * 1024, // 1MB
  lazyLoadOffset: 500, // 预加载到视口外500px
};

interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  frameRate?: number;
  bitrate?: number;
  codec?: string;
  size: number;
}

interface VideoCache {
  metadata: VideoMetadata;
  thumbnailUrl?: string;
  lastAccess: number;
}

class VideoOptimizer {
  private cache: Map<string, VideoCache> = new Map();
  private loadingPromises: Map<string, Promise<VideoMetadata>> = new Map();
  private observer: IntersectionObserver | null = null;
  private preloadQueue: Set<string> = new Set();
  private bandwidth: number = (navigator as any).connection?.downlink || 5;

  constructor() {
    this.initLazyLoadObserver();
    this.setupBandwidthDetection();
  }

  private initLazyLoadObserver(): void {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const video = entry.target as HTMLVideoElement;
            const src = video.dataset.src || video.src;
            
            if (src && !video.src.includes('blob:')) {
              this.loadVideo(video, src);
            }
            
            // 预加载附近的其他视频
            this.preloadNearbyVideos(entry.target as HTMLElement);
          } else {
            const video = entry.target as HTMLVideoElement;
            video.pause();
            video.src = '';
            video.load();
          }
        });
      },
      {
        rootMargin: `${VIDEO_CONFIG.lazyLoadOffset}px`,
        threshold: 0.01,
      }
    );
  }

  private setupBandwidthDetection(): void {
    if (typeof window === 'undefined' || !('connection' in navigator)) return;

    const connection = navigator.connection as any;
    connection.addEventListener('change', () => {
      this.bandwidth = connection.downlink || 5;
      // console.log('[VideoOptimizer] 带宽更新:', this.bandwidth, 'Mbps');
    });
  }

  private async loadVideo(video: HTMLVideoElement, src: string): Promise<void> {
    video.src = src;
    video.load();
    
    return new Promise((resolve, reject) => {
      video.oncanplay = () => resolve();
      video.onerror = () => reject(new Error('Video load failed'));
    });
  }

  async getMetadata(file: File | Blob): Promise<VideoMetadata> {
    const cacheKey = file instanceof File ? `${file.name}-${file.size}` : `blob-${file.size}`;

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      cached.lastAccess = Date.now();
      return cached.metadata;
    }

    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey)!;
    }

    const promise = new Promise<VideoMetadata>((resolve, reject) => {
      const video = document.createElement('video');
      const url = URL.createObjectURL(file);

      video.preload = 'metadata';
      video.muted = true;

      video.onloadedmetadata = () => {
        const metadata: VideoMetadata = {
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          size: file instanceof File ? file.size : file.size,
        };

        URL.revokeObjectURL(url);
        
        this.cache.set(cacheKey, {
          metadata,
          lastAccess: Date.now(),
        });

        this.cleanupCache();
        this.loadingPromises.delete(cacheKey);
        resolve(metadata);
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        this.loadingPromises.delete(cacheKey);
        reject(new Error('Failed to load video metadata'));
      };

      video.src = url;
    });

    this.loadingPromises.set(cacheKey, promise);
    return promise;
  }

  async createSmartThumbnail(
    file: File | Blob,
    timestamp?: number
  ): Promise<string> {
    const cacheKey = `thumb-${file instanceof File ? file.name + file.size : file.size}`;
    
    const cached = this.cache.get(cacheKey);
    if (cached?.thumbnailUrl) {
      cached.lastAccess = Date.now();
      return cached.thumbnailUrl;
    }

    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const url = URL.createObjectURL(file);
      
      video.preload = 'metadata';
      video.muted = true;
      video.crossOrigin = 'anonymous';

      video.onloadedmetadata = () => {
        const seekTime = timestamp ?? VIDEO_CONFIG.thumbnailTimestamp;
        video.currentTime = Math.min(seekTime, video.duration);
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          
          let { videoWidth: width, videoHeight: height } = video;
          const aspectRatio = width / height;

          if (aspectRatio > VIDEO_CONFIG.thumbnailWidth / VIDEO_CONFIG.thumbnailHeight) {
            width = VIDEO_CONFIG.thumbnailWidth;
            height = Math.round(width / aspectRatio);
          } else {
            height = VIDEO_CONFIG.thumbnailHeight;
            width = Math.round(height * aspectRatio);
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(url);
            reject(new Error('Canvas context failed'));
            return;
          }

          ctx.drawImage(video, 0, 0, width, height);

          const thumbnailUrl = canvas.toDataURL('image/jpeg', VIDEO_CONFIG.thumbnailQuality);
          URL.revokeObjectURL(url);

          const existingCache = this.cache.get(cacheKey);
          if (existingCache) {
            existingCache.thumbnailUrl = thumbnailUrl;
            existingCache.lastAccess = Date.now();
          } else {
            this.cache.set(cacheKey, {
              metadata: { duration: video.duration, width, height, size: 0 },
              thumbnailUrl,
              lastAccess: Date.now(),
            });
          }

          resolve(thumbnailUrl);
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Video seek failed'));
      };

      video.src = url;
    });
  }

  async extractMultipleThumbnails(
    file: File | Blob,
    count = 5
  ): Promise<string[]> {
    const metadata = await this.getMetadata(file);
    const interval = metadata.duration / (count + 1);
    const thumbnails: string[] = [];

    for (let i = 1; i <= count; i++) {
      const timestamp = interval * i;
      const thumbnail = await this.createSmartThumbnail(file, timestamp);
      thumbnails.push(thumbnail);
    }

    return thumbnails;
  }

  async preloadVideo(
    src: string,
    preloadAmount: 'none' | 'metadata' | 'auto' = 'auto'
  ): Promise<void> {
    if (this.preloadQueue.has(src)) return;

    this.preloadQueue.add(src);

    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = preloadAmount;
      video.muted = true;

      video.onloadstart = () => {
        // console.log('[VideoOptimizer] 开始预加载:', src);
      };

      video.oncanplaythrough = () => {
        // console.log('[VideoOptimizer] 预加载完成:', src);
        this.preloadQueue.delete(src);
        resolve();
      };

      video.onerror = () => {
        console.error('[VideoOptimizer] 预加载失败:', src);
        this.preloadQueue.delete(src);
        reject(new Error('Video preload failed'));
      };

      video.src = src;
    });
  }

  private preloadNearbyVideos(_element: HTMLElement): void {
    const videos = document.querySelectorAll('video[data-preload="auto"]');
    videos.forEach((video) => {
      const src = (video as HTMLVideoElement).dataset.src || (video as HTMLVideoElement).src;
      if (src && !this.preloadQueue.has(src)) {
        this.preloadVideo(src, 'metadata').catch(() => { /* noop */ });
      }
    });
  }

  observeLazyLoad(video: HTMLVideoElement): void {
    if (this.observer) {
      this.observer.observe(video);
    }
  }

  unobserveLazyLoad(video: HTMLVideoElement): void {
    if (this.observer) {
      this.observer.unobserve(video);
    }
  }

  getAdaptiveQuality(): 'low' | 'medium' | 'high' | 'auto' {
    if (this.bandwidth < 2) return 'low';
    if (this.bandwidth < 5) return 'medium';
    if (this.bandwidth < 10) return 'high';
    return 'auto';
  }

  createAdaptiveVideoSrc(
    sources: Array<{ src: string; type: string; size?: number }>
  ): HTMLSourceElement[] {
    return sources.map(({ src, type }) => {
      const source = document.createElement('source');
      source.src = src;
      source.type = type;
      return source;
    });
  }

  private cleanupCache(): void {
    if (this.cache.size <= 50) return;

    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);

    const toRemove = entries.slice(0, entries.length - 50);
    toRemove.forEach(([key, cached]) => {
      if (cached.thumbnailUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(cached.thumbnailUrl);
      }
      this.cache.delete(key);
    });
  }

  getCacheStats(): { count: number; totalSize: number } {
    return {
      count: this.cache.size,
      totalSize: Array.from(this.cache.values()).reduce(
        (sum, cache) => sum + (cache.metadata?.size || 0),
        0
      ),
    };
  }

  clearCache(): void {
    this.cache.forEach((cached) => {
      if (cached.thumbnailUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(cached.thumbnailUrl);
      }
    });
    this.cache.clear();
  }

  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.clearCache();
    this.preloadQueue.clear();
  }
}

export const videoOptimizer = new VideoOptimizer();

export function createLazyVideo(
  src: string,
  options: {
    autoplay?: boolean;
    muted?: boolean;
    loop?: boolean;
    controls?: boolean;
    poster?: string;
    preload?: 'none' | 'metadata' | 'auto';
    className?: string;
    width?: number;
    height?: number;
  } = {}
): HTMLVideoElement {
  const video = document.createElement('video');
  
  video.dataset.src = src;
  video.autoplay = options.autoplay ?? false;
  video.muted = options.muted ?? true;
  video.loop = options.loop ?? false;
  video.controls = options.controls ?? true;
  video.preload = options.preload ?? 'none';
  video.className = options.className || '';
  video.width = options.width || 0;
  video.height = options.height || 0;
  
  if (options.poster) {
    video.poster = options.poster;
  }

  videoOptimizer.observeLazyLoad(video);

  return video;
}

export async function generateVideoSprites(
  file: File,
  spriteCount = 10
): Promise<{ sprites: string[]; width: number; height: number }> {
  const metadata = await videoOptimizer.getMetadata(file);
  const interval = metadata.duration / (spriteCount + 1);
  const sprites: string[] = [];

  const width = 160;
  const height = 90;

  for (let i = 1; i <= spriteCount; i++) {
    const timestamp = interval * i;
    const sprite = await videoOptimizer.createSmartThumbnail(file, timestamp);
    sprites.push(sprite);
  }

  return { sprites, width, height };
}
