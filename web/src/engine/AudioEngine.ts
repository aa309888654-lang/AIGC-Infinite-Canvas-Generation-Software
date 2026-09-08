import { useTimelineStore } from '../store/editmaster/useTimelineStore';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private audioNodes: Map<string, { buffer: AudioBuffer; sourceNode: AudioBufferSourceNode | null; gainNode: GainNode }> = new Map();
  private playing = false;

  private masterGain: GainNode | null = null;
  private exportDestination: MediaStreamAudioDestinationNode | null = null;
  private analyser: AnalyserNode | null = null;

  constructor() {
    // Lazy init because browsers require user gesture
  }

  public init() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public getContext() {
    return this.ctx;
  }

  public connectToExport(dest: MediaStreamAudioDestinationNode) {
    this.exportDestination = dest;
    if (this.masterGain) {
      this.masterGain.connect(dest);
    }
  }

  public disconnectExport() {
    if (this.masterGain && this.exportDestination) {
      this.masterGain.disconnect(this.exportDestination);
    }
    this.exportDestination = null;
  }

  public async loadAsset(assetId: string, blobUrl: string) {
    if (!this.ctx) return;
    const existing = this.audioNodes.get(assetId);
    if (existing) {
      // If already loaded with same URL, skip
      // Check via buffer length as proxy (we don't store URL directly)
      void existing;
      return;
    }

    try {
      const response = await fetch(blobUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      
      const gainNode = this.ctx.createGain();
      gainNode.connect(this.masterGain!);
      
      this.audioNodes.set(assetId, {
        buffer: audioBuffer,
        sourceNode: null,
        gainNode
      });
      // eslint-disable-next-line no-console
      console.log(`[AudioEngine] Loaded asset ${assetId}`);
    } catch (err) {
      console.error(`[AudioEngine] Failed to load audio for ${assetId}`, err);
    }
  }

  public updateDynamicSpeed(_clipId: string, sourceId: string, currentInstantSpeed: number) {
    if (!this.ctx || !this.playing) return;
    const nodeData = this.audioNodes.get(sourceId);
    if (!nodeData || !nodeData.sourceNode) return;
    
    // Smoothly transition playback rate over 0.05s to prevent audio clicking
    nodeData.sourceNode.playbackRate.setTargetAtTime(
      currentInstantSpeed, 
      this.ctx.currentTime, 
      0.05
    );
  }

  public play(currentFrame: number, fps: number) {
    this.init();
    if (!this.ctx) return;
    
    this.playing = true;
    const currentTime = currentFrame / fps;
    const state = useTimelineStore.getState();
    const activeSeq = state.sequences.find(s => s.id === state.activeSequenceId);
    if (!activeSeq) return;

    // Stop all existing sources
    this.stopAll();

    // Find all clips that should be playing right now
    activeSeq.tracks.forEach(track => {
      if (track.muted) return;
      
      track.clips.forEach(clip => {
        if (clip.kind !== 'audio' && clip.kind !== 'video') return;
        if (!clip.sourceId) return;
        
        const nodeData = this.audioNodes.get(clip.sourceId);
        if (!nodeData) return;

        // Is it playing?
        const clipStartSec = clip.startFrame / fps;
        const clipEndSec = (clip.startFrame + clip.durationFrames) / fps;
        
        // Add audio padding (200ms) to prevent audio-video sync issues
        const AUDIO_PAD_SEC = 0.2;
        
        if (currentTime >= clipStartSec && currentTime < clipEndSec + AUDIO_PAD_SEC) {
          const offsetIntoClip = Math.max(0, currentTime - clipStartSec);
          const trimStartSec = Math.max(0, Number(clip.params['source.trimStart'] ?? 0) || 0);
          const rawTrimEndSec = Math.max(0, Number(clip.params['source.trimEnd'] ?? 0) || 0);
          
          // Apply volume with keyframe support
          let volume = (clip.params['audio.volume'] as number) ?? 100;
          
          // Check for volume keyframes
          const volumeKeyframes = clip.keyframes?.['audio.volume'] as { f: number; v: number }[] | undefined;
          if (volumeKeyframes && volumeKeyframes.length > 0) {
            const normalizedT = (currentFrame - clip.startFrame) / clip.durationFrames;
            for (let i = 0; i < volumeKeyframes.length - 1; i++) {
              const kfStart = (volumeKeyframes[i].f - clip.startFrame) / clip.durationFrames;
              const kfEnd = (volumeKeyframes[i + 1].f - clip.startFrame) / clip.durationFrames;
              if (normalizedT >= kfStart && normalizedT <= kfEnd) {
                const progress = (normalizedT - kfStart) / (kfEnd - kfStart);
                volume = volumeKeyframes[i].v + (volumeKeyframes[i + 1].v - volumeKeyframes[i].v) * progress;
                break;
              }
            }
          }
          
          // Speed curve logic initial setting
          let initialSpeed = (clip.params['speed.multiplier'] as number) || 1;
          interface SpeedCurve { points?: { t: number; speed: number }[] }
          const curveParam = clip.params['speed.curve'] as SpeedCurve | undefined;
          if (curveParam && curveParam.points && curveParam.points.length > 0) {
             const points = curveParam.points as { t: number, speed: number }[];
             const normalizedT = (currentFrame - clip.startFrame) / clip.durationFrames;
             for (let i = 0; i < points.length - 1; i++) {
                if (normalizedT >= points[i].t && normalizedT <= points[i + 1].t) {
                  const progress = (normalizedT - points[i].t) / (points[i + 1].t - points[i].t);
                  initialSpeed = points[i].speed + (points[i + 1].speed - points[i].speed) * progress;
                  break;
                }
             }
          }
          
          // This start offset is an approximation since playback rate can be dynamic.
          const playbackRate = Math.max(0.01, Math.abs(initialSpeed) || 1);
          const sourceEndSec = rawTrimEndSec > trimStartSec
            ? Math.min(rawTrimEndSec, nodeData.buffer.duration)
            : nodeData.buffer.duration;
          const sourceOffset = Math.min(
            sourceEndSec,
            trimStartSec + offsetIntoClip * playbackRate
          );
          const remainingClipSourceSeconds = Math.max(0, clipEndSec - currentTime) * playbackRate;
          const sourceDuration = Math.min(sourceEndSec - sourceOffset, remainingClipSourceSeconds);
          if (sourceDuration <= 0.005) return;

          const sourceNode = this.ctx.createBufferSource();
          sourceNode.buffer = nodeData.buffer;
          sourceNode.playbackRate.value = initialSpeed;
          sourceNode.connect(nodeData.gainNode);

          // Apply volume with smooth transition
          nodeData.gainNode.gain.setTargetAtTime(
            volume / 100,
            this.ctx!.currentTime,
            0.05 // Smooth transition over 50ms
          );

          sourceNode.start(0, sourceOffset, sourceDuration);
          nodeData.sourceNode = sourceNode;
        }
      });
    });
  }

  public stop() {
    this.playing = false;
    this.stopAll();
  }

  private stopAll() {
    this.audioNodes.forEach(nodeData => {
      if (nodeData.sourceNode) {
        try {
          nodeData.sourceNode.stop();
        } catch (e) { console.warn('Failed to stop sourceNode:', e); }
        nodeData.sourceNode.disconnect();
        nodeData.sourceNode = null;
      }
    });
  }

  public unloadAsset(assetId: string) {
    const node = this.audioNodes.get(assetId);
    if (node) {
      if (node.sourceNode) {
        try { node.sourceNode.stop(); } catch { /* noop */ }
        node.sourceNode.disconnect();
      }
      node.gainNode.disconnect();
      this.audioNodes.delete(assetId);
    }
  }

  public dispose() {
    this.stopAll();
    this.audioNodes.forEach(node => {
      node.gainNode.disconnect();
    });
    this.audioNodes.clear();
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.playing = false;
  }
}

export const audioEngine = new AudioEngine();
