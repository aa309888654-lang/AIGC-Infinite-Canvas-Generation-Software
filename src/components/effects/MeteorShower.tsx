import React, { memo, useMemo } from 'react';

/**
 * MeteorShower - 流星雨效果组件
 * 从右上方向左下方划过的渐变光线，模拟真实流星雨效果
 *
 * @param className - 自定义样式类名
 * @param count - 流星数量，默认 5
 */
interface MeteorShowerProps {
  className?: string;
  count?: number;
}

interface MeteorConfig {
  id: number;
  top: number;
  left: number;
  length: number;
  duration: number;
  delay: number;
  color: string;
}

const METEOR_COLORS = ['#00D4AA', '#1D4ED8'];

const MeteorShower = memo(({ className, count = 5 }: MeteorShowerProps) => {
  // 生成每颗流星的随机配置（固定值，避免重渲染抖动）
  const meteors: MeteorConfig[] = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      // 起始位置：分布在顶部和右侧区域
      top: Math.random() * 60, // 0% ~ 60%
      left: 30 + Math.random() * 70, // 30% ~ 100%
      // 长度: 80px ~ 200px
      length: 80 + Math.random() * 120,
      // 速度: 0.8s ~ 2s
      duration: 0.8 + Math.random() * 1.2,
      // 延迟: 0s ~ 8s（错开出场）
      delay: Math.random() * 8,
      // 颜色交替
      color: METEOR_COLORS[i % 2],
    }));
  }, [count]);

  return (
    <>
      <style>{`
        @keyframes meteor-shower-fall {
          0% {
            transform: translate(0, 0) rotate(215deg);
            opacity: 1;
          }
          70% {
            opacity: 1;
          }
          100% {
            transform: translate(-500px, 500px) rotate(215deg);
            opacity: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .meteor-shower-item {
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
          zIndex: 2,
        }}
      >
        {meteors.map((meteor) => (
          <div
            key={meteor.id}
            className="meteor-shower-item"
            style={{
              position: 'absolute',
              top: `${meteor.top}%`,
              left: `${meteor.left}%`,
              width: `${meteor.length}px`,
              height: '2px',
              background: `linear-gradient(to right, ${meteor.color}, transparent)`,
              borderRadius: '999px',
              transform: 'rotate(215deg)',
              transformOrigin: 'left center',
              animation: `meteor-shower-fall ${meteor.duration}s linear ${meteor.delay}s infinite`,
              opacity: 0,
              // 流星头部光点
              boxShadow: `
                0 0 6px 1px ${meteor.color}80,
                0 0 12px 2px ${meteor.color}40
              `,
            }}
          >
            {/* 头部亮点 (伪元素替代方案，使用真实 DOM) */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                boxShadow: `
                  0 0 4px 2px ${meteor.color},
                  0 0 8px 4px ${meteor.color}60,
                  0 0 16px 6px ${meteor.color}30
                `,
              }}
            />
          </div>
        ))}
      </div>
    </>
  );
});

MeteorShower.displayName = 'MeteorShower';

export default MeteorShower;
