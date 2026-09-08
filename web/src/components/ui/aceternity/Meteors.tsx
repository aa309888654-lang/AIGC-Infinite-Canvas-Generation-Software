import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface MeteorsProps {
  /**
   * Number of meteors to display
   */
  number?: number;
  className?: string;
  /**
   * Color of the meteors (default: #3B82F6)
   */
  meteorColor?: string;
  /**
   * Length of the meteor trail in pixels
   */
  trailLength?: number;
}

interface MeteorItem {
  id: number;
  top: string;
  left: string;
  delay: string;
  duration: string;
}

/**
 * Meteors - Pure CSS meteor/shooting star effect
 * Creates animated shooting stars with random positions and delays
 * Requires animate-meteor-effect CSS animation in stylesheet
 */
export function Meteors({
  number = 20,
  className,
  meteorColor = '#3B82F6',
  trailLength = 50,
}: MeteorsProps) {
  // Generate meteor positions once
  const meteors: MeteorItem[] = useMemo(() => {
    return Array.from({ length: number }, (_, i) => ({
      id: i,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 5}s`,
      duration: `${2 + Math.random() * 4}s`,
    }));
  }, [number]);

  return (
    <div className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}>
      {meteors.map((meteor) => (
        <span
          key={meteor.id}
          className="animate-meteor-effect absolute h-0.5 w-0.5 rounded-full rotate-[215deg]"
          style={{
            top: meteor.top,
            left: meteor.left,
            animationDelay: meteor.delay,
            animationDuration: meteor.duration,
            backgroundColor: meteorColor,
            boxShadow: `0 0 1px 0px ${meteorColor}`,
          }}
        >
          {/* Meteor trail */}
          <span
            className="absolute top-1/2 -z-10 h-px -translate-y-1/2"
            style={{
              width: `${trailLength}px`,
              background: `linear-gradient(to right, ${meteorColor}, transparent)`,
            }}
          />
        </span>
      ))}
    </div>
  );
}

// ============ MeteorsCard ============

interface MeteorsCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  meteorCount?: number;
  meteorColor?: string;
}

/**
 * MeteorsCard - Card with meteor effect background
 */
export function MeteorsCard({
  children,
  className,
  meteorCount = 20,
  meteorColor = '#3B82F6',
  ...props
}: MeteorsCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-6',
        className
      )}
      {...props}
    >
      <Meteors number={meteorCount} meteorColor={meteorColor} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
