/**
 * StyleSelector - 风格选择器
 * 配置驱动的风格标签选择组件
 */
import React, { memo, useCallback } from 'react';
import { Palette } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StyleOption {
  value: string;
  label: string;
  icon?: string;
  color?: string;
  category?: string;
}

export interface StyleSelectorProps {
  value: string;
  onChange: (value: string) => void;
  options: StyleOption[];
  label?: string;
  columns?: number;
  accentColor?: string;
  showAllOption?: boolean;
  allLabel?: string;
  className?: string;
}

export const IMAGE_STYLE_OPTIONS: StyleOption[] = [
  { value: 'none', label: '无', icon: '➖' },
  { value: 'realistic', label: '写实', icon: '📷', category: 'photography' },
  { value: 'anime', label: '动漫', icon: '🎌', category: 'illustration' },
  { value: 'digital-art', label: '数字艺术', icon: '💻', category: 'design' },
  { value: 'oil-painting', label: '油画', icon: '🖼️', category: 'fine-art' },
  { value: 'watercolor', label: '水彩', icon: '🎨', category: 'fine-art' },
  { value: '3d-render', label: '3D渲染', icon: '🎲', category: '3d' },
  { value: 'concept-art', label: '概念艺术', icon: '✏️', category: 'design' },
  { value: 'cinematic', label: '电影感', icon: '🎬', category: 'photography' },
  { value: 'cyberpunk', label: '赛博朋克', icon: '🤖', category: 'sci-fi' },
  { value: 'fantasy', label: '奇幻', icon: '🧙', category: 'fantasy' },
  { value: 'abstract', label: '抽象', icon: '🎭', category: 'art' },
];

export const VIDEO_STYLE_OPTIONS: StyleOption[] = [
  { value: 'none', label: '无', icon: '➖' },
  { value: 'cinematic', label: '电影感', icon: '🎬' },
  { value: 'documentary', label: '纪录片', icon: '📽️' },
  { value: 'animation', label: '动画', icon: '🎞️' },
  { value: 'vfx', label: '视觉特效', icon: '✨' },
  { value: 'anime', label: '动漫风格', icon: '🎌' },
  { value: 'vintage', label: '复古胶片', icon: '📽️' },
  { value: 'action', label: '动作片', icon: '💥' },
];

export const StyleSelector = memo<StyleSelectorProps>(({
  value,
  onChange,
  options,
  label = '艺术风格',
  columns = 4,
  accentColor = '#6610F2',
  className,
}) => {
  const handleSelect = useCallback((optionValue: string) => {
    onChange(optionValue);
  }, [onChange]);
  
  const gridColsClass = {
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    6: 'grid-cols-6',
    8: 'grid-cols-4 md:grid-cols-8',
  }[columns] || 'grid-cols-4';
  
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-white/60 uppercase tracking-wider">
        <Palette className="w-3 h-3" />
        {label}
      </label>
      
      <div className={cn('grid gap-1', gridColsClass)}>
        {options.map(option => {
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={cn(
                'py-1.5 px-2 rounded text-xs font-medium transition-all text-center',
                isSelected
                  ? 'text-white shadow-md'
                  : 'bg-[#252528] text-[#ABABAB] hover:bg-[#303033]'
              )}
              style={isSelected ? { backgroundColor: option.color || accentColor } : undefined}
              title={option.label}
            >
              {option.icon && <span className="mr-1">{option.icon}</span>}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
});

StyleSelector.displayName = 'StyleSelector';
export default StyleSelector;
