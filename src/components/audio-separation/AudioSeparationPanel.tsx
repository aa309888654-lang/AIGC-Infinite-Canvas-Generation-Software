import React, { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  useAudioSeparationStore,
  audioSeparationService,
  type AudioStem,
  type SeparatedTrack,
} from '@/services/audio-separation-service';
import {
  Music,
  Mic,
  Drum,
  Guitar,
  Piano,
  Volume2,
  VolumeX,
  Headphones,
  Play,
  Pause,
  Download,
  Trash2,
  Settings,
  Wand2,
  Loader2,
  Check,
  AlertCircle,
  FileAudio,
} from 'lucide-react';

interface AudioSeparationPanelProps {
  sourceUrl?: string;
  sourceName?: string;
  onTracksReady?: (tracks: SeparatedTrack[]) => void;
  className?: string;
}

const STEM_ICONS: Record<AudioStem, React.ReactNode> = {
  vocals: <Mic className="w-4 h-4" />,
  drums: <Drum className="w-4 h-4" />,
  bass: <Guitar className="w-4 h-4" />,
  other: <Music className="w-4 h-4" />,
  piano: <Piano className="w-4 h-4" />,
  guitar: <Guitar className="w-4 h-4" />,
};

export const AudioSeparationPanel: React.FC<AudioSeparationPanelProps> = ({
  sourceUrl,
  sourceName,
  onTracksReady,
  className,
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [playingTrack, setPlayingTrack] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const {
    jobs,
    currentJob,
    isProcessing,
    selectedModel,
    selectedStems,
    startSeparation,
    updateJobProgress,
    completeJob,
    failJob,
    cancelJob,
    removeJob,
    setSelectedModel,
    toggleStem,
  } = useAudioSeparationStore();

  const handleStartSeparation = useCallback(async () => {
    if (!sourceUrl) return;

    const jobId = startSeparation(sourceUrl, sourceName || 'audio');

    try {
      const audioBuffer = await audioSeparationService.loadAudioFile(sourceUrl);

      const separatedBuffers = await audioSeparationService.separateAudio(
        audioBuffer,
        selectedModel,
        selectedStems,
        (progress) => updateJobProgress(jobId, progress)
      );

      const tracks: SeparatedTrack[] = [];

      for (const [stem, buffer] of separatedBuffers) {
        const config = audioSeparationService.getStemConfig(stem);
        const wavBlob = await audioBufferToWav(buffer);
        const url = URL.createObjectURL(wavBlob);

        tracks.push({
          id: `track-${jobId}-${stem}`,
          stem,
          name: config.name,
          url,
          duration: buffer.duration,
          waveform: audioSeparationService.generateWaveform(buffer),
          volume: 1,
          muted: false,
          solo: false,
          color: config.color,
        });
      }

      completeJob(jobId, tracks);
      onTracksReady?.(tracks);
    } catch (error) {
      failJob(jobId, error instanceof Error ? error.message : '分离失败');
    }
  }, [sourceUrl, sourceName, selectedModel, selectedStems, completeJob, failJob, onTracksReady, startSeparation, updateJobProgress]);

  const handlePlayTrack = (track: SeparatedTrack) => {
    if (playingTrack === track.id) {
      setPlayingTrack(null);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    } else {
      setPlayingTrack(track.id);
      if (audioRef.current) {
        audioRef.current.src = track.url;
        audioRef.current.play();
      }
    }
  };

  const handleDownloadTrack = async (track: SeparatedTrack) => {
    const a = document.createElement('a');
    a.href = track.url;
    a.download = `${sourceName || 'audio'}_${track.name}.wav`;
    a.click();
  };

  const audioBufferToWav = async (buffer: AudioBuffer): Promise<Blob> => {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1;
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    const dataLength = buffer.length * blockAlign;
    const bufferLength = 44 + dataLength;

    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, bufferLength - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    const channels: Float32Array[] = [];
    for (let i = 0; i < numChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  const models = audioSeparationService.getAvailableModels();
  const stems = audioSeparationService.getAvailableStems();

  return (
    <div className={cn('flex flex-col bg-[#0D0D0D] rounded-lg overflow-hidden', className)}>
      <div className="flex items-center justify-between px-3 py-2 bg-[#1A1A1A] border-b border-[#2D2D2D]">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-white">音频分离</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              'p-1.5 rounded transition-colors',
              showSettings
                ? 'bg-gray-500/20 text-gray-400'
                : 'hover:bg-[#2D2D2D] text-gray-400'
            )}
            title="设置"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="px-3 py-3 bg-[#1A1A1A] border-b border-[#2D2D2D] space-y-3">
          <div className="space-y-2">
            <label className="text-sm text-gray-300">分离模型</label>
            <div className="grid grid-cols-2 gap-2">
              {models.map((model) => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModel(model.id as any)}
                  className={cn(
                    'px-3 py-2 text-left rounded border transition-colors',
                    selectedModel === model.id
                      ? 'bg-gray-500/20 border-gray-500/50 text-gray-400'
                      : 'bg-[#1F1F1F] border-[#3A3A3A] text-gray-300 hover:border-[#4A4A4A]'
                  )}
                >
                  <div className="text-sm font-medium">{model.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{model.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-300">分离轨道</label>
            <div className="flex flex-wrap gap-2">
              {stems.map((stemInfo) => (
                <button
                  key={stemInfo.stem}
                  onClick={() => toggleStem(stemInfo.stem)}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded border transition-colors',
                    selectedStems.includes(stemInfo.stem)
                      ? 'border-transparent'
                      : 'bg-[#1F1F1F] border-[#3A3A3A] text-gray-400 hover:border-[#4A4A4A]'
                  )}
                  style={
                    selectedStems.includes(stemInfo.stem)
                      ? { backgroundColor: `${stemInfo.color}20`, borderColor: `${stemInfo.color}50`, color: stemInfo.color }
                      : {}
                  }
                >
                  {STEM_ICONS[stemInfo.stem]}
                  <span className="text-sm">{stemInfo.name}</span>
                  {selectedStems.includes(stemInfo.stem) && (
                    <Check className="w-3 h-3" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3">
        {!sourceUrl ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <FileAudio className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">请先选择音频或视频文件</p>
          </div>
        ) : currentJob ? (
          <div className="space-y-3">
            {currentJob.status === 'processing' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                    <span className="text-sm text-gray-300">正在分离...</span>
                  </div>
                  <span className="text-xs text-gray-400">{currentJob.progress}%</span>
                </div>
                <div className="h-2 bg-[#1F1F1F] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gray-500 transition-all duration-300"
                    style={{ width: `${currentJob.progress}%` }}
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>模型: {models.find((m) => m.id === currentJob.model)?.name}</span>
                  <span>|</span>
                  <span>轨道: {currentJob.stems.map((s) => audioSeparationService.getStemConfig(s).name).join(', ')}</span>
                </div>
                <button
                  onClick={() => cancelJob(currentJob.id)}
                  className="w-full py-1.5 text-sm text-red-400 hover:bg-red-500/10 rounded transition-colors"
                >
                  取消
                </button>
              </div>
            )}

            {currentJob.status === 'completed' && currentJob.outputTracks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-400">
                  <Check className="w-4 h-4" />
                  <span className="text-sm">分离完成</span>
                </div>

                {currentJob.outputTracks.map((track) => (
                  <div
                    key={track.id}
                    className="flex items-center gap-3 p-2 bg-[#1F1F1F] rounded-lg"
                  >
                    <div
                      className="w-8 h-8 rounded flex items-center justify-center"
                      style={{ backgroundColor: `${track.color}20`, color: track.color }}
                    >
                      {STEM_ICONS[track.stem]}
                    </div>

                    <div className="flex-1">
                      <div className="text-sm text-white">{track.name}</div>
                      <div className="text-xs text-gray-500">
                        {track.duration.toFixed(1)}s
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handlePlayTrack(track)}
                        className="p-1.5 hover:bg-[#2D2D2D] rounded text-gray-400 hover:text-white transition-colors"
                        title={playingTrack === track.id ? '暂停' : '播放'}
                      >
                        {playingTrack === track.id ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDownloadTrack(track)}
                        className="p-1.5 hover:bg-[#2D2D2D] rounded text-gray-400 hover:text-white transition-colors"
                        title="下载"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {currentJob.status === 'failed' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-400">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">分离失败</span>
                </div>
                <div className="text-xs text-gray-500">{currentJob.error}</div>
                <button
                  onClick={handleStartSeparation}
                  className="w-full py-1.5 text-sm bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 rounded transition-colors"
                >
                  重试
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-32">
            <Music className="w-12 h-12 text-gray-600 mb-3" />
            <p className="text-sm text-gray-500 mb-3">
              将音频分离为独立轨道
            </p>
            <button
              onClick={handleStartSeparation}
              disabled={!sourceUrl || selectedStems.length === 0}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              开始分离
            </button>
          </div>
        )}
      </div>

      <audio ref={audioRef} onEnded={() => setPlayingTrack(null)} />
    </div>
  );
};

export default AudioSeparationPanel;
