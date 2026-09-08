import { Node, Edge } from '@xyflow/react';

export interface WorkflowSnapshot {
  id: string;
  name: string;
  timestamp: Date;
  nodes: Node[];
  edges: Edge[];
}

type SnapshotCallback = () => void;

class SnapshotManager {
  private static instance: SnapshotManager;
  private snapshots: WorkflowSnapshot[] = [];
  private maxSnapshots = 20;
  private storageKey = 'workflow-snapshots';
  private callbacks: SnapshotCallback[] = [];

  private constructor() {
    this.loadFromStorage();
  }

  static getInstance(): SnapshotManager {
    if (!SnapshotManager.instance) {
      SnapshotManager.instance = new SnapshotManager();
    }
    return SnapshotManager.instance;
  }

  subscribe(callback: SnapshotCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  private notify(): void {
    this.callbacks.forEach(cb => cb());
  }

  createSnapshot(nodes: Node[], edges: Edge[], name?: string): WorkflowSnapshot {
    const snapshot: WorkflowSnapshot = {
      id: `snapshot-${Date.now()}`,
      name: name || `快照 ${this.snapshots.length + 1}`,
      timestamp: new Date(),
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    };

    this.snapshots = [snapshot, ...this.snapshots].slice(0, this.maxSnapshots);
    this.saveToStorage();
    this.notify();
    return snapshot;
  }

  restoreSnapshot(snapshotId: string): { nodes: Node[]; edges: Edge[] } | null {
    const snapshot = this.snapshots.find(s => s.id === snapshotId);
    if (!snapshot) return null;

    return {
      nodes: JSON.parse(JSON.stringify(snapshot.nodes)),
      edges: JSON.parse(JSON.stringify(snapshot.edges)),
    };
  }

  deleteSnapshot(snapshotId: string): boolean {
    const index = this.snapshots.findIndex(s => s.id === snapshotId);
    if (index === -1) return false;

    this.snapshots.splice(index, 1);
    this.saveToStorage();
    this.notify();
    return true;
  }

  getSnapshots(): WorkflowSnapshot[] {
    return [...this.snapshots];
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.snapshots));
    } catch (error) {
      console.error('[SnapshotManager] 保存快照失败:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        this.snapshots = JSON.parse(data);
      }
    } catch (error) {
      console.error('[SnapshotManager] 加载快照失败:', error);
      this.snapshots = [];
    }
  }
}

export const snapshotManager = SnapshotManager.getInstance();
