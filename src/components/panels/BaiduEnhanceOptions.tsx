/**
 * 百度AI图像增强选项面板
 * 提供多种图像增强方式和参数选择
 */

import React from 'react';
import { 
  Sparkles, 
  Image as ImageIcon, 
  Contrast, 
  ZoomIn,
  CheckCircle
} from 'lucide-react';

interface EnhanceOption {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  api: string;
  params?: Record<string, unknown>;
}

const enhanceOptions: EnhanceOption[] = [
  {
    id: 'definition',
    name: '清晰度增强',
    description: '提升图片清晰度和细节',
    icon: <ZoomIn className="w-4 h-4" />,
    api: 'image_definition_enhance',
  },
  {
    id: 'quality-enhance',
    name: '画质增强',
    description: '全面提升画质和色彩',
    icon: <ImageIcon className="w-4 h-4" />,
    api: 'image_quality_enhance',
  },
  {
    id: 'contrast',
    name: '对比度优化',
    description: '调整图片对比度和亮度',
    icon: <Contrast className="w-4 h-4" />,
    api: 'contrast_enhance',
  },
  {
    id: 'smart-denoise',
    name: '智能降噪',
    description: '去除图片噪点和杂质',
    icon: <Sparkles className="w-4 h-4" />,
    api: 'smart_denoise',
  },
];

interface BaiduEnhanceOptionsProps {
  onSelect: (option: EnhanceOption) => void;
  selectedId?: string;
}

export const BaiduEnhanceOptions: React.FC<BaiduEnhanceOptionsProps> = ({ 
  onSelect, 
  selectedId = 'definition' 
}) => {
  return (
    <div className="bg-neutral-700 rounded-lg p-3 space-y-2">
      <div className="text-xs text-gray-400 mb-3">选择增强方式</div>
      
      {enhanceOptions.map((option) => (
        <button
          key={option.id}
          onClick={() => onSelect(option)}
          className={`w-full p-3 rounded-lg transition-all text-left ${
            selectedId === option.id
              ? 'bg-gray-600/20 border-2 border-gray-500 text-white'
              : 'bg-neutral-600/50 border-2 border-transparent hover:bg-neutral-600 text-gray-300'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 ${
              selectedId === option.id ? 'text-gray-400' : 'text-gray-400'
            }`}>
              {option.icon}
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm flex items-center gap-2">
                {option.name}
                {selectedId === option.id && (
                  <CheckCircle className="w-3 h-3 text-gray-400" />
                )}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {option.description}
              </div>
            </div>
          </div>
        </button>
      ))}

      <div className="pt-2 border-t border-neutral-600">
        <div className="text-xs text-gray-500">
          <div className="flex items-center gap-1 mb-1">
            <CheckCircle className="w-3 h-3 text-green-500" />
            <span>支持大图处理</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-green-500" />
            <span>自动优化参数</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BaiduEnhanceOptions;
