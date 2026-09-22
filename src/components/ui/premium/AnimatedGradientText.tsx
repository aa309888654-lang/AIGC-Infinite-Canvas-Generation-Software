import React from 'react';
import { cn } from '@/lib/utils';

interface AnimatedGradientTextProps {
  children: React.ReactNode;
  className?: string;
  speed?: number;
  colorFrom?: string;
  colorVia?: string;
  colorTo?: string;
}

export function AnimatedGradientText({
  children,
  className,
  speed = 2,
  colorFrom = '#3B82F6',
  colorVia = '#1D4ED8',
  colorTo = '#6366F1',
}: AnimatedGradientTextProps) {
  return (
    <span
      className={cn(
        'inline-block animate-gradient-x bg-clip-text text-transparent',
        className
      )}
      style={{
        backgroundImage: `linear-gradient(90deg, ${colorFrom}, ${colorVia}, ${colorTo}, ${colorFrom})`,
        backgroundSize: '300% 100%',
        animationDuration: `${speed}s`,
      }}
    >
      {children}
    </span>
  );
}
