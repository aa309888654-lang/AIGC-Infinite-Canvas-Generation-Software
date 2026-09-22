import React, { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface GlareCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  /**
   * Color of the glare effect (default: white)
   */
  glareColor?: string;
  /**
   * Intensity of the glare (0-1, default: 0.15)
   */
  glareIntensity?: number;
  /**
   * Enable 3D tilt effect (default: true)
   */
  enableTilt?: boolean;
  /**
   * Maximum tilt rotation in degrees (default: 15)
   */
  maxTilt?: number;
  /**
   * Border color for the card
   */
  borderColor?: string;
}

/**
 * GlareCard - Glass-morphism card with mouse-following glare effect
 * Creates a premium glass card with dynamic light reflection
 */
export function GlareCard({
  children,
  className,
  glareColor = '#ffffff',
  glareIntensity = 0.15,
  enableTilt = true,
  maxTilt = 15,
  borderColor = 'rgba(255, 255, 255, 0.1)',
  ...props
}: GlareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [glarePosition, setGlarePosition] = useState({ x: 50, y: 50 });
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setGlarePosition({ x, y });

    if (enableTilt) {
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const tiltX = ((e.clientY - rect.top - centerY) / centerY) * maxTilt;
      const tiltY = ((e.clientX - rect.left - centerX) / centerX) * -maxTilt;
      setTilt({ x: tiltX, y: tiltY });
    }
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setTilt({ x: 0, y: 0 });
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        'relative overflow-hidden rounded-xl backdrop-blur-xl transition-all duration-200',
        'bg-white/[0.03] border shadow-xl',
        className
      )}
      style={{
        borderColor,
        transform: enableTilt
          ? `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`
          : undefined,
        transformStyle: enableTilt ? 'preserve-3d' : undefined,
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {/* Glare overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle at ${glarePosition.x}% ${glarePosition.y}%, ${glareColor}40 0%, transparent 60%)`,
          opacity: isHovering ? glareIntensity * 2 : 0,
        }}
      />

      {/* Gradient border glow */}
      <div
        className="pointer-events-none absolute inset-0 z-0 rounded-xl"
        style={{
          background: `radial-gradient(circle at ${glarePosition.x}% ${glarePosition.y}%, rgba(59, 130, 246, 0.1) 0%, transparent 50%)`,
          opacity: isHovering ? 1 : 0,
        }}
      />

      {/* Content */}
      <div className="relative z-20">{children}</div>
    </div>
  );
}

// ============ GlareCardSimple ============

interface GlareCardSimpleProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

/**
 * GlareCardSimple - Simplified glass card with glare effect
 * Pre-styled for quick usage
 */
export function GlareCardSimple({
  children,
  className,
  ...props
}: GlareCardSimpleProps) {
  return (
    <GlareCard
      className={cn(
        'p-6',
        'bg-gradient-to-br from-white/[0.05] to-white/[0.02]',
        className
      )}
      {...props}
    >
      {children}
    </GlareCard>
  );
}

// ============ GlareCardPremium ============

interface GlareCardPremiumProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  /**
   * Accent color for the card
   */
  accentColor?: string;
}

/**
 * GlareCardPremium - Premium glass card with accent glow
 * Features enhanced glass-morphism and accent color glow
 */
export function GlareCardPremium({
  children,
  className,
  accentColor = '#3B82F6',
  ...props
}: GlareCardPremiumProps) {
  return (
    <div className="relative group">
      {/* Accent glow background */}
      <div
        className="absolute -inset-px rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"
        style={{ backgroundColor: accentColor }}
      />

      <GlareCard
        className={cn(
          'p-8',
          'bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-white/[0.02]',
          'border-white/[0.15]',
          className
        )}
        glareColor={accentColor}
        glareIntensity={0.2}
        {...props}
      >
        {children}
      </GlareCard>
    </div>
  );
}
