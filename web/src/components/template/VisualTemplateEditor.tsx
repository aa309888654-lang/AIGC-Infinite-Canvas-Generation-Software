import React, { useState, useCallback, useMemo } from 'react';
import {
  Settings, Sliders, Palette, Type, Image as ImageIcon,
  Sparkles, RotateCcw, Eye, Save, ChevronDown, ChevronUp,
  Sun, Moon, Camera, Layers, Wand2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TemplateParameter {
  id: string;
  name: string;
  type: 'slider' | 'color' | 'select' | 'toggle' | 'text';
  value: any;
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: any }[];
  icon: React.ReactNode;
  description: string;
  category: 'composition' | 'style' | 'lighting' | 'technical' | 'subject';
}

interface VisualTemplateEditorProps {
  templateId: string;
  templateName: string;
  initialParameters?: Record<string, any>;
  onParametersChange?: (params: Record<string, any>) => void;
  onPreview?: () => void;
  onSave?: (params: Record<string, any>) => void;
}

const DEFAULT_PARAMETERS: TemplateParameter[] = [
  {
    id: 'intensity',
    name: '效果强度',
    type: 'slider',
    value: 0.7,
    min: 0,
    max: 1,
    step: 0.05,
    icon: <Sliders className="w-4 h-4" />,
    description: '控制模板效果的强度',
    category: 'technical'
  },
  {
    id: 'brightness',
    name: '亮度',
    type: 'slider',
    value: 0.5,
    min: -0.5,
    max: 0.5,
    step: 0.05,
    icon: <Sun className="w-4 h-4" />,
    description: '调整画面亮度',
    category: 'lighting'
  },
  {
    id: 'contrast',
    name: '对比度',
    type: 'slider',
    value: 0.3,
    min: -0.5,
    max: 0.5,
    step: 0.05,
    icon: <Layers className="w-4 h-4" />,
    description: '调整明暗对比',
    category: 'lighting'
  },
  {
    id: 'saturation',
    name: '饱和度',
    type: 'slider',
    value: 0.2,
    min: -0.5,
    max: 0.5,
    step: 0.05,
    icon: <Palette className="w-4 h-4" />,
    description: '调整色彩鲜艳程度',
    category: 'style'
  },
  {
    id: 'colorTone',
    name: '色调',
    type: 'select',
    value: 'warm',
    options: [
      { label: '暖色调', value: 'warm' },
      { label: '冷色调', value: 'cool' },
      { label: '自然', value: 'neutral' },
      { label: '电影感', value: 'cinematic' }
    ],
    icon: <Palette className="w-4 h-4" />,
    description: '选择整体色调风格',
    category: 'style'
  },
  {
    id: 'blurAmount',
    name: '背景虚化',
    type: 'slider',
    value: 0.5,
    min: 0,
    max: 1,
    step: 0.1,
    icon: <Camera className="w-4 h-4" />,
    description: '景深/背景模糊程度',
    category: 'composition'
  },
  {
    id: 'grainEffect',
    name: '胶片颗粒',
    type: 'slider',
    value: 0.15,
    min: 0,
    max: 0.5,
    step: 0.01,
    icon: <ImageIcon className="w-4 h-4" />,
    description: '添加胶片质感颗粒',
    category: 'style'
  },
  {
    id: 'vignette',
    name: '暗角效果',
    type: 'slider',
    value: 0.25,
    min: 0,
    max: 1,
    step: 0.05,
    icon: <Moon className="w-4 h-4" />,
    description: '边缘渐暗效果',
    category: 'technical'
  },
  {
    id: 'sharpening',
    name: '锐化',
    type: 'slider',
    value: 0.2,
    min: 0,
    max: 1,
    step: 0.05,
    icon: <Wand2 className="w-4 h-4" />,
    description: '增强细节清晰度',
    category: 'technical'
  },
  {
    id: 'aspectRatio',
    name: '宽高比',
    type: 'select',
    value: '16:9',
    options: [
      { label: '16:9 宽屏', value: '16:9' },
      { label: '9:16 竖屏', value: '9:16' },
      { label: '1:1 方形', value: '1:1' },
      { label: '4:3 传统', value: '4:3' },
      { label: '21:9 超宽', value: '21:9' }
    ],
    icon: <Type className="w-4 h-4" />,
    description: '输出画面的比例',
    category: 'composition'
  },
  {
    id: 'cinematicBars',
    name: '电影黑边',
    type: 'toggle',
    value: false,
    icon: <Camera className="w-4 h-4" />,
    description: '添加上下黑边模拟电影感',
    category: 'style'
  },
  {
    id: 'customPrompt',
    name: '自定义提示词',
    type: 'text',
    value: '',
    icon: <Sparkles className="w-4 h-4" />,
    description: '添加额外的自定义描述',
    category: 'subject'
  }
];

