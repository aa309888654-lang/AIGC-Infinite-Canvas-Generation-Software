import React, { useMemo } from 'react';

// ============================================================
// FloatingCartoonParticles
// 悬浮卡通粒子效果组件 - 用于 Hero 区域装饰
// ============================================================

/** 粒子颜色池 */
const COLORS = ['#00D4AA', '#1D4ED8', '#C9A96E', '#FF6B9D', '#8B5CF6'] as const;

/** 粒子形状类型 */
type ShapeType = 'bubble' | 'star' | 'triangle' | 'square' | 'diamond';

/** 粒子形状池 */
const SHAPES: ShapeType[] = ['bubble', 'star', 'triangle', 'square', 'diamond'];

/** 工具函数：生成 [min, max) 区间随机数 */
function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/** 工具函数：从数组中随机选取一个元素 */
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 单个粒子的配置（在 render 前一次性生成） */
interface ParticleConfig {
  id: number;
  shape: ShapeType;
  color: string;
  size: number;             // 6 ~ 24 px
  left: string;             // 水平初始位置 %
  floatDuration: number;    // 上浮时长 8 ~ 15s
  swayDuration: number;     // 左右摆动周期 3 ~ 6s
  swayDistance: number;     // 左右摆动幅度 10 ~ 30px
  rotateDuration: number;   // 旋转周期 4 ~ 10s
  breatheDuration: number;  // 呼吸缩放周期 3 ~ 5s
  delay: number;            // 动画延迟 0 ~ 10s
  rotateDirection: number;  // 1 或 -1
}

/** 生成粒子配置数组 */
function generateParticles(count: number): ParticleConfig[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    shape: pick(SHAPES),
    color: pick(COLORS),
    size: rand(6, 25),
    left: `${rand(2, 98)}%`,
    floatDuration: rand(8, 15),
    swayDuration: rand(3, 6),
    swayDistance: rand(10, 30),
    rotateDuration: rand(4, 10),
    breatheDuration: rand(3, 5),
    delay: rand(0, 10),
    rotateDirection: Math.random() > 0.5 ? 1 : -1,
  }));
}

// --------------------------------------------------
// 各形状的 SVG 渲染器
// --------------------------------------------------

/** 圆形气泡 - 带高光 */
function BubbleShape({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* 主体圆 */}
      <circle cx="12" cy="12" r="11" fill={color} opacity={0.85} />
      {/* 高光 */}
      <ellipse cx="8.5" cy="8" rx="3" ry="2.5" fill="white" opacity={0.45} />
    </svg>
  );
}

/** 小星星 (✦ 形状，CSS clip-path 风格) */
function StarShape({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2 L14.5 9 L22 9 L16 13.5 L18 21 L12 16.5 L6 21 L8 13.5 L2 9 L9.5 9 Z"
        fill={color}
        opacity={0.9}
      />
    </svg>
  );
}

/** 小三角形 */
function TriangleShape({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 3 L22 21 L2 21 Z" fill={color} opacity={0.85} />
    </svg>
  );
}

/** 小方块 (圆角) */
function SquareShape({ size, color }: { size: number; color: string }) {
  const r = size * 0.2;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="4" fill={color} opacity={0.85} />
    </svg>
  );
}

/** 小菱形 */
function DiamondShape({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2 L22 12 L12 22 L2 12 Z" fill={color} opacity={0.85} />
    </svg>
  );
}

/** 形状渲染路由 */
function ParticleShape({
  shape,
  size,
  color,
}: {
  shape: ShapeType;
  size: number;
  color: string;
}) {
  switch (shape) {
    case 'bubble':
      return <BubbleShape size={size} color={color} />;
    case 'star':
      return <StarShape size={size} color={color} />;
    case 'triangle':
      return <TriangleShape size={size} color={color} />;
    case 'square':
      return <SquareShape size={size} color={color} />;
    case 'diamond':
      return <DiamondShape size={size} color={color} />;
    default:
      return <BubbleShape size={size} color={color} />;
  }
}

