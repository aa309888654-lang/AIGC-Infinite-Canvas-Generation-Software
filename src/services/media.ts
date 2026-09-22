export { ffmpegProcessor } from './ffmpeg-processor';
export type { 
  VideoMetadata, 
  TrimOptions, 
  ExportOptions, 
  ProgressCallback 
} from './ffmpeg-processor';

export { vocalSeparationService } from './vocal-separation-service';
export type { 
  SeparationResult, 
  SeparationOptions 
} from './vocal-separation-service';

export { subtitleRecognitionService } from './subtitle-recognition-service';
export type { 
  SubtitleCue, 
  SubtitleTrack, 
  RecognitionOptions 
} from './subtitle-recognition-service';

export { multiTrackTimelineService } from './multi-track-timeline-service';
export type { 
  TimelineClip, 
  TimelineTrack, 
  TimelineMarker, 
  TimelineProject, 
  ProjectSettings, 
  TimelineState,
  ClipEffect
} from './multi-track-timeline-service';

export { aiScriptGeneratorService } from './ai-script-generator-service';
export type { 
  ScriptScene, 
  ScriptSection, 
  GeneratedScript, 
  ScriptGenerationOptions 
} from './ai-script-generator-service';

export { intelligentClippingService } from './intelligent-clipping-service';
export type { 
  VideoSegment, 
  SegmentFeatures, 
  TransitionRecommendation, 
  ClipPlan, 
  ClipSegment, 
  Transition, 
  TransitionType,
  SegmentEffect,
  SceneAnalysis,
  Scene
} from './intelligent-clipping-service';

export { beatSyncService } from './beat-sync-service';
export type { 
  Beat, 
  Bar, 
  TempoSection, 
  BeatSyncResult, 
  SyncPoint, 
  SyncPlan, 
  SyncTransition 
} from './beat-sync-service';

export { maskService } from './mask-service';
export type { 
  MaskType, 
  MaskPoint, 
  Mask, 
  MaskKeyframe, 
  MaskLayer, 
  MaskPreset,
  MaskFeather,
  MaskBlend 
} from './mask-service';

export { aiSoundEffectsService } from './ai-sound-effects-service';
export type { 
  SoundCategory,
  Mood,
  SoundEffect,
  SoundMatchResult,
  AudioScene,
  SoundTransition
} from './ai-sound-effects-service';

export { colorGradingService } from './color-grading-service';
export type { 
  ColorCorrection,
  HSLAdjustment,
  CurvePoint,
  ColorCurve,
  ColorPreset,
  ColorGradeLayer,
  BlendMode,
  VignetteSettings,
  ColorGradeSettings
} from './color-grading-service';

export { lutService } from './lut-service';
export type { 
  LUTFormat,
  LUTColorSpace,
  LUTMetadata,
  LUT,
  LUTPreset,
  LUTApplicationSettings
} from './lut-service';
