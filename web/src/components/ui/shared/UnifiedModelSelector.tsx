/**
 * 统一AI模型选择器组件
 * 允许用户为节点选择不同的AI大模型
 * 支持上拉菜单模式，顶部有进入软件界面按钮
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { UNIFIED_MODELS, AIModelType} from '@/services/unified-ai-adapter';
import { ChevronDown, Search, Bot, Image, Video, Type, Layers, Home, ExternalLink } from 'lucide-react';
import { navigateTo } from '@/routes';

interface UnifiedModelSelectorProps {
  value?: string;
  onChange: (modelId: string) => void;
  allowedTypes?: AIModelType[];
  placeholder?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  dropdownDirection?: 'up' | 'down';
}

const UnifiedModelSelector: React.FC<UnifiedModelSelectorProps> = ({
  value,
  onChange,
  allowedTypes,
  placeholder = '选择AI模型',
  showIcon = true,
  size = 'md',
  className = '',
  dropdownDirection = 'up',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<AIModelType | 'all'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // 过滤模型列表
  const filteredModels = useMemo(() => {
    let models = UNIFIED_MODELS;

    // 按类型过滤
    if (activeTab !== 'all') {
      models = models.filter(m => m.type === activeTab);
    }

    // 按允许的类型过滤
    if (allowedTypes && allowedTypes.length > 0) {
      models = models.filter(m => allowedTypes.includes(m.type));
    }

    // 按搜索关键词过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      models = models.filter(m =>
        m.name.toLowerCase().includes(query) ||
        m.provider.toLowerCase().includes(query) ||
        m.capabilities.some(c => c.toLowerCase().includes(query))
      );
    }

    return models;
  }, [activeTab, allowedTypes, searchQuery]);

  // 获取当前选中的模型
  const selectedModel = UNIFIED_MODELS.find(m => m.id === value);

  // 获取类型图标
  const getTypeIcon = (type: AIModelType) => {
    switch (type) {
      case 'text':
        return <Type className="w-4 h-4" />;
      case 'image':
        return <Image className="w-4 h-4" />;
      case 'video':
        return <Video className="w-4 h-4" />;
      case 'audio':
        return <Video className="w-4 h-4" />;
      case 'multimodal':
        return <Layers className="w-4 h-4" />;
      default:
        return <Bot className="w-4 h-4" />;
    }
  };

  // 获取类型颜色
  const getTypeColor = (type: AIModelType) => {
    switch (type) {
      case 'text':
        return 'text-gray-400 bg-gray-400/10';
      case 'image':
        return 'text-purple-400 bg-purple-400/10';
      case 'video':
        return 'text-pink-400 bg-pink-400/10';
      case 'audio':
        return 'text-green-400 bg-green-400/10';
      case 'multimodal':
        return 'text-amber-400 bg-amber-400/10';
      default:
        return 'text-gray-400 bg-gray-400/10';
    }
  };

  // 尺寸样式
  const sizeStyles = {
    sm: 'text-xs py-1 px-2',
    md: 'text-sm py-2 px-3',
    lg: 'text-base py-3 px-4',
  };

  // 处理进入软件界面
  const handleEnterWorkspace = () => {
    setIsOpen(false);
    navigateTo('/workspace');
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* 触发器 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          ${sizeStyles[size]}
          w-full flex items-center gap-2 bg-[#2A2A2E] border border-[#3D3D42] rounded-lg
          hover:border-[#10B981] transition-colors text-left
          ${selectedModel ? 'text-white' : 'text-gray-400'}
        `}
      >
        {showIcon && selectedModel && (
          <span style={{ color: selectedModel.color }}>
            {getTypeIcon(selectedModel.type)}
          </span>
        )}
        <span className="flex-1">
          {selectedModel ? selectedModel.name : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? (dropdownDirection === 'up' ? 'rotate-0' : 'rotate-180') : (dropdownDirection === 'up' ? 'rotate-180' : 'rotate-0')}`} />
      </button>

      {/* 菜单 */}
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* 菜单内容 - 上拉或下拉 */}
          <div className={`
            absolute z-50 w-full min-w-[320px] bg-[#1F1F23] border border-[#3D3D42] rounded-lg shadow-xl overflow-hidden
            ${dropdownDirection === 'up' ? 'bottom-full mb-2' : 'mt-2'}
          `}>
            {/* 顶部按钮 - 进入软件界面 */}
            <button
              onClick={handleEnterWorkspace}
              className="w-full flex items-center gap-3 p-3 bg-gradient-to-r from-[#10B981]/20 to-[#059669]/20 border-b border-[#3D3D42] hover:from-[#10B981]/30 hover:to-[#059669]/30 transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-[#10B981]/20 flex items-center justify-center">
                <Home className="w-5 h-5 text-[#10B981]" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-white font-medium text-sm">进入软件界面</div>
                <div className="text-gray-400 text-xs">打开AI剪辑工作台</div>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-400" />
            </button>

            {/* 搜索框 */}
            <div className="p-3 border-b border-[#3D3D42]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索模型..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[#2A2A2E] border border-[#3D3D42] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#10B981]"
                />
              </div>
            </div>

            {/* 类型标签页 */}
            <div className="flex gap-1 p-2 border-b border-[#3D3D42] overflow-x-auto">
              {(['all', 'text', 'image', 'video', 'multimodal'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`
                    px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors
                    ${activeTab === tab
                      ? 'bg-[#10B981] text-white'
                      : 'bg-[#2A2A2E] text-gray-300 hover:bg-[#3D3D42]'
                    }
                  `}
                >
                  {tab === 'all' ? '全部' :
                   tab === 'text' ? '文本' :
                   tab === 'image' ? '图像' :
                   tab === 'video' ? '视频' : '多模态'}
                </button>
              ))}
            </div>

            {/* 模型列表 */}
            <div className="max-h-80 overflow-y-auto">
              {filteredModels.length === 0 ? (
                <div className="p-4 text-center text-gray-400">
                  未找到匹配的模型
                </div>
              ) : (
                <div className="p-2">
                  {filteredModels.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => {
                        onChange(model.id);
                        setIsOpen(false);
                        setSearchQuery('');
                      }}
                      className={`
                        w-full flex items-center gap-3 p-3 rounded-lg transition-colors
                        ${selectedModel?.id === model.id
                          ? 'bg-[#10B981]/20 border border-[#10B981]'
                          : 'hover:bg-[#2A2A2E] border border-transparent'
                        }
                      `}
                    >
                      {/* 模型图标 */}
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                        style={{ backgroundColor: `${model.color}20` }}
                      >
                        {model.icon}
                      </div>

                      {/* 模型信息 */}
                      <div className="flex-1 text-left">
                        <div className="text-white font-medium text-sm">
                          {model.name}
                        </div>
                        <div className="text-gray-400 text-xs mt-0.5">
                          {model.provider} • {model.capabilities.join(', ')}
                        </div>
                      </div>

                      {/* 类型标签 */}
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${getTypeColor(model.type)}`}>
                        {getTypeIcon(model.type)}
                        <span className="text-xs font-medium">
                          {model.type === 'text' ? '文本' :
                           model.type === 'image' ? '图像' :
                           model.type === 'video' ? '视频' :
                           model.type === 'multimodal' ? '多模态' : model.type}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 底部显示模型数量 */}
            <div className="p-2 border-t border-[#3D3D42] bg-[#1A1A1D]">
              <div className="text-xs text-gray-500 text-center">
                共 {filteredModels.length} 个内置模型
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default UnifiedModelSelector;
