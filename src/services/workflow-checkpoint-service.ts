import { logger } from '@/lib/logger';
import { Node, Edge } from '@xyflow/react';

export interface Checkpoint {
  id: string;
  workflowId: string;
  name: string;
  createdAt: Date;
  nodes: Node[];
  edges: Edge[];
  executedNodeIds: string[];
  currentNodeId?: string;
  progress: number;
  status: 'in_progress' | 'paused' | 'interrupted';
  metadata?: Record<string, unknown>;
  estimatedRemainingTime?: number;
}

export interface WorkflowExecutionState {
  workflowId: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'interrupted';
  currentNodeId?: string;
  executedNodeIds: string[];
  pendingNodeIds: string[];
  progress: number;
  startTime?: Date;
  endTime?: Date;
  lastCheckpointId?: string;
  totalCost?: number;
  estimatedRemainingCost?: number;
}

class WorkflowCheckpointService {
  private static instance: WorkflowCheckpointService;
  private checkpoints: Map<string, Checkpoint> = new Map();
  private executionStates: Map<string, WorkflowExecutionState> = new Map();
  private readonly CHECKPOINTS_KEY = 'workflow-checkpoints';
  private readonly EXECUTION_STATES_KEY = 'workflow-execution-states';
  private readonly MAX_CHECKPOINTS_PER_WORKFLOW = 10;

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): WorkflowCheckpointService {
    if (!WorkflowCheckpointService.instance) {
      WorkflowCheckpointService.instance = new WorkflowCheckpointService();
    }
    return WorkflowCheckpointService.instance;
  }

  public createCheckpoint(
    workflowId: string,
    name: string,
    nodes: Node[],
    edges: Edge[],
    executedNodeIds: string[],
    currentNodeId?: string,
    progress: number = 0,
    metadata?: Record<string, unknown>
  ): Checkpoint {
    const id = this.generateId();
    const checkpoint: Checkpoint = {
      id,
      workflowId,
      name,
      createdAt: new Date(),
      nodes,
      edges,
      executedNodeIds,
      currentNodeId,
      progress,
      status: 'in_progress',
      metadata
    };

    this.checkpoints.set(id, checkpoint);
    this.cleanOldCheckpoints(workflowId);
    this.saveToStorage();

    logger.info(`创建检查点: ${name} - 进度: ${progress.toFixed(1)}%`);
    return checkpoint;
  }

  public getCheckpoint(id: string): Checkpoint | undefined {
    return this.checkpoints.get(id);
  }

  public getCheckpointsByWorkflow(workflowId: string): Checkpoint[] {
    return Array.from(this.checkpoints.values())
      .filter(cp => cp.workflowId === workflowId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public getLatestCheckpoint(workflowId: string): Checkpoint | undefined {
    const checkpoints = this.getCheckpointsByWorkflow(workflowId);
    return checkpoints.length > 0 ? checkpoints[0] : undefined;
  }

  public restoreFromCheckpoint(checkpointId: string): {
    nodes: Node[];
    edges: Edge[];
    executedNodeIds: string[];
    currentNodeId?: string;
  } | null {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      logger.warn(`检查点不存在: ${checkpointId}`);
      return null;
    }

    logger.info(`从检查点恢复: ${checkpoint.name}`);
    return {
      nodes: checkpoint.nodes,
      edges: checkpoint.edges,
      executedNodeIds: checkpoint.executedNodeIds,
      currentNodeId: checkpoint.currentNodeId
    };
  }

  public deleteCheckpoint(id: string): boolean {
    const success = this.checkpoints.delete(id);
    if (success) {
      this.saveToStorage();
      logger.info(`删除检查点: ${id}`);
    }
    return success;
  }

  public deleteCheckpointsByWorkflow(workflowId: string): number {
    const checkpointsToDelete = Array.from(this.checkpoints.entries())
      .filter(([, cp]) => cp.workflowId === workflowId);

    checkpointsToDelete.forEach(([id]) => this.checkpoints.delete(id));
    this.saveToStorage();

    logger.info(`删除工作流 ${workflowId} 的 ${checkpointsToDelete.length} 个检查点`);
    return checkpointsToDelete.length;
  }

  public startWorkflowExecution(
    workflowId: string,
    allNodeIds: string[]
  ): WorkflowExecutionState {
    const state: WorkflowExecutionState = {
      workflowId,
      status: 'running',
      executedNodeIds: [],
      pendingNodeIds: [...allNodeIds],
      progress: 0,
      startTime: new Date()
    };

    this.executionStates.set(workflowId, state);
    this.saveToStorage();

    logger.info(`开始工作流执行: ${workflowId}`);
    return state;
  }

  public updateWorkflowExecution(
    workflowId: string,
    updates: Partial<Omit<WorkflowExecutionState, 'workflowId' | 'startTime'>>
  ): WorkflowExecutionState | undefined {
    const state = this.executionStates.get(workflowId);
    if (!state) return undefined;

    const updatedState: WorkflowExecutionState = {
      ...state,
      ...updates
    };

    this.executionStates.set(workflowId, updatedState);
    this.saveToStorage();

    return updatedState;
  }

  public pauseWorkflow(workflowId: string): WorkflowExecutionState | undefined {
    const state = this.executionStates.get(workflowId);
    if (!state || state.status !== 'running') return undefined;

    const updatedState = this.updateWorkflowExecution(workflowId, {
      status: 'paused'
    });

    logger.info(`暂停工作流: ${workflowId}`);
    return updatedState;
  }

  public resumeWorkflow(workflowId: string): WorkflowExecutionState | undefined {
    const state = this.executionStates.get(workflowId);
    if (!state || state.status !== 'paused') return undefined;

    const updatedState = this.updateWorkflowExecution(workflowId, {
      status: 'running'
    });

    logger.info(`恢复工作流: ${workflowId}`);
    return updatedState;
  }

  public completeWorkflow(workflowId: string): WorkflowExecutionState | undefined {
    const state = this.executionStates.get(workflowId);
    if (!state) return undefined;

    const updatedState = this.updateWorkflowExecution(workflowId, {
      status: 'completed',
      progress: 100,
      endTime: new Date(),
      pendingNodeIds: [],
      executedNodeIds: [...state.executedNodeIds, ...state.pendingNodeIds]
    });

    logger.info(`完成工作流: ${workflowId}`);
    return updatedState;
  }

  public failWorkflow(workflowId: string, error?: string): WorkflowExecutionState | undefined {
    const state = this.executionStates.get(workflowId);
    if (!state) return undefined;

    const updatedState = this.updateWorkflowExecution(workflowId, {
      status: 'failed',
      endTime: new Date()
    });

    logger.error(`工作流失败: ${workflowId} - ${error || '未知错误'}`);
    return updatedState;
  }

  public markNodeExecuted(workflowId: string, nodeId: string): WorkflowExecutionState | undefined {
    const state = this.executionStates.get(workflowId);
    if (!state) return undefined;

    const newExecutedNodeIds = [...state.executedNodeIds, nodeId];
    const newPendingNodeIds = state.pendingNodeIds.filter(id => id !== nodeId);
    const totalNodes = newExecutedNodeIds.length + newPendingNodeIds.length;
    const progress = totalNodes > 0 ? (newExecutedNodeIds.length / totalNodes) * 100 : 0;

    return this.updateWorkflowExecution(workflowId, {
      executedNodeIds: newExecutedNodeIds,
      pendingNodeIds: newPendingNodeIds,
      progress,
      currentNodeId: newPendingNodeIds[0]
    });
  }

  public getExecutionState(workflowId: string): WorkflowExecutionState | undefined {
    return this.executionStates.get(workflowId);
  }

  public getActiveWorkflows(): WorkflowExecutionState[] {
    return Array.from(this.executionStates.values())
      .filter(state => ['running', 'paused', 'interrupted'].includes(state.status))
      .sort((a, b) => (a.startTime?.getTime() || 0) - (b.startTime?.getTime() || 0));
  }

  public getCompletedWorkflows(): WorkflowExecutionState[] {
    return Array.from(this.executionStates.values())
      .filter(state => state.status === 'completed')
      .sort((a, b) => (b.endTime?.getTime() || 0) - (a.endTime?.getTime() || 0));
  }

  public estimateRemainingTime(workflowId: string): number | undefined {
    const state = this.executionStates.get(workflowId);
    if (!state || !state.startTime) return undefined;

    const elapsed = Date.now() - state.startTime.getTime();
    const progress = state.progress / 100;

    if (progress <= 0) return undefined;

    return Math.max(0, (elapsed / progress) - elapsed);
  }

  private cleanOldCheckpoints(workflowId: string): void {
    const checkpoints = this.getCheckpointsByWorkflow(workflowId);
    if (checkpoints.length > this.MAX_CHECKPOINTS_PER_WORKFLOW) {
      const toDelete = checkpoints.slice(this.MAX_CHECKPOINTS_PER_WORKFLOW);
      toDelete.forEach(cp => this.checkpoints.delete(cp.id));
      logger.info(`清理了 ${toDelete.length} 个旧检查点`);
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private loadFromStorage(): void {
    try {
      const checkpointsData = localStorage.getItem(this.CHECKPOINTS_KEY);
      const statesData = localStorage.getItem(this.EXECUTION_STATES_KEY);

      if (checkpointsData) {
        const parsed = JSON.parse(checkpointsData);
        if (Array.isArray(parsed)) {
          parsed.forEach((raw: unknown) => {
            if (!raw || typeof raw !== 'object') return;
            const cp = raw as Checkpoint & { createdAt: string | Date };
            cp.createdAt = new Date(cp.createdAt);
            if (typeof cp.id === 'string') {
              this.checkpoints.set(cp.id, cp);
            }
          });
        }
      }

      if (statesData) {
        const parsed = JSON.parse(statesData);
        if (Array.isArray(parsed)) {
          parsed.forEach((raw: unknown) => {
            if (!raw || typeof raw !== 'object') return;
            const state = raw as WorkflowExecutionState & { startTime?: string | Date; endTime?: string | Date };
            if (state.startTime) state.startTime = new Date(state.startTime);
            if (state.endTime) state.endTime = new Date(state.endTime);
            if (typeof state.workflowId === 'string') {
              this.executionStates.set(state.workflowId, state);
            }
          });
        }
      }

      logger.info('工作流断点续传服务数据加载完成');
    } catch (error) {
      logger.warn('加载工作流断点续传数据失败:', error);
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.CHECKPOINTS_KEY, JSON.stringify(Array.from(this.checkpoints.values())));
      localStorage.setItem(this.EXECUTION_STATES_KEY, JSON.stringify(Array.from(this.executionStates.values())));
    } catch (error) {
      logger.warn('保存工作流断点续传数据失败:', error);
    }
  }

  public exportData(): {
    checkpoints: Checkpoint[];
    executionStates: WorkflowExecutionState[];
  } {
    return {
      checkpoints: Array.from(this.checkpoints.values()),
      executionStates: Array.from(this.executionStates.values())
    };
  }

  public importData(data: {
    checkpoints: Checkpoint[];
    executionStates: WorkflowExecutionState[];
  }): void {
    data.checkpoints.forEach(cp => this.checkpoints.set(cp.id, cp));
    data.executionStates.forEach(state => this.executionStates.set(state.workflowId, state));
    this.saveToStorage();
    logger.info('工作流断点续传服务数据导入完成');
  }

  public clearAllData(): void {
    this.checkpoints.clear();
    this.executionStates.clear();
    this.saveToStorage();
    logger.info('工作流断点续传服务数据已清空');
  }
}

export const workflowCheckpointService = WorkflowCheckpointService.getInstance();
export default WorkflowCheckpointService;
