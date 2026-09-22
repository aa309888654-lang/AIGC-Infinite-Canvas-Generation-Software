/**
 * 右侧属性面板
 * 用于显示和编辑选中节点的属性
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { GripVertical, Settings, ChevronDown, ChevronRight } from 'lucide-react';

const RightPanel: React.FC = () => {
  const [panelWidth, setPanelWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const { nodes, selectedNodeIds, updateNodeData, setNodes } = useCanvasStore();
  const selectedNode = selectedNodeIds.length === 1
    ? nodes.find(n => n.id === selectedNodeIds[0])
    : null;

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
      const deltaX = startXRef.current - e.clientX;
      const newWidth = Math.max(280, Math.min(500, startWidthRef.current + deltaX));
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

  const updateNodePosition = useCallback((nodeId: string, position: { x: number; y: number }) => {
    setNodes(nodes.map(node => 
      node.id === nodeId 
        ? { ...node, position }
        : node
    ));
  }, [nodes, setNodes]);

  const renderPropertyEditor = () => {
    if (!selectedNode) {
      return (
        <div className="flex h-full flex-col items-center justify-center p-8 text-white">
          <Settings className="mb-4 h-12 w-12 opacity-50" />
          <p className="text-center text-sm text-white/70">选择一个节点以编辑其属性</p>
        </div>
      );
    }

    const nodeType = selectedNode.type;
    const nodeData = selectedNode.data || {};

    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                {String(nodeData.label || nodeType || '节点')}
              </h3>
              <p className="text-xs text-white/55">ID: {selectedNode.id.slice(0, 8)}...</p>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-auto p-4">
          <PropertySection title="基础属性" defaultExpanded>
            <div className="space-y-3">
              <PropertyField
                label="名称"
                value={String(nodeData.label || '')}
                onChange={(value) => updateNodeData(selectedNode.id, { label: value })}
              />
              <PropertyField
                label="类型"
                value={String(nodeType || 'unknown')}
                disabled
              />
            </div>
          </PropertySection>

          <PropertySection title="位置与大小" defaultExpanded>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <PropertyField
                  label="X"
                  type="number"
                  value={selectedNode.position?.x || 0}
                  onChange={(value) => {
                    updateNodePosition(selectedNode.id, {
                      x: Number(value),
                      y: selectedNode.position?.y || 0,
                    });
                  }}
                />
                <PropertyField
                  label="Y"
                  type="number"
                  value={selectedNode.position?.y || 0}
                  onChange={(value) => {
                    updateNodePosition(selectedNode.id, {
                      x: selectedNode.position?.x || 0,
                      y: Number(value),
                    });
                  }}
                />
              </div>
            </div>
          </PropertySection>

          {nodeData.params && typeof nodeData.params === 'object' && (
            <PropertySection title="参数设置" defaultExpanded>
              <div className="space-y-3">
                {Object.entries(nodeData.params as Record<string, unknown>).map(([key, value]) => (
                  <PropertyField
                    key={key}
                    label={key}
                    value={String(value)}
                    onChange={(newValue) => {
                      updateNodeData(selectedNode.id, {
                        params: { ...(nodeData.params as Record<string, unknown>), [key]: newValue },
                      });
                    }}
                  />
                ))}
              </div>
            </PropertySection>
          )}

          {nodeData.prompt !== undefined && (
            <PropertySection title="提示词" defaultExpanded>
              <PropertyField
                label="提示词"
                type="textarea"
                value={String(nodeData.prompt || '')}
                onChange={(value) => updateNodeData(selectedNode.id, { prompt: value })}
              />
              {nodeData.negativePrompt !== undefined && (
                <PropertyField
                  label="负面提示词"
                  type="textarea"
                  value={String(nodeData.negativePrompt || '')}
                  onChange={(value) => updateNodeData(selectedNode.id, { negativePrompt: value })}
                />
              )}
            </PropertySection>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div
        className="flex w-1 shrink-0 cursor-col-resize items-center justify-center bg-[#2D2D2D] transition-colors hover:bg-white/30"
        onMouseDown={handleResizeStart}
        style={{
          opacity: isResizing ? 1 : undefined,
          backgroundColor: isResizing ? '#555' : undefined
        }}
      >
        <GripVertical className="h-3 w-3 text-white" />
      </div>

      <div
        className="flex h-full flex-shrink-0 flex-col border-l border-[#2D2D2D] bg-black"
        style={{ width: `${panelWidth}px` }}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">属性</h2>
        </div>

        {renderPropertyEditor()}
      </div>
    </>
  );
};

interface PropertySectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

const PropertySection: React.FC<PropertySectionProps> = ({
  title,
  children,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="overflow-hidden rounded-lg border border-white/10">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between bg-[#2D2D2D] px-3 py-2 transition-colors hover:bg-[#3D3D3D]"
      >
        <span className="text-xs font-medium text-white">{title}</span>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-white" />
        ) : (
          <ChevronRight className="h-4 w-4 text-white" />
        )}
      </button>
      {isExpanded && (
        <div className="bg-[#1A1A1D] p-3">
          {children}
        </div>
      )}
    </div>
  );
};

interface PropertyFieldProps {
  label: string;
  value: string | number;
  onChange?: (value: string) => void;
  type?: 'text' | 'number' | 'textarea';
  disabled?: boolean;
}

const PropertyField: React.FC<PropertyFieldProps> = ({
  label,
  value,
  onChange,
  type = 'text',
  disabled = false,
}) => {
  return (
    <div className="space-y-1">
      <label className="text-xs text-white">{label}</label>
      {type === 'textarea' ? (
        <textarea
          value={String(value)}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          className="w-full rounded border border-white/10 bg-black px-2 py-1 text-sm text-white outline-none"
        />
      ) : (
        <input
          type={type}
          value={String(value)}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          className="w-full rounded border border-white/10 bg-black px-2 py-1 text-sm text-white outline-none"
        />
      )}
    </div>
  );
};

export default RightPanel;
