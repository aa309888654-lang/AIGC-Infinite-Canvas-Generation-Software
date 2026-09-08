import type { Node, Edge } from '@xyflow/react';

export type GraphNodeStatus = 'pending' | 'running' | 'completed' | 'failed' | 'waiting_human' | 'skipped';

export interface StateGraphContext {
  workflowId: string;
  nodeOutputs: Map<string, Record<string, unknown>>;
  visited: Set<string>;
  iterationCounts: Map<string, number>;
  metadata: Map<string, Record<string, unknown>>;
}

export type ConditionFn = (
  output: Record<string, unknown>,
  ctx: StateGraphContext,
) => string | null;

export interface StateGraphEdge {
  from: string;
  to: string;
  condition?: string;
  conditionFn?: ConditionFn;
  label?: string;
}

export interface StateGraphRunOptions {
  maxLoopPerNode?: number;
  onNodeStatus?: (nodeId: string, status: GraphNodeStatus) => void;
  onEdgeTraversed?: (from: string, to: string, label?: string) => void;
  executeNode: (nodeId: string, ctx: StateGraphContext) => Promise<Record<string, unknown>>;
  shouldWaitForHuman?: (nodeId: string, ctx: StateGraphContext) => boolean;
  onHumanInput?: (nodeId: string, ctx: StateGraphContext) => Promise<Record<string, unknown>>;
}

export interface StateGraphRunResult {
  success: boolean;
  error?: string;
  completedNodes: string[];
  failedNodes: string[];
  totalIterations: number;
}

const CONDITION_REGISTRY: Record<string, ConditionFn> = {
  'verdict==pass': (output) => output.verdict === 'pass' ? 'pass' : null,
  'verdict==fail': (output) => output.verdict === 'fail' ? 'fail' : null,
  'score>=70': (output) => typeof output.score === 'number' && output.score >= 70 ? 'pass' : null,
  'score<70': (output) => typeof output.score === 'number' && output.score < 70 ? 'fail' : null,
};

export function registerCondition(name: string, fn: ConditionFn): void {
  CONDITION_REGISTRY[name] = fn;
}

export class StateGraphEngine {
  private nodes: Node[] = [];
  private edges: StateGraphEdge[] = [];
  private extraEdges: StateGraphEdge[] = [];

  loadFromCanvas(nodes: Node[], edges: Edge[]): void {
    this.nodes = nodes;
    this.edges = edges.map((e) => ({
      from: e.source,
      to: e.target,
      condition: (e.data as Record<string, unknown>)?.condition as string | undefined,
      label: (e.data as Record<string, unknown>)?.label as string | undefined,
    }));
    // 清空上一次运行遗留的额外边，避免跨运行污染拓扑
    this.extraEdges = [];
  }

  addEdge(edge: StateGraphEdge): void {
    this.extraEdges.push(edge);
  }

  getEntryNodes(): string[] {
    const allEdges = [...this.edges, ...this.extraEdges];
    const targets = new Set(allEdges.map((e) => e.to));
    return this.nodes.filter((n) => !targets.has(n.id)).map((n) => n.id);
  }

  getAllEdges(): StateGraphEdge[] {
    return [...this.edges, ...this.extraEdges];
  }

  /**
   * 将失败节点的直接下游标记为 skipped 并将入度归零，
   * 避免下游节点因依赖永不满足而静默死锁。
   */
  private markDownstreamSkipped(
    failedNodeId: string,
    allEdges: StateGraphEdge[],
    inDegree: Map<string, number>,
    queue: string[],
    processed: Set<string>,
    options: StateGraphRunOptions,
  ): void {
    const downstream = allEdges.filter((e) => e.from === failedNodeId);
    for (const edge of downstream) {
      options.onNodeStatus?.(edge.to, 'skipped');
      processed.add(edge.to);
      // 将下游入度清零并从队列中移除，避免被重复调度
      inDegree.set(edge.to, 0);
      const idx = queue.indexOf(edge.to);
      if (idx >= 0) queue.splice(idx, 1);
    }
  }

