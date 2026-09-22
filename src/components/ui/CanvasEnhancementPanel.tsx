import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { X, FolderOpen, StickyNote, Grid3X3, LayoutTemplate, Camera, Bookmark, Plus, Trash2} from 'lucide-react';
import { canvasEnhancementService, NodeGroup, CanvasAnnotation, NodeTemplate, WorkflowSnapshot, CanvasBookmark } from '@/services/canvas-enhancement-service';
import { Node, Edge } from '@xyflow/react';

interface CanvasEnhancementPanelProps {
  isOpen: boolean;
  onClose: () => void;
  nodes?: Node[];
  edges?: Edge[];
  viewport?: { x: number; y: number; zoom: number };
  onNodesChange?: (nodes: Node[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
  onViewportChange?: (viewport: { x: number; y: number; zoom: number }) => void;
  selectedNodes?: string[];
}

type TabType = 'groups' | 'annotations' | 'grid' | 'templates' | 'snapshots' | 'bookmarks';

const CanvasEnhancementPanel: React.FC<CanvasEnhancementPanelProps> = ({
  isOpen,
  onClose,
  nodes,
  edges,
  viewport,
  onNodesChange,
  onEdgesChange,
  onViewportChange,
  selectedNodes,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('groups');
  const [groups, setGroups] = useState<NodeGroup[]>([]);
  const [annotations, setAnnotations] = useState<CanvasAnnotation[]>([]);
  const [templates, setTemplates] = useState<NodeTemplate[]>([]);
  const [snapshots, setSnapshots] = useState<WorkflowSnapshot[]>([]);
  const [bookmarks, setBookmarks] = useState<CanvasBookmark[]>([]);
  const [gridSettings, setGridSettings] = useState(canvasEnhancementService.getGridSettings());
  
  // 编辑状态
  const [_editingGroup, _setEditingGroup] = useState<string | null>(null);
  const [_editingAnnotation, _setEditingAnnotation] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newAnnotationText, setNewAnnotationText] = useState('');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newSnapshotName, setNewSnapshotName] = useState('');
  const [newBookmarkName, setNewBookmarkName] = useState('');

  const loadData = useCallback(() => {
    setGroups(canvasEnhancementService.getAllGroups());
    setAnnotations(canvasEnhancementService.getAllAnnotations());
    setTemplates(canvasEnhancementService.getAllTemplates());
    setSnapshots(canvasEnhancementService.getAllSnapshots());
    setBookmarks(canvasEnhancementService.getAllBookmarks());
    setGridSettings(canvasEnhancementService.getGridSettings());
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  // ==================== 分组功能 ====================
  const handleCreateGroup = () => {
    if (selectedNodes.length === 0) {
      toast.warning('请先选择要分组的节点');
      return;
    }
    const name = newGroupName || `分组 ${groups.length + 1}`;
    canvasEnhancementService.createGroup(name, selectedNodes, nodes);
    setNewGroupName('');
    loadData();
  };

  const handleDeleteGroup = (groupId: string) => {
    canvasEnhancementService.deleteGroup(groupId);
    loadData();
  };

  const handleToggleGroupCollapse = (groupId: string) => {
    canvasEnhancementService.toggleGroupCollapse(groupId);
    loadData();
  };

  // ==================== 注释功能 ====================
  const handleCreateAnnotation = () => {
    if (!newAnnotationText.trim()) return;
    canvasEnhancementService.createAnnotation(newAnnotationText, { x: 100, y: 100 });
    setNewAnnotationText('');
    loadData();
  };

  const handleDeleteAnnotation = (id: string) => {
    canvasEnhancementService.deleteAnnotation(id);
    loadData();
  };

  // ==================== 网格设置 ====================
  const handleUpdateGridSettings = (settings: Partial<typeof gridSettings>) => {
    const newSettings = canvasEnhancementService.updateGridSettings(settings);
    setGridSettings(newSettings);
  };

  // ==================== 模板功能 ====================
  const handleCreateTemplate = () => {
    if (!newTemplateName.trim()) return;
    canvasEnhancementService.createTemplate(
      newTemplateName,
      '自定义模板',
      '自定义',
      nodes,
      edges,
      []
    );
    setNewTemplateName('');
    loadData();
  };

  const handleDeleteTemplate = (id: string) => {
    canvasEnhancementService.deleteTemplate(id);
    loadData();
  };

  const handleInstantiateTemplate = (templateId: string) => {
    const result = canvasEnhancementService.instantiateTemplate(templateId, { x: 100, y: 100 });
    if (result) {
      onNodesChange([...nodes, ...result.nodes]);
      onEdgesChange([...edges, ...result.edges]);
    }
  };

  // ==================== 快照功能 ====================
  const handleCreateSnapshot = () => {
    if (!newSnapshotName.trim()) return;
    canvasEnhancementService.createSnapshot(
      newSnapshotName,
      '工作流快照',
      nodes,
      edges,
      viewport
    );
    setNewSnapshotName('');
    loadData();
  };

  const handleDeleteSnapshot = (id: string) => {
    canvasEnhancementService.deleteSnapshot(id);
    loadData();
  };

  const handleRestoreSnapshot = (snapshotId: string) => {
    const snapshot = canvasEnhancementService.restoreSnapshot(snapshotId);
    if (snapshot) {
      onNodesChange(snapshot.nodes);
      onEdgesChange(snapshot.edges);
      onViewportChange(snapshot.viewport);
    }
  };

  // ==================== 书签功能 ====================
  const handleCreateBookmark = () => {
    if (!newBookmarkName.trim()) return;
    canvasEnhancementService.createBookmark(
      newBookmarkName,
      { x: -viewport.x / viewport.zoom, y: -viewport.y / viewport.zoom },
      viewport.zoom
    );
    setNewBookmarkName('');
    loadData();
  };

  const handleDeleteBookmark = (id: string) => {
    canvasEnhancementService.deleteBookmark(id);
    loadData();
  };

  const handleGoToBookmark = (bookmark: CanvasBookmark) => {
    onViewportChange({
      x: -bookmark.position.x * bookmark.zoom,
      y: -bookmark.position.y * bookmark.zoom,
      zoom: bookmark.zoom,
    });
  };

  const tabs = [
    { id: 'groups' as TabType, label: '分组', icon: FolderOpen },
    { id: 'annotations' as TabType, label: '注释', icon: StickyNote },
    { id: 'grid' as TabType, label: '网格', icon: Grid3X3 },
    { id: 'templates' as TabType, label: '模板', icon: LayoutTemplate },
    { id: 'snapshots' as TabType, label: '快照', icon: Camera },
    { id: 'bookmarks' as TabType, label: '书签', icon: Bookmark },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#1F1F1F] rounded-2xl w-[700px] max-h-[80vh] overflow-hidden shadow-2xl border border-[#333333]">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-[#333333]">
          <div>
            <h2 className="text-xl font-bold text-white">画布增强工具</h2>
            <p className="text-sm text-white/60">节点分组、注释、模板、快照、书签</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center">
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* 标签页 */}
        <div className="flex border-b border-[#333333] bg-[#1A1A1A]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-[#10B981] border-b-2 border-[#10B981] bg-[#10B981]/10'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* 内容区域 */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {/* 分组 */}
          {activeTab === 'groups' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="分组名称"
                  className="flex-1 bg-[#2A2A2A] border border-[#333333] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#10B981]"
                />
                <button
                  onClick={handleCreateGroup}
                  disabled={selectedNodes.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  创建分组
                </button>
              </div>
              <p className="text-xs text-white/40">提示：先在画布上选择节点，然后创建分组</p>

              <div className="space-y-2">
                {groups.map((group) => (
                  <div key={group.id} className="flex items-center justify-between p-3 bg-[#2A2A2A] rounded-lg border border-[#333333]">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: group.color }} />
                      <div>
                        <span className="text-white font-medium">{group.name}</span>
                        <span className="text-white/40 text-sm ml-2">({group.nodeIds.length} 个节点)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleGroupCollapse(group.id)}
                        className="p-1.5 hover:bg-white/10 rounded text-white/60 hover:text-white"
                      >
                        {group.isCollapsed ? '展开' : '折叠'}
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        className="p-1.5 hover:bg-red-500/20 rounded text-white/60 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {groups.length === 0 && (
                  <p className="text-center text-white/40 py-8">暂无分组</p>
                )}
              </div>
            </div>
          )}

          {/* 注释 */}
          {activeTab === 'annotations' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAnnotationText}
                  onChange={(e) => setNewAnnotationText(e.target.value)}
                  placeholder="注释内容"
                  className="flex-1 bg-[#2A2A2A] border border-[#333333] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#10B981]"
                />
                <button
                  onClick={handleCreateAnnotation}
                  className="flex items-center gap-2 px-4 py-2 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  添加注释
                </button>
              </div>

              <div className="space-y-2">
                {annotations.map((annotation) => (
                  <div key={annotation.id} className="flex items-center justify-between p-3 bg-[#2A2A2A] rounded-lg border border-[#333333]">
                    <div className="flex items-center gap-3 flex-1">
                      <StickyNote className="w-5 h-5 text-[#00E5FF]" />
                      <span className="text-white">{annotation.text}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteAnnotation(annotation.id)}
                      className="p-1.5 hover:bg-red-500/20 rounded text-white/60 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {annotations.length === 0 && (
                  <p className="text-center text-white/40 py-8">暂无注释</p>
                )}
              </div>
            </div>
          )}

          {/* 网格设置 */}
          {activeTab === 'grid' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-[#2A2A2A] rounded-lg">
                <div>
                  <h4 className="text-white font-medium">启用网格</h4>
                  <p className="text-sm text-white/60">显示网格背景</p>
                </div>
                <button
                  onClick={() => handleUpdateGridSettings({ enabled: !gridSettings.enabled })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    gridSettings.enabled ? 'bg-[#10B981]' : 'bg-[#333333]'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    gridSettings.enabled ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#2A2A2A] rounded-lg">
                <div>
                  <h4 className="text-white font-medium">网格吸附</h4>
                  <p className="text-sm text-white/60">节点自动对齐到网格</p>
                </div>
                <button
                  onClick={() => handleUpdateGridSettings({ snap: !gridSettings.snap })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    gridSettings.snap ? 'bg-[#10B981]' : 'bg-[#333333]'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    gridSettings.snap ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#2A2A2A] rounded-lg">
                <div>
                  <h4 className="text-white font-medium">对齐辅助线</h4>
                  <p className="text-sm text-white/60">显示节点对齐辅助线</p>
                </div>
                <button
                  onClick={() => handleUpdateGridSettings({ alignmentGuides: !gridSettings.alignmentGuides })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    gridSettings.alignmentGuides ? 'bg-[#10B981]' : 'bg-[#333333]'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    gridSettings.alignmentGuides ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              <div className="p-4 bg-[#2A2A2A] rounded-lg">
                <h4 className="text-white font-medium mb-3">网格大小</h4>
                <input
                  type="range"
                  min="10"
                  max="50"
                  step="5"
                  value={gridSettings.size}
                  onChange={(e) => handleUpdateGridSettings({ size: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-white/60 mt-2">
                  <span>小</span>
                  <span>{gridSettings.size}px</span>
                  <span>大</span>
                </div>
              </div>
            </div>
          )}

          {/* 模板 */}
          {activeTab === 'templates' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="模板名称"
                  className="flex-1 bg-[#2A2A2A] border border-[#333333] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#10B981]"
                />
                <button
                  onClick={handleCreateTemplate}
                  className="flex items-center gap-2 px-4 py-2 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  保存模板
                </button>
              </div>
              <p className="text-xs text-white/40">将当前画布保存为可复用的模板</p>

              <div className="space-y-2">
                {templates.map((template) => (
                  <div key={template.id} className="flex items-center justify-between p-3 bg-[#2A2A2A] rounded-lg border border-[#333333]">
                    <div>
                      <span className="text-white font-medium">{template.name}</span>
                      <span className="text-white/40 text-sm ml-2">({template.category})</span>
                      <p className="text-xs text-white/40 mt-1">{template.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleInstantiateTemplate(template.id)}
                        className="px-3 py-1.5 bg-[#9CA3AF] hover:bg-[#6B7280] text-white rounded text-sm transition-colors"
                      >
                        使用
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="p-1.5 hover:bg-red-500/20 rounded text-white/60 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {templates.length === 0 && (
                  <p className="text-center text-white/40 py-8">暂无模板</p>
                )}
              </div>
            </div>
          )}

          {/* 快照 */}
          {activeTab === 'snapshots' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSnapshotName}
                  onChange={(e) => setNewSnapshotName(e.target.value)}
                  placeholder="快照名称"
                  className="flex-1 bg-[#2A2A2A] border border-[#333333] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#10B981]"
                />
                <button
                  onClick={handleCreateSnapshot}
                  className="flex items-center gap-2 px-4 py-2 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  保存快照
                </button>
              </div>

              <div className="space-y-2">
                {snapshots.map((snapshot) => (
                  <div key={snapshot.id} className="flex items-center justify-between p-3 bg-[#2A2A2A] rounded-lg border border-[#333333]">
                    <div>
                      <span className="text-white font-medium">{snapshot.name}</span>
                      <span className="text-white/40 text-sm ml-2">
                        ({snapshot.nodes.length} 节点, {snapshot.edges.length} 连接)
                      </span>
                      <p className="text-xs text-white/40 mt-1">
                        {new Date(snapshot.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRestoreSnapshot(snapshot.id)}
                        className="px-3 py-1.5 bg-[#00E5FF] hover:bg-[#7C3AED] text-white rounded text-sm transition-colors"
                      >
                        恢复
                      </button>
                      <button
                        onClick={() => handleDeleteSnapshot(snapshot.id)}
                        className="p-1.5 hover:bg-red-500/20 rounded text-white/60 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {snapshots.length === 0 && (
                  <p className="text-center text-white/40 py-8">暂无快照</p>
                )}
              </div>
            </div>
          )}

          {/* 书签 */}
          {activeTab === 'bookmarks' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newBookmarkName}
                  onChange={(e) => setNewBookmarkName(e.target.value)}
                  placeholder="书签名称"
                  className="flex-1 bg-[#2A2A2A] border border-[#333333] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#10B981]"
                />
                <button
                  onClick={handleCreateBookmark}
                  className="flex items-center gap-2 px-4 py-2 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Bookmark className="w-4 h-4" />
                  添加书签
                </button>
              </div>
              <p className="text-xs text-white/40">在当前视图位置创建书签，方便快速定位</p>

              <div className="space-y-2">
                {bookmarks.map((bookmark) => (
                  <div key={bookmark.id} className="flex items-center justify-between p-3 bg-[#2A2A2A] rounded-lg border border-[#333333]">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: bookmark.color }} />
                      <span className="text-white font-medium">{bookmark.name}</span>
                      <span className="text-white/40 text-sm">
                        (缩放: {(bookmark.zoom * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleGoToBookmark(bookmark)}
                        className="px-3 py-1.5 bg-[#9CA3AF] hover:bg-[#6B7280] text-white rounded text-sm transition-colors"
                      >
                        跳转
                      </button>
                      <button
                        onClick={() => handleDeleteBookmark(bookmark.id)}
                        className="p-1.5 hover:bg-red-500/20 rounded text-white/60 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {bookmarks.length === 0 && (
                  <p className="text-center text-white/40 py-8">暂无任何书签</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CanvasEnhancementPanel;
