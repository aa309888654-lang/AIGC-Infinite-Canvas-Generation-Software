/**
 * BGM 节拍同步服务
 * 提供音乐节拍检测、自动踩点、转场同步等功能
 */
import { generateId } from '@/lib/utils';

export interface Beat {
  id: string;
  time: number;
  strength: number;
  type: 'kick' | 'snare' | 'hihat' | 'melody' | 'bass' | 'other';
  confidence: number;
}

export interface Bar {
  id: string;
  startTime: number;
  endTime: number;
  beatCount: number;
  tempo: number;
  measures: number;
}

export interface TempoSection {
  id: string;
  startTime: number;
  endTime: number;
  tempo: number;
  timeSignature: string;
  energy: number;
}

export interface BeatSyncResult {
  beats: Beat[];
  bars: Bar[];
  tempoSections: TempoSection[];
  avgTempo: number;
  totalDuration: number;
  beatCount: number;
}

export interface SyncPoint {
  time: number;
  type: 'beat' | 'bar' | 'downbeat' | 'transition';
  strength: number;
  action?: 'cut' | 'transition' | 'effect' | 'text' | 'fade' | 'slide' | 'flash';
}

export interface SyncPlan {
  id: string;
  syncPoints: SyncPoint[];
  transitions: SyncTransition[];
  tempo: number;
  style: 'energetic' | 'calm' | 'dramatic' | 'smooth';
}

export interface SyncTransition {
  id: string;
  time: number;
  type: 'cut' | 'fade' | 'zoom' | 'slide' | 'flash';
  duration: number;
  beatAlignment: 'on_beat' | 'off_beat' | 'anticipate';
}

class BeatSyncService {
  private audioContext: AudioContext | null = null;

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  async analyzeAudio(
    audioBuffer: AudioBuffer,
    onProgress?: (progress: number) => void
  ): Promise<BeatSyncResult> {
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;

    onProgress?.(10);

    const beats = this.detectBeats(channelData, sampleRate, onProgress);
    onProgress?.(60);

    const bars = this.detectBars(beats);
    onProgress?.(80);

    const tempoSections = this.analyzeTempoSections(beats, channelData, sampleRate);
    onProgress?.(90);

    const avgTempo = this.calculateAverageTempo(beats);

    onProgress?.(100);

    return {
      beats,
      bars,
      tempoSections,
      avgTempo,
      totalDuration: duration,
      beatCount: beats.length
    };
  }

  private detectBeats(
    samples: Float32Array,
    sampleRate: number,
    onProgress?: (progress: number) => void
  ): Beat[] {
    const beats: Beat[] = [];
    const windowSize = Math.floor(sampleRate * 0.02);
    const hopSize = Math.floor(windowSize / 2);
    const energy: number[] = [];

    for (let i = 0; i < samples.length - windowSize; i += hopSize) {
      let sum = 0;
      for (let j = 0; j < windowSize; j++) {
        sum += samples[i + j] * samples[i + j];
      }
      energy.push(sum / windowSize);
      if (i % (hopSize * 100) === 0) {
        onProgress?.(10 + (i / samples.length) * 40);
      }
    }

    const spectralFlux = [];
    for (let i = 1; i < energy.length; i++) {
      const flux = Math.max(0, energy[i] - energy[i - 1]);
      spectralFlux.push(flux);
    }

    const threshold = this.calculateThreshold(spectralFlux);
    const peaks = this.findPeaks(spectralFlux, threshold);

    const samplesPerEnergy = hopSize;
    const msPerSample = 1000 / sampleRate;

    for (const peak of peaks) {
      const time = (peak.index * samplesPerEnergy) * msPerSample;
      const strength = Math.min(1, peak.value / (threshold * 2));

      beats.push({
        id: generateId(),
        time,
        strength,
        type: this.classifyBeat(strength, peak),
        confidence: strength > 0.5 ? 0.9 : 0.6 + strength * 0.4
      });
    }

    return beats;
  }

  private calculateThreshold(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const percentile90 = sorted[Math.floor(sorted.length * 0.9)];
    return percentile90 * 0.8;
  }

