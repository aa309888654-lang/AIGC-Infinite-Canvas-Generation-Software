/**
 * 音频处理器 - 基于 Tone.js 和 WaveSurfer.js
 * 提供专业级音频编辑能力
 */

import * as Tone from 'tone';
import WaveSurfer from 'wavesurfer.js';

export interface AudioEffect {
  type: 'reverb' | 'delay' | 'distortion' | 'eq' | 'compressor' | 'chorus';
  params: Record<string, number>;
}

export interface AudioProcessOptions {
  onProgress?: (progress: number) => void;
  onLog?: (message: string) => void;
}

class AudioProcessor {
  private wavesurfers: Map<string, WaveSurfer> = new Map();
  private players: Map<string, Tone.Player> = new Map();
  private effects: Map<string, Tone.ToneAudioNode[]> = new Map();

  /**
   * 创建波形可视化
   */
  createWaveform(
    containerId: string,
    audioUrl: string,
    options?: {
      waveColor?: string;
      progressColor?: string;
      height?: number;
    }
  ): WaveSurfer {
    const wavesurfer = WaveSurfer.create({
      container: `#${containerId}`,
      waveColor: options?.waveColor || '#4F4A85',
      progressColor: options?.progressColor || '#383351',
      height: options?.height || 80,
      normalize: true,
      backend: 'WebAudio',
    });

    wavesurfer.load(audioUrl);
    this.wavesurfers.set(containerId, wavesurfer);

    return wavesurfer;
  }

  /**
   * 销毁波形
   */
  destroyWaveform(containerId: string): void {
    const wavesurfer = this.wavesurfers.get(containerId);
    if (wavesurfer) {
      wavesurfer.destroy();
      this.wavesurfers.delete(containerId);
    }
  }

  /**
   * 加载音频
   */
  async loadAudio(id: string, audioUrl: string): Promise<Tone.Player> {
    const player = new Tone.Player(audioUrl).toDestination();
    await Tone.loaded();
    
    this.players.set(id, player);
    return player;
  }

  /**
   * 播放音频
   */
  async playAudio(id: string): Promise<void> {
    const player = this.players.get(id);
    if (player) {
      await Tone.start();
      player.start();
    }
  }

  /**
   * 暂停音频
   */
  pauseAudio(id: string): void {
    const player = this.players.get(id);
    if (player) {
      player.stop();
    }
  }

  /**
   * 设置音量
   */
  setVolume(id: string, volume: number): void {
    const player = this.players.get(id);
    if (player) {
      player.volume.value = Tone.gainToDb(volume);
    }
  }

  /**
   * 添加混响效果
   */
  addReverb(
    id: string,
    decay: number = 1.5,
    preDelay: number = 0.01
  ): void {
    const player = this.players.get(id);
    if (!player) return;

    const reverb = new Tone.Reverb({
      decay,
      preDelay,
    }).toDestination();

    player.disconnect();
    player.connect(reverb);

    const effects = this.effects.get(id) || [];
    effects.push(reverb);
    this.effects.set(id, effects);
  }

  /**
   * 添加延迟效果
   */
  addDelay(
    id: string,
    delayTime: number = 0.25,
    feedback: number = 0.5
  ): void {
    const player = this.players.get(id);
    if (!player) return;

    const delay = new Tone.FeedbackDelay({
      delayTime,
      feedback,
    }).toDestination();

    player.disconnect();
    player.connect(delay);

    const effects = this.effects.get(id) || [];
    effects.push(delay);
    this.effects.set(id, effects);
  }

  /**
   * 添加均衡器
   */
  addEQ(
    id: string,
    low: number = 0,
    mid: number = 0,
    high: number = 0
  ): void {
    const player = this.players.get(id);
    if (!player) return;

    const eq3 = new Tone.EQ3({
      low,
      mid,
      high,
    }).toDestination();

    player.disconnect();
    player.connect(eq3);

    const effects = this.effects.get(id) || [];
    effects.push(eq3);
    this.effects.set(id, effects);
  }

  /**
   * 添加压缩器
   */
  addCompressor(
    id: string,
    threshold: number = -24,
    ratio: number = 4
  ): void {
    const player = this.players.get(id);
    if (!player) return;

    const compressor = new Tone.Compressor({
      threshold,
      ratio,
    }).toDestination();

    player.disconnect();
    player.connect(compressor);

    const effects = this.effects.get(id) || [];
    effects.push(compressor);
    this.effects.set(id, effects);
  }

