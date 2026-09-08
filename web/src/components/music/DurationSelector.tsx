import React from 'react';
import { cn } from '@/lib/utils';
import { Timer } from 'lucide-react';

interface DurationOption {
  value: number;
  label: string;
  seconds: number;
  badge?: string;
}

const DURATION_OPTIONS: DurationOption[] = [
  { value: 15, label: '15秒', seconds: 15, badge: '快速' },
  { value: 30, label: '30秒', seconds: 30 },
  { value: 60, label: '1分钟', seconds: 60 },
  { value: 120, label: '2分钟', seconds: 120 },
  { value: 240, label: '4分钟', seconds: 240, badge: '完整' },
];

interface DurationSelectorProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

const DurationSelector: React.FC<DurationSelectorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="space-y-6 p-8 bg-[#0A0A0B]/60 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] shadow-2xl relative overflow-hidden group/dur">
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/[0.02] blur-[80px] rounded-full pointer-events-none" />
      
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <Timer className="w-5 h-5 text-emerald-400" />
          </div>
          <label className="text-[11px] font-black text-white tracking-[0.3em] uppercase">Temporal Mapping</label>
        </div>
        <div className="flex gap-1">
          <div className="w-1 h-1 rounded-full bg-emerald-500/20" />
          <div className="w-1 h-1 rounded-full bg-emerald-500/40" />
          <div className="w-1 h-1 rounded-full bg-emerald-500/60" />
        </div>
      </div>
      
      <div className="grid grid-cols-5 gap-3 relative z-10">
        {DURATION_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            disabled={disabled}
            className={cn(
              'group/btn relative py-5 rounded-2xl border transition-all duration-700 text-center backdrop-blur-xl active:scale-95',
              value === option.value
                ? 'bg-emerald-500/15 border-emerald-500/40 shadow-[0_15px_30px_-5px_rgba(16,185,129,0.2)]'
                : 'bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.05]',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div className={cn(
              "text-base font-black tracking-tighter uppercase transition-colors duration-700",
              value === option.value ? "text-white" : "text-white/20 group-hover/btn:text-white/40"
            )}>{option.label}</div>
            
            {option.badge && (
              <div className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-[8px] font-black tracking-widest bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 uppercase">
                {option.badge}
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 px-2">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/40 animate-pulse" />
        <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.2em]">
          Quota usage scales with temporal complexity
        </p>
      </div>
    </div>
  );
};

export default DurationSelector;
