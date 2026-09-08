import React, { memo } from 'react';
import { AlignLeft, AlignCenter, AlignRight, AlignStartVertical, AlignCenterVertical, AlignEndVertical, ArrowRight, ArrowDown, GitBranch, Grid3x3, Circle} from 'lucide-react';
import { NodeTypeDefinition } from '@/types/node-system';
import { AutoLayoutType } from '@/hooks/useAutoLayout';

interface ContextMenuProps {
  x: number;
  y: number;
  nodeId?: string;
  selectedNodeIds: string[];
  onJumpToNode: (nodeId: string) => void;
  onDuplicateNodes: () => void;
  onDeleteNodes: () => void;
  onSelectAllNodes: () => void;
  onAddNode: (nodeType: NodeTypeDefinition) => void;
  onAlignNodes: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onAutoLayout: (type: AutoLayoutType) => void;
  onFitView: () => void;
  onClearSelection: () => void;
  onAddFrame: () => void;
  onClearFrames: () => void;
  onClose: () => void;
  onGroupNodes?: () => void;
  onExecuteGroup?: () => void;
  onOpenToolbox?: () => void;
}

const addNodeTypes: NodeTypeDefinition[] = [
  {
    id: 'aiImage',
    name: 'AI图片',
    category: 'image',
    description: '统一 AI 图片生成入口',
    icon: 'Image',
    color: '#8B5CF6',
    inputPorts: [],
    outputPorts: [],
    defaultParams: { modelId: 'sensenova-u1-fast', modelProvider: 'sensenova', generationMode: 'text_to_image' },
  },
  {
    id: 'aiVideo',
    name: 'AI视频',
    category: 'video',
    description: '统一 AI 视频生成入口',
    icon: 'Video',
    color: '#E91E63',
    inputPorts: [],
    outputPorts: [],
    defaultParams: {
      modelId: 'viduq3-turbo',
      modelProvider: 'vidu',
      provider: 'vidu',
      generationMode: 'text_to_video',
      aspectRatio: '16:9',
      resolution: '720p',
      duration: 4,
    },
  },
  {
    id: 'prompt',
    name: '提示词',
    category: 'input',
    description: '输入提示词',
    icon: 'MessageSquare',
    color: '#00D4AA',
    inputPorts: [],
    outputPorts: [],
    defaultParams: {},
  },
];

