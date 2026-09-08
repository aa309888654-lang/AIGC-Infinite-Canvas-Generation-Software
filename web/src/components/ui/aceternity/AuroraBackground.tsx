import React, { useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface AuroraBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  showRadialGradient?: boolean;
  /**
   * Aurora colors - default: teal, cyan, indigo
   */
  auroraColors?: string[];
  /**
   * Animation speed multiplier
   */
  speed?: number;
  /**
   * Opacity of the aurora effect (0-1)
   */
  opacity?: number;
}

/**
 * AuroraBackground - Canvas-based aurora/northern lights background
 * Creates smooth, animated aurora effect with multiple color layers
 */
export function AuroraBackground({
  className,
  children,
  showRadialGradient = true,
  auroraColors = ['#3B82F6', '#1D4ED8', '#6366F1'],
  speed = 1,
  opacity = 0.6,
  ...props
}: AuroraBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  // Parse hex color to rgba with alpha
  const hexToRgba = useCallback((hex: string, alpha: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      timeRef.current += 0.003 * speed;
      const time = timeRef.current;

      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      ctx.clearRect(0, 0, width, height);

      // Draw multiple aurora layers with different wave patterns
      auroraColors.forEach((color, i) => {
        ctx.beginPath();
        ctx.moveTo(0, height);

        // Each layer has different wave characteristics
        const baseY = height * (0.25 + i * 0.1);
        const amplitude = 60 + i * 25;
        const frequency = 0.002 + i * 0.0004;
        const layerSpeed = time * (0.6 + i * 0.25);

        // Generate smooth wave path
        for (let x = 0; x <= width; x += 3) {
          // Combine multiple sine waves for organic movement
          const y = baseY +
            Math.sin(x * frequency + layerSpeed) * amplitude +
            Math.sin(x * frequency * 1.3 + layerSpeed * 0.8) * (amplitude * 0.4) +
            Math.cos(x * frequency * 0.6 + layerSpeed * 1.2) * (amplitude * 0.25);
          ctx.lineTo(x, y);
        }

        ctx.lineTo(width, height);
        ctx.closePath();

        // Create vertical gradient fill for aurora effect
        const gradient = ctx.createLinearGradient(0, baseY - amplitude, 0, height);
        gradient.addColorStop(0, hexToRgba(color, 0.25));
        gradient.addColorStop(0.2, hexToRgba(color, 0.15));
        gradient.addColorStop(0.5, hexToRgba(color, 0.08));
        gradient.addColorStop(0.8, hexToRgba(color, 0.03));
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [auroraColors, speed, hexToRgba]);

  return (
    <div
      className={cn('relative overflow-hidden bg-black', className)}
      {...props}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0 h-full w-full"
        style={{ opacity }}
      />
      {showRadialGradient && (
        <div
          className="absolute inset-0 z-[1]"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% 50%, transparent 30%, rgba(0,0,0,0.6) 100%)',
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
