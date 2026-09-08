import { memo, useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { getSafeRenderableMediaUrl } from '@/lib/media-url';

interface OutputMiniTimelineProps {
  videoUrl: string;
  className?: string;
}

/** 输出节点内迷你时间轴 — 入点/出点 + 预览（Sprint 3） */
function OutputMiniTimeline({ videoUrl, className }: OutputMiniTimelineProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [inPoint, setInPoint] = useState(0);
  const [outPoint, setOutPoint] = useState(0);
  const [current, setCurrent] = useState(0);

  const onLoaded = useCallback(() => {
    const d = videoRef.current?.duration || 0;
    setDuration(d);
    setOutPoint(d);
  }, []);

  const seek = (t: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = t;
      setCurrent(t);
    }
  };

  const setIn = () => {
    setInPoint(current);
    if (outPoint < current) setOutPoint(current);
  };

  const setOut = () => {
    setOutPoint(current);
    if (inPoint > current) setInPoint(current);
  };

  const safeVideoUrl = getSafeRenderableMediaUrl(videoUrl);
  if (!safeVideoUrl) return null;

  const pct = (t: number) => (duration > 0 ? (t / duration) * 100 : 0);

  return (
    <div className={cn('border-t border-white/[0.06] px-2.5 py-2 space-y-2', className)}>
      <video
        ref={videoRef}
        src={safeVideoUrl}
        className="hidden"
        onLoadedMetadata={onLoaded}
        onTimeUpdate={() => setCurrent(videoRef.current?.currentTime || 0)}
      />
      <div className="relative h-2 rounded-full bg-white/[0.06]">
        <div
          className="absolute top-0 h-full rounded-full bg-white/35"
          style={{ left: `${pct(inPoint)}%`, width: `${pct(outPoint - inPoint)}%` }}
        />
        <div className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 bg-white" style={{ left: `${pct(current)}%` }} />
      </div>
      <div className="flex items-center justify-between gap-1 text-[9px] text-white/45">
        <span>{current.toFixed(2)}s / {duration.toFixed(2)}s</span>
        <div className="flex gap-1">
          <button type="button" className="rounded px-1.5 py-0.5 hover:bg-white/10" onClick={setIn}>I 入点</button>
          <button type="button" className="rounded px-1.5 py-0.5 hover:bg-white/10" onClick={setOut}>O 出点</button>
          <button type="button" className="rounded px-1.5 py-0.5 hover:bg-white/10" onClick={() => seek(inPoint)}>↖</button>
          <button
            type="button"
            className="rounded px-1.5 py-0.5 hover:bg-white/10"
            onClick={() => {
              if (videoRef.current?.paused) void videoRef.current.play();
              else videoRef.current?.pause();
            }}
          >
            空格
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(OutputMiniTimeline);
