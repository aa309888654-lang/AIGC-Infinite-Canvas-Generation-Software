export const FLOATING_PARTICLE_COUNT = 200;

export const FLOATING_PARTICLE_ANIMS = [
  'up',
  'down',
  'left',
  'right',
  'up-left',
  'up-right',
  'down-left',
  'down-right',
] as const;

export const FLOATING_PARTICLE_COLORS = [
  '#A7F3D0',
  '#a78bfa',
  '#67e8f9',
  '#c4b5fd',
  'rgba(255,255,255,0.85)',
];

export type FloatingParticleAnim = (typeof FLOATING_PARTICLE_ANIMS)[number];

export interface FloatingParticleSpec {
  id: number;
  left: string;
  top: string;
  size: number;
  delay: number;
  duration: number;
  color: string;
  anim: FloatingParticleAnim;
  glow: boolean;
}

function seededRand(seed: number) {
  const n = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return n - Math.floor(n);
}

export function buildFloatingParticles(count = FLOATING_PARTICLE_COUNT): FloatingParticleSpec[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${seededRand(i + 1) * 100}%`,
    top: `${seededRand(i + 1000) * 100}%`,
    size: 1 + Math.floor(seededRand(i + 2000) * 2),
    delay: seededRand(i + 3000) * 16,
    duration: 8 + seededRand(i + 4000) * 12,
    color: FLOATING_PARTICLE_COLORS[i % FLOATING_PARTICLE_COLORS.length],
    anim: FLOATING_PARTICLE_ANIMS[i % FLOATING_PARTICLE_ANIMS.length],
    glow: i % 5 === 0,
  }));
}
