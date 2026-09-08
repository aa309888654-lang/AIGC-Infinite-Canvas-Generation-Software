import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Terminal, Activity } from 'lucide-react';
import { useLayout } from '@/services/layout-manager';
import { cn } from '@/lib/utils';

interface BottomDockPanelProps {
  children: React.ReactNode;
}

const BottomDockPanel: React.FC<BottomDockPanelProps> = ({ children }) => {
  const { panels, togglePanel } = useLayout();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 获取底部面板状态
  const bottomPanels = [
    { id: 'logger', name: '日志', icon: Terminal },
    { id: 'statusMonitor', name: '状态监控', icon: Activity }
  ];

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 bg-[#1C1C1E] border-t border-white/10 transition-all duration-300 z-40",
      isCollapsed ? "h-12" : "h-48"
    )}>
      {/* 折叠按钮 */}
      <button
        className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-12 h-6 bg-[#1C1C1E] border border-white/10 rounded-t-lg flex items-center justify-center"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {isCollapsed ? (
          <ChevronUp className="w-4 h-4 text-white" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white" />
        )}
      </button>

      {/* 面板内容 */}
      {!isCollapsed && (
        <div className="h-full flex flex-col">
          {/* 面板切换标签 */}
          <div className="flex border-b border-white/10 px-4">
            {bottomPanels.map((panel) => {
              const Icon = panel.icon;
              const isActive = panels.get(panel.id)?.isOpen;
              
              return (
                <button
                  key={panel.id}
                  className={cn(
                    "px-4 py-2 text-sm flex items-center gap-2 transition-colors",
                    isActive 
                      ? "bg-white/5 text-white border-b-2 border-[#007AFF]" 
                      : "text-white hover:text-white hover:bg-white/5"
                  )}
                  onClick={() => togglePanel(panel.id)}
                >
                  <Icon className="w-4 h-4" />
                  <span>{panel.name}</span>
                </button>
              );
            })}
          </div>

          {/* 面板内容区域 */}
          <div className="flex-1 overflow-y-auto p-4">
            {children}
          </div>
        </div>
      )}

      {/* 折叠时显示图标 */}
      {isCollapsed && (
        <div className="h-full flex items-center justify-center gap-4">
          {bottomPanels.map((panel) => {
            const Icon = panel.icon;
            const isActive = panels.get(panel.id)?.isOpen;
            
            return (
              <button
                key={panel.id}
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                  isActive 
                    ? "bg-[#007AFF] text-white" 
                    : "text-white hover:text-white hover:bg-white/10"
                )}
                onClick={() => togglePanel(panel.id)}
                title={panel.name}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BottomDockPanel;