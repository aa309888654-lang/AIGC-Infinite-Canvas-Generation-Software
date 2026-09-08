import { memo, type ReactNode } from 'react';
import {
  ArrowUp,
  CheckCircle2,
  Clapperboard,
  Download,
  Grid3X3,
  Image as ImageIcon,
  Layers,
  Lightbulb,
  LocateFixed,
  Maximize2,
  Music,
  Orbit,
  Palette,
  Sparkles,
  Sun,
  Trash2,
  Unlink2,
  Video,
  Wand2,
  Zap,
  RefreshCw,
  Captions,
  FileDown,
  FileUp,
  RotateCcw,
  Save,
  ScanSearch,
  SlidersHorizontal,
  Upload,
  Box,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  NC_ICON_CLASS,
  NC_ICON_STROKE,
  nodeCtrl,
  ncActionStateClass,
  ncActionToneClass,
  type NodeControllerActionTone,
  type NodeControllerActionState,
} from './node-controller-tokens';

export type { NodeControllerActionTone, NodeControllerActionState };

export type NodeControllerActionIcon =
  | 'image'
  | 'video'
  | 'sparkles'
  | 'upscale'
  | 'panorama'
  | 'multiAngle'
  | 'relight'
  | 'grid'
  | 'split'
  | 'camera'
  | 'character'
  | 'music'
  | 'download'
  | 'trash'
  | 'expand'
  | 'send'
  | 'upload'
  | 'save'
  | 'analyze'
  | 'subtitle'
  | 'reset'
  | 'settings'
  | 'model3d'
  | 'import'
  | 'export';

export interface NodeControllerConnectedSource {
  nodeId: string;
  nodeName: string;
  sourceHandle?: string;
}

export interface NodeControllerAction {
  id: string;
  label: string;
  icon?: NodeControllerActionIcon;
  title?: string;
  connectedLabel?: string;
  disabled?: boolean;
  tone?: NodeControllerActionTone;
  state?: NodeControllerActionState;
  onClick?: () => void;
  onFocusConnection?: () => void;
  onDisconnectConnection?: () => void;
  onReplaceConnection?: () => void;
  /** 多输入句柄的已连接来源列表（P1-2） */
  connectedSources?: NodeControllerConnectedSource[];
  /** 单独断开某个来源（多输入场景） */
  onDisconnectSource?: (sourceNodeId: string) => void;
}

export interface NodeControllerSummaryItem {
  id: string;
  label: ReactNode;
  title?: string;
}

export interface NodeControllerDetailSection {
  id: string;
  label: string;
  actions: NodeControllerAction[];
}

const iconProps = { className: NC_ICON_CLASS, strokeWidth: NC_ICON_STROKE };

const ACTION_ICONS: Record<NodeControllerActionIcon, ReactNode> = {
  image: <ImageIcon {...iconProps} />,
  video: <Video {...iconProps} />,
  sparkles: <Sparkles {...iconProps} />,
  upscale: <Zap {...iconProps} />,
  panorama: <Orbit {...iconProps} />,
  multiAngle: <Layers {...iconProps} />,
  relight: <Sun {...iconProps} />,
  grid: <Grid3X3 {...iconProps} />,
  split: <Clapperboard {...iconProps} />,
  camera: <Palette {...iconProps} />,
  character: <Lightbulb {...iconProps} />,
  music: <Music {...iconProps} />,
  download: <Download {...iconProps} />,
  trash: <Trash2 {...iconProps} />,
  expand: <Maximize2 {...iconProps} />,
  send: <ArrowUp {...iconProps} />,
  upload: <Upload {...iconProps} />,
  save: <Save {...iconProps} />,
  analyze: <ScanSearch {...iconProps} />,
  subtitle: <Captions {...iconProps} />,
  reset: <RotateCcw {...iconProps} />,
  settings: <SlidersHorizontal {...iconProps} />,
  model3d: <Box {...iconProps} />,
  import: <FileUp {...iconProps} />,
  export: <FileDown {...iconProps} />,
};

function renderActionIcon(icon?: NodeControllerActionIcon) {
  return (
    <span className={nodeCtrl.iconBox}>
      {icon ? ACTION_ICONS[icon] : <Wand2 {...iconProps} />}
    </span>
  );
}

