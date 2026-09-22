/**
 * 音频效果引擎 - 基于 Web Audio API 的实时音频处理
 * 提供 EQ / 混响 / 延迟等效果的实际处理能力
 */

export interface EQBand {
  frequency: number;
  gain: number;   // -12 ~ +12 dB
  Q: number;      // 品质因数
}

export interface ReverbParams {
  roomSize: number;  // 0 ~ 100
  damping: number;   // 0 ~ 100
  wetDry: number;    // 0 ~ 100 (wet%)
}

export interface DelayParams {
  delayTime: number;  // 0 ~ 1000 ms
  feedback: number;   // 0 ~ 90 %
  wetDry: number;     // 0 ~ 100 (wet%)
}

export interface CompressorParams {
  threshold: number;  // -60 ~ 0 dB
  ratio: number;      // 1 ~ 20
  attack: number;     // 0 ~ 100 ms
  release: number;    // 10 ~ 1000 ms
}

export interface EffectChainParams {
  eq: EQBand[];
  reverb: ReverbParams;
  delay: DelayParams;
  compressor: CompressorParams;
  eqEnabled: boolean;
  reverbEnabled: boolean;
  delayEnabled: boolean;
  compressorEnabled: boolean;
}

export const DEFAULT_EFFECT_CHAIN: EffectChainParams = {
  eq: [
    { frequency: 60, gain: 0, Q: 1.0 },
    { frequency: 230, gain: 0, Q: 1.0 },
    { frequency: 910, gain: 0, Q: 1.0 },
    { frequency: 4000, gain: 0, Q: 1.0 },
    { frequency: 14000, gain: 0, Q: 1.0 },
  ],
  reverb: { roomSize: 30, damping: 50, wetDry: 30 },
  delay: { delayTime: 250, feedback: 30, wetDry: 30 },
  compressor: { threshold: -24, ratio: 4, attack: 10, release: 250 },
  eqEnabled: false,
  reverbEnabled: false,
  delayEnabled: false,
  compressorEnabled: false,
};

/**
 * 音频效果引擎
 * 为每个音轨创建独立的 Web Audio API 处理链
 */
class AudioEffectsEngine {
  private audioContext: AudioContext | null = null;
  private trackChains: Map<string, {
    sourceNode: MediaElementAudioSourceNode | MediaStreamAudioSourceNode | AudioBufferSourceNode;
    eqFilters: BiquadFilterNode[];
    compressorNode: DynamicsCompressorNode;
    convolverNode: ConvolverNode | null;
    reverbGain: GainNode;
    delayNode: DelayNode;
    delayFeedback: GainNode;
    delayGain: GainNode;
    dryGain: GainNode;
    pannerNode: StereoPannerNode;
    analyserNode: AnalyserNode;
    outputGain: GainNode;
    params: EffectChainParams;
  }> = new Map();

  private levelCallbacks: Map<string, (level: { rms: number; peak: number }) => void> = new Map();
  private animationFrames: Map<string, number> = new Map();

