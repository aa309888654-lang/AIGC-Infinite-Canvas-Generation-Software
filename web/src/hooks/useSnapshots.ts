import { useState, useEffect, useCallback } from 'react';
import { Node, Edge } from '@xyflow/react';
import { snapshotManager, WorkflowSnapshot } from '@/services/snapshot-manager';

export const useSnapshots = () => {
  const [snapshots, setSnapshots] = useState<WorkflowSnapshot[]>([]);

  useEffect(() => {
    setSnapshots(snapshotManager.getSnapshots());
    const unsubscribe = snapshotManager.subscribe(() => {
      setSnapshots(snapshotManager.getSnapshots());
    });
    return unsubscribe;
  }, []);

  const createSnapshot = useCallback((nodes: Node[], edges: Edge[], name?: string) => {
    return snapshotManager.createSnapshot(nodes, edges, name);
  }, []);

  const restoreSnapshot = useCallback((snapshotId: string) => {
    return snapshotManager.restoreSnapshot(snapshotId);
  }, []);

  const deleteSnapshot = useCallback((snapshotId: string) => {
    return snapshotManager.deleteSnapshot(snapshotId);
  }, []);

  return {
    snapshots,
    createSnapshot,
    restoreSnapshot,
    deleteSnapshot,
  };
};
