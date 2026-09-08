import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { NodeCategory, NodeTypeDefinition } from '@/types/node-system';
import { getActiveRegistryDefinitions } from '@/core/node-registry';
import {
  getAICGBaseNodes,
  getAICGToolNodes,
  AICG_BASE_TYPE_LABELS,
  AICG_BASE_NODE_MAP,
  type AICGBaseType,
} from '@/types/aicg-canvas-types';
import {
  Search,
  Image as ImageIcon,
  Video as VideoIcon,
  MessageSquare,
  Download,
  Box,
  Upload,
  Type,
  Scissors,
  BookUser,
  Layers,
  FileText,
  Clapperboard,
  Palette,
  ZoomIn,
  Music,
  Film,
  AudioLines,
  History,
  ChevronRight,
  Package,
  FolderOpen,
  Grid3X3,
  UserRound,
  Route,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  isCollapsedAICGPaletteNode,
  type AICGTaskIcon,
  type AICGTaskItem,
} from '@/config/aicg-node-catalog';

interface QuickAddNodePanelProps {
  onAddNode: (nodeType: NodeTypeDefinition) => void;
  onClose: () => void;
  anchorRect?: DOMRect | null;
  variant?: 'toolbar' | 'floating';
  onOpenToolbox?: () => void;
  onOpenAssets?: () => void;
}

const nodeIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  prompt: MessageSquare,
  aiGenText: Type,
  adCopyText: MessageSquare,
  brandCopyText: Type,
  storyboardEdit: Scissors,
  vr360Preview: Box,
  aiImage: Palette,
  aiVideo: Clapperboard,
  imageInput: ImageIcon,
  videoInput: VideoIcon,
  frameExtractor: Grid3X3,
  audioGen: Music,
  aicgVideoGen: Clapperboard,
  script: FileText,
  localMatting: Scissors,
  videoUpscale: ZoomIn,
  gridDirector: Layers,
  characterLibrary: BookUser,
  characterConsistency: BookUser,
  batchProcess: ZoomIn,
  output: Download,
  cameraPath: Route,
};

const catalogIconMap: Record<AICGTaskIcon, React.ComponentType<{ className?: string }>> = {
  text: Type,
  image: ImageIcon,
  video: VideoIcon,
  compose: Scissors,
  director: Layers,
  audio: AudioLines,
  script: Film,
  storyboard: Clapperboard,
  character: UserRound,
  toolbox: Package,
  assets: FolderOpen,
  upload: Upload,
  history: History,
  grid: Grid3X3,
  vr: Box,
  output: Download,
};

const categoryOrder: NodeCategory[] = [
  'input',
  'image',
  'video',
  'audio',
  'output',
  'processing',
  'effect',
  'text',
  'utility',
];

const categoryLabels: Record<NodeCategory, string> = {
  input: '输入',
  output: '输出',
  processing: '处理',
  effect: '特效',
  text: '文本',
  audio: '音频',
  image: '图像',
  video: '视频',
  utility: '工具',
};

const categoryColors: Record<NodeCategory, string> = {
  input: '#2ECC71',
  output: '#E74C3C',
  processing: '#3498DB',
  effect: '#9B59B6',
  text: '#6610F2',
  audio: '#06B6D4',
  image: '#8B5CF6',
  video: '#FF6B00',
  utility: '#95A5A6',
};

const _BASE_PANEL_ITEMS: Array<{
  baseType: AICGBaseType;
  icon: React.ComponentType<{ className?: string }>;
  model: string;
  sub: string;
  nodeIds?: string[];
}> = [
  { baseType: 'text', icon: Type, model: 'GEMINI3', sub: '脚本、广告词、品牌文案' },
  { baseType: 'image', icon: ImageIcon, model: 'BANANA PRO', sub: '', nodeIds: ['aiImage'] },
  { baseType: 'video', icon: VideoIcon, model: 'SUPERVIDEO2.0', sub: '', nodeIds: ['aiVideo'] },
  { baseType: 'audio', icon: Music, model: 'TTS', sub: '' },
  { baseType: 'script', icon: Clapperboard, model: '分镜 / VR / 剧本分镜', sub: '' },
];

function getCatalogIcon(icon?: AICGTaskIcon) {
  return icon ? catalogIconMap[icon] || Box : Box;
}

type ToolbarMenuItem = AICGTaskItem & {
  children?: AICGTaskItem[];
};