  /** 获取或创建 AudioContext */
  getContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  /** 为音轨创建效果处理链 */
  createTrackChain(trackId: string, audioElement: HTMLAudioElement): void {
    const ctx = this.getContext();

    // 如果已存在，先断开
    this.removeTrackChain(trackId);

    const params = { ...DEFAULT_EFFECT_CHAIN, eq: DEFAULT_EFFECT_CHAIN.eq.map(b => ({ ...b })) };

    // 创建节点
    const sourceNode = ctx.createMediaElementSource(audioElement);

    // EQ: 5段参数均衡器
    const eqFilters = params.eq.map((band) => {
      const filter = ctx.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = band.frequency;
      filter.gain.value = band.gain;
      filter.Q.value = band.Q;
      return filter;
    });

    // 压缩器
    const compressorNode = ctx.createDynamicsCompressor();
    compressorNode.threshold.value = params.compressor.threshold;
    compressorNode.ratio.value = params.compressor.ratio;
    compressorNode.attack.value = params.compressor.attack / 1000;
    compressorNode.release.value = params.compressor.release / 1000;

    // 混响 (Convolver)
    const convolverNode = ctx.createConvolver();
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = params.reverbEnabled ? params.reverb.wetDry / 100 : 0;
    const dryGain = ctx.createGain();
    dryGain.gain.value = 1;

    // 延迟
    const delayNode = ctx.createDelay(2.0);
    delayNode.delayTime.value = params.delay.delayTime / 1000;
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = params.delay.feedback / 100;
    const delayGain = ctx.createGain();
    delayGain.gain.value = params.delayEnabled ? params.delay.wetDry / 100 : 0;

    // 输出增益
    const outputGain = ctx.createGain();
    outputGain.gain.value = 1;

    // 声像（左右平衡）
    const pannerNode = ctx.createStereoPanner();
    pannerNode.pan.value = 0;

    // 分析器
    const analyserNode = ctx.createAnalyser();
    analyserNode.fftSize = 2048;
    analyserNode.smoothingTimeConstant = 0.8;

    // 连接信号链：source -> EQ -> compressor -> [dry/wet split for reverb] -> delay -> output -> panner -> analyser -> destination
    // source -> EQ filters (chain)
    sourceNode.connect(eqFilters[0]);
    for (let i = 0; i < eqFilters.length - 1; i++) {
      eqFilters[i].connect(eqFilters[i + 1]);
    }

    // EQ -> compressor
    const lastEq = eqFilters[eqFilters.length - 1];
    lastEq.connect(compressorNode);

    // compressor -> dry path
    compressorNode.connect(dryGain);

    // compressor -> reverb wet path
    compressorNode.connect(convolverNode);
    convolverNode.connect(reverbGain);

    // dry + reverb wet -> delay
    dryGain.connect(delayGain);
    reverbGain.connect(delayGain);

    // delay feedback loop
    delayGain.connect(delayNode);
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayNode.connect(outputGain);

    // bypass: compressor -> output (dry without delay)
    delayGain.connect(outputGain);

    // output -> panner -> analyser -> destination
    outputGain.connect(pannerNode);
    pannerNode.connect(analyserNode);
    analyserNode.connect(ctx.destination);

    // 生成初始混响脉冲响应
    this.generateReverbIR(convolverNode, params.reverb);

    this.trackChains.set(trackId, {
      sourceNode,
      eqFilters,
      compressorNode,
      convolverNode,
      reverbGain,
      delayNode,
      delayFeedback,
      delayGain,
      dryGain,
      pannerNode,
      analyserNode,
      outputGain,
      params,
    });
  }

  /** 移除音轨的处理链 */
  removeTrackChain(trackId: string): void {
    const chain = this.trackChains.get(trackId);
    if (chain) {
      chain.sourceNode.disconnect();
      chain.eqFilters.forEach(f => f.disconnect());
      chain.compressorNode.disconnect();
      chain.convolverNode?.disconnect();
      chain.reverbGain.disconnect();
      chain.delayNode.disconnect();
      chain.delayFeedback.disconnect();
      chain.delayGain.disconnect();
      chain.dryGain.disconnect();
      chain.outputGain.disconnect();
      chain.pannerNode.disconnect();
      chain.analyserNode.disconnect();
      this.trackChains.delete(trackId);
    }
    this.stopLevelMonitoring(trackId);
  }

  /** 更新EQ参数 */
  updateEQ(trackId: string, bandIndex: number, gain: number): void {
    const chain = this.trackChains.get(trackId);
    if (!chain || bandIndex >= chain.eqFilters.length) return;
    chain.eqFilters[bandIndex].gain.value = gain;
    chain.params.eq[bandIndex].gain = gain;
  }

  /** 启用/禁用EQ */
  setEQEnabled(trackId: string, enabled: boolean): void {
    const chain = this.trackChains.get(trackId);
    if (!chain) return;
    chain.params.eqEnabled = enabled;
    // 启用时恢复gain值，禁用时设为0
    chain.eqFilters.forEach((filter, i) => {
      filter.gain.value = enabled ? chain.params.eq[i].gain : 0;
    });
  }

