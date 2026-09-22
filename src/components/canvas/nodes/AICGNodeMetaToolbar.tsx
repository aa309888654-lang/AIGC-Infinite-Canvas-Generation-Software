import { memo, useCallback, type MouseEvent, type ReactNode } from 'react';
import { Download, RotateCcw, Maximize2, Minimize2, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { translateText } from '@/lib/app-i18n';
import { useLanguageStore } from '@/store/useLanguageStore';

export interface AICGNodeMetaToolbarProps {
  leading?: ReactNode;
  actions?: ReactNode;
  points?: number;
  loading?: boolean;
  disabled?: boolean;
  onGenerate?: () => void;
  onDownload?: () => void;
  onRetry?: () => void;
  onFullscreen?: () => void;
  isFullscreen?: boolean;
  hasResult?: boolean;
  className?: string;
}

function AICGNodeMetaToolbar({
  leading,
  actions,
  points,
  loading,
  disabled,
  onGenerate,
  onDownload,
  onRetry,
  onFullscreen,
  isFullscreen,
  hasResult,
  className,
}: AICGNodeMetaToolbarProps) {
  useLanguageStore((state) => state.language);
  const generateLabel = loading
    ? translateText('app.generating', '生成中...')
    : translateText('app.generate', '生成');
  const downloadLabel = translateText('app.download', '下载');
  const retryLabel = translateText('app.retry', '重试');
  const fullscreenLabel = translateText('app.fullscreen', '全屏查看');
  const exitFullscreenLabel = translateText('app.exit_fullscreen', '退出全屏');

  const handleDownload = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onDownload?.();
    },
    [onDownload],
  );

  const handleRetry = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onRetry?.();
    },
    [onRetry],
  );

  const handleFullscreen = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onFullscreen?.();
    },
    [onFullscreen],
  );

  return (
    <div
      className={cn(
        leading || actions || onGenerate
          ? 'flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-white/16 bg-[#101012] px-2 py-1.5'
          : 'flex items-center gap-0.5 rounded-lg border border-white/16 bg-[#101012] px-1 py-0.5',
        className,
      )}
    >
      {leading ? <div className="flex min-w-[260px] flex-1 flex-wrap items-center gap-1.5">{leading}</div> : null}
      {actions || onGenerate ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          {actions}
          {onGenerate ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onGenerate();
              }}
              disabled={disabled || loading}
              className="flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-xl border border-white/22 bg-white/[0.08] px-2.5 text-[10px] font-semibold text-white transition-colors hover:border-white/34 hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-white/35"
              title={generateLabel}
              aria-label={generateLabel}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {points != null ? <span className="tabular-nums">{points}</span> : null}
            </button>
          ) : null}
        </div>
      ) : null}
      {onDownload && hasResult && (
        <button
          type="button"
          onClick={handleDownload}
          className="flex h-7 w-7 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          title={downloadLabel}
          aria-label={downloadLabel}
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={handleRetry}
          className="flex h-7 w-7 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          title={retryLabel}
          aria-label={retryLabel}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      )}
      {onFullscreen && hasResult && (
        <button
          type="button"
          onClick={handleFullscreen}
          className="flex h-7 w-7 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          title={isFullscreen ? exitFullscreenLabel : fullscreenLabel}
          aria-label={isFullscreen ? exitFullscreenLabel : fullscreenLabel}
        >
          {isFullscreen ? (
            <Minimize2 className="h-3.5 w-3.5" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" />
          )}
        </button>
      )}
    </div>
  );
}

export default memo(AICGNodeMetaToolbar);
