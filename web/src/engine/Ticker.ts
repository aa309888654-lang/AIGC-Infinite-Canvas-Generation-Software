import { useTimelineStore } from '../store/editmaster/useTimelineStore';
import { audioEngine } from './AudioEngine';

export class Ticker {
  private rafId: number = 0;
  private startTime: number = 0;
  private startFrame: number = 0;
  public onTick?: (currentFrame: number) => void;

  // Start the render loop. Always runs (even when paused) so param changes are reflected.
  public start() {
    if (this.rafId) return;
    audioEngine.init();
    this.rafId = requestAnimationFrame(this.loop);
  }

  public stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    audioEngine.stop();
  }

  // Called when playback begins — primes audio clock and start frame
  public play() {
    const state = useTimelineStore.getState();
    this.startFrame = state.currentFrame;
    const ctx = audioEngine.getContext();
    this.startTime = ctx ? ctx.currentTime : performance.now() / 1000;
    audioEngine.play(this.startFrame, state.fps);
  }

  // Called when playback pauses — stops audio only, render loop continues
  public pause() {
    audioEngine.stop();
  }

  private loop = (_time: number) => {
    const state = useTimelineStore.getState();

    if (state.isPlaying) {
      const fps = state.fps;
      const ctx = audioEngine.getContext();
      const currentTime = ctx ? ctx.currentTime : performance.now() / 1000;
      const elapsedTime = currentTime - this.startTime;
      const expectedFrame = this.startFrame + Math.floor(elapsedTime * fps);

      if (expectedFrame > state.currentFrame) {
        const activeSeq = state.sequences.find(s => s.id === state.activeSequenceId);
        let maxFrame = 0;
        if (activeSeq) {
          activeSeq.tracks.forEach(t => {
            t.clips.forEach(c => {
              const end = c.startFrame + c.durationFrames;
              if (end > maxFrame) maxFrame = end;
            });
          });
        }

        if (expectedFrame > maxFrame && maxFrame > 0) {
          state.setPlaying(false);
          state.setCurrentFrame(maxFrame);
        } else {
          state.setCurrentFrame(expectedFrame);
        }
      }
    }

    // Always render the current frame, even when paused — so param changes show up live
    if (this.onTick) {
      this.onTick(state.currentFrame);
    }

    this.rafId = requestAnimationFrame(this.loop);
  };
}

export const globalTicker = new Ticker();
