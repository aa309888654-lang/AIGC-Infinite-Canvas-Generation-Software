import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Sparkles } from 'lucide-react';
import { ModelOption } from './ModelSelector';
import { cn } from '@/lib/utils';

interface ModelDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: ModelOption[];
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export const ModelDropdown: React.FC<ModelDropdownProps> = ({
  value,
  onChange,
  options,
  label = 'AI 模型',
  size = 'md',
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const currentModel = options.find(m => m.value === value) || options[0];
  
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
  
  const sizeClasses = {
    sm: 'text-xs py-1.5 px-3',
    md: 'text-sm py-2 px-4',
    lg: 'text-base py-2.5 px-5',
  };
  
  const handleSelect = (modelValue: string) => {
    onChange(modelValue);
    setIsOpen(false);
  };
  
  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      {/* Label */}
      {label && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
          <Sparkles className="w-3 h-3" />
          {label}
          {currentModel && (
            <span 
              className="ml-1 font-normal normal-case tracking-normal" 
              style={{ color: currentModel.color }}
            >
              {currentModel.icon && `${currentModel.icon} `}{currentModel.label}
            </span>
          )}
        </div>
      )}
      
      {/* Dropdown Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between gap-2 rounded-lg font-medium',
          'bg-[#252528] border transition-all',
          'hover:border-[#5A5A5E] focus:outline-none focus:border-gray-500',
          sizeClasses[size]
        )}
        style={{ 
          borderColor: currentModel?.color ? `${currentModel.color}40` : '#4A4A4E',
          borderWidth: '1px'
        }}
      >
        <div className="flex items-center gap-2">
          {currentModel?.icon && (
            <span className="text-base">{currentModel.icon}</span>
          )}
          <span>{currentModel?.label || '选择模型'}</span>
        </div>
        <ChevronDown 
          className={cn(
            'w-4 h-4 text-white/50 transition-transform duration-200',
            isOpen && 'rotate-180'
          )} 
        />
      </button>
      
      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50">
          <div className="bg-[#1C1C1E] border border-[#3A3A3E] rounded-xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-3 transition-colors',
                  'hover:bg-[#2A2A2E]',
                  option.value === value && 'bg-[#252528]'
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{option.icon}</span>
                  <div className="text-left">
                    <div className="text-white font-medium">{option.label}</div>
                    {option.supports && (
                      <div className="text-[10px] text-white/40 mt-0.5">
                        支持: {option.supports.join(' / ')}
                      </div>
                    )}
                  </div>
                </div>
                {option.value === value && (
                  <Check className="w-4 h-4 text-gray-500" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Support Info */}
      {currentModel?.supports && (
        <p className="text-[10px] text-white/40 mt-1.5">
          支持: {currentModel.supports.join(' / ')}
        </p>
      )}
    </div>
  );
};

export default ModelDropdown;
