import { memo } from 'react';
import {
  Boxes,
  Package,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CANVAS_RIGHT_PANEL_TOOLBAR_OFFSET_CLASS,
  CANVAS_SIDE_TOOLBAR_POSITION_CLASS,
} from './canvas-toolbar-position';

/* ============================================================
 * 画布右侧工具栏（统一版）
 * ------------------------------------------------------------
 * 合并原右侧 aside + 右下角 div，精简为 8 个按钮:
 *   1. 资源库    — 统一素材/节点入口
 *   2. 角色库    — 角色管理
 *   3. 收藏      — 收藏 + 书签
 *   4. 小天工具箱 — AI 助手
 *   5. 剧本分镜  — 分镜工具
 *   6. 属性面板  — 节点属性
 *   7. 工程管理  — 项目管理
 *   8. 设置      — 更多选项
 *
 * 已移除（可通过快捷键/其他入口访问）:
 *   节点资源库 → 与资源库合并
 *   快照       → Ctrl+Shift+S
 *   书签       → 与收藏合并 / Ctrl+B
 *   审阅模式   → 设置菜单
 *   小地图     → 画布右下角内置
 * ============================================================ */

export interface CanvasRightToolbarProps {
  onAssetLibrary?: () => void;
  onCharacterLibrary?: () => void;
  onFavorites?: () => void;
  onNodeLibrary?: () => void;
  onToolbox?: () => void;
  onRightPanel?: () => void;
  assetLibraryActive?: boolean;
  characterLibraryActive?: boolean;
  favoritesActive?: boolean;
  nodeLibraryActive?: boolean;
  toolboxActive?: boolean;
  rightPanelActive?: boolean;
  avoidRightPanel?: boolean;
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
  onClick?: () => void;
  activeColor?: string;
}) {
  const activeBg = activeColor || 'bg-white/[0.1]';
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
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

const CanvasRightToolbar: React.FC<CanvasRightToolbarProps> = ({
  onNodeLibrary,
  onToolbox,
  nodeLibraryActive,
  toolboxActive,
  avoidRightPanel,
}) => {
  return (
    <aside
      className={cn(
        CANVAS_SIDE_TOOLBAR_POSITION_CLASS,
        avoidRightPanel ? CANVAS_RIGHT_PANEL_TOOLBAR_OFFSET_CLASS : 'right-3',
        'rounded-2xl border border-white/[0.08] bg-[#0d0d0d] px-1.5 py-2 backdrop-blur-2xl',
        'shadow-[0_12px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]',
      )}
      aria-label="画布右侧工具栏"
    >
      {/* 工具 */}
      <IconButton
        icon={Boxes}
        label="节点库"
        onClick={onNodeLibrary}
        active={nodeLibraryActive}
        activeColor="bg-cyan-500/20 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.3)]"
      />
    </aside>
  );
};

export default memo(CanvasRightToolbar);
