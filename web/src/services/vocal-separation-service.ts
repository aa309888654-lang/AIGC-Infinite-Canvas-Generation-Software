/**
 * 人声分离服务
 * 提供浏览器端音频人声分离功能
 * 使用 Web Audio API 和频谱分析实现基础分离
 */

export interface SeparationResult {
  vocals: Blob;
  accompaniment: Blob;
  instrumental: Blob;
}

export interface SeparationOptions {
  model?: 'simple' | 'advanced';
  strength?: number;
}

class VocalSeparationService {
  private audioContext: AudioContext | null = null;

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  async separateVocal(
    file: File, 
    options: SeparationOptions = {},
    onProgress?: (progress: number) => void
  ): Promise<SeparationResult> {
    const ctx = this.getAudioContext();
    const strength = options.strength || 0.8;
    
    onProgress?.(10);
    
    const arrayBuffer = await file.arrayBuffer();
    onProgress?.(30);
    
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    onProgress?.(50);
    const sampleRate = audioBuffer.sampleRate;
    
    const vocalsData = this.extractVocalChannel(audioBuffer, strength);
    onProgress?.(70);
    
    const accompanimentData = this.extractAccompaniment(audioBuffer, vocalsData);
    onProgress?.(80);
    
    const vocalsBlob = this.audioDataToWav(vocalsData, sampleRate);
    const accompanimentBlob = this.audioDataToWav(accompanimentData, sampleRate);
    const instrumentalBlob = this.audioDataToWav(accompanimentData, sampleRate);
    onProgress?.(100);
    
    return {
      vocals: vocalsBlob,
      accompaniment: accompanimentBlob,
      instrumental: instrumentalBlob
    };
  }

  private extractVocalChannel(audioBuffer: AudioBuffer, strength: number): Float32Array[] {
    const channels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    
    if (channels >= 2) {
      const left = audioBuffer.getChannelData(0);
      const right = audioBuffer.getChannelData(1);
      
      const vocal = new Float32Array(length);
      const diff = new Float32Array(length);
      
      for (let i = 0; i < length; i++) {
        const l = left[i];
        const r = right[i];
        vocal[i] = (l + r) / 2;
        diff[i] = (l - r) / 2;
      }
      
      const result: Float32Array[] = [];
      
      const vocalOut = new Float32Array(length);
      for (let i = 0; i < length; i++) {
        vocalOut[i] = vocal[i] + diff[i] * strength;
      }
      result.push(vocalOut);
      
      if (channels > 1) {
        const rightOut = new Float32Array(length);
        for (let i = 0; i < length; i++) {
          rightOut[i] = vocal[i] - diff[i] * strength;
        }
        result.push(rightOut);
      }
      
      return result;
    } else {
      const mono = audioBuffer.getChannelData(0);
      return [mono];
    }
  }

  private extractAccompaniment(audioBuffer: AudioBuffer, vocalData: Float32Array[]): Float32Array[] {
    const channels = audioBuffer.numberOfChannels;
    
    if (channels >= 2 && vocalData.length >= 2) {
      const result: Float32Array[] = [];
      
      const left = audioBuffer.getChannelData(0);
      const accompaniment = new Float32Array(left.length);
      for (let i = 0; i < left.length; i++) {
        accompaniment[i] = left[i] - vocalData[0][i] * 0.5;
      }
      result.push(accompaniment);
      
      if (vocalData.length > 1) {
        const right = audioBuffer.getChannelData(1);
        const rightAcc = new Float32Array(right.length);
        for (let i = 0; i < right.length; i++) {
          rightAcc[i] = right[i] - vocalData[1][i] * 0.5;
        }
        result.push(rightAcc);
      }
      
      return result;
    } else {
      const mono = audioBuffer.getChannelData(0);
      const accompaniment = new Float32Array(mono.length);
      for (let i = 0; i < mono.length; i++) {
        accompaniment[i] = mono[i] * 0.3;
      }
      return [accompaniment];
    }
  }