  private findPeaks(values: number[], threshold: number): Array<{ index: number; value: number }> {
    const peaks: Array<{ index: number; value: number }> = [];

    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > threshold &&
          values[i] > values[i - 1] &&
          values[i] > values[i + 1]) {
        peaks.push({ index: i, value: values[i] });
      }
    }

    const minInterval = 10;
    const filteredPeaks: Array<{ index: number; value: number }> = [];
    let lastPeakIndex = -minInterval;

    for (const peak of peaks.sort((a, b) => b.value - a.value)) {
      if (peak.index - lastPeakIndex >= minInterval) {
        filteredPeaks.push(peak);
        lastPeakIndex = peak.index;
      }
    }

    return filteredPeaks.sort((a, b) => a.index - b.index);
  }

  private classifyBeat(strength: number, _peak: { index: number; value: number }): Beat['type'] {
    if (strength > 0.8) return 'kick';
    if (strength > 0.6) return 'snare';
    if (strength > 0.4) return 'hihat';
    return 'other';
  }

  private detectBars(beats: Beat[]): Bar[] {
    const bars: Bar[] = [];

    if (beats.length < 4) return bars;

    const intervals: number[] = [];
    for (let i = 1; i < Math.min(beats.length, 32); i++) {
      intervals.push(beats[i].time - beats[i - 1].time);
    }

    let beatCountPerBar = Math.round(60 / this.calculateAverageTempo(beats) * 4);
    if (beatCountPerBar < 4) beatCountPerBar = 4;
    if (beatCountPerBar > 8) beatCountPerBar = 8;

    let currentBarStart = beats[0].time;
    let currentBeatCount = 0;

    for (let i = 0; i < beats.length; i++) {
      currentBeatCount++;

      if (currentBeatCount >= beatCountPerBar) {
        const barDuration = beats[i].time - currentBarStart;
        const tempo = 60 / (barDuration / currentBeatCount);

        bars.push({
          id: generateId(),
          startTime: currentBarStart,
          endTime: beats[i].time,
          beatCount: currentBeatCount,
          tempo,
          measures: 1
        });

        currentBarStart = beats[i].time;
        currentBeatCount = 0;
      }
    }

    if (currentBeatCount > 0) {
      const lastBeat = beats[beats.length - 1];
      bars.push({
        id: generateId(),
        startTime: currentBarStart,
        endTime: lastBeat.time,
        beatCount: currentBeatCount,
        tempo: 60 / ((lastBeat.time - currentBarStart) / currentBeatCount),
        measures: 1
      });
    }

    return bars;
  }

  private analyzeTempoSections(
    beats: Beat[],
    _samples: Float32Array,
    _sampleRate: number
  ): TempoSection[] {
    const sections: TempoSection[] = [];

    if (beats.length < 8) {
      return [{
        id: generateId(),
        startTime: 0,
        endTime: beats[beats.length - 1]?.time || 0,
        tempo: this.calculateAverageTempo(beats),
        timeSignature: '4/4',
        energy: 0.5
      }];
    }

    const sectionDuration = 10;
    let currentTime = 0;
    const totalDuration = beats[beats.length - 1].time;

    while (currentTime < totalDuration) {
      const sectionEnd = Math.min(currentTime + sectionDuration, totalDuration);
      const sectionBeats = beats.filter(b => b.time >= currentTime && b.time < sectionEnd);

      const tempo = sectionBeats.length > 1
        ? 60 / this.calculateIntervalAverage(sectionBeats)
        : this.calculateAverageTempo(beats);

      let energy = 0;
      if (sectionBeats.length > 0) {
        energy = sectionBeats.reduce((sum, b) => sum + b.strength, 0) / sectionBeats.length;
      }

      sections.push({
        id: generateId(),
        startTime: currentTime,
        endTime: sectionEnd,
        tempo: Math.max(60, Math.min(180, tempo)),
        timeSignature: '4/4',
        energy
      });

      currentTime = sectionEnd;
    }

    return sections;
  }

  private calculateIntervalAverage(beats: Beat[]): number {
    if (beats.length < 2) return 0.5;

    const intervals: number[] = [];
    for (let i = 1; i < beats.length; i++) {
      intervals.push(beats[i].time - beats[i - 1].time);
    }

    return intervals.reduce((a, b) => a + b, 0) / intervals.length;
  }

  private calculateAverageTempo(beats: Beat[]): number {
    if (beats.length < 2) return 120;

    const intervals: number[] = [];
    for (let i = 1; i < Math.min(beats.length, 32); i++) {
      const interval = beats[i].time - beats[i - 1].time;
      if (interval > 0.1 && interval < 2) {
        intervals.push(interval);
      }
    }

    if (intervals.length === 0) return 120;

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    let tempo = 60 / avgInterval;

    while (tempo < 60) tempo *= 2;
    while (tempo > 180) tempo /= 2;

    return tempo;
  }

  generateSyncPlan(
    beatData: BeatSyncResult,
    style: SyncPlan['style'] = 'energetic',
    transitionInterval: number = 4
  ): SyncPlan {
    const syncPoints: SyncPoint[] = [];
    const transitions: SyncTransition[] = [];

    const styleConfig = {
      energetic: { beatType: 'downbeat' as const, actionType: 'cut' as const, anticipation: 0 as const },
      calm: { beatType: 'beat' as const, actionType: 'fade' as const, anticipation: 0.1 as const },
      dramatic: { beatType: 'downbeat' as const, actionType: 'flash' as const, anticipation: -0.05 as const },
      smooth: { beatType: 'bar' as const, actionType: 'slide' as const, anticipation: 0.05 as const }
    };

    const config = styleConfig[style];

    const downbeats = beatData.beats.filter(b => b.strength > 0.7);

    for (let i = 0; i < downbeats.length; i += transitionInterval) {
      const beat = downbeats[i];

      syncPoints.push({
        time: beat.time - config.anticipation,
        type: 'downbeat',
        strength: beat.strength,
        action: config.actionType
      });
    }

    for (let i = 0; i < syncPoints.length - 1; i++) {
      const current = syncPoints[i];
      const next = syncPoints[i + 1];
      const duration = next.time - current.time;

      transitions.push({
        id: generateId(),
        time: current.time,
        type: config.actionType,
        duration: Math.min(0.5, duration * 0.3),
        beatAlignment: config.anticipation === 0 ? 'on_beat' : 'anticipate'
      });
    }

    return {
      id: generateId(),
      syncPoints,
      transitions,
      tempo: beatData.avgTempo,
      style
    };
  }

  alignToBeats(
    clipTimes: number[],
    beatData: BeatSyncResult,
    mode: 'nearest' | 'onbeat' | 'offbeat' = 'nearest',
    beatWindow: number = 50
  ): number[] {
    const windowSec = beatWindow / 1000;

    return clipTimes.map(time => {
      let nearestBeat = beatData.beats[0];
      let minDiff = Math.abs(time - nearestBeat.time);

      for (const beat of beatData.beats) {
        const diff = Math.abs(time - beat.time);
        if (diff < minDiff) {
          minDiff = diff;
          nearestBeat = beat;
        }
      }

      if (minDiff <= windowSec) {
        return nearestBeat.time;
      }

      const beforeBeat = [...beatData.beats].reverse().find(b => b.time <= time + windowSec && b.time <= time);
      const afterBeat = beatData.beats.find(b => b.time >= time - windowSec && b.time >= time);

      if (beforeBeat && afterBeat) {
        const diffBefore = Math.abs(time - beforeBeat.time);
        const diffAfter = Math.abs(time - afterBeat.time);
        if (diffBefore <= windowSec || diffAfter <= windowSec) {
          return diffBefore <= diffAfter ? beforeBeat.time : afterBeat.time;
        }
      } else if (beforeBeat && Math.abs(time - beforeBeat.time) <= windowSec) {
        return beforeBeat.time;
      } else if (afterBeat && Math.abs(time - afterBeat.time) <= windowSec) {
        return afterBeat.time;
      }

      if (mode === 'nearest') {
        return nearestBeat.time;
      } else if (mode === 'onbeat') {
        if (nearestBeat.strength > 0.6) {
          return nearestBeat.time;
        }
        return nearestBeat.time;
      } else {
        return nearestBeat.time + (60 / beatData.avgTempo) * 0.5;
      }
    });
  }

  suggestTransitionTiming(
    beatData: BeatSyncResult,
    clipDuration: number,
    _style: SyncPlan['style']
  ): number[] {
    const timings: number[] = [];

    const beatInterval = 60 / beatData.avgTempo;
    let currentTime = beatInterval;

    while (currentTime < clipDuration) {
      const beat = beatData.beats.find(
        b => Math.abs(b.time - currentTime) < beatInterval * 0.2
      );

      if (beat && beat.strength > 0.5) {
        timings.push(currentTime);
      }

      currentTime += beatInterval;
    }

    return timings;
  }

  calculateOptimalSpeed(
    clipDuration: number,
    targetDuration: number,
    _beatData: BeatSyncResult
  ): number {
    const speed = clipDuration / targetDuration;

    const adjustedSpeed = Math.round(speed * 4) / 4;

    return Math.max(0.25, Math.min(4, adjustedSpeed));
  }

  exportBeatData(beatData: BeatSyncResult): string {
    const exportData = {
      tempo: beatData.avgTempo,
      duration: beatData.totalDuration,
      beats: beatData.beats.map(b => ({
        time: b.time.toFixed(3),
        strength: b.strength.toFixed(2),
        type: b.type
      })),
      bars: beatData.bars.map(bar => ({
        start: bar.startTime.toFixed(3),
        end: bar.endTime.toFixed(3),
        tempo: bar.tempo.toFixed(1)
      }))
    };

    return JSON.stringify(exportData, null, 2);
  }

  importBeatData(jsonString: string): BeatSyncResult | null {
    try {
      const data = JSON.parse(jsonString);

      const beats: Beat[] = (data.beats || []).map((b: any) => ({
        id: generateId(),
        time: parseFloat(b.time),
        strength: parseFloat(b.strength),
        type: b.type as Beat['type'],
        confidence: 0.8
      }));

      const bars: Bar[] = (data.bars || []).map((bar: any) => ({
        id: generateId(),
        startTime: parseFloat(bar.start),
        endTime: parseFloat(bar.end),
        beatCount: 4,
        tempo: parseFloat(bar.tempo),
        measures: 1
      }));

      return {
        beats,
        bars,
        tempoSections: [{
          id: generateId(),
          startTime: 0,
          endTime: data.duration || 0,
          tempo: data.tempo || 120,
          timeSignature: '4/4',
          energy: 0.5
        }],
        avgTempo: data.tempo || 120,
        totalDuration: data.duration || 0,
        beatCount: beats.length
      };
    } catch (error) {
      console.error('[Beat Sync] 导入失败:', error);
      return null;
    }
  }

  getBeatVisualization(beatData: BeatSyncResult): { time: number; height: number }[] {
    return beatData.beats.map(beat => ({
      time: beat.time,
      height: beat.strength * 100
    }));
  }
}

export const beatSyncService = new BeatSyncService();
