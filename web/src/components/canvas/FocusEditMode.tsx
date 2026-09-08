import React, { useState, useCallback, useRef } from 'react';
import { X, Crosshair, ArrowRight, Trash2, ZoomIn, Move} from 'lucide-react';

export interface FocusElement {
  id: string;
  name: string;
  type: 'image' | 'video' | 'text' | 'rect';
  bounds: { x: number; y: number; width: number; height: number };
  thumbnail?: string;
  color?: string;
}

interface FocusEditModeProps {
  onClose: () => void;
  onExtractElement: (element: FocusElement) => void;
}

const FocusEditMode: React.FC<FocusEditModeProps> = ({ onClose, onExtractElement }) => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);
  const [extractedElements, setExtractedElements] = useState<FocusElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [mode, setMode] = useState<'select' | 'pan'>('select');
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (mode !== 'select') return;
    setIsSelecting(true);
    setSelectionStart({ x: e.clientX, y: e.clientY });
    setSelectionEnd({ x: e.clientX, y: e.clientY });
  }, [mode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSelecting || mode !== 'select') return;
    setSelectionEnd({ x: e.clientX, y: e.clientY });
  }, [isSelecting, mode]);

  const handleMouseUp = useCallback(() => {
    if (!isSelecting || !selectionStart || !selectionEnd) return;
    setIsSelecting(false);

    const minX = Math.min(selectionStart.x, selectionEnd.x);
    const minY = Math.min(selectionStart.y, selectionEnd.y);
    const maxX = Math.max(selectionStart.x, selectionEnd.x);
    const maxY = Math.max(selectionStart.y, selectionEnd.y);

    const width = maxX - minX;
    const height = maxY - minY;

    if (width > 20 && height > 20) {
      const newElement: FocusElement = {
        id: `focus-${Date.now()}`,
        name: `焦点 ${extractedElements.length + 1}`,
        type: 'rect',
        bounds: { x: minX, y: minY, width, height },
        color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      };
      setExtractedElements(prev => [...prev, newElement]);
      setSelectedElementId(newElement.id);
    }

    setSelectionStart(null);
    setSelectionEnd(null);
  }, [isSelecting, selectionStart, selectionEnd, extractedElements.length]);

  const handleExtractElement = useCallback((element: FocusElement) => {
    onExtractElement(element);
    setExtractedElements(prev => prev.filter(e => e.id !== element.id));
  }, [onExtractElement]);

  const handleDeleteElement = useCallback((elementId: string) => {
    setExtractedElements(prev => prev.filter(e => e.id !== elementId));
    if (selectedElementId === elementId) {
      setSelectedElementId(null);
    }
  }, [selectedElementId]);

  const getSelectionRect = () => {
    if (!selectionStart || !selectionEnd) return null;
    return {
      left: Math.min(selectionStart.x, selectionEnd.x),
      top: Math.min(selectionStart.y, selectionEnd.y),
      width: Math.abs(selectionEnd.x - selectionStart.x),
      height: Math.abs(selectionEnd.y - selectionStart.y),
    };
  };

  const selectionRect = getSelectionRect();

  return (
    <div className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-sm">
      {/* 顶部工具栏 */}
      <div className="absolute top-0 left-0 right-0 h-14 bg-[#1a1a1a] border-b border-white/10 flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Crosshair className="w-5 h-5 text-gray-400" />
            <span className="text-white font-medium">焦点编辑模式</span>
            <span className="text-white/40 text-sm">({extractedElements.length} 个焦点)</span>
          </div>

          <div className="h-6 w-px bg-white/10" />

          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setMode('select')}
              className={`p-2 rounded-lg transition-colors ${mode === 'select' ? 'bg-gray-500/30 text-gray-400' : 'text-white/60 hover:text-white'}`}
              title="选择模式"
            >
              <Crosshair className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMode('pan')}
              className={`p-2 rounded-lg transition-colors ${mode === 'pan' ? 'bg-gray-500/30 text-gray-400' : 'text-white/60 hover:text-white'}`}
              title="平移模式"
            >
              <Move className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-white/40 text-sm">
            {mode === 'select' ? '拖拽选择画面区域' : '拖拽平移视图'}
          </span>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            退出
          </button>
        </div>
      </div>

      {/* 左侧面板 - 已提取的焦点 */}
      <div className="absolute left-4 top-20 bottom-20 w-64 bg-[#1a1a1a] rounded-xl border border-white/10 overflow-hidden">
        <div className="p-3 border-b border-white/5">
          <h3 className="text-sm font-medium text-white">已提取的焦点</h3>
        </div>
        <div className="p-2 space-y-2 overflow-y-auto h-[calc(100%-44px)]">
          {extractedElements.length === 0 ? (
            <div className="text-center text-white/40 py-8 text-sm">
              <Crosshair className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>在画布上拖拽选择区域</p>
              <p>提取画面焦点</p>
            </div>
          ) : (
            extractedElements.map(element => (
              <div
                key={element.id}
                onClick={() => setSelectedElementId(element.id)}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  selectedElementId === element.id
                    ? 'border-gray-500 bg-gray-500/10'
                    : 'border-white/5 bg-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white font-medium">{element.name}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExtractElement(element);
                      }}
                      className="p-1 rounded hover:bg-white/10 text-gray-400"
                      title="传递给下游节点"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteElement(element.id);
                      }}
                      className="p-1 rounded hover:bg-red-500/20 text-red-400/60"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <span className="capitalize">{element.type}</span>
                  <span>•</span>
                  <span>{Math.round(element.bounds.width)}×{Math.round(element.bounds.height)}</span>
                </div>
                {element.color && (
                  <div
                    className="mt-2 h-2 rounded-full"
                    style={{ backgroundColor: element.color }}
                  />
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 底部操作栏 */}
      {selectedElementId && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#1a1a1a] rounded-xl border border-white/10 px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => {
              const element = extractedElements.find(e => e.id === selectedElementId);
              if (element) handleExtractElement(element);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-600 to-cyan-600 hover:from-gray-500 hover:to-cyan-500 rounded-lg text-sm font-medium text-white transition-all"
          >
            <ArrowRight className="w-4 h-4" />
            传递给下游节点
          </button>
          <button
            onClick={() => handleDeleteElement(selectedElementId)}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-red-500/20 rounded-lg text-sm text-red-400 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            删除
          </button>
        </div>
      )}

      {/* 画布交互区域 */}
      <div
        ref={canvasRef}
        className={`absolute inset-0 top-14 ${mode === 'select' ? 'cursor-crosshair' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (isSelecting) {
            setIsSelecting(false);
            setSelectionStart(null);
            setSelectionEnd(null);
          }
        }}
      >
        {/* 选择框 */}
        {selectionRect && (
          <div
            className="absolute border-2 border-gray-500 bg-gray-500/20 pointer-events-none"
            style={{
              left: selectionRect.left,
              top: selectionRect.top,
              width: selectionRect.width,
              height: selectionRect.height,
            }}
          />
        )}

        {/* 已提取元素的标记 */}
        {extractedElements.map(element => (
          <div
            key={element.id}
            className={`absolute border-2 pointer-events-none transition-all ${
              selectedElementId === element.id
                ? 'border-gray-500 shadow-lg shadow-gray-500/50'
                : 'border-dashed border-yellow-400/60'
            }`}
            style={{
              left: element.bounds.x,
              top: element.bounds.y + 56,
              width: element.bounds.width,
              height: element.bounds.height,
              backgroundColor: element.color ? `${element.color}20` : 'transparent',
            }}
          />
        ))}
      </div>

      {/* 提示覆盖层 */}
      {extractedElements.length === 0 && !isSelecting && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-center pointer-events-none">
          <div className="bg-[#1a1a1a] rounded-xl border border-white/10 px-6 py-4">
            <ZoomIn className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-white font-medium">拖拽选择画面区域</p>
            <p className="text-white/60 text-sm mt-1">点击并拖动以提取焦点元素</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FocusEditMode;
