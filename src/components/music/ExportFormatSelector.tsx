import React from 'react';
import { Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AudioFormat } from '@/services/music-service';

interface FormatOption {
  value: AudioFormat;
  label: string;
  desc: string;
  badge?: string;
  icon: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  { 
    value: 'mp3', 
    label: 'MP3', 
    desc: '通用格式，适合网络播放', 
    icon: '🎵',
    badge: '推荐',
  },
  { 
    value: 'wav', 
    label: 'WAV', 
    desc: '无损音质，文件较大', 
    icon: '📼',
  },
  { 
    value: 'flac', 
    label: 'FLAC', 
    desc: '高保真压缩，文件适中', 
    icon: '💿',
    badge: '高清',
  },
];

interface ExportFormatSelectorProps {
  value: AudioFormat;
  onChange: (value: AudioFormat) => void;
  disabled?: boolean;
  onExport?: () => void;
  isExporting?: boolean;
}

const ExportFormatSelector: React.FC<ExportFormatSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  onExport,
  isExporting = false,
}) => {
  return (
    <div className="space-y-8 p-10 bg-[#0A0A0B]/60 backdrop-blur-3xl border border-white/10 rounded-[3rem] shadow-2xl relative overflow-hidden group/export">
      <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/[0.03] blur-[100px] rounded-full pointer-events-none" />
      
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <Download className="w-5 h-5 text-emerald-400" />
          </div>
          <label className="text-[11px] font-black text-white tracking-[0.3em] uppercase">Export Configuration</label>
        </div>
        <div className="flex gap-1">
          <div className="w-1 h-1 rounded-full bg-emerald-500/20" />
          <div className="w-1 h-1 rounded-full bg-emerald-500/40" />
          <div className="w-1 h-1 rounded-full bg-emerald-500/60" />
        </div>
      </div>

       <div className="grid grid-cols-3 gap-4 relative z-10">
         {FORMAT_OPTIONS.map((format) => (
           <button
             key={format.value}
             onClick={() => onChange(format.value)}
             disabled={disabled}
             className={cn(
               'group/btn relative p-8 rounded-[2rem] border transition-all duration-700 text-center backdrop-blur-xl active:scale-95',
               value === format.value
                 ? 'bg-emerald-500/15 border-emerald-500/40 shadow-[0_20px_40px_-10px_rgba(16,185,129,0.2)]'
                 : 'bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.05]',
               disabled && 'opacity-50 cursor-not-allowed'
             )}
           >
             {format.badge && (
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[8px] font-black tracking-widest bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 uppercase">
                 {format.badge}
               </div>
             )}
             
            <div className="text-4xl mb-4 filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] group-hover/btn:scale-110 transition-transform duration-700">{format.icon}</div>
            <div className="font-black text-white mb-1 tracking-tight text-lg uppercase">{format.label}</div>
            <div className="text-[10px] text-white/20 font-bold uppercase tracking-widest leading-tight">{format.desc}</div>
           </button>
         ))}
       </div>

       {onExport && (
         <button
           onClick={onExport}
           disabled={disabled || isExporting}
          className="w-full py-8 rounded-[2rem] bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-black text-sm tracking-[0.3em] shadow-[0_20px_50px_-10px_rgba(16,185,129,0.3)] hover:shadow-[0_25px_60px_-10px_rgba(16,185,129,0.5)] transition-all duration-700 disabled:opacity-50 active:scale-[0.98] group/final relative overflow-hidden"
         >
          <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_40%,rgba(255,255,255,0.25)_50%,transparent_60%)] -translate-x-full group-hover/final:animate-[shimmer_2s_infinite_linear]" />
           {isExporting ? (
            <div className="flex items-center justify-center gap-4 relative z-10">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>RENDER & EXPORT...</span>
            </div>
           ) : (
            <div className="flex items-center justify-center gap-4 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center group-hover/final:scale-110 transition-transform">
                <Download className="w-5 h-5" />
              </div>
              <span>INITIALIZE {value.toUpperCase()} EXPORT</span>
            </div>
           )}
         </button>
       )}
     </div>
  );
};

export default ExportFormatSelector;
