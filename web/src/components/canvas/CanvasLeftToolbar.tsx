import { memo } from 'react';
import {
  Plus,
  Upload,
  LayoutGrid,
  AlignJustify,
  ShoppingBag,
  Library,
  Boxes,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CANVAS_SIDE_TOOLBAR_POSITION_CLASS } from './canvas-toolbar-position';

export interface CanvasLeftToolbarProps {
  onAddNode?: (anchorRect: DOMRect) => void;
  onConnect?: () => void;
  onUpload?: (anchorRect: DOMRect) => void;
  onLayout?: (anchorRect: DOMRect) => void;
  onAssetLibrary?: () => void;
  onList?: () => void;
  onWorkflow?: () => void;
  onNodeLibrary?: () => void;
  assetLibraryActive?: boolean;
  addActive?: boolean;
  connectActive?: boolean;
  layoutActive?: boolean;
  nodeLibraryActive?: boolean;
}

const IconButton = memo(function IconButton({
  icon: Icon,
  label,
  active,
  onClick,
  activeColor,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick?: (anchorRect: DOMRect) => void;
  activeColor?: string;
}) {
  const activeBg = activeColor || 'bg-white/[0.1]';
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e.currentTarget.getBoundingClientRect());
      }}
      title={label}
      aria-label={label}
      aria-pressed={Boolean(active)}
      className={cn(
        'relative flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-150',
        'text-white/55 hover:bg-white/[0.07] hover:text-white/95 active:scale-[0.94]',
        active && activeBg,
        active && 'text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]',
      )}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.6} />
    </button>
  );
});

const Divider = () => <div className="mx-1 my-1 h-px w-6 bg-white/10" />;

const CanvasLeftToolbar: React.FC<CanvasLeftToolbarProps> = ({
  onAddNode,
  onConnect,
  onUpload,
  onLayout,
  onAssetLibrary,
  onList,
  onWorkflow,
  onNodeLibrary,
  assetLibraryActive,
  addActive,
  connectActive,
  layoutActive,
  nodeLibraryActive,
}) => {
  return (
    <aside
      className={cn(
        CANVAS_SIDE_TOOLBAR_POSITION_CLASS,
        'left-3',
        'rounded-2xl border border-white/[0.08] bg-[#0d0d0d] px-1.5 py-2 backdrop-blur-2xl',
        'shadow-[0_12px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]',
      )}
      aria-label="画布左侧工具栏"
    >
      <IconButton
        icon={Plus}
        label="添加节点"
        onClick={onAddNode}
        active={addActive}
      />
      <div className="mx-1 my-1 h-px w-6 bg-white/10" />
      <IconButton
        icon={Upload}
        label="上传文件"
        onClick={onUpload}
      />
      <IconButton
        icon={LayoutGrid}
        label="网格布局"
        onClick={onLayout}
        active={layoutActive}
      />
      <IconButton
        icon={AlignJustify}
        label="列表视图"
        onClick={onList}
      />
      <Divider />
      <IconButton
        icon={Library}
        label="资源库"
        onClick={onAssetLibrary ? () => onAssetLibrary() : undefined}
        active={assetLibraryActive}
        activeColor="bg-sky-500/20 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.3)]"
      />
      <div className="mx-1 my-1 h-px w-6 bg-white/10" />
      <IconButton icon={ShoppingBag} label="工作流市场" onClick={onWorkflow ? () => onWorkflow() : undefined} />
      <Divider />
      <IconButton
        icon={Boxes}
        label="节点库"
        onClick={onNodeLibrary ? () => onNodeLibrary() : undefined}
        active={nodeLibraryActive}
        activeColor="bg-cyan-500/20 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.3)]"
      />
    </aside>
  );
};

export default memo(CanvasLeftToolbar);
