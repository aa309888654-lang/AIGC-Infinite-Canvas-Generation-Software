import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, Sparkles, Zap } from 'lucide-react';
import { getModelIconConfig, isVideoModel, isImageModel } from '@/config/model-icons';
import { ModelInfo } from '@/services/model-registry';
import { cn } from '@/lib/utils';

interface UnifiedModelConfig {
  modelId: string;
  modelInfo?: ModelInfo;
  isConfigured?: boolean;
  isAvailable?: boolean;
}

interface ModelSelectorProps {
  models: UnifiedModelConfig[];
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
  type: 'video' | 'image';
  className?: string;
}

function getModelIconFallback(modelId: string): string {
  return (modelId || 'AI')
    .replace(/^[^a-zA-Z0-9]+/, '')
    .slice(0, 2)
    .toUpperCase() || 'AI';
}

const ModelIconVisual: React.FC<{ icon: string; modelId: string; className: string }> = ({ icon, modelId, className }) => {
  const [failed, setFailed] = useState(false);

  if (icon?.startsWith('/') && !failed) {
    return <img src={icon} alt="" className={className} onError={() => setFailed(true)} />;
  }

  return (
    <span className="filter drop-shadow-sm text-2xl font-bold">
      {icon && !icon.startsWith('/') ? icon : getModelIconFallback(modelId)}
    </span>
  );
};

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  selectedModelId,
  onModelChange,
  type,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const currentModel = models.find(m => m.modelId === selectedModelId);
  const currentIcon = getModelIconConfig(selectedModelId);

  // 过滤模型列表
  const filteredModels = models.filter(m => {
    const matchesSearch = 
      m.modelInfo?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.modelId?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (type === 'video') {
      return matchesSearch && isVideoModel(m.modelId);
    } else {
      return matchesSearch && isImageModel(m.modelId);
    }
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      {/* 触发按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full h-14 px-4 pr-12 bg-gray-700 border-2 rounded-xl text-left transition-all duration-150',
          'hover:bg-gray-600 hover:border-gray-400',
          'focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-400',
          isOpen ? 'border-gray-400 shadow-md' : 'border-gray-600 shadow-sm'
        )}
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-11 h-11 rounded-lg flex items-center justify-center text-xl shadow-sm border overflow-hidden"
            style={{ 
              backgroundColor: `${currentIcon.color}15`,
              borderColor: `${currentIcon.color}30`,
              boxShadow: `0 0 12px ${currentIcon.color}20`
            }}
          >
            <ModelIconVisual icon={currentIcon.icon} modelId={selectedModelId} className="w-full h-full object-contain p-1" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-white truncate tracking-wide">
              {currentModel?.modelInfo?.name || selectedModelId}
            </div>
            <div className="text-sm text-white truncate font-medium">
              {currentIcon.description}
            </div>
          </div>
          <ChevronDown 
            size={22} 
            className={cn(
              'text-white transition-transform duration-150 flex-shrink-0',
              isOpen && 'rotate-180'
            )} 
          />
        </div>
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-700 border-2 border-gray-600 rounded-xl shadow-lg z-50 overflow-hidden animate-scaleIn">
          {/* 搜索框 */}
          <div className="p-4 border-b border-gray-600 bg-gray-800">
            <div className="relative">
              <input
                type="text"
                placeholder="搜索模型..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-11 px-4 pl-11 bg-gray-600 border-2 border-gray-500 rounded-xl text-sm font-medium text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all"
              />
              <Sparkles 
                size={18} 
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white" 
              />
            </div>
          </div>

          {/* 模型列表 */}
          <div className="max-h-96 overflow-y-auto custom-scrollbar bg-gray-800">
            {filteredModels.length > 0 ? (
              <div className="p-3 space-y-2">
                {filteredModels.map((model) => (
                  <ModelOption
                    key={model.modelId}
                    model={model}
                    isSelected={selectedModelId === model.modelId}
                    onSelect={() => {
                      onModelChange(model.modelId);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="p-12 text-center">
                <Sparkles size={48} className="mx-auto mb-3 text-white" />
                <p className="text-base font-medium text-white">未找到匹配的模型</p>
              </div>
            )}
          </div>

          {/* 类型标识 */}
          <div className="px-4 py-3 bg-gray-800 border-t border-gray-600 flex items-center justify-between">
            <span className="text-sm font-semibold text-white">
              共 {filteredModels.length} 个{type === 'video' ? '视频' : '图片'}模型
            </span>
            <div className="flex items-center gap-2">
              {type === 'video' ? (
                <>
                  <Zap size={14} className="text-amber-400" />
                  <span className="text-sm font-bold text-amber-400">视频生成</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} className="text-white" />
                  <span className="text-sm font-bold text-white">图片生成</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 模型选项组件
interface ModelOptionProps {
  model: UnifiedModelConfig;
  isSelected: boolean;
  onSelect: () => void;
}

const ModelOption: React.FC<ModelOptionProps> = ({ model, isSelected, onSelect }) => {
  const iconConfig = getModelIconConfig(model.modelId);
  
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full p-4 rounded-xl flex items-center gap-4 transition-all duration-150 border-2',
        isSelected 
          ? 'bg-gray-600 border-gray-400 shadow-sm' 
          : 'bg-gray-700 border-gray-600 hover:bg-gray-600 hover:border-gray-500'
      )}
    >
      {/* 模型图标 */}
      <div 
        className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0 shadow-sm border overflow-hidden"
        style={{ 
          color: iconConfig.color,
          boxShadow: `0 0 12px ${iconConfig.color}25`,
          borderColor: `${iconConfig.color}35`,
          backgroundColor: `${iconConfig.color}12`
        }}
      >
        <ModelIconVisual icon={iconConfig.icon} modelId={model.modelId} className="w-full h-full object-contain p-1.5" />
      </div>

      {/* 模型信息 */}
      <div className="flex-1 min-w-0">
        <span className="text-base font-bold text-white truncate">
          {model.modelInfo?.name || model.modelId}
        </span>
        <p className="text-sm text-white truncate mt-0.5 font-medium">
          {model.modelInfo?.description || iconConfig.description}
        </p>
      </div>

      {/* 选中标识 */}
      {isSelected && (
        <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center flex-shrink-0 shadow-sm">
          <Check size={18} className="text-white font-bold" />
        </div>
      )}
    </button>
  );
};

export default ModelSelector;
