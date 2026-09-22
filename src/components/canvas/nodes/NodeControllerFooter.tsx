import { memo, type ReactNode } from 'react';
import { Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { aicgGlass } from './aicg-node-glass';

/* ============================================================
 * 节点控制器底部工具栏
 * ------------------------------------------------------------
 * 模块化的节点底部工具栏,支持:
 *  - leading: 模型选择/参数 slot
 *  - actions: 中间操作按钮组(翻译、克隆等)
 *  - primary: 主操作按钮(生成/停止)
 *  - meta:    积分消耗 / 状态文本
 *  - children: 完全自定义内容(在底栏内额外布局)
 * ============================================================ */

export interface NodeControllerFooterProps {
  leading?: ReactNode;
  actions?: ReactNode;
  primary?: ReactNode;
  meta?: ReactNode;
  credits?: number | null;
  variant?: 'bar' | 'inline';
  className?: string;
  children?: ReactNode;
}

const NodeControllerFooter: React.FC<NodeControllerFooterProps> = ({
  leading,
  actions,
  primary,
  meta,
  credits,
  variant = 'bar',
  className,
  children,
}) => {
  if (variant === 'inline') {
    return (
      <div
        className={cn('nodrag nowheel mt-2 flex items-center gap-1.5', className)}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onWheelCapture={(e) => e.stopPropagation()}
      >
        {leading}
        {credits != null ? <NodeControllerCredit credits={credits} /> : null}
        <div className="flex-1" />
        {actions}
        {primary}
        {meta}
      </div>
    );
  }

  return (
    <div
      className={cn(aicgGlass.metaBar, 'nodrag nowheel mt-2', className)}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onWheelCapture={(e) => e.stopPropagation()}
    >
      <div className={aicgGlass.metaLeading}>
        {leading}
        {credits != null ? <NodeControllerCredit credits={credits} /> : null}
        {meta}
      </div>
      {(actions || primary) ? (
        <div className={aicgGlass.metaActions}>
          {actions}
          {primary}
        </div>
      ) : null}
      {children}
    </div>
  );
};

NodeControllerFooter.displayName = 'NodeControllerFooter';

/* ============================================================
 * 积分徽标
 * ============================================================ */

export interface NodeControllerCreditProps {
  credits: number;
  title?: string;
  className?: string;
}

export const NodeControllerCredit: React.FC<NodeControllerCreditProps> = memo(
  ({ credits, title = '本次生成消耗点数', className }) => (
    <span className={cn(aicgGlass.metaCredit, className)} title={title}>
      <Coins className="h-3 w-3 text-white/55" strokeWidth={2} />
      {credits}
    </span>
  ),
);
NodeControllerCredit.displayName = 'NodeControllerCredit';

/* ============================================================
 * 状态/错误提示条
 * ============================================================ */

export const NodeControllerStatusBar: React.FC<{ children: ReactNode }> = ({ children }) => (
  <div className={aicgGlass.statusBar}>{children}</div>
);

export const NodeControllerErrorBar: React.FC<{ children: ReactNode }> = ({ children }) => (
  <div className={aicgGlass.errorBar}>{children}</div>
);

export default NodeControllerFooter;
