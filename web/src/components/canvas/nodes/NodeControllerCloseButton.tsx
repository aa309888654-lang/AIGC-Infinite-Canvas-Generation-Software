import { memo, type MouseEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { nodeCtrl } from './node-controller-tokens';

export interface NodeControllerCloseButtonProps {
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  title?: string;
  ariaLabel?: string;
  className?: string;
}

/** 节点右上角关闭按钮 — 与删除按钮共用同一套危险色 hover 视觉 */
function NodeControllerCloseButton({
  onClick,
  title = '关闭控制面板',
  ariaLabel = title,
  className,
}: NodeControllerCloseButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className={cn(nodeCtrl.iconBtn, nodeCtrl.iconBtnDanger, className)}
      title={title}
      aria-label={ariaLabel}
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}

export default memo(NodeControllerCloseButton);
