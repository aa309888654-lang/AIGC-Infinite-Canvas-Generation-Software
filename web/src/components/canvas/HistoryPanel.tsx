/**
 * 历史记录小窗口
 *
 * 显示画布上最近添加的节点列表，支持：
 *  - 点击节点跳转到对应位置并选中
 *  - 按 ESC 或点击空白处关闭
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { X, Clock, Trash2, Layers } from 'lucide-react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useReactFlow } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { resolveNodeDefinition } from '@/core/node-registry';
import { toast } from 'sonner';
import { canvasProjectService } from '@/services/canvas-project-service';

export interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ isOpen, onClose }) => {
  const nodes = useCanvasStore((s) => s.nodes);
  const setSelectedNodeIds = useCanvasStore((s) => s.setSelectedNodeIds);
  const resetCanvas = useCanvasStore((s) => s.resetCanvas);
  const panelRef = useRef<HTMLDivElement>(null);
  const { setCenter, getNode } = useReactFlow();

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const recentNodes = useMemo(() => {
    const list = nodes
      .map((n) => {
        const def = resolveNodeDefinition(n.type);
        return {
          id: n.id,
          type: n.type,
          name: def?.name ?? n.type,
          icon: def?.icon ?? '📦',
          color: def?.color ?? '#666',
          position: n.position,
        };
      })
      .reverse();
    return list.slice(0, 50);
  }, [nodes]);

  if (!isOpen) return null;

  const handleJumpTo = (nodeId: string) => {
    const n = getNode(nodeId);
    if (!n) return;
    setCenter(n.position.x + 200, n.position.y + 100, { zoom: 1, duration: 400 });
    setSelectedNodeIds([nodeId]);
    onClose();
  };

  const handleClear = () => {
    if (recentNodes.length === 0) return;
    toast('清空会移除画布上所有节点，是否继续？', {
      action: {
        label: '清空',
        onClick: () => {
          resetCanvas();
          canvasProjectService.saveNow();
          toast.success('已清空画布');
          onClose();
        },
      },
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />
      <div
        ref={panelRef}
        className={cn(
          'fixed z-[9999] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          'w-[420px] max-h-[520px] overflow-hidden rounded-2xl border border-white/10',
          'bg-[#0d0d0d] shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl',
          'animate-in fade-in zoom-in-95 duration-150',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
          <Clock className="h-4 w-4 text-white/55" />
          <span className="text-[12px] font-semibold text-white/90">历史记录</span>
          <span className="text-[10px] text-white/40">（最近 {recentNodes.length} 个节点）</span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleClear}
            disabled={recentNodes.length === 0}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md text-white/55',
              'hover:bg-white/[0.07] hover:text-rose-300 transition-colors',
              'disabled:opacity-30 disabled:cursor-not-allowed',
            )}
            title="清空画布"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/55 hover:bg-white/[0.07] hover:text-white transition-colors"
            title="关闭"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {recentNodes.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Layers className="h-8 w-8 mx-auto mb-3 text-white/15" />
            <p className="text-[12px] text-white/40">画布上还没有节点</p>
            <p className="text-[10px] text-white/25 mt-1">点击左侧「+」添加节点后会显示在这里</p>
          </div>
        ) : (
          <div className="max-h-[440px] overflow-y-auto custom-scrollbar">
            {recentNodes.map((n, idx) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleJumpTo(n.id)}
                className={cn(
                  'nodrag flex w-full items-center gap-3 px-4 py-2 text-left',
                  'border-b border-white/[0.04] transition-colors',
                  'hover:bg-white/[0.06]',
                )}
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[14px] shrink-0"
                  style={{ background: `${n.color}22`, color: n.color }}
                >
                  {n.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-white truncate">{n.name}</div>
                  <div className="text-[10px] text-white/30 truncate">id: {n.id.slice(0, 8)}…</div>
                </div>
                <span className="text-[10px] text-white/25 shrink-0">
                  #{recentNodes.length - idx}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default HistoryPanel;
