/**
 * v3 执行引擎层 — 画布 DAG 执行引擎
 * 统一 useWorkflowStore / aicg-group / 单节点执行入口
 */
import type { Node, Edge } from '@xyflow/react';
import { executeSingleNode } from '@/store/real-api-executor';
import { useCanvasStore } from '@/store/useCanvasStore';
import { getNodeDependencies } from '@/store/workflow-graph';
import { nodeRegistry } from './node-registry';
import { isExecutableNodeType } from './connection-rules';
import { workflowCheckpointService } from '@/services/workflow-checkpoint-service';

export type NodeRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface NodeRunRecord {
  nodeId: string;
  status: NodeRunStatus;
  error?: string;
  durationMs?: number;
}

export interface CanvasExecutionProgress {
  completed: number;
  total: number;
  runningNodes: string[];
  currentLayer?: number;
}

export interface CanvasExecutionOptions {
  workflowId?: string;
  maxParallel?: number;
  maxRetries?: number;
  createCheckpoint?: boolean;
  onProgress?: (progress: CanvasExecutionProgress) => void;
  onNodeComplete?: (record: NodeRunRecord) => void;
  /** 自定义可执行节点过滤 */
  filterExecutable?: (node: Node) => boolean;
}

export interface CanvasExecutionResult {
  success: boolean;
  completed: number;
  total: number;
  records: NodeRunRecord[];
  error?: string;
  checkpointId?: string;
}

function getNodeTypeKey(node: Node): string {
  const dataType = (node.data as { type?: string } | undefined)?.type;
  return dataType || (node.type as string) || '';
}

function isNodeExecutable(node: Node): boolean {
  const typeKey = getNodeTypeKey(node);
  if (nodeRegistry.isExecutable(typeKey)) return true;
  return isExecutableNodeType(typeKey);
}

function detectCycle(depMap: Map<string, string[]>): string[] | null {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();

  for (const nodeId of depMap.keys()) {
    color.set(nodeId, WHITE);
  }

  const dfs = (nodeId: string, path: string[]): string[] | null => {
    color.set(nodeId, GRAY);
    path.push(nodeId);

    for (const dep of depMap.get(nodeId) || []) {
      if (!depMap.has(dep)) continue;
      const depColor = color.get(dep);
      if (depColor === GRAY) {
        const cycleStart = path.indexOf(dep);
        return path.slice(cycleStart);
      }
      if (depColor === WHITE) {
        const cycle = dfs(dep, [...path]);
        if (cycle) return cycle;
      }
    }

    color.set(nodeId, BLACK);
    return null;
  };

  for (const nodeId of depMap.keys()) {
    if (color.get(nodeId) === WHITE) {
      const cycle = dfs(nodeId, []);
      if (cycle) return cycle;
    }
  }
  return null;
}

class CanvasExecutionEngine {
  private running = false;

  isRunning(): boolean {
    return this.running;
  }

