import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

// ============ CardContainer ============

interface CardContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
}

/**
 * CardContainer - 3D perspective container for tilt effect
 * Wraps CardBody to enable 3D perspective transforms
 */
export function CardContainer({
  children,
  className,
  containerClassName,
  ...props
}: CardContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className={cn(
        'relative',
        containerClassName
      )}
      style={{
        perspective: '1000px',
      }}
    >
      <div
        ref={containerRef}
        className={cn(
          'relative',
          className
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

// ============ CardBody ============

interface CardBodyProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: React.ReactNode;
  className?: string;
  /**
   * Rotation intensity (default: 20)
   */
  rotationIntensity?: number;
}

/**
 * CardBody - 3D card body with mouse-following tilt effect
 * Uses framer-motion for smooth animations
 */
export function CardBody({
  children,
  className,
  rotationIntensity = 20,
  ...props
}: CardBodyProps) {
  const ref = useRef<HTMLDivElement>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Spring animation for smooth movement
  const springConfig = { stiffness: 300, damping: 30 };
  const xSpring = useSpring(x, springConfig);
  const ySpring = useSpring(y, springConfig);

  // Transform values for 3D rotation
  const rotateX = useTransform(ySpring, [-0.5, 0.5], [rotationIntensity, -rotationIntensity]);
  const rotateY = useTransform(xSpring, [-0.5, 0.5], [-rotationIntensity, rotationIntensity]);

  // Transform for z-axis movement on hover
  const z = useTransform(
    [xSpring, ySpring],
    ([latestX, latestY]) => {
      const distance = Math.sqrt(
        Math.pow((latestX as number) - 0, 2) + Math.pow((latestY as number) - 0, 2)
      );
      return Math.min(distance * 100, 30);
    }
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Normalize to -0.5 to 0.5 range
    const normalizedX = (e.clientX - centerX) / rect.width;
    const normalizedY = (e.clientY - centerY) / rect.height;

    x.set(normalizedX);
    y.set(normalizedY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={cn(
        'relative transform-gpu',
        className
      )}
      style={{
        rotateX,
        rotateY,
        z,
        transformStyle: 'preserve-3d',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ============ CardItem ============

interface CardItemProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: React.ReactNode;
  className?: string;
  /**
   * Translation depth on Z-axis (default: 20)
   */
  translateZ?: number;
  as?: 'div' | 'span' | 'h1' | 'h2' | 'h3' | 'p' | 'button';
}

/**
 * CardItem - Individual item within 3D card with depth translation
 * Creates parallax-like depth effect within the card
 */
export function CardItem({
  children,
  className,
  translateZ = 20,
  as = 'div',
  ...props
}: CardItemProps) {
  const Component = (motion[as] || motion.div) as React.ElementType;

  return (
    <Component
      className={cn('w-fit', className)}
      style={{
        translateZ,
        transformStyle: 'preserve-3d',
      }}
      {...props}
    >
      {children}
    </Component>
  );
}

// ============ ThreeDCard (Combined) ============

interface ThreeDCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  rotationIntensity?: number;
}

/**
 * ThreeDCard - Pre-composed 3D card component
 * Combines CardContainer, CardBody for easy usage
 */
export function ThreeDCard({
  children,
  className,
  containerClassName,
  rotationIntensity = 20,
  ...props
}: ThreeDCardProps) {
  return (
    <CardContainer containerClassName={containerClassName}>
      <CardBody
        className={cn(
          'rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-6 shadow-xl',
          className
        )}
        rotationIntensity={rotationIntensity}
        {...props}
      >
        {children}
      </CardBody>
    </CardContainer>
  );
}
