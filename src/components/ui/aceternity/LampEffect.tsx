import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LampEffectProps {
  /**
   * Title text to display
   */
  title: string;
  /**
   * Optional subtitle
   */
  subtitle?: string;
  className?: string;
  /**
   * Color of the lamp glow (default: #3B82F6)
   */
  glowColor?: string;
  /**
   * Whether to show the dropdown content
   */
  isOpen?: boolean;
  /**
   * Callback when lamp is clicked
   */
  onToggle?: () => void;
  /**
   * Dropdown content
   */
  children?: React.ReactNode;
}

/**
 * LampEffect - Linear-style lamp/dropdown light effect
 * Creates a glowing lamp effect for section headers
 * Perfect for navigation dropdowns or section reveals
 */
export function LampEffect({
  title,
  subtitle,
  className,
  glowColor = '#3B82F6',
  isOpen = false,
  onToggle,
  children,
}: LampEffectProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const openState = onToggle ? isOpen : internalOpen;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalOpen(!internalOpen);
    }
  };

  return (
    <div className={cn('relative', className)}>
      {/* Lamp container */}
      <div
        className="relative flex flex-col items-center cursor-pointer"
        onClick={handleToggle}
      >
        {/* Lamp glow */}
        <motion.div
          className="absolute -top-4 w-40 h-8 rounded-full blur-xl"
          style={{ backgroundColor: glowColor }}
          initial={{ opacity: 0.3, scale: 0.8 }}
          animate={{
            opacity: openState ? 0.8 : 0.3,
            scale: openState ? 1.2 : 0.8,
          }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />

        {/* Lamp beam */}
        <motion.div
          className="absolute top-0 w-px h-20"
          style={{
            background: `linear-gradient(to bottom, ${glowColor}, transparent)`,
          }}
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{
            opacity: openState ? 1 : 0,
            scaleY: openState ? 1 : 0,
          }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />

        {/* Title */}
        <motion.h2
          className="relative z-10 text-3xl font-bold text-white"
          animate={{ color: openState ? glowColor : '#ffffff' }}
          transition={{ duration: 0.3 }}
        >
          {title}
        </motion.h2>

        {/* Subtitle */}
        {subtitle && (
          <motion.p
            className="relative z-10 mt-2 text-sm text-white/60"
            animate={{ opacity: openState ? 1 : 0.6 }}
          >
            {subtitle}
          </motion.p>
        )}

        {/* Lamp base indicator */}
        <motion.div
          className="mt-4 w-2 h-2 rounded-full"
          style={{ backgroundColor: glowColor }}
          animate={{
            boxShadow: openState
              ? `0 0 20px ${glowColor}, 0 0 40px ${glowColor}`
              : `0 0 10px ${glowColor}`,
          }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Dropdown content */}
      <AnimatePresence>
        {openState && children && (
          <motion.div
            className="absolute top-full left-1/2 -translate-x-1/2 mt-8 w-max"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {/* Dropdown glow background */}
            <div
              className="absolute inset-0 -z-10 rounded-xl blur-xl opacity-30"
              style={{ backgroundColor: glowColor }}
            />

            {/* Content container */}
            <div className="relative bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-2xl">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============ LampSection ============

interface LampSectionProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Color of the lamp glow
   */
  glowColor?: string;
}

/**
 * LampSection - Section wrapper with lamp effect at top
 * Creates a dramatic section header with light beam effect
 */
export function LampSection({
  children,
  className,
  glowColor = '#3B82F6',
}: LampSectionProps) {
  return (
    <div className={cn('relative py-20 overflow-hidden', className)}>
      {/* Background gradient */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: `radial-gradient(ellipse 50% 30% at 50% 0%, ${glowColor}, transparent)`,
        }}
      />

      {/* Light beam */}
      <motion.div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-40"
        style={{
          background: `linear-gradient(to bottom, ${glowColor}, transparent)`,
        }}
        initial={{ opacity: 0, scaleY: 0 }}
        animate={{ opacity: 0.6, scaleY: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
