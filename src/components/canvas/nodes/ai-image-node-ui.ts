import { cn } from '@/lib/utils';
import { NC_ICON_CLASS, NC_ICON_STROKE } from './node-controller-tokens';

export { NC_ICON_CLASS, NC_ICON_STROKE };

/** 仅节点外框 — 纯白描边 */
const AI_OUTER_BORDER = 'border border-white';

export const AI_IMG = {
  panel: `rounded-[14px] ${AI_OUTER_BORDER} bg-[#202124] shadow-[0_12px_28px_rgba(0,0,0,0.26)]`,
  popover: `rounded-[12px] ${AI_OUTER_BORDER} bg-[#222224] text-white shadow-[0_16px_40px_rgba(0,0,0,0.45)]`,
  preview: `rounded-[14px] ${AI_OUTER_BORDER} bg-[#101012]`,
  emptyBg: 'bg-[#101012]',
  previewSelected: 'border-white',
  previewIdle: 'border-white',
  promptBox:
    'relative overflow-hidden rounded-[10px] border border-white/5 bg-[#18191b] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors focus-within:border-white/10 focus-within:bg-[#1a1b1d]',
  promptArea:
    'nodrag nowheel block min-h-[58px] w-full resize-none rounded-[9px] !border-0 !bg-transparent px-2.5 pb-8 pt-2 text-[12px] leading-[1.55] text-white/88 outline-none placeholder:text-white/32 select-text focus:!border-0 focus:!shadow-none focus:!outline-none',
  subPanel: 'rounded-[10px] border border-white/12 bg-[#1c1c1e]',
  footerBar:
    'flex min-h-[38px] min-w-0 flex-wrap items-center justify-between gap-x-1.5 gap-y-1 border-t border-white/10 px-2 py-1.5 text-[11px] text-white/62',
  footerLeft: 'flex min-w-0 flex-1 flex-wrap items-center gap-1.5 overflow-hidden',
  footerRight: 'flex shrink-0 items-center gap-1.5',
  sectionLabel: 'text-[10px] font-medium text-white/38',
  hint: 'text-[11px] text-white/42',
  title: 'text-[12px] font-medium text-white/82',
  badge: 'inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/55',
  modelPicker:
    'relative flex h-7 max-w-[190px] shrink-0 items-center gap-1 overflow-hidden rounded-md border border-white/14 bg-black/20 pl-1 pr-1.5',
  progressCard:
    'flex min-w-[140px] flex-col gap-2 rounded-xl border border-white/18 bg-black/55 px-3 py-2 text-white/88 backdrop-blur-sm',
  emptyIcon: 'text-white/28',
  tryLabel: 'text-[12px] text-white/45',
} as const;

export function aiImgTryBtn(className?: string) {
  return cn(
    'inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-[12px] text-white/72 transition-colors hover:text-white',
    className,
  );
}

export function aiImgSquareBtn(active?: boolean, className?: string) {
  return cn(
    'flex h-[36px] w-[36px] flex-col items-center justify-center gap-0.5 rounded-[8px] border text-[9px] transition-colors',
    active
      ? 'border-cyan-300/45 bg-cyan-300/[0.08] text-cyan-100'
      : 'border-white/14 bg-white/[0.02] text-white/55 hover:border-white/24 hover:bg-white/[0.05] hover:text-white/82',
    className,
  );
}

export function aiImgChip(active?: boolean, className?: string) {
  return cn(
    'inline-flex h-5 items-center gap-1 rounded-md border px-1.5 text-[10px] transition-colors',
    active
      ? 'border-cyan-300/38 bg-cyan-300/[0.1] text-cyan-50'
      : 'border-transparent text-white/50 hover:border-white/12 hover:bg-white/[0.05] hover:text-white/75',
    className,
  );
}

export function aiImgActionBtn(disabled?: boolean, className?: string) {
  return cn(
    'flex items-center gap-1 rounded-md px-2 text-[11px] transition-colors',
    disabled
      ? 'cursor-not-allowed text-white/22'
      : 'text-white/58 hover:bg-white/[0.05] hover:text-white/88',
    className,
  );
}

export function aiImgToolbarBtn(active?: boolean, className?: string) {
  return cn(
    'flex h-7 shrink-0 items-center gap-1 rounded-md px-1 text-[10px] transition-colors',
    active ? 'text-white' : 'text-white/58 hover:text-white/85',
    className,
  );
}

export function aiImgIconBtn(active?: boolean, className?: string) {
  return cn(
    'flex h-7 w-7 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/[0.05] hover:text-white/82',
    active && 'bg-white/[0.06] text-white',
    className,
  );
}

export function aiImgGenerateBtn(enabled?: boolean, className?: string) {
  return cn(
    'flex h-7 items-center justify-center gap-1 rounded-lg px-3 text-[11px] font-semibold transition-all',
    enabled
      ? 'bg-[#FF8C00] text-white hover:bg-[#D2691E] active:scale-95 shadow-[0_0_10px_rgba(255,140,0,0.4)]'
      : 'cursor-not-allowed bg-white/18 text-white/28',
    className,
  );
}

export function aiImgOptionBtn(active?: boolean, className?: string) {
  return cn(
    'rounded-lg border border-white/18 text-[12px] transition-colors',
    active ? 'bg-white/[0.06] text-white' : 'text-white/55 hover:text-white/82',
    className,
  );
}