  private audioDataToWav(channels: Float32Array[], sampleRate: number): Blob {
    const numChannels = channels.length;
    const length = channels[0].length;
    
    const buffer = new ArrayBuffer(44 + length * numChannels * 2);
    const view = new DataView(buffer);
    
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length * numChannels * 2, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    this.writeString(view, 36, 'data');
    view.setUint32(40, length * numChannels * 2, true);
    
    const offset = 44;
    for (let i = 0; i < length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, channels[ch][i]));
        view.setInt16(offset + (i * numChannels + ch) * 2, sample * 0x7FFF, true);
      }
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
  }

  private writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  async separateUsingFFT(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<SeparationResult> {
    const ctx = this.getAudioContext();
    
    onProgress?.(10);
    
    const arrayBuffer = await file.arrayBuffer();
    onProgress?.(30);
    
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    onProgress?.(50);
    
    const vocalResult = this.fftBasedSeparation(audioBuffer, 'vocal');
    onProgress?.(80);
    
    const instrumentalResult = this.fftBasedSeparation(audioBuffer, 'instrumental');
    onProgress?.(100);
    
    return {
      vocals: this.audioDataToWav(vocalResult, audioBuffer.sampleRate),
      accompaniment: this.audioDataToWav(instrumentalResult, audioBuffer.sampleRate),
      instrumental: this.audioDataToWav(instrumentalResult, audioBuffer.sampleRate)
    };
  }

  private fftBasedSeparation(audioBuffer: AudioBuffer, type: 'vocal' | 'instrumental'): Float32Array[] {
    const channels = audioBuffer.numberOfChannels;
    const result: Float32Array[] = [];
    
    for (let ch = 0; ch < Math.min(channels, 2); ch++) {
      const data = audioBuffer.getChannelData(ch);
      const separated = new Float32Array(data.length);
      
      const fftSize = 2048;
      const hopSize = fftSize / 4;
      
      for (let i = 0; i < data.length - fftSize; i += hopSize) {
        const magnitude = this.computeMagnitudeSpectrum(data.subarray(i, i + fftSize));
        
        let gain = 1.0;
        if (type === 'vocal') {
          gain = magnitude > 0.3 ? 1.2 : 0.3;
        } else {
          gain = magnitude > 0.3 ? 0.5 : 1.0;
        }
        
        for (let j = 0; j < hopSize && i + j < data.length; j++) {
          separated[i + j] = data[i + j] * gain * 0.8;
        }
      }
      
      result.push(separated);
    }
    
    return result;
  }

  private computeMagnitudeSpectrum(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }

  async extractAudioFromVideo(
    videoFile: File,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    
    onProgress?.(10);
    
    const arrayBuffer = await videoFile.arrayBuffer();
    onProgress?.(30);
    
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    onProgress?.(70);
    
    const wavBlob = this.audioDataToWav([audioBuffer.getChannelData(0)], audioBuffer.sampleRate);
    onProgress?.(100);
    
    return wavBlob;
  }

  async changeTempo(
    audioFile: File,
    semitones: number,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    const ctx = this.getAudioContext();
    
    onProgress?.(10);
    
    const arrayBuffer = await audioFile.arrayBuffer();
    onProgress?.(30);
    
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const sampleRate = audioBuffer.sampleRate;
    
    const playbackRate = Math.pow(2, semitones / 12);
    
    const newLength = Math.floor(audioBuffer.length / playbackRate);
    const newBuffer = ctx.createBuffer(
      audioBuffer.numberOfChannels,
      newLength,
      sampleRate
    );
    
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const oldData = audioBuffer.getChannelData(channel);
      const newData = newBuffer.getChannelData(channel);
      
      for (let i = 0; i < newLength; i++) {
        const srcIndex = i * playbackRate;
        const index = Math.floor(srcIndex);
        const frac = srcIndex - index;
        
        if (index + 1 < oldData.length) {
          newData[i] = oldData[index] * (1 - frac) + oldData[index + 1] * frac;
        } else if (index < oldData.length) {
          newData[i] = oldData[index];
        }
      }
    }
    
    onProgress?.(80);
    
    const result = this.audioDataToWav([newBuffer.getChannelData(0)], sampleRate);
    onProgress?.(100);
    
    return result;
  }

  async denoise(
    audioFile: File,
    strength: number = 0.5,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    const ctx = this.getAudioContext();
    
    onProgress?.(10);
    
    const arrayBuffer = await audioFile.arrayBuffer();
    onProgress?.(30);
    
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const sampleRate = audioBuffer.sampleRate;
    
    const result: Float32Array[] = [];
    
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const data = audioBuffer.getChannelData(ch);
      const denoised = new Float32Array(data.length);
      
      const windowSize = 512;
      const threshold = strength * 0.1;
      
      for (let i = 0; i < data.length; i += windowSize / 2) {
        let energy = 0;
        const end = Math.min(i + windowSize, data.length);
        
        for (let j = i; j < end; j++) {
          energy += data[j] * data[j];
        }
        energy = Math.sqrt(energy / (end - i));
        
        const gain = energy > threshold ? 1.0 : strength;
        
        for (let j = i; j < end; j++) {
          denoised[j] = data[j] * gain;
        }
      }
      
      result.push(denoised);
    }
    
    onProgress?.(80);
    
    const blob = this.audioDataToWav(result, sampleRate);
    onProgress?.(100);
    
    return blob;
  }
}

export const vocalSeparationService = new VocalSeparationService();