const CATEGORY_CONFIG = {
  composition: { label: '构图', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  style: { label: '风格', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  lighting: { label: '光线', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  technical: { label: '技术', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  subject: { label: '主体', color: 'bg-red-500/20 text-red-400 border-red-500/30' }
};

export default function VisualTemplateEditor({
  templateId,
  templateName,
  initialParameters = {},
  onParametersChange,
  onPreview,
  onSave
}: VisualTemplateEditorProps) {
  const [parameters, setParameters] = useState<TemplateParameter[]>(() => {
    return DEFAULT_PARAMETERS.map(param => ({
      ...param,
      value: initialParameters[param.id] ?? param.value
    }));
  });

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['composition', 'style'])
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  const categories = useMemo(() => {
    const grouped: Record<string, TemplateParameter[]> = {};
    parameters.forEach(param => {
      if (!grouped[param.category]) {
        grouped[param.category] = [];
      }
      grouped[param.category].push(param);
    });
    return Object.entries(grouped);
  }, [parameters]);

  const basicParams = parameters.slice(0, 6);
  const advancedParams = parameters.slice(6);

  const handleParameterChange = useCallback((id: string, newValue: any) => {
    setParameters(prev =>
      prev.map(p => p.id === id ? { ...p, value: newValue } : p)
    );

    const newParams = parameters.reduce((acc, p) => {
      acc[p.id] = p.id === id ? newValue : p.value;
      return acc;
    }, {} as Record<string, any>);

    onParametersChange?.(newParams);
  }, [parameters, onParametersChange]);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    setParameters(DEFAULT_PARAMETERS.map(param => ({ ...param })));
    onParametersChange?.({});
  }, [onParametersChange]);

  const getParamValue = useCallback((id: string) => {
    return parameters.find(p => p.id === id)?.value ?? null;
  }, [parameters]);

  const renderParameterControl = (param: TemplateParameter) => {
    switch (param.type) {
      case 'slider':
        return (
          <div key={param.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={cn('text-sm', CATEGORY_CONFIG[param.category]?.color.split(' ')[1])}>
                  {param.icon}
                </span>
                <span className="text-xs text-gray-300">{param.name}</span>
              </div>
              <span className="text-xs font-mono bg-[#252528] px-2 py-0.5 rounded">
                {(typeof param.value === 'number') ? param.value.toFixed(2) : param.value}
              </span>
            </div>
            <input
              type="range"
              min={param.min}
              max={param.max}
              step={param.step}
              value={param.value}
              onChange={(e) => handleParameterChange(param.id, parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                bg-[#2d2d35] accent-gray-500"
            />
            <div className="flex justify-between text-[10px] text-gray-600">
              <span>{param.min}</span>
              <span>{param.max}</span>
            </div>
          </div>
        );

      case 'color':
        return (
          <div key={param.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={CATEGORY_CONFIG[param.category]?.color.split(' ')[1]}>
                {param.icon}
              </span>
              <span className="text-xs text-gray-300">{param.name}</span>
            </div>
            <input
              type="color"
              value={param.value || '#000000'}
              onChange={(e) => handleParameterChange(param.id, e.target.value)}
              className="w-full h-8 rounded cursor-pointer bg-transparent"
            />
          </div>
        );

      case 'select':
        return (
          <div key={param.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={CATEGORY_CONFIG[param.category]?.color.split(' ')[1]}>
                {param.icon}
              </span>
              <span className="text-xs text-gray-300">{param.name}</span>
            </div>
            <select
              value={param.value}
              onChange={(e) => handleParameterChange(param.id, e.target.value)}
              className="w-full px-3 py-1.5 bg-[#252528] text-white text-xs rounded-lg
                border border-white/10 focus:border-gray-500/50 focus:outline-none"
            >
              {param.options?.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        );

      case 'toggle':
        return (
          <div key={param.id} className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <span className={CATEGORY_CONFIG[param.category]?.color.split(' ')[1]}>
                {param.icon}
              </span>
              <span className="text-xs text-gray-300">{param.name}</span>
            </div>
            <button
              onClick={() => handleParameterChange(param.id, !param.value)}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors',
                param.value ? 'bg-green-500' : 'bg-[#3d3d45]'
              )}
            >
              <span className={cn(
                'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform',
                param.value && 'translate-x-5'
              )} />
            </button>
          </div>
        );

      case 'text':
        return (
          <div key={param.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={CATEGORY_CONFIG[param.category]?.color.split(' ')[1]}>
                {param.icon}
              </span>
              <span className="text-xs text-gray-300">{param.name}</span>
            </div>
            <textarea
              value={param.value || ''}
              onChange={(e) => handleParameterChange(param.id, e.target.value)}
              placeholder={param.description}
              rows={2}
              className="w-full px-3 py-2 bg-[#252528] text-white text-xs rounded-lg
                border border-white/10 focus:border-gray-500/50 focus:outline-none resize-none placeholder-gray-600"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-[#1A1A1D] rounded-xl border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-[#15151A] border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-white">可视化模板编辑</span>
          <span className="text-xs text-gray-500">- {templateName}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetToDefaults}
            className="p-1.5 hover:bg-white/5 rounded transition-colors"
            title="重置默认值"
          >
            <RotateCcw className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="px-2 py-1 text-xs bg-[#2d2d35] hover:bg-[#3d3d45] rounded transition-colors"
          >
            {showAdvanced ? '简化' : '高级'}
          </button>
        </div>
      </div>

      {/* Basic Parameters */}
      {!showAdvanced && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {basicParams.map(renderParameterControl)}
          </div>

          {/* Quick Presets */}
          <div className="pt-3 border-t border-white/5">
            <div className="text-xs text-gray-500 mb-2">快捷预设</div>
            <div className="flex gap-2 flex-wrap">
              {[
                { label: '清新明亮', values: { brightness: 0.3, saturation: 0.4, contrast: 0.15 } },
                { label: '电影感', values: { colorTone: 'cinematic', vignette: 0.4, grainEffect: 0.2, cinematicBars: true } },
                { label: '柔和梦幻', values: { blurAmount: 0.7, brightness: 0.2, saturation: -0.1 } },
                { label: '高对比', values: { contrast: 0.5, sharpening: 0.6, saturation: 0.3 } }
              ].map(preset => (
                <button
                  key={preset.label}
                  onClick={() => {
                    Object.entries(preset.values).forEach(([key, val]) => {
                      handleParameterChange(key, val);
                    });
                  }}
                  className="px-3 py-1.5 text-xs bg-[#2d2d35] hover:bg-[#3d3d45] rounded-lg transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Advanced Parameters */}
      {showAdvanced && (
        <div className="max-h-[500px] overflow-y-auto">
          {categories.map(([category, params]) => (
            <div key={category} className="border-b border-white/5 last:border-b-0">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'px-2 py-0.5 text-[10px] rounded-full border',
                    CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG]?.color
                  )}>
                    {CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG]?.label}
                  </span>
                  <span className="text-xs text-gray-400">
                    {params.length} 个参数
                  </span>
                </div>
                {expandedCategories.has(category) ?
                  <ChevronUp className="w-4 h-4 text-gray-500" /> :
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                }
              </button>

              {expandedCategories.has(category) && (
                <div className="px-4 pb-4 space-y-4">
                  {params.map(param => (
                    <div key={param.id}>
                      {renderParameterControl(param)}
                      <p className="mt-1 text-[10px] text-gray-600 pl-8">
                        {param.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action Bar */}
      <div className="px-4 py-3 bg-[#15151A] border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Eye className="w-3.5 h-3.5" />
          <span>实时预览</span>
        </div>
        <div className="flex items-center gap-2">
          {onPreview && (
            <button
              onClick={onPreview}
              className="px-3 py-1.5 text-xs bg-[#2d2d35] hover:bg-[#3d3d45] rounded-lg
                flex items-center gap-1.5 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              预览
            </button>
          )}
          {onSave && (
            <button
              onClick={() => onSave(parameters.reduce((acc, p) => {
                acc[p.id] = p.value;
                return acc;
              }, {} as Record<string, any>))}
              className="px-3 py-1.5 text-xs bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500
                rounded-lg flex items-center gap-1.5 transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              保存配置
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
