import React, { useState, useRef } from 'react';
import { GripVertical, Plus, Trash2, Save, Play, PenLine, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LyricLine {
  id: string;
  time: number;
  text: string;
  translation?: string;
}

interface LyricEditorProps {
  initialLyrics?: string;
  onSave: (lyrics: string) => void;
  onPreview?: (time: number) => void;
}

const LyricEditor: React.FC<LyricEditorProps> = ({
  initialLyrics = '',
  onSave,
  onPreview,
}) => {
  const [lyrics, setLyrics] = useState<LyricLine[]>(() => parseLyrics(initialLyrics));
  const [_isPlaying, _setIsPlaying] = useState(false);
  const [, setCurrentTime] = useState(0);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function parseLyrics(lrcText: string): LyricLine[] {
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
          result.push({
            id: `lyric-${Date.now()}-${Math.random()}`,
            time,
            text,
          });
        }
      }
    }
    
    return result.sort((a, b) => a.time - b.time);
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const parseTime = (timeStr: string): number => {
    const match = timeStr.match(/(\d{2}):(\d{2})\.(\d{2})/);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const ms = parseInt(match[3], 10);
      return minutes * 60 + seconds + ms / 100;
    }
    return 0;
  };

  const addLyricLine = () => {
    const newLine: LyricLine = {
      id: `lyric-${Date.now()}`,
      time: lyrics.length > 0 ? lyrics[lyrics.length - 1].time + 5 : 0,
      text: '新歌词',
    };
    setLyrics([...lyrics, newLine]);
  };

  const deleteLyricLine = (id: string) => {
    setLyrics(lyrics.filter(l => l.id !== id));
  };

  const updateLyricText = (id: string, text: string) => {
    setLyrics(lyrics.map(l => l.id === id ? { ...l, text } : l));
  };

  const updateLyricTime = (id: string, timeStr: string) => {
    const time = parseTime(timeStr);
    setLyrics(lyrics.map(l => l.id === id ? { ...l, time } : l));
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    
    if (!draggedId || draggedId === targetId) return;
    
    const draggedIndex = lyrics.findIndex(l => l.id === draggedId);
    const targetIndex = lyrics.findIndex(l => l.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    const newLyrics = [...lyrics];
    const [draggedItem] = newLyrics.splice(draggedIndex, 1);
    newLyrics.splice(targetIndex, 0, draggedItem);
    
    setLyrics(newLyrics);
    setDraggedId(null);
  };

  const handleSave = () => {
    const lrcContent = lyrics
      .sort((a, b) => a.time - b.time)
      .map(l => `[${formatTime(l.time)}]${l.text}`)
      .join('\n');
    onSave(lrcContent);
  };

  const handlePreview = (line: LyricLine) => {
    onPreview?.(line.time);
    setCurrentTime(line.time);
  };

  return (
    <div className="bg-[#0A0A0B]/60 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/[0.03] blur-[120px] rounded-full pointer-events-none" />
      
      {/* Header */}
      <div className="flex items-center justify-between p-10 border-b border-white/5 relative z-10">
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <PenLine className="w-7 h-7 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-white tracking-tight uppercase">Lyric Forge</h3>
            <p className="text-[11px] text-white/20 font-bold uppercase tracking-widest mt-1">LRC Metadata Synchronization</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={addLyricLine}
            className="flex items-center gap-3 px-8 py-4 bg-white/5 text-white/40 rounded-2xl font-black text-xs hover:bg-emerald-500/10 hover:text-emerald-400 border border-white/5 hover:border-emerald-500/20 transition-all duration-500"
          >
            <Plus className="w-4 h-4" />
            ADD LINE
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-2xl font-black text-xs shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all duration-700 active:scale-95 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_40%,rgba(255,255,255,0.2)_50%,transparent_60%)] -translate-x-full group-hover:animate-[shimmer_2s_infinite_linear]" />
            <Save className="w-4 h-4 relative z-10" />
            <span className="relative z-10 tracking-widest">SAVE METADATA</span>
          </button>
        </div>
      </div>

      {/* Lyrics List */}
      <div ref={containerRef} className="max-h-[500px] overflow-y-auto custom-scrollbar relative z-10">
        {lyrics.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-[2rem] bg-white/5 flex items-center justify-center mb-6 border border-white/5">
              <Mic className="w-10 h-10 text-white/5" />
            </div>
            <p className="text-[11px] font-black text-white/20 uppercase tracking-[0.4em] mb-8">No Lyric Data Found</p>
            <button
              onClick={addLyricLine}
              className="px-10 py-5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl font-black text-sm hover:bg-emerald-500 hover:text-white transition-all duration-500 shadow-xl"
            >
              INITIALIZE FIRST LINE
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {lyrics.map((line, index) => (
              <div
                key={line.id}
                draggable
                onDragStart={(e) => handleDragStart(e, line.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, line.id)}
                className={cn(
                  'flex items-center gap-6 p-8 transition-all duration-700 group/line',
                  draggedId === line.id ? 'opacity-20' : 'hover:bg-white/[0.02]'
                )}
              >
                {/* Drag Handle */}
                <div className="cursor-grab text-white/5 hover:text-emerald-400/40 transition-colors">
                  <GripVertical className="w-5 h-5" />
                </div>

                {/* Line Number */}
                <div className="w-10 text-[10px] font-black text-white/10 uppercase tracking-widest">
                  {String(index + 1).padStart(2, '0')}
                </div>

                {/* Time Input */}
                <div className="relative group/time">
                   <input
                    type="text"
                    value={formatTime(line.time)}
                    onChange={(e) => updateLyricTime(line.id, e.target.value)}
                    className="w-32 px-5 py-3 bg-[#0A0A0B]/60 border border-white/5 rounded-xl text-emerald-400 font-mono text-sm font-black focus:border-emerald-500/40 outline-none transition-all shadow-inner"
                  />
                  <div className="absolute -top-2 -right-2 w-1.5 h-1.5 rounded-full bg-emerald-500/40 opacity-0 group-hover/time:opacity-100 transition-opacity" />
                </div>

                {/* Text Input */}
                <div className="flex-1 relative group/text">
                  <input
                    type="text"
                    value={line.text}
                    onChange={(e) => updateLyricText(line.id, e.target.value)}
                    className="w-full px-6 py-3 bg-white/[0.01] border border-transparent border-b-white/5 text-white text-base font-bold focus:border-emerald-500/40 outline-none transition-all placeholder:text-white/5"
                    placeholder="ENTER LYRIC FRAGMENT..."
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 opacity-0 group-hover/line:opacity-100 transition-all duration-500 transform translate-x-4 group-hover/line:translate-x-0">
                  <button
                    onClick={() => handlePreview(line)}
                    className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 border border-white/5 text-white/20 hover:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/20 transition-all"
                    title="PREVIEW"
                  >
                    <Play className="w-4 h-4 fill-current" />
                  </button>

                  <button
                    onClick={() => deleteLyricLine(line.id)}
                    className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 border border-white/5 text-white/20 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all"
                    title="DELETE"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-8 border-t border-white/5 bg-white/[0.01] relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
               <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{lyrics.length} TOTAL FRAGMENTS</span>
             </div>
             <span className="text-[10px] font-black text-white/10 uppercase tracking-widest">Auto-Sort Enabled</span>
          </div>
          <p className="text-[9px] font-black text-white/5 uppercase tracking-[0.3em]">Drag to reorder · Click timestamp to edit</p>
        </div>
      </div>
    </div>
  );
};

export default LyricEditor;
