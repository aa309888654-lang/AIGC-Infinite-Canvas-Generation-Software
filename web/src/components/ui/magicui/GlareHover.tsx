import * as React from 'react';
import { cn } from '@/lib/utils';

interface GlareHoverProps extends React.HTMLAttributes<HTMLDivElement> {
  glareColor?: string;
  glareOpacity?: number;
  glareSize?: string;
  children: React.ReactNode;
}

/**
 * GlareHover - 悬停时的眩光效果
 * 鼠标移动时显示微妙的渐变覆盖层
 */
const GlareHover = React.forwardRef<HTMLDivElement, GlareHoverProps>(
  (
    {
      glareColor = '#3B82F6',
      glareOpacity = 0.15,
      glareSize = '300px',
      className,
      children,
      style,
      onMouseMove,
      onMouseLeave,
      ...props
    },
    ref
  ) => {
    const [position, setPosition] = React.useState({ x: 50, y: 50 });
    const [isHovering, setIsHovering] = React.useState(false);

    const handleMouseMove = React.useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setPosition({ x, y });
        onMouseMove?.(e);
      },
      [onMouseMove]
    );

    const handleMouseLeave = React.useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        setIsHovering(false);
        onMouseLeave?.(e);
      },
      [onMouseLeave]
    );

    const handleMouseEnter = React.useCallback(() => {
      setIsHovering(true);
    }, []);

    return (
      <div
        ref={ref}
        className={cn('relative overflow-hidden', className)}
        style={style}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {children}

        {/* 眩光覆盖层 */}
        <div
          className={cn(
            'pointer-events-none absolute inset-0 transition-opacity duration-300',
            isHovering ? 'opacity-100' : 'opacity-0'
          )}
          style={{
            background: `radial-gradient(circle at ${position.x}% ${position.y}%, ${glareColor}${Math.round(glareOpacity * 255).toString(16).padStart(2, '0')} 0%, transparent ${glareSize})`,
          }}
        />
      </div>
    );
  }
);

GlareHover.displayName = 'GlareHover';

// 带眩光效果的卡片
interface GlareCardProps extends GlareHoverProps {
  cardClassName?: string;
}

const GlareCard = React.forwardRef<HTMLDivElement, GlareCardProps>(
  (
    {
      cardClassName,
      glareColor = '#3B82F6',
      glareOpacity = 0.15,
      glareSize = '300px',
      children,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <GlareHover
        ref={ref}
        glareColor={glareColor}
        glareOpacity={glareOpacity}
        glareSize={glareSize}
        className={cn('rounded-xl', className)}
        {...props}
      >
        <div
          className={cn(
            'rounded-xl',
            'bg-[#0A0A0A]/90 border border-white/10',
            'backdrop-blur-xl',
            'transition-all duration-300',
            'hover:border-white/20',
            cardClassName
          )}
        >
          {children}
        </div>
      </GlareHover>
    );
  }
);

GlareCard.displayName = 'GlareCard';

export { GlareHover, GlareCard, type GlareHoverProps, type GlareCardProps };
