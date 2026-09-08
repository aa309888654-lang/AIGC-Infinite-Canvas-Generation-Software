/**
 * 节点执行结构化日志（P3-3）
 *
 * 取代 real-api-executor.ts 中散落的 debugLog 字符串拼接，
 * 提供结构化 JSON 日志，支持按 nodeId/phase/level 过滤。
 *
 * 设计：
 * 1. 环形缓冲区保留最近 500 条
 * 2. 开发模式输出到 console；生产模式仅 warn/error
 * 3. 提供 subscribe 机制供 PerformanceMonitorPanel 展示
 */

export type NodeExecutionPhase =
  | 'acquire-lock'
  | 'build-payload'
  | 'permission-check'
  | 'api-call'
  | 'poll-status'
  | 'sync-downstream'
  | 'release-lock'
  | 'circuit-open'
  | 'retry'
  | 'execute';

export type NodeExecutionLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface NodeExecutionLogEntry {
  ts: number;
  nodeId: string;
  nodeType: string;
  phase: NodeExecutionPhase;
  level: NodeExecutionLogLevel;
  message: string;
  data?: Record<string, unknown>;
  durationMs?: number;
}

const MAX_ENTRIES = 500;
const isDev = import.meta.env.DEV;

class NodeExecutionLogger {
  private buffer: NodeExecutionLogEntry[] = [];
  private writeIndex = 0;
  private listeners = new Set<(entries: NodeExecutionLogEntry[]) => void>();

  log(entry: Omit<NodeExecutionLogEntry, 'ts'> & { ts?: number }): void {
    const fullEntry: NodeExecutionLogEntry = {
      ts: entry.ts ?? Date.now(),
      ...entry,
    };

    // 写入环形缓冲区
    if (this.buffer.length < MAX_ENTRIES) {
      this.buffer.push(fullEntry);
    } else {
      this.buffer[this.writeIndex] = fullEntry;
      this.writeIndex = (this.writeIndex + 1) % MAX_ENTRIES;
    }

    // console 输出
    if (isDev || fullEntry.level === 'warn' || fullEntry.level === 'error') {
      const prefix = `[node-exec:${fullEntry.phase}]`;
      const nodeTag = `${fullEntry.nodeType}:${fullEntry.nodeId.slice(0, 8)}`;
      const durTag = fullEntry.durationMs != null ? ` (${fullEntry.durationMs}ms)` : '';
      const msg = `${prefix} ${nodeTag}${durTag} ${fullEntry.message}`;

      switch (fullEntry.level) {
        case 'error':
          console.error(msg, fullEntry.data ?? '');
          break;
        case 'warn':
          console.warn(msg, fullEntry.data ?? '');
          break;
        case 'info':
          console.info(msg, fullEntry.data ?? '');
          break;
        default:
          console.debug(msg, fullEntry.data ?? '');
      }
    }

    // 通知订阅者
    this.notifyListeners();
  }

  /** 获取按时间排序的日志条目（最新在后） */
  getEntries(filter?: {
    nodeId?: string;
    phase?: NodeExecutionPhase;
    level?: NodeExecutionLogLevel;
    limit?: number;
  }): NodeExecutionLogEntry[] {
    let entries: NodeExecutionLogEntry[];

    // 环形缓冲区需要重排序
    if (this.buffer.length < MAX_ENTRIES) {
      entries = this.buffer;
    } else {
      entries = [
        ...this.buffer.slice(this.writeIndex),
        ...this.buffer.slice(0, this.writeIndex),
      ];
    }

    if (filter) {
      entries = entries.filter((e) => {
        if (filter.nodeId && e.nodeId !== filter.nodeId) return false;
        if (filter.phase && e.phase !== filter.phase) return false;
        if (filter.level && e.level !== filter.level) return false;
        return true;
      });
    }

    if (filter?.limit && entries.length > filter.limit) {
      entries = entries.slice(-filter.limit);
    }

    return entries;
  }

  clear(): void {
    this.buffer = [];
    this.writeIndex = 0;
    this.notifyListeners();
  }

  subscribe(listener: (entries: NodeExecutionLogEntry[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getEntries());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const entries = this.getEntries();
    for (const listener of this.listeners) {
      listener(entries);
    }
  }
}

export const nodeExecutionLogger = new NodeExecutionLogger();

/** 便捷方法 */
export function logNodeExecution(
  nodeId: string,
  nodeType: string,
  phase: NodeExecutionPhase,
  level: NodeExecutionLogLevel,
  message: string,
  data?: Record<string, unknown>,
  durationMs?: number,
): void {
  nodeExecutionLogger.log({ nodeId, nodeType, phase, level, message, data, durationMs });
}

/** 测量某阶段的执行耗时 */
export async function measurePhase<T>(
  nodeId: string,
  nodeType: string,
  phase: NodeExecutionPhase,
  fn: () => Promise<T>,
  message?: string,
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const durationMs = Math.round(performance.now() - start);
    nodeExecutionLogger.log({
      nodeId,
      nodeType,
      phase,
      level: 'debug',
      message: message ?? `phase completed`,
      durationMs,
    });
    return result;
  } catch (error) {
    const durationMs = Math.round(performance.now() - start);
    nodeExecutionLogger.log({
      nodeId,
      nodeType,
      phase,
      level: 'error',
      message: message ?? `phase failed: ${error instanceof Error ? error.message : String(error)}`,
      durationMs,
      data: { error: error instanceof Error ? error.message : String(error) },
    });
    throw error;
  }
}
