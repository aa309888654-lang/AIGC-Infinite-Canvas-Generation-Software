import { memo } from 'react';
import type { HandleQuickAddOption } from '@/services/node-handle-adjacency';

interface HandleQuickAddMenuProps {
  options: HandleQuickAddOption[];
  menuTop?: string | number;
  align: 'left' | 'right';
  title?: string;
  onSelect: (option: HandleQuickAddOption, index: number) => void;
}

function HandleQuickAddMenu({
  options,
  menuTop = '50%',
  align,
  title = '快速新建并连接',
  onSelect,
}: HandleQuickAddMenuProps) {
  const posClass =
    align === 'right'
      ? 'absolute right-[-188px] -translate-y-1/2'
      : 'absolute left-[-188px] -translate-y-1/2';

  return (
    <div
      data-node-handle-quick-menu
      className={`${posClass} z-[9999] min-w-[172px] rounded-xl border border-white/10 bg-[#101012] py-1.5 shadow-2xl backdrop-blur-xl`}
      style={{ top: menuTop }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="mb-1 border-b border-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40">
        {title}
      </div>
      {options.map((opt, i) => (
        <button
          key={`${opt.nodeType}-${i}`}
          type="button"
          className="nodrag flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-white/[0.08]"
          onClick={() => onSelect(opt, i)}
        >
          <span className="text-[11px] text-white">{opt.label}</span>
          {opt.description && <span className="text-[9px] text-white/40">{opt.description}</span>}
          {opt.workflowTag && opt.workflowTag !== '—' && (
            <span className="text-[8px] text-white/35">AICG · {opt.workflowTag}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export default memo(HandleQuickAddMenu);
