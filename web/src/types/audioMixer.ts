export interface AudioTrackMixer {
  trackId: string;
  trackName: string;
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  stereo: boolean;
  equalizer: EqualizerBand[];
  effects: AudioEffect[];
}

export interface EqualizerBand {
  id: string;
  frequency: number;
  gain: number;
  q: number;
  type: 'lowshelf' | 'highshelf' | 'peaking' | 'lowpass' | 'highpass';
}

export interface AudioEffect {
  id: string;
  type: AudioEffectType;
  enabled: boolean;
  parameters: Record<string, number>;
}

export type AudioEffectType = 
  | 'compressor'
  | 'limiter'
  | 'noise-gate'
  | 'reverb'
  | 'delay'
  | 'chorus'
  | 'distortion';

export interface AudioMixerPreset {
  id: string;
  name: string;
  description: string;
  tracks: AudioTrackMixer[];
  masterVolume: number;
  masterMute: boolean;
}

export const DEFAULT_EQUALIZER_BANDS: EqualizerBand[] = [
  { id: 'eq-1', frequency: 60, gain: 0, q: 1, type: 'lowshelf' },
  { id: 'eq-2', frequency: 250, gain: 0, q: 1, type: 'peaking' },
  { id: 'eq-3', frequency: 1000, gain: 0, q: 1, type: 'peaking' },
  { id: 'eq-4', frequency: 4000, gain: 0, q: 1, type: 'peaking' },
  { id: 'eq-5', frequency: 12000, gain: 0, q: 1, type: 'highshelf' },
];

export const MASTER_TRACK_ID = 'master';

export function createAudioTrackMixer(trackId: string, trackName: string): AudioTrackMixer {
  return {
    trackId,
    trackName,
    volume: 0,
    pan: 0,
    mute: false,
    solo: false,
    stereo: true,
    equalizer: [...DEFAULT_EQUALIZER_BANDS],
    effects: [],
  };
}

export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

export function linearToDb(linear: number): number {
  return 20 * Math.log10(Math.max(0.0001, linear));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getVolumeDb(volume: number): string {
  if (volume <= 0) return '-∞';
  const db = linearToDb(volume);
  return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`;
}

export function getPanLabel(pan: number): string {
  if (pan === 0) return 'C';
  if (pan < 0) return `L${Math.abs(Math.round(pan * 100))}`;
  return `R${Math.round(pan * 100)}`;
}

export function applyEffects(audioData: Float32Array, effects: AudioEffect[]): Float32Array {
  let result: Float32Array<ArrayBufferLike> = new Float32Array(audioData);
  
  for (const effect of effects) {
    if (!effect.enabled) continue;
    
    switch (effect.type) {
      case 'compressor':
        result = applyCompressor(result, effect.parameters);
        break;
      case 'limiter':
        result = applyLimiter(result, effect.parameters);
        break;
      case 'noise-gate':
        result = applyNoiseGate(result, effect.parameters);
        break;
    }
  }
  
  return result as Float32Array;
}

function applyCompressor(audioData: Float32Array, params: Record<string, number>): Float32Array {
  const threshold = params.threshold ?? -20;
  const ratio = params.ratio ?? 4;
  const attack = params.attack ?? 10;
  const release = params.release ?? 100;
  
  const result = new Float32Array(audioData.length);
  let envelope = 0;
  
  const thresholdLinear = dbToLinear(threshold);
  const attackCoef = Math.exp(-1 / (attack * 0.001));
  const releaseCoef = Math.exp(-1 / (release * 0.001));
  
  for (let i = 0; i < audioData.length; i++) {
    const input = Math.abs(audioData[i]);
    
    if (input > envelope) {
      envelope = attackCoef * envelope + (1 - attackCoef) * input;
    } else {
      envelope = releaseCoef * envelope + (1 - releaseCoef) * input;
    }
    
    let gain = 1;
    if (envelope > thresholdLinear) {
      const dbOver = linearToDb(envelope / thresholdLinear);
      gain = dbToLinear(dbOver - dbOver / ratio);
    }
    
    result[i] = audioData[i] * gain;
  }
  
  return result;
}

function applyLimiter(audioData: Float32Array, params: Record<string, number>): Float32Array {
  const threshold = dbToLinear(params.threshold ?? -1);
  const release = params.release ?? 100;
  
  const result = new Float32Array(audioData.length);
  let envelope = 0;
  const releaseCoef = Math.exp(-1 / (release * 0.001));
  
  for (let i = 0; i < audioData.length; i++) {
    const input = Math.abs(audioData[i]);
    
    envelope = releaseCoef * envelope + (1 - releaseCoef) * input;
    
    let gain = 1;
    if (envelope > threshold) {
      gain = threshold / envelope;
    }
    
    result[i] = audioData[i] * gain;
  }
  
  return result;
}

function applyNoiseGate(audioData: Float32Array, params: Record<string, number>): Float32Array {
  const threshold = dbToLinear(params.threshold ?? -40);
  const hold = params.hold ?? 50;
  const release = params.release ?? 100;
  
  const result = new Float32Array(audioData.length);
  let gateOpen = false;
  let holdCounter = 0;
  const releaseCoef = Math.exp(-1 / (release * 0.001));
  let envelope = 0;
  
  for (let i = 0; i < audioData.length; i++) {
    const input = Math.abs(audioData[i]);
    
    envelope = releaseCoef * envelope + (1 - releaseCoef) * input;
    
    if (envelope > threshold) {
      if (!gateOpen) {
        gateOpen = true;
        holdCounter = hold;
      }
    } else if (holdCounter > 0) {
      holdCounter--;
    } else {
      gateOpen = false;
    }
    
    result[i] = gateOpen ? audioData[i] : 0;
  }
  
  return result;
}
