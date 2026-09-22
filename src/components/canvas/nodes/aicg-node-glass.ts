import { cn } from '@/lib/utils';

/** 统一深色面板 — 白色边线区分层级 */
const glassBase =
  'border border-white/[0.04] bg-[#101012] rounded-[14px] shadow-[0_10px_34px_rgba(0,0,0,0.58)] transition-[box-shadow,transform,border-color,background-color] duration-200';

/** 单卡外壳（无上下分卡时使用） */
export function aicgGlassCard(selected?: boolean, className?: string) {
  return cn(
    'aicg-node-card overflow-hidden',
    glassBase,
    selected
      ? 'border-white/28 bg-[#151515] shadow-[0_14px_46px_rgba(0,0,0,0.66)]'
      : 'hover:border-white/22 hover:bg-[#15171a] hover:shadow-[0_12px_42px_rgba(0,0,0,0.62)]',
    className
  );
}

export const aicgGlass = {
  wrapper: 'aicg-node-wrapper relative flex flex-col outline-none select-none',
  stack: 'gap-2.5',
  preview: cn('aicg-glass-preview relative overflow-hidden', glassBase),
  control: cn('aicg-glass-control relative overflow-hidden', glassBase),
  card: cn('overflow-hidden', glassBase),
  dragStrip:
    'drag-handle flex cursor-grab items-center justify-between gap-2 border-b border-white/[0.04] px-2.5 py-1.5 active:cursor-grabbing',
  badge:
    'shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
  iconBtn:
    'flex h-6 w-6 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/75',
  section: 'rounded-[12px] border border-white/[0.12] bg-[#151515] p-2.5 space-y-2',
  input:
    'w-full rounded-[10px] border border-white/[0.12] bg-[#101012] px-2.5 py-2 text-[12px] text-white placeholder:text-white/30 outline-none transition-all focus:border-white/32 focus:bg-[#101012] nodrag nowheel',
  textarea:
    'w-full resize-none rounded-[10px] border-0 bg-transparent px-3.5 pb-1 pt-3 text-sm leading-relaxed text-white placeholder:text-white/30 outline-none nodrag nowheel',
  select:
    'w-full rounded-[10px] border border-white/[0.12] bg-[#101012] px-2.5 py-2 text-sm text-white outline-none transition-colors focus:border-white/32',
  toolbar: 'flex items-center justify-between gap-2 px-2.5 pb-2.5 pt-0.5',
  toolbarLeft: 'flex min-w-0 flex-1 flex-wrap items-center gap-1.5',
  toolbarRight: 'flex shrink-0 flex-wrap items-center justify-end gap-1',
  chip: 'inline-flex h-8 max-w-full items-center gap-1 rounded-lg border border-white/[0.12] bg-[#151515] px-2 py-1 text-[10px] text-white/78 transition-colors hover:border-white/24 hover:bg-[#1a1a1a] hover:text-white',
  chipActive: 'border-white/28 bg-white/[0.08] text-white',
  actionRow: 'flex flex-wrap items-center gap-1 border-t border-white/18 px-2.5 py-2',
  actionBtn:
    'flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.12] bg-[#151515] px-3 py-1.5 text-[11px] text-white/75 transition-colors hover:border-white/24 hover:bg-[#1a1a1a] hover:text-white',
  actionBtnPrimary:
    'flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/24 bg-white/[0.08] px-3 py-1.5 text-[11px] text-white transition-colors hover:border-white/34 hover:bg-white/[0.11]',
  sendBtn:
    'flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition-all hover:bg-white/15 disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/[0.03] disabled:text-white/20',
  credit: 'flex h-8 items-center gap-0.5 rounded-lg px-1.5 text-[11px] text-white/35',
  dropdown:
    'overflow-hidden rounded-xl border border-white/[0.14] bg-[#0d0d0d] shadow-[0_18px_46px_rgba(0,0,0,0.72)]',
  tryLabel: 'mb-1.5 text-[11px] text-white/45',
  tryItem:
    'inline-flex h-8 max-w-full items-center gap-1.5 rounded-lg border border-white/[0.12] bg-[#151515] px-2.5 text-left text-[10px] font-medium text-white/78 transition-colors hover:border-white/24 hover:bg-[#1a1a1a] hover:text-white',
  previewMedia: 'relative overflow-hidden bg-[#0a0a0c]',
  previewEmpty: 'flex flex-col items-center justify-center gap-2 text-white/35',
  metaRow: 'flex items-center justify-between gap-2 border-b border-white/[0.05] px-3 py-1.5',

  // ========== 文本节点控制器专用令牌 ==========
  /** 顶部 Tab 栏（生成/脚本）容器 */
  tabBar:
    'relative flex items-center gap-0.5 rounded-[10px] border border-white/[0.12] bg-[#101012] p-0.5',
  /** Tab 单项 */
  tabItem:
    'group relative flex flex-1 items-center justify-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-[11px] font-medium transition-all duration-200 text-white/45 hover:text-white/75',
  /** Tab 激活态（玻璃高亮） */
  tabItemActive:
    'border border-white/24 bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_2px_rgba(0,0,0,0.22)]',
  /** Tab 上的状态指示点 */
  tabDot:
    'inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]',

  /** 提示词输入容器：聚焦时上浮 + 描边 */
  promptContainer:
    'group/prompt relative rounded-[12px] border border-white/[0.12] bg-[#101012] transition-all duration-200 hover:border-white/24 focus-within:border-white/34 focus-within:bg-[#101012] focus-within:shadow-[0_0_0_2px_rgba(255,255,255,0.08)]',
  /** 提示词 textarea 自身（透明，背景交给容器） */
  promptTextarea:
    'nodrag nowheel block w-full resize-none rounded-[12px] border-0 bg-transparent px-3.5 py-2.5 text-[12.5px] leading-relaxed text-white placeholder:text-white/30 outline-none select-text',
  /** 字符计数（右下角悬浮） */
  promptCounter:
    'pointer-events-none absolute bottom-1 right-2 select-none text-[10px] tabular-nums text-white/30 transition-colors group-focus-within/prompt:text-white/45',

  /** Meta 工具条：模型选择 + 操作 + 生成按钮 */
  metaBar: 'flex items-center gap-1.5 rounded-[12px] border border-white/[0.12] bg-[#151515] p-1.5',
  /** Meta 工具条左侧（模型选择插槽） */
  metaLeading: 'flex min-w-0 flex-1 items-center gap-1',
  /** Meta 工具条右侧（操作按钮组） */
  metaActions: 'flex shrink-0 items-center gap-1',
  /** Meta 工具条图标按钮（翻译等） */
  metaIconBtn:
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-white/[0.12] bg-[#151515] text-white/70 transition-all duration-150 hover:border-white/24 hover:bg-[#1a1a1a] hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:border-white/[0.08] disabled:bg-[#13151a] disabled:opacity-45',
  /** Meta 工具条积分（消耗点数） */
  metaCredit:
    'flex h-8 items-center gap-0.5 rounded-[9px] border border-white/[0.1] bg-[#151515] px-2 text-[10.5px] text-white/50 tabular-nums',

  /** 主操作按钮（生成）：带光晕的渐变描边 */
  generateBtn:
    'group/btn relative flex h-8 items-center justify-center gap-1.5 overflow-hidden rounded-[10px] px-3 text-[11.5px] font-medium transition-all duration-200 active:scale-[0.97]',
  generateBtnIdle:
    'border border-white/24 bg-white/[0.1] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_12px_rgba(0,0,0,0.28)] hover:border-white/34 hover:bg-white/[0.14]',
  generateBtnLoading:
    'border border-white/24 bg-white/[0.1] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_12px_rgba(0,0,0,0.28)] cursor-wait',
  generateBtnDisabled:
    'border border-white/[0.06] bg-white/[0.04] text-white/30 shadow-none cursor-not-allowed',

  /** 错误提示条 */
  errorBar:
    'mt-2 flex items-start gap-1.5 rounded-[8px] border border-red-500/20 bg-red-500/[0.08] px-2.5 py-1.5 text-[11px] text-red-300/90',
  /** 状态提示条（处理中） */
  statusBar:
    'mt-2 flex items-center gap-1.5 rounded-[8px] border border-amber-500/20 bg-amber-500/[0.08] px-2.5 py-1.5 text-[11px] text-amber-200/90',

  /** 展开控制面板按钮（收起态时显示） — 与删除按钮同款危险色 hover 视觉 */
  expandBtn:
    'mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/[0.12] bg-[#151515] py-2 text-[11px] text-white/55 transition-all hover:border-white/24 hover:bg-[#1a1a1a] hover:text-white',

  // ========== 视频合成风格外框（VideoCompose 配色方案） ==========
  /** 视频合成风格外框（默认态）— 大圆角 + 深灰底 + 双层白色描边 + 强投影 */
  videoComposeFrame:
    'drag-handle relative cursor-grab overflow-hidden rounded-[22px] border border-white/[0.16] bg-[#101012] transition-all duration-200 shadow-[0_14px_46px_rgba(0,0,0,0.38)] active:cursor-grabbing',
  /** 视频合成风格外框（选中态）— 描边变亮 + 多层阴影环 */
  videoComposeFrameSelected:
    'drag-handle relative cursor-grab overflow-hidden rounded-[22px] border border-white/28 bg-[#151515] transition-all duration-200 shadow-[0_18px_54px_rgba(0,0,0,0.45)] active:cursor-grabbing',
  /** 视频合成风格内描边（双层效果中的内圈） */
  videoComposeInnerRing:
    'hidden',
} as const;
