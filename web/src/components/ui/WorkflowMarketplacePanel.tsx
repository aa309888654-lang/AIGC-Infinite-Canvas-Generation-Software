import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, Download, Heart, Star, Filter, Zap, BookOpen, TrendingUp, Upload, ShoppingBag } from 'lucide-react';
import { Node, Edge } from '@xyflow/react';

import {
  workflowMarketplaceService,
  WorkflowTemplate,
  WorkflowMarketplaceFilter
} from '../../services/workflow-marketplace-service';
import WorkflowNodeGraphPreview from './WorkflowNodeGraphPreview';

interface WorkflowMarketplacePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onImportTemplate?: (nodes: Node[], edges: Edge[]) => void;
}

type ViewMode = 'browse' | 'publish' | 'mytemplates';

const WorkflowMarketplacePanel: React.FC<WorkflowMarketplacePanelProps> = ({
  isOpen,
  onClose,
  onImportTemplate
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('browse');
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [sortBy, setSortBy] = useState<'popular' | 'newest' | 'rating' | 'downloads'>('popular');
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [showFilter, setShowFilter] = useState(false);

  const loadData = useCallback(() => {
    const filter: WorkflowMarketplaceFilter = {
      sortBy,
    };

    if (searchQuery) {
      filter.search = searchQuery;
    }

    if (selectedCategory) {
      filter.category = selectedCategory;
    }

    setTemplates(workflowMarketplaceService.getTemplates(filter));
    setCategories(workflowMarketplaceService.getCategories());
  }, [searchQuery, selectedCategory, sortBy]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  const handleDownload = useCallback((template: WorkflowTemplate) => {
    const hydratedTemplate = workflowMarketplaceService.downloadTemplate(template.id) || template;
    if (onImportTemplate) {
      onImportTemplate(hydratedTemplate.nodes, hydratedTemplate.edges);
    }
    loadData();
  }, [loadData, onImportTemplate]);

  const handleLike = useCallback((templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    workflowMarketplaceService.likeTemplate(templateId);
    loadData();
  }, [loadData]);

  const getStarRating = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;
    return (
      <div className="flex items-center gap-0.5">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            size={12}
            className={
              i < fullStars
                ? 'text-yellow-400 fill-yellow-400'
                : i === fullStars && hasHalf
                  ? 'text-yellow-400'
                  : 'text-gray-500'
            }
          />
        ))}
      </div>
    );
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#1A1A1D] border border-[#2D2D2D] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-[#2D2D2D]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-[#007AFF] to-[#5856D6] flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">工作流市场</h2>
              <p className="text-sm text-gray-400">探索、分享和下载工作流模板</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#2D2D2D] rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex items-center gap-2 px-6 py-3 border-b border-[#2D2D2D]">
          {[
            { id: 'browse' as ViewMode, label: '浏览', icon: ShoppingBag },
            { id: 'mytemplates' as ViewMode, label: '我的模板', icon: BookOpen },
            { id: 'publish' as ViewMode, label: '发布', icon: Upload }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                  viewMode === tab.id
                    ? 'bg-[#007AFF] text-white'
                    : 'hover:bg-[#2D2D2D] text-gray-400'
                }`}
              >
                <Icon size={16} />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {viewMode === 'browse' && (
          <>
            <div className="px-6 py-4 border-b border-[#2D2D2D] flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="搜索工作流模板..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[#242428] border border-[#2D2D2D] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#007AFF]"
                />
              </div>
              <button
                onClick={() => setShowFilter(!showFilter)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  showFilter ? 'bg-[#007AFF] text-white' : 'bg-[#242428] text-gray-400 hover:bg-[#2D2D2D]'
                }`}
              >
                <Filter size={16} />
                筛选
              </button>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'popular' | 'newest' | 'rating' | 'downloads')}
                className="px-4 py-2 bg-[#242428] border border-[#2D2D2D] rounded-lg text-white focus:outline-none focus:border-[#007AFF]"
              >
                <option value="popular">热门</option>
                <option value="newest">最新</option>
                <option value="rating">评分最高</option>
                <option value="downloads">下载最多</option>
              </select>
            </div>

            {showFilter && (
              <div className="px-6 py-4 bg-[#242428]/50 border-b border-[#2D2D2D]">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedCategory('')}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      !selectedCategory ? 'bg-[#007AFF] text-white' : 'bg-[#2D2D2D] text-gray-400 hover:bg-[#3D3D3D]'
                    }`}
                  >
                    全部
                  </button>
                  {categories.map(category => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        selectedCategory === category ? 'bg-[#007AFF] text-white' : 'bg-[#2D2D2D] text-gray-400 hover:bg-[#3D3D3D]'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6">
              {templates.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map(template => (
                    <div
                      key={template.id}
                      className="bg-[#242428] border border-[#2D2D2D] rounded-xl overflow-hidden hover:border-[#007AFF]/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <div className="aspect-video bg-gradient-to-br from-[#2D2D2D] to-[#242428] flex items-center justify-center relative">
                        {template.thumbnailUrl ? (
                          <img src={template.thumbnailUrl} alt={template.name} className="w-full h-full object-cover" />
                        ) : (
                          <Zap className="w-10 h-10 text-gray-600" />
                        )}
                        {template.isOfficial && (
                          <div className="absolute top-2 left-2">
                            <span className="px-2 py-1 bg-[#007AFF] text-white text-xs rounded-full font-medium">官方</span>
                          </div>
                        )}
                        {template.isFeatured && (
                          <div className="absolute top-2 right-2">
                            <span className="px-2 py-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs rounded-full font-medium">精选</span>
                          </div>
                        )}
                      </div>

                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-white line-clamp-1">{template.name}</h3>
                          <button
                            onClick={(e) => handleLike(template.id, e)}
                            className="p-1 hover:bg-white/10 rounded transition-colors"
                          >
                            <Heart
                              size={18}
                              className={
                                workflowMarketplaceService.hasLiked(template.id)
                                  ? 'text-red-500 fill-red-500'
                                  : 'text-gray-500'
                              }
                            />
                          </button>
                        </div>

                        <p className="text-sm text-gray-400 line-clamp-2 mb-3">{template.description}</p>

                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-1">
                            {getStarRating(template.rating)}
                            <span className="text-xs text-gray-500 ml-1">({template.ratingCount})</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Download size={12} />
                              {formatNumber(template.downloads)}
                            </span>
                            <span className="flex items-center gap-1">
                              <TrendingUp size={12} />
                              {formatNumber(template.likes)}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1 mb-3">
                          {template.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-[#2D2D2D] text-gray-400 text-xs rounded">
                              {tag}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">by {template.author}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(template);
                            }}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              template.isFree
                                ? 'bg-[#007AFF] hover:bg-[#007AFF]/80 text-white'
                                : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                            }`}
                          >
                            <Download size={14} />
                            {template.isFree ? '免费下载' : `$${template.price}`}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <ShoppingBag className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">暂无模板</h3>
                  <p className="text-gray-500">尝试调整筛选条件或搜索关键词</p>
                </div>
              )}
            </div>
          </>
        )}

        {viewMode === 'mytemplates' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="text-center py-12">
              <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">我的模板</h3>
              <p className="text-gray-500">您下载和发布的模板将显示在这里</p>
            </div>
          </div>
        )}

        {viewMode === 'publish' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">
              <h3 className="text-lg font-medium text-white mb-6">发布新模板</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">模板名称</label>
                  <input
                    type="text"
                    placeholder="输入模板名称"
                    className="w-full px-4 py-2 bg-[#242428] border border-[#2D2D2D] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#007AFF]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">描述</label>
                  <textarea
                    placeholder="描述您的模板用途和特点"
                    rows={3}
                    className="w-full px-4 py-2 bg-[#242428] border border-[#2D2D2D] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#007AFF] resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">分类</label>
                  <select className="w-full px-4 py-2 bg-[#242428] border border-[#2D2D2D] rounded-lg text-white focus:outline-none focus:border-[#007AFF]">
                    {categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">标签 (逗号分隔)</label>
                  <input
                    type="text"
                    placeholder="例如: 图片, 视频, 风格迁移"
                    className="w-full px-4 py-2 bg-[#242428] border border-[#2D2D2D] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#007AFF]"
                  />
                </div>
                <div className="flex items-center gap-4 pt-4">
                  <button className="flex-1 px-6 py-3 bg-[#007AFF] hover:bg-[#007AFF]/80 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
                    <Upload size={18} />
                    发布模板
                  </button>
                  <button
                    onClick={() => setViewMode('browse')}
                    className="px-6 py-3 bg-[#242428] hover:bg-[#2D2D2D] text-gray-400 rounded-lg font-medium transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedTemplate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60]" onClick={() => setSelectedTemplate(null)}>
          <div className="bg-[#1A1A1D] border border-[#2D2D2D] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-[#2D2D2D] flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">{selectedTemplate.name}</h3>
              <button onClick={() => setSelectedTemplate(null)} className="p-2 hover:bg-[#2D2D2D] rounded-lg text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {selectedTemplate.nodes && selectedTemplate.nodes.length > 0 ? (
                <div className="mb-6">
                  <div className="text-sm text-gray-500 mb-3">节点流程图预览</div>
                  <WorkflowNodeGraphPreview nodes={selectedTemplate.nodes} edges={selectedTemplate.edges} />
                </div>
              ) : (
                <div className="aspect-video bg-gradient-to-br from-[#2D2D2D] to-[#242428] rounded-xl mb-6 flex items-center justify-center">
                  {selectedTemplate.thumbnailUrl ? (
                    <img src={selectedTemplate.thumbnailUrl} alt={selectedTemplate.name} className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <Zap className="w-16 h-16 text-gray-600" />
                  )}
                </div>
              )}

              <p className="text-gray-300 mb-6">{selectedTemplate.description}</p>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-[#242428] rounded-lg p-4">
                  <div className="text-sm text-gray-500 mb-1">作者</div>
                  <div className="text-white font-medium">{selectedTemplate.author}</div>
                </div>
                <div className="bg-[#242428] rounded-lg p-4">
                  <div className="text-sm text-gray-500 mb-1">分类</div>
                  <div className="text-white font-medium">{selectedTemplate.category}</div>
                </div>
                <div className="bg-[#242428] rounded-lg p-4">
                  <div className="text-sm text-gray-500 mb-1">下载量</div>
                  <div className="text-white font-medium">{formatNumber(selectedTemplate.downloads)}</div>
                </div>
                <div className="bg-[#242428] rounded-lg p-4">
                  <div className="text-sm text-gray-500 mb-1">评分</div>
                  <div className="flex items-center gap-2">
                    {getStarRating(selectedTemplate.rating)}
                    <span className="text-white font-medium">{selectedTemplate.rating.toFixed(1)}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                {selectedTemplate.tags.map(tag => (
                  <span key={tag} className="px-3 py-1 bg-[#242428] text-gray-400 text-sm rounded-lg">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-[#2D2D2D]">
              <button
                onClick={() => {
                  handleDownload(selectedTemplate);
                  setSelectedTemplate(null);
                }}
                className="w-full px-6 py-3 bg-[#007AFF] hover:bg-[#007AFF]/80 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Download size={18} />
                {selectedTemplate.isFree ? '免费下载并使用' : `付费 $${selectedTemplate.price}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowMarketplacePanel;
