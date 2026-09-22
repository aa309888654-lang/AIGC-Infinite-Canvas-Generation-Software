// @ts-nocheck
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  VolumeX,
  Volume1,
  Repeat,
  Shuffle,
  Maximize2,
  Minimize2,
  Disc2,
  Mic,
  Music2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMusicPlayer } from '@/hooks/useMusicPlayer';
import Waveform from '@/components/ui/Waveform';

interface LyricLine {
  time: number;
  text: string;
  translation?: string;
}

interface ProfessionalPlayerProps {
  audioUrl: string;
  lyrics?: string;
  title?: string;
  artist?: string;
  coverUrl?: string;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
}

const parseLRC = (lrcText: string): LyricLine[] => {
  if (!lrcText) return [];
  const lines = lrcText.split('\n');
  const result: LyricLine[] = [];
  
  for (const line of lines) {
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const milliseconds = parseInt(match[3].padEnd(3, '0'), 10);
      const time = minutes * 60 + seconds + milliseconds / 1000;
      const text = match[4].trim();
      if (text) {
        result.push({ time, text });
      }
    }
  }
  
  return result.sort((a, b) => a.time - b.time);
};

const ProfessionalPlayer: React.FC<ProfessionalPlayerProps> = ({
  audioUrl,
  lyrics,
  title,
  artist,
  coverUrl,
  onTimeUpdate,
  onEnded,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [parsedLyrics, setParsedLyrics] = useState<LyricLine[]>([]);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playbackMode,
    playbackSpeed,
    isLoading,
    initializeAudio,
    togglePlay,
    seek,
    skipForward,
    skipBackward,
    setVolume,
    toggleMute,
    cyclePlaybackMode,
    cyclePlaybackSpeed,
    formatTime,
  } = useMusicPlayer({
    onTimeUpdate,
    onEnded,
  });

  useEffect(() => {
    if (audioUrl) {
      initializeAudio(audioUrl);
    }
  }, [audioUrl, initializeAudio]);

  useEffect(() => {
    if (lyrics) {
      const lines = parseLRC(lyrics);
      setParsedLyrics(lines);
    }
  }, [lyrics]);

  useEffect(() => {
    const lyricIdx = parsedLyrics.findIndex((l, i) => {
      const next = parsedLyrics[i + 1];
      return currentTime >= l.time && (!next || currentTime < next.time);
    });
    setCurrentLyricIndex(lyricIdx);
  }, [currentTime, parsedLyrics]);

  useEffect(() => {
    if (currentLyricIndex >= 0 && lyricsContainerRef.current) {
      const activeElement = lyricsContainerRef.current.querySelector(`[data-index="${currentLyricIndex}"]`);
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentLyricIndex]);

  const seekToLyric = useCallback((lyric: LyricLine) => {
    seek(lyric.time);
    if (!isPlaying) {
      togglePlay();
    }
  }, [seek, isPlaying, togglePlay]);

  const getPlaybackModeIcon = () => {
    switch (playbackMode) {
      case 'repeat-one': return <Repeat className="w-4 h-4" fill="currentColor" strokeWidth={1.5} />;
      case 'repeat-all': return <Repeat className="w-4 h-4" fill="currentColor" strokeWidth={1.5} />;
      case 'shuffle': return <Shuffle className="w-4 h-4" fill="currentColor" strokeWidth={1.5} />;
      default: return null;
    }
  };

  return (
    <div className={cn(
      "bg-[#0A0A0B]/60 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.7)] relative",
      isFullscreen && "fixed inset-0 z-50 rounded-none bg-[#0A0A0B]"
    )}>
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/[0.03] blur-[120px] rounded-full pointer-events-none" />
      
      <div className={cn("grid gap-0 relative z-10", isFullscreen ? "grid-cols-3 h-[calc(100vh-80px)]" : "grid-cols-5")}>
        {/* Cover Section */}
        <div className={cn(
          "relative bg-emerald-500/[0.02] flex flex-col items-center justify-center p-10 border-r border-white/5",
          isFullscreen ? "col-span-1" : "col-span-2"
        )}>
          {/* Disc Animation */}
          <div className="relative mb-10">
            <div 
              className={cn(
                "w-56 h-56 rounded-full shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] overflow-hidden border-[6px] border-[#0A0A0B] relative z-10",
                isPlaying && "animate-spin-slow"
              )} 
            >
              {coverUrl ? (
                <img src={coverUrl} alt={title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-emerald-500/10 to-emerald-500/20 flex items-center justify-center">
                  <Disc2 className="w-24 h-24 text-emerald-500/20" strokeWidth={1} />
                </div>
              )}
            </div>
            
            {/* Vinyl grooves effect */}
            <div className="absolute inset-0 rounded-full border border-white/5 z-20 pointer-events-none" />
            <div className="absolute inset-4 rounded-full border border-white/5 z-20 pointer-events-none opacity-50" />
            <div className="absolute inset-8 rounded-full border border-white/5 z-20 pointer-events-none opacity-30" />
            
            {isPlaying && (
              <div className="absolute -inset-6 bg-emerald-500/10 blur-2xl rounded-full animate-pulse z-0" />
            )}
          </div>

          {/* Track Info */}
          <div className="text-center mb-10 space-y-2">
            <h2 className="text-3xl font-black text-white tracking-tight uppercase">{title || 'Studio Master'}</h2>
            <div className="flex items-center justify-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/40" />
              <p className="text-[11px] text-white/30 font-black uppercase tracking-[0.3em]">{artist || 'Neural Vocalist'}</p>
            </div>
          </div>

          {/* Time Display */}
          <div className="grid grid-cols-3 gap-4 text-center w-full max-w-xs">
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-3 backdrop-blur-md">
              <div className="text-[10px] text-white/20 uppercase tracking-widest font-black mb-1">POS</div>
              <div className="font-mono font-black text-emerald-400 text-lg tracking-tighter">{formatTime(currentTime)}</div>
            </div>
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-3 backdrop-blur-md">
              <div className="text-[10px] text-white/20 uppercase tracking-widest font-black mb-1">REM</div>
              <div className="font-mono font-black text-emerald-500 text-lg tracking-tighter">{formatTime(duration - currentTime)}</div>
            </div>
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-3 backdrop-blur-md">
              <div className="text-[10px] text-white/20 uppercase tracking-widest font-black mb-1">LEN</div>
              <div className="font-mono font-black text-white/40 text-lg tracking-tighter">{formatTime(duration)}</div>
            </div>
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="absolute top-6 right-6 p-3 hover:bg-white/10 rounded-2xl transition-all duration-500 border border-transparent hover:border-white/10 group"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5 text-white/40 group-hover:text-white" /> : <Maximize2 className="w-5 h-5 text-white/40 group-hover:text-white" />}
          </button>
        </div>

        {/* Player Controls & Lyrics */}
        <div className={cn("col-span-3 flex flex-col bg-emerald-500/[0.01]", isFullscreen ? "col-span-2" : "")}>
          {/* Waveform Progress */}
          <div className="p-10 pb-0">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                  <Music2 className="w-5 h-5 text-emerald-400" />
                </div>
                <span className="text-[11px] font-black text-white tracking-[0.3em] uppercase">Spectral Waveform</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black text-emerald-400/60 uppercase tracking-widest">Live Analysis</span>
              </div>
            </div>
            
            <div className="relative group/wave rounded-[2rem] overflow-hidden p-6 bg-[#0A0A0B]/40 border border-white/5 shadow-inner">
              <Waveform
                audioUrl={audioUrl}
                currentTime={currentTime}
                duration={duration}
                onSeek={seek}
                isPlaying={isPlaying}
                height={100}
                color="#10b981"
                progressColor="#059669"
              />
            </div>
            <div className="flex justify-between mt-4 text-[11px] text-white/10 font-black tracking-[0.2em] uppercase">
              <span className="text-emerald-500/60">{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-6 py-8">
            <button 
              onClick={cyclePlaybackMode} 
              className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 border",
                playbackMode !== 'normal' 
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/5" 
                  : "bg-white/5 border-white/5 text-white/20 hover:text-white/40 hover:bg-white/10"
              )}
              title={`Mode: ${playbackMode}`}
            >
              {getPlaybackModeIcon()}
            </button>
            <button onClick={() => skipBackward(10)} className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/5 border border-white/5 text-white/20 hover:text-white hover:bg-white/10 hover:border-white/10 transition-all duration-500 active:scale-90">
              <SkipBack className="w-6 h-6" fill="currentColor" />
            </button>
            <button
              onClick={togglePlay}
              disabled={isLoading}
              className="w-20 h-20 rounded-full flex items-center justify-center text-white shadow-[0_20px_50px_-10px_rgba(16,185,129,0.4)] hover:shadow-[0_25px_60px_-10px_rgba(16,185,129,0.6)] transition-all duration-700 hover:scale-105 active:scale-95 disabled:opacity-50 group relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_40%,rgba(255,255,255,0.3)_50%,transparent_60%)] -translate-x-full group-hover:animate-[shimmer_2s_infinite_linear]" />
              {isLoading ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-8 h-8 relative z-10" fill="currentColor" />
              ) : (
                <Play className="w-8 h-8 ml-1.5 relative z-10" fill="currentColor" />
              )}
            </button>
            <button onClick={() => skipForward(10)} className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/5 border border-white/5 text-white/20 hover:text-white hover:bg-white/10 hover:border-white/10 transition-all duration-500 active:scale-90">
              <SkipForward className="w-6 h-6" fill="currentColor" />
            </button>
            <button 
              onClick={cyclePlaybackSpeed}
              className="px-5 py-3 rounded-2xl bg-white/5 border border-white/5 text-[11px] text-white/20 font-black tracking-widest hover:text-white hover:bg-white/10 transition-all duration-500"
              title={`Speed: ${playbackSpeed}x`}
            >
              {playbackSpeed}x
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center justify-center gap-5 px-10 pb-8">
            <button onClick={toggleMute} className="text-white/20 hover:text-emerald-400 transition-all duration-500">
              {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume1 className="w-5 h-5" />}
            </button>
            <div className="flex-1 max-w-[200px] h-1.5 bg-white/5 rounded-full relative group/vol overflow-hidden">
              <div 
                className="absolute inset-0 bg-emerald-500/40 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.4)]" 
                style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
              />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
              />
            </div>
          </div>

          {/* Lyrics */}
          <div className="flex-1 overflow-hidden px-10 pb-10">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-[11px] font-black text-white/20 uppercase tracking-[0.3em] flex items-center gap-3">
                <Mic className="w-4 h-4 text-emerald-500/40" />
                Synchronized Lyrics
              </h4>
              <div className="flex gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/20" />
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/40" />
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/60" />
              </div>
            </div>
            
            <div 
              ref={lyricsContainerRef}
              className="h-full overflow-y-auto space-y-3 custom-scrollbar pr-4"
            >
              {parsedLyrics.length > 0 ? (
                parsedLyrics.map((lyric, index) => (
                  <button
                    key={index}
                    data-index={index}
                    onClick={() => seekToLyric(lyric)}
                    className={cn(
                      'w-full text-left px-8 py-5 rounded-[2rem] transition-all duration-700 text-base font-bold flex items-center gap-6 group/lyric border',
                      currentLyricIndex === index
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-white shadow-2xl shadow-emerald-500/10'
                        : 'bg-white/[0.01] border-white/5 text-white/10 hover:text-white/30 hover:bg-white/5 hover:border-white/10'
                    )}
                  >
                    <span className={cn(
                      "font-mono text-[10px] w-14 text-right transition-colors tracking-tighter",
                      currentLyricIndex === index ? "text-emerald-400" : "text-white/5"
                    )}>{formatTime(lyric.time)}</span>
                    <span className="flex-1 tracking-tight">{lyric.text}</span>
                  </button>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-white/[0.01] border border-dashed border-white/5 rounded-[3rem]">
                  <Music2 size={64} className="mb-6 text-white/5" strokeWidth={1} />
                  <p className="text-[11px] font-black text-white/10 uppercase tracking-[0.4em]">No LRC Metadata Detected</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

  );
};

export default ProfessionalPlayer;
