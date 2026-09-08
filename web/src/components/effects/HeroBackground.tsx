import React from 'react';

/**
 * Hero背景装饰组件 - 高可见度版
 * 参考图片效果：对角线光带 + 柔和辉光 + 粒子效果
 */

export const HeroBackground: React.FC = () => {
  // 生成固定的粒子位置（避免每次渲染变化）
  const particles = React.useMemo(() => {
    return Array.from({ length: 40 }).map((_, i) => {
      const colors = ['#3B82F6', '#1D4ED8', '#6366F1', '#3B82F6', '#1D4ED8', '#6366F1'];
      const color = colors[i % colors.length];
      const size = 3 + (i % 5) * 1.5;
      const left = 5 + (i * 7) % 90;
      const top = 3 + (i * 13) % 60;
      const opacity = 0.4 + (i % 4) * 0.15;
      const delay = (i * 0.3) % 5;
      const duration = 4 + (i % 3) * 2;
      return { color, size, left, top, opacity, delay, duration, id: i };
    });
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {/* 顶部主辉光 - 青绿色 */}
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          left: '20%',
          width: '60%',
          height: '60%',
          background: 'radial-gradient(ellipse at center, rgba(0, 212, 170, 0.15) 0%, rgba(29, 78, 216, 0.05) 40%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      {/* 右上角金色辉光 */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          right: '-5%',
          width: '50%',
          height: '50%',
          background: 'radial-gradient(ellipse at center, rgba(201, 169, 110, 0.12) 0%, transparent 60%)',
          filter: 'blur(70px)',
        }}
      />

      {/* 左下角青蓝辉光 */}
      <div
        style={{
          position: 'absolute',
          bottom: '-15%',
          left: '-10%',
          width: '55%',
          height: '55%',
          background: 'radial-gradient(ellipse at center, rgba(29, 78, 216, 0.1) 0%, transparent 55%)',
          filter: 'blur(60px)',
        }}
      />

      {/* 对角线光带 - 主光带1 (青绿) */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          right: '15%',
          width: '600px',
          height: '100px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(0, 212, 170, 0.25) 50%, transparent 100%)',
          transform: 'rotate(-35deg)',
          filter: 'blur(25px)',
          borderRadius: '50px',
        }}
      />

      {/* 对角线光带 - 主光带2 (青绿) */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          right: '10%',
          width: '500px',
          height: '80px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(0, 212, 170, 0.18) 50%, transparent 100%)',
          transform: 'rotate(-30deg)',
          filter: 'blur(20px)',
          borderRadius: '40px',
        }}
      />

      {/* 对角线光带 - 金色光带 */}
      <div
        style={{
          position: 'absolute',
          top: '25%',
          right: '20%',
          width: '450px',
          height: '70px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(201, 169, 110, 0.2) 50%, transparent 100%)',
          transform: 'rotate(-40deg)',
          filter: 'blur(22px)',
          borderRadius: '35px',
        }}
      />

      {/* 对角线光带 - 深青蓝光带 */}
      <div
        style={{
          position: 'absolute',
          top: '15%',
          right: '5%',
          width: '550px',
          height: '90px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(29, 78, 216, 0.15) 50%, transparent 100%)',
          transform: 'rotate(-25deg)',
          filter: 'blur(28px)',
          borderRadius: '45px',
        }}
      />

      {/* 对角线光带 - 额外光带 */}
      <div
        style={{
          position: 'absolute',
          top: '35%',
          right: '25%',
          width: '400px',
          height: '60px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(0, 212, 170, 0.12) 50%, transparent 100%)',
          transform: 'rotate(-45deg)',
          filter: 'blur(18px)',
          borderRadius: '30px',
        }}
      />

      {/* 粒子效果 */}
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            borderRadius: '50%',
            background: p.color,
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 4}px ${p.size * 2}px ${p.color}60, 0 0 ${p.size * 8}px ${p.size * 4}px ${p.color}30`,
            animation: `particleFloat ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
          }}
        />
      ))}

      {/* 底部波浪线条效果 */}
      <svg
        style={{
          position: 'absolute',
          bottom: '5%',
          left: 0,
          width: '100%',
          height: '150px',
          opacity: 0.15,
        }}
        viewBox="0 0 1920 150"
        preserveAspectRatio="none"
      >
        <path
          d="M0,75 Q240,30 480,75 T960,75 T1440,75 T1920,75"
          fill="none"
          stroke="#3B82F6"
          strokeWidth="2"
        />
        <path
          d="M0,90 Q240,45 480,90 T960,90 T1440,90 T1920,90"
          fill="none"
          stroke="#1D4ED8"
          strokeWidth="1.5"
          opacity="0.7"
        />
        <path
          d="M0,105 Q240,60 480,105 T960,105 T1440,105 T1920,105"
          fill="none"
          stroke="#6366F1"
          strokeWidth="1"
          opacity="0.5"
        />
      </svg>

      {/* 网格装饰 - 微妙的科技感 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(0, 212, 170, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 212, 170, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '100px 100px',
          maskImage: 'radial-gradient(ellipse at 50% 50%, black 0%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 50%, black 0%, transparent 70%)',
        }}
      />

      {/* 动画样式 */}
      <style>{`
        @keyframes particleFloat {
          0% {
            transform: translateY(0) translateX(0);
            opacity: 0.4;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateY(-40px) translateX(20px);
            opacity: 0.4;
          }
        }
      `}</style>
    </div>
  );
};

export default HeroBackground;
