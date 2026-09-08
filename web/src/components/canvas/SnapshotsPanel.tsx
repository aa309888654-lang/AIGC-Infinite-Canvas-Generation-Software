import React from 'react';
import { Camera, BookmarkPlus, X, RotateCcw, Trash2 } from 'lucide-react';
import { WorkflowSnapshot } from '@/services/snapshot-manager';

interface SnapshotsPanelProps {
  snapshots: WorkflowSnapshot[];
  onCreateSnapshot: () => void;
  onRestoreSnapshot: (snapshot: WorkflowSnapshot) => void;
  onDeleteSnapshot: (snapshotId: string) => void;
  onClose: () => void;
}

const SnapshotsPanel: React.FC<SnapshotsPanelProps> = ({
  snapshots,
  onCreateSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onClose,
}) => {
  return (
    <div className="absolute top-16 right-16 z-50 w-72 bg-[#1A1A1D]/95 backdrop-blur border border-[#2D2D2D] rounded-xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2 text-white text-sm font-medium">
          <Camera className="w-4 h-4" />
          工作流快照
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onCreateSnapshot}
            className="p-1.5 rounded hover:bg-white/10 text-[#10B981] transition-colors"
            title="创建快照"
          >
            <BookmarkPlus className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {snapshots.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-xs">
            暂无快照，按 <kbd className="px-1.5 py-0.5 bg-[#2D2D2D] rounded text-[10px]">Ctrl+Shift+S</kbd> 创建
          </div>
        ) : (
          snapshots.map(snap => (
            <div key={snap.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/5 border-b border-white/5 last:border-b-0">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{snap.name}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {snap.nodes.length} 节点 · {new Date(snap.timestamp).toLocaleString('zh-CN')}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                <button
                  onClick={() => onRestoreSnapshot(snap)}
                  className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-[#10B981] transition-colors"
                  title="恢复此快照"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDeleteSnapshot(snap.id)}
                  className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-red-400 transition-colors"
                  title="删除快照"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SnapshotsPanel;
