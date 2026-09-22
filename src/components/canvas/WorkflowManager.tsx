import { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Save, FolderOpen, Download, Trash2, FileJson, Clock, X } from 'lucide-react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import { cn } from '@/lib/utils';

interface WorkflowManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const WorkflowManager = ({ isOpen, onClose }: WorkflowManagerProps) => {
  const [workflowName, setWorkflowName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'saved' | 'templates'>('saved');
  
  const { saveWorkflow, loadWorkflow, getSavedWorkflows, deleteWorkflow } = useWorkflowStore();
  const { nodes, edges } = useCanvasStore();

  const savedWorkflows = useMemo(() => getSavedWorkflows(), [getSavedWorkflows]);

  const handleSave = useCallback(() => {
    if (!workflowName.trim()) return;
    
    setIsSaving(true);
    setTimeout(() => {
      saveWorkflow(workflowName.trim());
      setWorkflowName('');
      setIsSaving(false);
    }, 300);
  }, [workflowName, saveWorkflow]);

  const handleLoad = useCallback((name: string) => {
    loadWorkflow(name);
    onClose();
  }, [loadWorkflow, onClose]);

  const handleDelete = useCallback((name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`确定要删除工作流 "${name}" 吗？`)) {
      deleteWorkflow(name);
    }
  }, [deleteWorkflow]);

  const handleExport = useCallback(() => {
    const workflow = {
      nodes,
      edges,
      version: '1.0',
      createdAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges]);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (!isOpen) return null;

  const modal = (
    <div
      className="pointer-events-auto fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#2D2D2D] bg-[#1A1A1D] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2D2D2D]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-[#007AFF] to-[#0056CC] rounded-xl">
              <FileJson className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">工作流管理</h2>
              <p className="text-xs text-gray-400">保存、加载和管理您的工作流</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭工作流管理"
            title="关闭"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-[#2D2D2D] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 标签页 */}
        <div className="flex border-b border-[#2D2D2D]">
          <button
            onClick={() => setActiveTab('saved')}
            className={cn(
              'flex-1 px-6 py-3 text-sm font-medium transition-colors',
              activeTab === 'saved'
                ? 'text-[#007AFF] border-b-2 border-[#007AFF]'
                : 'text-gray-400 hover:text-gray-300'
            )}
          >
            已保存的工作流
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={cn(
              'flex-1 px-6 py-3 text-sm font-medium transition-colors',
              activeTab === 'templates'
                ? 'text-[#007AFF] border-b-2 border-[#007AFF]'
                : 'text-gray-400 hover:text-gray-300'
            )}
          >
            模板
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'saved' ? (
            <>
              {/* 保存新工作流 */}
              <div className="mb-6 p-4 bg-[#222227] rounded-xl border border-[#2D2D2D]">
                <h3 className="text-sm font-medium text-white mb-3">保存当前工作流</h3>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={workflowName}
                    onChange={(e) => setWorkflowName(e.target.value)}
                    placeholder="输入工作流名称..."
                    className="flex-1 px-4 py-2 bg-[#1A1A1D] border border-[#3D3D3D] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]/30"
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  />
                  <button
                    onClick={handleSave}
                    disabled={!workflowName.trim() || isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-[#007AFF] hover:bg-[#0056CC] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? '保存中...' : '保存'}
                  </button>
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2 bg-[#2D2D2D] hover:bg-[#3D3D3D] rounded-lg text-sm font-medium text-white transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    导出
                  </button>
                </div>
              </div>

              {/* 已保存的工作流列表 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-white">
                    工作流列表 ({savedWorkflows.length})
                  </h3>
                </div>
                
                {savedWorkflows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FolderOpen className="w-12 h-12 text-gray-600 mb-3" />
                    <p className="text-sm text-gray-400">还没有保存的工作流</p>
                    <p className="text-xs text-gray-500 mt-1">保存您的第一个工作流开始使用</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {savedWorkflows.map((workflow) => (
                      <button
                        key={workflow.name}
                        onClick={() => handleLoad(workflow.name)}
                        className="w-full flex items-center justify-between p-4 bg-[#222227] hover:bg-[#2D2D2D] rounded-xl border border-[#2D2D2D] transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-10 h-10 bg-[#007AFF]/10 rounded-lg">
                            <FileJson className="w-5 h-5 text-[#007AFF]" />
                          </div>
                          <div className="text-left">
                            <div className="text-sm font-medium text-white">{workflow.name}</div>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <Clock className="w-3 h-3" />
                              {formatDate(workflow.date)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleDelete(workflow.name, e)}
                            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* 模板标签页 */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <button className="p-4 bg-[#222227] hover:bg-[#2D2D2D] rounded-xl border border-[#2D2D2D] text-left transition-all group">
                  <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg mb-3">
                    <span className="text-2xl">🎨</span>
                  </div>
                  <h4 className="text-sm font-medium text-white mb-1">文生图</h4>
                  <p className="text-xs text-gray-400">使用提示词生成图片</p>
                </button>
                <button className="p-4 bg-[#222227] hover:bg-[#2D2D2D] rounded-xl border border-[#2D2D2D] text-left transition-all group">
                  <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-gray-500 to-cyan-500 rounded-lg mb-3">
                    <span className="text-2xl">🎬</span>
                  </div>
                  <h4 className="text-sm font-medium text-white mb-1">文生视频</h4>
                  <p className="text-xs text-gray-400">使用提示词生成视频</p>
                </button>
                <button className="p-4 bg-[#222227] hover:bg-[#2D2D2D] rounded-xl border border-[#2D2D2D] text-left transition-all group">
                  <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg mb-3">
                    <span className="text-2xl">➡️</span>
                  </div>
                  <h4 className="text-sm font-medium text-white mb-1">图生视频</h4>
                  <p className="text-xs text-gray-400">使用图片生成视频</p>
                </button>
                <button className="p-4 bg-[#222227] hover:bg-[#2D2D2D] rounded-xl border border-[#2D2D2D] text-left transition-all group">
                  <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg mb-3">
                    <span className="text-2xl">🔄</span>
                  </div>
                  <h4 className="text-sm font-medium text-white mb-1">首尾帧生成</h4>
                  <p className="text-xs text-gray-400">通过起始帧和结束帧生成</p>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default WorkflowManager;
