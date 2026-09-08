import { globalTicker } from './Ticker';
import { Evaluator } from './Evaluator';
import { WebGLRenderer } from './WebGLRenderer';
import { useTimelineStore } from '../store/editmaster/useTimelineStore';
import { audioEngine } from './AudioEngine';

export class EngineCore {
  private renderer: WebGLRenderer | null = null;

  public attachCanvas(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer(canvas);
    
    // Bind Ticker to Renderer
    globalTicker.onTick = (frame) => {
      this.renderFrame(frame);
    };

    // Force an initial render
    this.renderFrame(useTimelineStore.getState().currentFrame);
  }

  public detachCanvas() {
    this.renderer?.destroy();
    this.renderer = null;
    globalTicker.onTick = undefined;
  }

  public renderFrame(frame: number) {
    if (!this.renderer) return;
    const state = useTimelineStore.getState();
    const evaluatedClips = Evaluator.evaluate(state, frame);
    
    // Push instantaneous speed to Audio Engine
    if (state.isPlaying) {
      evaluatedClips.forEach(clip => {
        if (clip.kind === 'video' || clip.kind === 'audio') {
          const instantSpeed = clip.uniforms['_instantSpeed'] as number;
          const sourceId = clip.uniforms['_sourceId'] as string;
          if (instantSpeed !== undefined && sourceId) {
             audioEngine.updateDynamicSpeed(clip.id, sourceId, instantSpeed);
          }
        }
      });
    }

    this.renderer.render(evaluatedClips);
  }
}

export const engineCore = new EngineCore();
