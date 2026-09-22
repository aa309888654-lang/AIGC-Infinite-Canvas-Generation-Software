import { cn } from '@/lib/utils';

/** 节点控制器统一图标尺寸 */
export const NC_ICON_CLASS = 'h-3.5 w-3.5';
export const NC_ICON_STROKE = 2;

export type NcActionTone = 'default' | 'primary' | 'muted';
export type NcActionState = 'idle' | 'connected' | 'ready' | 'pending';
export type NcStatus = 'idle' | 'ready' | 'processing' | 'done' | 'error';

/** @deprecated 别名，保持与既有节点 API 兼容 */
export type NodeControllerActionTone = NcActionTone;
/** @deprecated 别名，保持与既有节点 API 兼容 */
export type NodeControllerActionState = NcActionState;

/** 节点控制器 — 面板 / 按钮 / 标签 / 状态 设计令牌 */
export const nodeCtrl = {
  panel:
    'rounded-xl border border-white/[0.14] bg-[#101012] p-2.5 text-[10px] text-white/70 shadow-[0_12px_32px_rgba(0,0,0,0.44)]',
  panelCompact: 'p-2',
  divider: 'border-white/12',

  sectionLabel:
    'truncate text-[9px] font-medium uppercase tracking-[0.14em] text-white/34',
  title: 'truncate text-[11px] font-semibold text-white/90',
  subtitle: 'mt-0.5 truncate text-[9px] text-white/42',

  chip:
    'inline-flex min-w-0 max-w-[150px] items-center rounded-md border border-white/14 bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-white/64',
  chipAccent:
    'inline-flex items-center gap-1 rounded-md border border-white/[0.14] bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-white/70',

  statusBase:
    'inline-flex shrink-0 items-center gap-1 rounded-lg border px-1.5 py-1 text-[9px] font-medium transition-colors',
  statusIdle: 'border-white/14 bg-white/[0.035] text-white/52',
  statusReady: 'border-white/18 bg-white/[0.045] text-white/82',
  statusProcessing: 'border-white/22 bg-white/[0.06] text-white',
  statusDone: 'border-white/18 bg-white/[0.045] text-white/82',
  statusError: 'border-red-500/22 bg-red-500/[0.08] text-red-200/90',

  actionRoot:
    'nc-action inline-flex h-7 items-center overflow-hidden rounded-lg border transition-all duration-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] active:scale-[0.98] focus-within:ring-1 focus-within:ring-emerald-500/30',
  actionMain:
    'inline-flex h-full min-w-0 items-center gap-1.5 px-2 text-[10px] font-medium transition-colors disabled:cursor-default disabled:text-white/30',
  actionTool:
    'inline-flex h-full w-6 items-center justify-center text-white/52 transition hover:bg-white/[0.06] hover:text-white/90',
  actionToolDanger:
    'inline-flex h-full w-6 items-center justify-center text-white/42 transition hover:bg-red-500/12 hover:text-red-300',

  iconBox: 'flex h-4 w-4 shrink-0 items-center justify-center text-current opacity-90',

  launcherRow:
    'nodrag nowheel nc-launcher group flex min-w-0 items-center gap-1 rounded-lg border border-transparent px-1 py-0.5 transition-all duration-150',
  launcherRowIdle: 'hover:bg-white/[0.04] hover:border-white/[0.06]',
  launcherRowConnected: 'bg-white/[0.055] border-white/[0.16]',

  iconBtn:
    'nodrag nowheel flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-white/48 transition-all duration-150 hover:border-white/18 hover:bg-white/[0.06] hover:text-white/88 active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/35',
  iconBtnDanger:
    'hover:border-red-500/26 hover:bg-red-500/12 hover:text-red-400',

  connectedBadge:
    'shrink-0 rounded border border-white/[0.14] bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-medium text-white/72',
} as const;

export function ncActionToneClass(tone: NcActionTone = 'default') {
  if (tone === 'primary') {
    return 'border-white/24 bg-white/[0.08] text-white hover:border-white/34 hover:bg-white/[0.12]';
  }
  if (tone === 'muted') {
    return 'border-white/10 bg-black/20 text-white/40 hover:border-white/20 hover:bg-white/[0.035] hover:text-white/66';
  }
  return 'border-white/16 bg-white/[0.04] text-white/72 hover:border-white/24 hover:bg-white/[0.065] hover:text-white';
}

export function ncActionStateClass(state: NcActionState = 'idle') {
  if (state === 'connected') {
    return 'border-white/26 bg-white/[0.08] text-white hover:bg-white/[0.12]';
  }
  if (state === 'ready') {
    return 'border-white/24 bg-white/[0.07] text-white hover:border-white/30 hover:bg-white/[0.1]';
  }
  if (state === 'pending') {
    return 'border-white/20 bg-white/[0.055] text-white/88 hover:bg-white/[0.08]';
  }
  return '';
}

export function ncStatusClass(status: NcStatus) {
  const map: Record<NcStatus, string> = {
    idle: nodeCtrl.statusIdle,
    ready: nodeCtrl.statusReady,
    processing: nodeCtrl.statusProcessing,
    done: nodeCtrl.statusDone,
    error: nodeCtrl.statusError,
  };
  return cn(nodeCtrl.statusBase, map[status]);
}
