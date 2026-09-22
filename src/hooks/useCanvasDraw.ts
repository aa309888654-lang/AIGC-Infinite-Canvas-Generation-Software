import { useRef, useEffect, useCallback } from 'react';

interface CanvasDrawOptions {
  containerRef?: React.RefObject<HTMLElement>;
  useDPR?: boolean;
  onDraw?: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
}

export function useCanvasDraw({
  containerRef,
  useDPR = false,
  onDraw,
}: CanvasDrawOptions = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasSizeRef = useRef({ width: 0, height: 0, dpr: window.devicePixelRatio });
  const requestAnimationFrameRef = useRef<number>();

  // Update canvas size when container size changes or window resizes
  useEffect(() => {
    const updateCanvasSize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      let width, height;
      if (containerRef?.current) {
        const rect = containerRef.current.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
      } else {
        width = canvas.offsetWidth;
        height = canvas.offsetHeight;
      }

      const dpr = useDPR ? window.devicePixelRatio : 1;

      // Only resize if dimensions or DPR changed
      if (
        width !== canvasSizeRef.current.width ||
        height !== canvasSizeRef.current.height ||
        dpr !== canvasSizeRef.current.dpr
      ) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        if (useDPR) {
          canvas.style.width = `${width}px`;
          canvas.style.height = `${height}px`;
        }
        canvasSizeRef.current = { width, height, dpr };
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [containerRef, useDPR]);

  // Draw function with requestAnimationFrame optimization
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width, height;
    if (containerRef?.current) {
      const rect = containerRef.current.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
    } else {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
    }

    const dpr = useDPR ? window.devicePixelRatio : 1;
    if (useDPR) {
      // 使用 setTransform 重置变换矩阵，避免 ctx.scale 累积叠加导致绘制内容越来越小
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } else {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Call the onDraw callback if provided
    onDraw?.(ctx, width, height);
  }, [containerRef, useDPR, onDraw]);

  // Draw with requestAnimationFrame
  const drawWithRAF = useCallback(() => {
    if (requestAnimationFrameRef.current) {
      cancelAnimationFrame(requestAnimationFrameRef.current);
    }
    requestAnimationFrameRef.current = requestAnimationFrame(draw);
  }, [draw]);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (requestAnimationFrameRef.current) {
        cancelAnimationFrame(requestAnimationFrameRef.current);
      }
    };
  }, []);

  return {
    canvasRef,
    draw,
    drawWithRAF,
    canvasSize: canvasSizeRef.current,
  };
}
