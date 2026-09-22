import React from 'react';
import { ChevronDown, Sparkles, Wand2, Zap, Settings2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectOption {
  value: string | number;
  label: string;
}

interface ParameterPanelProps {
  title: string;
  options: SelectOption[];
  value: string | number;
  onChange: (value: unknown) => void;
  icon?: React.ReactNode;
  badge?: string;
  className?: string;
  gridCols?: 1 | 2 | 3;
  disabled?: boolean;
  description?: string;
}

export const ParameterPanel: React.FC<ParameterPanelProps> = ({
  title,
  options,
  value,
  onChange,
  icon,
  badge,
  className,
  disabled = false,
  description,
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      <label className="flex items-center gap-2 text-sm font-semibold text-white uppercase tracking-wider">
        {icon && <span className="text-white">{icon}</span>}
        {title}
        {badge && (
          <span className="px-2 py-0.5 bg-gray-600 text-white text-xs font-bold rounded-full border border-gray-500">
            {badge}
          </span>
        )}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(
            'w-full h-11 px-4 pr-11 bg-gray-700 border border-gray-600 rounded-xl text-sm font-medium text-white appearance-none cursor-pointer transition-all duration-150',
            'focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-400',
            'hover:border-gray-400 hover:bg-gray-600',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-600 disabled:border-gray-600',
            'shadow-sm'
          )}
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              className="bg-gray-700 text-white py-3"
            >
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={18}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
      </div>
      {description && (
        <p className="text-xs text-gray-400 mt-1 font-medium">{description}</p>
      )}
    </div>
  );
};

// 参数网格布局
interface ParameterGridProps {
  children: React.ReactNode;
  cols?: 1 | 2 | 3;
  className?: string;
}

export const ParameterGrid: React.FC<ParameterGridProps> = ({ 
  children, 
  cols = 2,
  className 
}) => {
  return (
    <div 
      className={cn(
        'grid gap-4',
        cols === 1 && 'grid-cols-1',
        cols === 2 && 'grid-cols-2',
        cols === 3 && 'grid-cols-3',
        className
      )}
    >
      {children}
    </div>
  );
};

// 技能启动按钮
interface SkillButtonProps {
  onClick: () => void;
  icon?: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  variant?: 'default' | 'primary' | 'success';
  className?: string;
  disabled?: boolean;
}

export const SkillButton: React.FC<SkillButtonProps> = ({
  onClick,
  icon,
  title,
  description,
  badge,
  variant = 'default',
  className,
  disabled = false,
}) => {
  const variants = {
    default: 'bg-gray-600 border-gray-500 hover:bg-gray-500 hover:border-gray-400 hover:shadow-md',
    primary: 'bg-gray-600 text-white hover:bg-gray-500 border-gray-500 shadow-primary-btn',
    success: 'bg-gray-500 text-white hover:bg-gray-400 border-gray-400 shadow-success-btn',
  };

  const icons = {
    default: <Sparkles size={18} className="text-white" />,
    primary: <Wand2 size={18} className="text-white" />,
    success: <Zap size={18} className="text-white" />,
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full p-4 rounded-xl border transition-all duration-150 text-left',
        variants[variant],
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <div className="flex items-center gap-3">
        {icon || icons[variant]}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-base font-bold',
              variant === 'default' ? 'text-white' : 'text-white'
            )}>
              {title}
            </span>
            {badge && (
              <span className={cn(
                'px-2 py-0.5 text-xs font-bold rounded-full border',
                variant === 'default' ? 'bg-gray-500 text-white border-gray-400' : 'bg-white/20 text-white border-white/30'
              )}>
                {badge}
              </span>
            )}
          </div>
          <p className={cn(
            'text-sm truncate mt-0.5 font-medium',
            variant === 'default' ? 'text-white' : 'text-white/80'
          )}>
            {description}
          </p>
        </div>
      </div>
    </button>
  );
};

// 重置按钮
interface ResetButtonProps {
  onClick: () => void;
  label?: string;
  className?: string;
}

export const ResetButton: React.FC<ResetButtonProps> = ({
  onClick,
  label = '重置参数',
  className,
}) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2 text-sm font-medium text-white',
        'bg-gray-600 border border-gray-500 rounded-lg',
        'hover:bg-gray-500 hover:border-gray-400 hover:text-white transition-all duration-150',
        className
      )}
    >
      <RotateCcw size={14} />
      {label}
    </button>
  );
};

// 分隔线
interface DividerProps {
  label?: string;
  className?: string;
}

export const Divider: React.FC<DividerProps> = ({ label, className }) => {
  if (label) {
    return (
      <div className={cn('flex items-center gap-4 py-4', className)}>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-400 to-transparent" />
        <span className="text-sm font-bold text-white px-4 py-1 bg-gray-200 rounded-full border border-gray-300">
          {label}
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-400 to-transparent" />
      </div>
    );
  }
  
  return (
    <div className={cn('h-px bg-gradient-to-r from-transparent via-gray-400 to-transparent my-4', className)} />
  );
};

// 高级参数面板
interface AdvancedPanelProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export const AdvancedPanel: React.FC<AdvancedPanelProps> = ({
  title,
  children,
  defaultOpen = false,
  className,
}) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className={cn('border border-gray-400 rounded-xl overflow-hidden shadow-sm bg-gray-200', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between bg-gray-200 hover:bg-gray-300 transition-colors duration-150 border-b border-gray-300"
      >
        <div className="flex items-center gap-3">
          <Settings2 size={18} className="text-white" />
          <span className="text-base font-bold text-white">{title}</span>
        </div>
        <ChevronDown
          size={20}
          className={cn(
            'text-gray-400 transition-transform duration-150',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      {isOpen && (
        <div className="p-5 bg-gray-700 border-t border-gray-600 animate-fadeIn">
          {children}
        </div>
      )}
    </div>
  );
};

export default ParameterPanel;
