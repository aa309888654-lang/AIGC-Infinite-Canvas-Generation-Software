import React, { useRef, useEffect } from 'react';

const SerenadeWaveGrid: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;
    let lastPaintAt = 0;
    let gradients: CanvasGradient[] = [];
    const isCompactViewport = () => window.matchMedia('(max-width: 768px)').matches;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const rows = isCompactViewport() ? 14 : 22;
      gradients = Array.from({ length: rows + 1 }, (_, row) => {
        const gradient = ctx.createLinearGradient(0, 0, rect.width, 0);
        gradient.addColorStop(0, `rgba(0, 255, 255, ${0.03 + row * 0.002})`);
        gradient.addColorStop(0.5, `rgba(139, 92, 246, ${0.05 + row * 0.003})`);
        gradient.addColorStop(1, `rgba(255, 0, 255, ${0.03 + row * 0.002})`);
        return gradient;
      });
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = (now: number) => {
      animationId = requestAnimationFrame(draw);
      if (now - lastPaintAt < 1000 / 30) return;
      lastPaintAt = now;

      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      ctx.clearRect(0, 0, width, height);

      const compact = isCompactViewport();
      const cols = compact ? 28 : 42;
      const rows = compact ? 14 : 22;
      const cellW = width / cols;
      const cellH = height / rows;

      // 绘制波浪网格线
      for (let row = 0; row <= rows; row++) {
        ctx.beginPath();
        for (let col = 0; col <= cols; col++) {
          const x = col * cellW;
          const baseY = row * cellH;

          // 多层波浪叠加
          const wave1 = Math.sin(col * 0.08 + time * 0.015 + row * 0.05) * 15;
          const wave2 = Math.sin(col * 0.15 + time * 0.02 + row * 0.1) * 8;
          const wave3 = Math.cos(col * 0.05 - time * 0.01 + row * 0.03) * 10;

          const y = baseY + wave1 + wave2 + wave3;

          if (col === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.strokeStyle = gradients[row] || 'rgba(139, 92, 246, 0.06)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // 绘制垂直线
      for (let col = 0; col <= cols; col += 3) {
        ctx.beginPath();
        for (let row = 0; row <= rows; row++) {
          const baseX = col * cellW;
          const y = row * cellH;

          const wave1 = Math.sin(col * 0.08 + time * 0.015 + row * 0.05) * 15;
          const wave2 = Math.sin(col * 0.15 + time * 0.02 + row * 0.1) * 8;
          const wave3 = Math.cos(col * 0.05 - time * 0.01 + row * 0.03) * 10;

          const x = baseX + wave1 * 0.3 + wave2 * 0.2 + wave3 * 0.2;

          if (row === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        const alpha = 0.02 + Math.sin(col * 0.1 + time * 0.01) * 0.015;
        ctx.strokeStyle = `rgba(139, 92, 246, ${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // 添加发光粒子
      for (let i = 0; i < (compact ? 10 : 14); i++) {
        const px = (Math.sin(i * 1.5 + time * 0.008) * 0.5 + 0.5) * width;
        const py = (Math.cos(i * 2.3 + time * 0.012) * 0.5 + 0.5) * height * 0.6 + height * 0.4;
        const size = 1 + Math.sin(i + time * 0.02) * 0.5;

        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(139, 92, 246, ${0.3 + Math.sin(i + time * 0.015) * 0.2})`;
        ctx.fill();
      }

      time++;
    };

    animationId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="serenade-wave-grid">
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default React.memo(SerenadeWaveGrid);
