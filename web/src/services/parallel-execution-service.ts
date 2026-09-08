import { Node, Edge } from '@xyflow/react';
import { generateId } from '@/lib/utils';
import { logger } from '@/lib/logger';

export interface ParallelExecutionGroup {
  id: string;
  nodeIds: string[];
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface ExecutionTask {
  id: string;
  nodeId: string;
  groupId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
}

export interface ExecutionPlan {
  groups: ParallelExecutionGroup[];
  tasks: ExecutionTask[];
  totalGroups: number;
  totalNodes: number;
}

class ParallelExecutionService {
  private static instance: ParallelExecutionService;
  private executionPlans: Map<string, ExecutionPlan> = new Map();
  private activeExecutions: Map<string, Set<string>> = new Map();
  private readonly PLANS_KEY = 'parallel-execution-plans';

  public static getInstance(): ParallelExecutionService {
    if (!ParallelExecutionService.instance) {
      ParallelExecutionService.instance = new ParallelExecutionService();
    }
    return ParallelExecutionService.instance;
  }

  private constructor() {
    this.loadFromStorage();
  }

  public analyzeWorkflow(nodes: Node[], edges: Edge[]): ExecutionPlan {
    const nodeIds = new Set(nodes.map(n => n.id));
    const inDegree = new Map<string, number>();
    const adjacencyList = new Map<string, string[]>();

    nodes.forEach(node => {
      inDegree.set(node.id, 0);
      adjacencyList.set(node.id, []);
    });

    edges.forEach(edge => {
      if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
        inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
        adjacencyList.get(edge.source)!.push(edge.target);
      }
    });

    const groups: ParallelExecutionGroup[] = [];
    const tasks: ExecutionTask[] = [];
    const remainingInDegree = new Map(inDegree);
    const processed = new Set<string>();
    let groupOrder = 0;

    while (processed.size < nodes.length) {
      const currentLevel: string[] = [];
      
      remainingInDegree.forEach((degree, nodeId) => {
        if (degree === 0 && !processed.has(nodeId)) {
          currentLevel.push(nodeId);
        }
      });

      if (currentLevel.length === 0) {
        logger.warn('检测到循环依赖，无法继续分析');
        break;
      }

      const groupId = `group-${groupOrder++}`;
      const group: ParallelExecutionGroup = {
        id: groupId,
        nodeIds: currentLevel,
        dependencies: Array.from(processed),
        status: 'pending',
      };

      groups.push(group);

      currentLevel.forEach(nodeId => {
        const task: ExecutionTask = {
          id: generateId(),
          nodeId,
          groupId,
          status: 'pending',
        };
        tasks.push(task);
        processed.add(nodeId);

        adjacencyList.get(nodeId)!.forEach(targetId => {
          remainingInDegree.set(targetId, (remainingInDegree.get(targetId) || 0) - 1);
        });
      });
    }

    const plan: ExecutionPlan = {
      groups,
      tasks,
      totalGroups: groups.length,
      totalNodes: nodes.length,
    };

    logger.info(`工作流分析完成: ${plan.totalGroups} 组, ${plan.totalNodes} 节点`);
    return plan;
  }

  public createExecutionPlan(workflowId: string, nodes: Node[], edges: Edge[]): ExecutionPlan {
    const plan = this.analyzeWorkflow(nodes, edges);
    this.executionPlans.set(workflowId, plan);
    this.saveToStorage();
    return plan;
  }

  public getExecutionPlan(workflowId: string): ExecutionPlan | undefined {
    return this.executionPlans.get(workflowId);
  }

  public getParallelGroups(workflowId: string): ParallelExecutionGroup[] {
    return this.getExecutionPlan(workflowId)?.groups || [];
  }

  public canExecuteInParallel(nodeId1: string, nodeId2: string, workflowId: string): boolean {
    const plan = this.getExecutionPlan(workflowId);
    if (!plan) return false;

    const group1 = plan.groups.find(g => g.nodeIds.includes(nodeId1));
    const group2 = plan.groups.find(g => g.nodeIds.includes(nodeId2));

    return group1?.id === group2?.id;
  }

  public getReadyToExecute(workflowId: string, completedNodeIds: string[]): string[] {
    const plan = this.getExecutionPlan(workflowId);
    if (!plan) return [];

    const readyNodes: string[] = [];

    for (const group of plan.groups) {
      const allDependenciesCompleted = group.dependencies.every(depId => 
        completedNodeIds.includes(depId)
      );

      if (allDependenciesCompleted) {
        const groupTasks = plan.tasks.filter(t => t.groupId === group.id);
        const uncompletedInGroup = groupTasks.filter(t => 
          !completedNodeIds.includes(t.nodeId)
        );

        readyNodes.push(...uncompletedInGroup.map(t => t.nodeId));
      }
    }

    return readyNodes;
  }

  public startGroupExecution(workflowId: string, groupId: string): ParallelExecutionGroup | undefined {
    const plan = this.getExecutionPlan(workflowId);
    if (!plan) return undefined;

    const group = plan.groups.find(g => g.id === groupId);
    if (!group) return undefined;

    group.status = 'running';
    group.startedAt = new Date();

    plan.tasks
      .filter(t => t.groupId === groupId)
      .forEach(task => {
        task.status = 'running';
        task.startedAt = new Date();
      });

    if (!this.activeExecutions.has(workflowId)) {
      this.activeExecutions.set(workflowId, new Set());
    }
    this.activeExecutions.get(workflowId)!.add(groupId);

    this.saveToStorage();
    logger.info(`开始执行组: ${groupId} (${group.nodeIds.length} 节点)`);
    return group;
  }

