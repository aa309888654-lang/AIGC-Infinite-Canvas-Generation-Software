import { memo, useMemo } from 'react';
import { Play, Ungroup, Package, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  executeAICGGroup,
  aicgGroupService,
  type AICGNodeGroup,
} from '@/services/aicg-group-service';

interface AICGGroupToolbarProps {
  selectedNodeIds: string[];
  onSaveToToolbox: () => void;
  className?: string;
}

function AICGGroupToolbar({
  selectedNodeIds,
  onSaveToToolbox,
  className,
}: AICGGroupToolbarProps) {
  const groups = useMemo(
    () => aicgGroupService.getGroupsForSelection(selectedNodeIds),
    [selectedNodeIds],
  );

  if (selectedNodeIds.length < 2 && groups.length === 0) return null;

  const handleExecute = async (group: AICGNodeGroup) => {
    await executeAICGGroup(group.id);
  };

  return (
    <div
      className={cn(
        'fixed bottom-24 left-1/2 z-[9990] flex -translate-x-1/2 items-center gap-2 rounded-2xl',
        'border border-white/10 bg-[#0d0d0d] px-3 py-2 shadow-2xl backdrop-blur-xl',
        className,
      )}
    >
      <span className="px-2 text-[10px] font-medium text-white/50">
        AICG 编组 · {selectedNodeIds.length} 节点
      </span>

      {groups.map((g) => (
        <button
          key={g.id}
          type="button"
          onClick={() => void handleExecute(g)}
          className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/20"
          title="整组执行 (Ctrl+Shift+Enter)"
        >
          <Play className="h-3.5 w-3.5" />
          执行「{g.name}」
        </button>
      ))}

      <button
        type="button"
        onClick={() => aicgGroupService.ungroupSelection(selectedNodeIds)}
        className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] text-white/50 hover:bg-white/10 hover:text-white/80"
      >
        <Ungroup className="h-3.5 w-3.5" />
        解散
      </button>

      <button
        type="button"
        onClick={onSaveToToolbox}
        className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] text-white/50 hover:bg-white/10 hover:text-white/80"
      >
        <Save className="h-3.5 w-3.5" />
        存工具箱
      </button>

      <div className="flex items-center gap-1 text-[9px] text-white/25">
        <Package className="h-3 w-3" />
        Ctrl+G 打组
      </div>
    </div>
  );
}

export default memo(AICGGroupToolbar);