const AI_CREATION_ITEMS: AICGTaskItem[] = [
  {
    id: 'toolbar-image',
    title: 'AI图片',
    description: '生成、图生图、重绘和扩图统一入口',
    nodeIds: ['aiImage'],
    icon: 'image',
  },
  {
    id: 'toolbar-video',
    title: 'AI视频',
    description: '文生视频、图生视频、首尾帧和多参考',
    nodeIds: ['aiVideo'],
    icon: 'video',
  },
  {
    id: 'toolbar-storyboard-maker',
    title: '制作故事版',
    description: '创意拆分为分镜表、镜头提示词和视频蓝图',
    nodeIds: ['storyboardMaker'],
    icon: 'storyboard',
    badge: 'NEW',
  },
  {
    id: 'toolbar-camera-path',
    title: '镜头路径',
    description: '在图片上画出镜头运动路线并绑定 AI 视频',
    nodeIds: ['cameraPath'],
    icon: 'storyboard',
    badge: 'NEW',
  },
  {
    id: 'toolbar-image-upload',
    title: '上传图片',
    description: '从本地或素材库输入图片',
    nodeIds: ['imageInput'],
    icon: 'upload',
  },
  {
    id: 'toolbar-video-upload',
    title: '上传视频',
    description: '输入视频参考或剪辑素材',
    nodeIds: ['videoInput'],
    icon: 'upload',
  },
  {
    id: 'toolbar-video-frame-extractor',
    title: '视频抽帧',
    description: '从视频中提取关键帧作为图片继续创作',
    nodeIds: ['frameExtractor'],
    icon: 'grid',
  },
];

const TEXT_CREATION_ITEMS: AICGTaskItem[] = [
  {
    id: 'toolbar-text-node',
    title: '文本节点',
    description: '文案、提示词、广告词、品牌文案和分镜入口',
    nodeIds: ['aiGenText'],
    icon: 'text',
  },
  {
    id: 'toolbar-prompt-node',
    title: '提示词',
    description: '输入和管理生成提示词',
    nodeIds: ['prompt'],
    icon: 'text',
  },
  {
    id: 'toolbar-text-audio',
    title: '文本配音',
    description: '文本生成语音，也可作为音乐入口',
    nodeIds: ['audioGen'],
    icon: 'audio',
  },
  {
    id: 'toolbar-text-script',
    title: '脚本节点',
    description: '剧本、分镜、导演链路入口',
    nodeIds: ['script'],
    icon: 'script',
  },
];

const DIRECTOR_ITEMS: AICGTaskItem[] = [
  {
    id: 'toolbar-director-3d',
    title: '3D导演台',
    description: '3D 场景、人偶、机位和相机提示词',
    nodeIds: ['director3D'],
    icon: 'director',
  },
  {
    id: 'toolbar-director-panorama',
    title: '360全景图',
    description: '全景图上传、视角控制和沉浸预览',
    nodeIds: ['panorama360'],
    icon: 'vr',
  },
  {
    id: 'toolbar-director-grid',
    title: '分镜导演',
    description: '宫格生成、分镜编排和导演链路',
    nodeIds: ['gridDirector'],
    icon: 'grid',
  },
];

const TOOLBOX_ITEMS: AICGTaskItem[] = [
  {
    id: 'toolbar-output',
    title: '输出节点',
    description: '汇总图片、视频或音频结果',
    nodeIds: ['output'],
    icon: 'output',
  },
  {
    id: 'toolbar-character',
    title: '角色库',
    description: '角色头像、三视图和设定管理',
    nodeIds: ['characterLibrary'],
    icon: 'character',
  },
];

const TOOLBAR_PRIMARY_ITEMS: ToolbarMenuItem[] = [
  {
    id: 'toolbar-ai-creation',
    title: 'AI创作',
    description: '图片、视频生成与上传入口',
    icon: 'image',
    children: AI_CREATION_ITEMS,
  },
  {
    id: 'toolbar-text',
    title: '文本',
    description: '文案、配音和脚本入口',
    icon: 'text',
    children: TEXT_CREATION_ITEMS,
  },
  {
    id: 'toolbar-director',
    title: '导演台',
    description: '3D、全景、多角度和分镜入口',
    icon: 'director',
    children: DIRECTOR_ITEMS,
  },
  {
    id: 'toolbar-toolbox',
    title: '工具箱',
    description: '输出和角色工具入口',
    icon: 'toolbox',
    badge: 'NEW',
    children: TOOLBOX_ITEMS,
  },
  {
    id: 'toolbar-assets',
    title: '素材库',
    description: '打开项目素材、生成历史和收藏',
    action: 'openAssets',
    icon: 'assets',
  },
];

