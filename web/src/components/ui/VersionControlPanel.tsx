import { useState, useEffect, useCallback } from 'react';
import { useWorkflowStore, VersionInfo } from '@/store/useWorkflowStore';
import { Save, History, Clock, Settings, Shield, RotateCcw, Trash2, MessageSquare, ChevronDown, ChevronRight, Bookmark, BookmarkCheck, X } from 'lucide-react';

interface VersionControlPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function VersionControlPanel({ isOpen, onClose }: VersionControlPanelProps) {
  const { 
    autoSaveConfig, 
    setAutoSaveConfig, 
    saveVersion, 
    getVersionHistory,
    restoreVersion,
    deleteVersion,
    addVersionNote,
    createCheckpoint
  } = useWorkflowStore();
  const [currentWorkflow, setCurrentWorkflow] = useState<string>('');
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [checkpoints, setCheckpoints] = useState<VersionInfo[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['autoSave', 'versions']));
  const [editingNote, setEditingNote] = useState<{ versionIndex: number; note: string } | null>(null);
  const [_editingTag, _setEditingTag] = useState<{ versionIndex: number; tag: string } | null>(null);
  const [selectedVersions, setSelectedVersions] = useState<number[]>([]);
  
  const loadVersions = useCallback((workflowName: string) => {
    const allVersions = getVersionHistory(workflowName);
    setVersions(allVersions);
    setCheckpoints(allVersions.filter(v => v.isCheckpoint));
  }, [getVersionHistory]);

  useEffect(() => {
    const workflow = localStorage.getItem('current_workflow');
    if (workflow) {
      setCurrentWorkflow(workflow);
      loadVersions(workflow);
    }
  }, [loadVersions]);
  
  const handleSaveVersion = () => {
    if (!currentWorkflow) return;
    saveVersion(currentWorkflow, { 
      note: `手动保存 - ${new Date().toLocaleString()}`
    });
    loadVersions(currentWorkflow);
  };
  
  const handleCreateCheckpoint = () => {
    if (!currentWorkflow) return;
    createCheckpoint(currentWorkflow, `检查点 - ${new Date().toLocaleString()}`);
    loadVersions(currentWorkflow);
  };
  
  const handleRestore = (version: VersionInfo) => {
    if (!currentWorkflow) return;
    if (confirm(`确定要恢复到版本 V${version.version} 吗？当前未保存的更改将会丢失。`)) {
      restoreVersion(currentWorkflow, version.version - 1);
      loadVersions(currentWorkflow);
    }
  };
  
  const handleDelete = (version: VersionInfo) => {
    if (!currentWorkflow) return;
    if (version.isCheckpoint) {
      if (!confirm('确定要删除这个检查点吗？')) return;
    }
    deleteVersion(currentWorkflow, version.version - 1);
    loadVersions(currentWorkflow);
  };
  
  const handleAddNote = (versionIndex: number) => {
    if (!currentWorkflow || !editingNote) return;
    addVersionNote(currentWorkflow, versionIndex, editingNote.note);
    setEditingNote(null);
    loadVersions(currentWorkflow);
  };
  
  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };
  
  const getVersionIcon = (version: VersionInfo) => {
    if (version.isCheckpoint) {
      return <BookmarkCheck className="w-4 h-4 text-yellow-400" />;
    }
    if (version.isAutoSaved) {
      return <Clock className="w-4 h-4 text-gray-400" />;
    }
    return <Save className="w-4 h-4 text-green-400" />;
  };
  
  const getVersionBadge = (version: VersionInfo) => {
    if (version.isCheckpoint) {
      return <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-300 text-xs rounded-full">检查点</span>;
    }
    if (version.isAutoSaved) {
      return <span className="px-2 py-0.5 bg-gray-500/20 text-gray-300 text-xs rounded-full">自动</span>;
    }
    return <span className="px-2 py-0.5 bg-green-500/20 text-green-300 text-xs rounded-full">手动</span>;
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1F1F1F] rounded-2xl border border-white/10 w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">版本控制</h2>
              <p className="text-sm text-white/70">保护您的作品，记录每一次创作</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
            <X className="w-5 h-5 text-white/80" />
          </button>
        </div>
        
        <div className="flex h-[calc(85vh-120px)]">
          {/* 左侧配置面板 */}
          <div className="w-80 p-4 border-r border-white/10 overflow-y-auto">
            {/* 自动保存设置 */}
            <div className="mb-6">
              <button
                onClick={() => toggleSection('autoSave')}
                className="w-full flex items-center justify-between mb-3"
              >
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Settings className="w-4 h-4 text-purple-400" />
                  自动保存设置
                </h3>
                {expandedSections.has('autoSave') ? 
                  <ChevronDown className="w-4 h-4 text-white/60" /> : 
                  <ChevronRight className="w-4 h-4 text-white/60" />
                }
              </button>
              
              {expandedSections.has('autoSave') && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="autoSaveEnabled"
                      checked={autoSaveConfig.enabled}
                      onChange={(e) => setAutoSaveConfig({ enabled: e.target.checked })}
                      className="w-4 h-4 text-purple-500 bg-[#2A2A2A] border-white/10 rounded focus:ring-purple-500"
                    />
                    <label htmlFor="autoSaveEnabled" className="text-sm text-white/80">
                      启用自动保存
                    </label>
                  </div>
                  
                  {autoSaveConfig.enabled && (
                    <>
                      <div>
                        <label className="block text-sm text-white/70 mb-1">保存间隔</label>
                        <select
                          value={autoSaveConfig.intervalMinutes}
                          onChange={(e) => setAutoSaveConfig({ intervalMinutes: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 bg-[#2A2A2A] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
                        >
                          <option value="1">每 1 分钟</option>
                          <option value="5">每 5 分钟</option>
                          <option value="10">每 10 分钟</option>
                          <option value="15">每 15 分钟</option>
                          <option value="30">每 30 分钟</option>
                        </select>
                      </div>
                        
                      <div>
                        <label className="block text-sm text-white/70 mb-1">最大版本数</label>
                        <input
                          type="number"
                          min="10"
                          max="100"
                          value={autoSaveConfig.maxVersions}
                          onChange={(e) => setAutoSaveConfig({ maxVersions: parseInt(e.target.value) || 50 })}
                          className="w-full px-3 py-2 bg-[#2A2A2A] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      
                      <div className="flex items-center gap-3 pt-2 border-t border-white/10">
                        <input
                          type="checkbox"
                          id="checkpointBeforeExecute"
                          checked={autoSaveConfig.createCheckpointBeforeExecute}
                          onChange={(e) => setAutoSaveConfig({ createCheckpointBeforeExecute: e.target.checked })}
                          className="w-4 h-4 text-purple-500 bg-[#2A2A2A] border-white/10 rounded focus:ring-purple-500"
                        />
                        <label htmlFor="checkpointBeforeExecute" className="text-sm text-white/80">
                          执行前创建检查点
                        </label>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="checkpointBeforeDelete"
                          checked={autoSaveConfig.createCheckpointBeforeDelete}
                          onChange={(e) => setAutoSaveConfig({ createCheckpointBeforeDelete: e.target.checked })}
                          className="w-4 h-4 text-purple-500 bg-[#2A2A2A] border-white/10 rounded focus:ring-purple-500"
                        />
                        <label htmlFor="checkpointBeforeDelete" className="text-sm text-white/80">
                          删除前创建检查点
                        </label>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            
            {/* 快速操作 */}
            <div className="mb-6">
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-yellow-400" />
                快速操作
              </h3>
              <div className="space-y-2">
                <button
                  onClick={handleSaveVersion}
                  disabled={!currentWorkflow}
                  className="w-full px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  保存当前版本
                </button>
                <button
                  onClick={handleCreateCheckpoint}
                  disabled={!currentWorkflow}
                  className="w-full px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <BookmarkCheck className="w-4 h-4" />
                  创建检查点
                </button>
              </div>
            </div>
            
            {/* 检查点列表 */}
            {checkpoints.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <BookmarkCheck className="w-4 h-4 text-yellow-400" />
                  检查点 ({checkpoints.length})
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {checkpoints.map(cp => (
                    <div
                      key={cp.id}
                      className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg"
                    >
                      <div className="text-xs text-yellow-300">
                        V{cp.version} - {new Date(cp.date).toLocaleString()}
                      </div>
                      {cp.note && (
                        <div className="text-xs text-white/60 mt-1 truncate">
                          {cp.note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* 右侧版本历史 */}
          <div className="flex-1 p-4 overflow-y-auto bg-[#1A1A1A]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-purple-400" />
                版本历史 ({versions.length})
              </h3>
              {currentWorkflow && (
                <div className="text-sm text-white/60">
                  工作流: <span className="text-purple-300">{currentWorkflow}</span>
                </div>
              )}
            </div>
            
            {versions.length === 0 ? (
              <div className="text-center py-16">
                <History className="w-16 h-16 mx-auto mb-4 text-white/20" />
                <p className="text-white/50 mb-2">暂无版本记录</p>
                <p className="text-white/30 text-sm">点击&quot;保存当前版本&quot;或启用自动保存来创建第一个版本</p>
              </div>
            ) : (
              <div className="space-y-3">
                {versions.map((version, index) => (
                  <div
                    key={version.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      version.isCheckpoint 
                        ? 'bg-yellow-500/5 border-yellow-500/20' 
                        : version.isAutoSaved 
                          ? 'bg-gray-500/5 border-gray-500/20'
                          : 'bg-white/5 border-white/10'
                    } ${selectedVersions.includes(index) ? 'ring-2 ring-purple-500' : ''}`}
                    onClick={() => {
                      if (selectedVersions.length === 2 || selectedVersions.includes(index)) {
                        setSelectedVersions([]);
                      } else {
                        setSelectedVersions([index]);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getVersionIcon(version)}
                        <span className="text-white font-medium">V{version.version}</span>
                        {getVersionBadge(version)}
                        {version.tags && version.tags.length > 0 && (
                          <div className="flex gap-1">
                            {version.tags.map(tag => (
                              <span key={tag} className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {selectedVersions.length === 1 && selectedVersions[0] === index && (
                          <span className="text-xs text-purple-300 mr-2">已选择</span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestore(version);
                          }}
                          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-green-400"
                          title="恢复此版本"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingNote({ versionIndex: index, note: version.note || '' });
                          }}
                          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/60"
                          title="添加备注"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(version);
                          }}
                          className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors text-red-400"
                          title="删除版本"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="text-xs text-white/60 mb-2">
                      {new Date(version.date).toLocaleString()}
                    </div>
                    
                    {version.note && (
                      <div className="text-sm text-white/80 mt-2 p-2 bg-white/5 rounded">
                        {version.note}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-4 mt-2 text-xs text-white/40">
                      <span>{version.nodes.length} 个节点</span>
                      <span>{version.edges.length} 条边</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* 底部操作栏 */}
        <div className="p-4 border-t border-white/10 flex items-center justify-between">
          <div className="text-sm text-white/60">
            共 {versions.length} 个版本 | 检查点 {checkpoints.length} 个
            {autoSaveConfig.enabled && (
              <span className="ml-2 text-green-400">
                ● 自动保存已启用（每 {autoSaveConfig.intervalMinutes} 分钟）
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
        
        {/* 备注编辑弹窗 */}
        {editingNote && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-[#2A2A2A] rounded-xl p-6 w-full max-w-md border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">编辑版本备注</h3>
              <textarea
                value={editingNote.note}
                onChange={(e) => setEditingNote({ ...editingNote, note: e.target.value })}
                placeholder="输入版本备注..."
                className="w-full px-3 py-2 bg-[#1A1A1A] border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-purple-500 mb-4"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingNote(null)}
                  className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => handleAddNote(editingNote.versionIndex)}
                  className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
