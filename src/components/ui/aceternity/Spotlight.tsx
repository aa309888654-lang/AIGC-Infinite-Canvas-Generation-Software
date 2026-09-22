import React from 'react';
import { cn } from '@/lib/utils';

interface SpotlightProps {
  className?: string;
  /**
   * Fill color of the spotlight
   */
  fill?: string;
  /**
   * Initial position offset
   */
  x?: number;
  y?: number;
}

/**
 * Spotlight - Pure CSS spotlight effect using SVG with Gaussian blur filter
 * Creates a dramatic lighting effect for hero sections
 * Requires animate-spotlight CSS animation in stylesheet
 */
export function Spotlight({
  className,
  fill = '#3B82F6',
  x = -72,
  y = -62,
}: SpotlightProps) {
  return (
    <svg
      className={cn(
        'animate-spotlight pointer-events-none absolute z-[1] h-[169%] w-[138%] lg:w-[84%] opacity-0',
        className
      )}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 3787 2842"
      fill="none"
    >
      <g filter="url(#spotlight-filter)">
        <ellipse
          cx="1924.71"
          cy="273.501"
          rx="1924.71"
          ry="273.501"
          transform="matrix(-0.822377 -0.568943 -0.568943 0.822377 3631.88 2291.09)"
          fill={fill}
          fillOpacity="0.25"
        />
      </g>
      <defs>
        <filter
          id="spotlight-filter"
          x="0.860352"
          y="0.838989"
          width="3785.16"
          height="2840.26"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="BackgroundImageFix"
            result="shape"
          />
          <feGaussianBlur
            stdDeviation="151"
            result="effect1_foregroundBlur_1065_8"
          />
        </filter>
      </defs>
    </svg>
  );
}

/**
 * SpotlightDual - Two spotlights for more dramatic effect
 */
export function SpotlightDual({ className }: { className?: string }) {
  return (
    <>
      <Spotlight
        className={cn('translate-x-[-20%] translate-y-[10%]', className)}
        fill="#3B82F6"
      />
      <Spotlight
        className={cn('translate-x-[40%] translate-y-[-20%] h-[130%] w-[100%]', className)}
        fill="#1D4ED8"
      />
    </>
  );
}
