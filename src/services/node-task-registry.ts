/**
 * 节点任务统一注册表
 *
 * 解决问题：
 * 1. P0-1：节点删除不取消轮询任务，导致 API 配额耗尽
 * 2. P0-6：恢复轮询无中断机制，节点删除后仍持续轮询
 * 3. P0-8：isSubmitting 竞态导致重复提交
 *
 * 用法：
 *   // 轮询开始时注册取消函数
 *   const cancelFn = () => { cancelToken.cancelled = true; };
 *   nodeTaskRegistry.register(nodeId, cancelFn);
 *
 *   // 任务正常完成时注销
 *   nodeTaskRegistry.unregister(nodeId, cancelFn);
 *
 *   // 节点删除时调用 cancelAll 取消所有任务
 *   nodeTaskRegistry.cancelAll(nodeId);
 *
 *   // 检查节点是否仍存在（用于轮询中提前退出）
 *   nodeTaskRegistry.isNodeActive(nodeId);
 */

type CancelFn = () => void;

class NodeTaskRegistry {
  /** nodeId → Set<CancelFn> */
  private nodeCancellers = new Map<string, Set<CancelFn>>();

  /** 注册一个节点的任务取消函数 */
  register(nodeId: string, cancelFn: CancelFn): void {
    if (!this.nodeCancellers.has(nodeId)) {
      this.nodeCancellers.set(nodeId, new Set());
    }
    this.nodeCancellers.get(nodeId)!.add(cancelFn);
  }

  /** 取消节点的所有任务（用于节点删除/超时） */
  cancelAll(nodeId: string): void {
    const fns = this.nodeCancellers.get(nodeId);
    if (fns) {
      fns.forEach((fn) => {
        try {
          fn();
        } catch (e) {
          console.warn('[NodeTaskRegistry] cancel failed', e);
        }
      });
      fns.clear();
      this.nodeCancellers.delete(nodeId);
    }
  }

  /** 注销单个取消函数（任务正常完成时调用） */
  unregister(nodeId: string, cancelFn: CancelFn): void {
    const fns = this.nodeCancellers.get(nodeId);
    if (fns) {
      fns.delete(cancelFn);
      if (fns.size === 0) this.nodeCancellers.delete(nodeId);
    }
  }

  /** 查询节点当前是否有进行中的任务 */
  hasActiveTasks(nodeId: string): boolean {
    const fns = this.nodeCancellers.get(nodeId);
    return !!fns && fns.size > 0;
  }

  /** 获取所有有进行中任务的节点 ID（debug 用） */
  getActiveNodeIds(): string[] {
    return Array.from(this.nodeCancellers.keys()).filter((id) => {
      const fns = this.nodeCancellers.get(id);
      return !!fns && fns.size > 0;
    });
  }

  /** 清空所有注册（仅用于测试或全局重置） */
  clear(): void {
    this.nodeCancellers.forEach((fns) => {
      fns.forEach((fn) => {
        try {
          fn();
        } catch {
          // ignore
        }
      });
      fns.clear();
    });
    this.nodeCancellers.clear();
  }
}

export const nodeTaskRegistry = new NodeTaskRegistry();
