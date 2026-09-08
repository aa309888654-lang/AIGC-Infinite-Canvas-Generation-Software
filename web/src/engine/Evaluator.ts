// @ts-nocheck
import { TimelineState } from '../store/editmaster/types';
import { EvaluatedClip } from './types';

export class Evaluator {
  static evaluate(state: TimelineState, currentFrame: number): EvaluatedClip[] {
    const activeSeq = state.sequences.find(s => s.id === state.activeSequenceId);
    if (!activeSeq) return [];

    const evaluated: EvaluatedClip[] = [];

    // First pass: Find all active adjustment layers and calculate their combined effects
    const globalAdjustments: Record<string, number> = {
      brightness: 0,
      contrast: 0,
      saturation: 0,
    };

    for (const track of activeSeq.tracks) {
      if (track.hidden) continue;
      for (const clip of track.clips) {
        if (clip.kind === 'adjustmentLayer' && currentFrame >= clip.startFrame && currentFrame < clip.startFrame + clip.durationFrames) {
          // Simplification: We just grab the params directly (not interpolating adjustment layer keyframes for brevity here, though we should)
          globalAdjustments.brightness += (clip.params['color.brightness'] as number) || 0;
          globalAdjustments.contrast += (clip.params['color.contrast'] as number) || 0;
          globalAdjustments.saturation += (clip.params['color.saturation'] as number) || 0;
        }
      }
    }

    // Bottom-to-top traversal (painter's algorithm)
    // addTrack uses unshift for video/text/sticker tracks, so tracks[0] is the
    // topmost layer.  To render correctly (bottom-most drawn first), iterate
    // tracks in reverse order so that lower layers appear earlier in evaluated[].
    const tracksReversed = [...activeSeq.tracks].reverse();
    for (const track of tracksReversed) {
      if (track.hidden) continue;

      for (const clip of track.clips) {
        if (currentFrame >= clip.startFrame && currentFrame < clip.startFrame + clip.durationFrames) {
          
          const interpolatedParams = { ...clip.params };

          // Apply Keyframe Interpolation
          for (const paramId in clip.keyframes) {
            const kfs = clip.keyframes[paramId as keyof typeof clip.keyframes];
            if (!kfs || kfs.length === 0) continue;

            // If only one keyframe or before first keyframe, use the first
            if (currentFrame <= kfs[0].f) {
              interpolatedParams[paramId as keyof typeof interpolatedParams] = kfs[0].v as never;
              continue;
            }

            // If after last keyframe, use the last
            if (currentFrame >= kfs[kfs.length - 1].f) {
              interpolatedParams[paramId as keyof typeof interpolatedParams] = kfs[kfs.length - 1].v as never;
              continue;
            }

            // Find surrounding keyframes
            let kf1 = kfs[0];
            let kf2 = kfs[kfs.length - 1];
            for (let i = 0; i < kfs.length - 1; i++) {
              if (currentFrame >= kfs[i].f && currentFrame <= kfs[i + 1].f) {
                kf1 = kfs[i];
                kf2 = kfs[i + 1];
                break;
              }
            }

            // Interpolation (Assume number for now)
            if (typeof kf1.v === 'number' && typeof kf2.v === 'number') {
              if (kf1.easing === 'hold') {
                // Step / hold interpolation: keep the outgoing keyframe value
                interpolatedParams[paramId as keyof typeof interpolatedParams] = kf1.v as never;
              } else if (kf2.f === kf1.f) {
                 interpolatedParams[paramId as keyof typeof interpolatedParams] = kf1.v as never;
              } else {
                 // Default to linear; 'custom' easing is treated as linear for now
                 const progress = (currentFrame - kf1.f) / (kf2.f - kf1.f);
                 const interpolatedValue = kf1.v + (kf2.v - kf1.v) * progress;
                 interpolatedParams[paramId as keyof typeof interpolatedParams] = interpolatedValue as never;
              }
            } else {
              // Fallback to hold interpolation for non-numbers (strings, booleans)
              interpolatedParams[paramId as keyof typeof interpolatedParams] = kf1.v as never;
            }
          }
          
          // Combine with global adjustments if not an adjustment layer itself
          if (clip.kind !== 'adjustmentLayer') {
            interpolatedParams['color.brightness'] = ((interpolatedParams['color.brightness'] as number) || 0) + globalAdjustments.brightness;
            interpolatedParams['color.contrast'] = ((interpolatedParams['color.contrast'] as number) || 0) + globalAdjustments.contrast;
            interpolatedParams['color.saturation'] = ((interpolatedParams['color.saturation'] as number) || 0) + globalAdjustments.saturation;
          }

          if (clip.kind !== 'adjustmentLayer' && clip.kind !== 'transition') {
            // Compute the media's local time (seconds)
            const globalSpeed = (interpolatedParams['speed.multiplier'] as number) || 1;
            const trimStartSec = Math.max(0, Number(interpolatedParams['source.trimStart'] ?? 0) || 0);
            const trimEndValue = Number(interpolatedParams['source.trimEnd'] ?? 0) || 0;
            const trimEndSec = trimEndValue > trimStartSec ? trimEndValue : 0;
            const elapsedFrames = currentFrame - clip.startFrame;
            
            // Speed Curve Time Remapping
            let localTime = 0;
            let currentInstantSpeed = globalSpeed;
            interface SpeedCurve { points?: { t: number; speed: number }[] }
            const curveParam = interpolatedParams['speed.curve'] as SpeedCurve | undefined;
            
            if (curveParam && curveParam.points && curveParam.points.length > 0) {
              const points = curveParam.points as { t: number, speed: number }[];
              const totalFrames = clip.durationFrames;
              const normalizedElapsed = elapsedFrames / totalFrames;

              const getSpeedAt = (t: number): number => {
                if (points.length === 1) return points[0].speed;
                if (t <= points[0].t) return points[0].speed;
                if (t >= points[points.length - 1].t) return points[points.length - 1].speed;
                for (let i = 0; i < points.length - 1; i++) {
                  if (t >= points[i].t && t <= points[i + 1].t) {
                    const progress = (t - points[i].t) / (points[i + 1].t - points[i].t);
                    return points[i].speed + (points[i + 1].speed - points[i].speed) * progress;
                  }
                }
                return points[points.length - 1].speed;
              };

              currentInstantSpeed = getSpeedAt(normalizedElapsed) * globalSpeed;

              const segments: { t0: number; t1: number }[] = [];
              let prevBound = 0;
              for (const p of points) {
                if (p.t > prevBound && p.t < normalizedElapsed) {
                  segments.push({ t0: prevBound, t1: p.t });
                  prevBound = p.t;
                }
              }
              if (prevBound < normalizedElapsed) {
                segments.push({ t0: prevBound, t1: normalizedElapsed });
              }

              for (const seg of segments) {
                const s0 = getSpeedAt(seg.t0);
                const s1 = getSpeedAt(seg.t1);
                const dt = (seg.t1 - seg.t0) * totalFrames / state.fps;
                localTime += dt * (s0 + s1) / 2;
              }
            } else {
              localTime = (elapsedFrames / state.fps) * globalSpeed;
            }

            let sourceLocalTime = trimStartSec + localTime;
            if (trimEndSec > trimStartSec) {
              sourceLocalTime = Math.min(sourceLocalTime, trimEndSec);
            }
            sourceLocalTime = Math.max(0, sourceLocalTime);

            const totalDurationSecs = clip.durationFrames / state.fps;

            // Handle Text Animations
            if (clip.kind === 'text') {
              const animIn = interpolatedParams['text.animIn'] as string || 'none';
              const animInDuration = interpolatedParams['text.animInDuration'] as number || 0;
              const animOut = interpolatedParams['text.animOut'] as string || 'none';
              const animOutDuration = interpolatedParams['text.animOutDuration'] as number || 0;

              // Deterministic pseudo-random for glitch/flicker effects
              const frameSeed = currentFrame * 2654435761;

              // In Animation
              const animInSec = animInDuration / state.fps;
              if (animIn !== 'none' && localTime < animInSec && animInSec > 0) {
                const progress = localTime / animInSec; // 0→1

                const applyAnimIn = (name: string) => {
                  switch (name) {
                    case 'fade':
                      interpolatedParams['transform.opacity'] = progress * 100;
                      break;
                    case 'pop':
                      interpolatedParams['transform.scale'] = Math.min(1, progress * 1.2) * 100;
                      interpolatedParams['transform.opacity'] = progress * 100;
                      break;
                    case 'slideUp':
                      interpolatedParams['transform.posY'] = ((interpolatedParams['transform.posY'] as number) || 0) + 500 * (1 - progress);
                      interpolatedParams['transform.opacity'] = progress * 100;
                      break;
                    case 'slideRight':
                      interpolatedParams['transform.posX'] = ((interpolatedParams['transform.posX'] as number) || 0) - 500 * (1 - progress);
                      interpolatedParams['transform.opacity'] = progress * 100;
                      break;
                    case 'bounce': {
                      const bounceVal = 1 - Math.abs(Math.sin(progress * Math.PI * 4)) * (1 - progress) * 0.6;
                      interpolatedParams['transform.scale'] = bounceVal * 100;
                      interpolatedParams['transform.opacity'] = Math.min(1, progress * 2) * 100;
                      break;
                    }
                    case 'zoomIn':
                      interpolatedParams['transform.scale'] = progress * 100;
                      interpolatedParams['transform.opacity'] = progress * 100;
                      break;
                    case 'shake': {
                      const shakeAmt = (1 - progress) * 8;
                      const shakeX = ((frameSeed * 7 + currentFrame * 13) % 1000) / 1000 * shakeAmt;
                      interpolatedParams['transform.posX'] = ((interpolatedParams['transform.posX'] as number) || 0) + shakeX;
                      interpolatedParams['transform.opacity'] = progress * 100;
                      break;
                    }
                    case 'glitch': {
                      const glitchX = (progress < 0.95 ? (((frameSeed * 3 + currentFrame * 17) % 20) - 10) * (1 - progress) : 0);
                      const glitchY = (progress < 0.95 ? (((frameSeed * 5 + currentFrame * 11) % 15) - 7) * (1 - progress) : 0);
                      const rShift = ((currentFrame % 2 === 0) ? ((frameSeed % 8) - 4) * (1 - progress) : 0);
                      interpolatedParams['transform.posX'] = ((interpolatedParams['transform.posX'] as number) || 0) + glitchX + rShift;
                      interpolatedParams['transform.posY'] = ((interpolatedParams['transform.posY'] as number) || 0) + glitchY;
                      interpolatedParams['transform.opacity'] = ((currentFrame % 3 === 0 ? 30 : 100)) * Math.min(1, progress * 3);
                      break;
                    }
                    case 'flicker': {
                      const flickerOn = ((currentFrame + Math.floor(frameSeed % 5)) % 4) !== 0;
                      interpolatedParams['transform.opacity'] = (flickerOn ? 100 : 20) * Math.min(1, progress * 3);
                      break;
                    }
                    case 'typewriter': {
                      (interpolatedParams as Record<string, number>)['_typewriterProgress'] = progress;
                      // Per-character stagger: each char fades in 0→1 based on position
                      const charStagger = (interpolatedParams['text.charStagger'] as number) || 0.05;
                      (interpolatedParams as Record<string, number>)['_charStaggerActive'] = 1;
                      (interpolatedParams as Record<string, number>)['_charStaggerAmount'] = charStagger;
                      break;
                    }
                  }
                };
                applyAnimIn(animIn);
              } else if (animIn !== 'none' && animInSec > 0) {
                // Animation completed — ensure final state
                if (animIn !== 'typewriter') {
                  if (animIn !== 'glitch' && animIn !== 'flicker' && animIn !== 'shake') {
                    interpolatedParams['transform.opacity'] = 100;
                  }
                }
              }

              // Out Animation
              const animOutSec = animOutDuration / state.fps;
              if (animOut !== 'none' && localTime > (totalDurationSecs - animOutSec) && animOutSec > 0) {
                const timeInOutPhase = localTime - (totalDurationSecs - animOutSec);
                const progress = timeInOutPhase / animOutSec; // 0→1

                switch (animOut) {
                  case 'fade':
                    interpolatedParams['transform.opacity'] = (1 - progress) * 100;
                    break;
                  case 'popOut':
                    interpolatedParams['transform.scale'] = (1 - progress) * 100;
                    interpolatedParams['transform.opacity'] = (1 - progress) * 100;
                    break;
                  case 'slideDown':
                    interpolatedParams['transform.posY'] = ((interpolatedParams['transform.posY'] as number) || 0) + 500 * progress;
                    interpolatedParams['transform.opacity'] = (1 - progress) * 100;
                    break;
                  case 'slideLeft':
                    interpolatedParams['transform.posX'] = ((interpolatedParams['transform.posX'] as number) || 0) - 500 * progress;
                    interpolatedParams['transform.opacity'] = (1 - progress) * 100;
                    break;
                  case 'bounceOut': {
                    const bounceVal = 1 - Math.abs(Math.sin(progress * Math.PI * 4)) * progress * 0.6;
                    interpolatedParams['transform.scale'] = bounceVal * 100;
                    interpolatedParams['transform.opacity'] = (1 - progress) * 100;
                    break;
                  }
                  case 'zoomOut':
                    interpolatedParams['transform.scale'] = (1 - progress) * 100;
                    interpolatedParams['transform.opacity'] = (1 - progress) * 100;
                    break;
                  case 'glitchOut': {
                    const goX = ((frameSeed * 3 + currentFrame * 17) % 20 - 10) * progress * 2;
                    const goY = ((frameSeed * 5 + currentFrame * 11) % 15 - 7) * progress * 2;
                    interpolatedParams['transform.posX'] = ((interpolatedParams['transform.posX'] as number) || 0) + goX;
                    interpolatedParams['transform.posY'] = ((interpolatedParams['transform.posY'] as number) || 0) + goY;
                    interpolatedParams['transform.opacity'] = ((currentFrame % 2 === 0 ? 100 : 0)) * (1 - progress);
                    break;
                  }
                }
              }
            }

            // Fetch the asset to get the blob URL
            const asset = state.assets.find(a => a.id === clip.sourceId);

            evaluated.push({
              id: clip.id,
              kind: clip.kind,
              uniforms: {
                ...interpolatedParams,
                _sourceId: clip.sourceId as string,
                _sourceUrl: asset?.url as string | undefined,
                _localTime: sourceLocalTime,
                _instantSpeed: currentInstantSpeed,
                _isPlaying: (state as { isPlaying: boolean }).isPlaying
              }
            });
          }

          if (clip.kind === 'transition') {
            // Calculate progress 0 to 1 based on current frame vs clip bounds
            const progress = (currentFrame - clip.startFrame) / clip.durationFrames;
            interpolatedParams['transition.progress'] = progress * 100;
            
            evaluated.push({
              id: clip.id,
              kind: clip.kind,
              uniforms: interpolatedParams
            });
          }
        }
      }
    }

    return evaluated;
  }
}
