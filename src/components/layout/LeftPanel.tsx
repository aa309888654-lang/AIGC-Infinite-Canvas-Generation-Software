import { useState, useRef, useCallback, useEffect } from 'react';
import EnhancedNodePalette from '../canvas/EnhancedNodePalette';
import { NodeTypeDefinition } from '@/types/node-system';
import { EnhancedNodeTemplate } from '@/types/enhanced-node-library';
import { GripVertical } from 'lucide-react';

interface LeftPanelProps {
  onAddNode: (nodeType: NodeTypeDefinition) => void;
  onAddTemplate?: (template: EnhancedNodeTemplate) => void;
  isVisible?: boolean;
}

const LeftPanel: React.FC<LeftPanelProps> = ({ onAddNode, onAddTemplate, isVisible = true }) => {
  const [panelWidth, setPanelWidth] = useState(180);
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = panelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [panelWidth]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const deltaX = e.clientX - startXRef.current;
      const newWidth = Math.max(140, Math.min(300, startWidthRef.current + deltaX));
      setPanelWidth(newWidth);
    }
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
    }
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  if (!isVisible) return null;

  return (
    <>
      {/* 左侧面板内容 */}
      <div
        className="h-full bg-[#1A1A1D] border-r border-[#2D2D2D] flex-shrink-0 flex flex-col"
        style={{ width: `${panelWidth}px` }}
      >
        <EnhancedNodePalette onAddNode={onAddNode} onAddTemplate={onAddTemplate} width={panelWidth} />
      </div>

      {/* 可拖拽的分隔条 */}
      <div
        className="w-1 bg-[#2D2D2D] hover:bg-[#007AFF] cursor-col-resize flex-shrink-0 transition-colors flex items-center justify-center"
        onMouseDown={handleResizeStart}
        style={{
          opacity: isResizing ? 1 : undefined,
          backgroundColor: isResizing ? '#007AFF' : undefined
        }}
      >
        <GripVertical className="w-3 h-3 text-white" />
      </div>
    </>
  );
};

export default LeftPanel;
