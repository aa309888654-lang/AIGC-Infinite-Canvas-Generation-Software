import type { CSSProperties } from 'react';

/** AICG 句柄外径（px） */
export const AICG_HANDLE_SIZE = 34;

/** 句柄与节点边缘间距（px） */
export const AICG_HANDLE_NODE_GAP = 8;

/** 句柄半宽 */
export const AICG_HANDLE_OFFSET = AICG_HANDLE_SIZE / 2;

/** AICG 节点统一端口样式类 */
export const AICG_HANDLE_CLASS =
  'aicg-port-handle !z-[100] !h-[34px] !w-[34px] !rounded-full !border-2 !transition-all !duration-300';

/** 左侧输入 */
export const AICG_HANDLE_LEFT_STYLE = {
  left: 0,
  top: '50%',
} as const;

/** 右侧输出 */
export const AICG_HANDLE_RIGHT_STYLE = {
  right: 0,
  top: '50%',
} as const;

export function aicgHandleStyle(side: 'left' | 'right', override?: CSSProperties): CSSProperties {
  return {
    width: AICG_HANDLE_SIZE,
    height: AICG_HANDLE_SIZE,
    ...(side === 'left' ? AICG_HANDLE_LEFT_STYLE : AICG_HANDLE_RIGHT_STYLE),
    ...override,
  };
}
