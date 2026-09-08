import React, { useState, useEffect, useRef } from 'react';
import { X, GripVertical } from 'lucide-react';
import { useLayout } from '@/services/layout-manager';

interface FloatingPanelProps {
  panelId: string;
  title: string;
  children: React.ReactNode;
  defaultPosition?: { x: number; y: number };
  defaultSize?: { width: number; height: number };
}

const FloatingPanel: React.FC<FloatingPanelProps> = ({
  panelId,
  title,
  children,
  defaultPosition = { x: 100, y: 100 },
  defaultSize = { width: 400, height: 300 }
}) => {
  const { panels, setPanel, closePanel } = useLayout();
  const panelState = panels.get(panelId);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // 初始化面板状态
  useEffect(() => {
    if (!panelState) {
      setPanel(panelId, {
        isOpen: false,
        x: defaultPosition.x,
        y: defaultPosition.y,
        width: defaultSize.width,
        height: defaultSize.height
      });
    }
  }, [panelId, panelState, defaultPosition, defaultSize, setPanel]);

  // 处理拖拽
  const handleMouseDown = (e: React.MouseEvent) => {
    if (panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
      e.preventDefault();
    }
  };

  // 处理调整大小
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (panelState) {
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: panelState.width || defaultSize.width,
        height: panelState.height || defaultSize.height
      });
      setIsResizing(true);
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // 监听鼠标移动
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && panelState) {
        setPanel(panelId, {
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
      
      if (isResizing && panelState) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        
        setPanel(panelId, {
          width: Math.max(300, resizeStart.width + deltaX),
          height: Math.max(200, resizeStart.height + deltaY)
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragOffset, resizeStart, panelId, panelState, setPanel]);

  if (!panelState?.isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="fixed bg-[#1C1C1E] border border-white/10 rounded-lg shadow-xl z-50"
      style={{
        left: panelState.x || defaultPosition.x,
        top: panelState.y || defaultPosition.y,
        width: panelState.width || defaultSize.width,
        height: panelState.height || defaultSize.height
      }}
    >
      {/* 标题栏 */}
      <div 
        className="flex items-center justify-between px-4 py-2 bg-[#2C2C2E] border-b border-white/10 cursor-move"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-white" />
          <h3 className="text-sm font-medium text-white">{title}</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="p-1 hover:bg-white/10 rounded transition-colors"
            onClick={() => closePanel(panelId)}
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto p-4">
        {children}
      </div>

      {/* 调整大小手柄 */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
        onMouseDown={handleResizeMouseDown}
      >
        <div className="w-full h-full border-r-2 border-b-2 border-white/30"></div>
      </div>
    </div>
  );
};

export default FloatingPanel;