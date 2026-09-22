import * as React from 'react';
import { cn } from '@/lib/utils';

interface MarqueeProps extends React.HTMLAttributes<HTMLDivElement> {
  vertical?: boolean;
  reverse?: boolean;
  pauseOnHover?: boolean;
  gap?: string;
  speed?: number; // pixels per second
  children: React.ReactNode;
}

/**
 * Marquee - 无限滚动跑马灯组件
 * 支持水平/垂直方向、反向、悬停暂停
 */
const Marquee = React.forwardRef<HTMLDivElement, MarqueeProps>(
  (
    {
      vertical = false,
      reverse = false,
      pauseOnHover = false,
      gap = '40px',
      speed = 40,
      className,
      children,
      style,
      ...props
    },
    ref
  ) => {
    // 计算动画时长（基于速度）
    // 速度是每秒移动的像素数，默认内容宽度为 100%
    const duration = React.useMemo(() => {
      // 假设每个子元素宽度约 200px，计算总宽度
      const childCount = React.Children.count(children);
      const estimatedWidth = childCount * 200 + parseInt(gap) * childCount;
      return `${estimatedWidth / speed}s`;
    }, [children, gap, speed]);

    const marqueeStyle = {
      '--gap': gap,
      '--duration': duration,
      gap: `var(--gap)`,
      flexDirection: vertical ? 'column' : 'row',
    } as React.CSSProperties;

    return (
      <div
        ref={ref}
        className={cn(
          'group flex overflow-hidden',
          vertical ? 'h-full' : 'w-full',
          className
        )}
        style={style}
        {...props}
      >
        {/* 第一组内容 */}
        <div
          className={cn(
            'flex shrink-0',
            vertical ? 'animate-marquee-vertical' : 'animate-marquee',
            reverse && '[animation-direction:reverse]',
            pauseOnHover && 'group-hover:[animation-play-state:paused]'
          )}
          style={marqueeStyle}
        >
          {children}
        </div>

        {/* 第二组内容（无缝衔接） */}
        <div
          className={cn(
            'flex shrink-0',
            vertical ? 'animate-marquee-vertical' : 'animate-marquee',
            reverse && '[animation-direction:reverse]',
            pauseOnHover && 'group-hover:[animation-play-state:paused]'
          )}
          style={marqueeStyle}
          aria-hidden="true"
        >
          {children}
        </div>
      </div>
    );
  }
);

Marquee.displayName = 'Marquee';

// 跑马灯项组件
interface MarqueeItemProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const MarqueeItem = React.forwardRef<HTMLDivElement, MarqueeItemProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex-shrink-0', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

MarqueeItem.displayName = 'MarqueeItem';

export { Marquee, MarqueeItem, type MarqueeProps, type MarqueeItemProps };