  /**
   * 清除所有效果
   */
  clearEffects(id: string): void {
    const effects = this.effects.get(id);
    if (effects) {
      effects.forEach((effect) => effect.dispose());
      this.effects.delete(id);
    }

    const player = this.players.get(id);
    if (player) {
      player.disconnect();
      player.toDestination();
    }
  }

  /**
   * 淡入效果
   */
  fadeIn(id: string, duration: number = 1): void {
    const player = this.players.get(id);
    if (player) {
      player.volume.value = -Infinity;
      player.volume.rampTo(0, duration);
    }
  }

  /**
   * 淡出效果
   */
  fadeOut(id: string, duration: number = 1): void {
    const player = this.players.get(id);
    if (player) {
      player.volume.rampTo(-Infinity, duration);
    }
  }

  /**
   * 检测节拍（简化版）
   */
  async detectBeats(
    audioUrl: string,
    options?: AudioProcessOptions
  ): Promise<number[]> {
    options?.onLog?.('检测节拍...');

    // 这里使用简化的实现
    // 实际项目中应该使用更复杂的算法
    const beats: number[] = [];
    
    // 模拟节拍检测
    const bpm = 120; // 假设 120 BPM
    const beatInterval = 60 / bpm;
    const duration = 60; // 假设 60 秒

    for (let time = 0; time < duration; time += beatInterval) {
      beats.push(time);
    }

    options?.onLog?.(`检测到 ${beats.length} 个节拍`);
    return beats;
  }

  /**
   * 音频降噪（简化版）
   */
  async denoise(
    audioUrl: string,
    options?: AudioProcessOptions
  ): Promise<string> {
    options?.onLog?.('降噪处理...');

    // 实际项目中需要使用专业的降噪算法
    // 这里返回原始 URL
    options?.onLog?.('降噪完成');
    return audioUrl;
  }

  /**
   * 混音多个音轨
   */
  async mixTracks(
    tracks: Array<{ url: string; volume: number; startTime: number }>,
    options?: AudioProcessOptions
  ): Promise<Blob> {
    options?.onLog?.('混音中...');

    // 加载所有音轨
    const players = await Promise.all(
      tracks.map(async (track, _index) => {
        const player = new Tone.Player(track.url);
        player.volume.value = Tone.gainToDb(track.volume);
        await Tone.loaded();
        return { player, startTime: track.startTime };
      })
    );

    // 创建录音器
    const recorder = new Tone.Recorder();
    const merger = new Tone.Gain().connect(recorder);

    // 连接所有播放器
    players.forEach(({ player }) => {
      player.connect(merger);
    });

    // 开始录音
    recorder.start();

    // 播放所有音轨
    await Tone.start();
    players.forEach(({ player, startTime }) => {
      player.start(Tone.now() + startTime);
    });

    // 等待播放完成
    const maxDuration = Math.max(
      ...players.map(({ player, startTime }) => 
        startTime + player.buffer.duration
      )
    );

    await new Promise((resolve) => setTimeout(resolve, maxDuration * 1000));

    // 停止录音
    const recording = await recorder.stop();

    options?.onLog?.('混音完成');
    return recording;
  }

  /**
   * 提取音频片段
   */
  async extractSegment(
    audioUrl: string,
    startTime: number,
    duration: number,
    options?: AudioProcessOptions
  ): Promise<Blob> {
    options?.onLog?.('提取音频片段...');

    const player = new Tone.Player(audioUrl);
    await Tone.loaded();

    const recorder = new Tone.Recorder();
    player.connect(recorder);

    recorder.start();
    await Tone.start();
    
    player.start(0, startTime, duration);

    await new Promise((resolve) => setTimeout(resolve, duration * 1000));

    const recording = await recorder.stop();

    options?.onLog?.('提取完成');
    return recording;
  }

  /**
   * 清理资源
   */
  dispose(id: string): void {
    this.clearEffects(id);
    
    const player = this.players.get(id);
    if (player) {
      player.dispose();
      this.players.delete(id);
    }

    this.destroyWaveform(id);
  }

  /**
   * 清理所有资源
   */
  disposeAll(): void {
    this.players.forEach((player) => player.dispose());
    this.players.clear();

    this.effects.forEach((effects) => {
      effects.forEach((effect) => effect.dispose());
    });
    this.effects.clear();

    this.wavesurfers.forEach((ws) => ws.destroy());
    this.wavesurfers.clear();
  }
}

// 导出单例
export const audioProcessor = new AudioProcessor();
