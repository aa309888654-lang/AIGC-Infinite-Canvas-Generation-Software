export type SpeedType = 'constant' | 'variable';

export interface SpeedKeyframe {
  id: string;
  time: number;
  speed: number;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bezier';
  bezierHandles?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

export interface SpeedControl {
  type: SpeedType;
  constantSpeed: number;
  variableKeyframes?: SpeedKeyframe[];
  preservePitch: boolean;
  reversePlayback: boolean;
}

export const SPEED_PRESETS = [
  { label: '0.25x', speed: 0.25, icon: '🐢' },
  { label: '0.5x', speed: 0.5, icon: '🚶' },
  { label: '0.75x', speed: 0.75, icon: '🚶‍♂️' },
  { label: '1x', speed: 1, icon: '🏃' },
  { label: '1.5x', speed: 1.5, icon: '🏎️' },
  { label: '2x', speed: 2, icon: '🚗' },
  { label: '4x', speed: 4, icon: '✈️' },
  { label: '8x', speed: 8, icon: '🚀' },
  { label: '16x', speed: 16, icon: '🛸' },
  { label: '-1x', speed: -1, icon: '⏪' },
  { label: '-2x', speed: -2, icon: '⏮️' },
];

export function createDefaultSpeedControl(): SpeedControl {
  return {
    type: 'constant',
    constantSpeed: 1,
    preservePitch: true,
    reversePlayback: false,
  };
}

export function createSpeedKeyframe(time: number, speed: number): SpeedKeyframe {
  return {
    id: `speed-kf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    time,
    speed,
    easing: 'ease-in-out',
  };
}

export function interpolateSpeed(keyframes: SpeedKeyframe[], time: number): number {
  if (keyframes.length === 0) return 1;
  if (keyframes.length === 1) return keyframes[0].speed;

  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  
  if (time <= sorted[0].time) return sorted[0].speed;
  if (time >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].speed;

  let prevKf = sorted[0];
  let nextKf = sorted[1];

  for (let i = 1; i < sorted.length; i++) {
    if (time >= sorted[i - 1].time && time <= sorted[i].time) {
      prevKf = sorted[i - 1];
      nextKf = sorted[i];
      break;
    }
  }

  const progress = (time - prevKf.time) / (nextKf.time - prevKf.time);
  const easedProgress = applyEasing(progress, nextKf.easing);
  
  return prevKf.speed + (nextKf.speed - prevKf.speed) * easedProgress;
}

function applyEasing(t: number, easing: string): number {
  switch (easing) {
    case 'linear':
      return t;
    case 'ease-in':
      return t * t;
    case 'ease-out':
      return t * (2 - t);
    case 'ease-in-out':
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    case 'bezier':
      return t;
    default:
      return t;
  }
}

export function calculateDuration(speedControl: SpeedControl, sourceDuration: number): number {
  if (speedControl.type === 'constant') {
    return sourceDuration / Math.abs(speedControl.constantSpeed);
  }

  if (speedControl.type === 'variable' && speedControl.variableKeyframes) {
    const avgSpeed = calculateAverageSpeed(speedControl.variableKeyframes);
    return sourceDuration / avgSpeed;
  }

  return sourceDuration;
}

function calculateAverageSpeed(keyframes: SpeedKeyframe[]): number {
  if (keyframes.length === 0) return 1;
  
  const speeds = keyframes.map(kf => kf.speed);
  const sum = speeds.reduce((acc, speed) => acc + Math.abs(speed), 0);
  return sum / speeds.length;
}

export function generateSpeedCurvePath(keyframes: SpeedKeyframe[], width: number, height: number): string {
  if (keyframes.length === 0) {
    return `M 0 ${height / 2} L ${width} ${height / 2}`;
  }

  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  const maxTime = Math.max(...sorted.map(kf => kf.time));
  const maxSpeed = Math.max(...sorted.map(kf => Math.abs(kf.speed)));
  
  const points: string[] = [];
  
  sorted.forEach((kf, index) => {
    const x = (kf.time / maxTime) * width;
    const y = height - (Math.abs(kf.speed) / maxSpeed) * height;
    
    if (index === 0) {
      points.push(`M ${x} ${y}`);
    } else {
      points.push(`L ${x} ${y}`);
    }
  });

  return points.join(' ');
}
