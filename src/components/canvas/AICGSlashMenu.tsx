import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { AICGSlashCommand } from '@/services/aicg-slash-commands';

interface AICGSlashMenuProps {
  commands: AICGSlashCommand[];
  onSelect: (cmd: AICGSlashCommand) => void;
  className?: string;
}

/** AICG 风格 / 指令下拉菜单 */
function AICGSlashMenu({ commands, onSelect, className }: AICGSlashMenuProps) {
  if (commands.length === 0) return null;

  return (
    <div
      className={cn(
        'nodrag nowheel nopan z-[9999] max-h-[220px] min-w-[200px] overflow-y-auto rounded-xl',
        'border border-white/10 bg-[#0d0d0d] shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl',
        className,
      )}
      data-aicg-slash-menu
    >
      <div className="border-b border-white/[0.06] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-white/35">
        AICG · / 指令
      </div>
      {commands.map((cmd) => (
        <button
          key={cmd.id}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSelect(cmd);
          }}
          className="flex w-full flex-col gap-0.5 border-b border-white/[0.04] px-3 py-2 text-left last:border-0 hover:bg-white/[0.06]"
        >
          <span className="text-[11px] font-medium text-white/90">
            <span className="text-sky-400/90">{cmd.slash}</span>
            <span className="mx-1.5 text-white/20">·</span>
            {cmd.label}
          </span>
          {cmd.description && (
            <span className="text-[9px] text-white/40">{cmd.description}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export default memo(AICGSlashMenu);
