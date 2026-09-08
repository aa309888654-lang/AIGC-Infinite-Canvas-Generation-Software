import { memo, useCallback, useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { canvasTabService, type CanvasTabSnapshot } from '@/services/canvas-tab-service';

interface CanvasTabBarProps {
  onSwitch: (viewport: { x: number; y: number; zoom: number }) => void;
  getViewport: () => { x: number; y: number; zoom: number };
}

function CanvasTabBar({ onSwitch, getViewport }: CanvasTabBarProps) {
  const [tabs, setTabs] = useState<CanvasTabSnapshot[]>(() => canvasTabService.list());
  const [activeId, setActiveId] = useState(() => canvasTabService.activeId());

  const refresh = useCallback(() => {
    setTabs(canvasTabService.list());
    setActiveId(canvasTabService.activeId());
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      canvasTabService.saveCurrent(getViewport());
    }, 30_000);
    return () => clearInterval(id);
  }, [getViewport]);

  const handleSwitch = (tabId: string) => {
    canvasTabService.saveCurrent(getViewport());
    canvasTabService.switchTab(tabId, onSwitch);
    refresh();
  };

  const handleAdd = () => {
    canvasTabService.createTab();
    onSwitch({ x: 0, y: 0, zoom: 1 });
    refresh();
  };

  const handleClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    const nextId = canvasTabService.closeTab(tabId);
    if (nextId) {
      canvasTabService.switchTab(nextId, onSwitch);
    }
    refresh();
  };

  return (
    <div className="pointer-events-auto flex min-w-0 max-w-[min(44vw,520px)] items-center gap-1 overflow-x-auto rounded-xl border border-white/10 bg-[#0d0d0d] px-1.5 py-1 shadow-[0_10px_34px_rgba(0,0,0,0.28)] backdrop-blur-xl custom-scrollbar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => handleSwitch(tab.id)}
          className={cn(
            'group flex max-w-[140px] items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] transition-colors',
            activeId === tab.id ? 'bg-white/10 text-white' : 'text-white/45 hover:bg-white/[0.06] hover:text-white/75',
          )}
        >
          <span className="truncate">{tab.name}</span>
          {tabs.length > 1 && (
            <X
              className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100"
              onClick={(e) => handleClose(e, tab.id)}
            />
          )}
        </button>
      ))}
      <button
        type="button"
        onClick={handleAdd}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-white/40 hover:bg-white/10 hover:text-white"
        title="新建画布"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default memo(CanvasTabBar);