const QuickAddNodePanel: React.FC<QuickAddNodePanelProps> = ({
  onAddNode,
  onClose,
  anchorRect,
  variant = 'floating',
  onOpenToolbox,
  onOpenAssets,
}) => {
  const [search, setSearch] = useState('');
  const [openSubmenuKey, setOpenSubmenuKey] = useState<string | null>('toolbar-ai-creation');
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (variant !== 'toolbar') inputRef.current?.focus();
  }, [variant]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const aicgBaseNodes = useMemo(() => getAICGBaseNodes(), []);
  const aicgToolNodes = useMemo(() => getAICGToolNodes(), []);
  const registryNodes = useMemo(() => getActiveRegistryDefinitions(), []);
  const aicgBaseIds = useMemo(
    () =>
      new Set(
        Object.values(AICG_BASE_NODE_MAP).flatMap((m) => [m.primary, ...(m.alternates ?? [])])
      ),
    []
  );
  const aicgToolIds = useMemo(() => new Set(aicgToolNodes.map((n) => n.id)), [aicgToolNodes]);

  const { groupedNodes } = useMemo(() => {
    const base = registryNodes.filter(
      (n) =>
        !isCollapsedAICGPaletteNode(n.id) &&
        !n.deprecated &&
        !aicgBaseIds.has(n.id) &&
        !aicgToolIds.has(n.id)
    );
    const grouped = base.reduce(
      (acc, node) => {
        const cat = ['aiImage', 'unifiedImageStudio', 'aiVideo', 'aicgVideoGen'].includes(node.id)
          ? 'input'
          : node.category;
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(node);
        return acc;
      },
      {} as Partial<Record<NodeCategory, NodeTypeDefinition[]>>
    );
    return { groupedNodes: grouped };
  }, [registryNodes, aicgBaseIds, aicgToolIds]);

  const filteredAicgBaseNodes = useMemo(() => {
    if (!search.trim()) return aicgBaseNodes;
    const q = search.toLowerCase();
    return aicgBaseNodes.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        n.id.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q)
    );
  }, [search, aicgBaseNodes]);

  const filteredAicgToolNodes = useMemo(() => {
    if (!search.trim()) return aicgToolNodes;
    const q = search.toLowerCase();
    return aicgToolNodes.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        n.id.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q)
    );
  }, [search, aicgToolNodes]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groupedNodes;
    const q = search.toLowerCase();
    const filtered: Partial<Record<NodeCategory, NodeTypeDefinition[]>> = {};
    for (const [cat, nodes] of Object.entries(groupedNodes)) {
      const matched = nodes.filter(
        (n) =>
          n.name.toLowerCase().includes(q) ||
          n.id.toLowerCase().includes(q) ||
          n.description.toLowerCase().includes(q)
      );
      if (matched.length > 0) filtered[cat as NodeCategory] = matched;
    }
    return filtered;
  }, [search, groupedNodes]);

  const handleSelect = useCallback(
    (nodeType: NodeTypeDefinition) => {
      onAddNode(nodeType);
      onClose();
    },
    [onAddNode, onClose]
  );

  const panelStyle: React.CSSProperties =
    variant === 'toolbar'
      ? {
          position: 'fixed',
          left: anchorRect ? anchorRect.right + 8 : 76,
          top: anchorRect
            ? Math.max(20, Math.min(anchorRect.top - 54, window.innerHeight - 640))
            : '50%',
        }
      : anchorRect
        ? {
            position: 'absolute',
            bottom: 48,
            right: 0,
          }
        : {
            position: 'fixed',
            bottom: 80,
            right: 24,
          };

  if (variant === 'toolbar') {
    const baseMap = new Map(aicgBaseNodes.map((n) => [n.id, n]));
    const registryMap = new Map(registryNodes.map((n) => [n.id, n]));
    const getCatalogNode = (item: AICGTaskItem) =>
      item.nodeIds?.map((id) => registryMap.get(id) ?? baseMap.get(id)).find(Boolean);
    const getVisibleChildren = (item: ToolbarMenuItem) =>
      (item.children || []).filter((child) => child.action || getCatalogNode(child));
    const visibleItems = TOOLBAR_PRIMARY_ITEMS.filter(
      (item) => item.action || getCatalogNode(item) || getVisibleChildren(item).length > 0
    );
    const openSubmenuItem = visibleItems.find((item) => item.id === openSubmenuKey);
    const openSubmenuItems = openSubmenuItem ? getVisibleChildren(openSubmenuItem) : [];
    const handleCatalogItem = (item: AICGTaskItem) => {
      if (item.action === 'openToolbox') {
        onOpenToolbox?.();
        onClose();
        return;
      }
      if (item.action === 'openAssets') {
        onOpenAssets?.();
        onClose();
        return;
      }
      const nodeType = getCatalogNode(item);
      if (nodeType) handleSelect(nodeType);
    };

    return (
      <div
        ref={panelRef}
        className={cn(
          'relative z-[9999] w-[268px] overflow-visible rounded-[15px] border border-white/[0.08]',
          'bg-[#252525]/80 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.52)] backdrop-blur-2xl',
          'animate-in fade-in zoom-in-95 duration-150'
        )}
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <ToolbarSectionTitle>添加节点</ToolbarSectionTitle>
        <div className="space-y-0.5 px-4">
          {visibleItems.map((item) => {
            const children = getVisibleChildren(item);
            const hasSubmenu = children.length > 0;
            return (
              <ToolbarAddItem
                key={item.id}
                icon={getCatalogIcon(item.icon)}
                title={item.title}
                subtitle={item.description}
                badge={item.badge}
                hasSubmenu={hasSubmenu}
                submenuOpen={openSubmenuKey === item.id}
                onMouseEnter={() => setOpenSubmenuKey(hasSubmenu ? item.id : null)}
                onClick={() => {
                  if (hasSubmenu) {
                    setOpenSubmenuKey((key) => (key === item.id ? null : item.id));
                    return;
                  }
                  handleCatalogItem(item);
                }}
              />
            );
          })}
        </div>
        <ToolbarSubmenu
          parent={openSubmenuItem}
          items={openSubmenuItems}
          onSelect={handleCatalogItem}
        />
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className={cn(
        'z-[100] w-[320px] max-h-[480px] flex flex-col',
        'rounded-2xl border border-white/10',
        'bg-[#0d0d0d]/80 backdrop-blur-2xl',
        'animate-in fade-in slide-in-from-bottom-2 duration-200'
      )}
      style={panelStyle}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <Search className="w-4 h-4 text-white/40 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索节点..."
          className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="text-white/30 hover:text-white/60 transition-colors"
          >
            <span className="block h-3.5 w-3.5 rotate-45 text-lg leading-[12px]">+</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-3 py-3 space-y-4">
        {Object.keys(filteredGroups).length === 0 &&
          filteredAicgBaseNodes.length === 0 &&
          filteredAicgToolNodes.length === 0 && (
            <div className="text-center py-8 text-white/30 text-sm">未找到匹配的节点</div>
          )}

        {filteredAicgBaseNodes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400/70" />
              <span className="text-[10px] font-bold text-white/50 tracking-[0.12em]">
                AICG 基础节点
              </span>
              <div className="flex-1 h-px bg-white/5" />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(AICG_BASE_NODE_MAP) as AICGBaseType[]).map((baseType) => {
                const mapping = AICG_BASE_NODE_MAP[baseType];
                const nodeType = filteredAicgBaseNodes.find((n) => n.id === mapping.primary);
                if (!nodeType) return null;
                return (
                  <NodeItem
                    key={nodeType.id}
                    nodeType={nodeType}
                    category="input"
                    onSelect={handleSelect}
                  />
                );
              })}
            </div>
            <p className="px-1 text-[9px] text-white/30">
              {Object.values(AICG_BASE_TYPE_LABELS).join(' / ')}
            </p>
          </div>
        )}

        {filteredAicgToolNodes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400/60" />
              <span className="text-[10px] font-bold text-white/50 tracking-[0.12em]">
                专业工具
              </span>
              <div className="flex-1 h-px bg-white/5" />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {filteredAicgToolNodes.map((nodeType) => (
                <NodeItem
                  key={nodeType.id}
                  nodeType={nodeType}
                  category="utility"
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </div>
        )}

        {categoryOrder.map((cat) => {
          const nodes = filteredGroups[cat];
          if (!nodes || nodes.length === 0) return null;

          return (
            <div key={cat} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: categoryColors[cat] }}
                />
                <span className="text-[10px] font-bold text-white/35 tracking-[0.15em] uppercase">
                  {categoryLabels[cat]}
                </span>
                <div className="flex-1 h-px bg-white/5" />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {nodes.map((nodeType) => (
                  <NodeItem
                    key={nodeType.id}
                    nodeType={nodeType}
                    category={cat}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="h-0.5 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </div>
  );
};

interface ToolbarAddItemProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  badge?: 'Beta' | 'NEW';
  hasSubmenu?: boolean;
  submenuOpen?: boolean;
  onMouseEnter?: () => void;
  onClick: () => void;
}

const ToolbarSectionTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div className={cn('px-4 pb-2 pt-1 text-[13px] font-medium text-white/55', className)}>
    {children}
  </div>
);

interface ToolbarSubmenuProps {
  parent?: ToolbarMenuItem;
  items: AICGTaskItem[];
  onSelect: (item: AICGTaskItem) => void;
}

const ToolbarSubmenu: React.FC<ToolbarSubmenuProps> = ({ parent, items, onSelect }) => {
  if (!parent || items.length === 0) return null;

  return (
    <div className="absolute left-[calc(100%+8px)] top-3 w-[286px] overflow-hidden rounded-[15px] border border-white/[0.08] bg-[#252525]/80 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.52)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
      <ToolbarSectionTitle>
        <span className="flex flex-col gap-0.5">
          <span>{parent.title}</span>
          {parent.description ? (
            <span className="text-[10px] font-normal text-white/30">{parent.description}</span>
          ) : null}
        </span>
      </ToolbarSectionTitle>
      <div className="space-y-0.5 px-4 pb-1">
        {items.map((item) => (
          <ToolbarAddItem
            key={item.id}
            icon={getCatalogIcon(item.icon || parent.icon)}
            title={item.title}
            subtitle={item.description}
            badge={item.badge}
            onClick={() => onSelect(item)}
          />
        ))}
      </div>
    </div>
  );
};

const ToolbarAddItem: React.FC<ToolbarAddItemProps> = ({
  icon: Icon,
  title,
  subtitle,
  badge,
  hasSubmenu,
  submenuOpen,
  onMouseEnter,
  onClick,
}) => (
  <button
    type="button"
    onMouseEnter={onMouseEnter}
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    className={cn(
      'group flex min-h-[52px] w-full items-center gap-2 rounded-[9px] px-0 py-1 text-left text-white/92 transition-colors hover:bg-white/[0.055] active:bg-white/[0.08]',
      submenuOpen && 'bg-white/[0.07]'
    )}
  >
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-white/[0.1] text-white/88 transition-colors group-hover:bg-white/[0.14] group-hover:text-white">
      <Icon className="h-[19px] w-[19px]" />
    </span>
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-[14px] font-semibold leading-none text-white/95">
          {title}
        </span>
        {badge ? (
          <span
            className={cn(
              'rounded px-1.5 py-[2px] text-[10px] font-bold leading-none',
              badge === 'NEW' ? 'bg-cyan-500/95 text-[#05252f]' : 'bg-white/[0.18] text-white/65'
            )}
          >
            {badge}
          </span>
        ) : null}
      </span>
      {subtitle ? (
        <span className="line-clamp-1 text-[10px] leading-tight text-white/32">{subtitle}</span>
      ) : null}
    </span>
    {hasSubmenu ? <ChevronRight className="mr-1 h-4 w-4 shrink-0 text-white/40" /> : null}
  </button>
);

interface NodeItemProps {
  nodeType: NodeTypeDefinition;
  category: NodeCategory;
  onSelect: (nodeType: NodeTypeDefinition) => void;
}

const NodeItem: React.FC<NodeItemProps> = ({ nodeType, category, onSelect }) => {
  const Icon = nodeIconMap[nodeType.id] || Box;
  const color = categoryColors[category];

  return (
    <button
      onClick={() => onSelect(nodeType)}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2.5 rounded-xl',
        'border border-white/5 bg-white/[0.02]',
        'hover:bg-white/[0.06] hover:border-white/10',
        'transition-all duration-200 text-left group'
      )}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-semibold text-white/90 truncate leading-tight">
          {nodeType.name}
        </div>
        <div className="text-[9px] text-white/30 truncate leading-tight mt-0.5">
          {nodeType.description}
        </div>
      </div>
    </button>
  );
};

export default QuickAddNodePanel;
