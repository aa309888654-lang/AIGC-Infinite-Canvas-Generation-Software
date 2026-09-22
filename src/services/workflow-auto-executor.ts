/**
 * 工作流自动执行服务
 * 实现AI生成工作流的一键式执行功能
 */

import { Node, Edge } from '@xyflow/react';
import {
  CANVAS_NODE_HORIZONTAL_GAP,
  CANVAS_NODE_VERTICAL_GAP,
  getCanvasNodeDimensions,
} from '@/lib/canvas-node-dimensions';
import { buildMockNodeGenerationResult } from '@/services/mock-node-generation';

export interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  position: { x: number; y: number };
  params: Record<string, unknown>;
}

export interface GeneratedWorkflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges?: Edge[];
  connections?: unknown[];
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedDuration?: string;
}

export interface ExecutionResult {
  success: boolean;
  nodeId: string;
  output?: unknown;
  error?: string;
  duration?: number;
}

export interface WorkflowExecutionState {
  workflowId: string;
  currentNodeId: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  results: ExecutionResult[];
  startTime?: number;
  endTime?: number;
}

type ExecutionCallback = (state: WorkflowExecutionState) => void;

export class WorkflowAutoExecutor {
  private static instance: WorkflowAutoExecutor;
  private executionQueue: Map<string, WorkflowExecutionState> = new Map();
  private callbacks: Map<string, ExecutionCallback[]> = new Map();
  private isExecuting: Map<string, boolean> = new Map();

  private constructor() { /* noop */ }

  public static getInstance(): WorkflowAutoExecutor {
    if (!WorkflowAutoExecutor.instance) {
      WorkflowAutoExecutor.instance = new WorkflowAutoExecutor();
    }
    return WorkflowAutoExecutor.instance;
  }

  public subscribe(workflowId: string, callback: ExecutionCallback): () => void {
    if (!this.callbacks.has(workflowId)) {
      this.callbacks.set(workflowId, []);
    }
    this.callbacks.get(workflowId)!.push(callback);

    return () => {
      const workflowCallbacks = this.callbacks.get(workflowId);
      if (workflowCallbacks) {
        const index = workflowCallbacks.indexOf(callback);
        if (index > -1) {
          workflowCallbacks.splice(index, 1);
        }
      }
    };
  }

  private notifySubscribers(workflowId: string, state: WorkflowExecutionState): void {
    const workflowCallbacks = this.callbacks.get(workflowId);
    if (workflowCallbacks) {
      workflowCallbacks.forEach(callback => callback(state));
    }
  }

  private normalizeWorkflowEdges(workflow: GeneratedWorkflow): Edge[] {
    if (workflow.edges?.length) {
      return workflow.edges;
    }

    if (!workflow.connections?.length) {
      return [];
    }

    return workflow.connections.flatMap((connection, index) => {
      if (!connection || typeof connection !== 'object') {
        return [];
      }

      const candidate = connection as Partial<Edge> & {
        source?: string;
        target?: string;
        sourceHandle?: string;
        targetHandle?: string;
        id?: string;
      };

      if (!candidate.source || !candidate.target) {
        return [];
      }

      return [
        {
          id: candidate.id || `e${candidate.source}-${candidate.target}-${index}`,
          source: candidate.source,
          target: candidate.target,
          sourceHandle: candidate.sourceHandle,
          targetHandle: candidate.targetHandle,
        } as Edge,
      ];
    });
  }

  private updateState(workflowId: string, updates: Partial<WorkflowExecutionState>): void {
    const currentState = this.executionQueue.get(workflowId);
    if (currentState) {
      const newState = { ...currentState, ...updates };
      this.executionQueue.set(workflowId, newState);
      this.notifySubscribers(workflowId, newState);
    }
  }

  public async executeWorkflow(
    workflow: GeneratedWorkflow,
    onProgress?: (state: WorkflowExecutionState) => void
  ): Promise<WorkflowExecutionState> {
    const workflowId = workflow.id;
    
    if (this.isExecuting.get(workflowId)) {
      throw new Error('工作流正在执行中');
    }

    this.isExecuting.set(workflowId, true);

    const initialState: WorkflowExecutionState = {
      workflowId,
      currentNodeId: null,
      status: 'pending',
      progress: 0,
      results: [],
      startTime: Date.now(),
    };

    this.executionQueue.set(workflowId, initialState);
    
    if (onProgress) {
      this.subscribe(workflowId, onProgress);
    }

    this.updateState(workflowId, { status: 'running' });

    try {
      const workflowEdges = this.normalizeWorkflowEdges(workflow);
      const sortedNodes = this.topologicalSort(workflow.nodes, workflowEdges);
      const totalNodes = sortedNodes.length;

      for (let i = 0; i < sortedNodes.length; i++) {
        const node = sortedNodes[i];
        this.updateState(workflowId, {
          currentNodeId: node.id,
          progress: Math.round(((i + 1) / totalNodes) * 100),
        });

        const result = await this.executeNode(node, workflow, workflowEdges);
        
        const currentResults = this.executionQueue.get(workflowId)?.results || [];
        this.updateState(workflowId, {
          results: [...currentResults, result],
        });

        if (!result.success) {
          this.updateState(workflowId, {
            status: 'failed',
            endTime: Date.now(),
          });
          return this.executionQueue.get(workflowId)!;
        }
      }

      this.updateState(workflowId, {
        status: 'completed',
        progress: 100,
        endTime: Date.now(),
      });

      return this.executionQueue.get(workflowId)!;
    } catch (error) {
      this.updateState(workflowId, {
        status: 'failed',
        endTime: Date.now(),
      });
      throw error;
    } finally {
      this.isExecuting.set(workflowId, false);
    }
  }

