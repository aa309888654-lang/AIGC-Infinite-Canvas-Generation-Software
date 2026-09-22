import { memo } from 'react';
import { cn } from '@/lib/utils';
import { AICG_WORKFLOW_TEMPLATES } from '@/services/aicg-workflow-service';
import type { AICGWorkflowTemplate } from '@/services/aicg-workflow-service';

interface AICGWorkflowTemplateListProps {
  onSelect: (template: AICGWorkflowTemplate) => void;
  compact?: boolean;
  className?: string;
}

const CATEGORY_LABEL: Record<AICGWorkflowTemplate['category'], string> = {
  script: '剧本',
  image: '图像',
  video: '视频',
  tool: '工具',
  commerce: '商品',
  character: '角色',
  music: '音乐',
  space: '空间',
};

const TONE_CLASS: Record<NonNullable<AICGWorkflowTemplate['coverTone']>, string> = {
  cyan: 'from-cyan-500/25 to-sky-500/10 border-cyan-300/20',
  violet: 'from-violet-500/25 to-fuchsia-500/10 border-violet-300/20',
  amber: 'from-amber-500/25 to-orange-500/10 border-amber-300/20',
  emerald: 'from-emerald-500/25 to-teal-500/10 border-emerald-300/20',
  rose: 'from-rose-500/25 to-pink-500/10 border-rose-300/20',
  blue: 'from-blue-500/25 to-cyan-500/10 border-blue-300/20',
};

function AICGWorkflowTemplateList({
  onSelect,
  compact = false,
  className,
}: AICGWorkflowTemplateListProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {!compact && (
        <div className="px-1 text-[9px] font-semibold uppercase tracking-wider text-white/35">
          AICG 工作流模板
        </div>
      )}
      <div className={cn('grid gap-1.5', compact ? 'grid-cols-1' : 'grid-cols-1')}>
        {AICG_WORKFLOW_TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => onSelect(tpl)}
            className={cn(
              'group overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.025] text-left transition-colors hover:border-violet-500/30 hover:bg-violet-500/10',
              compact ? 'p-2.5' : 'p-3',
            )}
          >
            <div
              className={cn(
                'mb-2 rounded-lg border bg-gradient-to-br px-2.5 py-2',
                TONE_CLASS[tpl.coverTone || 'violet'],
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-semibold text-white/92">{tpl.name}</span>
                <span className="shrink-0 rounded bg-black/20 px-1.5 py-0.5 text-[8px] text-white/60">
                  {CATEGORY_LABEL[tpl.category]}
                </span>
              </div>
              <div className="mt-1 text-[9px] text-white/46">{tpl.scene || '创作模板'}</div>
            </div>
            <span className="text-[9px] text-white/42 line-clamp-2">{tpl.description}</span>
            {tpl.tags?.length ? (
              <span className="mt-1.5 flex flex-wrap gap-1">
                {tpl.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[8px] text-white/35">
                    {tag}
                  </span>
                ))}
              </span>
            ) : null}
            <span className="mt-1.5 flex items-center justify-between text-[8px] text-white/25">
              <span>{tpl.steps.length} 节点 · {tpl.links.length} 连线</span>
              <span className="rounded bg-white/[0.08] px-2 py-0.5 text-[8px] text-white/45 group-hover:bg-violet-400/20 group-hover:text-violet-100">
                使用
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default memo(AICGWorkflowTemplateList);
