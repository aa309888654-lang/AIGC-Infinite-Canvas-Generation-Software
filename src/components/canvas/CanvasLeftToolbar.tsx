import { memo } from 'react';
import {
  Plus,
  Upload,
  LayoutGrid,
  AlignJustify,
  Library,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { CANVAS_SIDE_TOOLBAR_POSITION_CLASS } from './canvas-toolbar-position';

export interface CanvasLeftToolbarProps {
  onAddNode?: (anchorRect: DOMRect) => void;
  onConnect?: () => void;
  onUpload?: (anchorRect: DOMRect) => void;
  onLayout?: (anchorRect: DOMRect) => void;
  onAssetLibrary?: () => void;
  onList?: () => void;
  assetLibraryActive?: boolean;
  addActive?: boolean;
  connectActive?: boolean;
  layoutActive?: boolean;
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
  assetLibraryActive,
  addActive,
  connectActive,
  layoutActive,
}) => {
  const { t } = useTranslation();
  return (
    <aside
      className={cn(
        CANVAS_SIDE_TOOLBAR_POSITION_CLASS,
        'left-3',
        'rounded-2xl border border-white/[0.08] bg-[#0d0d0d] px-1.5 py-2 backdrop-blur-2xl',
        'shadow-[0_12px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]',
      )}
      aria-label={t('canvas.left_toolbar')}
    >
      <IconButton
        icon={Plus}
        label={t('canvas.add_node')}
        onClick={onAddNode}
        active={addActive}
      />
      <div className="mx-1 my-1 h-px w-6 bg-white/10" />
      <IconButton
        icon={Upload}
        label={t('canvas.upload_file')}
        onClick={onUpload}
      />
      <IconButton
        icon={LayoutGrid}
        label={t('canvas.grid_layout')}
        onClick={onLayout}
        active={layoutActive}
      />
      <IconButton
        icon={AlignJustify}
        label={t('canvas.list_view')}
        onClick={onList}
      />
      <Divider />
      <IconButton
        icon={Library}
        label={t('canvas.asset_library')}
        onClick={onAssetLibrary ? () => onAssetLibrary() : undefined}
        active={assetLibraryActive}
        activeColor="bg-sky-500/20 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.3)]"
      />
      <Divider />
    </aside>
  );
};

export default memo(CanvasLeftToolbar);
