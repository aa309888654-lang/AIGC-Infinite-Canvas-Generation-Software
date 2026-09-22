import React, { useState, useRef, useEffect, memo, useCallback } from 'react';

interface OptimizedImageProps {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  thumbnail?: boolean;
  thumbnailSize?: number;
  format?: 'webp' | 'jpg' | 'png' | 'avif';
  quality?: number;
  lazy?: boolean;
  placeholder?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  onClick?: () => void;
  onLoad?: () => void;
  onError?: () => void;
}

const STATIC_ASSET_BASE_URL = (import.meta.env.VITE_STATIC_BASE_URL || '').replace(/\/+$/, '');

const LOCAL_ONLY_PREFIXES = [
  '/uploads/',
  '/api/',
];

function toStaticAssetUrl(src: string): string {
  if (!src) return src;
  if (/^https?:\/\//i.test(src)) return src;

  if (import.meta.env.DEV) {
    if (src.startsWith('/')) return src;
  }

  for (const prefix of LOCAL_ONLY_PREFIXES) {
    if (src.startsWith(prefix)) return src;
  }
  if (src.startsWith('/logo') ||
      src.startsWith('/app-icon') ||
      src.startsWith('/company-map') ||
      src.startsWith('/favicon')) return src;
  if (src.startsWith('/') && STATIC_ASSET_BASE_URL) return `${STATIC_ASSET_BASE_URL}${src}`;
  return src;
}

function buildOptimizedImageUrl(src: string, options: { thumbnail?: boolean; thumbnailSize?: number; width?: number; height?: number; format?: string; quality?: number }): string {
  if (!src) return src;
  void options;
  return toStaticAssetUrl(src);
}

function buildFallbackUrls(src: string, options: { thumbnail?: boolean; thumbnailSize?: number; width?: number; height?: number; format?: string; quality?: number }): string[] {
  const urls: string[] = [];
  const staticUrl = buildOptimizedImageUrl(src, options);
  if (staticUrl !== src) urls.push(staticUrl);

  if (src.startsWith('/')) {
    const localUrl = window.location.origin + src;
    if (!urls.includes(localUrl)) urls.push(localUrl);
  }

  if (/\.(webp|avif)(\?.*)?$/i.test(src)) {
    const jpgSrc = src.replace(/\.(webp|avif)(\?.*)?$/i, '.jpg');
    const jpgStaticUrl = buildOptimizedImageUrl(jpgSrc, options);
    if (jpgStaticUrl !== jpgSrc && !urls.includes(jpgStaticUrl)) urls.push(jpgStaticUrl);
    if (jpgSrc.startsWith('/')) {
      const jpgLocal = window.location.origin + jpgSrc;
      if (!urls.includes(jpgLocal)) urls.push(jpgLocal);
    }
  }

  if (src.startsWith('/') && STATIC_ASSET_BASE_URL && !src.startsWith('/uploads/') && !src.startsWith('/api/')) {
    const rawStaticUrl = STATIC_ASSET_BASE_URL + src;
    if (!urls.includes(rawStaticUrl)) urls.push(rawStaticUrl);
  }

  if (urls.length === 0 && /^https?:\/\//i.test(src)) {
    urls.push(src);
  }

  return [...new Set(urls)];
}

const MAX_RETRIES = 3;

const OptimizedImage: React.FC<OptimizedImageProps> = memo(({
  src,
  alt = '',
  width,
  height,
  className = '',
  style,
  thumbnail = false,
  thumbnailSize = 200,
  format = 'webp',
  quality = 80,
  lazy = true,
  placeholder,
  objectFit = 'cover',
  onClick,
  onLoad,
  onError,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [inView, setInView] = useState(!lazy);
  const [retryIndex, setRetryIndex] = useState(0);
  const imgRef = useRef<HTMLDivElement>(null);
  const fallbackUrlsRef = useRef<string[]>([]);

  if (fallbackUrlsRef.current.length === 0 && src) {
    fallbackUrlsRef.current = buildFallbackUrls(src, { thumbnail, thumbnailSize, width, height, format, quality });
  }

  useEffect(() => {
    if (!lazy || inView) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [lazy, inView]);

  const currentSrc = inView && !error && retryIndex < fallbackUrlsRef.current.length
    ? fallbackUrlsRef.current[retryIndex]
    : '';

  const handleError = useCallback(() => {
    const nextIndex = retryIndex + 1;
    if (nextIndex < fallbackUrlsRef.current.length && nextIndex < MAX_RETRIES) {
      setRetryIndex(nextIndex);
    } else {
      setError(true);
      onError?.();
    }
  }, [retryIndex, onError]);

  const placeholderStyle: React.CSSProperties = {
    width: width || '100%',
    height: height || '100%',
    backgroundColor: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...style,
  };

  return (
    <div
      ref={imgRef}
      className={className}
      style={{ ...style }}
      onClick={onClick}
    >
      {!loaded && !error && (
        <div style={placeholderStyle}>
          {placeholder ? (
            <img src={placeholder} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(10px)' }} />
          ) : (
            <div style={{ color: '#555', fontSize: '12px' }}>加载中...</div>
          )}
        </div>
      )}
      {error && (
        <div style={placeholderStyle}>
          <div style={{ color: '#666', fontSize: '12px' }}>加载失败</div>
        </div>
      )}
      {inView && currentSrc && (
        <img
          src={currentSrc}
          alt={alt}
          width={width}
          height={height}
          loading={lazy ? 'lazy' : 'eager'}
          style={{
            width: '100%',
            height: '100%',
            objectFit,
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
          onLoad={() => {
            setLoaded(true);
            onLoad?.();
          }}
          onError={handleError}
        />
      )}
    </div>
  );
});

OptimizedImage.displayName = 'OptimizedImage';

export { buildOptimizedImageUrl };
export default OptimizedImage;
