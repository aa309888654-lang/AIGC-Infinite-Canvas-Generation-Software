import React, { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  useTemplateStore,
  templateService,
  type VideoTemplate,
  type TemplateCategory,
  type TemplateAspect,
} from '@/services/video-template-service';
import { Layout, Search, Heart, Star, Play, Download, Copy, Grid, List, Crown, Clock3, MonitorPlay, Smartphone, Square, RectangleHorizontal, RectangleVertical, X } from 'lucide-react';

interface TemplatePanelProps {
  onTemplateSelect?: (template: VideoTemplate) => void;
  onApplyTemplate?: (template: VideoTemplate, files: File[]) => void;
  className?: string;
}

const CATEGORY_ICONS: Partial<Record<TemplateCategory, React.ReactNode>> = {
  vlog: <MonitorPlay className="w-4 h-4" />,
  tiktok: <Smartphone className="w-4 h-4" />,
  youtube: <MonitorPlay className="w-4 h-4" />,
  instagram: <Smartphone className="w-4 h-4" />,
  music: <Star className="w-4 h-4" />,
};

const ASPECT_ICONS: Record<TemplateAspect, React.ReactNode> = {
  '16:9': <RectangleHorizontal className="w-4 h-4" />,
  '9:16': <RectangleVertical className="w-4 h-4" />,
  '1:1': <Square className="w-4 h-4" />,
  '4:3': <RectangleHorizontal className="w-4 h-4" />,
  '21:9': <RectangleHorizontal className="w-4 h-4" />,
};

