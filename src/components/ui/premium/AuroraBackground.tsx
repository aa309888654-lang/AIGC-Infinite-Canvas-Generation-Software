import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children: React.ReactNode;
  showRadialGradient?: boolean;
  auroraColors?: string[];
}

export function AuroraBackground({
  className,
  children,
  showRadialGradient = true,
  auroraColors = ['#3B82F6', '#1D4ED8', '#6366F1', '#8B5CF6'],
  ...props
}: AuroraBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      time += 0.003;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw multiple aurora layers
      auroraColors.forEach((color, i) => {
        ctx.beginPath();
        ctx.moveTo(0, canvas.height);

        const baseY = canvas.height * (0.3 + i * 0.08);
        const amplitude = 80 + i * 30;
        const frequency = 0.002 + i * 0.0005;
        const speed = time * (0.8 + i * 0.3);

        for (let x = 0; x <= canvas.width; x += 2) {
          const y = baseY +
            Math.sin(x * frequency + speed) * amplitude +
            Math.sin(x * frequency * 1.5 + speed * 0.7) * (amplitude * 0.5) +
            Math.cos(x * frequency * 0.5 + speed * 1.3) * (amplitude * 0.3);
          ctx.lineTo(x, y);
        }

        ctx.lineTo(canvas.width, canvas.height);
        ctx.closePath();

        // Create gradient fill
        const gradient = ctx.createLinearGradient(0, baseY - amplitude, 0, canvas.height);
        gradient.addColorStop(0, color + '40'); // 25% opacity
        gradient.addColorStop(0.3, color + '15'); // 8% opacity
        gradient.addColorStop(0.7, color + '05'); // 2% opacity
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, [auroraColors]);

  return (
    <div className={cn('relative overflow-hidden bg-black', className)} {...props}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0"
        style={{ opacity: 0.6 }}
      />
      {showRadialGradient && (
        <div
          className="absolute inset-0 z-[1]"
          style={{
            background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.7) 100%)',
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