export function NodeControllerActionButton({ action }: { action: NodeControllerAction }) {
  const isConnected = action.state === 'connected';
  const hasMainAction = typeof action.onClick === 'function';
  const mainDisabled = action.disabled || !hasMainAction;
  const hasConnectionTools =
    isConnected &&
    (action.onFocusConnection || action.onDisconnectConnection || action.onReplaceConnection);
  const sourceCount = action.connectedSources?.length ?? 0;
  const hasMultiSources = sourceCount > 1 && typeof action.onDisconnectSource === 'function';

  return (
    <div
      className={cn(
        nodeCtrl.actionRoot,
        ncActionToneClass(action.tone),
        ncActionStateClass(action.state),
        mainDisabled && !hasConnectionTools && 'opacity-35',
        hasMultiSources && 'group/multi-source',
      )}
      title={
        action.connectedLabel
          ? `${action.title || action.label} · ${action.connectedLabel}`
          : action.title
      }
    >
      <button
        type="button"
        disabled={mainDisabled}
        onClick={(e) => {
          e.stopPropagation();
          action.onClick?.();
        }}
        className={nodeCtrl.actionMain}
      >
        {renderActionIcon(action.icon)}
        <span className="max-w-[68px] truncate">{action.label}</span>
        {isConnected ? <CheckCircle2 className={cn(NC_ICON_CLASS, 'shrink-0 text-white/72')} strokeWidth={NC_ICON_STROKE} /> : null}
        {hasMultiSources ? (
          <span
            className="ml-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-500/85 px-1 text-[9px] font-semibold text-black"
            title={`已连接 ${sourceCount} 个来源，悬停查看详情`}
          >
            {sourceCount}
          </span>
        ) : null}
      </button>
      {hasConnectionTools ? (
        <div className="flex h-full items-center border-l border-white/10">
          {action.onFocusConnection ? (
            <button
              type="button"
              className={nodeCtrl.actionTool}
              title={action.connectedLabel ? `聚焦：${action.connectedLabel}` : '聚焦关联节点'}
              onClick={(e) => {
                e.stopPropagation();
                action.onFocusConnection?.();
              }}
            >
              <LocateFixed {...iconProps} />
            </button>
          ) : null}
          {action.onReplaceConnection ? (
            <button
              type="button"
              className={nodeCtrl.actionTool}
              title={action.connectedLabel ? `替换：${action.connectedLabel}` : '替换关联节点'}
              onClick={(e) => {
                e.stopPropagation();
                action.onReplaceConnection?.();
              }}
            >
              <RefreshCw {...iconProps} />
            </button>
          ) : null}
          {action.onDisconnectConnection ? (
            <button
              type="button"
              className={nodeCtrl.actionToolDanger}
              title={action.connectedLabel ? `断开：${action.connectedLabel}` : '断开关联节点'}
              onClick={(e) => {
                e.stopPropagation();
                action.onDisconnectConnection?.();
              }}
            >
              <Unlink2 {...iconProps} />
            </button>
          ) : null}
        </div>
      ) : null}
      {hasMultiSources ? (
        <div className="pointer-events-none absolute right-0 top-full z-30 hidden min-w-[180px] flex-col gap-0.5 rounded-lg border border-white/10 bg-[#1a1a1e]/98 p-1.5 shadow-[0_12px_34px_rgba(0,0,0,0.52)] backdrop-blur-xl group-hover/multi-source:flex">
          <div className="px-1.5 pb-1 text-[9px] font-bold uppercase tracking-widest text-white/40">
            已连接 {sourceCount} 个来源
          </div>
          {action.connectedSources?.map((source) => (
            <div
              key={source.nodeId}
              className="flex items-center justify-between gap-1.5 rounded px-1.5 py-1 hover:bg-white/[0.06]"
            >
              <span className="truncate text-[10px] text-white/82" title={source.nodeName}>
                {source.nodeName}
              </span>
              <button
                type="button"
                className="pointer-events-auto shrink-0 rounded p-0.5 text-white/40 hover:bg-red-500/20 hover:text-red-300"
                title={`断开 ${source.nodeName}`}
                onClick={(e) => {
                  e.stopPropagation();
                  action.onDisconnectSource?.(source.nodeId);
                }}
              >
                <Unlink2 className="h-3 w-3" strokeWidth={NC_ICON_STROKE} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function NodeControllerActionLauncherList({ actions }: { actions: NodeControllerAction[] }) {
  if (actions.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      {actions.map((action) => {
        const isConnected = action.state === 'connected';
        const hasMainAction = typeof action.onClick === 'function';
        const mainDisabled = action.disabled || !hasMainAction;
        const hasConnectionTools =
          isConnected &&
          (action.onFocusConnection || action.onDisconnectConnection || action.onReplaceConnection);
        const activate = () => {
          if (!mainDisabled) action.onClick?.();
        };

        return (
          <div
            key={action.id}
            role={mainDisabled ? undefined : 'button'}
            data-controller-action-id={action.id}
            tabIndex={mainDisabled ? -1 : 0}
            className={cn(
              nodeCtrl.launcherRow,
              isConnected ? nodeCtrl.launcherRowConnected : !mainDisabled && nodeCtrl.launcherRowIdle,
              mainDisabled ? 'cursor-default opacity-42' : 'cursor-pointer',
            )}
            title={
              action.connectedLabel
                ? `${action.title || action.label} · ${action.connectedLabel}`
                : action.title || action.label
            }
            onMouseDownCapture={(e) => e.stopPropagation()}
            onPointerDownCapture={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              activate();
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              e.stopPropagation();
              activate();
            }}
          >
            <button
              type="button"
              disabled={mainDisabled}
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                activate();
              }}
              onMouseDownCapture={(e) => e.stopPropagation()}
              onPointerDownCapture={(e) => e.stopPropagation()}
              className={cn(
                'nodrag nowheel pointer-events-none relative z-10 inline-flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-1 text-left text-[12px] font-medium transition-colors disabled:cursor-default',
                mainDisabled ? 'text-white/42' : 'text-white/72 group-hover:text-white',
              )}
            >
              {renderActionIcon(action.icon)}
              <span className="min-w-0 flex-1 truncate">{action.label}</span>
              {isConnected ? <span className={nodeCtrl.connectedBadge}>已连接</span> : null}
            </button>
            {hasConnectionTools ? (
              <div className="flex h-8 shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                {action.onFocusConnection ? (
                  <button
                    type="button"
                    className={cn(nodeCtrl.actionTool, 'h-7 w-7 rounded-md')}
                    title={action.connectedLabel ? `聚焦：${action.connectedLabel}` : '聚焦关联节点'}
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onFocusConnection?.();
                    }}
                  >
                    <LocateFixed {...iconProps} />
                  </button>
                ) : null}
                {action.onReplaceConnection ? (
                  <button
                    type="button"
                    className={cn(nodeCtrl.actionTool, 'h-7 w-7 rounded-md')}
                    title={action.connectedLabel ? `替换：${action.connectedLabel}` : '替换关联节点'}
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onReplaceConnection?.();
                    }}
                  >
                    <RefreshCw {...iconProps} />
                  </button>
                ) : null}
                {action.onDisconnectConnection ? (
                  <button
                    type="button"
                    className={cn(nodeCtrl.actionToolDanger, 'h-7 w-7 rounded-md')}
                    title={action.connectedLabel ? `断开：${action.connectedLabel}` : '断开关联节点'}
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onDisconnectConnection?.();
                    }}
                  >
                    <Unlink2 {...iconProps} />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export const NodeControllerTryActions = memo(function NodeControllerTryActions({
  label = '尝试',
  actions,
  className,
}: {
  label?: string;
  actions: NodeControllerAction[];
  className?: string;
}) {
  if (actions.length === 0) return null;

  return (
    <div className={cn('nodrag nowheel flex flex-col gap-1.5', className)}>
      <div className={nodeCtrl.sectionLabel}>{label}：</div>
      <div className="flex flex-wrap gap-1.5">
        {actions.map((action) => (
          <NodeControllerActionButton key={action.id} action={action} />
        ))}
      </div>
    </div>
  );
});

export const NodeControllerResultToolbar = memo(function NodeControllerResultToolbar({
  actions,
  className,
}: {
  actions: NodeControllerAction[];
  className?: string;
}) {
  if (actions.length === 0) return null;

  return (
    <div
      className={cn(
        'nodrag nowheel flex flex-wrap items-center gap-1 rounded-xl border border-white/16 bg-[#101012] p-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.4)]',
        className,
      )}
    >
      {actions.map((action) => (
        <NodeControllerActionButton key={action.id} action={action} />
      ))}
    </div>
  );
});

export const NodeControllerDetailPanel = memo(function NodeControllerDetailPanel({
  title = '控制器',
  subtitle,
  sections,
  className,
}: {
  title?: string;
  subtitle?: ReactNode;
  sections: NodeControllerDetailSection[];
  className?: string;
}) {
  const activeSections = sections
    .map((section) => ({
      ...section,
      actions: section.actions.filter(Boolean),
    }))
    .filter((section) => section.actions.length > 0);
  const actions = activeSections.flatMap((section) => section.actions);
  const connectedCount = actions.filter((action) => action.state === 'connected').length;

  if (actions.length === 0) return null;

  return (
    <div className={cn('nodrag nowheel', nodeCtrl.panel, className)}>
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <div className={nodeCtrl.title}>{title}</div>
          {subtitle ? <div className={nodeCtrl.subtitle}>{subtitle}</div> : null}
        </div>
        <div className={nodeCtrl.chipAccent}>
          {connectedCount}/{actions.length}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {activeSections.map((section) => (
          <div key={section.id} className="min-w-0">
            <div className={cn('mb-1', nodeCtrl.sectionLabel)}>{section.label}</div>
            <div className="flex flex-col gap-1">
              {section.actions.map((action) => {
                const isConnected = action.state === 'connected';
                const hasMainAction = typeof action.onClick === 'function';
                const hasConnectionTools = Boolean(
                  action.onFocusConnection ||
                  action.onReplaceConnection ||
                  action.onDisconnectConnection,
                );
                const isUnavailable = action.disabled || (!hasMainAction && !hasConnectionTools);
                return (
                  <div
                    key={action.id}
                    className={cn(
                      'flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-colors',
                      isConnected
                        ? 'border-white/22 bg-white/[0.08] text-white'
                        : isUnavailable
                          ? 'border-white/8 bg-[#0a0a0a] text-white/30'
                          : 'border-white/14 bg-white/[0.035] text-white/58 hover:border-white/24 hover:bg-white/[0.06]',
                    )}
                    title={action.connectedLabel || action.title || action.label}
                  >
                    <span className="shrink-0 text-white/62">{renderActionIcon(action.icon)}</span>
                    <span className="min-w-0 flex-1 truncate">{action.label}</span>
                    <span
                      className={cn(
                        'shrink-0 rounded px-1 py-0.5 text-[9px]',
                        isConnected
                          ? nodeCtrl.connectedBadge
                          : isUnavailable
                            ? 'border border-white/6 bg-[#0c0e10] text-white/22'
                            : 'border border-white/10 bg-white/[0.02] text-white/38',
                      )}
                    >
                      {isConnected
                        ? action.connectedLabel || '已接入'
                        : isUnavailable
                          ? '不可用'
                          : '待接入'}
                    </span>
                    {action.onFocusConnection ? (
                      <button type="button" className={cn(nodeCtrl.actionTool, 'rounded p-1')} title={action.connectedLabel ? `聚焦：${action.connectedLabel}` : '聚焦关联节点'} onClick={(e) => { e.stopPropagation(); action.onFocusConnection?.(); }}>
                        <LocateFixed className="h-3 w-3" strokeWidth={NC_ICON_STROKE} />
                      </button>
                    ) : null}
                    {action.onReplaceConnection ? (
                      <button type="button" className={cn(nodeCtrl.actionTool, 'rounded p-1')} title={action.connectedLabel ? `替换：${action.connectedLabel}` : '替换关联节点'} onClick={(e) => { e.stopPropagation(); action.onReplaceConnection?.(); }}>
                        <RefreshCw className="h-3 w-3" strokeWidth={NC_ICON_STROKE} />
                      </button>
                    ) : null}
                    {action.onDisconnectConnection ? (
                      <button type="button" className={cn(nodeCtrl.actionToolDanger, 'rounded p-1')} title={action.connectedLabel ? `断开：${action.connectedLabel}` : '断开关联节点'} onClick={(e) => { e.stopPropagation(); action.onDisconnectConnection?.(); }}>
                        <Unlink2 className="h-3 w-3" strokeWidth={NC_ICON_STROKE} />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

export const NodeControllerSummaryBar = memo(function NodeControllerSummaryBar({
  items,
  points,
  className,
}: {
  items: NodeControllerSummaryItem[];
  points?: number | null;
  className?: string;
}) {
  if (items.length === 0 && points == null) return null;

  return (
    <div
      className={cn(
        'nodrag nowheel flex min-w-0 flex-wrap items-center gap-1.5 text-[10px] text-white/64',
        className,
      )}
    >
      {items.map((item, index) => (
        <span key={item.id} className="inline-flex min-w-0 items-center gap-1" title={item.title}>
          {index > 0 ? <span className="text-white/22">·</span> : null}
          <span className="max-w-[150px] truncate">{item.label}</span>
        </span>
      ))}
      {points != null ? (
        <span className={nodeCtrl.chipAccent}>
          <Zap className="h-3 w-3" strokeWidth={NC_ICON_STROKE} />
          {points}
        </span>
      ) : null}
    </div>
  );
});
