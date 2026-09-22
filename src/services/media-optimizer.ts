/**
 * 图片优化工具类
 * 提供WebP转换、懒加载、响应式图片、资源预加载等功能
 */

// 图片质量配置
const IMAGE_QUALITY = {
  thumbnail: 0.6,
  medium: 0.8,
  high: 0.95,
};

// 图片尺寸阈值
const SIZE_THRESHOLDS = {
  thumbnail: { maxWidth: 200, maxHeight: 200 },
  medium: { maxWidth: 800, maxHeight: 600 },
  large: { maxWidth: 1920, maxHeight: 1080 },
};

// 缓存配置
const CACHE_CONFIG = {
  maxCacheSize: 50 * 1024 * 1024, // 50MB
  maxCacheAge: 1000 * 60 * 60 * 24, // 24小时
  maxCacheCount: 100,
};

interface CachedImage {
  blob: Blob;
  timestamp: number;
  size: number;
  url: string;
}

class ImageOptimizer {
  private cache: Map<string, CachedImage> = new Map();
  private loadingPromises: Map<string, Promise<Blob>> = new Map();
  private observer: IntersectionObserver | null = null;
  private webpSupported: boolean | null = null;

  constructor() {
    this.initWebPSupport();
    this.initLazyLoadObserver();
  }

  private async initWebPSupport(): Promise<void> {
    if (typeof window === 'undefined') return;
    
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.webpSupported = img.width > 0 && img.height > 0;
        resolve();
      };
      img.onerror = () => {
        this.webpSupported = false;
        resolve();
      };
      img.src = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
    });
  }

  private initLazyLoadObserver(): void {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            const src = img.dataset.src;
            if (src) {
              img.src = src;
              img.removeAttribute('data-src');
              this.observer?.unobserve(img);
            }
          }
        });
      },
      {
        rootMargin: '50px 0px',
        threshold: 0.01,
      }
    );
  }

  async convertToWebP(file: File | Blob, quality = 0.9): Promise<Blob> {
    if (!this.webpSupported) {
      return file;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('Canvas context failed'));
          return;
        }

        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('WebP conversion failed'));
            }
          },
          'image/webp',
          quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Image load failed'));
      };

      img.src = url;
    });
  }

  async resizeImage(
    file: File,
    maxWidth: number,
    maxHeight: number,
    quality = 0.85,
    format: 'jpeg' | 'png' | 'webp' = 'jpeg'
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        let { naturalWidth: width, naturalHeight: height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('Canvas context failed'));
          return;
        }

        if (format === 'png') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);

        const mimeType = `image/${format}`;
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Image resize failed'));
            }
          },
          mimeType,
          quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Image load failed'));
      };

      img.src = url;
    });
  }

  async optimizeForDisplay(
    file: File,
    size: 'thumbnail' | 'medium' | 'large' = 'medium',
    useWebP = true
  ): Promise<Blob> {
    const { maxWidth, maxHeight } = SIZE_THRESHOLDS[size];
    const quality = IMAGE_QUALITY[size];

    let blob = await this.resizeImage(file, maxWidth, maxHeight, quality);

    if (useWebP && this.webpSupported) {
      blob = await this.convertToWebP(blob, quality);
    }

    return blob;
  }

  getOptimizedUrl(file: File, size: 'thumbnail' | 'medium' | 'large' = 'medium'): string {
    const key = `${file.name}-${file.size}-${size}`;
    
    if (this.cache.has(key)) {
      const cached = this.cache.get(key)!;
      if (Date.now() - cached.timestamp < CACHE_CONFIG.maxCacheAge) {
        return cached.url;
      }
      this.cache.delete(key);
    }

    const blobPromise = this.optimizeForDisplay(file, size);
    
    blobPromise.then((blob) => {
      const url = URL.createObjectURL(blob);
      this.cache.set(key, {
        blob,
        timestamp: Date.now(),
        size: blob.size,
        url,
      });
      this.cleanupCache();
    });

    return URL.createObjectURL(file);
  }

  private cleanupCache(): void {
    if (this.cache.size <= CACHE_CONFIG.maxCacheCount) return;

    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toRemove = entries.slice(0, entries.length - CACHE_CONFIG.maxCacheCount);
    toRemove.forEach(([key, cached]) => {
      URL.revokeObjectURL(cached.url);
      this.cache.delete(key);
    });
  }

  observeLazyLoad(img: HTMLImageElement): void {
    if (this.observer && img.dataset.src) {
      this.observer.observe(img);
    }
  }

  unobserveLazyLoad(img: HTMLImageElement): void {
    if (this.observer) {
      this.observer.unobserve(img);
    }
  }

  async preloadImage(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = src;
    });
  }

  async preloadImages(srcs: string[], onProgress?: (loaded: number, total: number) => void): Promise<void> {
    const total = srcs.length;
    let loaded = 0;

    const promises = srcs.map(
      (src) =>
        this.preloadImage(src).then(() => {
          loaded++;
          onProgress?.(loaded, total);
        })
    );

    await Promise.all(promises);
  }

  async getResponsiveSrcSet(
    file: File,
    sizes = [320, 640, 960, 1280, 1920]
  ): Promise<string> {
    const srcSet = await Promise.all(
      sizes.map(async (width) => {
        const blob = await this.resizeImage(file, width, width * 1.5);
        const url = URL.createObjectURL(blob);
        return `${url} ${width}w`;
      })
    );

    return srcSet.join(', ');
  }

  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    this.cache.forEach((cached) => {
      URL.revokeObjectURL(cached.url);
    });
    this.cache.clear();
  }
}

export const imageOptimizer = new ImageOptimizer();

export function createLazyImage(
  src: string,
  options: {
    width?: number;
    height?: number;
    alt?: string;
    className?: string;
    placeholder?: string;
    onLoad?: () => void;
    onError?: () => void;
  } = {}
): HTMLImageElement {
  const img = document.createElement('img');
  
  img.dataset.src = src;
  img.alt = options.alt || '';
  img.className = options.className || '';
  img.width = options.width || 0;
  img.height = options.height || 0;
  
  if (options.placeholder) {
    img.src = options.placeholder;
  }

  img.onload = options.onLoad;
  img.onerror = options.onError;

  imageOptimizer.observeLazyLoad(img);

  return img;
}

export async function optimizeImages(
  files: File[],
  size: 'thumbnail' | 'medium' | 'large' = 'medium',
  onProgress?: (current: number, total: number) => void
): Promise<File[]> {
  const total = files.length;
  const optimized: File[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const blob = await imageOptimizer.optimizeForDisplay(file, size);
    const optimizedFile = new File([blob], file.name, { type: blob.type });
    optimized.push(optimizedFile);
    onProgress?.(i + 1, total);
  }

  return optimized;
}
