import type { CSSProperties } from 'react';
import { getPortType, inferPortType, type PortType, type PortDirection } from '@/types/node-system';

/** 统一输入 / 输出句柄色（可见句柄） */
export const AICG_IO_INPUT_COLOR = '#4A90D9';
export const AICG_IO_OUTPUT_COLOR = '#F97316';

/** 端口类型 → 连线颜色（边线仍按类型区分） */
export const AICG_PORT_COLORS: Record<string, string> = {
  image: '#4A90D9',
  video: '#E74C3C',
  prompt: '#2ECC71',
  string: '#2ECC71',
  /** 剧本 / 分镜专用色 */
  script: '#F59E0B',
  scenes: '#8B5CF6',
  audio: '#9B59B6',
  model: '#F39C12',
  number: '#E67E22',
  boolean: '#1ABC9C',
};

export const AICG_PORT_LABELS: Record<string, string> = {
  image: '图片',
  video: '视频',
  prompt: '提示词',
  string: '文本',
  script: '剧本',
  scenes: '分镜',
  audio: '音频',
  model: '模型',
  number: '数值',
  boolean: '布尔',
};

export function resolvePortColor(portType: PortType | string | null | undefined): string {
  if (!portType) return '#8b8b95';
  return AICG_PORT_COLORS[portType] ?? '#8b8b95';
}

export function resolveHandlePortType(
  nodeType: string | undefined,
  handleId: string | undefined,
  direction: PortDirection,
): PortType | string | null {
  if (!handleId) return null;
  if (nodeType === 'script' || nodeType === 'aiGenText') {
    if (handleId === 'script') return 'script';
    if (handleId === 'scenes') return 'scenes';
  }
  if (nodeType) {
    const fromDef = getPortType(nodeType, handleId, direction);
    if (fromDef) return fromDef;
  }
  return inferPortType(handleId);
}

export function buildHandleVisualStyle(args: {
  portType: PortType | string | null;
  connected: boolean;
  flowing: boolean;
  direction: 'source' | 'target' | 'unified';
  ioRole?: 'input' | 'output';
}): CSSProperties {
  const color =
    args.ioRole === 'input'
      ? AICG_IO_INPUT_COLOR
      : args.ioRole === 'output'
        ? AICG_IO_OUTPUT_COLOR
        : resolvePortColor(args.portType);

  return {
    ['--aicg-port-color' as string]: color,
  };
}

/** 触发连线信号脉冲（写入 edge.data） */
export function withEdgeSignalPulse<T extends Record<string, unknown>>(
  data: T | undefined,
  flowing = true,
): T & { signalPulse: number; flowing: boolean } {
  return {
    ...(data || ({} as T)),
    signalPulse: Date.now(),
    flowing,
  };
}

export function withEdgeFlowOff<T extends Record<string, unknown>>(data: T | undefined): T & { flowing: boolean } {
  return {
    ...(data || ({} as T)),
    flowing: false,
  };
}
