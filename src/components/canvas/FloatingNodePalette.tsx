import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { NodeCategory, NodeTypeDefinition } from '@/types/node-system';
import { getActiveRegistryDefinitions } from '@/core/node-registry';
import { enhancedNodeLibraryService } from '@/services/enhanced-node-library-service';
import { SafeStyle } from '@/components/ui/SafeStyle';
import {
  Minimize2,
  Sparkles,
  Image as ImageIcon,
  Video as VideoIcon,
  Music,
  MessageSquare,
  Download as DownloadIcon,
  Box,
  Upload,
  Type,
  Clapperboard,
  Scissors,
  AudioLines,
  FolderOpen,
  Grid3X3,
  Layers,
  Package,
  UserRound,
  Wand2,
  Copy,
  UserCheck,
  Layers3,
  Aperture,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { type AICGTaskIcon } from '@/config/aicg-node-catalog';

export interface FloatingNodePaletteProps {
  onAddNode: (nodeType: NodeTypeDefinition) => void;
  onAddTemplate?: (template: unknown) => void;
  position?: 'left' | 'right';
  isOpen?: boolean;
  onClose?: () => void;
  onOpenToolbox?: () => void;
  onOpenAssets?: () => void;
}

const nodeIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  aiImage: ImageIcon,
  aiVideo: Clapperboard,
  videoGen: VideoIcon,
  aicgVideoGen: Clapperboard,
  gridDirector: Clapperboard,
  scriptStoryboard: Clapperboard,
  storyboardMaker: Clapperboard,
  prompt: MessageSquare,
  imageInput: Upload,
  videoInput: VideoIcon,
  frameExtractor: Grid3X3,
  aiGenText: Type,
  adCopyText: MessageSquare,
  brandCopyText: Type,
  storyboardEdit: Clapperboard,
  audioGen: Music,
  output: DownloadIcon,
  localMatting: Wand2,
  videoUpscale: Sparkles,
  batchProcess: Copy,
  characterConsistency: UserCheck,
  director3D: Layers3,
  multiAngle: Aperture,
  panorama360: Globe,
  audioInput: AudioLines,
  characterLibrary: UserRound,
  sceneLibrary: Box,
  propLibrary: Package,
  script: Clapperboard,
};

const catalogIconMap: Record<AICGTaskIcon, React.ComponentType<{ className?: string }>> = {
  text: Type,
  image: ImageIcon,
  video: VideoIcon,
  compose: Scissors,
  director: Layers,
  audio: AudioLines,
  script: Clapperboard,
  storyboard: Clapperboard,
  character: UserRound,
  toolbox: Package,
  assets: FolderOpen,
  upload: Upload,
  history: FolderOpen,
  grid: Grid3X3,
  vr: Box,
  output: DownloadIcon,
};

const categoryLabels: Record<NodeCategory, string> = {
  input: '基础输入',
  output: '结果导出',
  processing: '数据处理',
  effect: '特效滤镜',
  text: '文本处理',
  audio: '音频创作',
  image: '图像生成',
  video: '视频创作',
  utility: '工具组件',
};

