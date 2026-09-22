import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Settings, Clock } from 'lucide-react';
import { useLayout } from '@/services/layout-manager';
import { cn } from '@/lib/utils';

interface RightDockPanelProps {
  children: React.ReactNode;
}

const RightDockPanel: React.FC<RightDockPanelProps> = ({ children }) => {
  const { panels, togglePanel } = useLayout();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 获取右侧面板状态
  const rightPanels = [
    { id: 'propertyEditor', name: '属性编辑', icon: Settings },
    { id: 'taskQueue', name: '任务队列', icon: Clock }
  ];

  return (
    <div className={cn(
      "fixed right-0 top-0 h-full bg-[#1C1C1E] border-l border-white/10 transition-all duration-300 z-40",
      isCollapsed ? "w-12" : "w-80"
    )}>
      {/* 折叠按钮 */}
      <button
        className="absolute -left-3 top-1/2 transform -translate-y-1/2 w-6 h-12 bg-[#1C1C1E] border border-white/10 rounded-l-lg flex items-center justify-center"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {isCollapsed ? (
          <ChevronLeft className="w-4 h-4 text-white" />
        ) : (
          <ChevronRight className="w-4 h-4 text-white" />
        )}
      </button>

      {/* 面板内容 */}
      {!isCollapsed && (
        <div className="h-full flex flex-col">
          {/* 面板切换标签 */}
          <div className="flex border-b border-white/10">
            {rightPanels.map((panel) => {
              const Icon = panel.icon;
              const isActive = panels.get(panel.id)?.isOpen;
              
              return (
                <button
                  key={panel.id}
                  className={cn(
                    "flex-1 px-4 py-3 text-sm flex items-center justify-center gap-2 transition-colors",
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
        <div className="h-full flex flex-col items-center py-4 gap-4">
          {rightPanels.map((panel) => {
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

export default RightDockPanel;