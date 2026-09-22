import { memo } from 'react';
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
  onToolbox?: () => void;
  onRightPanel?: () => void;
  assetLibraryActive?: boolean;
  characterLibraryActive?: boolean;
  favoritesActive?: boolean;
  toolboxActive?: boolean;
  rightPanelActive?: boolean;
  avoidRightPanel?: boolean;
}

const CanvasRightToolbar: React.FC<CanvasRightToolbarProps> = ({
  onToolbox,
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
    </aside>
  );
};

export default memo(CanvasRightToolbar);
