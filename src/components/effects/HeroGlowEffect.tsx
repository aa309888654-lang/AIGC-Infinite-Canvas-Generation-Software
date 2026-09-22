import React, { memo, useMemo } from 'react';

/**
 * HeroGlowEffect - Hero 区域光效组件
 * 三个大型渐变光晕球缓慢漂浮，配合中心径向渐隐和底部遮罩
 *
 * @param className - 自定义样式类名
 * @param intensity - 光效强度: 'low' | 'medium' | 'high'，默认 'medium'
 */
interface HeroGlowEffectProps {
  className?: string;
  intensity?: 'low' | 'medium' | 'high';
}

// 光晕球配置
interface OrbConfig {
  id: number;
  color: string;
  size: number; // px
  blur: number; // px
  initialX: number; // %
  initialY: number; // %
  animationName: string;
  animationDuration: number; // s
}

// 强度映射
const INTENSITY_MAP = {
  low: {
    opacity: 0.4,
    orbScale: 0.7,
  },
  medium: {
    opacity: 0.7,
    orbScale: 1.0,
  },
  high: {
    opacity: 1.0,
    orbScale: 1.3,
  },
} as const;

const HeroGlowEffect = memo(({ className, intensity = 'medium' }: HeroGlowEffectProps) => {
  const intensityConfig = INTENSITY_MAP[intensity];

  // 三个光晕球的配置
  const orbs: OrbConfig[] = useMemo(
    () => [
      {
        id: 0,
        color: '#00D4AA', // 绿
        size: 400,
        blur: 80,
        initialX: 20,
        initialY: 15,
        animationName: 'hero-glow-orb-1',
        animationDuration: 18,
      },
      {
        id: 1,
        color: '#1D4ED8', // 蓝
        size: 350,
        blur: 100,
        initialX: 55,
        initialY: 25,
        animationName: 'hero-glow-orb-2',
        animationDuration: 22,
      },
      {
        id: 2,
        color: '#8B5CF6', // 紫
        size: 300,
        blur: 120,
        initialX: 70,
        initialY: 10,
        animationName: 'hero-glow-orb-3',
        animationDuration: 15,
      },
    ],
    []
  );

  // 根据强度缩放光晕球大小
  const scaledSize = (base: number) => Math.round(base * intensityConfig.orbScale);

  return (
    <>
      <style>{`
        @keyframes hero-glow-orb-1 {
          0%, 100% {
            transform: translate(0, 0);
          }
          25% {
            transform: translate(30px, 20px);
          }
          50% {
            transform: translate(-20px, 40px);
          }
          75% {
            transform: translate(15px, -10px);
          }
        }

        @keyframes hero-glow-orb-2 {
          0%, 100% {
            transform: translate(0, 0);
          }
          25% {
            transform: translate(-25px, 15px);
          }
          50% {
            transform: translate(20px, -20px);
          }
          75% {
            transform: translate(-10px, 30px);
          }
        }

        @keyframes hero-glow-orb-3 {
          0%, 100% {
            transform: translate(0, 0);
          }
          25% {
            transform: translate(15px, -25px);
          }
          50% {
            transform: translate(-30px, 10px);
          }
          75% {
            transform: translate(25px, 20px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-glow-orb {
            animation: none !important;
          }
        }
      `}</style>

      <div
        className={className}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        {/* 三个光晕球 */}
        {orbs.map((orb) => (
          <div
            key={orb.id}
            className="hero-glow-orb"
            style={{
              position: 'absolute',
              top: `${orb.initialY}%`,
              left: `${orb.initialX}%`,
              width: `${scaledSize(orb.size)}px`,
              height: `${scaledSize(orb.size)}px`,
              borderRadius: '50%',
              background: `radial-gradient(circle at center, ${orb.color}40 0%, ${orb.color}15 40%, transparent 70%)`,
              filter: `blur(${orb.blur}px)`,
              opacity: intensityConfig.opacity,
              animation: `${orb.animationName} ${orb.animationDuration}s ease-in-out infinite`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}

        {/* 中心径向渐隐覆盖层 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at 50% 40%, transparent 0%, rgba(8, 8, 10, 0.3) 50%, rgba(8, 8, 10, 0.8) 100%)',
          }}
        />

        {/* 底部渐变遮罩 (transparent → 背景色) */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: '40%',
            background: 'linear-gradient(to bottom, transparent, #08080A)',
          }}
        />
      </div>
    </>
  );
});

HeroGlowEffect.displayName = 'HeroGlowEffect';

export default HeroGlowEffect;