  /** 更新混响参数 */
  updateReverb(trackId: string, params: Partial<ReverbParams>): void {
    const chain = this.trackChains.get(trackId);
    if (!chain) return;
    Object.assign(chain.params.reverb, params);

    if (params.roomSize !== undefined && chain.convolverNode) {
      this.generateReverbIR(chain.convolverNode, chain.params.reverb);
    }
    if (params.wetDry !== undefined) {
      chain.reverbGain.gain.value = chain.params.reverbEnabled ? params.wetDry / 100 : 0;
    }
  }

  /** 启用/禁用混响 */
  setReverbEnabled(trackId: string, enabled: boolean): void {
    const chain = this.trackChains.get(trackId);
    if (!chain) return;
    chain.params.reverbEnabled = enabled;
    chain.reverbGain.gain.value = enabled ? chain.params.reverb.wetDry / 100 : 0;
  }

  /** 更新延迟参数 */
  updateDelay(trackId: string, params: Partial<DelayParams>): void {
    const chain = this.trackChains.get(trackId);
    if (!chain) return;
    Object.assign(chain.params.delay, params);

    if (params.delayTime !== undefined) {
      chain.delayNode.delayTime.value = params.delayTime / 1000;
    }
    if (params.feedback !== undefined) {
      chain.delayFeedback.gain.value = params.feedback / 100;
    }
    if (params.wetDry !== undefined) {
      chain.delayGain.gain.value = chain.params.delayEnabled ? params.wetDry / 100 : 0;
    }
  }

  /** 启用/禁用延迟 */
  setDelayEnabled(trackId: string, enabled: boolean): void {
    const chain = this.trackChains.get(trackId);
    if (!chain) return;
    chain.params.delayEnabled = enabled;
    chain.delayGain.gain.value = enabled ? chain.params.delay.wetDry / 100 : 0;
  }

  /** 更新压缩器参数 */
  updateCompressor(trackId: string, params: Partial<CompressorParams>): void {
    const chain = this.trackChains.get(trackId);
    if (!chain) return;
    Object.assign(chain.params.compressor, params);

    if (params.threshold !== undefined) chain.compressorNode.threshold.value = params.threshold;
    if (params.ratio !== undefined) chain.compressorNode.ratio.value = params.ratio;
    if (params.attack !== undefined) chain.compressorNode.attack.value = params.attack / 1000;
    if (params.release !== undefined) chain.compressorNode.release.value = params.release / 1000;
  }

  /** 启用/禁用压缩器 */
  setCompressorEnabled(trackId: string, enabled: boolean): void {
    const chain = this.trackChains.get(trackId);
    if (!chain) return;
    chain.params.compressorEnabled = enabled;
    if (enabled) {
      const p = chain.params.compressor;
      chain.compressorNode.threshold.value = p.threshold;
      chain.compressorNode.ratio.value = p.ratio;
    } else {
      // 禁用：将阈值设为0dB（不压缩），比率设为1
      chain.compressorNode.threshold.value = 0;
      chain.compressorNode.ratio.value = 1;
    }
  }

  /** 设置音轨音量 */
  setTrackVolume(trackId: string, volume: number): void {
    const chain = this.trackChains.get(trackId);
    if (!chain) return;
    chain.outputGain.gain.value = Math.max(0, Math.min(1, volume));
  }

  /** 设置音轨声像 (-1=左, 0=中, 1=右) */
  setTrackPan(trackId: string, pan: number): void {
    const chain = this.trackChains.get(trackId);
    if (!chain) return;
    chain.pannerNode.pan.value = Math.max(-1, Math.min(1, pan));
  }

  /** 简单降噪 (高通滤波器去除低频噪声) */
  enableDenoise(trackId: string, enabled: boolean, threshold?: number): void {
    const chain = this.trackChains.get(trackId);
    if (!chain) return;
    // Use first EQ filter as highpass for noise reduction
    if (chain.eqFilters.length > 0) {
      if (enabled) {
        const hp = chain.eqFilters[0];
        const origType = hp.type;
        hp.type = 'highpass';
        hp.frequency.value = threshold ?? 80;
        hp.Q.value = 0.7;
        (hp as any).origType = origType;
        (hp as any).isDenoise = true;
      } else {
        const hp = chain.eqFilters[0];
        if ((hp as any).isDenoise) {
          hp.type = 'peaking';
          hp.frequency.value = chain.params.eq[0].frequency;
          hp.gain.value = chain.params.eq[0].gain;
          hp.Q.value = chain.params.eq[0].Q;
          delete (hp as any).isDenoise;
        }
      }
    }
  }

