import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { NodeCategory, NodeTypeDefinition } from '@/types/node-system';
import { getActiveRegistryDefinitions } from '@/core/node-registry';
import { enhancedNodeLibraryService } from '@/services/enhanced-node-library-service';
import { EnhancedNodeTemplate } from '@/types/enhanced-node-library';

type ViewMode = 'all' | 'favorites' | 'history' | 'templates' | 'recommendations';

interface EnhancedNodePaletteProps {
  onAddNode: (nodeType: NodeTypeDefinition) => void;
  onAddTemplate?: (template: EnhancedNodeTemplate) => void;
  width?: number;
}

const categoryLabels: Record<NodeCategory, string> = {
  input: '输入',
  output: '输出',
  processing: '处理',
  effect: '特效',
  text: '文本',
  audio: '音频',
  image: '图片',
  video: '视频',
  utility: '工具',
};

const EnhancedNodePalette: React.FC<EnhancedNodePaletteProps> = ({
  onAddNode,
  onAddTemplate,
  width,
}) => {
  const [searchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('templates');
  const [expandedCategories, setExpandedCategories] = useState<
    Partial<Record<NodeCategory, boolean>>
  >({
    input: true,
    image: true,
    video: true,
    audio: true,
    text: true,
  });
  const [favorites, setFavorites] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [_isLoading, _setIsLoading] = useState(false);

  useEffect(() => {
    const favs = enhancedNodeLibraryService.getFavorites().map((f) => f.nodeId);
    setFavorites(favs);

    const hist = enhancedNodeLibraryService.getHistory(20).map((h) => h.nodeId);
    setHistory(hist);
  }, []);

  const _toggleFavorite = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (enhancedNodeLibraryService.isFavorite(nodeId)) {
      enhancedNodeLibraryService.removeFavorite(nodeId);
    } else {
      enhancedNodeLibraryService.addFavorite(nodeId);
    }
    const favs = enhancedNodeLibraryService.getFavorites().map((f) => f.nodeId);
    setFavorites(favs);
  }, []);

  const handleAddNode = useCallback(
    (nodeType: NodeTypeDefinition) => {
      enhancedNodeLibraryService.addToHistory(nodeType.id);
      const hist = enhancedNodeLibraryService.getHistory(20).map((h) => h.nodeId);
      setHistory(hist);
      onAddNode(nodeType);
    },
    [onAddNode]
  );

  const paletteNodes = useMemo(() => getActiveRegistryDefinitions(), []);

  const filteredNodes = useMemo(() => {
    let nodes = paletteNodes;

    if (viewMode === 'favorites') {
      nodes = nodes.filter((node) => favorites.includes(node.id));
    } else if (viewMode === 'history') {
      const uniqueHistory = [...new Set(history)];
      nodes = nodes.filter((node) => uniqueHistory.includes(node.id));
      nodes.sort((a, b) => {
        return uniqueHistory.indexOf(a.id) - uniqueHistory.indexOf(b.id);
      });
    }

    if (!searchQuery.trim()) return nodes;

    const query = searchQuery.toLowerCase();
    return nodes.filter(
      (node) =>
        node.name.toLowerCase().includes(query) ||
        node.description.toLowerCase().includes(query) ||
        node.id.toLowerCase().includes(query)
    );
  }, [searchQuery, viewMode, favorites, history, paletteNodes]);

  const groupedNodes = useMemo(() => {
    const groups: Partial<Record<NodeCategory, NodeTypeDefinition[]>> = {};

    filteredNodes.forEach((node) => {
      if (!groups[node.category]) {
        groups[node.category] = [];
      }
      groups[node.category]!.push(node);
    });

    const categoryOrder: NodeCategory[] = ['input'];

    const sortedGroups: Partial<Record<NodeCategory, NodeTypeDefinition[]>> = {};
    categoryOrder.forEach((cat) => {
      if (groups[cat]) {
        sortedGroups[cat] = groups[cat];
      }
    });

    return sortedGroups;
  }, [filteredNodes]);

  const templates = useMemo(() => {
    return enhancedNodeLibraryService.getAllTemplates();
  }, []);

  const groupedTemplates = useMemo(() => {
    const groups: Partial<Record<NodeCategory, EnhancedNodeTemplate[]>> = {};

    templates.forEach((template) => {
      if (!groups[template.category]) {
        groups[template.category] = [];
      }
      groups[template.category]!.push(template);
    });

    const categoryOrder: NodeCategory[] = ['input'];

    const sortedGroups: Partial<Record<NodeCategory, EnhancedNodeTemplate[]>> = {};
    categoryOrder.forEach((cat) => {
      if (groups[cat]) {
        sortedGroups[cat] = groups[cat];
      }
    });

    return sortedGroups;
  }, [templates]);

  const toggleCategory = useCallback((category: NodeCategory) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  }, []);

  const _ViewModeButton = ({ mode, label }: { mode: ViewMode; label: string }) => (
    <button
      onClick={() => setViewMode(mode)}
      className={cn(
        'flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium transition-all',
        viewMode === mode
          ? 'bg-[#007AFF] text-white'
          : 'text-gray-400 hover:text-white hover:bg-[#2D2D2D]'
      )}
    >
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  const NodeItem = ({ node }: { node: NodeTypeDefinition }) => {
    const usageStats = enhancedNodeLibraryService.getUsageStats(node.id);

    const hideDescription = [
      'prompt',
      'imageInput',
      'videoInput',
      'aiGenText',
      'aiImage',
      'aiVideo',
      'imageGen',
      'unifiedImageStudio',
      'videoGen',
      'audioGen',
    ].includes(node.id);

    return (
      <button
        key={node.id}
        onClick={() => handleAddNode(node)}
        className="group relative w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all hover:scale-102 hover:shadow-lg"
        style={{
          borderColor: node.color + '40',
          backgroundColor: '#222227',
          minHeight: hideDescription ? '36px' : '44px',
        }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-white truncate">{node.name}</span>
            {usageStats && usageStats.totalUsage > 0 && (
              <span className="px-1 py-0.5 text-[10px] rounded-full bg-[#2D2D2D] text-gray-400">
                {usageStats.totalUsage}x
              </span>
            )}
          </div>
          {!hideDescription && (
            <p className="text-[9px] text-gray-500 truncate">{node.description}</p>
          )}
        </div>
      </button>
    );
  };

  const TemplateItem = ({ template }: { template: EnhancedNodeTemplate }) => (
    <button
      key={template.id}
      onClick={() => onAddTemplate?.(template)}
      className="group relative w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all hover:scale-102 hover:shadow-lg"
      style={{
        borderColor: '#3D3D3D40',
        backgroundColor: '#222227',
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-white truncate">{template.name}</span>
          {template.isPreset && (
            <span className="px-1 py-0.5 text-[10px] rounded-full bg-gray-500/20 text-gray-400 ml-2">
              预设
            </span>
          )}
        </div>
        <p className="text-[10px] text-gray-500 truncate">{template.description}</p>
      </div>
    </button>
  );

  return (
    <div
      className="h-full bg-[#1A1A1D] border-r border-[#2D2D2D] flex flex-col flex-shrink-0"
      style={{ width: width ? `${width}px` : '200px' }}
    >
      <div className="flex-1 overflow-y-auto p-4">
        {viewMode === 'templates' ? (
          Object.entries(groupedTemplates).length > 0 ? (
            Object.entries(groupedTemplates).map(([category, templateList]) => {
              const cat = category as NodeCategory;
              const isExpanded = expandedCategories[cat] ?? true;

              return (
                <div key={category} className="mb-3">
                  <button
                    onClick={() => toggleCategory(cat)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#2D2D2D] transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-white">
                        {categoryLabels[cat]}
                      </span>
                      <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-[#2D2D2D] text-gray-400 font-medium">
                        {templateList.length}
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="space-y-2 mt-2">
                      {templateList.map((template) => (
                        <TemplateItem key={template.id} template={template} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <p className="text-xs text-gray-500">暂无模板</p>
              <p className="text-[10px] text-gray-600 mt-1">保存你的工作流作为模板</p>
            </div>
          )
        ) : (
          Object.entries(groupedNodes).map(([category, nodes]) => {
            const cat = category as NodeCategory;
            const isExpanded = expandedCategories[cat] ?? true;

            return (
              <div key={category} className="mb-3">
                <button
                  onClick={() => toggleCategory(cat)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#2D2D2D] transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-white">
                      {categoryLabels[cat]}
                    </span>
                    <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-[#2D2D2D] text-gray-400 font-medium">
                      {nodes.length}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="ml-4 space-y-2 mt-2">
                    {nodes.map((nodeType) => (
                      <NodeItem key={nodeType.id} node={nodeType} />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}

        {Object.keys(groupedNodes).length === 0 &&
          viewMode !== 'templates' &&
          viewMode !== 'recommendations' && (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <p className="text-xs text-gray-500">未找到匹配的节点</p>
              <p className="text-[10px] text-gray-600 mt-1">尝试其他搜索关键词</p>
            </div>
          )}
      </div>
    </div>
  );
};

export default EnhancedNodePalette;
