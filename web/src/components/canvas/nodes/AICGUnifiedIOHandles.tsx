import { memo } from 'react';
import { Position } from '@xyflow/react';
import HandleWithTip from './HandleWithTip';
import QuickAddSourceHandle from './QuickAddSourceHandle';
import QuickAddTargetHandle from './QuickAddTargetHandle';
import {
  AICG_HANDLE_CLASS,
  AICG_HANDLE_LEFT_STYLE,
  AICG_HANDLE_RIGHT_STYLE,
} from './aicg-node-handles';
import { cn } from '@/lib/utils';

const MERGED_TOP = '50%';

export interface AICGUnifiedIOHandlesProps {
  nodeId: string;
  nodeType: string;
  /** 主输入句柄 id（可见） */
  inputId?: string;
  /** 主输出句柄 id（可见） */
  outputId?: string;
  inputTip?: string;
  outputTip?: string;
  /** 叠在同一位置的额外输入（隐藏，兼容多端口连线） */
  extraInputs?: string[];
  /** 叠在同一位置的额外输出（隐藏） */
  extraOutputs?: string[];
  /** 无输入句柄的节点（如角色库） */
  hideInput?: boolean;
  /** 无输出句柄的节点 */
  hideOutput?: boolean;
  /** 输出侧使用快速新建菜单 */
  outputQuickAdd?: boolean;
  menuTop?: string | number;
}

/** 节点左右各一个可见句柄：输入蓝 / 输出橙，8px 间距由 CSS 控制 */
function AICGUnifiedIOHandles({
  nodeId,
  nodeType,
  inputId = 'input',
  outputId = 'output',
  inputTip = '输入',
  outputTip = '输出',
  extraInputs = [],
  extraOutputs = [],
  hideInput = false,
  hideOutput = false,
  outputQuickAdd = true,
  menuTop = '50%',
}: AICGUnifiedIOHandlesProps) {
  const leftStyle = { ...AICG_HANDLE_LEFT_STYLE, top: MERGED_TOP };
  const rightStyle = { ...AICG_HANDLE_RIGHT_STYLE, top: MERGED_TOP };

  return (
    <>
      {!hideInput ? (
        <>
          <QuickAddTargetHandle
            nodeId={nodeId}
            nodeType={nodeType}
            handleId={inputId}
            className={cn(AICG_HANDLE_CLASS, 'aicg-io-handle-in')}
            style={leftStyle}
            tip={inputTip}
            menuTop={menuTop}
          />
          {extraInputs.map((hid) => (
            <HandleWithTip
              key={hid}
              type="target"
              position={Position.Left}
              id={hid}
              nodeType={nodeType}
              className="aicg-handle-hit-only"
              style={leftStyle}
            />
          ))}
        </>
      ) : null}

      {!hideOutput ? (
        <>
          {outputQuickAdd ? (
            <QuickAddSourceHandle
              nodeId={nodeId}
              nodeType={nodeType}
              handleId={outputId}
              className={cn(AICG_HANDLE_CLASS, 'aicg-io-handle-out')}
              style={rightStyle}
              tip={outputTip}
              menuTop={menuTop}
            />
          ) : (
            <HandleWithTip
              type="source"
              position={Position.Right}
              id={outputId}
              nodeType={nodeType}
              className={cn(AICG_HANDLE_CLASS, 'aicg-io-handle-out')}
              style={rightStyle}
              tip={outputTip}
            />
          )}
          {extraOutputs.map((hid) => (
            <HandleWithTip
              key={hid}
              type="source"
              position={Position.Right}
              id={hid}
              nodeType={nodeType}
              className="aicg-handle-hit-only"
              style={rightStyle}
              tip={hid}
            />
          ))}
        </>
      ) : null}
    </>
  );
}

export default memo(AICGUnifiedIOHandles);
