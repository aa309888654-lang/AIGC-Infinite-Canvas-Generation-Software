/**
 * timeline-plan-service — 时间轴计划服务（存根）
 *
 * AI剪辑板块已移除，此文件保留空实现以维持编译兼容。
 */

export type CreativeMood = 'energetic' | 'calm' | 'dramatic' | 'playful' | 'romantic' | 'mysterious' | 'epic' | 'melancholic' | 'upbeat' | 'neutral' | 'cinematic' | 'clean' | 'product' | 'dynamic' | 'cyberpunk' | 'warm';

export interface TimelinePlan {
  id: string;
  title: string;
  duration: number;
  mood: CreativeMood;
  scenes: any[];
  actions: TimelinePlanAction[];
  source?: string;
  [key: string]: any;
}

export type ClipKind = 'video' | 'audio' | 'image' | 'text' | 'sticker' | 'effect' | string;

export interface TimelinePlanOptions {
  duration?: number;
  mood?: CreativeMood;
  style?: string;
  [key: string]: any;
}

export interface TimelinePlanActionBase {
  type: Exclude<string, 'update-param' | 'add-marker' | 'add-clip' | 'update-clip-duration'>;
  id: string;
  clipId?: string;
  [key: string]: any;
}

export interface AddClipAction extends TimelinePlanActionBase {
  type: 'add-clip';
  trackType: string;
  kind: string;
  startFrame: number;
  durationFrames: number;
  name: string;
  sourceId?: string;
}

export interface AddMarkerAction extends TimelinePlanActionBase {
  type: 'add-marker';
  frame: number;
  label: string;
  color: string;
}

export interface UpdateClipDurationAction extends TimelinePlanActionBase {
  type: 'update-clip-duration';
  clipId: string;
  startFrame: number;
  durationFrames: number;
}

export interface UpdateParamAction extends TimelinePlanActionBase {
  type: 'update-param';
  clipId: string;
  paramId: string;
  value: any;
}

export type TimelinePlanAction = UpdateParamAction | AddMarkerAction | AddClipAction | UpdateClipDurationAction | TimelinePlanActionBase;

export interface CreativeEffectPlanOptions {
  effectType?: string;
  intensity?: number;
  [key: string]: any;
}

export interface CreativeLUTPlanOptions {
  lutName?: string;
  intensity?: number;
  [key: string]: any;
}

export interface CreativeStickerPlanOptions {
  stickerType?: string;
  position?: { x: number; y: number };
  [key: string]: any;
}

export interface CreativeTextPlanOptions {
  text?: string;
  fontSize?: number;
  position?: { x: number; y: number };
  [key: string]: any;
}

/** 创建时间轴计划 — 返回空计划 */
export async function createTimelinePlan(_options?: TimelinePlanOptions): Promise<TimelinePlan> {
  return {
    id: '',
    title: '',
    duration: 0,
    mood: 'neutral',
    scenes: [],
    actions: [],
  };
}

/** 获取时间轴计划 — 返回 null */
export async function getTimelinePlan(_id: string): Promise<TimelinePlan | null> {
  return null;
}

/** 时间轴计划服务实例 */
export const timelinePlanService = {
  createPlan: createTimelinePlan,
  getPlan: getTimelinePlan,
  createLUTPlan: async (_options?: CreativeLUTPlanOptions, _report?: any): Promise<TimelinePlan> => ({
    id: '', title: '', duration: 0, mood: 'neutral', scenes: [], actions: [],
  }),
  createEffectPlan: async (_options?: CreativeEffectPlanOptions, _report?: any): Promise<TimelinePlan> => ({
    id: '', title: '', duration: 0, mood: 'neutral', scenes: [], actions: [],
  }),
  createStickerPlan: async (_options?: CreativeStickerPlanOptions, _report?: any): Promise<TimelinePlan> => ({
    id: '', title: '', duration: 0, mood: 'neutral', scenes: [], actions: [],
  }),
  createTextPlan: async (_options?: CreativeTextPlanOptions, _report?: any): Promise<TimelinePlan> => ({
    id: '', title: '', duration: 0, mood: 'neutral', scenes: [], actions: [],
  }),
  createTransitionPlan: async (_options?: any, _report?: any): Promise<TimelinePlan> => ({
    id: '', title: '', duration: 0, mood: 'neutral', scenes: [], actions: [],
  }),
  createAudioCleanupPlan: async (_report?: any): Promise<TimelinePlan> => ({
    id: '', title: '', duration: 0, mood: 'neutral', scenes: [], actions: [],
  }),
  createStabilizationPlan: async (_report?: any): Promise<TimelinePlan> => ({
    id: '', title: '', duration: 0, mood: 'neutral', scenes: [], actions: [],
  }),
};