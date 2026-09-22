import React, { useState, useCallback, useRef, useEffect } from 'react';

export type DividerDirection = 'horizontal' | 'vertical';

export interface ResizableDividerProps {
  direction?: DividerDirection;
  onResize?: (delta: number) => void;
  onResizeEnd?: (totalDelta: number) => void;
  thickness?: number;
  minSize?: number;
  maxSize?: number;
  color?: string;
  hoverColor?: string;
  activeColor?: string;
  showTooltip?: boolean;
  tooltipContent?: string;
}

export const ResizableDivider: React.FC<ResizableDividerProps> = ({
  direction = 'vertical',
  onResize,
  onResizeEnd,
  thickness = 4,
  color = 'transparent',
  hoverColor = 'rgba(156, 163, 175, 0.3)',
  activeColor = 'rgba(156, 163, 175, 0.6)',
  showTooltip = true,
  tooltipContent = '拖拽调整大小'
}) => {
  const [isHovering, setIsHovering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const startPosRef = useRef(0);
  const lastPosRef = useRef(0);
  const totalDeltaRef = useRef(0);
  const pendingDeltaRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startPos = direction === 'horizontal' ? e.clientY : e.clientX;
    startPosRef.current = startPos;
    lastPosRef.current = startPos;
    totalDeltaRef.current = 0;
    pendingDeltaRef.current = 0;
    setIsDragging(true);
    setShowTip(true);
  }, [direction]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const currentPos = direction === 'horizontal' ? e.clientY : e.clientX;
    const delta = currentPos - lastPosRef.current;
    
    if (delta !== 0 && onResize) {
      lastPosRef.current = currentPos;
      totalDeltaRef.current += delta;
      pendingDeltaRef.current += delta;

      if (animationFrameRef.current === null) {
        animationFrameRef.current = window.requestAnimationFrame(() => {
          if (pendingDeltaRef.current !== 0) {
            onResize(pendingDeltaRef.current);
            pendingDeltaRef.current = 0;
          }
          animationFrameRef.current = null;
        });
      }
    }
  }, [isDragging, direction, onResize]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (pendingDeltaRef.current !== 0 && onResize) {
        onResize(pendingDeltaRef.current);
        pendingDeltaRef.current = 0;
      }
      
      if (onResizeEnd) {
        onResizeEnd(totalDeltaRef.current);
      }
      
      setIsDragging(false);
      setShowTip(false);
    }
  }, [isDragging, onResize, onResizeEnd]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [handleMouseMove, handleMouseUp]);

  const getCursor = () => {
    if (isDragging || isHovering) {
      return direction === 'horizontal' ? 'ns-resize' : 'ew-resize';
    }
    return 'default';
  };

  const getBackgroundColor = () => {
    if (isDragging) return activeColor;
    if (isHovering) return hoverColor;
    return color;
  };

  const style: React.CSSProperties = {
    position: 'relative',
    flexShrink: 0,
    cursor: getCursor(),
    backgroundColor: getBackgroundColor(),
    transition: isDragging ? 'none' : 'background-color 0.15s ease',
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
    willChange: isDragging ? 'transform' : undefined,
  };

  if (direction === 'horizontal') {
    style.height = `${thickness}px`;
    style.width = '100%';
  } else {
    style.width = `${thickness}px`;
    style.height = '100%';
  }

  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    color: 'white',
    padding: '6px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontFamily: 'monospace',
    pointerEvents: 'none',
    backdropFilter: 'blur(4px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    zIndex: 10001,
    whiteSpace: 'nowrap',
  };

  const getTooltipPosition = () => {
    if (direction === 'horizontal') {
      tooltipStyle.left = '50%';
      tooltipStyle.transform = 'translateX(-50%)';
      tooltipStyle.top = isDragging ? '50%' : '-40px';
      tooltipStyle.transform = isDragging ? 'translateX(-50%) translateY(-50%)' : 'translateX(-50%)';
    } else {
      tooltipStyle.top = '50%';
      tooltipStyle.transform = 'translateY(-50%)';
      tooltipStyle.left = isDragging ? '50%' : '-40px';
      tooltipStyle.transform = isDragging ? 'translateY(-50%) translateX(-50%)' : 'translateY(-50%)';
    }
  };

  getTooltipPosition();

  return (
    <div 
      ref={containerRef}
      style={style}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => {
        setIsHovering(true);
        if (showTooltip) setShowTip(true);
      }}
      onMouseLeave={() => {
        if (!isDragging) {
          setIsHovering(false);
          setShowTip(false);
        }
      }}
    >
      {direction === 'horizontal' ? (
        <div 
          className="w-full h-1 bg-zinc-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ 
            opacity: isHovering || isDragging ? 1 : 0,
            maxWidth: '40px'
          }} 
        />
      ) : (
        <div 
          className="h-full w-1 bg-zinc-600 rounded-full transition-opacity"
          style={{ 
            opacity: isHovering || isDragging ? 1 : 0,
            maxHeight: '40px'
          }} 
        />
      )}
      
      {showTip && showTooltip && (
        <div style={tooltipStyle}>
          {tooltipContent}
        </div>
      )}
    </div>
  );
};

export default ResizableDivider;
