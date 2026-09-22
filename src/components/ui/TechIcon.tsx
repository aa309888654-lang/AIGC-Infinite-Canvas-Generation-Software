import React from 'react';
import { cn } from '@/lib/utils';

/**
 * 纯色高级图标组件 - Solid premium icon component
 * Renders lucide icons inside a compact badge.
 */

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number | string }>;

interface TechIconProps {
  icon: IconComponent;
  size?: number;
  /** Badge size (the background container). Defaults to size*2.2 */
  badgeSize?: number;
  /** Icon color. Used for both fill and stroke */
  color?: string;
  /** Badge background gradient class (kept for backward compatibility) */
  gradient?: string;
  /** Solid badge background color (used if no gradient) */
  bgColor?: string;
  /** Whether to render as inline icon without badge background */
  inline?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const TechIcon: React.FC<TechIconProps> = ({
  icon: Icon,
  size = 18,
  badgeSize,
  color,
  gradient,
  bgColor,
  inline = false,
  className,
  style,
}) => {
  const iconElement = (
    <Icon
      size={size}
      fill="currentColor"
      strokeWidth={1.5}
      className={cn(!color && 'text-white', className)}
      style={color ? { color } : undefined}
    />
  );

  if (inline) {
    return iconElement;
  }

  const bs = badgeSize || Math.round(size * 2.2);

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center shrink-0',
        gradient ? `bg-gradient-to-br ${gradient}` : '',
      )}
      style={{
        width: bs,
        height: bs,
        borderRadius: Math.round(bs * 0.28),
        backgroundColor: bgColor || 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: color
          ? `0 0 12px ${color}30, inset 0 1px 0 rgba(255,255,255,0.10)`
          : '0 0 12px rgba(107, 114, 128,0.18), inset 0 1px 0 rgba(255,255,255,0.10)',
        ...style,
      }}
    >
      {iconElement}
    </div>
  );
};

export default TechIcon;
