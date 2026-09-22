import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, ChevronDown, Sparkles, X, ChevronRight, Check } from 'lucide-react';
import { VIDEO_TEMPLATES, IMAGE_TEMPLATES, type TemplateItem, fillTemplate, MOTION_PRESETS, STYLE_PRESETS } from '@/config/prompt-templates';
import { cn } from '@/lib/utils';

interface PromptTemplateSelectorProps {
  type: 'video' | 'image';
  onSelect: (prompt: string, templateName: string) => void;
  currentPrompt?: string;
  currentMotion?: string;
  currentStyle?: string;
  onMotionChange?: (motion: string) => void;
  onStyleChange?: (style: string) => void;
}

export const PromptTemplateSelector = ({
  type,
  onSelect,
  currentPrompt,
  currentMotion,
  currentStyle,
  onMotionChange,
  onStyleChange,
}: PromptTemplateSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [showVariableEditor, setShowVariableEditor] = useState(false);
  const [variableValues, setVariableValues] = useState({
    subject: '',
    motion: currentMotion || '缓慢移动',
    duration: '5',
    style: currentStyle || '写实',
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const templates = type === 'video' ? VIDEO_TEMPLATES : IMAGE_TEMPLATES;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowVariableEditor(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredTemplates = searchTerm
    ? templates.map(cat => ({
        ...cat,
        templates: cat.templates.filter(t =>
          t.name.includes(searchTerm) ||
          t.prompt.includes(searchTerm) ||
          t.tags?.some(tag => tag.includes(searchTerm))
        ),
      })).filter(cat => cat.templates.length > 0)
    : templates;

  const handleApply = useCallback(() => {
    if (!selectedTemplate) return;
    const filledPrompt = fillTemplate(selectedTemplate.prompt, variableValues);
    onSelect(filledPrompt, selectedTemplate.name);
    if (onMotionChange) onMotionChange(variableValues.motion);
    if (onStyleChange) onStyleChange(variableValues.style);
    setIsOpen(false);
    setShowVariableEditor(false);
    setSelectedTemplate(null);
  }, [selectedTemplate, variableValues, onSelect, onMotionChange, onStyleChange]);

  const handleQuickApply = useCallback((template: TemplateItem) => {
    const filledPrompt = fillTemplate(template.prompt, {
      subject: currentPrompt || '一个美丽的场景',
      motion: currentMotion || '缓慢移动',
      style: currentStyle || '写实',
    });

    onSelect(filledPrompt, template.name);
    setIsOpen(false);
  }, [currentPrompt, currentMotion, currentStyle, onSelect]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-[#4B21FF]/20 to-[#AF52DE]/20 hover:from-[#4B21FF]/30 hover:to-[#AF52DE]/30 border border-[#4B21FF]/30 rounded-lg text-[#A78BFA] transition-all"
      >
        <Sparkles className="w-4 h-4" />
        <span className="text-sm font-medium">提示词模板</span>
        <ChevronDown className={cn('w-4 h-4 transition-transform duration-200', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[480px] bg-[#1F1F1F] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {!showVariableEditor ? (
            <>
              <div className="p-3 border-b border-white/10 bg-gradient-to-r from-[#4B21FF]/10 to-transparent">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="搜索模板名称、描述或标签..."
                    className="w-full pl-10 pr-4 py-2.5 bg-[#2A2A2A] border border-white/10 rounded-lg text-white text-sm placeholder-white/40 focus:outline-none focus:border-[#4B21FF] transition-colors"
                    autoFocus
                  />
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {filteredTemplates.length === 0 ? (
                  <div className="text-center py-12 text-white/40">
                    <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>未找到匹配的模板</p>
                  </div>
                ) : (
                  filteredTemplates.map((category) => (
                    <div key={category.id} className="border-b border-white/5 last:border-b-0">
                      <button
                        onClick={() => setExpandedCategory(expandedCategory === category.id ? null : category.id)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{category.icon}</span>
                          <span className="text-white font-medium">{category.category}</span>
                          <span className="text-xs text-white/40 bg-white/10 px-2 py-0.5 rounded-full">
                            {category.templates.length}
                          </span>
                        </div>
                        <ChevronRight className={cn('w-4 h-4 text-white/40 transition-transform duration-200', expandedCategory === category.id && 'rotate-90')} />
                      </button>

                      {expandedCategory === category.id && (
                        <div className="pb-2 px-2">
                          {category.templates.map((template) => (
                            <div
                              key={template.id}
                              className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors group"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-white font-medium">{template.name}</span>
                                  {template.tags?.slice(0, 2).map(tag => (
                                    <span key={tag} className="text-xs text-[#A78BFA] bg-[#4B21FF]/10 px-1.5 py-0.5 rounded">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                                {template.description && (
                                  <p className="text-xs text-white/40 mt-0.5 truncate">{template.description}</p>
                                )}
                              </div>
                              <button
                                onClick={() => handleQuickApply(template)}
                                className="ml-2 px-3 py-1 text-xs bg-[#4B21FF] hover:bg-[#5B31EF] rounded-md text-white opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" />
                                快速应用
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="px-4 py-3 border-t border-white/10 bg-white/5 text-xs text-white/40">
                点击分类展开，点击「快速应用」直接使用，或点击模板名称自定义参数
              </div>
            </>
          ) : (
            <>
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowVariableEditor(false)}
                      className="p-1 hover:bg-white/10 rounded"
                    >
                      <ChevronRight className="w-4 h-4 text-white/60 rotate-180" />
                    </button>
                    <span className="text-white font-medium">{selectedTemplate?.name}</span>
                  </div>
                  <button
                    onClick={() => {
                      setShowVariableEditor(false);
                      setSelectedTemplate(null);
                    }}
                    className="p-1 hover:bg-white/10 rounded"
                  >
                    <X className="w-4 h-4 text-white/60" />
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-4 max-h-[350px] overflow-y-auto">
                <div className="space-y-1.5">
                  <label className="text-xs text-white/60">主体内容</label>
                  <input
                    type="text"
                    value={variableValues.subject}
                    onChange={(e) => setVariableValues(v => ({ ...v, subject: e.target.value }))}
                    placeholder="描述视频的主要内容..."
                    className="w-full px-3 py-2 bg-[#2A2A2A] border border-white/10 rounded-lg text-white text-sm placeholder-white/40 focus:outline-none focus:border-[#4B21FF]"
                  />
                </div>

                {type === 'video' && (
                  <div className="space-y-1.5">
                    <label className="text-xs text-white/60">运动方式</label>
                    <select
                      value={variableValues.motion}
                      onChange={(e) => setVariableValues(v => ({ ...v, motion: e.target.value }))}
                      className="w-full px-3 py-2 bg-[#2A2A2A] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#4B21FF]"
                    >
                      {MOTION_PRESETS.map(motion => (
                        <option key={motion} value={motion}>{motion}</option>
                      ))}
                    </select>
                  </div>
                )}

                {type === 'video' && (
                  <div className="space-y-1.5">
                    <label className="text-xs text-white/60">视频时长（秒）</label>
                    <input
                      type="number"
                      value={variableValues.duration}
                      onChange={(e) => setVariableValues(v => ({ ...v, duration: e.target.value }))}
                      min="2"
                      max="12"
                      className="w-full px-3 py-2 bg-[#2A2A2A] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#4B21FF]"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs text-white/60">风格</label>
                  <select
                    value={variableValues.style}
                    onChange={(e) => setVariableValues(v => ({ ...v, style: e.target.value }))}
                    className="w-full px-3 py-2 bg-[#2A2A2A] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#4B21FF]"
                  >
                    {STYLE_PRESETS.map(style => (
                      <option key={style} value={style}>{style}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-white/60">预览提示词</label>
                  <div className="px-3 py-2 bg-[#2A2A2A] border border-white/10 rounded-lg text-white/80 text-sm leading-relaxed">
                    {fillTemplate(selectedTemplate?.prompt || '', variableValues)}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-white/10 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowVariableEditor(false);
                    setSelectedTemplate(null);
                  }}
                  className="px-4 py-2 text-sm text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleApply}
                  disabled={!variableValues.subject.trim()}
                  className="px-4 py-2 text-sm bg-[#4B21FF] hover:bg-[#5B31EF] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  应用模板
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default PromptTemplateSelector;
