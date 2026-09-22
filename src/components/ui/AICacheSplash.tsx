import React, { useEffect, useMemo, useState } from 'react';
import './AICacheSplash.css';

const CACHE_STATUS_LINES = [
  'SYNC NEURAL CACHE...',
  '加载本地资源缓存...',
  'MOUNT AI MODULES...',
  '初始化创作引擎...',
  'WARMUP MODEL ROUTER...',
  'READY',
];

const MODULE_TAGS = ['CANVAS', 'RAG', 'MODELS', 'AGENTS'];

const PARTICLE_SEEDS = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: `${(i * 17 + 7) % 100}%`,
  top: `${(i * 23 + 11) % 100}%`,
  dur: `${3 + (i % 5) * 0.8}s`,
  delay: `${(i % 7) * 0.35}s`,
  dx: `${(i % 2 === 0 ? 1 : -1) * (12 + (i % 6) * 8)}px`,
  dy: `${-20 - (i % 8) * 12}px`,
}));

export interface AICacheSplashProps {
  /** boot: 首次进入站点；route: 路由懒加载 */
  variant?: 'boot' | 'route';
  className?: string;
}

export const AICacheSplash: React.FC<AICacheSplashProps> = ({
  variant = 'route',
  className = '',
}) => {
  const [lineIndex, setLineIndex] = useState(0);

  const statusText = useMemo(() => {
    if (variant === 'boot') return CACHE_STATUS_LINES[lineIndex];
    const routeLines = ['LOADING MODULE...', '读取页面缓存...', 'ASSEMBLE UI...'];
    return routeLines[lineIndex % routeLines.length];
  }, [lineIndex, variant]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLineIndex((prev) => (prev + 1) % CACHE_STATUS_LINES.length);
    }, variant === 'boot' ? 680 : 520);
    return () => window.clearInterval(interval);
  }, [variant]);

  return (
    <div
      className={`ai-cache-splash ${className}`.trim()}
      role="status"
      aria-live="polite"
        aria-label="正在加载小天画布"
    >
      <div className="ai-cache-splash__grid" aria-hidden />
      <div className="ai-cache-splash__scan" aria-hidden />

      <div className="ai-cache-splash__particles" aria-hidden>
        {PARTICLE_SEEDS.map((p) => (
          <span
            key={p.id}
            className="ai-cache-splash__particle"
            style={{
              left: p.left,
              top: p.top,
              ['--dur' as string]: p.dur,
              ['--delay' as string]: p.delay,
              ['--dx' as string]: p.dx,
              ['--dy' as string]: p.dy,
            }}
          />
        ))}
      </div>

      <span className="ai-cache-splash__corner ai-cache-splash__corner--tl" aria-hidden />
      <span className="ai-cache-splash__corner ai-cache-splash__corner--tr" aria-hidden />
      <span className="ai-cache-splash__corner ai-cache-splash__corner--bl" aria-hidden />
      <span className="ai-cache-splash__corner ai-cache-splash__corner--br" aria-hidden />

      <div className="ai-cache-splash__core">
        <div className="ai-cache-splash__orb-wrap" aria-hidden>
          <span className="ai-cache-splash__ring ai-cache-splash__ring--1" />
          <span className="ai-cache-splash__ring ai-cache-splash__ring--2" />
          <span className="ai-cache-splash__ring ai-cache-splash__ring--3" />
          <span className="ai-cache-splash__hex" />
          <span className="ai-cache-splash__orb" />
        </div>

          <h1 className="ai-cache-splash__brand">小天画布</h1>
        <p className="ai-cache-splash__brand-sub">AI CREATION SYSTEM</p>

        <p className="ai-cache-splash__status">{statusText}</p>

        <div className="ai-cache-splash__progress" aria-hidden>
          <div className="ai-cache-splash__progress-bar" />
          <div className="ai-cache-splash__progress-glow" />
        </div>

        <div className="ai-cache-splash__tags" aria-hidden>
          {MODULE_TAGS.map((tag) => (
            <span key={tag} className="ai-cache-splash__tag">{tag}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

/** 首次启动：最少展示时长 + 淡出
 *
 * 注意：不依赖 window.load 事件。如果页面有资源加载挂起（图片 404、CORS 等），
 * load 事件可能永远不触发，导致 splash 永久停留。改用 setTimeout 直接计时。
 */
export function BootCacheSplash({ minMs = 300 }: { minMs?: number }) {
  const [phase, setPhase] = useState<'show' | 'exit' | 'done'>('show');

  useEffect(() => {
    const elapsedSinceNavigation = performance.now();
    const remainingMinDuration = Math.max(0, minMs - elapsedSinceNavigation);
    const exitTimer = window.setTimeout(() => setPhase('exit'), remainingMinDuration);
    const doneTimer = window.setTimeout(() => setPhase('done'), remainingMinDuration + 180);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
    };
  }, [minMs]);

  if (phase === 'done') return null;

  return <AICacheSplash variant="boot" className={phase === 'exit' ? 'ai-cache-splash--exit' : ''} />;
}

export default AICacheSplash;
