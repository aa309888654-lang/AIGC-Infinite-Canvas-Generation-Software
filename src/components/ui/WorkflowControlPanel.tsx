// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { X, PlayCircle as Play, Pause, RotateCcw, Save, DollarSign, TrendingUp, BarChart3, History, Settings } from 'lucide-react';
import { Node, Edge } from '@xyflow/react';

import { workflowCheckpointService, Checkpoint, WorkflowExecutionState } from '@/services/workflow-checkpoint-service';
import { costManagementSystem, CostEstimate, CostOptimizationSuggestion } from '@/services/cost-management-system';

interface WorkflowControlPanelProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node[];
  edges: Edge[];
  workflowId?: string;
}

const WorkflowControlPanel: React.FC<WorkflowControlPanelProps> = ({
  isOpen,
  onClose,
  nodes,
  edges,
  workflowId = 'default-workflow'
}) => {
  const [activeTab, setActiveTab] = useState<'control' | 'checkpoints' | 'cost' | 'history'>('control');
  const [executionState, setExecutionState] = useState<WorkflowExecutionState | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [, setSelectedCheckpoint] = useState<Checkpoint | null>(null);
  const [_costEstimate, _setCostEstimate] = useState<CostEstimate | null>(null);
  const [optimizationSuggestions, setOptimizationSuggestions] = useState<CostOptimizationSuggestion[]>([]);
  const [totalCost, setTotalCost] = useState(0);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, workflowId, loadData]);

  const loadData = useCallback(() => {
    const state = workflowCheckpointService.getExecutionState(workflowId);
    setExecutionState(state || null);

    const cps = workflowCheckpointService.getCheckpointsByWorkflow(workflowId);
    setCheckpoints(cps);

    const suggestions = costManagementSystem.getOptimizationSuggestions('default');
    setOptimizationSuggestions(suggestions);

    const userTotalCost = costManagementSystem.getTotalCost('default');
    setTotalCost(userTotalCost);
  }, [workflowId]);

  const createCheckpoint = useCallback(() => {
    const name = `检查点 ${new Date().toLocaleString('zh-CN')}`;
    const executedIds = executionState?.executedNodeIds || [];
    const currentId = executionState?.currentNodeId;
    const progress = executionState?.progress || 0;

    const checkpoint = workflowCheckpointService.createCheckpoint(
      workflowId,
      name,
      nodes,
      edges,
      executedIds,
      currentId,
      progress
    );

    setCheckpoints(prev => [checkpoint, ...prev]);
    setExecutionState(prev => prev ? { ...prev, lastCheckpointId: checkpoint.id } : null);
  }, [workflowId, nodes, edges, executionState]);

  const restoreCheckpoint = useCallback((checkpoint: Checkpoint) => {
    const restored = workflowCheckpointService.restoreFromCheckpoint(checkpoint.id);
    if (restored) {
      setSelectedCheckpoint(checkpoint);
    }
  }, []);

  const deleteCheckpoint = useCallback((checkpointId: string) => {
    workflowCheckpointService.deleteCheckpoint(checkpointId);
    setCheckpoints(prev => prev.filter(cp => cp.id !== checkpointId));
  }, []);

  const startExecution = useCallback(() => {
    const allNodeIds = nodes.map(n => n.id);
    const state = workflowCheckpointService.startWorkflowExecution(workflowId, allNodeIds);
    setExecutionState(state);
  }, [workflowId, nodes]);

  const pauseExecution = useCallback(() => {
    const state = workflowCheckpointService.pauseWorkflow(workflowId);
    if (state) {
      setExecutionState(state);
      createCheckpoint();
    }
  }, [workflowId, createCheckpoint]);

  const resumeExecution = useCallback(() => {
    const state = workflowCheckpointService.resumeWorkflow(workflowId);
    if (state) {
      setExecutionState(state);
    }
  }, [workflowId]);

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}小时 ${minutes % 60}分钟`;
    }
    if (minutes > 0) {
      return `${minutes}分钟 ${seconds % 60}秒`;
    }
    return `${seconds}秒`;
  };

  const getStatusColor = (status: WorkflowExecutionState['status']) => {
    switch (status) {
      case 'running': return 'text-green-400';
      case 'paused': return 'text-yellow-400';
      case 'completed': return 'text-gray-400';
      case 'failed': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusLabel = (status: WorkflowExecutionState['status']) => {
    switch (status) {
      case 'running': return '运行中';
      case 'paused': return '已暂停';
      case 'completed': return '已完成';
      case 'failed': return '失败';
      case 'interrupted': return '已中断';
      default: return '空闲';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[#1A1A1D] border border-[#2D2D2D] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#2D2D2D]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#007AFF] to-[#5856D6] flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">工作流控制面板</h2>
              <p className="text-xs text-gray-400">断点续传、成本管理、执行监控</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#2D2D2D] rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2D2D2D]">
          {[
            { id: 'control', label: '执行控制', icon: Play },
            { id: 'checkpoints', label: '检查点', icon: Save },
            { id: 'cost', label: '成本管理', icon: DollarSign },
            { id: 'history', label: '执行历史', icon: History }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-[#007AFF] text-white' : 'hover:bg-[#2D2D2D] text-gray-400'}`}
              >
                <Icon size={16} />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'control' && (
            <div className="space-y-6">
              <div className="bg-[#242428] rounded-xl p-4">
                <h3 className="font-medium text-white mb-4 flex items-center gap-2">
                  <Play size={18} />
                  执行状态
                </h3>

                {executionState ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-semibold ${getStatusColor(executionState.status)}`}>
                          {getStatusLabel(executionState.status)}
                        </span>
                        {executionState.progress > 0 && (
                          <span className="text-gray-400">
                            {executionState.progress.toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {executionState.status === 'idle' && (
                          <button
                            onClick={startExecution}
                            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                          >
                            <Play size={16} />
                            开始
                          </button>
                        )}
                        {executionState.status === 'running' && (
                          <>
                            <button
                              onClick={pauseExecution}
                              className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors"
                            >
                              <Pause size={16} />
                              暂停
                            </button>
                            <button
                              onClick={createCheckpoint}
                              className="flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                            >
                              <Save size={16} />
                              保存检查点
                            </button>
                          </>
                        )}
                        {executionState.status === 'paused' && (
                          <button
                            onClick={resumeExecution}
                            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                          >
                            <Play size={16} />
                            继续
                          </button>
                        )}
                      </div>
                    </div>

                    {executionState.progress > 0 && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm text-gray-400">
                          <span>进度</span>
                          <span>{executionState.progress.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-[#2D2D2D] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#007AFF] to-[#5856D6] transition-all"
                            style={{ width: `${executionState.progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-[#2D2D2D] rounded-lg p-3">
                        <div className="text-xs text-gray-400 mb-1">已执行节点</div>
                        <div className="text-xl font-bold text-white">{executionState.executedNodeIds.length}</div>
                      </div>
                      <div className="bg-[#2D2D2D] rounded-lg p-3">
                        <div className="text-xs text-gray-400 mb-1">待执行节点</div>
                        <div className="text-xl font-bold text-white">{executionState.pendingNodeIds.length}</div>
                      </div>
                      {executionState.startTime && (
                        <div className="bg-[#2D2D2D] rounded-lg p-3">
                          <div className="text-xs text-gray-400 mb-1">已运行时间</div>
                          <div className="text-xl font-bold text-white">
                            {formatDuration(Date.now() - executionState.startTime.getTime())}
                          </div>
                        </div>
                      )}
                      {workflowCheckpointService.estimateRemainingTime(workflowId) && (
                        <div className="bg-[#2D2D2D] rounded-lg p-3">
                          <div className="text-xs text-gray-400 mb-1">预计剩余时间</div>
                          <div className="text-xl font-bold text-white">
                            {formatDuration(workflowCheckpointService.estimateRemainingTime(workflowId)!)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Play className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 mb-4">工作流尚未开始执行</p>
                    <button
                      onClick={startExecution}
                      className="flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors mx-auto"
                    >
                      <Play size={20} />
                      开始执行
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'checkpoints' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-white flex items-center gap-2">
                  <Save size={18} />
                  检查点列表
                </h3>
                <button
                  onClick={createCheckpoint}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  <Save size={16} />
                  创建检查点
                </button>
              </div>

              {checkpoints.length > 0 ? (
                <div className="space-y-3">
                  {checkpoints.map(checkpoint => (
                    <div
                      key={checkpoint.id}
                      className="bg-[#242428] border border-[#2D2D2D] rounded-xl p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-white">{checkpoint.name}</h4>
                          <p className="text-sm text-gray-400">
                            {checkpoint.createdAt.toLocaleString('zh-CN')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">
                            {checkpoint.progress.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs text-gray-400">
                          已执行: {checkpoint.executedNodeIds.length} 节点
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => restoreCheckpoint(checkpoint)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-[#007AFF] hover:bg-[#007AFF]/80 text-white rounded-lg text-sm transition-colors"
                        >
                          <RotateCcw size={14} />
                          恢复
                        </button>
                        <button
                          onClick={() => deleteCheckpoint(checkpoint.id)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-colors"
                        >
                          <X size={14} />
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Save className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">暂无检查点</p>
                  <p className="text-gray-500 text-sm mt-2">执行过程中可以创建检查点以便后续恢复</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'cost' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#242428] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-5 h-5 text-green-400" />
                    <h4 className="text-sm text-gray-400">总花费</h4>
                  </div>
                  <div className="text-2xl font-bold text-green-400">
                    ${totalCost.toFixed(2)}
                  </div>
                </div>

                <div className="bg-[#242428] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-gray-400" />
                    <h4 className="text-sm text-gray-400">本月预算</h4>
                  </div>
                  <div className="text-2xl font-bold text-gray-400">
                    $0.00 / $100.00
                  </div>
                </div>

                <div className="bg-[#242428] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="w-5 h-5 text-purple-400" />
                    <h4 className="text-sm text-gray-400">任务数</h4>
                  </div>
                  <div className="text-2xl font-bold text-purple-400">
                    0
                  </div>
                </div>
              </div>

              {optimizationSuggestions.length > 0 && (
                <div className="bg-[#242428] rounded-xl p-4">
                  <h3 className="font-medium text-white mb-4 flex items-center gap-2">
                    <Settings size={18} />
                    成本优化建议
                  </h3>
                  <div className="space-y-3">
                    {optimizationSuggestions.map(suggestion => (
                      <div key={suggestion.id} className="bg-[#2D2D2D] rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium text-white">{suggestion.title}</h4>
                          <span className="text-green-400 text-sm">
                            可节省 ~${suggestion.estimatedSavings.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400">{suggestion.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <h3 className="font-medium text-white flex items-center gap-2">
                <History size={18} />
                执行历史
              </h3>

              {[...workflowCheckpointService.getActiveWorkflows(), ...workflowCheckpointService.getCompletedWorkflows()].length > 0 ? (
                <div className="space-y-3">
                  {[...workflowCheckpointService.getActiveWorkflows(), ...workflowCheckpointService.getCompletedWorkflows()].map(state => (
                    <div
                      key={state.workflowId}
                      className="bg-[#242428] border border-[#2D2D2D] rounded-xl p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-white">工作流 {state.workflowId}</h4>
                          <p className="text-sm text-gray-400">
                            {state.startTime?.toLocaleString('zh-CN')}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(state.status)} bg-current/10`}>
                          {getStatusLabel(state.status)}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-400">
                          进度: {state.progress.toFixed(1)}%
                        </span>
                        <span className="text-gray-400">
                          已执行: {state.executedNodeIds.length} 节点
                        </span>
                        {state.endTime && state.startTime && (
                          <span className="text-gray-400">
                            耗时: {formatDuration(state.endTime.getTime() - state.startTime.getTime())}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">暂无执行历史</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowControlPanel;
