import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Image as ImageIcon } from 'lucide-react';
import type { CompactSelectOptionGroup } from '@/core/node-model-matcher';
import { getModelIconConfig } from '@/config/model-icons';

interface NodeModelSelectProps {
  value: string;
  groupedOptions: CompactSelectOptionGroup[];
  onChange: (modelId: string) => void;
  disabled?: boolean;
  className?: string;
}

type ModelOption = CompactSelectOptionGroup['options'][number] & {
  provider?: string;
  description?: string;
  badge?: string;
};

function getOptionIcon(option?: ModelOption | null) {
  const source = `${option?.provider || ''} ${String(option?.value || '')} ${option?.label || ''}`.toLowerCase();
  if (source.includes('doubao') || source.includes('seedream')) return getModelIconConfig('doubao-seedream-5-0-lite');
  if (source.includes('minimax')) return getModelIconConfig('image-01');
  if (source.includes('agnes')) return getModelIconConfig('agnes-image-2.1-flash');
  return getModelIconConfig(String(option?.value || ''));
}

function ModelIcon({ option }: { option?: ModelOption | null }) {
  const iconConfig = getOptionIcon(option);
  const [failed, setFailed] = useState(false);
  const glyph = String(option?.label || option?.value || 'M').slice(0, 1).toUpperCase();

  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-md text-[9px] font-bold"
      style={{ backgroundColor: iconConfig.bgColor, color: iconConfig.color }}
    >
      {iconConfig.icon && !failed ? (
        <img src={iconConfig.icon} alt="" draggable={false} className="h-3.5 w-3.5 object-contain" onError={() => setFailed(true)} />
      ) : (
        <>
          <ImageIcon className="absolute h-5 w-5 opacity-10" />
          <span className="relative">{glyph}</span>
        </>
      )}
    </span>
  );
}

const NodeModelSelect: React.FC<NodeModelSelectProps> = ({
  value,
  groupedOptions,
  onChange,
  disabled = false,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => groupedOptions.flatMap((group) => group.options as ModelOption[]).find((option) => String(option.value) === String(value)),
    [groupedOptions, value],
  );

  return (
    <div className={cn('relative min-w-[132px] max-w-full flex-1', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((next) => !next);
        }}
        onMouseDown={(event) => event.stopPropagation()}
        className="flex h-8 w-full items-center gap-2 rounded-lg border border-white/22 bg-[#151515] pl-2 pr-7 text-left text-[11px] text-white outline-none transition-all hover:border-white/35 focus:border-white/55 focus:bg-[#181818] disabled:cursor-not-allowed disabled:opacity-45"
      >
        <ModelIcon option={selected} />
        <span className="min-w-0 flex-1 truncate">{selected?.label || value}</span>
      </button>
      <ChevronDown className={cn('pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-white/75 transition-transform', open && 'rotate-180')} />
      {open && !disabled ? (
        <div
          className="nodrag nowheel absolute left-0 top-[calc(100%+6px)] z-[140] w-full min-w-[240px] overflow-hidden rounded-xl border border-white/12 bg-[#0d0d0d] p-1.5 shadow-[0_18px_44px_rgba(0,0,0,0.42)]"
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
            {groupedOptions.map((group) => (
              <div key={group.label} className="py-1">
                <div className="mb-1 px-1.5 text-[9px] font-semibold uppercase text-white/35">{group.label}</div>
                <div className="space-y-1">
                  {(group.options as ModelOption[]).map((option) => {
                    const active = String(option.value) === String(value);
                    return (
                      <button
                        key={`${option.provider || group.label}-${String(option.value)}`}
                        type="button"
                        className={cn(
                          'flex w-full min-w-0 items-center gap-2 rounded-md px-1.5 text-left transition-colors',
                          option.description ? 'h-auto py-1' : 'h-8',
                          active ? 'bg-white/[0.08] text-white' : 'text-white/68 hover:bg-white/[0.06] hover:text-white',
                        )}
                        onClick={() => {
                          onChange(String(option.value));
                          setOpen(false);
                        }}
                        title={option.description ? `${option.label} · ${option.description}` : option.label}
                      >
                        <ModelIcon option={option} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] font-medium">{option.label}</span>
                          {option.description ? (
                            <span className="block truncate text-[9px] leading-tight text-white/35">
                              {option.description}
                            </span>
                          ) : null}
                        </span>
                        {option.badge && option.badge !== '未配置' ? (
                          <span className="shrink-0 rounded bg-white/[0.07] px-1 py-0.5 text-[9px] text-white/42">
                            {option.badge}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default React.memo(NodeModelSelect);