  async run(
    nodes: Node[],
    edges: Edge[],
    options: CanvasExecutionOptions = {}
  ): Promise<CanvasExecutionResult> {
    if (this.running) {
      return { success: false, completed: 0, total: 0, records: [], error: '工作流正在执行中' };
    }
    this.running = true;

    const {
      workflowId = `wf-${Date.now()}`,
      maxParallel = 3,
      maxRetries = 2,
      createCheckpoint = true,
      onProgress,
      onNodeComplete,
      filterExecutable,
    } = options;

    const executableNodes = nodes.filter((n) => {
      if (filterExecutable) return filterExecutable(n);
      return isNodeExecutable(n);
    });

    let notifyProgress: (() => void) | undefined;

    try {
      const total = executableNodes.length;
      const records: NodeRunRecord[] = executableNodes.map((n) => ({
        nodeId: n.id,
        status: 'pending',
      }));

      if (total === 0) {
        return { success: true, completed: 0, total: 0, records };
      }

      if (createCheckpoint) {
        workflowCheckpointService.createCheckpoint(
          workflowId,
          '执行前快照',
          nodes,
          edges,
          [],
          undefined,
          0
        );
      }

      const dependencyMap = new Map<string, string[]>();
      for (const node of executableNodes) {
        const deps = getNodeDependencies(node.id, edges).filter((d) =>
          executableNodes.some((n) => n.id === d)
        );
        dependencyMap.set(node.id, deps);
      }

      const cycle = detectCycle(dependencyMap);
      if (cycle) {
        return {
          success: false,
          completed: 0,
          total,
          records,
          error: `检测到循环依赖: ${cycle.join(' → ')}`,
        };
      }

      const completedNodes = new Set<string>();
      const failedNodes = new Set<string>();
      const runningPromises = new Map<string, Promise<void>>();

      notifyProgress = () => {
        onProgress?.({
          completed: completedNodes.size,
          total,
          runningNodes: Array.from(runningPromises.keys()),
        });
      };

      const updateRecord = (nodeId: string, patch: Partial<NodeRunRecord>) => {
        const idx = records.findIndex((r) => r.nodeId === nodeId);
        if (idx >= 0) {
          records[idx] = { ...records[idx], ...patch };
          onNodeComplete?.(records[idx]);
        }
      };

      const executeOne = async (node: Node): Promise<void> => {
        const typeKey = getNodeTypeKey(node);
        const manifest = nodeRegistry.get(typeKey);
        const retries = manifest?.execution?.maxRetries ?? maxRetries;

        updateRecord(node.id, { status: 'running' });
        notifyProgress();

        const started = performance.now();
        let lastError: string | undefined;

        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            await executeSingleNode(node.id);
            const freshNode = useCanvasStore.getState().nodes.find((n) => n.id === node.id);
            const nodeError = (freshNode?.data as { error?: string } | undefined)?.error;
            if (nodeError) {
              throw new Error(String(nodeError));
            }
            updateRecord(node.id, {
              status: 'completed',
              durationMs: Math.round(performance.now() - started),
            });
            completedNodes.add(node.id);
            notifyProgress();
            return;
          } catch (err) {
            lastError = err instanceof Error ? err.message : String(err);
            if (attempt < retries) {
              await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
            }
          }
        }

        updateRecord(node.id, {
          status: 'failed',
          error: lastError,
          durationMs: Math.round(performance.now() - started),
        });
        // 失败节点加入 completedNodes 仅用于让调度循环退出，
        // 但通过 failedNodes 集合标记，findReady 会跳过其下游
        completedNodes.add(node.id);
        failedNodes.add(node.id);
        notifyProgress();
      };

      const findReady = (): Node[] =>
        executableNodes.filter((node) => {
          if (completedNodes.has(node.id)) return false;
          if (runningPromises.has(node.id)) return false;
          const deps = dependencyMap.get(node.id) || [];
          // 任一依赖失败则跳过该节点（避免下游误执行拿到残缺输入）
          if (deps.some((depId) => failedNodes.has(depId))) return false;
          return deps.every((depId) => completedNodes.has(depId));
        });

      notifyProgress();

      while (completedNodes.size < total) {
        const ready = findReady();

        if (ready.length === 0) {
          if (runningPromises.size > 0) {
            await Promise.race(Array.from(runningPromises.values()));
            continue;
          }
          return {
            success: false,
            completed: completedNodes.size,
            total,
            records,
            error: '工作流执行中断：存在无法调度的节点',
          };
        }

        const slots = maxParallel - runningPromises.size;
        const batch = ready.slice(0, Math.max(0, slots));

        for (const node of batch) {
          const p = executeOne(node).finally(() => {
            runningPromises.delete(node.id);
          });
          runningPromises.set(node.id, p);
        }

        if (runningPromises.size >= maxParallel) {
          await Promise.race(Array.from(runningPromises.values()));
        } else {
          await new Promise((r) => setTimeout(r, 50));
        }
      }

      const failed = records.filter((r) => r.status === 'failed');
      return {
        success: failed.length === 0,
        completed: completedNodes.size,
        total,
        records,
        error: failed.length ? `${failed.length} 个节点执行失败` : undefined,
      };
    } finally {
      this.running = false;
      notifyProgress?.();
    }
  }
}

export const canvasExecutionEngine = new CanvasExecutionEngine();
