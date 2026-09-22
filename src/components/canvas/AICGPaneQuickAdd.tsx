import { memo } from 'react';
import {
  Type,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  LayoutGrid,
  ArrowRight,
  ArrowDown,
  Network,
  Boxes,
  Rows3,
  Rows4,
  PanelTop,
  Grid3X3,
} from 'lucide-react';
import {
  getAICGBaseNodes,
  AICG_BASE_TYPE_LABELS,
  AICG_BASE_NODE_MAP,
  type AICGBaseType,
} from '@/types/aicg-canvas-types';
import type { NodeTypeDefinition } from '@/types/node-system';
import type { AutoLayoutType } from '@/hooks/useAutoLayout';

const BASE_ICONS: Record<AICGBaseType, typeof Type> = {
  text: Type,
  image: ImageIcon,
  video: Video,
  audio: Music,
  script: FileText,
};

const LAYOUT_OPTIONS: Array<{
  type: AutoLayoutType;
  label: string;
  icon: typeof Type;
}> = [
  { type: 'horizontal', label: '水平', icon: ArrowRight },
  { type: 'vertical', label: '垂直', icon: ArrowDown },
  { type: 'flow-smart', label: '连线层级', icon: Network },
  { type: 'type-zones', label: '类型分区', icon: Boxes },
  { type: 'compact', label: '紧凑', icon: Rows3 },
  { type: 'standard', label: '标准', icon: Rows4 },
  { type: 'relaxed', label: '宽松', icon: PanelTop },
  { type: 'grid', label: '网格', icon: Grid3X3 },
];

interface AICGPaneQuickAddProps {
  x: number;
  y: number;
  onAddNode: (def: NodeTypeDefinition) => void;
  onAutoLayout?: (type: AutoLayoutType) => void;
  onClose: () => void;
}

function AICGPaneQuickAdd({ x, y, onAddNode, onAutoLayout, onClose }: AICGPaneQuickAddProps) {
  const baseNodes = getAICGBaseNodes();

  return (
    <>
      <div
        className="fixed inset-0 z-[200]"
        onClick={onClose}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div
        className="fixed z-[201] max-h-[70vh] min-w-[240px] overflow-y-auto rounded-xl border border-white/10 bg-[#1a1a1e] py-1.5 shadow-2xl custom-scrollbar"
        style={{ left: x, top: y }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40">
          AICG · 双击新建
        </div>

        {(Object.keys(AICG_BASE_NODE_MAP) as AICGBaseType[]).map((baseType) => {
          const mapping = AICG_BASE_NODE_MAP[baseType];
          const def = baseNodes.find((n) => n.id === mapping.primary);
          if (!def) return null;
          const Icon = BASE_ICONS[baseType];
          return (
            <button
              key={baseType}
              type="button"
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-white/10"
              onClick={() => {
                onAddNode(def);
                onClose();
              }}
            >
              <Icon className="h-4 w-4 shrink-0 text-white/60" />
              <div>
                <div className="text-[11px] text-white">{AICG_BASE_TYPE_LABELS[baseType]}节点</div>
                <div className="text-[9px] text-white/35">{mapping.description}</div>
              </div>
            </button>
          );
        })}

        {onAutoLayout && (
          <>
            <div className="my-1 border-t border-white/5" />
            <div className="flex items-center gap-1.5 px-3 py-1 text-[9px] text-white/30">
              <LayoutGrid className="h-3 w-3" />
              节点排布
            </div>
            <div className="grid grid-cols-2 gap-1 px-3 pb-2">
              {LAYOUT_OPTIONS.map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  type="button"
                  className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] text-white/82 transition-colors hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    onAutoLayout(type);
                    onClose();
                  }}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-white/55" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default memo(AICGPaneQuickAdd);