export const TemplatePanel: React.FC<TemplatePanelProps> = ({
  onTemplateSelect,
  onApplyTemplate,
  className,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedTemplate, setSelectedTemplate] = useState<VideoTemplate | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    templates,
    userTemplates,
    favorites,
    selectedCategory,
    selectedAspect,
    searchQuery,
    isLoading,
    applyTemplate,
    duplicateTemplate,
    toggleFavorite,
    addToRecent,
    setSelectedCategory,
    setSelectedAspect,
    setSearchQuery,
    getFavoriteTemplates,
    getRecentTemplates,
  } = useTemplateStore();

  const categories = templateService.getAllCategories();
  const aspects = templateService.getAllAspects();

  const getFilteredTemplates = useCallback(() => {
    let result = [...templates, ...userTemplates];

    if (selectedCategory !== 'all') {
      result = result.filter((t) => t.category === selectedCategory);
    }

    if (selectedAspect !== 'all') {
      result = result.filter((t) => t.aspectRatio === selectedAspect);
    }

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(lowerQuery) ||
          t.description.toLowerCase().includes(lowerQuery) ||
          t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
      );
    }

    return result;
  }, [templates, userTemplates, selectedCategory, selectedAspect, searchQuery]);

  const handleTemplateClick = (template: VideoTemplate) => {
    setSelectedTemplate(template);
    addToRecent(template.id);
    onTemplateSelect?.(template);
  };

  const handleApplyClick = () => {
    if (!selectedTemplate) return;
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !selectedTemplate) return;

    const fileArray = Array.from(files);
    onApplyTemplate?.(selectedTemplate, fileArray);
    applyTemplate(selectedTemplate.id, fileArray);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDuplicate = (template: VideoTemplate) => {
    duplicateTemplate(template.id);
  };

  const handleExport = async (template: VideoTemplate) => {
    const blob = await templateService.exportTemplate(template);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredTemplates = getFilteredTemplates();
  const favoriteTemplates = getFavoriteTemplates();
  const recentTemplates = getRecentTemplates();

  return (
    <div className={cn('flex flex-col bg-[#0D0D0D] rounded-lg overflow-hidden', className)}>
      <div className="flex items-center justify-between px-3 py-2 bg-[#1A1A1A] border-b border-[#2D2D2D]">
        <div className="flex items-center gap-2">
          <Layout className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-white">模板</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-1.5 hover:bg-[#2D2D2D] rounded text-gray-400 hover:text-white transition-colors"
            title={viewMode === 'grid' ? '列表视图' : '网格视图'}
          >
            {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="px-3 py-2 bg-[#1A1A1A] border-b border-[#2D2D2D]">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="搜索模板..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 bg-[#0D0D0D] border border-[#3A3A3A] rounded-lg text-sm text-white placeholder-gray-500 focus:border-gray-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 px-3 py-2 overflow-x-auto bg-[#1A1A1A] border-b border-[#2D2D2D]">
        <div className="flex gap-1 flex-1">
          {categories.slice(0, 8).map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                'flex items-center gap-1 px-2 py-1 text-xs rounded whitespace-nowrap transition-colors',
                selectedCategory === cat.id
                  ? 'bg-gray-500/20 text-gray-400 border border-gray-500/50'
                  : 'bg-[#1F1F1F] text-gray-400 hover:bg-[#2D2D2D]'
              )}
            >
              {cat.id !== 'all' && CATEGORY_ICONS[cat.id as TemplateCategory]}
              {cat.name}
            </button>
          ))}
        </div>
        <div className="w-px bg-[#3A3A3A]" />
        <div className="flex gap-1">
          {aspects.map((aspect) => (
            <button
              key={aspect.id}
              onClick={() => setSelectedAspect(aspect.id)}
              className={cn(
                'flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors',
                selectedAspect === aspect.id
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                  : 'bg-[#1F1F1F] text-gray-400 hover:bg-[#2D2D2D]'
              )}
              title={aspect.name}
            >
              {aspect.id !== 'all' && ASPECT_ICONS[aspect.id as TemplateAspect]}
              {aspect.id === 'all' ? '全部' : aspect.id}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {recentTemplates.length > 0 && !searchQuery && selectedCategory === 'all' && (
          <div className="px-3 py-2">
            <div className="flex items-center gap-2 mb-2">
              <Clock3 className="w-3 h-3 text-gray-500" />
              <span className="text-xs text-gray-500">最近使用</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {recentTemplates.slice(0, 5).map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateClick(template)}
                  className="flex-shrink-0 w-24 bg-[#1F1F1F] rounded-lg overflow-hidden hover:ring-2 hover:ring-gray-500 transition-all"
                >
                  <div className="aspect-video bg-[#2D2D2D] flex items-center justify-center">
                    <Layout className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="p-1.5">
                    <div className="text-xs text-white truncate">{template.name}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {favoriteTemplates.length > 0 && !searchQuery && selectedCategory === 'all' && (
          <div className="px-3 py-2 border-t border-[#2D2D2D]">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-3 h-3 text-red-400" />
              <span className="text-xs text-gray-500">我的收藏</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {favoriteTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateClick(template)}
                  className="flex-shrink-0 w-24 bg-[#1F1F1F] rounded-lg overflow-hidden hover:ring-2 hover:ring-gray-500 transition-all"
                >
                  <div className="aspect-video bg-[#2D2D2D] flex items-center justify-center">
                    <Layout className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="p-1.5">
                    <div className="text-xs text-white truncate">{template.name}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="px-3 py-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">{filteredTemplates.length} 个模板</span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin w-6 h-6 border-2 border-gray-500 border-t-transparent rounded-full" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <Layout className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">暂无模板</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 gap-2">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className={cn(
                    'relative group bg-[#1F1F1F] rounded-lg overflow-hidden cursor-pointer transition-all',
                    selectedTemplate?.id === template.id && 'ring-2 ring-gray-500'
                  )}
                  onClick={() => handleTemplateClick(template)}
                >
                  <div className="aspect-video bg-[#2D2D2D] flex items-center justify-center relative">
                    <Layout className="w-8 h-8 text-gray-600" />
                    {template.isPremium && (
                      <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-yellow-500/80 text-[10px] text-black rounded flex items-center gap-0.5">
                        <Crown className="w-3 h-3" />
                        VIP
                      </div>
                    )}
                    <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/60 text-[10px] text-white rounded">
                      {template.duration}s
                    </div>
                  </div>
                  <div className="p-2">
                    <div className="text-sm text-white truncate">{template.name}</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-500">{template.aspectRatio}</span>
                      <span className="text-xs text-gray-500">{template.useCount} 次使用</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(template.id);
                    }}
                    className={cn(
                      'absolute top-2 left-2 p-1 rounded transition-all',
                      favorites.includes(template.id)
                        ? 'bg-red-500 text-white'
                        : 'bg-black/50 text-gray-400 opacity-0 group-hover:opacity-100'
                    )}
                  >
                    <Heart className="w-3 h-3" fill={favorites.includes(template.id) ? 'currentColor' : 'none'} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateClick(template)}
                  className={cn(
                    'flex items-center gap-3 w-full p-2 rounded-lg transition-colors',
                    selectedTemplate?.id === template.id
                      ? 'bg-gray-500/20'
                      : 'bg-[#1F1F1F] hover:bg-[#2D2D2D]'
                  )}
                >
                  <div className="w-16 h-10 bg-[#2D2D2D] rounded flex items-center justify-center flex-shrink-0">
                    <Layout className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm text-white flex items-center gap-1">
                      {template.name}
                      {template.isPremium && <Crown className="w-3 h-3 text-yellow-400" />}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{template.description}</div>
                  </div>
                  <div className="text-xs text-gray-500">{template.duration}s</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(template.id);
                    }}
                    className={cn(
                      'p-1 rounded',
                      favorites.includes(template.id) ? 'text-red-400' : 'text-gray-500 hover:text-red-400'
                    )}
                  >
                    <Heart className="w-4 h-4" fill={favorites.includes(template.id) ? 'currentColor' : 'none'} />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedTemplate && (
        <div className="px-3 py-2 bg-[#1A1A1A] border-t border-[#2D2D2D]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white">{selectedTemplate.name}</span>
            <button
              onClick={() => setSelectedTemplate(null)}
              className="p-1 hover:bg-[#2D2D2D] rounded text-gray-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleApplyClick}
              className="flex-1 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-1"
            >
              <Play className="w-4 h-4" />
              使用模板
            </button>
            <button
              onClick={() => handleDuplicate(selectedTemplate)}
              className="p-2 bg-[#2D2D2D] hover:bg-[#3A3A3A] text-gray-400 rounded-lg transition-colors"
              title="复制模板"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleExport(selectedTemplate)}
              className="p-2 bg-[#2D2D2D] hover:bg-[#3A3A3A] text-gray-400 rounded-lg transition-colors"
              title="导出模板"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};

export default TemplatePanel;
