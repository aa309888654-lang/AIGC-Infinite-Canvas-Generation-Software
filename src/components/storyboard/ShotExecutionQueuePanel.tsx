import { memo, useMemo } from 'react';
import { AlertCircle, CheckCircle2, Circle, Loader2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useShotExecutionStore, type ShotExecutionItemStatus } from '@/store/useShotExecutionStore';

const STATUS_LABELS: Record<ShotExecutionItemStatus, string> = {
  queued: '等待',
  running: '执行中',
  done: '完成',
  failed: '失败',
  skipped: '跳过',
};

function StatusIcon({ status }: { status: ShotExecutionItemStatus }) {
  if (status === 'running') return <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-200" />;
  if (status === 'done') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-200" />;
  if (status === 'failed') return <AlertCircle className="h-3.5 w-3.5 text-red-200" />;
  return <Circle className="h-3.5 w-3.5 text-white/25" />;
}

function ShotExecutionQueuePanel() {
  const { status, items, resetQueue } = useShotExecutionStore();

  const summary = useMemo(() => {
    const completed = items.filter((item) => item.status === 'done' || item.status === 'failed' || item.status === 'skipped').length;
    const failed = items.filter((item) => item.status === 'failed').length;
    const total = items.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, failed, total, percent };
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div className="mt-2 rounded-xl border border-white/[0.07] bg-black/25 p-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold text-white/78">
            执行队列 · {summary.completed}/{summary.total}
          </p>
          <p className="text-[9px] text-white/35">
            {status === 'running' ? '正在顺序执行镜头节点' : summary.failed > 0 ? `${summary.failed} 个失败` : '队列已完成'}
          </p>
        </div>
        <button
          type="button"
          onClick={resetQueue}
          className="rounded-lg bg-white/[0.06] p-1.5 text-white/45 hover:bg-white/[0.1] hover:text-white/80"
          aria-label="重置执行队列"
          title="重置执行队列"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            status === 'failed' ? 'bg-red-300/75' : 'bg-emerald-300/75'
          )}
          style={{ width: `${summary.percent}%` }}
        />
      </div>

      <div className="mt-2 max-h-24 space-y-1 overflow-y-auto pr-1 custom-scrollbar">
        {items.map((item) => (
          <div key={item.shotId} className="flex items-center gap-1.5 rounded-lg bg-white/[0.035] px-2 py-1">
            <StatusIcon status={item.status} />
            <span className="min-w-0 flex-1 truncate text-[10px] text-white/62">
              {String(item.index).padStart(2, '0')} · {item.title}
            </span>
            <span
              className={cn(
                'shrink-0 text-[9px]',
                item.status === 'failed' ? 'text-red-200' : item.status === 'done' ? 'text-emerald-200' : 'text-white/35'
              )}
            >
              {STATUS_LABELS[item.status]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(ShotExecutionQueuePanel);
