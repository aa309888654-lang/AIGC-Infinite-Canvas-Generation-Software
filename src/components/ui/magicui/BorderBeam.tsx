import * as React from 'react';
import { cn } from '@/lib/utils';

interface BorderBeamProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number;
  duration?: string;
  borderWidth?: number;
  colorFrom?: string;
  colorTo?: string;
  delay?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * BorderBeam - 边框光束动画效果
 * 使用 SVG linearGradient 在 rect stroke 上创建环绕边框的光束效果
 */
const BorderBeam = React.forwardRef<HTMLDivElement, BorderBeamProps>(
  (
    {
      size = 200,
      duration = '15s',
      borderWidth = 2,
      colorFrom = '#3B82F6',
      colorTo = '#6366F1',
      delay = '0s',
      className,
      children,
      style,
      ...props
    },
    ref
  ) => {
    const id = React.useId();

    return (
      <div
        ref={ref}
        className={cn('relative', className)}
        style={style}
        {...props}
      >
        {children}

        {/* SVG 边框光束 */}
        <svg
          className="pointer-events-none absolute inset-0 size-full"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <rect
            fill="none"
            stroke={`url(#${id})`}
            strokeWidth={borderWidth}
            strokeLinejoin="round"
            width="100%"
            height="100%"
            rx="inherit"
            className="animate-border-beam"
            style={{
              '--duration': duration,
              animationDelay: delay,
            } as React.CSSProperties}
          />
          <defs>
            <linearGradient id={id} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={colorFrom} stopOpacity="0" />
              <stop offset="50%" stopColor={colorFrom} stopOpacity="1" />
              <stop offset="100%" stopColor={colorTo} stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  }
);

BorderBeam.displayName = 'BorderBeam';

// 带边框光束的卡片组件
interface BorderBeamCardProps extends BorderBeamProps {
  cardClassName?: string;
}

const BorderBeamCard = React.forwardRef<HTMLDivElement, BorderBeamCardProps>(
  (
    {
      cardClassName,
      children,
      size = 200,
      duration = '15s',
      borderWidth = 2,
      colorFrom = '#3B82F6',
      colorTo = '#6366F1',
      delay = '0s',
      className,
      ...props
    },
    ref
  ) => {
    return (
      <BorderBeam
        ref={ref}
        size={size}
        duration={duration}
        borderWidth={borderWidth}
        colorFrom={colorFrom}
        colorTo={colorTo}
        delay={delay}
        className={cn('rounded-xl', className)}
        {...props}
      >
        <div
          className={cn(
            'relative rounded-xl',
            'bg-[#0A0A0A] border border-white/5',
            'backdrop-blur-xl',
            cardClassName
          )}
        >
          {children}
        </div>
      </BorderBeam>
    );
  }
);

BorderBeamCard.displayName = 'BorderBeamCard';

export { BorderBeam, BorderBeamCard, type BorderBeamProps, type BorderBeamCardProps };