  private evaluateCondition(
    edge: StateGraphEdge,
    output: Record<string, unknown>,
    ctx: StateGraphContext,
  ): boolean {
    if (!edge.condition && !edge.conditionFn) return true;

    if (edge.conditionFn) {
      const result = edge.conditionFn(output, ctx);
      return result !== null;
    }

    if (edge.condition) {
      const fn = CONDITION_REGISTRY[edge.condition];
      if (fn) {
        const result = fn(output, ctx);
        return result !== null;
      }

      // 未注册的条件表达式不再动态 eval，避免代码注入风险
      // 调用方应通过 registerCondition 注册白名单条件或使用 conditionFn 字段
      return false;
    }

    return true;
  }

  async run(options: StateGraphRunOptions): Promise<StateGraphRunResult> {
    const ctx: StateGraphContext = {
      workflowId: `sg-${Date.now()}`,
      nodeOutputs: new Map(),
      visited: new Set(),
      iterationCounts: new Map(),
      metadata: new Map(),
    };

    const maxLoop = options.maxLoopPerNode ?? 3;
    const allEdges = this.getAllEdges();
    const completedNodes: string[] = [];
    const failedNodes: string[] = [];
    let totalIterations = 0;

    const inDegree = new Map<string, number>();
    for (const n of this.nodes) inDegree.set(n.id, 0);
    for (const e of allEdges) {
      inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
    }

    const queue = [...this.getEntryNodes()];
    const processed = new Set<string>();

    while (queue.length > 0) {
      const nodeId = queue.shift()!;

      if (processed.has(nodeId)) {
        const loops = (ctx.iterationCounts.get(nodeId) || 0) + 1;
        if (loops > maxLoop) {
          failedNodes.push(nodeId);
          options.onNodeStatus?.(nodeId, 'failed');
          continue;
        }
        ctx.iterationCounts.set(nodeId, loops);
      } else {
        ctx.iterationCounts.set(nodeId, 1);
      }

      totalIterations++;

      if (options.shouldWaitForHuman?.(nodeId, ctx)) {
        options.onNodeStatus?.(nodeId, 'waiting_human');
        if (options.onHumanInput) {
          try {
            const humanOutput = await options.onHumanInput(nodeId, ctx);
            ctx.nodeOutputs.set(nodeId, humanOutput);
          } catch (err) {
            failedNodes.push(nodeId);
            options.onNodeStatus?.(nodeId, 'failed');
            // 失败节点的下游标记为 skipped 并跳过，避免死锁
            this.markDownstreamSkipped(nodeId, allEdges, inDegree, queue, processed, options);
            continue;
          }
        } else {
          // 未提供 onHumanInput 处理器时，标记为失败而非永久阻塞
          failedNodes.push(nodeId);
          options.onNodeStatus?.(nodeId, 'failed');
          this.markDownstreamSkipped(nodeId, allEdges, inDegree, queue, processed, options);
          continue;
        }
      } else {
        options.onNodeStatus?.(nodeId, 'running');
        try {
          const output = await options.executeNode(nodeId, ctx);
          ctx.nodeOutputs.set(nodeId, output);
          ctx.visited.add(nodeId);
          completedNodes.push(nodeId);
          options.onNodeStatus?.(nodeId, 'completed');
        } catch (err) {
          failedNodes.push(nodeId);
          options.onNodeStatus?.(nodeId, 'failed');
          // 失败节点的下游标记为 skipped 并跳过，避免静默死锁
          this.markDownstreamSkipped(nodeId, allEdges, inDegree, queue, processed, options);
          continue;
        }
      }

      processed.add(nodeId);

      const outgoingEdges = allEdges.filter((e) => e.from === nodeId);
      for (const edge of outgoingEdges) {
        const output = ctx.nodeOutputs.get(nodeId) || {};
        const shouldTraverse = this.evaluateCondition(edge, output, ctx);

        if (!shouldTraverse) {
          options.onNodeStatus?.(edge.to, 'skipped');
          continue;
        }

        options.onEdgeTraversed?.(edge.from, edge.to, edge.label);

        const currentDegree = inDegree.get(edge.to) || 1;
        inDegree.set(edge.to, currentDegree - 1);

        if ((inDegree.get(edge.to) || 0) <= 0) {
          queue.push(edge.to);
        }
      }
    }

    return {
      success: failedNodes.length === 0,
      failedNodes,
      completedNodes,
      totalIterations,
    };
  }
}

export const stateGraphEngine = new StateGraphEngine();
