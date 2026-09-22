import { memo, type ReactNode } from 'react';
import { X as CloseIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AICG_BASE_TYPE_LABELS,
  type AICGBaseType,
} from '@/types/aicg-canvas-types';
import { aicgGlass, aicgGlassCard } from './aicg-node-glass';

// 所有 AICG 类型共用同一套徽章配色，统一常量避免冗余字典
const BADGE_BG = 'bg-white/[0.07]';
const BADGE_TEXT = 'text-[10px] font-bold';

export interface AICGNodeShellProps {
  aicgType: AICGBaseType | 'tool';
  title: string;
  subtitle?: string;
  selected?: boolean;
  width?: number | string;
  className?: string;
  bodyClassName?: string;
  controlPaneClassName?: string;
  onDelete?: () => void;
  /** 收起控制面板 */
  onControllerCollapse?: () => void;
  headerExtra?: ReactNode;
  footer?: ReactNode;
  /** 嵌入到其他节点时隐藏顶栏 */
  chromeless?: boolean;
  /**
   * glass — 窄边框玻璃质感（默认）
   * glass-stack — 预览区 + 控制区上下分卡（AICG 生图节点布局）
   * glass-modern — 现代紧凑布局:小徽章 + 渐变高光 + 内置参数面板占位
   * classic — 旧版实心顶栏（仅兼容）
   */
  variant?: 'glass' | 'glass-stack' | 'glass-modern' | 'classic';
  /** variant=glass-stack 时：上方预览区 */
  preview?: ReactNode;
  /** variant=glass-stack 时：下方控制区 */
  controls?: ReactNode;
  /** variant=glass-modern 时：参数面板区(可折叠) */
  parameters?: ReactNode;
  /** variant=glass-modern 时：状态指示(success/error/loading) */
  status?: ReactNode;
  /** variant=glass-modern 时：参数区是否展开 */
  parametersExpanded?: boolean;
  /** variant=glass-modern 时：参数区展开切换 */
  onParametersToggle?: () => void;
  /** 收起底部控制区（双击预览区切换） */
  controlsCollapsed?: boolean;
  hideHeader?: boolean;
  hideControlHeader?: boolean;
  /** 预览区双击 — 通常用于收起/展开控制面板 */
  onPreviewDoubleClick?: (e: React.MouseEvent) => void;
  children?: ReactNode;
}

function TypeBadge({ aicgType }: { aicgType: AICGBaseType | 'tool' }) {
  const badgeLabel = aicgType === 'tool' ? '工具' : AICG_BASE_TYPE_LABELS[aicgType];
  return (
    <span className={cn(aicgGlass.badge, BADGE_BG, 'text-white border-white/35')}>{badgeLabel}</span>
  );
}

/** 节点卡片右上角动作区；统一提供关闭节点入口。 */
export function AICGNodeTopCornerActions({
  onDelete,
  onControllerCollapse,
  showControllerClose,
}: {
  onDelete?: () => void;
  onControllerCollapse?: () => void;
  showControllerClose?: boolean;
}) {
  return (
    <NodeCornerActions
      onDelete={onDelete}
      onControllerCollapse={onControllerCollapse}
      showControllerClose={showControllerClose}
    />
  );
}

function NodeCornerActions({
  onDelete,
  onControllerCollapse,
  showControllerClose,
}: {
  onDelete?: () => void;
  onControllerCollapse?: () => void;
  showControllerClose?: boolean;
}) {
  void onControllerCollapse;
  void showControllerClose;
  if (!onDelete) return null;

  return (
    <div className="pointer-events-none absolute right-1.5 top-1.5 z-50 flex items-center">
      <button
        type="button"
        className="nodrag nowheel pointer-events-auto flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-black/35 text-white/48 shadow-[0_8px_20px_rgba(0,0,0,0.28)] backdrop-blur-md transition-all hover:border-red-500/40 hover:bg-red-500/18 hover:text-red-300"
        title="关闭节点"
        aria-label="关闭节点"
        data-testid="aicg-node-close"
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
      >
        <CloseIcon className="h-3.5 w-3.5" strokeWidth={2.2} />
      </button>
    </div>
  );
}

