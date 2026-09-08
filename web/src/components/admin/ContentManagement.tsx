import React, { useState, useMemo } from 'react';
import { Search, Eye, XCircle, Filter, Star, Zap, ChevronRight, Palette, Film, Music, Video, Sparkles, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TEMPLATE_PRESETS, TemplatePreset } from '@/data/template-presets';
import { useToast } from './shared/AdminToast';

const categoryConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  film: { label: '电影', icon: Film, color: 'text-amber-400' },
  social: { label: '社交媒体', icon: Video, color: 'text-pink-400' },
  music: { label: '音乐', icon: Music, color: 'text-purple-400' },
  documentary: { label: '纪录片', icon: BookOpen, color: 'text-emerald-400' },
  commercial: { label: '商业', icon: Sparkles, color: 'text-blue-400' },
  vlog: { label: 'Vlog', icon: Palette, color: 'text-orange-400' },
};

const difficultyConfig: Record<string, { label: string; color: string }> = {
  beginner: { label: '入门', color: 'bg-green-500/20 text-green-400' },
  intermediate: { label: '进阶', color: 'bg-yellow-500/20 text-yellow-400' },
  advanced: { label: '高级', color: 'bg-red-500/20 text-red-400' },
};

const ContentManagement: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplatePreset | null>(null);
  const { showToast } = useToast();

  const categories = useMemo(() => {
    const cats = new Set(TEMPLATE_PRESETS.map(p => p.category).filter(Boolean) as string[]);
    return ['all', ...Array.from(cats)];
  }, []);

  const filteredTemplates = useMemo(() => {
    return TEMPLATE_PRESETS.filter(t => {
      const matchSearch = !searchQuery ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = categoryFilter === 'all' || t.category === categoryFilter;
      const matchDifficulty = difficultyFilter === 'all' || t.difficulty === difficultyFilter;
      return matchSearch && matchCategory && matchDifficulty;
    });
  }, [searchQuery, categoryFilter, difficultyFilter]);

  const totalTemplates = TEMPLATE_PRESETS.length;
  const totalCategories = new Set(TEMPLATE_PRESETS.map(p => p.category).filter(Boolean)).size;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-4">
          <p className="text-gray-400 text-sm mb-1">预设模板总数</p>
          <p className="text-white text-xl font-bold">{totalTemplates}</p>
        </div>
        <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-4">
          <p className="text-gray-400 text-sm mb-1">模板分类</p>
          <p className="text-white text-xl font-bold">{totalCategories}</p>
        </div>
        <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            <p className="text-white text-xl font-bold">
              {TEMPLATE_PRESETS.filter(t => t.difficulty === 'beginner').length}
            </p>
          </div>
          <p className="text-gray-400 text-sm">入门级模板</p>
        </div>
      </div>

      <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-5">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="搜索模板名称、描述..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#252528] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2.5 bg-[#252528] border border-white/10 rounded-lg text-white focus:outline-none focus:border-gray-500"
            >
              <option value="all">全部分类</option>
              {categories.filter(c => c !== 'all').map(c => (
                <option key={c} value={c}>{categoryConfig[c]?.label || c}</option>
              ))}
            </select>
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="px-4 py-2.5 bg-[#252528] border border-white/10 rounded-lg text-white focus:outline-none focus:border-gray-500"
            >
              <option value="all">全部难度</option>
              <option value="beginner">入门</option>
              <option value="intermediate">进阶</option>
              <option value="advanced">高级</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-sm">
          共 {filteredTemplates.length} 个模板
          {(categoryFilter !== 'all' || difficultyFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => { setCategoryFilter('all'); setDifficultyFilter('all'); setSearchQuery(''); }}
              className="ml-2 text-violet-400 hover:text-violet-300 transition-colors"
            >
              清除筛选
            </button>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredTemplates.map((template) => {
          const catConfig = categoryConfig[template.category || ''];
          const diffConfig = difficultyConfig[template.difficulty || 'beginner'];
          const CatIcon = catConfig?.icon || Sparkles;
          const hasRelated = template.relatedIds && template.relatedIds.length > 0;

          return (
            <div
              key={template.id}
              className="bg-[#1A1A1E] rounded-xl border border-white/10 overflow-hidden hover:border-white/20 transition-all cursor-pointer group"
              onClick={() => setSelectedTemplate(template)}
            >
              <div
                className="aspect-video flex items-center justify-center relative"
                style={{ background: `linear-gradient(135deg, ${template.color}22, ${template.color}08)` }}
              >
                <span className="text-4xl">{template.icon}</span>
                <div className="absolute top-2 right-2">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', diffConfig.color)}>
                    {diffConfig.label}
                  </span>
                </div>
                {hasRelated && (
                  <div className="absolute bottom-2 right-2">
                    <span className="px-2 py-0.5 bg-white/10 rounded-full text-xs text-gray-300">
                      {template.relatedIds!.length} 关联
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <div className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                    <Eye className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>
              <div className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CatIcon className={cn('w-3.5 h-3.5', catConfig?.color || 'text-gray-400')} />
                  <h4 className="text-white font-medium text-sm truncate">{template.name}</h4>
                </div>
                <p className="text-gray-500 text-xs line-clamp-2 mb-2">{template.description}</p>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-400 flex items-center gap-1">
                    <Filter className="w-3 h-3" />
                    {catConfig?.label || '未分类'}
                  </span>
                  <div className="flex items-center gap-1">
                    {template.settings.visualEffects.length > 0 && (
                      <span className="text-gray-400 flex items-center gap-0.5">
                        <Star className="w-3 h-3" /> {template.settings.visualEffects.length}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <Sparkles className="w-12 h-12 mb-3 opacity-50" />
          <p className="text-sm">未找到匹配的模板</p>
          <button
            onClick={() => { setCategoryFilter('all'); setDifficultyFilter('all'); setSearchQuery(''); }}
            className="mt-2 text-violet-400 hover:text-violet-300 text-sm"
          >
            清除所有筛选条件
          </button>
        </div>
      )}

      {selectedTemplate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelectedTemplate(null)}>
          <div className="bg-[#1A1A1E] rounded-2xl w-full max-w-2xl border border-white/10" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedTemplate.icon}</span>
                  <div>
                    <h2 className="text-xl font-bold text-white">{selectedTemplate.name}</h2>
                    <p className="text-gray-400 text-sm">{selectedTemplate.id}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedTemplate(null)} className="p-2 hover:bg-white/10 rounded-lg">
                  <XCircle className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-5">
              <p className="text-gray-300 text-sm leading-relaxed">{selectedTemplate.description}</p>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-gray-400 text-xs mb-1">分类</p>
                  <p className="text-white font-medium text-sm">
                    {categoryConfig[selectedTemplate.category || '']?.label || '未分类'}
                  </p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-gray-400 text-xs mb-1">难度</p>
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', difficultyConfig[selectedTemplate.difficulty || 'beginner']?.color)}>
                    {difficultyConfig[selectedTemplate.difficulty || 'beginner']?.label}
                  </span>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-gray-400 text-xs mb-1">速度曲线</p>
                  <p className="text-white font-medium text-sm">{selectedTemplate.settings.speedCurve}</p>
                </div>
              </div>

              <div>
                <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-violet-400" />
                  转场效果 ({selectedTemplate.settings.transitions.length})
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {selectedTemplate.settings.transitions.map((t, i) => (
                    <div key={i} className="p-2 bg-white/5 rounded-lg text-xs">
                      <span className="text-violet-300">{t.type}</span>
                      <span className="text-gray-500 ml-2">{t.duration}s</span>
                      {t.direction && <span className="text-gray-500 ml-1">→ {t.direction}</span>}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-violet-400" />
                  视觉效果 ({selectedTemplate.settings.visualEffects.length})
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {selectedTemplate.settings.visualEffects.map((vfx, i) => (
                    <div key={i} className="p-2 bg-white/5 rounded-lg text-xs">
                      <span className="text-blue-300">{vfx.type}</span>
                      <span className="text-gray-500 ml-2">强度 {Math.round(vfx.intensity * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedTemplate.settings.filter && (
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-gray-400 text-xs mb-1">滤镜</p>
                  <p className="text-white font-medium text-sm">{selectedTemplate.settings.filter}</p>
                  <p className="text-gray-500 text-xs">强度 {Math.round((selectedTemplate.settings.filterIntensity || 0) * 100)}%</p>
                </div>
              )}

              {selectedTemplate.settings.audio && (
                <div>
                  <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-violet-400" />
                    音频设置
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-white/5 rounded-lg text-xs">
                      <span className="text-gray-400">BGM</span>
                      <p className="text-white">{selectedTemplate.settings.audio.bgmPreset}</p>
                    </div>
                    <div className="p-2 bg-white/5 rounded-lg text-xs">
                      <span className="text-gray-400">音量</span>
                      <p className="text-white">{Math.round((selectedTemplate.settings.audio.volume || 0) * 100)}%</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedTemplate.relatedIds && selectedTemplate.relatedIds.length > 0 && (
                <div>
                  <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-violet-400" />
                    关联模板 ({selectedTemplate.relatedIds.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.relatedIds.map(rid => {
                      const related = TEMPLATE_PRESETS.find(p => p.id === rid);
                      return (
                        <span key={rid} className="px-3 py-1 bg-white/5 rounded-full text-xs text-gray-300">
                          {related ? `${related.icon} ${related.name}` : rid}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-violet-400" />
                  完整配置 (JSON)
                </h3>
                <pre className="text-white bg-black/30 p-3 rounded-lg text-xs overflow-x-auto max-h-60 overflow-y-auto">
                  {JSON.stringify(selectedTemplate.settings, null, 2)}
                </pre>
              </div>
            </div>
            <div className="p-4 border-t border-white/10 flex justify-end gap-3">
              <button
                onClick={() => setSelectedTemplate(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentManagement;
