/**
 * QualitySelector - 画质选择器
 * 简洁的画质档位选择组件
 */
import React, { memo, useCallback } from 'react';
import { Sparkles, Clock} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface QualityOption {
  value: string;
  label: string;
  description?: string;
  time?: string;
  color?: string;
}

export interface QualitySelectorProps {
  value: string;
  onChange: (value: string) => void;
  options: QualityOption[];
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
  accentColor?: string;
}

const DEFAULT_QUALITY_OPTIONS: QualityOption[] = [
  { value: 'standard', label: '标准', description: '快速生成', time: '~3s', color: '#6B7280' },
  { value: 'hd', label: '高清', description: '平衡质量', time: '~8s', color: '#9CA3AF' },
  { value: 'ultra', label: '超清', description: '最高质量', time: '~15s', color: '#00E5FF' },
];

export const QualitySelector = memo<QualitySelectorProps>(({
  value,
  onChange,
  options = DEFAULT_QUALITY_OPTIONS,
  label = '生成质量',
  size = 'md',
  className,
  accentColor = '#6610F2',
}) => {
  const handleSelect = useCallback((optionValue: string) => {
    onChange(optionValue);
  }, [onChange]);
  
  const buttonSizeClass = size === 'sm'
    ? 'py-1.5 px-2 text-[11px]'
    : 'py-2 px-3 text-xs';
  
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-white/60 uppercase tracking-wider">
        <Sparkles className="w-3 h-3" />
        {label}
      </label>
      
      <div className="flex gap-1">
        {options.map(option => {
          const isSelected = value === option.value;
          const color = option.color || accentColor;
          return (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={cn(
                'flex-1 rounded font-medium transition-all flex flex-col items-center',
                buttonSizeClass,
                isSelected
                  ? 'text-white shadow-md'
                  : 'bg-[#252528] text-[#ABABAB] hover:bg-[#303033]'
              )}
              style={isSelected ? { backgroundColor: color } : undefined}
            >
              <span className="font-semibold">{option.label}</span>
              {option.description && (
                <span className={cn(
                  'text-[9px] mt-0.5',
                  isSelected ? 'text-white/80' : 'text-white/40'
                )}>
                  {option.description}
                </span>
              )}
              {option.time && (
                <span className={cn(
                  'text-[9px] flex items-center gap-0.5',
                  isSelected ? 'text-white/60' : 'text-white/30'
                )}>
                  <Clock className="w-2 h-2" />
                  {option.time}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});

QualitySelector.displayName = 'QualitySelector';
export default QualitySelector;
