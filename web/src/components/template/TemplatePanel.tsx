import { useState } from 'react';
import {
  Sparkles, Film, Type, Layers, Palette, Wand2, Layout,
  Search, Crown, Check, X, ChevronLeft, ChevronRight,
  User, Mountain, Package, Building, UtensilsCrossed, Shirt,
  Camera, Lightbulb, Grid3X3, Clapperboard, Sun, Frame, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { templateService, Template, TemplateCategory } from '@/services/template-service';
import VisualTemplateEditor from './VisualTemplateEditor';

interface TemplatePanelProps {
  onSelect?: (template: Template) => void;
  onClose?: () => void;
}

// 扩展的分类配置
const CATEGORY_CONFIG: Record<TemplateCategory, { icon: typeof Sparkles; label: string; color: string; emoji: string }> = {
  // 原有分类
  intro: { icon: Film, label: '片头', color: 'text-gray-500', emoji: '🎬' },
  outro: { icon: Film, label: '片尾', color: 'text-purple-500', emoji: '🎬' },
  subtitle: { icon: Type, label: '字幕样式', color: 'text-green-500', emoji: '📝' },
  transition: { icon: Layers, label: '转场', color: 'text-orange-500', emoji: '🔀' },
  color: { icon: Palette, label: '调色', color: 'text-pink-500', emoji: '🎨' },
  effect: { icon: Wand2, label: '特效', color: 'text-cyan-500', emoji: '✨' },
  'subtitle-style': { icon: Type, label: '字幕样式', color: 'text-green-500', emoji: '📝' },
  layout: { icon: Layout, label: '布局', color: 'text-yellow-500', emoji: '📐' },
  // 新增分类 - 按用途
  portrait: { icon: User, label: '人像摄影', color: 'text-emerald-500', emoji: '👤' },
  landscape: { icon: Mountain, label: '风景摄影', color: 'text-teal-500', emoji: '🏔️' },
  product: { icon: Package, label: '产品展示', color: 'text-amber-500', emoji: '📦' },
  architecture: { icon: Building, label: '建筑摄影', color: 'text-slate-500', emoji: '🏢' },
  food: { icon: UtensilsCrossed, label: '美食摄影', color: 'text-red-500', emoji: '🍜' },
  fashion: { icon: Shirt, label: '时尚摄影', color: 'text-pink-500', emoji: '👗' },
  // 新增分类 - 按风格
  realistic: { icon: Camera, label: '写实风格', color: 'text-indigo-500', emoji: '📷' },
  anime: { icon: Sparkles, label: '动漫风格', color: 'text-violet-500', emoji: '🎨' },
  oilPainting: { icon: Palette, label: '油画风格', color: 'text-amber-600', emoji: '🖼️' },
  watercolor: { icon: Palette, label: '水彩风格', color: 'text-sky-500', emoji: '🎭' },
  cyberpunk: { icon: Sparkles, label: '赛博朋克', color: 'text-purple-500', emoji: '🤖' },
  fantasy: { icon: Sparkles, label: '奇幻风格', color: 'text-fuchsia-500', emoji: '✨' },
  // 新增分类 - 技术类
  cinematic: { icon: Clapperboard, label: '电影感', color: 'text-rose-500', emoji: '🎬' },
  lighting: { icon: Sun, label: '光线技巧', color: 'text-yellow-500', emoji: '💡' },
  composition: { icon: Frame, label: '构图法则', color: 'text-orange-500', emoji: '🎯' },
  cameraMovement: { icon: Camera, label: '运镜方式', color: 'text-cyan-500', emoji: '🎥' },
};

const TEMPLATE_COLORS: Record<string, string> = {
  // 原有
  intro: 'from-gray-600 to-cyan-500',
  outro: 'from-purple-600 to-pink-500',
  subtitle: 'from-green-600 to-emerald-500',
  transition: 'from-orange-600 to-amber-500',
  color: 'from-pink-600 to-rose-500',
  effect: 'from-cyan-600 to-gray-500',
  'subtitle-style': 'from-green-600 to-teal-500',
  layout: 'from-yellow-600 to-orange-500',
  // 新增
  portrait: 'from-emerald-600 to-teal-500',
  landscape: 'from-teal-600 to-cyan-500',
  product: 'from-amber-600 to-orange-500',
  architecture: 'from-slate-600 to-gray-500',
  food: 'from-red-600 to-rose-500',
  fashion: 'from-pink-600 to-fuchsia-500',
  realistic: 'from-indigo-600 to-gray-500',
  anime: 'from-violet-600 to-purple-500',
  oilPainting: 'from-amber-600 to-yellow-500',
  watercolor: 'from-sky-600 to-cyan-500',
  cyberpunk: 'from-purple-600 to-fuchsia-500',
  fantasy: 'from-fuchsia-600 to-pink-500',
  cinematic: 'from-rose-600 to-red-500',
  lighting: 'from-yellow-600 to-amber-500',
  composition: 'from-orange-600 to-red-500',
  cameraMovement: 'from-cyan-600 to-gray-500',
};

// 分类分组
const CATEGORY_GROUPS = {
  video: {
    label: '视频编辑',
    categories: ['intro', 'outro', 'subtitle', 'transition', 'color', 'effect', 'layout'] as TemplateCategory[]
  },
  photo: {
    label: '摄影创作',
    categories: ['portrait', 'landscape', 'product', 'architecture', 'food', 'fashion'] as TemplateCategory[]
  },
  style: {
    label: '艺术风格',
    categories: ['realistic', 'anime', 'oilPainting', 'watercolor', 'cyberpunk', 'fantasy', 'cinematic'] as TemplateCategory[]
  },
  technical: {
    label: '技术技巧',
    categories: ['lighting', 'composition', 'cameraMovement'] as TemplateCategory[]
  }
};

export default function TemplatePanel({ onSelect, onClose }: TemplatePanelProps) {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>('portrait');
  const [activeGroup, setActiveGroup] = useState<keyof typeof CATEGORY_GROUPS>('photo');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showVisualEditor, setShowVisualEditor] = useState(false);
  const [showPremiumOnly, setShowPremiumOnly] = useState(false);

  const templates = templateService.getTemplatesByCategory(activeCategory);
  
  const filteredTemplates = templates.filter(t => {
    if (showPremiumOnly && !t.isPremium) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return t.name.toLowerCase().includes(query) || t.tags.some(tag => tag.toLowerCase().includes(query));
    }
    return true;
  });

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    onSelect?.(template);
  };

  const handleApplyTemplate = () => {
    if (selectedTemplate) {
      templateService.applyTemplate(selectedTemplate);
      onClose?.();
    }
  };

  const handleGroupChange = (group: keyof typeof CATEGORY_GROUPS) => {
    setActiveGroup(group);
    setActiveCategory(CATEGORY_GROUPS[group].categories[0]);
  };

  return (
    <div className="flex flex-col h-full bg-[#1a1a1f]">
      <div className="p-4 border-b border-[#2d2d35]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#10B981]" />
            模板中心
          </h2>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-[#2d2d35] rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="搜索模板..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#252530] text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowPremiumOnly(false)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors',
              !showPremiumOnly 
                ? 'bg-[#10B981] text-white' 
                : 'bg-[#2d2d35] text-gray-400 hover:text-white'
            )}
          >
            全部
          </button>
          <button
            onClick={() => setShowPremiumOnly(true)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1',
              showPremiumOnly 
                ? 'bg-yellow-500 text-black' 
                : 'bg-[#2d2d35] text-gray-400 hover:text-white'
            )}
          >
            <Crown className="w-3 h-3" />
            会员专属
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 分类分组标签 */}
        <div className="bg-[#15151a] border-b border-[#2d2d35] px-2 py-2">
          <div className="flex gap-1">
            {Object.entries(CATEGORY_GROUPS).map(([key, group]) => (
              <button
                key={key}
                onClick={() => handleGroupChange(key as keyof typeof CATEGORY_GROUPS)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  activeGroup === key
                    ? 'bg-[#10B981] text-white shadow-lg'
                    : 'bg-[#2d2d35] text-gray-400 hover:text-white hover:bg-[#3d3d45]'
                )}
              >
                {group.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* 子分类列表 */}
        <div className="w-full bg-[#15151a] border-r border-[#2d2d35] py-2 px-2 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {CATEGORY_GROUPS[activeGroup].categories.map((cat) => {
              const config = CATEGORY_CONFIG[cat];
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all whitespace-nowrap',
                    activeCategory === cat 
                      ? 'bg-[#2d2d35] text-white shadow-md' 
                      : 'text-gray-400 hover:text-white hover:bg-[#1f1f25]'
                  )}
                >
                  <span className="text-base">{config.emoji}</span>
                  <span className="text-xs font-medium">{config.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-[#2d2d35] flex items-center justify-between">
            <span className="text-sm text-gray-400">
              {CATEGORY_CONFIG[activeCategory].label} · {filteredTemplates.length} 个模板
            </span>
            <div className="flex gap-1">
              <button className="p-1 hover:bg-[#2d2d35] rounded transition-colors">
                <ChevronLeft className="w-4 h-4 text-gray-400" />
              </button>
              <span className="text-xs text-gray-500 px-2 py-1">1/2</span>
              <button className="p-1 hover:bg-[#2d2d35] rounded transition-colors">
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-3 gap-3">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className={cn(
                    'group relative rounded-lg overflow-hidden cursor-pointer transition-all',
                    selectedTemplate?.id === template.id 
                      ? 'ring-2 ring-[#10B981] scale-[1.02]' 
                      : 'hover:ring-1 hover:ring-white/30'
                  )}
                >
                  <div className={cn(
                    'aspect-video bg-gradient-to-br',
                    TEMPLATE_COLORS[template.category] || 'from-gray-600 to-gray-700'
                  )}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white/50 text-2xl font-bold opacity-30">
                        {template.name.slice(0, 2)}
                      </span>
                    </div>
                  </div>
                  
                  {template.isPremium && (
                    <div className="absolute top-2 right-2">
                      <Crown className="w-4 h-4 text-yellow-400 drop-shadow-lg" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-white text-xs font-medium truncate">{template.name}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {template.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="text-[10px] text-white/70 bg-white/20 px-1.5 py-0.5 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {selectedTemplate?.id === template.id && (
                    <div className="absolute top-2 left-2">
                      <div className="w-5 h-5 bg-[#10B981] rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {selectedTemplate && (
        <div className="border-t border-[#2d2d35] bg-[#15151a]">
          {!showVisualEditor ? (
            <div className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={cn(
                  'w-12 h-12 rounded-lg bg-gradient-to-br',
                  TEMPLATE_COLORS[selectedTemplate.category] || 'from-gray-600 to-gray-700'
                )}>
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-white/50 text-sm font-bold">
                      {selectedTemplate.name.slice(0, 2)}
                    </span>
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="text-white font-medium text-sm">{selectedTemplate.name}</h4>
                  <div className="flex gap-1 mt-1">
                    {selectedTemplate.tags.map((tag) => (
                      <span key={tag} className="text-[10px] text-gray-400 bg-[#2d2d35] px-1.5 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleApplyTemplate}
                  className="flex-1 py-2.5 bg-[#10B981] hover:bg-[#0ea572] text-white rounded-lg font-medium transition-colors"
                >
                  应用模板
                </button>
                <button
                  onClick={() => setShowVisualEditor(true)}
                  className="px-4 py-2.5 bg-[#2d2d35] hover:bg-[#3d3d45] text-white rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Settings className="w-4 h-4" />
                  编辑
                </button>
              </div>
            </div>
          ) : (
            <VisualTemplateEditor
              templateId={selectedTemplate.id}
              templateName={selectedTemplate.name}
              onParametersChange={(params) => console.warn('Params changed:', params)}
              onPreview={() => console.warn('Preview template')}
              onSave={(params) => {
                console.warn('Save params:', params);
                setShowVisualEditor(false);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
