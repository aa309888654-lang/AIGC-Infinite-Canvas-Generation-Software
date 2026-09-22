import React, { useEffect, useId, useState } from 'react';
import { cn } from '@/lib/utils';

interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  borderWidth?: number;
  colorFrom?: string;
  colorTo?: string;
  delay?: number;
}

export function BorderBeam({
  className,
  size = 200,
  duration = 15,
  borderWidth = 1.5,
  colorFrom = '#3B82F6',
  colorTo = '#1D4ED8',
  delay = 0,
}: BorderBeamProps) {
  const id = useId();
  const [gradientId, setGradientId] = useState('');

  useEffect(() => {
    setGradientId(`border-beam-gradient-${id}`);
  }, [id]);

  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-[inherit]"
      style={{ overflow: 'hidden' }}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient
            id={gradientId}
            className="animate-border-beam"
            gradientUnits="userSpaceOnUse"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop stopColor={colorFrom} stopOpacity="0" />
            <stop stopColor={colorFrom} />
            <stop offset="0.5" stopColor={colorTo} />
            <stop offset="1" stopColor={colorTo} stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          rx="inherit"
          ry="inherit"
          stroke={`url(#${gradientId})`}
          strokeWidth={borderWidth}
          fill="none"
        />
      </svg>
    </div>
  );
}
