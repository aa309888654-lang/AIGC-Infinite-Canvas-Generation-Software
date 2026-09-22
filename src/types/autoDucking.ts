export type DuckingMode = 'volume' | 'compress' | 'sidechain';

export interface AutoDuckingConfig {
  enabled: boolean;
  mode: DuckingMode;
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  makeupGain: number;
  duckingAmount: number;
  frequency: number;
  detector: 'peak' | 'RMS';
  hold: number;
  lookahead: number;
}

export const DEFAULT_AUTO_DUCKING_CONFIG: AutoDuckingConfig = {
  enabled: false,
  mode: 'volume',
  threshold: -20,
  ratio: 4,
  attack: 10,
  release: 100,
  makeupGain: 0,
  duckingAmount: -12,
  frequency: 200,
  detector: 'RMS',
  hold: 50,
  lookahead: 5,
};

export interface DuckingPoint {
  time: number;
  duration: number;
  amount: number;
  triggered: boolean;
}

export function createAutoDuckingConfig(partial?: Partial<AutoDuckingConfig>): AutoDuckingConfig {
  return {
    ...DEFAULT_AUTO_DUCKING_CONFIG,
    ...partial,
  };
}

export function calculateDuckingCurve(
  config: AutoDuckingConfig,
  duration: number,
  triggerTimes: number[]
): DuckingPoint[] {
  const points: DuckingPoint[] = [];
  const { duckingAmount, attack, release, hold } = config;
  
  const attackTime = attack / 1000;
  const releaseTime = release / 1000;
  const holdTime = hold / 1000;
  
  triggerTimes.forEach(triggerTime => {
    const curveStart = triggerTime - attackTime;
    const curveEnd = triggerTime + holdTime + releaseTime;
    
    for (let t = Math.max(0, curveStart); t <= Math.min(duration, curveEnd); t += 0.01) {
      let amount: number;
      
      if (t < triggerTime) {
        const progress = (t - curveStart) / attackTime;
        amount = duckingAmount * easeInOutQuad(progress);
      } else if (t < triggerTime + holdTime) {
        amount = duckingAmount;
      } else {
        const progress = (t - (triggerTime + holdTime)) / releaseTime;
        amount = duckingAmount * (1 - easeInOutQuad(Math.min(1, progress)));
      }
      
      points.push({
        time: t,
        duration: 0.01,
        amount,
        triggered: true,
      });
    }
  });
  
  return points;
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export function analyzeAudioForDucking(audioData: Float32Array): { peaks: number[]; rms: number[] } {
  const windowSize = 1024;
  const hopSize = 512;
  const peaks: number[] = [];
  const rms: number[] = [];
  
  for (let i = 0; i < audioData.length - windowSize; i += hopSize) {
    let max = 0;
    let sumSquares = 0;
    
    for (let j = 0; j < windowSize; j++) {
      const sample = Math.abs(audioData[i + j]);
      max = Math.max(max, sample);
      sumSquares += sample * sample;
    }
    
    peaks.push(max);
    rms.push(Math.sqrt(sumSquares / windowSize));
  }
  
  return { peaks, rms };
}

export function detectDuckingTriggers(
  audioData: Float32Array,
  sampleRate: number,
  threshold: number
): number[] {
  const { peaks } = analyzeAudioForDucking(audioData);
  const triggers: number[] = [];
  
  let inTrigger = false;
  let triggerStart = 0;
  
  for (let i = 0; i < peaks.length; i++) {
    const time = (i * 512) / sampleRate;
    const isAbove = peaks[i] > threshold;
    
    if (isAbove && !inTrigger) {
      triggerStart = time;
      inTrigger = true;
    } else if (!isAbove && inTrigger) {
      if (time - triggerStart > 0.1) {
        triggers.push(triggerStart);
      }
      inTrigger = false;
    }
  }
  
  return triggers;
}

export function applyDuckingToAudio(
  audioData: Float32Array,
  duckingPoints: DuckingPoint[],
  sampleRate: number
): Float32Array {
  const result = new Float32Array(audioData.length);
  
  duckingPoints.forEach((point, idx) => {
    const sampleIndex = Math.floor(point.time * sampleRate);
    const gain = Math.pow(10, point.amount / 20);
    
    for (let i = 0; i < Math.floor(point.duration * sampleRate) && sampleIndex + i < audioData.length; i++) {
      const currentPoint = duckingPoints[idx + 1];
      if (currentPoint && i < Math.floor(currentPoint.duration * sampleRate)) {
        const nextGain = Math.pow(10, currentPoint.amount / 20);
        const t = i / (point.duration * sampleRate);
        const interpolatedGain = gain + (nextGain - gain) * t;
        result[sampleIndex + i] = audioData[sampleIndex + i] * interpolatedGain;
      } else {
        result[sampleIndex + i] = audioData[sampleIndex + i] * gain;
      }
    }
  });
  
  for (let i = 0; i < audioData.length; i++) {
    if (!duckingPoints.some(p => {
      const start = p.time * sampleRate;
      const end = start + p.duration * sampleRate;
      return i >= start && i < end;
    })) {
      result[i] = audioData[i];
    }
  }
  
  return result;
}
