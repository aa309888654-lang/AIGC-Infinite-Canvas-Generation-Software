import React, { useState, useEffect, useCallback } from 'react';
import { X, PlayCircle as Play, Pause, StepForward, SkipForward, RotateCcw, StopCircle, Bug, Code2, Layers, Clock, Trash2, Settings, CheckCircle2, AlertCircle, Activity } from 'lucide-react';
import { Breakpoint, DebugState } from '@/types/workflow-debugger';
import { workflowDebuggerService } from '@/services/workflow-debugger-service';
import { useCanvasStore } from '@/store/useCanvasStore';
import { cn } from '@/lib/utils';

interface WorkflowDebuggerPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const WorkflowDebuggerPanel: React.FC<WorkflowDebuggerPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const [debugState, setDebugState] = useState<DebugState>({
    isPaused: false,
    currentNodeId: null,
    pausedAt: null,
    callStack: [],
    variables: {},
    executionHistory: [],
  });
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([]);
  const [activeTab, setActiveTab] = useState<'breakpoints' | 'callstack' | 'variables' | 'history'>('breakpoints');
  const [selectedBreakpointCondition, setSelectedBreakpointCondition] = useState<string>('');
  const [editingBreakpointId, setEditingBreakpointId] = useState<string | null>(null);

  const { nodes } = useCanvasStore();

  useEffect(() => {
    if (isOpen) {
      const unsubscribeState = workflowDebuggerService.subscribeToDebugState((state) => {
        setDebugState(state);
      });

      const unsubscribeBreakpoints = workflowDebuggerService.subscribeToBreakpoints((bps) => {
        setBreakpoints(bps);
      });

      return () => {
        unsubscribeState();
        unsubscribeBreakpoints();
      };
    }
  }, [isOpen]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatJSON = (value: unknown): string => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  const getNodeLabel = (nodeId: string): string => {
    const node = nodes.find(n => n.id === nodeId);
    return String(node?.data?.label || node?.data?.type || nodeId);
  };

  const handleToggleBreakpoint = useCallback((nodeId: string) => {
    workflowDebuggerService.toggleBreakpoint(nodeId);
  }, []);

  const handleRemoveBreakpoint = useCallback((nodeId: string) => {
    workflowDebuggerService.removeBreakpoint(nodeId);
  }, []);

  const handleClearAllBreakpoints = useCallback(() => {
    if (confirm('确定要清除所有断点吗？')) {
      workflowDebuggerService.clearAllBreakpoints();
    }
  }, []);

  const handleSaveBreakpointCondition = useCallback(() => {
    if (editingBreakpointId && selectedBreakpointCondition) {
      workflowDebuggerService.updateBreakpointCondition(
        editingBreakpointId,
        selectedBreakpointCondition
      );
    }
    setEditingBreakpointId(null);
    setSelectedBreakpointCondition('');
  }, [editingBreakpointId, selectedBreakpointCondition]);

  const handleContinue = useCallback(() => {
    workflowDebuggerService.continue();
  }, []);

  const handleStepOver = useCallback(() => {
    workflowDebuggerService.stepOver();
  }, []);

  const handleStepInto = useCallback(() => {
    workflowDebuggerService.stepInto();
  }, []);

  const handleStepOut = useCallback(() => {
    workflowDebuggerService.stepOut();
  }, []);

  const handleReset = useCallback(() => {
    workflowDebuggerService.resetDebugState();
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-4xl h-[85vh] bg-[#1A1A1D] border border-[#2D2D2D] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2D2D2D]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-[#FF6B00] to-[#CC5500] rounded-xl">
              <Bug className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">工作流调试器</h2>
              <p className="text-xs text-gray-400">
                {debugState.isPaused ? (
                  <span className="text-yellow-400 flex items-center gap-1">
                    <Pause className="w-3 h-3" /> 已暂停
                  </span>
                ) : (
                  <span className="text-green-400 flex items-center gap-1">
                    <Play className="w-3 h-3" /> 就绪
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="p-2 hover:bg-[#2D2D2D] rounded-lg text-gray-400 hover:text-white transition-colors"
              title="重置调试状态"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#2D2D2D] rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 border-b border-[#2D2D2D] bg-[#1F1F23]">
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleStepOut}
              disabled={!debugState.isPaused}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#2D2D2D] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="跳出"
            >
              <SkipForward className="w-5 h-5" />
            </button>
            <button
              onClick={handleStepInto}
              disabled={!debugState.isPaused}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#2D2D2D] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="单步进入"
            >
              <StepForward className="w-5 h-5" />
            </button>
            <button
              onClick={handleStepOver}
              disabled={!debugState.isPaused}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#2D2D2D] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="单步跳过"
            >
              <StepForward className="w-5 h-5 rotate-180" />
            </button>
            {debugState.isPaused ? (
              <button
                onClick={handleContinue}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <Play className="w-4 h-4" />
                <span className="text-sm font-medium">继续</span>
              </button>
            ) : (
              <button
                disabled
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-gray-400 rounded-lg cursor-not-allowed"
              >
                <Pause className="w-4 h-4" />
                <span className="text-sm font-medium">等待断点</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="停止调试"
            >
              <StopCircle className="w-5 h-5" />
            </button>
          </div>

          {debugState.currentNodeId && (
            <div className="mt-4 p-3 bg-[#2A2A30] rounded-lg border border-[#3D3D45]">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Clock className="w-4 h-4" />
                <span>当前节点：</span>
                <span className="text-white font-medium">
                  {getNodeLabel(debugState.currentNodeId)}
                </span>
                <span className="text-gray-500 text-xs">
                  ({debugState.currentNodeId.slice(0, 8)}...)
                </span>
              </div>
              {debugState.pausedAt && (
                <div className="mt-1 text-xs text-gray-500">
                  暂停时间：{formatDate(debugState.pausedAt)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex border-b border-[#2D2D2D]">
          <button
            onClick={() => setActiveTab('breakpoints')}
            className={cn(
              'flex-1 px-6 py-3 text-sm font-medium transition-colors relative flex items-center justify-center gap-2',
              activeTab === 'breakpoints'
                ? 'text-[#FF6B00]'
                : 'text-gray-400 hover:text-white'
            )}
          >
            <Code2 className="w-4 h-4" />
            断点 ({breakpoints.length})
            {activeTab === 'breakpoints' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6B00]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('callstack')}
            className={cn(
              'flex-1 px-6 py-3 text-sm font-medium transition-colors relative flex items-center justify-center gap-2',
              activeTab === 'callstack'
                ? 'text-[#FF6B00]'
                : 'text-gray-400 hover:text-white'
            )}
          >
            <Layers className="w-4 h-4" />
            调用栈 ({debugState.callStack.length})
            {activeTab === 'callstack' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6B00]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('variables')}
            className={cn(
              'flex-1 px-6 py-3 text-sm font-medium transition-colors relative flex items-center justify-center gap-2',
              activeTab === 'variables'
                ? 'text-[#FF6B00]'
                : 'text-gray-400 hover:text-white'
            )}
          >
            <Settings className="w-4 h-4" />
            变量
            {activeTab === 'variables' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6B00]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              'flex-1 px-6 py-3 text-sm font-medium transition-colors relative flex items-center justify-center gap-2',
              activeTab === 'history'
                ? 'text-[#FF6B00]'
                : 'text-gray-400 hover:text-white'
            )}
          >
            <Activity className="w-4 h-4" />
            执行历史 ({debugState.executionHistory.length})
            {activeTab === 'history' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6B00]" />
            )}
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'breakpoints' && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-400">所有断点</span>
              {breakpoints.length > 0 && (
                <button
                  onClick={handleClearAllBreakpoints}
                  className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 py-1 rounded transition-colors"
                >
                  清除全部
                </button>
              )}
            </div>
            {breakpoints.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
              <Code2 className="w-12 h-12 text-gray-600 mb-3" />
              <p className="text-sm text-gray-500">暂无断点</p>
              <p className="text-xs text-gray-600 mt-1">点击节点设置断点</p>
            </div>
            ) : (
              <div className="space-y-2">
                {breakpoints.map((bp) => (
                  <div
                    key={bp.id}
                    className={cn(
                    'p-3 rounded-lg border transition-all',
                    bp.enabled
                      ? 'bg-[#222227] border-[#2D2D2D]'
                      : 'bg-[#222227]/50 border-[#2D2D2D]/50 opacity-60'
                  )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1">
                        <button
                          onClick={() => handleToggleBreakpoint(bp.nodeId)}
                          className={cn(
                            'w-5 h-5 rounded border-2 rounded-full flex items-center justify-center transition-colors',
                            bp.enabled
                              ? 'bg-[#FF6B00] border-[#FF6B00]'
                              : 'border-gray-600 hover:border-gray-500'
                          )}
                        >
                          {bp.enabled && <div className="w-2 h-2 bg-white rounded-full" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {getNodeLabel(bp.nodeId)}
                          </p>
                          <p className="text-xs text-gray-500">
                            命中 {bp.hitCount} 次 · {formatDate(bp.createdAt)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveBreakpoint(bp.nodeId)}
                        className="p-1 hover:bg-red-500/10 rounded text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {editingBreakpointId === bp.id ? (
                      <div className="mt-3 space-y-2">
                        <input
                          type="text"
                          value={selectedBreakpointCondition}
                          onChange={(e) => setSelectedBreakpointCondition(e.target.value)}
                          placeholder="条件表达式 (例如: prompt.length > 100)"
                          className="w-full px-3 py-2 bg-[#2D2D2D] border border-[#3D3D45] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FF6B00]"
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingBreakpointId(null);
                              setSelectedBreakpointCondition('');
                            }}
                            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                          >
                            取消
                          </button>
                          <button
                            onClick={handleSaveBreakpointCondition}
                            className="px-3 py-1.5 text-sm bg-[#FF6B00] text-white rounded-lg hover:bg-[#CC5500] transition-colors"
                          >
                            保存
                          </button>
                        </div>
                      </div>
                    ) : (
                      bp.condition && (
                        <div className="mt-2 p-2 bg-[#2D2D2D] rounded">
                          <p className="text-xs text-gray-400">条件: {bp.condition}</p>
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {activeTab === 'callstack' && (
            <div className="flex-1 overflow-y-auto p-4">
              {debugState.callStack.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <Layers className="w-12 h-12 text-gray-600 mb-3" />
                  <p className="text-sm text-gray-500">暂无调用栈</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {debugState.callStack.map((frame, index) => (
                    <div
                      key={frame.id}
                      className="p-3 bg-[#222227] border border-[#2D2D2D] rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-[#FF6B00]/20 flex items-center justify-center">
                          <span className="text-[#FF6B00] text-xs font-medium">
                            {debugState.callStack.length - index}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">
                            {getNodeLabel(frame.nodeId)}
                          </p>
                          <p className="text-xs text-gray-500">{formatDate(frame.timestamp)}</p>
                        </div>
                      </div>
                      <div className="mt-2">
                        <p className="text-xs text-gray-400 mb-1">输入:</p>
                        <pre className="text-xs text-gray-300 bg-[#2D2D2D] p-2 rounded overflow-x-auto">
                          {formatJSON(frame.inputs)}
                        </pre>
                        {frame.outputs && (
                          <>
                            <p className="text-xs text-gray-400 mb-1 mt-2">输出:</p>
                            <pre className="text-xs text-green-400 bg-[#2D2D2D] p-2 rounded overflow-x-auto">
                              {formatJSON(frame.outputs)}
                            </pre>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'variables' && (
            <div className="flex-1 overflow-y-auto p-4">
              {Object.keys(debugState.variables).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <Settings className="w-12 h-12 text-gray-600 mb-3" />
                  <p className="text-sm text-gray-500">暂无变量</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(debugState.variables).map(([key, value]) => (
                  <div
                    key={key}
                    className="p-3 bg-[#222227] border border-[#2D2D2D] rounded-lg"
                  >
                    <p className="text-sm font-medium text-[#FF6B00]">{key}</p>
                    <pre className="mt-1 text-xs text-gray-300 bg-[#2D2D2D] p-2 rounded overflow-x-auto">
                      {formatJSON(value)}
                    </pre>
                  </div>
                ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="flex-1 overflow-y-auto p-4">
              {debugState.executionHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <Activity className="w-12 h-12 text-gray-600 mb-3" />
                  <p className="text-sm text-gray-500">暂无执行历史</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {debugState.executionHistory.map((step) => (
                    <div
                      key={step.id}
                      className="p-3 bg-[#222227] border border-[#2D2D2D] rounded-lg"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {step.status === 'completed' ? (
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                          ) : step.status === 'failed' ? (
                            <AlertCircle className="w-4 h-4 text-red-400" />
                          ) : (
                            <Activity className="w-4 h-4 text-yellow-400" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-white">
                              {getNodeLabel(step.nodeId)}
                            </p>
                            <p className="text-xs text-gray-500">{formatDate(step.timestamp)}</p>
                          </div>
                        </div>
                        <span className={cn(
                          'text-xs px-2 py-1 rounded',
                          step.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                          step.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                          'bg-yellow-500/10 text-yellow-400'
                        )}>
                          {step.status === 'completed' ? '完成' :
                           step.status === 'failed' ? '失败' : '执行中'}
                        </span>
                      </div>
                      {step.error && (
                        <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded">
                          <p className="text-xs text-red-400">{step.error}</p>
                        </div>
                      )}
                      <div className="mt-2">
                        <p className="text-xs text-gray-400 mb-1">输入:</p>
                        <pre className="text-xs text-gray-300 bg-[#2D2D2D] p-2 rounded overflow-x-auto">
                          {formatJSON(step.inputs)}
                        </pre>
                        {step.outputs && (
                          <>
                            <p className="text-xs text-gray-400 mb-1 mt-2">输出:</p>
                            <pre className="text-xs text-green-400 bg-[#2D2D2D] p-2 rounded overflow-x-auto">
                              {formatJSON(step.outputs)}
                            </pre>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowDebuggerPanel;
