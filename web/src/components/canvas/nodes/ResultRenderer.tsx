import { memo } from 'react';
import { cn } from '@/lib/utils';
import { normalizeMediaUrl, getSafeRenderableMediaUrl } from '@/lib/media-url';
import type { ResultMediaType } from '@/core/types/node-manifest';

export interface ResultRendererProps {
  mediaType: ResultMediaType;
  imageUrl?: string | null;
  videoUrl?: string | null;
  audioUrl?: string | null;
  text?: string | null;
  emptyLabel?: string;
  className?: string;
  onImageClick?: () => void;
  imageObjectFit?: 'contain' | 'cover';
  videoMuted?: boolean;
  videoLoop?: boolean;
  videoPlaysInline?: boolean;
  videoControls?: boolean;
  onVideoPlay?: () => void;
  onVideoPause?: () => void;
  onVideoEnded?: () => void;
  onVideoError?: () => void;
  onImageError?: () => void;
  textSelectable?: boolean;
}

/** v3 统一结果渲染 — 按 mediaType 分发 */
function ResultRenderer({
  mediaType,
  imageUrl,
  videoUrl,
  audioUrl,
  text,
  emptyLabel = '暂无输出',
  className,
  onImageClick,
  imageObjectFit = 'cover',
  videoMuted = true,
  videoLoop = true,
  videoPlaysInline = true,
  videoControls = true,
  onVideoPlay,
  onVideoPause,
  onVideoEnded,
  onVideoError,
  onImageError,
  textSelectable = false,
}: ResultRendererProps) {
  const safeImageUrl = getSafeRenderableMediaUrl(imageUrl);
  const safeVideoUrl = getSafeRenderableMediaUrl(videoUrl);

  if (mediaType === 'image' && safeImageUrl) {
    return (
      <div className={cn('relative w-full overflow-hidden rounded-lg bg-black/20', className)}>
        <img
          src={safeImageUrl}
          alt="生成结果"
          className={cn('w-full h-auto max-h-[320px] cursor-zoom-in', imageObjectFit === 'cover' ? 'object-cover' : 'object-contain')}
          draggable={false}
          onClick={onImageClick}
          onError={onImageError}
        />
      </div>
    );
  }

  if (mediaType === 'video' && safeVideoUrl) {
    return (
      <div className={cn('relative w-full overflow-hidden rounded-lg bg-black/30', className)}>
        <video
          src={safeVideoUrl}
          controls={videoControls}
          muted={videoMuted}
          loop={videoLoop}
          playsInline={videoPlaysInline}
          className="w-full max-h-[320px] object-contain"
          onPlay={onVideoPlay}
          onPause={onVideoPause}
          onEnded={onVideoEnded}
          onError={onVideoError}
        />
      </div>
    );
  }

  if (mediaType === 'audio' && audioUrl) {
    return (
      <div className={cn('w-full rounded-lg bg-black/20 p-3', className)}>
        <audio src={normalizeMediaUrl(audioUrl)} controls className="w-full" />
      </div>
    );
  }

  if (mediaType === 'text' && text?.trim()) {
    return (
      <div
        className={cn(
          'w-full rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 text-xs text-white/75 max-h-[200px] overflow-y-auto nowheel nodrag',
          textSelectable && 'select-text',
          className
        )}
      >
        {text}
      </div>
    );
  }

  if (mediaType === 'none') {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center min-h-[80px] rounded-lg border border-dashed border-white/10 text-[11px] text-white/30',
        className
      )}
    >
      {emptyLabel}
    </div>
  );
}

export default memo(ResultRenderer);
