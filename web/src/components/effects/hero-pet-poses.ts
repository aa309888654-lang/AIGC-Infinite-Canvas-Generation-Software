export type HeroPetSheet =
  | 'base'
  | 'standing'
  | 'prone'
  | 'turn'
  | 'wave'
  | 'emotions'
  | 'rest'
  | 'daily'
  | 'social';

export type HeroPetMotion = 'breathe' | 'bounce' | 'sway' | 'turn' | 'rest' | 'celebrate';

export interface HeroPetPoseDefinition {
  sheet: HeroPetSheet;
  frame: 0 | 1 | 2 | 3;
  duration: number;
  motion: HeroPetMotion;
}

export const HERO_PET_POSES = {
  sitting: { sheet: 'base', frame: 0, duration: 2400, motion: 'breathe' },
  standUp: { sheet: 'standing', frame: 1, duration: 620, motion: 'bounce' },
  standing: { sheet: 'standing', frame: 2, duration: 1200, motion: 'breathe' },
  proudStanding: { sheet: 'standing', frame: 3, duration: 1100, motion: 'sway' },
  lieDown: { sheet: 'prone', frame: 1, duration: 720, motion: 'rest' },
  prone: { sheet: 'prone', frame: 2, duration: 1900, motion: 'rest' },
  proneAlert: { sheet: 'prone', frame: 3, duration: 1000, motion: 'breathe' },
  turnLeft: { sheet: 'turn', frame: 1, duration: 520, motion: 'turn' },
  turnBack: { sheet: 'turn', frame: 2, duration: 620, motion: 'turn' },
  turnRight: { sheet: 'turn', frame: 3, duration: 520, motion: 'turn' },
  waveReady: { sheet: 'wave', frame: 0, duration: 480, motion: 'sway' },
  waveHigh: { sheet: 'wave', frame: 1, duration: 520, motion: 'celebrate' },
  waveHello: { sheet: 'wave', frame: 2, duration: 520, motion: 'celebrate' },
  waveFinish: { sheet: 'wave', frame: 3, duration: 680, motion: 'sway' },
  happy: { sheet: 'emotions', frame: 0, duration: 1500, motion: 'bounce' },
  cute: { sheet: 'emotions', frame: 1, duration: 1600, motion: 'sway' },
  joyful: { sheet: 'emotions', frame: 2, duration: 1200, motion: 'celebrate' },
  excited: { sheet: 'emotions', frame: 3, duration: 1200, motion: 'celebrate' },
  sleepy: { sheet: 'rest', frame: 0, duration: 1500, motion: 'rest' },
  sleeping: { sheet: 'rest', frame: 1, duration: 2800, motion: 'rest' },
  waking: { sheet: 'rest', frame: 2, duration: 1000, motion: 'breathe' },
  stretching: { sheet: 'rest', frame: 3, duration: 1300, motion: 'sway' },
  eating: { sheet: 'daily', frame: 0, duration: 1800, motion: 'bounce' },
  drinking: { sheet: 'daily', frame: 1, duration: 1700, motion: 'breathe' },
  bathing: { sheet: 'daily', frame: 2, duration: 1900, motion: 'sway' },
  grooming: { sheet: 'daily', frame: 3, duration: 1800, motion: 'sway' },
  dancing: { sheet: 'social', frame: 0, duration: 1400, motion: 'celebrate' },
  playing: { sheet: 'social', frame: 1, duration: 1500, motion: 'bounce' },
  curious: { sheet: 'social', frame: 2, duration: 1700, motion: 'sway' },
  heartHug: { sheet: 'social', frame: 3, duration: 1700, motion: 'breathe' },
} as const satisfies Record<string, HeroPetPoseDefinition>;

export type HeroPetPose = keyof typeof HERO_PET_POSES;

export const HERO_PET_IDLE_CLIPS: readonly (readonly HeroPetPose[])[] = [
  ['waveReady', 'waveHigh', 'waveHello', 'waveFinish'],
  ['standUp', 'standing', 'proudStanding'],
  ['turnLeft', 'turnBack', 'turnRight'],
  ['lieDown', 'prone', 'proneAlert'],
  ['happy', 'cute', 'joyful', 'excited'],
  ['sleepy', 'sleeping', 'waking', 'stretching'],
  ['eating', 'drinking'],
  ['bathing', 'grooming'],
  ['curious', 'playing', 'dancing', 'heartHug'],
];