  /** 获取效果链参数 */
  getTrackParams(trackId: string): EffectChainParams | undefined {
    return this.trackChains.get(trackId)?.params;
  }

  /** 获取音轨的 AnalyserNode */
  getTrackAnalyser(trackId: string): AnalyserNode | undefined {
    return this.trackChains.get(trackId)?.analyserNode;
  }

  /** 生成混响脉冲响应 */
  private generateReverbIR(convolverNode: ConvolverNode, params: ReverbParams): void {
    const ctx = this.getContext();
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * (params.roomSize / 100) * 4; // 0~4秒
    const impulse = ctx.createBuffer(2, Math.max(sampleRate, length), sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      const dampingFactor = params.damping / 100;

      for (let i = 0; i < length; i++) {
        const t = i / length;
        // 指数衰减 + 随机反射
        const envelope = Math.pow(1 - t, 1 + dampingFactor * 3);
        const noise = (Math.random() * 2 - 1);
        channelData[i] = noise * envelope;
      }
    }

    try {
      convolverNode.buffer = impulse;
    } catch {
      // ConvolverNode buffer可能在某些状态下无法设置，忽略
    }
  }

  /** 开始电平监测 */
  startLevelMonitoring(trackId: string, callback: (level: { rms: number; peak: number }) => void): void {
    this.levelCallbacks.set(trackId, callback);
    this.monitorLevels(trackId);
  }

  /** 停止电平监测 */
  stopLevelMonitoring(trackId: string): void {
    const frameId = this.animationFrames.get(trackId);
    if (frameId !== undefined) {
      cancelAnimationFrame(frameId);
      this.animationFrames.delete(trackId);
    }
    this.levelCallbacks.delete(trackId);
  }

  /** 电平监测循环 */
  private monitorLevels(trackId: string): void {
    const chain = this.trackChains.get(trackId);
    const callback = this.levelCallbacks.get(trackId);
    if (!chain || !callback) return;

    const analyser = chain.analyserNode;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);

    const update = () => {
      analyser.getFloatTimeDomainData(dataArray);

      // 计算RMS（均方根，即VU表值）
      let sumSquares = 0;
      let peak = 0;
      for (let i = 0; i < bufferLength; i++) {
        const sample = dataArray[i];
        sumSquares += sample * sample;
        const abs = Math.abs(sample);
        if (abs > peak) peak = abs;
      }
      const rms = Math.sqrt(sumSquares / bufferLength);

      callback({
        rms: Math.min(1, rms * 3), // 归一化，放大3倍以便可视化
        peak: Math.min(1, peak),
      });

      this.animationFrames.set(trackId, requestAnimationFrame(update));
    };

    update();
  }

  /** 从AudioBuffer提取波形数据 */
  extractWaveformData(audioBuffer: AudioBuffer, samples: number = 200): number[] {
    const channelData = audioBuffer.getChannelData(0);
    const blockSize = Math.floor(channelData.length / samples);
    const data: number[] = [];

    for (let i = 0; i < samples; i++) {
      const start = i * blockSize;
      let max = 0;
      let min = 0;
      for (let j = 0; j < blockSize; j++) {
        const idx = start + j;
        if (idx < channelData.length) {
          if (channelData[idx] > max) max = channelData[idx];
          if (channelData[idx] < min) min = channelData[idx];
        }
      }
      // 存储正负峰值用于更精确的波形显示
      data.push(max, Math.abs(min));
    }

    return data;
  }

  /** 从URL加载音频并返回AudioBuffer */
  async loadAudioBuffer(url: string): Promise<AudioBuffer> {
    const ctx = this.getContext();
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return ctx.decodeAudioData(arrayBuffer);
  }

  /** 销毁引擎，释放所有资源 */
  dispose(): void {
    this.trackChains.forEach((_, trackId) => this.removeTrackChain(trackId));
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// 导出单例
export const audioEffectsEngine = new AudioEffectsEngine();
