import React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

type StatCardVariant = 'blue' | 'green' | 'purple' | 'amber' | 'red' | 'cyan' | 'indigo' | 'pink';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  variant?: StatCardVariant;
  change?: number;
  loading?: boolean;
}

const variantStyles: Record<StatCardVariant, { bg: string; iconBg: string; iconText: string; border: string }> = {
  blue:   { bg: 'from-gray-500/8 to-transparent',    iconBg: 'bg-gray-500/15',   iconText: 'text-gray-400',   border: 'border-gray-500/10' },
  green:  { bg: 'from-emerald-500/8 to-transparent', iconBg: 'bg-emerald-500/15', iconText: 'text-emerald-400', border: 'border-emerald-500/10' },
  purple: { bg: 'from-violet-500/8 to-transparent',  iconBg: 'bg-violet-500/15',  iconText: 'text-violet-400',  border: 'border-violet-500/10' },
  amber:  { bg: 'from-amber-500/8 to-transparent',   iconBg: 'bg-amber-500/15',   iconText: 'text-amber-400',   border: 'border-amber-500/10' },
  red:    { bg: 'from-red-500/8 to-transparent',      iconBg: 'bg-red-500/15',     iconText: 'text-red-400',     border: 'border-red-500/10' },
  cyan:   { bg: 'from-cyan-500/8 to-transparent',     iconBg: 'bg-cyan-500/15',    iconText: 'text-cyan-400',    border: 'border-cyan-500/10' },
  indigo: { bg: 'from-indigo-500/8 to-transparent',   iconBg: 'bg-indigo-500/15',  iconText: 'text-indigo-400',  border: 'border-indigo-500/10' },
  pink:   { bg: 'from-pink-500/8 to-transparent',     iconBg: 'bg-pink-500/15',    iconText: 'text-pink-400',    border: 'border-pink-500/10' },
};

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  variant = 'blue',
  change,
  loading = false,
}) => {
  const s = variantStyles[variant];

  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl border bg-gradient-to-br p-5 transition-all duration-200 hover:scale-[1.02] shadow-lg shadow-black/20',
      'bg-[#1A1A1E]',
      s.border,
      s.bg
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-gray-300 text-sm font-medium truncate">{title}</p>
          {loading ? (
            <div className="mt-2 h-8 w-24 bg-white/5 rounded-lg animate-pulse" />
          ) : (
            <p className="mt-1 text-2xl font-bold text-white tracking-tight">{value}</p>
          )}
          {subtitle && <p className="mt-0.5 text-gray-400 text-xs">{subtitle}</p>}
        </div>
        <div className={cn('p-2.5 rounded-xl shrink-0', s.iconBg)}>
          <div className={s.iconText}>{icon}</div>
        </div>
      </div>
      {change !== undefined && change !== 0 && (
        <div className="mt-3 flex items-center gap-1">
          {change > 0 ? (
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-red-400" />
          )}
          <span className={cn('text-xs font-medium', change > 0 ? 'text-emerald-400' : 'text-red-400')}>
            {change > 0 ? '+' : ''}{change}%
          </span>
          <span className="text-gray-400 text-xs ml-1">较上周</span>
        </div>
      )}
    </div>
  );
};

export default StatCard;