// --------------------------------------------------
// 内联 @keyframes 定义（使用 style 标签注入）
// --------------------------------------------------

const KEYFRAMES_ID = 'floating-cartoon-particles-keyframes';

/** keyframes CSS 文本 */
const KEYFRAMES_CSS = /* css */ `
  /* === 主上浮动画 === */
  @keyframes fcp-float-up {
    0% {
      transform: translateY(0) translateX(0) rotate(0deg) scale(1);
      opacity: 0;
    }
    5% {
      opacity: 0.8;
    }
    50% {
      opacity: 0.8;
    }
    90% {
      opacity: 0.3;
    }
    100% {
      transform: translateY(-100vh) translateX(0) rotate(360deg) scale(0.6);
      opacity: 0;
    }
  }

  /* === 左右摆动 === */
  @keyframes fcp-sway {
    0%, 100% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(var(--fcp-sway-dist));
    }
    75% {
      transform: translateX(calc(-1 * var(--fcp-sway-dist)));
    }
  }

  /* === 旋转 === */
  @keyframes fcp-spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(calc(var(--fcp-spin-dir) * 360deg));
    }
  }

  /* === 呼吸缩放 === */
  @keyframes fcp-breathe {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.2);
    }
  }

  /* === prefers-reduced-motion 禁用动画 === */
  @media (prefers-reduced-motion: reduce) {
    .fcp-particle {
      animation: none !important;
      opacity: 0.4 !important;
    }
  }
`;

/**
 * 向 <head> 注入 keyframes（只执行一次）
 */
function ensureKeyframes(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement('style');
  style.id = KEYFRAMES_ID;
  style.textContent = KEYFRAMES_CSS;
  document.head.appendChild(style);
}

// --------------------------------------------------
// 组件 Props
// --------------------------------------------------

interface FloatingCartoonParticlesProps {
  className?: string;
  /** 粒子数量，默认 15 */
  count?: number;
}

// --------------------------------------------------
// 主组件
// --------------------------------------------------

const FloatingCartoonParticles: React.FC<FloatingCartoonParticlesProps> = ({
  className,
  count = 15,
}) => {
  // 一次性生成粒子配置
  const particles = useMemo(() => generateParticles(count), [count]);

  // 注入 keyframes
  ensureKeyframes();

  return (
    <div
      className={className}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    >
      {particles.map((p) => (
        <div
          key={p.id}
          className="fcp-particle"
          style={{
            position: 'absolute',
            bottom: `-${p.size + 10}px`,
            left: p.left,
            width: p.size,
            height: p.size,
            // CSS 自定义属性，供 keyframes 引用
            ['--fcp-sway-dist' as string]: `${p.swayDistance}px`,
            ['--fcp-spin-dir' as string]: p.rotateDirection,
            // 组合四层动画：上浮 / 摆动 / 旋转 / 呼吸
            animation: [
              `fcp-float-up ${p.floatDuration.toFixed(1)}s ${p.delay.toFixed(1)}s linear infinite`,
              `fcp-sway ${p.swayDuration.toFixed(1)}s ${p.delay.toFixed(1)}s ease-in-out infinite`,
              `fcp-spin ${p.rotateDuration.toFixed(1)}s ${p.delay.toFixed(1)}s linear infinite`,
              `fcp-breathe ${p.breatheDuration.toFixed(1)}s ${p.delay.toFixed(1)}s ease-in-out infinite`,
            ].join(', '),
            // 让组合动画各自独立变换
            willChange: 'transform, opacity',
          }}
        >
          <ParticleShape shape={p.shape} size={p.size} color={p.color} />
        </div>
      ))}
    </div>
  );
};

FloatingCartoonParticles.displayName = 'FloatingCartoonParticles';

export default React.memo(FloatingCartoonParticles);
