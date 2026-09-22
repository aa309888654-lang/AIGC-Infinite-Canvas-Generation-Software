/**
 * ModelSelector - 模型选择器
 * 支持图片模型（15+）和视频模型（10+），配置驱动渲染
 */
import React, { memo, useCallback } from 'react';
import { Wand2} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModelOption {
  value: string;
  label: string;
  icon?: string;
  color?: string;
  type?: 'image' | 'video' | 'both';
  supports?: string[];
  description?: string;
}

export interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  options: ModelOption[];
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export const IMAGE_MODELS: ModelOption[] = [
  { value: 'doubao-image', label: '豆包图片', icon: '🫛', color: '#007AFF', type: 'image', supports: ['t2i', 'i2i'] },
  { value: 'seedream', label: 'Seedream 3.0', icon: '🌟', color: '#00E5FF', type: 'both', supports: ['t2i', 'i2i', 'ref'] },
  { value: 'stable-diffusion', label: 'Stable Diffusion', icon: '🎭', color: '#EF4444', type: 'image', supports: ['t2i', 'i2i', 'ref'] },
  { value: 'dalle3', label: 'DALL-E 3', icon: '🧠', color: '#10B981', type: 'image', supports: ['t2i'] },
  { value: 'adobe-firefly', label: 'Adobe Firefly', icon: '🔥', color: '#FF0000', type: 'image', supports: ['t2i', 'ref'] },
  { value: 'leonardo-ai', label: 'Leonardo AI', icon: '🎨', color: '#00E5FF', type: 'image', supports: ['t2i', 'i2i', 'ref'] },
  { value: 'ideogram', label: 'Ideogram 2.0', icon: '✍️', color: '#10B981', type: 'image', supports: ['t2i'] },
  { value: 'recraft-ai', label: 'Recraft V3', icon: '📐', color: '#9CA3AF', type: 'image', supports: ['t2i', 'ref'] },
  { value: 'flux-pro', label: 'FLUX Pro', icon: '⚡', color: '#6366F1', type: 'image', supports: ['t2i', 'i2i', 'ref'] },
  { value: 'flux-dev', label: 'FLUX Dev', icon: '⚡', color: '#818CF8', type: 'image', supports: ['t2i', 'i2i', 'ref'] },
  { value: 'flux-schnell', label: 'FLUX Schnell', icon: '⚡', color: '#A5B4FC', type: 'image', supports: ['t2i'] },
  { value: 'imagen3', label: 'Google Imagen 3', icon: '🖼️', color: '#4285F4', type: 'image', supports: ['t2i'] },
  { value: 'vega', label: 'Vega 视觉大模型', icon: '🌊', color: '#06B6D4', type: 'both', supports: ['t2i', 'i2i', 'ref'] },
];

export const VIDEO_MODELS: ModelOption[] = [
  { value: 'doubao', label: '豆包AI (Seedance)', icon: '🎬', color: '#7c3aed', type: 'video', supports: ['t2v', 'i2v', 'f2v', 'v2v'] },
  { value: 'minimax', label: 'MiniMax', icon: '🔷', color: '#06B6D4', type: 'video', supports: ['t2v', 'i2v'] },
  { value: 'stability_ai', label: 'Stability AI SVD', icon: '🔒', color: '#64748B', type: 'video', supports: ['i2v', 'v2v'] },
  { value: 'vidu', label: 'Vidu 生视频', icon: '🌊', color: '#0EA5E9', type: 'video', supports: ['t2v', 'i2v', 'v2v'] },
  { value: 'jimeng', label: '即梦AI', icon: '✨', color: '#F59E0B', type: 'video', supports: ['t2v', 'i2v'] },
  { value: 'runway', label: 'Runway Gen-3', icon: '🚀', color: '#8B5CF6', type: 'video', supports: ['t2v', 'i2v'] },
  { value: 'pika', label: 'Pika Labs', icon: '🎞️', color: '#EC4899', type: 'video', supports: ['t2v', 'i2v'] },
  { value: 'luma', label: 'Luma Dream Machine', icon: '💫', color: '#10B981', type: 'video', supports: ['t2v', 'i2v', 'v2v'] },
  { value: 'haiver', label: '海螺AI', icon: '🐚', color: '#06B6D4', type: 'video', supports: ['t2v', 'i2v'] },
];

export const ALL_MODELS = [...IMAGE_MODELS, ...VIDEO_MODELS];

export const ModelSelector = memo<ModelSelectorProps>(({
  value,
  onChange,
  options,
  label = 'AI 模型',
  size = 'md',
  className,
}) => {
  const currentModel = options.find(m => m.value === value) || options[0];
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  }, [onChange]);
  
  const sizeClasses = {
    sm: 'text-xs py-1 px-2',
    md: 'text-sm py-1.5 px-3',
    lg: 'text-base py-2 px-4',
  };
  
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label className="flex items-center gap-1.5 text-xs font-semibold text-white/60 uppercase tracking-wider">
          <Wand2 className="w-3 h-3" />
          {label}
          {currentModel && (
            <span className="ml-1 font-normal normal-case tracking-normal" style={{ color: currentModel.color }}>
              {currentModel.icon && `${currentModel.icon} `}{currentModel.label}
            </span>
          )}
        </label>
      )}
      
      <select
        value={value}
        onChange={handleChange}
        className={cn(
          'rounded font-medium bg-[#252528] border border-[#4A4A4E]',
          'text-white focus:outline-none focus:border-gray-500 transition-colors',
          'appearance-none cursor-pointer',
          sizeClasses[size]
        )}
        style={currentModel?.color ? { borderColor: `${currentModel.color}40` } : undefined}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.icon ? `${option.icon} ` : ''}{option.label}
            {option.supports ? ` (${option.supports.join('/')})` : ''}
          </option>
        ))}
      </select>
      
      {currentModel?.supports && (
        <p className="text-[10px] text-white/40">
          支持: {currentModel.supports.join(' / ')}
        </p>
      )}
    </div>
  );
});

ModelSelector.displayName = 'ModelSelector';
export default ModelSelector;