  private async executeNode(
    node: WorkflowNode,
    workflow: GeneratedWorkflow,
    workflowEdges: Edge[],
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    await this.delay(500 + Math.random() * 1000);

    const inputEdges = workflowEdges.filter(edge => edge.target === node.id);
    const inputData: Record<string, unknown> = {};
    
    for (const edge of inputEdges) {
      const sourceResult = this.executionQueue.get(workflow.id)?.results.find(
        r => r.nodeId === edge.source
      );
      if (sourceResult?.output) {
        inputData[edge.targetHandle || 'input'] = sourceResult.output;
      }
    }

    try {
      const prompt = String(node.params.prompt || node.params.text || node.params.content || node.label || '');
      const mockResult = buildMockNodeGenerationResult({
        nodeId: node.id,
        nodeType: node.type,
        label: node.label,
        prompt,
        params: node.params,
        input: inputData,
      });
      const output = node.type === 'output'
        ? { finalOutput: true, inputData }
        : mockResult.output;

      return {
        success: true,
        nodeId: node.id,
        output,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        nodeId: node.id,
        error: error instanceof Error ? error.message : '执行失败',
        duration: Date.now() - startTime,
      };
    }
  }

  private topologicalSort(nodes: WorkflowNode[], edges: Edge[]): WorkflowNode[] {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    nodes.forEach(n => {
      inDegree.set(n.id, 0);
      adjacency.set(n.id, []);
    });

    edges.forEach(edge => {
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
      adjacency.get(edge.source)?.push(edge.target);
    });

    const queue: string[] = [];
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) queue.push(nodeId);
    });

    const sorted: WorkflowNode[] = [];
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const node = nodeMap.get(nodeId);
      if (node) sorted.push(node);

      const neighbors = adjacency.get(nodeId) || [];
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    return sorted;
  }

  public cancelExecution(workflowId: string): void {
    this.updateState(workflowId, {
      status: 'cancelled',
      endTime: Date.now(),
    });
    this.isExecuting.set(workflowId, false);
  }

  public getExecutionState(workflowId: string): WorkflowExecutionState | undefined {
    return this.executionQueue.get(workflowId);
  }

  public getAllExecutingWorkflows(): string[] {
    const executing: string[] = [];
    this.isExecuting.forEach((value, key) => {
      if (value) executing.push(key);
    });
    return executing;
  }

  public renderWorkflowToCanvas(workflow: GeneratedWorkflow): { nodes: Node[]; edges: Edge[] } {
    const workflowEdges = this.normalizeWorkflowEdges(workflow);
    const sortedNodes = this.topologicalSort(workflow.nodes, workflowEdges);
    const levelNodes = this.groupNodesByLevel(sortedNodes, workflowEdges);
    const levelIndices = Array.from(levelNodes.keys()).sort((a, b) => a - b);
    const levelWidths = new Map<number, number>();
    const levelXPositions = new Map<number, number>();
    const levelYPositions = new Map<number, number[]>();

    for (const level of levelIndices) {
      const nodesAtLevel = levelNodes.get(level) || [];
      const widths = nodesAtLevel.map((node) => getCanvasNodeDimensions(node.type).width);
      levelWidths.set(level, Math.max(...widths, 0));

      const yPositions: number[] = [];
      let cursorY = 0;
      nodesAtLevel.forEach((node) => {
        yPositions.push(cursorY);
        const dimensions = getCanvasNodeDimensions(node.type);
        cursorY += dimensions.height + CANVAS_NODE_VERTICAL_GAP;
      });
      levelYPositions.set(level, yPositions);
    }

    let cursorX = 0;
    for (const level of levelIndices) {
      levelXPositions.set(level, cursorX);
      cursorX += (levelWidths.get(level) || 0) + CANVAS_NODE_HORIZONTAL_GAP;
    }

    const renderedNodes: Node[] = sortedNodes.map((node) => {
      const level = this.getNodeLevel(node.id, levelNodes);
      const levelIndex = levelNodes.get(level)?.findIndex((n) => n.id === node.id) ?? 0;
      const x = levelXPositions.get(level) ?? 0;
      const y = levelYPositions.get(level)?.[levelIndex] ?? 0;

      return {
        id: node.id,
        type: node.type,
        position: { x, y },
        data: {
          label: node.label,
          ...node.params,
        },
      };
    });

    const renderedEdges: Edge[] = workflowEdges.map(edge => ({
      id: `e${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
    }));

    return { nodes: renderedNodes, edges: renderedEdges };
  }

  private groupNodesByLevel(nodes: WorkflowNode[], edges: Edge[]): Map<number, WorkflowNode[]> {
    const levels = new Map<number, WorkflowNode[]>();
    const nodeLevels = new Map<string, number>();

    nodes.forEach(node => {
      const incomingEdges = edges.filter(e => e.target === node.id);
      if (incomingEdges.length === 0) {
        nodeLevels.set(node.id, 0);
      } else {
        let maxLevel = 0;
        incomingEdges.forEach(edge => {
          const sourceLevel = nodeLevels.get(edge.source) || 0;
          maxLevel = Math.max(maxLevel, sourceLevel + 1);
        });
        nodeLevels.set(node.id, maxLevel);
      }
    });

    nodes.forEach(node => {
      const level = nodeLevels.get(node.id) || 0;
      if (!levels.has(level)) {
        levels.set(level, []);
      }
      levels.get(level)!.push(node);
    });

    return levels;
  }

  private getNodeLevel(nodeId: string, levelNodes: Map<number, WorkflowNode[]>): number {
    for (const [level, nodes] of levelNodes) {
      if (nodes.some(n => n.id === nodeId)) {
        return level;
      }
    }
    return 0;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const workflowAutoExecutor = WorkflowAutoExecutor.getInstance();
