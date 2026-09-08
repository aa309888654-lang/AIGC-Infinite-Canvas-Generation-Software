import * as React from 'react';
import { cn } from '@/lib/utils';

interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  shimmerColor?: string;
  shimmerSize?: string;
  shimmerDuration?: string;
  background?: string;
  borderRadius?: string;
  borderWidth?: string;
  children: React.ReactNode;
}

/**
 * ShimmerButton - 带有闪光扫过动画的高级按钮
 * 使用 conic-gradient 和 CSS 变量实现闪光效果
 */
const ShimmerButton = React.forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  (
    {
      shimmerColor = '#3B82F6',
      shimmerSize = '0.1em',
      shimmerDuration = '3s',
      background = 'linear-gradient(135deg, #0A0A0A 0%, #1A1A1A 100%)',
      borderRadius = '12px',
      borderWidth = '2px',
      className,
      children,
      style,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          'relative inline-flex items-center justify-center overflow-hidden',
          'font-medium transition-all duration-300',
          'hover:scale-[1.02] active:scale-[0.98]',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
          className
        )}
        style={{
          background,
          borderRadius,
          padding: `calc(${borderWidth} + 12px) calc(${borderWidth} + 24px)`,
          ...style,
        }}
        {...props}
      >
        {/* 闪光边框层 */}
        <div
          className="absolute inset-0 animate-spin-around"
          style={{
            padding: borderWidth,
            borderRadius,
            background: `conic-gradient(from 0deg at 50% 50%, transparent 0deg, ${shimmerColor} 90deg, transparent 180deg, ${shimmerColor} 270deg, transparent 360deg)`,
            WebkitMask: `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
        />

        {/* 内容 */}
        <span className="relative z-10">{children}</span>

        {/* 内部闪光效果 */}
        <div
          className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `radial-gradient(ellipse at var(--mouse-x, 50%) var(--mouse-y, 50%), ${shimmerColor}15 0%, transparent 70%)`,
            borderRadius,
          }}
        />
      </button>
    );
  }
);

ShimmerButton.displayName = 'ShimmerButton';

export { ShimmerButton, type ShimmerButtonProps };
