import * as React from 'react';
import { cn } from '@/lib/utils';

interface AnimatedGradientTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  gradient?: string;
  duration?: string;
  children: React.ReactNode;
}

/**
 * AnimatedGradientText - 带有动画渐变效果的文字
 * 使用 background-clip: text 和 background-position 动画
 */
const AnimatedGradientText = React.forwardRef<HTMLSpanElement, AnimatedGradientTextProps>(
  (
    {
      gradient = 'linear-gradient(90deg, #3B82F6 0%, #1D4ED8 25%, #6366F1 50%, #1D4ED8 75%, #3B82F6 100%)',
      duration = '3s',
      className,
      children,
      style,
      ...props
    },
    ref
  ) => {
    return (
      <span
        ref={ref}
        className={cn('inline-block', className)}
        style={{
          background: gradient,
          backgroundSize: '200% auto',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: `gradient-x ${duration} ease infinite`,
          ...style,
        }}
        {...props}
      >
        {children}
      </span>
    );
  }
);

AnimatedGradientText.displayName = 'AnimatedGradientText';

// 预设渐变
const gradientPresets = {
  primary: 'linear-gradient(90deg, #3B82F6 0%, #1D4ED8 25%, #6366F1 50%, #1D4ED8 75%, #3B82F6 100%)',
  cyan: 'linear-gradient(90deg, #3B82F6 0%, #1D4ED8 50%, #3B82F6 100%)',
  purple: 'linear-gradient(90deg, #6366F1 0%, #8B5CF6 50%, #6366F1 100%)',
  rainbow: 'linear-gradient(90deg, #FF6B6B, #FEC89B, #FFD93D, #6BCB77, #4D96FF, #9B59B6, #FF6B6B)',
  sunset: 'linear-gradient(90deg, #FF6B6B 0%, #FEC89B 50%, #FF6B6B 100%)',
};

export { AnimatedGradientText, gradientPresets, type AnimatedGradientTextProps };
