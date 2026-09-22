import { useState, useCallback, useRef, useEffect, ReactNode } from 'react';

interface LayoutControllerProps {
  sidebar: ReactNode;
  mainContent: ReactNode;
}

const LayoutController = ({ sidebar, mainContent }: LayoutControllerProps) => {
  const [sidebarWidth, setSidebarWidth] = useState(256); // 默认256px
  
  const isDraggingLeft = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  // 左侧分隔条拖拽处理
  const handleLeftDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingLeft.current = true;
    startX.current = e.clientX;
    startWidth.current = sidebarWidth;
    document.body.style.cursor = 'col-resize';
  }, [sidebarWidth]);

  // 鼠标移动处理
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDraggingLeft.current) {
      const deltaX = e.clientX - startX.current;
      const newWidth = Math.max(200, Math.min(400, startWidth.current + deltaX));
      setSidebarWidth(newWidth);
    }
  }, []);

  // 鼠标释放处理
  const handleMouseUp = useCallback(() => {
    isDraggingLeft.current = false;
    document.body.style.cursor = 'default';
  }, []);

  // 添加全局事件监听
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div className="w-full h-full flex overflow-hidden relative">
      {/* 左侧边栏 */}
      <div
        style={{ width: `${sidebarWidth}px` }}
        className="bg-bg-node border-r border-border-gray overflow-hidden flex-shrink-0"
      >
        {sidebar}
      </div>

      {/* 左侧分隔条 */}
      <div
        className="absolute top-0 left-0 w-1 h-full bg-border-gray hover:bg-accent-cyan cursor-col-resize z-10 transition-colors"
        style={{ left: `${sidebarWidth - 1}px` }}
        onMouseDown={handleLeftDragStart}
      />

      {/* 中间画布 */}
      <div className="flex-1 relative overflow-hidden">
        {mainContent}
      </div>
    </div>
  );
};

export default LayoutController;