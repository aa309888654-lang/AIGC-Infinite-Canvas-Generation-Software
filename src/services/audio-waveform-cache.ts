/**
 * 音频波形缓存服务
 * 负责从音频URL加载AudioBuffer，提取波形数据，并缓存结果
 */

// 波形数据缓存：sourceId -> 波形采样数据
const waveformCache = new Map<string, number[]>();

// AudioBuffer缓存：sourceId -> AudioBuffer
const audioBufferCache = new Map<string, AudioBuffer>();

// 共享的AudioContext用于解码（延迟创建）
let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return sharedAudioContext;
}

/**
 * 从URL加载音频并提取波形数据
 * @param sourceId 素材ID，用作缓存键
 * @param url 音频文件URL
 * @param samples 采样点数量（默认200）
 * @returns 波形数据数组（交替存储max/min峰值）
 */
export async function loadWaveformData(
  sourceId: string,
  url: string,
  samples: number = 200
): Promise<number[]> {
  // 检查缓存
  const cached = waveformCache.get(sourceId);
  if (cached) return cached;

  try {
    const ctx = getAudioContext();
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch audio: ${response.status}`);

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    // 缓存AudioBuffer
    audioBufferCache.set(sourceId, audioBuffer);

    // 提取波形数据
    const data = extractWaveformFromBuffer(audioBuffer, samples);

    // 缓存波形数据
    waveformCache.set(sourceId, data);

    return data;
  } catch (error) {
    console.warn(`Failed to load waveform for ${sourceId}:`, error);
    // 返回空波形数据而非假数据
    return Array(samples * 2).fill(0);
  }
}

/**
 * 从AudioBuffer提取波形峰值数据
 * @param audioBuffer 解码后的音频数据
 * @param samples 采样点数量
 * @returns 数组，交替存储每个采样点的max和|min|值
 */
export function extractWaveformFromBuffer(
  audioBuffer: AudioBuffer,
  samples: number = 200
): number[] {
  // 使用第一个声道
  const channelData = audioBuffer.getChannelData(0);
  const blockSize = Math.floor(channelData.length / samples);
  const data: number[] = [];

  for (let i = 0; i < samples; i++) {
    const start = i * blockSize;
    let max = 0;
    let minAbs = 0;

    for (let j = 0; j < blockSize; j++) {
      const idx = start + j;
      if (idx < channelData.length) {
        if (channelData[idx] > max) max = channelData[idx];
        if (Math.abs(channelData[idx]) > minAbs) minAbs = Math.abs(channelData[idx]);
      }
    }

    // 存储max和|min|用于更精确的波形显示
    data.push(max, minAbs);
  }

  return data;
}

/**
 * 获取缓存的波形数据
 */
export function getCachedWaveform(sourceId: string): number[] | undefined {
  return waveformCache.get(sourceId);
}

/**
 * 获取缓存的AudioBuffer
 */
export function getCachedAudioBuffer(sourceId: string): AudioBuffer | undefined {
  return audioBufferCache.get(sourceId);
}

/**
 * 将峰值对数据转换为单通道RMS数据（兼容旧Waveform组件）
 */
export function peakPairsToSimpleData(peakPairs: number[]): number[] {
  const result: number[] = [];
  for (let i = 0; i < peakPairs.length; i += 2) {
    result.push(Math.max(peakPairs[i], peakPairs[i + 1]));
  }
  return result;
}

/**
 * 预加载波形数据（用于素材添加到项目时）
 */
export async function preloadWaveform(sourceId: string, url: string): Promise<void> {
  await loadWaveformData(sourceId, url);
}

/**
 * 清除指定素材的缓存
 */
export function invalidateWaveform(sourceId: string): void {
  waveformCache.delete(sourceId);
  audioBufferCache.delete(sourceId);
}

/**
 * 清除所有缓存
 */
export function clearAllWaveformCache(): void {
  waveformCache.clear();
  audioBufferCache.clear();
}
