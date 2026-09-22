import { memo, useMemo, type MouseEvent, type ReactNode } from 'react';
import { CheckCircle2, CircleDashed, Loader2, Route, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import NodeControllerCloseButton from './NodeControllerCloseButton';
import {
  NodeControllerActionLauncherList,
  NodeControllerActionButton,
  NodeControllerSummaryBar,
  type NodeControllerAction,
  type NodeControllerSummaryItem,
} from './NodeControllerCapabilityPanel';
import {
  NC_ICON_CLASS,
  NC_ICON_STROKE,
  nodeCtrl,
  ncStatusClass,
  type NcStatus,
} from './node-controller-tokens';

export type NodeControllerV2Status = NcStatus;

export interface NodeControllerV2Section {
  id: string;
  label: string;
  actions: NodeControllerAction[];
}

export interface NodeControllerV2PanelProps {
  title: string;
  subtitle?: ReactNode;
  status?: NodeControllerV2Status;
  statusLabel?: string;
  sections: NodeControllerV2Section[];
  summary?: NodeControllerSummaryItem[];
  points?: number | null;
  inputSlot?: ReactNode;
  modelSlot?: ReactNode;
  footerSlot?: ReactNode;
  onClose?: (event: MouseEvent<HTMLButtonElement>) => void;
  closeTitle?: string;
  actionLayout?: 'buttons' | 'launcher-list';
  compact?: boolean;
  className?: string;
  allowNodeDrag?: boolean;
}

const STATUS_META: Record<NodeControllerV2Status, { label: string; icon: ReactNode }> = {
  idle: { label: '待配置', icon: <CircleDashed className={NC_ICON_CLASS} strokeWidth={NC_ICON_STROKE} /> },
  ready: { label: '可执行', icon: <Zap className={NC_ICON_CLASS} strokeWidth={NC_ICON_STROKE} /> },
  processing: { label: '生成中', icon: <Loader2 className={cn(NC_ICON_CLASS, 'animate-spin')} strokeWidth={NC_ICON_STROKE} /> },
  done: { label: '有结果', icon: <CheckCircle2 className={NC_ICON_CLASS} strokeWidth={NC_ICON_STROKE} /> },
  error: { label: '异常', icon: <CircleDashed className={NC_ICON_CLASS} strokeWidth={NC_ICON_STROKE} /> },
};

function NodeControllerV2Panel({
  title,
  subtitle,
  status = 'idle',
  statusLabel,
  sections,
  summary = [],
  points,
  inputSlot,
  modelSlot,
  footerSlot,
  onClose,
  closeTitle = '关闭控制面板',
  actionLayout = 'buttons',
  compact = false,
  className,
  allowNodeDrag = false,
}: NodeControllerV2PanelProps) {
  const activeSections = useMemo(
    () => sections
      .map((section) => ({ ...section, actions: section.actions.filter(Boolean) }))
      .filter((section) => section.actions.length > 0),
    [sections],
  );
  const activeSummary = useMemo(() => summary.filter(Boolean), [summary]);
  const meta = STATUS_META[status] ?? STATUS_META.idle;

  return (
    <div
      className={cn(
        allowNodeDrag ? 'drag-handle cursor-grab active:cursor-grabbing' : 'nodrag nowheel',
        nodeCtrl.panel,
        compact && nodeCtrl.panelCompact,
        className,
      )}
      data-testid="node-controller-v2-panel"
      onMouseDown={allowNodeDrag ? undefined : (event) => event.stopPropagation()}
      onPointerDown={allowNodeDrag ? undefined : (event) => event.stopPropagation()}
      onWheelCapture={(event) => event.stopPropagation()}
    >
      <div className={cn('mb-2 flex min-w-0 items-start justify-between gap-2 border-b pb-2', nodeCtrl.divider)}>
        <div className="min-w-0">
          <div className={nodeCtrl.title}>{title}</div>
          {subtitle ? <div className={nodeCtrl.subtitle}>{subtitle}</div> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <div className={ncStatusClass(status)}>
            {meta.icon}
            <span>{statusLabel || meta.label}</span>
          </div>
          {onClose ? (
            <NodeControllerCloseButton
              onClick={onClose}
              title={closeTitle}
              ariaLabel={closeTitle}
              className="h-6 w-6"
            />
          ) : null}
        </div>
      </div>

      {activeSummary.length > 0 || points != null ? (
        <div className={cn('mb-2 border-b pb-2', nodeCtrl.divider)}>
          <NodeControllerSummaryBar className="min-w-0" items={activeSummary} points={points} />
        </div>
      ) : null}
      {inputSlot ? <div className={cn('mb-2 border-b pb-2', nodeCtrl.divider)}>{inputSlot}</div> : null}
      {modelSlot ? <div className={cn('mb-2 border-b pb-2', nodeCtrl.divider)}>{modelSlot}</div> : null}

      {activeSections.length > 0 ? (
        <div className="flex flex-col gap-2">
          {activeSections.map((section) => {
            // 统计当前 section 内已连接的动作数，避免显示全局统计导致数字错误
            const sectionConnected = section.actions.filter((a) => a.state === 'connected').length;
            return (
            <div key={section.id} className="min-w-0">
              <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
                <span className={nodeCtrl.sectionLabel}>{section.label}</span>
                {section.id === 'result' || section.id === 'downstream' ? (
                  <span className={nodeCtrl.chipAccent}>
                    <Route className="h-3 w-3" strokeWidth={NC_ICON_STROKE} />
                    {sectionConnected}/{section.actions.length}
                  </span>
                ) : null}
              </div>
              {actionLayout === 'launcher-list' ? (
                <NodeControllerActionLauncherList actions={section.actions} />
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {section.actions.map((action) => (
                    <NodeControllerActionButton key={action.id} action={action} />
                  ))}
                </div>
              )}
            </div>
            );
          })}
        </div>
      ) : null}

      {footerSlot ? <div className={cn('mt-2 border-t pt-2', nodeCtrl.divider)}>{footerSlot}</div> : null}
    </div>
  );
}

export default memo(NodeControllerV2Panel);
