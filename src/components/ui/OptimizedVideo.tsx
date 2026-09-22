import React, { useState, useRef, useEffect, memo, useCallback } from 'react';

interface OptimizedVideoProps {
  src: string;
  className?: string;
  style?: React.CSSProperties;
  muted?: boolean;
  loop?: boolean;
  autoPlay?: boolean;
  controls?: boolean;
  playsInline?: boolean;
  poster?: string;
  lazy?: boolean;
  hoverPlay?: boolean;
  onLoadStart?: () => void;
  onLoadedData?: () => void;
  onError?: () => void;
}

function buildVideoPoster(src: string): string | undefined {
  void src;
  return undefined;
}

function buildVideoPosterScaled(src: string, width: number): string | undefined {
  void src;
  void width;
  return undefined;
}

const OptimizedVideo: React.FC<OptimizedVideoProps> = memo(({
  src,
  className = '',
  style,
  muted = true,
  loop = false,
  autoPlay = false,
  controls = false,
  playsInline = true,
  poster: externalPoster,
  lazy = true,
  hoverPlay = false,
  onLoadStart,
  onLoadedData,
  onError,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(!lazy);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const retryCountRef = useRef(0);

  const poster = externalPoster || buildVideoPoster(src);

  useEffect(() => {
    if (!lazy || inView) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [lazy, inView]);

  const handleMouseEnter = useCallback(() => {
    if (hoverPlay && videoRef.current && !error) {
      videoRef.current.play().catch(() => { /* noop */ });
    }
  }, [hoverPlay, error]);

  const handleMouseLeave = useCallback(() => {
    if (hoverPlay && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [hoverPlay]);

  const handleError = useCallback(() => {
    if (retryCountRef.current < 1) {
      retryCountRef.current++;
      return;
    }
    setError(true);
    onError?.();
  }, [onError]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: 'relative', overflow: 'hidden', ...style }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {!loaded && !error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1a1a2e',
            zIndex: 1,
          }}
        >
          {poster && (
            <img
              src={poster}
              alt=""
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'blur(4px)',
                opacity: 0.5,
              }}
            />
          )}
        </div>
      )}
      {error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1a1a2e',
            zIndex: 1,
          }}
        >
          <span style={{ color: '#666', fontSize: '12px' }}>加载失败</span>
        </div>
      )}
      {inView && !error && (
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          className={className}
          muted={muted}
          loop={loop}
          autoPlay={autoPlay}
          controls={controls}
          playsInline={playsInline}
          preload={lazy ? 'metadata' : 'auto'}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
          onLoadStart={() => onLoadStart?.()}
          onLoadedData={() => {
            setLoaded(true);
            onLoadedData?.();
          }}
          onError={handleError}
        />
      )}
    </div>
  );
});

OptimizedVideo.displayName = 'OptimizedVideo';

export { buildVideoPoster, buildVideoPosterScaled };
export default OptimizedVideo;
