/**
 * ParamSlider - 参数滑块
 * 带标签、范围、步进的通用滑块组件
 */
import React, { memo, useCallback, useMemo } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ParamSliderProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  showValue?: boolean;
  accentColor?: string;
  size?: 'sm' | 'md';
  className?: string;
  description?: string;
  disabled?: boolean;
}

export interface SliderPreset {
  value: number;
  label: string;
  icon?: string;
}

export interface ParamSliderWithPresetsProps extends ParamSliderProps {
  presets?: SliderPreset[];
  showPresets?: boolean;
}

export const ParamSlider = memo<ParamSliderProps>(({
  value,
  onChange,
  label,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  showValue = true,
  accentColor = '#6610F2',
  size = 'md',
  className,
  description,
  disabled = false,
}) => {
  const percentage = useMemo(() => {
    return ((value - min) / (max - min)) * 100;
  }, [value, min, max]);
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    onChange(newValue);
  }, [onChange]);
  
  const displayValue = useMemo(() => {
    if (step >= 1) return Math.round(value).toString();
    return value.toFixed(1);
  }, [value, step]);
  
  const trackHeight = size === 'sm' ? 'h-1.5' : 'h-2';
  
  return (
    <div className={cn('flex flex-col gap-1', disabled && 'opacity-50', className)}>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-white/60">
          <SlidersHorizontal className="w-3 h-3" />
          {label}
        </label>
        {showValue && (
          <span
            className="text-xs font-bold tabular-nums"
            style={{ color: accentColor }}
          >
            {displayValue}{unit}
          </span>
        )}
      </div>
      
      <div className="relative">
        <div className={cn('w-full rounded-full bg-[#252528]', trackHeight)}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${percentage}%`,
              backgroundColor: accentColor,
            }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className={cn(
            'absolute inset-0 w-full cursor-pointer appearance-none bg-transparent',
            '[&::-webkit-slider-thumb]:appearance-none',
            '[&::-webkit-slider-thumb]:w-4',
            '[&::-webkit-slider-thumb]:h-4',
            '[&::-webkit-slider-thumb]:rounded-full',
            '[&::-webkit-slider-thumb]:bg-white',
            '[&::-webkit-slider-thumb]:shadow-md',
            '[&::-webkit-slider-thumb]:cursor-pointer',
            '[&::-webkit-slider-thumb]:border-2',
            '[&::-webkit-slider-thumb]:transition-transform',
            '[&::-webkit-slider-thumb]:hover:scale-110',
          )}
          style={{ accentColor }}
        />
      </div>
      
      {description && (
        <p className="text-[10px] text-white/30">{description}</p>
      )}
    </div>
  );
});

ParamSlider.displayName = 'ParamSlider';

export const ParamSliderWithPresets = memo<ParamSliderWithPresetsProps>(({
  presets = [],
  showPresets = true,
  ...props
}) => {
  return (
    <div className="flex flex-col gap-2">
      <ParamSlider {...props} />
      {showPresets && presets.length > 0 && (
        <div className="flex gap-1">
          {presets.map(preset => (
            <button
              key={preset.value}
              onClick={() => props.onChange(preset.value)}
              className={cn(
                'flex-1 py-1 px-1 rounded text-[10px] font-medium transition-colors text-center',
                props.value === preset.value
                  ? 'text-white'
                  : 'bg-[#252528] text-[#ABABAB] hover:bg-[#303033]'
              )}
              style={props.value === preset.value ? { backgroundColor: props.accentColor } : undefined}
            >
              {preset.icon && <span className="mr-0.5">{preset.icon}</span>}
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

ParamSliderWithPresets.displayName = 'ParamSliderWithPresets';
export default ParamSlider;
