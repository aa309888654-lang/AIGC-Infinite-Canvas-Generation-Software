import { useState, useCallback } from 'react';
import { AudioAnalysisResult, AudioSection } from '@/services/music-service';

interface UseAudioAnalyzerReturn {
  analyzeAudio: (audioUrl: string) => Promise<AudioAnalysisResult>;
  isAnalyzing: boolean;
  analysisResult: AudioAnalysisResult | null;
  error: string | null;
}

export const useAudioAnalyzer = (): UseAudioAnalyzerReturn => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AudioAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyzeAudio = useCallback(async (audioUrl: string): Promise<AudioAnalysisResult> => {
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      
      // 1. 计算波形数据
      const waveformSamples = 200;
      const blockSize = Math.floor(channelData.length / waveformSamples);
      const waveform: number[] = [];
      
      for (let i = 0; i < waveformSamples; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(channelData[i * blockSize + j]);
        }
        waveform.push(sum / blockSize);
      }
      
      const maxWaveform = Math.max(...waveform);
      const normalizedWaveform = waveform.map(v => v / maxWaveform);
      
      // 2. BPM检测（简化版）
      const bpm = detectBPM(channelData, sampleRate);
      
      // 3. 调性检测（简化版）
      const key = detectKey(channelData, sampleRate);
      
      // 4. 段落检测
      const sections = detectSections(normalizedWaveform, audioBuffer.duration, bpm);
      
      const result: AudioAnalysisResult = {
        bpm,
        key,
        sections,
        waveform: normalizedWaveform,
      };
      
      setAnalysisResult(result);
      audioContext.close();
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '音频分析失败';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  return {
    analyzeAudio,
    isAnalyzing,
    analysisResult,
    error,
  };
};

// BPM检测（简化版）
function detectBPM(channelData: Float32Array, sampleRate: number): number {
  const hopSize = Math.floor(sampleRate * 0.01); // 10ms hops
  const windowSize = Math.floor(sampleRate * 0.05); // 50ms windows
  const energy: number[] = [];
  
  for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      sum += channelData[i + j] * channelData[i + j];
    }
    energy.push(Math.sqrt(sum / windowSize));
  }
  
  // 简化 autocorrelation
  const minLag = Math.floor(60 / 200 * sampleRate / hopSize); // 200 BPM max
  const maxLag = Math.floor(60 / 60 * sampleRate / hopSize); // 60 BPM min
  
  let bestLag = minLag;
  let bestCorrelation = -Infinity;
  
  for (let lag = minLag; lag < maxLag; lag++) {
    let correlation = 0;
    for (let i = 0; i < energy.length - lag; i++) {
      correlation += energy[i] * energy[i + lag];
    }
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }
  
  const bpm = Math.round(60 / (bestLag * 0.01));
  return Math.min(200, Math.max(60, bpm));
}

// 调性检测（简化版 - 基于fft的pitch检测）
function detectKey(channelData: Float32Array, sampleRate: number): string {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const frequencies = [261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392.00, 415.30, 440.00, 466.16, 493.88];
  
  const windowSize = 4096;
  const start = Math.floor(channelData.length / 2);
  
  let maxMagnitude = 0;
  let detectedFreq = 0;
  
  for (let i = 0; i < windowSize; i++) {
    const magnitude = Math.abs(channelData[start + i]);
    if (magnitude > maxMagnitude) {
      maxMagnitude = magnitude;
      detectedFreq = i * sampleRate / windowSize;
    }
  }
  
  // 找到最接近的音符
  let minDiff = Infinity;
  let detectedNote = 'C';
  
  for (let i = 0; i < frequencies.length; i++) {
    const diff = Math.abs(frequencies[i] - detectedFreq);
    if (diff < minDiff) {
      minDiff = diff;
      detectedNote = notes[i];
    }
  }
  
  return detectedNote;
}

// 段落检测
function detectSections(waveform: number[], duration: number, bpm: number): AudioSection[] {
  const sections: AudioSection[] = [];
  const samplesPerSection = Math.floor(waveform.length / 8); // 假设最多8个段落
  
  let currentSectionStart = 0;
  let currentSectionType: AudioSection['type'] = 'intro';
  let currentEnergy = 0;
  let sectionCount = 0;
  
  for (let i = 0; i < waveform.length; i++) {
    currentEnergy += waveform[i];
    
    if (i > 0 && i % samplesPerSection === 0) {
      const avgEnergy = currentEnergy / samplesPerSection;
      const _sectionDuration = duration * samplesPerSection / waveform.length;
      
      // 根据能量和位置确定段落类型
      const position = i / waveform.length;
      let sectionType: AudioSection['type'];
      
      if (position < 0.15) {
        sectionType = 'intro';
      } else if (position > 0.85) {
        sectionType = 'outro';
      } else if (avgEnergy > 0.5) {
        sectionType = sectionCount % 2 === 0 ? 'chorus' : 'verse';
      } else if (avgEnergy > 0.3) {
        sectionType = sectionCount % 2 === 0 ? 'verse' : 'chorus';
      } else {
        sectionType = 'bridge';
      }
      
      if (sectionType !== currentSectionType || i === waveform.length - 1) {
        if (currentSectionStart < i) {
          sections.push({
            startTime: currentSectionStart * duration / waveform.length,
            endTime: i * duration / waveform.length,
            type: currentSectionType,
            energy: currentEnergy / samplesPerSection,
          });
        }
        currentSectionStart = i;
        currentSectionType = sectionType;
        currentEnergy = 0;
        sectionCount++;
      }
    }
  }
  
  return sections;
}

export default useAudioAnalyzer;