const FlowContextMenuComponent: React.FC<ContextMenuProps> = ({
  x,
  y,
  nodeId,
  selectedNodeIds,
  onJumpToNode,
  onDuplicateNodes,
  onDeleteNodes,
  onSelectAllNodes,
  onAddNode,
  onAlignNodes,
  onAutoLayout,
  onFitView,
  onClearSelection,
  onAddFrame,
  onClearFrames,
  onClose,
  onGroupNodes,
  onExecuteGroup,
  onOpenToolbox,
}) => {
  return (
    <div
      className="fixed z-50 bg-[#1F1F1F] border border-white/10 rounded-lg shadow-2xl py-1 min-w-36"
      style={{ left: x, top: y }}
    >
      {nodeId ? (
        <>
          <button
            onClick={() => { onJumpToNode(nodeId); onClose(); }}
            className="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/5"
          >
            跳转到节点
          </button>
          <button
            onClick={() => { onDuplicateNodes(); onClose(); }}
            className="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/5"
          >
            复制节点
          </button>
          <button
            onClick={() => { onDeleteNodes(); onClose(); }}
            className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-white/5"
          >
            删除节点
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => { onSelectAllNodes(); onClose(); }}
            className="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/5"
          >
            全选节点
          </button>

          <div className="border-t border-white/10 my-1" />
          <div className="px-3 py-1 text-xs text-gray-400">添加节点</div>
          {addNodeTypes.map(nodeType => (
            <button
              key={nodeType.id}
              onClick={() => { onAddNode(nodeType); onClose(); }}
              className="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/5"
            >
              {nodeType.name}节点
            </button>
          ))}

          {selectedNodeIds.length >= 2 && onGroupNodes && (
            <>
              <div className="border-t border-white/10 my-1" />
              <div className="px-3 py-1 text-xs text-violet-300/80">AICG 编组</div>
              <button
                onClick={() => { onGroupNodes(); onClose(); }}
                className="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-violet-500/10"
              >
                打组 (Ctrl+G)
              </button>
              {onExecuteGroup && (
                <button
                  onClick={() => { onExecuteGroup(); onClose(); }}
                  className="w-full px-3 py-1.5 text-left text-xs text-emerald-300 hover:bg-emerald-500/10"
                >
                  整组执行 (Ctrl+Shift+Enter)
                </button>
              )}
              {onOpenToolbox && (
                <button
                  onClick={() => { onOpenToolbox(); onClose(); }}
                  className="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/5"
                >
                  保存到工具箱
                </button>
              )}
            </>
          )}

          {selectedNodeIds.length > 1 && (
            <>
              <div className="border-t border-white/10 my-1" />
              <div className="px-3 py-1 text-xs text-gray-400">对齐工具</div>
              <div className="flex gap-1 px-2 pb-2">
                <button onClick={() => { onAlignNodes('left'); onClose(); }} className="flex-1 flex items-center justify-center p-2 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors" title="左对齐">
                  <AlignLeft className="w-4 h-4" />
                </button>
                <button onClick={() => { onAlignNodes('center'); onClose(); }} className="flex-1 flex items-center justify-center p-2 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors" title="水平居中对齐">
                  <AlignCenter className="w-4 h-4" />
                </button>
                <button onClick={() => { onAlignNodes('right'); onClose(); }} className="flex-1 flex items-center justify-center p-2 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors" title="右对齐">
                  <AlignRight className="w-4 h-4" />
                </button>
                <button onClick={() => { onAlignNodes('top'); onClose(); }} className="flex-1 flex items-center justify-center p-2 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors" title="顶对齐">
                  <AlignStartVertical className="w-4 h-4" />
                </button>
                <button onClick={() => { onAlignNodes('middle'); onClose(); }} className="flex-1 flex items-center justify-center p-2 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors" title="垂直居中对齐">
                  <AlignCenterVertical className="w-4 h-4" />
                </button>
                <button onClick={() => { onAlignNodes('bottom'); onClose(); }} className="flex-1 flex items-center justify-center p-2 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors" title="底对齐">
                  <AlignEndVertical className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          <button
            onClick={() => { onFitView(); onClose(); }}
            className="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/5"
          >
            适应视图
          </button>

          <div className="border-t border-white/10 my-1" />
          <div className="px-3 py-1 text-xs text-gray-400">自动布局</div>
          <div className="flex gap-1 px-2 pb-1">
            <button
              onClick={() => { onAutoLayout('horizontal'); onClose(); }}
              className="flex-1 flex flex-col items-center justify-center p-2 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="水平布局 (从左到右)"
            >
              <ArrowRight className="w-4 h-4 mb-1" />
              <span className="text-[10px]">水平</span>
            </button>
            <button
              onClick={() => { onAutoLayout('vertical'); onClose(); }}
              className="flex-1 flex flex-col items-center justify-center p-2 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="垂直布局 (从上到下)"
            >
              <ArrowDown className="w-4 h-4 mb-1" />
              <span className="text-[10px]">垂直</span>
            </button>
            <button
              onClick={() => { onAutoLayout('force'); onClose(); }}
              className="flex-1 flex flex-col items-center justify-center p-2 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="力导向布局"
            >
              <GitBranch className="w-4 h-4 mb-1" />
              <span className="text-[10px]">力导向</span>
            </button>
          </div>
          <div className="px-3 py-1 text-xs text-gray-400">智能整理</div>
          <div className="flex gap-1 px-2 pb-1">
            <button
              onClick={() => { onAutoLayout('flow-smart'); onClose(); }}
              className="flex-1 flex flex-col items-center justify-center p-2 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="按连线层级排列"
            >
              <GitBranch className="w-4 h-4 mb-1" />
              <span className="text-[10px]">连线层级</span>
            </button>
            <button
              onClick={() => { onAutoLayout('type-zones'); onClose(); }}
              className="flex-1 flex flex-col items-center justify-center p-2 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="按节点类型分区"
            >
              <Grid3x3 className="w-4 h-4 mb-1" />
              <span className="text-[10px]">类型分区</span>
            </button>
          </div>
          <div className="px-3 py-1 text-xs text-gray-400">布局间距</div>
          <div className="flex gap-1 px-2 pb-1">
            <button
              onClick={() => { onAutoLayout('compact'); onClose(); }}
              className="flex-1 flex flex-col items-center justify-center p-2 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="紧凑排列"
            >
              <AlignLeft className="w-4 h-4 mb-1" />
              <span className="text-[10px]">紧凑</span>
            </button>
            <button
              onClick={() => { onAutoLayout('standard'); onClose(); }}
              className="flex-1 flex flex-col items-center justify-center p-2 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="标准排列"
            >
              <ArrowRight className="w-4 h-4 mb-1" />
              <span className="text-[10px]">标准</span>
            </button>
            <button
              onClick={() => { onAutoLayout('relaxed'); onClose(); }}
              className="flex-1 flex flex-col items-center justify-center p-2 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="宽松排列"
            >
              <ArrowDown className="w-4 h-4 mb-1" />
              <span className="text-[10px]">宽松</span>
            </button>
          </div>
          <div className="px-3 py-1 text-xs text-gray-400">等间距布局</div>
          <div className="flex gap-1 px-2 pb-2">
            <button
              onClick={() => { onAutoLayout('equal-h'); onClose(); }}
              className="flex-1 flex flex-col items-center justify-center p-2 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="水平等间距"
            >
              <AlignLeft className="w-4 h-4 mb-1" />
              <span className="text-[10px]">水平等距</span>
            </button>
            <button
              onClick={() => { onAutoLayout('equal-v'); onClose(); }}
              className="flex-1 flex flex-col items-center justify-center p-2 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="垂直等间距"
            >
              <AlignStartVertical className="w-4 h-4 mb-1" />
              <span className="text-[10px]">垂直等距</span>
            </button>
            <button
              onClick={() => { onAutoLayout('grid'); onClose(); }}
              className="flex-1 flex flex-col items-center justify-center p-2 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="网格等距布局"
            >
              <Grid3x3 className="w-4 h-4 mb-1" />
              <span className="text-[10px]">网格</span>
            </button>
            <button
              onClick={() => { onAutoLayout('circular'); onClose(); }}
              className="flex-1 flex flex-col items-center justify-center p-2 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="环形布局"
            >
              <Circle className="w-4 h-4 mb-1" />
              <span className="text-[10px]">环形</span>
            </button>
          </div>

          <button
            onClick={() => { onClearSelection(); onClose(); }}
            className="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/5"
          >
            取消选择
          </button>

          <div className="border-t border-white/10 my-1" />
          <div className="px-3 py-1 text-xs text-gray-400">场景</div>
          <button
            onClick={() => { onAddFrame(); onClose(); }}
            className="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/5"
          >
            添加场景分区
          </button>
          <button
            onClick={() => { onClearFrames(); onClose(); }}
            className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-white/5"
          >
            清除所有分区
          </button>
        </>
      )}
    </div>
  );
};

const FlowContextMenu = memo(FlowContextMenuComponent);
export default FlowContextMenu;