const FloatingNodePalette: React.FC<FloatingNodePaletteProps> = ({
  onAddNode,
  isOpen,
  onClose,
  onOpenToolbox,
  onOpenAssets,
}) => {
  const isVisible = isOpen ?? false;
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [width, setWidth] = useState(288);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleAddNode = useCallback(
    (nodeType: NodeTypeDefinition) => {
      enhancedNodeLibraryService.addToHistory(nodeType.id);
      onAddNode(nodeType);
    },
    [onAddNode]
  );

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 280, e.clientX - dragStart.x)),
        y: Math.max(60, Math.min(window.innerHeight - 200, e.clientY - dragStart.y)),
      });
    };
    const handleMouseUp = () => setIsDragging(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      startXRef.current = e.clientX;
      startWidthRef.current = width;
    },
    [width]
  );

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startXRef.current;
      const nextWidth = Math.max(240, Math.min(480, startWidthRef.current + deltaX));
      setWidth(nextWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const registryNodes = useMemo(() => getActiveRegistryDefinitions(), []);
  const groupedNodes = useMemo(() => {
    const groups: Partial<Record<NodeCategory, NodeTypeDefinition[]>> = {};
    for (const node of registryNodes) {
      const category = node.category || 'utility';
      if (!groups[category]) groups[category] = [];
      groups[category]!.push(node);
    }
    return groups;
  }, [registryNodes]);

  if (!isVisible) return null;

  const palette = (
    <>
      <div
        className={cn(
          'fixed z-[9998] flex flex-col overflow-hidden rounded-[20px] border border-white/10 bg-[#0d0d0d] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]',
          isDragging && 'cursor-grabbing select-none scale-[1.02] border-white/30',
          isResizing && 'transition-none'
        )}
        style={{
          left: position.x,
          top: position.y,
          width: `${width}px`,
          height: '460px',
        }}
        aria-label="节点资源库"
      >
        <div
          className={cn(
            'flex cursor-grab select-none items-center gap-3 border-b border-white/5 bg-white/[0.02] px-6 py-5',
            isDragging && 'cursor-grabbing'
          )}
          onMouseDown={handleDragStart}
        >
          <div className="flex flex-1 items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5">
              <Box className="h-4 w-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] font-bold tracking-tight text-white">节点资源库</span>
              <span className="text-[10px] font-medium uppercase tracking-widest text-white/40">
                Node Library
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-transparent text-white/40 transition-all hover:border-white/10 hover:bg-white/10 hover:text-white active:scale-90"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
        </div>

        <div className="floating-palette-scrollbar flex-1 space-y-6 overflow-x-hidden overflow-y-auto px-3 py-4">
          {Object.entries(groupedNodes).map(([category, nodes]) => {
            const cat = category as NodeCategory;
            return (
              <div key={category} className="space-y-3">
                <div className="flex items-center gap-3 px-4 py-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
                  <span className="text-[12px] font-semibold tracking-[0.12em] uppercase text-white/55">
                    {categoryLabels[cat]}
                  </span>
                  <div className="ml-2 h-px flex-1 bg-white/5" />
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2 px-0.5">
                  {nodes.map((nodeType) => (
                    <NodeItem
                      key={nodeType.id}
                      nodeType={nodeType}
                      onAdd={handleAddNode}
                      isHovered={hoveredNode === nodeType.id}
                      onHover={setHoveredNode}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="h-1 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-50" />
        <div
          className="absolute bottom-0 right-0 top-0 w-1.5 cursor-ew-resize transition-colors hover:bg-gray-500/20"
          onMouseDown={handleResizeStart}
        />
      </div>

      <SafeStyle
        css={`
          .floating-palette-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .floating-palette-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .floating-palette-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.15);
            border-radius: 10px;
          }
          .floating-palette-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.25);
          }
        `}
      />
    </>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(palette, document.body);
};

interface NodeItemProps {
  nodeType: NodeTypeDefinition;
  onAdd: (node: NodeTypeDefinition) => void;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  isPopular?: boolean;
}

const NodeItem: React.FC<NodeItemProps> = ({
  nodeType,
  onAdd,
  isHovered,
  onHover,
  isPopular = false,
}) => {
  const Icon = nodeIconMap[nodeType.id] || Box;

  return (
    <button
      type="button"
      onClick={() => onAdd(nodeType)}
      onMouseEnter={() => onHover(nodeType.id)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        'group relative flex min-h-[72px] w-full flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-2.5 transition-all duration-300',
        isHovered
          ? 'translate-y-[-1px] border-white/20 bg-white/[0.09]'
          : 'hover:border-white/15 hover:bg-white/[0.06]'
      )}
    >
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 transition-all duration-300',
          isHovered && 'scale-105 bg-white/15'
        )}
      >
        <Icon
          className={cn(
            'h-4 w-4 transition-all duration-300',
            isHovered ? 'text-white' : 'text-white/75'
          )}
        />
      </div>

      <div
        className={cn(
          'mt-0.5 px-0.5 text-center text-[11px] font-semibold leading-snug transition-all duration-300',
          isHovered ? 'text-white' : 'text-white/90'
        )}
      >
        {nodeType.name}
      </div>

      {isPopular && <div className="absolute right-2 top-2 h-1 w-1 rounded-full bg-orange-500" />}
    </button>
  );
};

export default FloatingNodePalette;
