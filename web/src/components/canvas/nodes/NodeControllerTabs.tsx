import { memo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { aicgGlass } from './aicg-node-glass';

/* ============================================================
 * 节点控制器标签栏 — 分段玻璃控件
 * ============================================================ */

export interface NodeControllerTabItem<T extends string = string> {
  id: T;
  label: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
  title?: string;
}

export interface NodeControllerTabsProps<T extends string = string> {
  items: NodeControllerTabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
}

function NodeControllerTabsInner<T extends string = string>({
  items,
  active,
  onChange,
  className,
  size = 'sm',
  fullWidth = true,
}: NodeControllerTabsProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        aicgGlass.tabBar,
        size === 'md' && 'p-1',
        className,
      )}
    >
      {items.map((it) => {
        const isActive = it.id === active;
        return (
          <button
            key={it.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-disabled={it.disabled}
            disabled={it.disabled}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (it.disabled) return;
              onChange(it.id);
            }}
            title={it.title}
            className={cn(
              aicgGlass.tabItem,
              'nodrag nowheel',
              size === 'md' && 'px-3 py-2 text-[12px]',
              isActive && aicgGlass.tabItemActive,
              it.disabled && 'cursor-not-allowed opacity-40 hover:text-white/45',
              !fullWidth && 'flex-none',
            )}
          >
            {it.icon ? (
              <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-current opacity-85 transition-opacity group-hover:opacity-100">
                {it.icon}
              </span>
            ) : null}
            <span>{it.label}</span>
            {it.badge ? <span className="ml-0.5">{it.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

const NodeControllerTabs = memo(NodeControllerTabsInner) as typeof NodeControllerTabsInner;
(Object.assign(NodeControllerTabs, { displayName: 'NodeControllerTabs' }));

export default NodeControllerTabs;
