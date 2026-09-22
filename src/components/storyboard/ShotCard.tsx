import { memo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Film, Play, Trash2, Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Shot, ShotStatus } from '@/types/shot-system';
import type { GenerationMediaType } from '@/types/generation-version';
import ShotVersionStrip from './ShotVersionStrip';

const STATUS_LABELS: Record<ShotStatus, string> = {
  draft: '草稿',
  planned: '已拆镜',
  nodes_created: '已建节点',
  image_ready: '图片完成',
  image_generating: '出图中',
  video_generating: '视频中',
  video_ready: '视频完成',
  selected: '已选定',
  failed: '失败',
};

const STATUS_CLASS: Record<ShotStatus, string> = {
  draft: 'border-white/10 bg-white/5 text-white/45',
  planned: 'border-cyan-400/20 bg-cyan-500/10 text-cyan-200',
  nodes_created: 'border-violet-400/20 bg-violet-500/10 text-violet-200',
  image_ready: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
  image_generating: 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100',
  video_generating: 'border-sky-300/30 bg-sky-500/10 text-sky-100',
  video_ready: 'border-sky-400/20 bg-sky-500/10 text-sky-200',
  selected: 'border-amber-400/25 bg-amber-500/10 text-amber-200',
  failed: 'border-red-400/25 bg-red-500/10 text-red-200',
};

interface ShotCardProps {
  shot: Shot;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<Shot>) => void;
  onDelete: () => void;
  onCreateNodes: () => void;
  onExecute?: () => void;
  executionDisabled?: boolean;
  onFocusNodes?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onSelectVersion: (mediaType: Extract<GenerationMediaType, 'image' | 'video'>, versionId: string) => void;
}

function ShotCard({
  shot,
  selected,
  onSelect,
  onUpdate,
  onDelete,
  onCreateNodes,
  onExecute,
  executionDisabled = false,
  onFocusNodes,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  onSelectVersion,
}: ShotCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isGenerating = shot.status === 'image_generating' || shot.status === 'video_generating';
  const hasRunnableNodes = Boolean(shot.nodeLinks?.imageNodeId || shot.nodeLinks?.videoNodeId);

  return (
    <article
      className={cn(
        'rounded-xl border bg-white/[0.025] transition-colors',
        selected ? 'border-violet-400/40 bg-violet-500/[0.07]' : 'border-white/[0.08] hover:border-white/15',
      )}
    >
      <div
        onClick={onSelect}
        className="flex w-full cursor-pointer items-start gap-2.5 px-3 py-2.5 text-left"
      >
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-[11px] font-semibold text-white/70">
          {shot.index}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[12px] font-semibold text-white/90">{shot.title}</span>
            <span className={cn('shrink-0 rounded-full border px-1.5 py-0.5 text-[8px]', STATUS_CLASS[shot.status])}>
              {STATUS_LABELS[shot.status]}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-white/48">{shot.scriptText}</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp?.();
            }}
            disabled={!canMoveUp}
            className="rounded-md p-1 text-white/28 hover:bg-white/10 hover:text-white/75 disabled:cursor-not-allowed disabled:text-white/12"
            aria-label="上移镜头"
            title="上移镜头"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown?.();
            }}
            disabled={!canMoveDown}
            className="rounded-md p-1 text-white/28 hover:bg-white/10 hover:text-white/75 disabled:cursor-not-allowed disabled:text-white/12"
            aria-label="下移镜头"
            title="下移镜头"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((value) => !value);
          }}
          className="rounded-md p-1 text-white/35 hover:bg-white/10 hover:text-white/80"
          aria-label={expanded ? '收起镜头' : '展开镜头'}
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="space-y-2 border-t border-white/[0.06] px-3 py-2.5">
          <ShotVersionStrip shot={shot} onSelectVersion={onSelectVersion} />

          <label className="block">
            <span className="text-[9px] uppercase tracking-wider text-white/35">画面提示词</span>
            <textarea
              value={shot.visualPrompt}
              onChange={(event) => onUpdate({ visualPrompt: event.target.value })}
              className="mt-1 h-20 w-full resize-none rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] leading-4 text-white/80 outline-none focus:border-violet-400/40"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="text-[9px] uppercase tracking-wider text-white/35">时长</span>
              <input
                type="number"
                min={1}
                max={30}
                value={shot.duration}
                onChange={(event) => onUpdate({ duration: Number(event.target.value) || 4 })}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] text-white/80 outline-none focus:border-violet-400/40"
              />
            </label>
            <label>
              <span className="text-[9px] uppercase tracking-wider text-white/35">比例</span>
              <select
                value={shot.aspectRatio}
                onChange={(event) => onUpdate({ aspectRatio: event.target.value })}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] text-white/80 outline-none focus:border-violet-400/40"
              >
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
                <option value="1:1">1:1</option>
                <option value="4:3">4:3</option>
              </select>
            </label>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onCreateNodes}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-violet-500/18 px-2 py-1.5 text-[10px] font-medium text-violet-100 hover:bg-violet-500/28"
            >
              <Workflow className="h-3.5 w-3.5" />
              创建节点组
            </button>
            {hasRunnableNodes && (
              <button
                type="button"
                onClick={onExecute}
                disabled={isGenerating || executionDisabled || !onExecute}
                className="rounded-lg bg-emerald-500/14 px-2 py-1.5 text-[10px] text-emerald-100 hover:bg-emerald-500/24 disabled:cursor-not-allowed disabled:bg-white/[0.04] disabled:text-white/28"
                aria-label="执行镜头"
                title="执行镜头"
              >
                <Play className="h-3.5 w-3.5" />
              </button>
            )}
            {shot.nodeLinks && (
              <button
                type="button"
                onClick={onFocusNodes}
                className="rounded-lg bg-white/[0.06] px-2 py-1.5 text-[10px] text-white/65 hover:bg-white/[0.1] hover:text-white"
              >
                <Film className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg bg-red-500/10 px-2 py-1.5 text-red-300 hover:bg-red-500/18"
              aria-label="删除镜头"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export default memo(ShotCard);
