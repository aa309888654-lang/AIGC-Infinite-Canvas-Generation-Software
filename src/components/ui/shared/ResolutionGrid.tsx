/**
 * ResolutionGrid - 分辨率选择网格
 * 配置驱动，自动渲染比例网格
 */
import React, { memo, useCallback } from 'react';
import { Video, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ResolutionOption {
  value: string;
  label: string;
  width: number;
  height: number;
  category?: 'square' | 'landscape' | 'portrait';
}

export interface ResolutionGridProps {
  value: string;
  onChange: (value: string) => void;
  options: ResolutionOption[];
  columns?: number;
  size?: 'sm' | 'md' | 'lg';
  showDimensions?: boolean;
  className?: string;
  accentColor?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  square: '方形',
  landscape: '横屏',
  portrait: '竖屏',
};

const CATEGORY_COLORS: Record<string, string> = {
  square: '#6366F1',
  landscape: '#10B981',
  portrait: '#00E5FF',
};

export const RESOLUTION_PRESETS: ResolutionOption[] = [
  { value: '1:1', label: '1:1', width: 1024, height: 1024, category: 'square' },
  { value: '16:9', label: '16:9', width: 1920, height: 1080, category: 'landscape' },
  { value: '3:2', label: '3:2', width: 1536, height: 1024, category: 'landscape' },
  { value: '4:3', label: '4:3', width: 1024, height: 768, category: 'landscape' },
  { value: '9:16', label: '9:16', width: 1080, height: 1920, category: 'portrait' },
  { value: '2:3', label: '2:3', width: 1024, height: 1536, category: 'portrait' },
  { value: '4:5', label: '4:5', width: 1024, height: 1280, category: 'portrait' },
  { value: '21:9', label: '21:9', width: 2560, height: 1080, category: 'landscape' },
];

export const VIDEO_RESOLUTION_PRESETS: ResolutionOption[] = [
  { value: '16:9', label: '16:9 横屏', width: 1920, height: 1080, category: 'landscape' },
  { value: '9:16', label: '9:16 竖屏', width: 1080, height: 1920, category: 'portrait' },
  { value: '1:1', label: '1:1 方形', width: 1080, height: 1080, category: 'square' },
  { value: '4:3', label: '4:3 标准', width: 1440, height: 1080, category: 'landscape' },
  { value: '4:5', label: '4:5 竖版', width: 1080, height: 1350, category: 'portrait' },
  { value: '21:9', label: '21:9 宽屏', width: 2560, height: 1080, category: 'landscape' },
];

export const ResolutionGrid = memo<ResolutionGridProps>(({
  value,
  onChange,
  options,
  size = 'md',
  showDimensions = true,
  className,
  accentColor = '#6610F2',
}) => {
  const handleSelect = useCallback((optionValue: string) => {
    onChange(optionValue);
  }, [onChange]);
  
  // 按类别分组
  const groupedOptions = options.reduce<Record<string, ResolutionOption[]>>((acc, opt) => {
    const cat = opt.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(opt);
    return acc;
  }, {});
  
  const gridColsClass = {
    sm: 'grid-cols-4',
    md: 'grid-cols-4',
    lg: 'grid-cols-3',
  }[size];
  
  const buttonSizeClass = {
    sm: 'py-1 px-1 text-[10px]',
    md: 'py-1.5 px-2 text-xs',
    lg: 'py-2 px-3 text-sm',
  }[size];
  
  // 简单模式：直接渲染所有选项
  if (Object.keys(groupedOptions).length <= 1 || options.length <= 8) {
    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-white/60">
          <Video className="w-3 h-3" />
          <span>分辨率</span>
        </div>
        <div className={cn('grid gap-1', gridColsClass)}>
          {options.map(option => {
            const isSelected = value === option.value;
            const color = option.category ? CATEGORY_COLORS[option.category] : accentColor;
            return (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={cn(
                  'rounded text-xs font-medium transition-all text-center',
                  buttonSizeClass,
                  isSelected
                    ? 'text-white'
                    : 'bg-[#252528] text-[#ABABAB] hover:bg-[#303033]'
                )}
                style={isSelected ? { backgroundColor: color } : undefined}
                title={showDimensions ? `${option.width}×${option.height}` : option.label}
              >
                <span>{option.label}</span>
                {showDimensions && (
                  <span className={cn('block text-[9px] opacity-60', isSelected ? 'text-white/80' : '')}>
                    {option.width}×{option.height}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  
  // 分组模式
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Object.entries(groupedOptions).map(([category, opts]) => (
        <div key={category} className="space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: CATEGORY_COLORS[category] || '#888' }}>
            <ImageIcon className="w-2.5 h-2.5" />
            {CATEGORY_LABELS[category] || category}
          </div>
          <div className={cn('grid gap-1', gridColsClass)}>
            {opts.map(option => {
              const isSelected = value === option.value;
              const color = option.category ? CATEGORY_COLORS[option.category] : accentColor;
              return (
                <button
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    'rounded text-xs font-medium transition-all text-center',
                    buttonSizeClass,
                    isSelected
                      ? 'text-white'
                      : 'bg-[#252528] text-[#ABABAB] hover:bg-[#303033]'
                  )}
                  style={isSelected ? { backgroundColor: color } : undefined}
                  title={showDimensions ? `${option.width}×${option.height}` : option.label}
                >
                  <span>{option.label}</span>
                  {showDimensions && (
                    <span className={cn('block text-[9px] opacity-60', isSelected ? 'text-white/80' : '')}>
                      {option.width}×{option.height}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
});

ResolutionGrid.displayName = 'ResolutionGrid';
export default ResolutionGrid;
