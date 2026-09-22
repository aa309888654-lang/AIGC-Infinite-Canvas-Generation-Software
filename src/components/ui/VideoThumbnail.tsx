import { memo, useRef, useState, useEffect, useCallback } from 'react';

interface VideoThumbnailProps {
  src: string;
  className?: string;
}

const VideoThumbnail = memo(({ src, className }: VideoThumbnailProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [useVideoFallback, setUseVideoFallback] = useState(false);
  const [error, setError] = useState(false);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    if (video.readyState >= 2) {
      try {
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 320;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/webp', 0.7);
          setThumbnailUrl(dataUrl);
        }
      } catch {
        setUseVideoFallback(true);
      }
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedData = () => {
      video.currentTime = 0.5;
    };

    const handleSeeked = () => {
      captureFrame();
    };

    const handleError = () => {
      setError(true);
    };

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('error', handleError);

    video.load();

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
    };
  }, [src, captureFrame]);

  if (error || !src) {
    return (
      <div className={className}>
        <div className="w-full h-full flex items-center justify-center bg-slate-100">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300">
            <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" /><rect x="2" y="6" width="14" height="12" rx="2" />
          </svg>
        </div>
      </div>
    );
  }

  if (useVideoFallback) {
    return (
      <video
        src={src}
        className={className}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        muted
        playsInline
        preload="metadata"
      />
    );
  }

  return (
    <>
      <video
        ref={videoRef}
        src={src}
        preload="metadata"
        muted
        playsInline
        className="hidden"
      />
      <canvas ref={canvasRef} className="hidden" />
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt=""
          className={className}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div className={className}>
          <div className="w-full h-full flex items-center justify-center bg-slate-100">
            <div className="text-xs text-slate-400">加载中...</div>
          </div>
        </div>
      )}
    </>
  );
});

VideoThumbnail.displayName = 'VideoThumbnail';
export default VideoThumbnail;
