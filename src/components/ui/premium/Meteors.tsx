import React from 'react';
import { cn } from '@/lib/utils';

interface MeteorsProps {
  number?: number;
  className?: string;
}

export function Meteors({ number = 20, className }: MeteorsProps) {
  const meteors = Array.from({ length: number }, (_, i) => i);

  return (
    <div className={cn('absolute inset-0 overflow-hidden', className)}>
      {meteors.map((_, idx) => (
        <span
          key={'meteor' + idx}
          className="animate-meteor-effect absolute h-0.5 w-0.5 rounded-full bg-[#3B82F6] shadow-[0_0_0_1px_#ffffff10] rotate-[215deg]"
          style={{
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${2 + Math.random() * 4}s`,
          }}
        >
          <span className="absolute top-1/2 -z-10 h-px w-[50px] -translate-y-1/2 bg-gradient-to-r from-[#3B82F6] to-transparent" />
        </span>
      ))}
    </div>
  );
}