  public completeTask(workflowId: string, nodeId: string, result?: any): ExecutionTask | undefined {
    const plan = this.getExecutionPlan(workflowId);
    if (!plan) return undefined;

    const task = plan.tasks.find(t => t.nodeId === nodeId);
    if (!task) return undefined;

    task.status = 'completed';
    task.completedAt = new Date();
    task.result = result;

    this.checkGroupCompletion(workflowId, task.groupId, plan);
    this.saveToStorage();
    logger.info(`任务完成: ${nodeId}`);
    return task;
  }

  public failTask(workflowId: string, nodeId: string, error: string): ExecutionTask | undefined {
    const plan = this.getExecutionPlan(workflowId);
    if (!plan) return undefined;

    const task = plan.tasks.find(t => t.nodeId === nodeId);
    if (!task) return undefined;

    task.status = 'failed';
    task.completedAt = new Date();
    task.error = error;

    const group = plan.groups.find(g => g.id === task.groupId);
    if (group) {
      group.status = 'failed';
      group.completedAt = new Date();
      group.error = error;
      this.activeExecutions.get(workflowId)?.delete(group.id);
    }

    this.saveToStorage();
    logger.error(`任务失败: ${nodeId} - ${error}`);
    return task;
  }

  private checkGroupCompletion(workflowId: string, groupId: string, plan: ExecutionPlan): void {
    const groupTasks = plan.tasks.filter(t => t.groupId === groupId);
    const allCompleted = groupTasks.every(t => t.status === 'completed');

    if (allCompleted) {
      const group = plan.groups.find(g => g.id === groupId);
      if (group) {
        group.status = 'completed';
        group.completedAt = new Date();
        this.activeExecutions.get(workflowId)?.delete(groupId);
        logger.info(`组执行完成: ${groupId}`);
      }
    }
  }

  public getExecutionProgress(workflowId: string): {
    completed: number;
    total: number;
    percentage: number;
  } {
    const plan = this.getExecutionPlan(workflowId);
    if (!plan) {
      return { completed: 0, total: 0, percentage: 0 };
    }

    const completed = plan.tasks.filter(t => t.status === 'completed').length;
    const total = plan.tasks.length;
    const percentage = total > 0 ? (completed / total) * 100 : 0;

    return { completed, total, percentage };
  }

  public getGroupStatus(workflowId: string, groupId: string): ParallelExecutionGroup | undefined {
    return this.getExecutionPlan(workflowId)?.groups.find(g => g.id === groupId);
  }

  public getTaskStatus(workflowId: string, nodeId: string): ExecutionTask | undefined {
    return this.getExecutionPlan(workflowId)?.tasks.find(t => t.nodeId === nodeId);
  }

  public resetExecution(workflowId: string): void {
    const plan = this.getExecutionPlan(workflowId);
    if (!plan) return;

    plan.groups.forEach(group => {
      group.status = 'pending';
      group.startedAt = undefined;
      group.completedAt = undefined;
      group.error = undefined;
    });

    plan.tasks.forEach(task => {
      task.status = 'pending';
      task.startedAt = undefined;
      task.completedAt = undefined;
      task.result = undefined;
      task.error = undefined;
    });

    this.activeExecutions.delete(workflowId);
    this.saveToStorage();
    logger.info(`重置执行: ${workflowId}`);
  }

  public clearExecutionPlan(workflowId: string): void {
    this.executionPlans.delete(workflowId);
    this.activeExecutions.delete(workflowId);
    this.saveToStorage();
    logger.info(`清除执行计划: ${workflowId}`);
  }

  public hasParallelBranches(workflowId: string): boolean {
    const plan = this.getExecutionPlan(workflowId);
    if (!plan) return false;
    return plan.groups.some(g => g.nodeIds.length > 1);
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(this.PLANS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        Object.entries(parsed).forEach(([workflowId, plan]: [string, Record<string, any>]) => {
          plan.groups.forEach((g: any) => {
            if (g.startedAt) g.startedAt = new Date(g.startedAt);
            if (g.completedAt) g.completedAt = new Date(g.completedAt);
          });
          plan.tasks.forEach((t: any) => {
            if (t.startedAt) t.startedAt = new Date(t.startedAt);
            if (t.completedAt) t.completedAt = new Date(t.completedAt);
          });
          this.executionPlans.set(workflowId, plan as ExecutionPlan);
        });
        logger.info('并行执行服务数据加载完成');
      }
    } catch (error) {
      logger.warn('加载并行执行数据失败:', error);
    }
  }

  private saveToStorage(): void {
    try {
      const data: Record<string, ExecutionPlan> = {};
      this.executionPlans.forEach((plan, workflowId) => {
        data[workflowId] = plan;
      });
      localStorage.setItem(this.PLANS_KEY, JSON.stringify(data));
    } catch (error) {
      logger.warn('保存并行执行数据失败:', error);
    }
  }

  public clearAllData(): void {
    this.executionPlans.clear();
    this.activeExecutions.clear();
    localStorage.removeItem(this.PLANS_KEY);
    logger.info('并行执行服务数据已清空');
  }
}

export const parallelExecutionService = ParallelExecutionService.getInstance();
export default ParallelExecutionService;
