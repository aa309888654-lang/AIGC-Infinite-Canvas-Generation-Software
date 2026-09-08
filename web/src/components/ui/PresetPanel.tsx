import { useState } from 'react';
import { Save, Trash2, PlayCircle as Play, X, Plus } from 'lucide-react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useConfigStore } from '@/store/useConfigStore';

interface PresetPanelProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId?: string;
  nodeType?: string;
  currentParams?: Record<string, unknown>;
}

const PresetPanel = ({ isOpen, onClose, nodeId, nodeType }: PresetPanelProps) => {
  const { selectedNodeId, nodes, updateNodeData } = useCanvasStore();
  const { nodePresets, saveNodePreset, deleteNodePreset, applyNodePreset } = useConfigStore();
  const [presetName, setPresetName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);

  // 筛选当前节点类型的预设
  const filteredPresets = nodeType 
    ? nodePresets.filter(p => p.nodeType === nodeType)
    : nodePresets;

  // 获取当前选中节点的类型和参数
  const activeNode = nodes.find(n => n.id === (nodeId || selectedNodeId));
  const activeNodeType = activeNode?.data?.type as string;
  const activeNodeParams = activeNode?.data?.params;

  const handleSavePreset = () => {
    if (!presetName.trim() || !activeNodeType || !activeNodeParams) return;
    
    saveNodePreset({
      name: presetName,
      nodeType: activeNodeType,
      params: { ...((activeNodeParams as Record<string, unknown>) || {}) },
    });
    
    setPresetName('');
    setShowSaveForm(false);
  };

  const handleApplyPreset = (presetId: string) => {
    const targetNodeId = nodeId || selectedNodeId;
    if (targetNodeId) {
      applyNodePreset(presetId, targetNodeId, updateNodeData, nodes);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1F1F1F] rounded-2xl border border-white/10 w-full max-w-md overflow-hidden shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#4B21FF] to-[#AF52DE]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Save className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">参数预设</h2>
              <p className="text-sm text-white/70">保存和加载节点参数配置</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
            <X className="w-5 h-5 text-white/80" />
          </button>
        </div>

        {/* 当前节点信息 */}
        {activeNode ? (
          <div className="px-6 py-3 border-b border-white/10 bg-white/5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-white/50">当前节点:</span>
                <span className="text-sm text-white ml-2">{activeNodeType}</span>
              </div>
              <button
                onClick={() => setShowSaveForm(!showSaveForm)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#4B21FF] hover:bg-[#5B31EF] rounded-lg text-white transition-colors"
              >
                <Plus className="w-3 h-3" />
                保存当前
              </button>
            </div>
            
            {/* 保存预设表单 */}
            {showSaveForm && (
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="输入预设名称..."
                  className="flex-1 px-3 py-2 text-sm bg-[#2A2A2A] border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#4B21FF]"
                  autoFocus
                />
                <button
                  onClick={handleSavePreset}
                  disabled={!presetName.trim()}
                  className="px-4 py-2 text-sm bg-[#10B981] hover:bg-[#20C997] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
                >
                  保存
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="px-6 py-3 border-b border-white/10 text-sm text-white/50">
            请先选择一个节点
          </div>
        )}

        {/* 预设列表 */}
        <div className="max-h-80 overflow-y-auto">
          {filteredPresets.length === 0 ? (
            <div className="text-center py-8 text-white/40">
              <Save className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>暂无保存的预设</p>
            </div>
          ) : (
            <div className="p-2">
              {filteredPresets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 group"
                >
                  <div className="flex-1">
                    <div className="text-sm text-white">{preset.name}</div>
                    <div className="text-xs text-white/40">
                      {preset.nodeType} · {new Date(preset.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleApplyPreset(preset.id)}
                      disabled={!selectedNodeId && !nodeId}
                      className="p-2 hover:bg-white/10 rounded-lg disabled:opacity-30"
                      title="应用预设"
                    >
                      <Play className="w-4 h-4 text-[#10B981]" />
                    </button>
                    <button
                      onClick={() => deleteNodePreset(preset.id)}
                      className="p-2 hover:bg-white/10 rounded-lg"
                      title="删除预设"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部提示 */}
        <div className="px-6 py-3 border-t border-white/10 text-xs text-white/40">
          提示: 选择节点后，可以保存当前参数为预设，或从预设列表中选择应用
        </div>
      </div>
    </div>
  );
};

export default PresetPanel;
