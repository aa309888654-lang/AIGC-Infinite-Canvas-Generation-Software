import { useState, useRef, useEffect, useCallback } from 'react';
import { cn, generateId } from '@/lib/utils';
import { useCanvasStore } from '@/store/useCanvasStore';
import { buildNodeDataFromDefinition, NODE_TYPES } from '@/types/node-system';
import { useVirtualRenderStore } from '@/store/useVirtualRenderStore';


import { useWorkflowStore } from '@/store/useWorkflowStore';
import SettingsPanel from '@/components/settings/SettingsPanel';

type Tab = 'nodes' | 'settings' | 'favorites';

const getCenterPosition = () => {
  const sidebarWidth = 280;
  const headerHeight = 40;
  const nodeWidth = 200;
  const nodeHeight = 400;
  
  const canvasWidth = window.innerWidth - sidebarWidth;
  const canvasHeight = window.innerHeight - headerHeight;
  
  return {
    x: Math.max(0, (canvasWidth - nodeWidth) / 2),
    y: Math.max(0, (canvasHeight - nodeHeight) / 2),
  };
};

const Sidebar = () => {
  const [activeTab, setActiveTab] = useState<Tab>('nodes');
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(160);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['ai-generation', 'input', 'result-output'])
  );

  const { addNode, setSelectedNodeId, setSelectedNodeIds } = useCanvasStore();
  const { loadWorkflow, getSavedWorkflows, deleteWorkflow } = useWorkflowStore();
  const [savedWorkflows, setSavedWorkflows] = useState(() => getSavedWorkflows());

  const addNodeWithVisibility = useCallback(
    (node: Parameters<typeof addNode>[0]) => {
      addNode(node);
      setSelectedNodeId(node.id);
      setSelectedNodeIds([node.id]);
      try {
        useVirtualRenderStore.getState().addRecentlyAddedNode(node.id);
      } catch {
        /* ignore */
      }
    },
    [addNode, setSelectedNodeId, setSelectedNodeIds],
  );

  // 切换到收藏标签页时自动刷新
  useEffect(() => {
    if (activeTab === 'favorites') {
      setSavedWorkflows(getSavedWorkflows());
    }
  }, [activeTab, getSavedWorkflows]);

  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const addNodeFromDefinition = useCallback(
    (nodeType: string, extraData: Record<string, unknown> = {}) => {
      const definition = NODE_TYPES.find((node) => node.id === nodeType);
      const centerPos = getCenterPosition();
      const offsetX = (Math.random() - 0.5) * 200;
      const offsetY = (Math.random() - 0.5) * 100;
      addNodeWithVisibility({
        id: generateId(),
        type: nodeType,
        position: { x: centerPos.x + offsetX, y: centerPos.y + offsetY },
        data: {
          ...(definition ? buildNodeDataFromDefinition(definition) : {}),
          type: nodeType,
          isExpanded: true,
          ...extraData,
        },
      });
    },
    [addNodeWithVisibility]
  );

  // 节点添加函数
  const addGridDirectorNode = () => {
    addNodeFromDefinition('gridDirector');
  };

  const addCharacterLibraryNode = () => {
    addNodeFromDefinition('characterLibrary');
  };

  const addCharacterConsistencyNode = () => {
    addNodeFromDefinition('characterConsistency');
  };

  const addBatchProcessNode = () => {
    addNodeFromDefinition('batchProcess');
  };

  const addDirector3DNode = () => {
    addNodeFromDefinition('director3D');
  };

  const addPanorama360Node = () => {
    addNodeFromDefinition('panorama360');
  };

  const addImageCollageNode = () => {
    addNodeFromDefinition('imageCollage');
  };

  const addImageGenNode = () => {
    addNodeFromDefinition('aiImage');
  };

  const addImageInputNode = () => {
    const centerPos = getCenterPosition();
    // 生成随机偏移，确保节点不重叠
    const offsetX = (Math.random() - 0.5) * 200;
    const offsetY = (Math.random() - 0.5) * 100;
    addNodeWithVisibility({
      id: generateId(),
      type: 'imageInput',
      position: { x: centerPos.x + offsetX, y: centerPos.y + offsetY },
      data: {
        type: 'imageInput' as const,
        imageUrl: undefined,
        fileName: undefined,
        isExpanded: true,
      },
    });
  };

  const addAIGenTextNode = () => {
    const centerPos = getCenterPosition();
    const offsetX = (Math.random() - 0.5) * 200;
    const offsetY = (Math.random() - 0.5) * 100;
    addNodeWithVisibility({
      id: generateId(),
      type: 'aiGenText',
      position: { x: centerPos.x + offsetX, y: centerPos.y + offsetY },
      data: {
        type: 'aiGenText' as const,
        prompt: '',
        outputText: '',
        model: 'deepseek-v4-flash',
        variableName: 'text_output',
        isExpanded: true,
        task: { status: 'idle' },
      },
    });
  };

  const addVideoInputNode = () => {
    const centerPos = getCenterPosition();
    // 生成随机偏移，确保节点不重叠
    const offsetX = (Math.random() - 0.5) * 200;
    const offsetY = (Math.random() - 0.5) * 100;
    addNodeWithVisibility({
      id: generateId(),
      type: 'videoInput',
      position: { x: centerPos.x + offsetX, y: centerPos.y + offsetY },
      data: {
        type: 'videoInput' as const,
        videoUrl: undefined,
        fileName: undefined,
        isExpanded: true,
      },
    });
  };

  const addPromptNode = () => {
    const centerPos = getCenterPosition();
    // 生成随机偏移，确保节点不重叠
    const offsetX = (Math.random() - 0.5) * 200;
    const offsetY = (Math.random() - 0.5) * 100;
    addNodeWithVisibility({
      id: generateId(),
      type: 'prompt',
      position: { x: centerPos.x + offsetX, y: centerPos.y + offsetY },
      data: {
        type: 'prompt' as const,
        prompt: '',
        negativePrompt: '',
        isExpanded: true,
      },
    });
  };

  const addVideoGenNode = () => {
    addNodeFromDefinition('aiVideo');
  };

  const addOutputNode = () => {
    const centerPos = getCenterPosition();
    addNodeWithVisibility({
      id: generateId(),
      type: 'output',
      position: { x: centerPos.x, y: centerPos.y },
      data: {
        type: 'output' as const,
        label: '输出',
        isExpanded: false,
      },
    });
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = sidebarWidth;
    document.body.style.cursor = 'col-resize';
  }, [sidebarWidth]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging.current) {
      const deltaX = e.clientX - startX.current;
      const newWidth = Math.max(120, Math.min(280, startWidth.current + deltaX));
      setSidebarWidth(newWidth);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = 'default';
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // 节点分组定义
  const nodeGroups = [
    {
      id: 'ai-generation',
      name: 'AI生成',
      color: '#10B981',
      nodes: [
        { id: 'aiImage', name: 'AI图片', color: '#8B5CF6', action: addImageGenNode, desc: '统一 AI 图片生成入口' },
        { id: 'gridDirector', name: '分镜导演', color: '#F59E0B', action: addGridDirectorNode, desc: '宫格/分镜/混合三种模式' },
        { id: 'imageCollage', name: '图片拼接', color: '#F59E0B', action: addImageCollageNode, desc: '多图拼图拼接' },
        { id: 'characterLibrary', name: '角色库', color: '#8B5CF6', action: addCharacterLibraryNode, desc: '输出角色参考与资产 payload' },
        { id: 'aiVideo', name: 'AI视频', color: '#E91E63', action: addVideoGenNode, desc: '统一 AI 视频生成入口' },
      ]
    },
    {
      id: 'input',
      name: '输入节点',
      color: '#007AFF',
      nodes: [
        { id: 'imageInput', name: '图片输入', color: '#007AFF', action: addImageInputNode, desc: '上传本地图片' },
        { id: 'videoInput', name: '视频输入', color: '#3498DB', action: addVideoInputNode, desc: '上传本地视频' },
        { id: 'prompt', name: '提示词', color: '#10B981', action: addPromptNode, desc: '提示词输入' },
        { id: 'aiGenText', name: '生成文本', color: '#7c3aed', action: addAIGenTextNode, desc: '输入或 AI 生成文本' },
      ]
    },
    {
      id: 'result-output',
      name: '结果导出',
      color: '#F59E0B',
      nodes: [
        { id: 'characterConsistency', name: '角色一致性', color: '#10B981', action: addCharacterConsistencyNode, desc: '角色特征统一与跨镜头保持' },
        { id: 'batchProcess', name: '批量处理', color: '#6366F1', action: addBatchProcessNode, desc: '工作流批处理与结果收集' },
      ]
    },
    {
      id: '3d-nodes',
      name: '3D场景',
      color: '#8B5CF6',
      nodes: [
        { id: 'director3D', name: '3D导演台', color: '#8B5CF6', action: addDirector3DNode, desc: '3D场景编辑·多机位·相机提示词' },
        { id: 'panorama360', name: '360°全景图', color: '#06B6D4', action: addPanorama360Node, desc: '360度全景浏览·视角控制' },
      ]
    },
    {
      id: 'control',
      name: '控制节点',
      color: '#00E5FF',
      nodes: [
        { id: 'output', name: '输出节点', color: '#00E5FF', action: addOutputNode, desc: '输出最终结果' },
      ]
    }
  ];

  const tabs = [
    { id: 'nodes' as Tab, label: '节点库' },
    { id: 'favorites' as Tab, label: '收藏' },
    { id: 'settings' as Tab, label: '设置' },
  ];

  return (
    <>
      <div
        className={cn(
          "h-[calc(100%-56px)] flex flex-col fixed left-0 top-14 z-40 bg-black backdrop-blur-md border-r border-white/10 transition-transform duration-300",
          sidebarWidth === 0 ? "-translate-x-full" : "translate-x-0"
        )}
        style={{ width: `${sidebarWidth || 160}px` }}
      >
        {/* 关闭按钮和标题 */}
        <div className="flex items-center justify-between p-3 border-b border-white/5">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'sidebar-tab flex-1 py-1.5 px-2 text-xs truncate',
                  activeTab === tab.id ? 'active' : ''
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSidebarWidth(0)} // 在手机端可以完全隐藏
            className="p-1.5 hover:bg-white/10 rounded transition-colors ml-1 shrink-0"
            title="隐藏侧边栏"
          >
            <span className="text-white">×</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--bg-surface)' }}>
          {activeTab === 'nodes' && (
            <div className="p-3 space-y-2">
              {nodeGroups.map((group) => {
                const isExpanded = expandedGroups.has(group.id);
                
                return (
                  <div key={group.id} className="node-group">
                    <button
                      className="group-title w-full flex items-center justify-between hover:opacity-80 transition-opacity"
                      onClick={() => toggleGroup(group.id)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{group.name}</span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-2 space-y-1">
                        {group.nodes.map((node) => {
                          return (
                            <button 
                              key={node.id} 
                              onClick={node.action}
                              className="node-button w-full"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex-1 text-left">
                                  <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                                    {node.name}
                                  </div>
                                  <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                    {node.desc}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'favorites' && (
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>我的收藏</h3>
                <button
                  onClick={() => setSavedWorkflows(getSavedWorkflows())}
                  className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white"
                >
                  刷新
                </button>
              </div>

              {savedWorkflows.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-white">暂无收藏的工作流</p>
                  <p className="text-xs text-white mt-1">点击顶部保存按钮收藏当前工作流</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {savedWorkflows.map((workflow) => (
                    <div
                      key={workflow.name}
                      className="p-3 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
                      style={{ background: 'var(--bg-card)' }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                            {workflow.name}
                          </p>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                            {new Date(workflow.date).toLocaleString('zh-CN')}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={() => {
                              loadWorkflow(workflow.name);
                              setSavedWorkflows(getSavedWorkflows());
                            }}
                            className="p-1.5 rounded hover:bg-white/10 text-white hover:text-white"
                            title="加载"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`确定删除 "${workflow.name}" 吗？`)) {
                                deleteWorkflow(workflow.name);
                                setSavedWorkflows(getSavedWorkflows());
                              }
                            }}
                            className="p-1.5 rounded hover:bg-red-500/20 text-white hover:text-white"
                            title="删除"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="p-3 space-y-3">
              <div className="node-group">
                <h3 className="group-title">关于</h3>
                <div className="p-4" style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
                  <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>AICG01</h3>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>v01.5.29</p>
                  <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>AI创意工作流平台</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        className={cn(
          "absolute top-14 h-[calc(100%-56px)] w-1 cursor-col-resize z-50 hover:w-1.5 transition-all duration-150 hover:bg-white/20",
          sidebarWidth === 0 && "w-6 bg-white/5 hover:w-6 hover:bg-white/10"
        )}
        onMouseDown={handleDragStart}
        onClick={() => sidebarWidth === 0 && setSidebarWidth(160)}
        title={sidebarWidth === 0 ? "展开侧边栏" : "拖动调整宽度"}
        style={{ left: `${sidebarWidth || 0}px` }}
      />

      <SettingsPanel
        isOpen={isSettingsPanelOpen}
        onClose={() => setIsSettingsPanelOpen(false)}
      />
    </>
  );
};

export default Sidebar;
