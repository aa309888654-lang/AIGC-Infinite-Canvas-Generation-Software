import React, { useState } from 'react';
import { Plus, Trash2, Volume2, VolumeX, Play, Pause, Sliders, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MixTrack } from '@/services/music-service';

interface MixerPanelProps {
  tracks: MixTrack[];
  onAddTrack?: (url: string) => void;
  onRemoveTrack?: (trackId: string) => void;
  onUpdateTrack?: (trackId: string, updates: Partial<MixTrack>) => void;
  onPlay?: () => void;
  onPause?: () => void;
  isPlaying?: boolean;
  duration?: number;
  currentTime?: number;
}

const MixerPanel: React.FC<MixerPanelProps> = ({
  tracks,
  onAddTrack,
  onRemoveTrack,
  onUpdateTrack,
  onPlay,
  onPause,
  isPlaying = false,
  duration = 0,
  currentTime = 0,
}) => {
  const [newTrackUrl, setNewTrackUrl] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);

  const handleAddTrack = () => {
    if (newTrackUrl.trim() && onAddTrack) {
      onAddTrack(newTrackUrl.trim());
      setNewTrackUrl('');
    }
  };

  return (
    <div className="bg-[#0A0A0B]/60 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/[0.03] blur-[120px] rounded-full pointer-events-none" />
      
      {/* Header */}
      <div className="flex items-center justify-between p-10 border-b border-white/5 relative z-10">
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <Sliders className="w-7 h-7 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-white tracking-tight uppercase">Multi-Track Mixer</h3>
            <p className="text-[11px] text-white/20 font-bold uppercase tracking-widest mt-1">Studio Grade Mixing Console</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={isPlaying ? onPause : onPlay}
            disabled={tracks.length === 0}
            className={cn(
              "flex items-center gap-4 px-10 py-4 rounded-2xl font-black text-sm transition-all duration-700 border active:scale-95 group relative overflow-hidden",
              isPlaying 
                ? "bg-white/5 border-white/10 text-white/60 hover:text-white" 
                : "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white border-emerald-500/20 shadow-lg shadow-emerald-500/20"
            )}
          >
            <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_40%,rgba(255,255,255,0.2)_50%,transparent_60%)] -translate-x-full group-hover:animate-[shimmer_2s_infinite_linear]" />
            {isPlaying ? (
              <>
                <Pause className="w-5 h-5 relative z-10" />
                <span className="relative z-10 tracking-widest uppercase">PAUSE MIX</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 relative z-10" />
                <span className="relative z-10 tracking-widest uppercase">PLAY MASTER</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="px-10 py-6 border-b border-white/5 bg-white/[0.01] relative z-10">
        <div className="relative h-12 bg-[#0A0A0B]/60 rounded-2xl overflow-hidden border border-white/5 shadow-inner">
          {/* Progress Bar */}
          <div
            className="absolute top-0 left-0 h-full bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />
          
          {/* Playhead */}
          <div 
            className="absolute top-0 bottom-0 w-[2px] bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] z-20"
            style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />
          
          {/* Time Grid */}
          <div className="absolute inset-0 flex items-center justify-around text-[10px] text-white/10 font-black tracking-widest uppercase">
            {Array.from({ length: 11 }).map((_, i) => (
              <span key={i}>{Math.floor(duration * i / 10)}S</span>
            ))}
          </div>
        </div>
      </div>

      {/* Tracks */}
      <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto custom-scrollbar relative z-10">
        {tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-[2rem] bg-white/5 flex items-center justify-center mb-6 border border-white/5">
              <VolumeX className="w-10 h-10 text-white/5" />
            </div>
            <p className="text-[11px] font-black text-white/20 uppercase tracking-[0.4em]">Empty Session · Add Tracks to Start</p>
          </div>
        ) : (
          tracks.map((track) => (
            <div
              key={track.id}
              className={cn(
                'p-10 transition-all duration-700 group/track',
                selectedTrack === track.id ? 'bg-emerald-500/[0.03]' : 'hover:bg-white/[0.02]'
              )}
              onClick={() => setSelectedTrack(track.id)}
            >
              <div className="flex items-center gap-8">
                {/* Track Info */}
                <div className="flex-1 space-y-2">
                  <div className="font-black text-white text-lg tracking-tight uppercase group-hover/track:text-emerald-400 transition-colors">{track.name}</div>
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/40" />
                    <div className="text-[10px] text-white/20 font-black uppercase tracking-widest">
                      {Math.floor(track.startTime)}S — {Math.floor(track.startTime + track.duration)}S
                    </div>
                  </div>
                </div>

                {/* Volume Slider */}
                <div className="flex items-center gap-6 w-64 bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateTrack?.(track.id, { muted: !track.muted });
                    }}
                    className={cn(
                      "transition-all duration-500",
                      track.muted ? "text-red-400" : "text-white/20 hover:text-emerald-400"
                    )}
                  >
                    {track.muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full relative group/vol overflow-hidden">
                    <div 
                      className="absolute inset-0 bg-emerald-500/40 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.4)]" 
                      style={{ width: `${(track.muted ? 0 : track.volume) * 100}%` }}
                    />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={track.muted ? 0 : track.volume}
                      onChange={(e) => {
                        e.stopPropagation();
                        onUpdateTrack?.(track.id, { volume: parseFloat(e.target.value), muted: false });
                      }}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer"
                    />
                  </div>
                  <span className="text-[11px] font-black text-white/20 w-10 text-right tabular-nums">
                    {Math.round(track.volume * 100)}%
                  </span>
                </div>

                {/* Delete Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveTrack?.(track.id);
                  }}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/5 border border-white/5 text-white/20 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all duration-500"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              {/* Waveform Preview (Simplified) */}
              <div className="mt-8 h-16 bg-[#0A0A0B]/60 border border-white/5 rounded-2xl overflow-hidden relative group/wave shadow-inner">
                <div className="absolute inset-0 flex items-center justify-center opacity-10 group-hover/wave:opacity-20 transition-opacity">
                   <Activity className="w-full h-12 text-emerald-400" strokeWidth={1} />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                   <span className="text-[9px] font-black text-white/10 uppercase tracking-[0.5em]">Spectral Data Processing</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Track Input */}
      <div className="p-10 border-t border-white/5 bg-white/[0.01] relative z-10">
        <div className="flex gap-4">
          <div className="flex-1 relative group/add">
            <div className="absolute -inset-0.5 bg-emerald-500/20 rounded-2xl blur opacity-0 group-hover/add:opacity-100 transition-opacity duration-1000" />
            <input
              type="text"
              value={newTrackUrl}
              onChange={(e) => setNewTrackUrl(e.target.value)}
              placeholder="PASTE SOURCE URL TO IMPORT TRACK..."
              className="relative w-full px-8 py-5 bg-[#0A0A0B]/60 border border-white/10 rounded-2xl text-white text-sm font-black placeholder:text-white/10 focus:outline-none focus:border-emerald-500/40 transition-all duration-700 uppercase tracking-widest"
              onKeyPress={(e) => e.key === 'Enter' && handleAddTrack()}
            />
          </div>
          <button
            onClick={handleAddTrack}
            disabled={!newTrackUrl.trim()}
            className="px-10 py-5 rounded-2xl font-black text-sm transition-all duration-700 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white shadow-lg shadow-emerald-500/10 active:scale-95 disabled:opacity-20 disabled:grayscale"
          >
            <div className="flex items-center gap-3">
              <Plus className="w-5 h-5" />
              <span>IMPORT</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MixerPanel;
