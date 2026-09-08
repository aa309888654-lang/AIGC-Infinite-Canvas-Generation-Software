import { useState, useEffect, useRef, useCallback } from 'react';
import { imageOptimizer } from '@/services/media-optimizer';
import { videoOptimizer } from '@/services/video-optimizer';
import { resourcePreloader } from '@/services/resource-preloader';

export function useImageOptimization(file?: File | null) {
  const [optimizedUrl, setOptimizedUrl] = useState<string>('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!file) {
      setOptimizedUrl('');
      return;
    }

    let mounted = true;
    let currentUrl = '';
    setIsOptimizing(true);
    setError(null);
    setProgress(0);

    const optimize = async () => {
      try {
        setProgress(30);
        const blob = await imageOptimizer.optimizeForDisplay(file, 'medium');
        setProgress(70);

        if (!mounted) return;

        currentUrl = URL.createObjectURL(blob);
        setOptimizedUrl(currentUrl);
        setProgress(100);
      } catch (err) {
        if (mounted) {
          setError(err as Error);
        }
      } finally {
        if (mounted) {
          setIsOptimizing(false);
        }
      }
    };

    optimize();

    return () => {
      mounted = false;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [file]);

  return { optimizedUrl, isOptimizing, error, progress };
}

export function useVideoMetadata(file?: File | null) {
  const [metadata, setMetadata] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!file) {
      setMetadata(null);
      return;
    }

    let mounted = true;
    setIsLoading(true);
    setError(null);

    const loadMetadata = async () => {
      try {
        const meta = await videoOptimizer.getMetadata(file);
        if (mounted) {
          setMetadata(meta);
        }
      } catch (err) {
        if (mounted) {
          setError(err as Error);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadMetadata();

    return () => {
      mounted = false;
    };
  }, [file]);

  return { metadata, isLoading, error };
}

export function useVideoThumbnail(file?: File | null) {
  const [thumbnail, setThumbnail] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!file) {
      setThumbnail('');
      return;
    }

    let mounted = true;
    setIsGenerating(true);
    setError(null);

    const generate = async () => {
      try {
        const thumb = await videoOptimizer.createSmartThumbnail(file);
        if (mounted) {
          setThumbnail(thumb);
        }
      } catch (err) {
        if (mounted) {
          setError(err as Error);
        }
      } finally {
        if (mounted) {
          setIsGenerating(false);
        }
      }
    };

    generate();

    return () => {
      mounted = false;
    };
  }, [file]);

  return { thumbnail, isGenerating, error };
}

export function useLazyImage(src: string, options: {
  placeholder?: string;
  rootMargin?: string;
  threshold?: number;
} = {}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(options.placeholder || '');
  const [error, setError] = useState<Error | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!imgRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observerRef.current?.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: options.rootMargin || '50px',
        threshold: options.threshold || 0.01,
      }
    );

    observerRef.current.observe(imgRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [options.rootMargin, options.threshold]);

  useEffect(() => {
    if (!isInView || !src) return;

    let mounted = true;
    let currentUrl = '';

    const loadImage = async () => {
      try {
        const blob = await resourcePreloader.addTask(src, {
          type: 'image',
          priority: 'normal',
          cache: true,
        });

        if (!mounted) return;

        currentUrl = URL.createObjectURL(blob);
        setCurrentSrc(currentUrl);
        setIsLoaded(true);
      } catch (err) {
        if (mounted) {
          setError(err as Error);
        }
      }
    };

    loadImage();

    return () => {
      mounted = false;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [isInView, src]);

  return {
    ref: imgRef,
    isLoaded,
    isInView,
    src: currentSrc,
    error,
  };
}

export function useLazyVideo(src: string, options: {
  poster?: string;
  preload?: 'none' | 'metadata' | 'auto';
  rootMargin?: string;
} = {}) {
  const [isInView, setIsInView] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observerRef.current?.unobserve(entry.target);
          } else {
            const video = videoRef.current;
            if (video) {
              video.pause();
              video.src = '';
            }
          }
        });
      },
      {
        rootMargin: options.rootMargin || '500px',
        threshold: 0.01,
      }
    );

    observerRef.current.observe(videoRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [options.rootMargin]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isInView) {
      video.src = src;
      if (options.preload !== 'none') {
        video.preload = options.preload || 'metadata';
      }
      video.load();
    }
  }, [isInView, src, options.preload]);

  return {
    ref: videoRef,
    isInView,
  };
}