/** 预览区玻璃卡片 */
export function AICGNodePreviewPane({
  className,
  children,
  selected,
  onDoubleClick,
}: {
  className?: string;
  children: ReactNode;
  selected?: boolean;
  onDoubleClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className={cn(
        aicgGlass.preview,
        'z-10',
        selected
          ? 'border-white/28 bg-[#151515] shadow-[0_14px_46px_rgba(0,0,0,0.66)]'
          : 'shadow-[0_10px_34px_rgba(0,0,0,0.58)] hover:border-white/22 hover:bg-[#15171a] hover:shadow-[0_12px_42px_rgba(0,0,0,0.62)]',
        onDoubleClick && 'cursor-pointer',
        className,
      )}
      onDoubleClick={onDoubleClick}
    >
      {children}
    </div>
  );
}

/** 控制区玻璃卡片 */
export function AICGNodeControlPane({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn(aicgGlass.control, 'z-20', className)}>{children}</div>;
}

/** AICG 风格节点外壳：玻璃质感 + 可选上下分卡 */
function AICGNodeShell({
  aicgType,
  title,
  subtitle,
  selected,
  width = 420,
  className,
  bodyClassName,
  controlPaneClassName,
  onDelete,
  onControllerCollapse,
  headerExtra,
  footer,
  chromeless,
  variant = 'glass',
  preview,
  controls,
  parameters,
  status,
  parametersExpanded = true,
  onParametersToggle,
  controlsCollapsed,
  hideHeader,
  hideControlHeader,
  onPreviewDoubleClick,
  children,
}: AICGNodeShellProps) {
  const showControllerClose = Boolean(onControllerCollapse && !controlsCollapsed);

  const wrapWithCornerActions = (content: ReactNode) => (
    <div className="relative">
      <NodeCornerActions
        onDelete={onDelete}
        onControllerCollapse={onControllerCollapse}
        showControllerClose={showControllerClose}
      />
      {content}
    </div>
  );

  const shellBody = (content: ReactNode) => wrapWithCornerActions(content);

  if (chromeless) {
    return <div className={cn('w-full', bodyClassName)}>{children}</div>;
  }

  const isStacked = variant === 'glass-stack' && (preview != null || controls != null);
  const isModern = variant === 'glass-modern';

  /* ==================== 现代布局 ==================== */
  if (isModern) {
    return shellBody(
      <div
        className={cn(
          aicgGlass.wrapper,
          'gap-2.5',
          className,
        )}
        style={{ width: typeof width === 'number' ? width : width === '100%' ? '100%' : undefined }}
      >
        {/* 顶部标题栏 - 紧凑玻璃 */}
        {!hideHeader ? (
          <header
            className={cn(
              'drag-handle group/header flex cursor-grab items-center gap-2 rounded-[12px] border border-white/[0.14] bg-[#101012] px-2.5 py-1.5 transition-all active:cursor-grabbing',
              selected && 'border-white/28 bg-[#151515]',
            )}
          >
            <span className="relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-md">
              <span className={cn('absolute inset-0', BADGE_BG)} />
              <span className={cn('relative z-[1]', BADGE_TEXT)}>
                {aicgType === 'tool' ? 'T' : (AICG_BASE_TYPE_LABELS[aicgType] ?? 'T').charAt(0)}
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 truncate text-[11.5px] font-semibold text-white/90">
                {title}
                {subtitle ? (
                  <span className="text-[9px] font-normal text-white/35 tracking-wide">· {subtitle}</span>
                ) : null}
              </div>
            </div>
            {status ? <div className="flex shrink-0 items-center">{status}</div> : null}
            <div className="flex shrink-0 items-center gap-0.5">{headerExtra}</div>
          </header>
        ) : null}

        {/* 预览区 */}
        {preview != null ? (
          <AICGNodePreviewPane
            selected={selected}
            onDoubleClick={onPreviewDoubleClick}
            className="drag-handle cursor-grab active:cursor-grabbing"
          >
            {preview}
          </AICGNodePreviewPane>
        ) : null}

        {/* 控制区 - 现代卡片 */}
        {controls != null || parameters != null ? (
          <div
            className={cn(
              'relative overflow-hidden rounded-[14px] border border-white/[0.14] bg-[#101012] transition-all duration-300',
              selected
                ? 'border-white/28 bg-[#151515] shadow-[0_14px_46px_rgba(0,0,0,0.66)]'
                : 'shadow-[0_10px_34px_rgba(0,0,0,0.58)]',
              controlsCollapsed && 'pointer-events-none max-h-0 overflow-hidden !p-0 opacity-0',
            )}
          >
            {controls != null ? (
              <div className={cn('p-2.5', bodyClassName)}>
                <div className="before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/18">
                  {controls}
                </div>
              </div>
            ) : null}

            {parameters != null && parametersExpanded ? (
              <div className="border-t border-white/[0.1] bg-black/18 px-2.5 py-2">
                {parameters}
              </div>
            ) : null}

            {parameters != null ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onParametersToggle?.();
                }}
                className="flex w-full items-center justify-center gap-1 border-t border-white/[0.1] py-1 text-[10px] text-white/45 transition-colors hover:bg-white/[0.04] hover:text-white"
                title={parametersExpanded ? '收起参数面板' : '展开参数面板'}
              >
                <span
                  className={cn(
                    'inline-block transition-transform duration-200',
                    parametersExpanded ? 'rotate-180' : 'rotate-0',
                  )}
                >
                  ▲
                </span>
                {parametersExpanded ? '收起参数' : '展开参数'}
              </button>
            ) : null}
          </div>
        ) : null}

        {footer}
      </div>,
    );
  }

  if (variant === 'classic') {
    return shellBody(
      <div
        className={cn(aicgGlass.wrapper, className)}
        style={{ width: typeof width === 'number' ? width : undefined }}
      >
        <div
          className={cn(
            'aicg-node-card overflow-hidden rounded-[12px] bg-[#101012] shadow-[0_10px_34px_rgba(0,0,0,0.58)] transition-all',
            selected
              ? 'border border-white'
              : 'border border-white hover:border-white',
          )}
        >
          <div className="drag-handle flex cursor-grab items-center justify-between border-b border-white/[0.1] bg-black/18 px-3 py-2 active:cursor-grabbing">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <TypeBadge aicgType={aicgType} />
              <div className="min-w-0">
                <div className="truncate text-[11px] font-medium text-white/85">{title}</div>
                {subtitle && (
                  <div className="truncate text-[9px] text-white/35">{subtitle}</div>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {headerExtra}
            </div>
          </div>
          <div className={cn('aicg-node-body', bodyClassName)}>{children}</div>
          {footer && (
            <div className="border-t border-white/[0.1] bg-black/18 px-3 py-2">{footer}</div>
          )}
        </div>
      </div>,
    );
  }

  const titleRow = (
    <div className={aicgGlass.dragStrip}>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <TypeBadge aicgType={aicgType} />
        <div className="min-w-0">
          <div className="truncate text-[11px] font-medium text-white/80">{title}</div>
          {subtitle ? (
            <div className="truncate text-[9px] text-white/32">{subtitle}</div>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {headerExtra}
      </div>
    </div>
  );

  if (isStacked) {
    return (
      <div
        className={cn('relative', aicgGlass.wrapper, aicgGlass.stack, className)}
        style={{ width: typeof width === 'number' ? width : width === '100%' ? '100%' : undefined }}
      >
        <NodeCornerActions
          onDelete={onDelete}
          onControllerCollapse={onControllerCollapse}
          showControllerClose={showControllerClose}
        />
        {preview != null ? (
          <AICGNodePreviewPane
            selected={selected}
            onDoubleClick={onPreviewDoubleClick}
            className="drag-handle cursor-grab active:cursor-grabbing"
          >
            {preview}
          </AICGNodePreviewPane>
        ) : null}
        {controls != null ? (
          <AICGNodeControlPane
            className={cn(
              'transition-all duration-300',
              controlPaneClassName,
              controlsCollapsed && 'pointer-events-none h-0 max-h-0 overflow-hidden opacity-0 !p-0',
            )}
          >
            {hideControlHeader ? null : titleRow}
            <div className={cn('aicg-node-body', bodyClassName)}>{controls}</div>
            {footer}
          </AICGNodeControlPane>
        ) : (
          <div className={aicgGlassCard(selected)}>
            {titleRow}
          </div>
        )}
      </div>
    );
  }

  return shellBody(
    <div
      className={cn(aicgGlass.wrapper, className)}
      style={{ width: typeof width === 'number' ? width : undefined }}
    >
      <div className={aicgGlassCard(selected)}>
        {titleRow}
        <div className={cn('aicg-node-body', bodyClassName)}>{children}</div>
        {footer && (
          <div className="border-t border-white/18 px-2.5 py-2">{footer}</div>
        )}
      </div>
    </div>,
  );
}

export default memo(AICGNodeShell);
