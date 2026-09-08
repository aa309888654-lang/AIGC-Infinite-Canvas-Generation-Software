import type { GridDirectorParams } from '@/components/canvas/nodes/grid-director-core';
import type { StoryboardPlanV2 } from '@/components/canvas/nodes/storyboard-plan-v2';

export interface StoryboardContinuityValidationWarning {
  id: string;
  severity: 'info' | 'warning' | 'error';
  frameIndex?: number;
  message: string;
  suggestion?: string;
}

function parsePixels(size: string): number | null {
  const match = size.match(/^(\d+)x(\d+)$/);
  if (!match) return null;
  return Number(match[1]) * Number(match[2]);
}

export function validateStoryboardPlanContinuity(
  plan: StoryboardPlanV2,
  params?: Partial<GridDirectorParams>,
): StoryboardContinuityValidationWarning[] {
  const warnings: StoryboardContinuityValidationWarning[] = [];
  const characterElements = plan.elements.filter((element) => element.type === 'character');
  const lockedCharacterRefs = characterElements.filter((element) => element.locked && element.referenceImageUrl);

  plan.shots.forEach((shot) => {
    if (!shot.beat || !shot.shotType || !shot.cameraAngle || !shot.emotionalBeat) {
      warnings.push({
        id: `shot-required-${shot.id}`,
        severity: 'error',
        frameIndex: shot.index,
        message: `镜头 ${shot.index + 1} 缺少必要分镜字段`,
        suggestion: '补齐 beat、景别、机位和情绪字段后再生成。',
      });
    }

    if (shot.references.characterIds?.length && lockedCharacterRefs.length === 0 && !params?.characterRef && !params?.reference) {
      warnings.push({
        id: `shot-character-ref-${shot.id}`,
        severity: 'warning',
        frameIndex: shot.index,
        message: `镜头 ${shot.index + 1} 有角色引用但未绑定锁定参考图`,
        suggestion: '连接角色库或参考图，可降低跨帧脸部/服装漂移。',
      });
    }

    const prevShot = plan.shots[shot.index - 1];
    if (prevShot?.continuity.requiredProps?.length) {
      const currentProps = new Set(shot.continuity.requiredProps || []);
      const dropped = prevShot.continuity.requiredProps.filter((prop) => !currentProps.has(prop));
      if (dropped.length > 0) {
        warnings.push({
          id: `shot-props-${shot.id}`,
          severity: 'info',
          frameIndex: shot.index,
          message: `镜头 ${shot.index + 1} 可能丢失上一镜头道具：${dropped.join('、')}`,
          suggestion: '如道具需连续出现，把它加入当前镜头 requiredProps。',
        });
      }
    }
  });

  if (plan.project.aspectRatio !== 'auto' && params?.size && params.size !== 'auto') {
    const sizeAspect = plan.project.aspectRatio;
    if (sizeAspect && !['auto', String(params.size)].includes(sizeAspect)) {
      warnings.push({
        id: 'aspect-ratio-check',
        severity: 'info',
        message: `项目比例为 ${sizeAspect}，输出尺寸为 ${params.size}`,
        suggestion: '确认画幅与目标平台一致，例如短视频使用 9:16。',
      });
    }
  }

  const size = String(params?.size || plan.generation.size || 'auto');
  const pixels = parsePixels(size);
  const isHighCost =
    (pixels !== null && pixels > 2560 * 1440) ||
    params?.quality === 'high' ||
    (params?.maxReferenceImages || 0) > 4 ||
    plan.shots.length >= 24;
  if (isHighCost) {
    warnings.push({
      id: 'cost-latency',
      severity: 'warning',
      message: '当前设置可能带来较高成本或延迟',
      suggestion: '大量分镜建议先用 medium/低分辨率出草稿，定稿帧再切 high 或 4K。',
    });
  }

  if (String(params?.gptBackground || '') === 'transparent') {
    warnings.push({
      id: 'transparent-background',
      severity: 'error',
      message: '豆包 Seedream 5.0 Pro 官方不支持透明背景',
      suggestion: '请使用 opaque/auto，或切换到明确支持透明背景的 provider。',
    });
  }

  return warnings;
}
