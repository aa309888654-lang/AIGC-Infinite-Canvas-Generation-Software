import { useMemo } from 'react';
import { buildFloatingParticles, FLOATING_PARTICLE_COUNT } from './floating-particles-shared';

interface FloatingParticlesProps {
  containerClassName: string;
  particleClassName: string;
  count?: number;
}

export default function FloatingParticles({
  containerClassName,
  particleClassName,
  count = FLOATING_PARTICLE_COUNT,
}: FloatingParticlesProps) {
  const particles = useMemo(() => buildFloatingParticles(count), [count]);

  return (
    <div className={containerClassName} aria-hidden>
      {particles.map((p) => (
        <span
          key={p.id}
          className={`${particleClassName} ${particleClassName}--${p.anim}${p.glow ? ` ${particleClassName}--glow` : ''}`}
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
