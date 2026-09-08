import type { AudioGenerationParams } from '@/types/ai-models';

export const DEFAULT_AUDIO_TTS_PROVIDER: AudioGenerationParams['modelProvider'] = 'stepfun';
export const DEFAULT_AUDIO_TTS_MODEL_ID = 'stepaudio-2.5-tts';
export const DEFAULT_AUDIO_TTS_VOICE_ID = 'cixingnansheng';
export const DEFAULT_AUDIO_TTS_LABEL = 'StepFun-stepaudio-2.5-tts';

export const DEFAULT_AUDIO_MUSIC_PROVIDER: AudioGenerationParams['modelProvider'] = 'minimax';
export const DEFAULT_AUDIO_MUSIC_MODEL_ID = 'music-2.6';
