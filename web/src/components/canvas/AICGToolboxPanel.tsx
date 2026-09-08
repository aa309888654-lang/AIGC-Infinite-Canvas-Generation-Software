import { memo, useCallback, useEffect, useState } from 'react';
import { X, Plus, Trash2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { aicgToolboxService, type AICGToolboxItem } from '@/services/aicg-toolbox-service';
import { canvasStoreApi } from '@/store/useCanvasStore';
import AICGWorkflowTemplateList from './AICGWorkflowTemplateList';
import type { AICGWorkflowTemplate } from '@/services/aicg-workflow-service';
import { toast } from 'sonner';

interface AICGToolboxPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedNodeIds: string[];
  onInsertWorkflow?: (template: AICGWorkflowTemplate) => void;
}

function AICGToolboxPanel({ isOpen, onClose, selectedNodeIds, onInsertWorkflow }: AICGToolboxPanelProps) {
  const [items, setItems] = useState<AICGToolboxItem[]>([]);
  const [saveName, setSaveName] = useState('');

  const refresh = useCallback(() => {
    setItems(aicgToolboxService.list());
  }, []);

  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen, refresh]);

  const handleSave = () => {
    const name = saveName.trim() || `工具流 ${new Date().toLocaleDateString()}`;
    const nodes = canvasStoreApi.getNodes();
    const edges = canvasStoreApi.getEdges();
    const item = aicgToolboxService.saveFromSelection(name, nodes, edges, selectedNodeIds);
    if (item) {
      toast.success(`已保存到工具箱：${item.name}`);
      setSaveName('');
      refresh();
    } else {
      toast.error('请先选中至少 1 个节点');
    }
  };

  const handleInsert = (item: AICGToolboxItem) => {
    const vp = { x: 120, y: 120 };
    const { nodes, edges } = aicgToolboxService.instantiate(item, vp);
    for (const n of nodes) canvasStoreApi.addNode(n as never);
    for (const e of edges) canvasStoreApi.addEdge(e);
    toast.success(`已插入「${item.name}」(${nodes.length} 节点)`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed left-4 top-20 z-[9995] flex w-[320px] flex-col rounded-2xl border border-white/10 bg-[#0d0d0d] shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3.5">
        <div>
          <div className="flex items-center gap-1.5 text-base font-semibold text-white tracking-wide">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400"></span>
            小天工具箱
          </div>
          <div className="mt-0.5 text-xs text-white/45">预设模板 + 我的模板</div>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-white/[0.06] p-3 space-y-2">
        <input
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          placeholder="模板名称…"
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-violet-500/40 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={selectedNodeIds.length === 0}
          className={cn(
            'flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium',
            selectedNodeIds.length > 0
              ? 'bg-violet-500/20 text-violet-200 hover:bg-violet-500/30'
              : 'cursor-not-allowed bg-white/5 text-white/25',
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          保存为我的模板 ({selectedNodeIds.length})
        </button>
      </div>

      {onInsertWorkflow && (
        <div className="border-b border-white/[0.06] p-3 max-h-[200px] overflow-y-auto custom-scrollbar">
          <AICGWorkflowTemplateList
            compact
            onSelect={(tpl) => {
              onInsertWorkflow(tpl);
              onClose();
            }}
          />
        </div>
      )}

      <div className="max-h-[360px] flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
        {items.length === 0 && (
          <p className="py-8 text-center text-[11px] text-white/30">暂无模板 · 选中节点后保存</p>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            className="group flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 hover:border-white/15"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-white/85">{item.name}</div>
              <div className="text-[9px] text-white/35">{item.nodeCount} 节点</div>
            </div>
            <div className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100">
              <button
                type="button"
                onClick={() => handleInsert(item)}
                className="rounded-lg p-1.5 text-emerald-400 hover:bg-emerald-500/10"
                title="插入画布"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  aicgToolboxService.remove(item.id);
                  refresh();
                }}
                className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(AICGToolboxPanel);
