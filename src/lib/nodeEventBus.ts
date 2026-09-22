type EventCallback = (data: unknown) => void;

type NodeEventMap = {
  'node:added': { node: Record<string, unknown> };
  'node:deleted': { nodeId: string };
  'node:executed': { nodeId: string; success: boolean };
  'downstream:synced': { sourceNodeId: string; syncedCount: number };
};

class NodeEventBus {
  private listeners = new Map<string, Set<EventCallback>>();

  subscribe<K extends keyof NodeEventMap>(
    event: K,
    callback: (data: NodeEventMap[K]) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const cb = callback as EventCallback;
    this.listeners.get(event)!.add(cb);
    return () => {
      this.listeners.get(event)?.delete(cb);
    };
  }

  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        console.error(`[nodeEventBus] Error in "${event}" handler:`, err);
      }
    });
  }

  emitNodeAdded(node: Record<string, unknown>): void {
    this.emit('node:added', { node });
  }

  emitNodeDeleted(nodeId: string): void {
    this.emit('node:deleted', { nodeId });
  }

  emitNodeExecuted(nodeId: string, success: boolean): void {
    this.emit('node:executed', { nodeId, success });
    if (success) {
      void import('@/services/node-output-auto-register')
        .then(({ autoRegisterNodeGeneratedMedia }) => autoRegisterNodeGeneratedMedia(nodeId))
        .catch((error) => console.warn('[nodeEventBus] 自动登记节点生成文件失败:', error));
    }
  }

  emitDownstreamSynced(sourceNodeId: string, syncedCount: number): void {
    this.emit('downstream:synced', { sourceNodeId, syncedCount });
  }
}

export const nodeEventBus = new NodeEventBus();
