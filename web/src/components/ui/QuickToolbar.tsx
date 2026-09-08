import React, { useState, useEffect } from 'react';
import { Plus, Trash2, RotateCcw, RotateCw, Copy, Eraser, Minus, Maximize2, Save, FolderOpen } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { cn } from '@/lib/utils';
import { confirm } from './ConfirmDialog';

interface QuickToolbarProps {
  className?: string;
}

const ZoomButtons: React.FC<{ onShowTooltip: (id: string | null) => void; showTooltip: string | null }> = ({ onShowTooltip, showTooltip }) => {
  const { zoomIn, zoomOut, fitView, zoomTo, getViewport } = useReactFlow();
  const viewport = getViewport();
  const zoomPercent = Math.round(viewport.zoom * 100);
  const isZoomed = Math.abs(viewport.zoom - 1) > 0.05;

  const zoomActions = [
    {
      id: 'zoom-in',
      icon: Plus,
      label: '放大',
      shortcut: '+',
      action: () => zoomIn({ duration: 150 }),
    },
    {
      id: 'zoom-out',
      icon: Minus,
      label: '缩小',
      shortcut: '-',
      action: () => zoomOut({ duration: 150 }),
    },
    {
      id: 'zoom-reset',
      icon: RotateCcw,
      label: '重置缩放',
      shortcut: `${zoomPercent}%`,
      action: () => zoomTo(1, { duration: 200 }),
      highlight: isZoomed,
    },
    {
      id: 'zoom-fit',
      icon: Maximize2,
      label: '适应视图',
      shortcut: 'Shift+1',
      action: () => fitView({ duration: 300, padding: 0.2 }),
    },
  ];

  return (
    <>
      <div className="h-4 w-px bg-white/10 mx-0.5" />
      {zoomActions.map((action) => {
        const Icon = action.icon;
        const isHighlight = (action as { highlight?: boolean }).highlight;
        return (
          <button
            key={action.id}
            className={cn(
              "p-1.5 rounded-full transition-all duration-200 relative group",
              isHighlight ? "bg-cyan-500/10 hover:bg-cyan-500/20" : "hover:bg-white/10"
            )}
            onClick={action.action}
            onMouseEnter={() => onShowTooltip(action.id)}
            onMouseLeave={() => onShowTooltip(null)}
          >
            <Icon className={cn("w-4 h-4", isHighlight ? "text-cyan-400" : "text-white")} />
            {showTooltip === action.id && (
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-[#2C2C2E]/95 border border-white/20 rounded-lg p-2 shadow-xl whitespace-nowrap">
                <div className="text-xs text-white font-medium">{action.label}</div>
                <div className="text-xs text-white/60">{action.shortcut}</div>
              </div>
            )}
          </button>
        );
      })}
    </>
  );
};

const QuickToolbar: React.FC<QuickToolbarProps> = ({ className }) => {
  const { 
    selectedNodeIds, 
    undo, 
    redo, 
    deleteSelectedNodes, 
    duplicateSelectedNodes, 
    resetCanvas,
    history 
  } = useCanvasStore();
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  // 常用操作
  const toolbarActions = [
    {
      id: 'undo',
      icon: RotateCcw,
      label: '撤销',
      shortcut: 'Ctrl+Z',
      action: () => undo(),
      disabled: () => history.past.length === 0
    },
    {
      id: 'redo',
      icon: RotateCw,
      label: '重做',
      shortcut: 'Ctrl+Y',
      action: () => redo(),
      disabled: () => history.future.length === 0
    },
    {
      id: 'add-node',
      icon: Plus,
      label: '添加节点',
      shortcut: 'Ctrl+Space',
      action: () => {
        window.dispatchEvent(new CustomEvent('open-search-panel'));
      }
    },
    {
      id: 'duplicate',
      icon: Copy,
      label: '复制',
      shortcut: 'Ctrl+C',
      action: () => duplicateSelectedNodes(),
      disabled: () => selectedNodeIds.length === 0
    },
    {
      id: 'delete',
      icon: Trash2,
      label: '删除',
      shortcut: 'Delete',
      action: () => deleteSelectedNodes(),
      disabled: () => selectedNodeIds.length === 0
    },
    {
      id: 'clear-canvas',
      icon: Eraser,
      label: '清空',
      shortcut: 'Ctrl+Shift+Del',
      action: async () => {
        const result = await confirm('确定清空画布吗？此操作不可撤销。', {
          title: '清空画布',
          confirmText: '清空',
          cancelText: '取消',
          variant: 'danger'
        });
        if (result) {
          resetCanvas();
        }
      },
      danger: true
    },
    {
      id: 'save-workflow',
      icon: Save,
      label: '保存',
      shortcut: 'Ctrl+S',
      action: () => {
        window.dispatchEvent(new CustomEvent('open-save-modal'));
      }
    },
    {
      id: 'load-workflow',
      icon: FolderOpen,
      label: '加载',
      shortcut: 'Ctrl+O',
      action: () => {
        window.dispatchEvent(new CustomEvent('open-load-modal'));
      }
    }
  ];

  // 键盘快捷键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 阻止在输入框中触发
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // 处理快捷键
      switch (true) {
        case e.key === 'n' && (e.ctrlKey || e.metaKey):
          e.preventDefault();
          toolbarActions.find(a => a.id === 'add-node')?.action();
          break;
        case e.key === 's' && (e.ctrlKey || e.metaKey):
          e.preventDefault();
          toolbarActions.find(a => a.id === 'save-workflow')?.action();
          break;
        case e.key === ' ' && e.target === document.body:
          e.preventDefault();
          toolbarActions.find(a => a.id === 'execute-workflow')?.action();
          break;
        case e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey:
          e.preventDefault();
          toolbarActions.find(a => a.id === 'undo')?.action();
          break;
        case (e.key === 'y' || (e.key === 'z' && e.shiftKey)) && (e.ctrlKey || e.metaKey):
          e.preventDefault();
          toolbarActions.find(a => a.id === 'redo')?.action();
          break;
        case e.key === 'Delete':
          e.preventDefault();
          toolbarActions.find(a => a.id === 'delete')?.action();
          break;
        case e.key === 'c' && (e.ctrlKey || e.metaKey):
          e.preventDefault();
          toolbarActions.find(a => a.id === 'duplicate')?.action();
          break;
        case e.key === ',' && (e.ctrlKey || e.metaKey):
          e.preventDefault();
          toolbarActions.find(a => a.id === 'settings')?.action();
          break;
        case e.key === 'F1':
          e.preventDefault();
          toolbarActions.find(a => a.id === 'help')?.action();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toolbarActions]);

  // 自动隐藏工具栏（可选）
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const handleMouseMove = () => {
      setIsVisible(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setIsVisible(false);
      }, 8000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div 
      className={cn(
        "fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none",
        className
      )}
    >
      <div className="flex items-center justify-center gap-1.5 p-1 h-9 bg-[#1C1C1E]/95 backdrop-blur-3xl border border-white/20 rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
        {toolbarActions.map((item) => (
          <div key={item.id} className="relative group">
            <button
              onClick={item.action}
              disabled={item.disabled?.()}
              onMouseEnter={() => setShowTooltip(item.id)}
              onMouseLeave={() => setShowTooltip(null)}
              className={cn(
                "flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-300 relative overflow-hidden",
                item.disabled?.()
                  ? "opacity-40 cursor-not-allowed text-white/30"
                  : item.danger
                    ? "text-white/80 hover:text-red-400 hover:bg-red-500/10 active:scale-90"
                    : "text-white/80 hover:text-white hover:bg-white/10 active:scale-90"
              )}
            >
              <item.icon className={cn("w-4 h-4 transition-transform duration-300", !item.disabled?.() && "group-hover:scale-110")} />
              
              {/* Active indicator for specific actions if needed */}
            </button>

            {/* Tooltip */}
            {showTooltip === item.id && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-1.5 bg-[#2C2C2E]/95 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="flex flex-col items-center gap-0.5 whitespace-nowrap">
                  <span className="text-xs font-bold text-white tracking-wide">{item.label}</span>
                  {item.shortcut && (
                    <span className="text-[10px] text-white/60 font-mono tracking-tighter">{item.shortcut}</span>
                  )}
                </div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#2C2C2E]/95" />
              </div>
            )}
          </div>
        ))}
        <ZoomButtons onShowTooltip={setShowTooltip} showTooltip={showTooltip} />
      </div>
    </div>
  );
};

export default QuickToolbar;