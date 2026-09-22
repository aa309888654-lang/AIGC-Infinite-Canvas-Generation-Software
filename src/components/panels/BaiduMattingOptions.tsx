/**
 * 百度AI抠图选项面板
 * 提供多种抠图方式和参数选择
 */

import React from 'react';
import { Scissors, Wand2, Layers, CheckCircle } from 'lucide-react';

interface MattingOption {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  method: string;
  returnForm: string;
  refineMask: boolean;
}

const mattingOptions: MattingOption[] = [
  {
    id: 'auto-rgba',
    name: '智能抠图',
    description: '自动识别主体，透明背景',
    icon: <Wand2 className="w-4 h-4" />,
    method: 'auto',
    returnForm: 'rgba',
    refineMask: true,
  },
  {
    id: 'auto-mask',
    name: '主体蒙版',
    description: '返回二值蒙版图',
    icon: <Layers className="w-4 h-4" />,
    method: 'auto',
    returnForm: 'mask',
    refineMask: false,
  },
  {
    id: 'control-box',
    name: '框选抠图',
    description: '手动框选主体区域',
    icon: <Scissors className="w-4 h-4" />,
    method: 'control',
    returnForm: 'rgba',
    refineMask: true,
  },
];

interface BaiduMattingOptionsProps {
  onSelect: (option: MattingOption) => void;
  selectedId?: string;
}

export const BaiduMattingOptions: React.FC<BaiduMattingOptionsProps> = ({ 
  onSelect, 
  selectedId = 'auto-rgba' 
}) => {
  return (
    <div className="bg-neutral-700 rounded-lg p-3 space-y-2">
      <div className="text-xs text-gray-400 mb-3">选择抠图方式</div>
      
      {mattingOptions.map((option) => (
        <button
          key={option.id}
          onClick={() => onSelect(option)}
          className={`w-full p-3 rounded-lg transition-all text-left ${
            selectedId === option.id
              ? 'bg-red-600/20 border-2 border-red-500 text-white'
              : 'bg-neutral-600/50 border-2 border-transparent hover:bg-neutral-600 text-gray-300'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 ${
              selectedId === option.id ? 'text-red-400' : 'text-gray-400'
            }`}>
              {option.icon}
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm flex items-center gap-2">
                {option.name}
                {selectedId === option.id && (
                  <CheckCircle className="w-3 h-3 text-red-400" />
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
            <span>自动压缩图片</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-green-500" />
            <span>Base64编码优化</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BaiduMattingOptions;