export function useMediaPreloader(urls: string[], options: {
  type?: 'image' | 'video';
  priority?: 'low' | 'normal' | 'high';
  onProgress?: (loaded: number, total: number) => void;
} = {}) {
  const [loadedCount, setLoadedCount] = useState(0);
  const [isPreloading, setIsPreloading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const preload = useCallback(async () => {
    if (urls.length === 0) return;

    setIsPreloading(true);
    setLoadedCount(0);
    setError(null);

    const type = options.type || 'image';

    try {
      for (let i = 0; i < urls.length; i++) {
        await resourcePreloader.addTask(urls[i], {
          type,
          priority: options.priority || 'low',
          cache: true,
        });
        setLoadedCount(i + 1);
        options.onProgress?.(i + 1, urls.length);
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsPreloading(false);
    }
  }, [urls, options]);

  useEffect(() => {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => {
        preload();
      }, { timeout: 5000 });
    } else {
      setTimeout(preload, 1000);
    }
  }, [preload]);

  return {
    loadedCount,
    totalCount: urls.length,
    isPreloading,
    error,
    preload,
  };
}

export function useAdaptiveQuality() {
  const [quality, setQuality] = useState<'low' | 'medium' | 'high' | 'auto'>('auto');

  useEffect(() => {
    const updateQuality = () => {
      const bandwidth = (navigator as any).connection?.downlink || 5;
      
      if (bandwidth < 2) {
        setQuality('low');
      } else if (bandwidth < 5) {
        setQuality('medium');
      } else if (bandwidth < 10) {
        setQuality('high');
      } else {
        setQuality('auto');
      }
    };

    updateQuality();

    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', updateQuality);
    }

    return () => {
      if (connection) {
        connection.removeEventListener('change', updateQuality);
      }
    };
  }, []);

  return quality;
}

export function useImageOptimizer() {
  const optimize = useCallback(
    async (file: File, size: 'thumbnail' | 'medium' | 'large' = 'medium') => {
      const blob = await imageOptimizer.optimizeForDisplay(file, size);
      return new File([blob], file.name, { type: blob.type });
    },
    []
  );

  const toWebP = useCallback(async (file: File, quality = 0.9) => {
    const blob = await imageOptimizer.convertToWebP(file, quality);
    return new File([blob], file.name.replace(/\.\w+$/, '.webp'), { type: 'image/webp' });
  }, []);

  const preload = useCallback(async (src: string) => {
    await imageOptimizer.preloadImage(src);
  }, []);

  const preloadMultiple = useCallback(
    async (srcs: string[], onProgress?: (loaded: number, total: number) => void) => {
      await imageOptimizer.preloadImages(srcs, onProgress);
    },
    []
  );

  return {
    optimize,
    toWebP,
    preload,
    preloadMultiple,
  };
}

export function useVideoOptimizer() {
  const getMetadata = useCallback(async (file: File) => {
    return videoOptimizer.getMetadata(file);
  }, []);

  const createThumbnail = useCallback(
    async (file: File, timestamp?: number) => {
      return videoOptimizer.createSmartThumbnail(file, timestamp);
    },
    []
  );

  const preload = useCallback(
    async (src: string, preloadAmount: 'none' | 'metadata' | 'auto' = 'metadata') => {
      await videoOptimizer.preloadVideo(src, preloadAmount);
    },
    []
  );

  const getAdaptiveQuality = useCallback(() => {
    return videoOptimizer.getAdaptiveQuality();
  }, []);

  return {
    getMetadata,
    createThumbnail,
    preload,
    getAdaptiveQuality,
  };
}
