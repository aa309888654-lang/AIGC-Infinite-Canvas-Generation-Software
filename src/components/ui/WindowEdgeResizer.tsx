import React from 'react';
import { useWindowResize } from '@/hooks/useWindowResize';

interface WindowEdgeResizerProps {
  minWidth?: number;
  minHeight?: number;
  hotzoneSize?: number;
  showTooltip?: boolean;
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right';
  children: React.ReactNode;
  className?: string;
}

export const WindowEdgeResizer: React.FC<WindowEdgeResizerProps> = ({
  minWidth = 800,
  minHeight = 600,
  hotzoneSize = 8,
  showTooltip = true,
  tooltipPosition = 'top',
  children,
  className = ''
}) => {
  const {
    setContainerRef,
    resizeState,
    mousePosition,
    isInHotzone,
    hotzoneDirection,
    startResize,
    getCursor
  } = useWindowResize({
    minWidth,
    minHeight,
    hotzoneSize
  });

  const renderHotzone = (direction: string, isCorner: boolean = false) => {
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      zIndex: 9997,
      cursor: getCursor(direction)
    };

    const handleStyle: React.CSSProperties = isCorner
      ? {
          ...baseStyle,
          width: hotzoneSize,
          height: hotzoneSize
        }
      : {
          ...baseStyle,
          [direction.includes('n') || direction === 's' ? 'height' : 'width']: hotzoneSize,
          [direction.includes('n') || direction === 's' ? 'width' : 'height']: '100%'
        };

    const positionStyles: Record<string, React.CSSProperties> = {
      n: { top: 0, left: 0, right: 0, height: hotzoneSize },
      s: { bottom: 0, left: 0, right: 0, height: hotzoneSize },
      e: { right: 0, top: 0, bottom: 0, width: hotzoneSize },
      w: { left: 0, top: 0, bottom: 0, width: hotzoneSize },
      nw: { top: 0, left: 0 },
      ne: { top: 0, right: 0 },
      sw: { bottom: 0, left: 0 },
      se: { bottom: 0, right: 0 }
    };

    return (
      <div
        className={`window-edge-hotzone transition-opacity duration-150 ${
          isInHotzone && hotzoneDirection === direction 
            ? 'bg-gray-500/50' 
            : 'hover:bg-gray-500/30'
        }`}
        style={{
          ...handleStyle,
          ...positionStyles[direction]
        }}
        onMouseDown={(e) => startResize(direction, e)}
      />
    );
  };

  const renderTooltip = () => {
    if (!showTooltip || (!isInHotzone && !resizeState.isResizing)) return null;

    const tooltipStyle: React.CSSProperties = {
      position: 'fixed',
      zIndex: 9998,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      color: 'white',
      padding: '6px 10px',
      borderRadius: '6px',
      fontSize: '12px',
      fontFamily: 'monospace',
      pointerEvents: 'none',
      backdropFilter: 'blur(4px)',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    };

    const content = resizeState.isResizing
      ? `${resizeState.currentWidth} × ${resizeState.currentHeight}`
      : `${hotzoneDirection.toUpperCase()} - 拖拽调整窗口大小`;

    if (tooltipPosition === 'top') {
      tooltipStyle.bottom = window.innerHeight - mousePosition.y + 15;
      tooltipStyle.left = mousePosition.x;
    } else if (tooltipPosition === 'bottom') {
      tooltipStyle.top = mousePosition.y + 15;
      tooltipStyle.left = mousePosition.x;
    } else if (tooltipPosition === 'left') {
      tooltipStyle.right = window.innerWidth - mousePosition.x + 15;
      tooltipStyle.top = mousePosition.y;
    } else if (tooltipPosition === 'right') {
      tooltipStyle.left = mousePosition.x + 15;
      tooltipStyle.top = mousePosition.y;
    }

    return (
      <div style={tooltipStyle}>
        {content}
      </div>
    );
  };

  return (
    <div 
      ref={setContainerRef} 
      className={className}
      style={{ 
        position: 'relative',
        width: '100%',
        height: '100%'
      }}
    >
      {children}

      {renderHotzone('n')}
      {renderHotzone('s')}
      {renderHotzone('e')}
      {renderHotzone('w')}
      {renderHotzone('nw', true)}
      {renderHotzone('ne', true)}
      {renderHotzone('sw', true)}
      {renderHotzone('se', true)}

      {renderTooltip()}
    </div>
  );
};

export default WindowEdgeResizer;
