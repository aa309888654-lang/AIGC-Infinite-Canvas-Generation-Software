import { useState } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import { Save, FolderOpen, Trash2, RotateCcw, RotateCw, X } from 'lucide-react';

interface WorkflowPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const WorkflowPanel = ({ isOpen, onClose }: WorkflowPanelProps) => {
  const { undo, redo, history, resetCanvas } = useCanvasStore();
  const { saveWorkflow, loadWorkflow, getSavedWorkflows, deleteWorkflow } = useWorkflowStore();
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [savedWorkflows, setSavedWorkflows] = useState(() => getSavedWorkflows());

  if (!isOpen) return null;

  const handleSave = () => {
    if (!newWorkflowName.trim()) return;
    saveWorkflow(newWorkflowName.trim());
    setSavedWorkflows(getSavedWorkflows());
    setNewWorkflowName('');
  };

  const handleLoad = (name: string) => {
    loadWorkflow(name);
    onClose();
  };

  const handleDelete = (name: string) => {
    if (confirm(`确定删除工作流 "${name}" 吗？`)) {
      deleteWorkflow(name);
      setSavedWorkflows(getSavedWorkflows());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1F1F1F] rounded-2xl border border-white/10 w-full max-w-lg overflow-hidden shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#007AFF] to-[#5856D6]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">工作流管理</h2>
              <p className="text-sm text-white/70">保存和加载您的工作流</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
            <X className="w-5 h-5 text-white/80" />
          </button>
        </div>

        {/* 工作流内容 */}
        <>
          {/* 快捷操作 */}
          <div className="px-6 py-4 border-b border-white/10">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-white/60">快捷操作：</span>
              <button
                onClick={undo}
                disabled={history.past.length === 0}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="text-white/80">撤销</span>
              </button>
              <button
                onClick={redo}
                disabled={history.future.length === 0}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <RotateCw className="w-3 h-3" />
                <span className="text-white/80">重做</span>
              </button>
              <button
                onClick={() => { if (confirm('确定清空画布吗？')) resetCanvas(); }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400"
              >
                <Trash2 className="w-3 h-3" />
                <span>清空</span>
              </button>
            </div>

            {/* 保存新工作流 */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newWorkflowName}
                onChange={(e) => setNewWorkflowName(e.target.value)}
                placeholder="输入工作流名称"
                className="flex-1 px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40"
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
              <button
                onClick={handleSave}
                disabled={!newWorkflowName.trim()}
                className="flex items-center gap-1 px-4 py-2 bg-[#007AFF] hover:bg-[#0056CC] disabled:opacity-50 rounded-lg text-white text-sm"
              >
                <Save className="w-4 h-4" />
                保存
              </button>
            </div>
          </div>

          {/* 已保存的工作流列表 */}
          <div className="p-4 max-h-64 overflow-y-auto">
            <h3 className="text-sm font-medium text-white/80 mb-3">已保存的工作流 ({savedWorkflows.length})</h3>
            {savedWorkflows.length === 0 ? (
              <p className="text-sm text-white/40 text-center py-4">暂无保存的工作流</p>
            ) : (
              <div className="space-y-2">
                {savedWorkflows.map((wf) => (
                  <div
                    key={wf.name}
                    className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-lg group"
                  >
                    <div className="flex-1 cursor-pointer" onClick={() => handleLoad(wf.name)}>
                      <div className="text-sm text-white">{wf.name}</div>
                      <div className="text-xs text-white/40">{new Date(wf.date).toLocaleString()}</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(wf.name); }}
                      className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      </div>
    </div>
  );
};

export default WorkflowPanel;