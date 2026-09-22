import { useState, useCallback, useEffect, useRef } from 'react';

export interface WindowResizeOptions {
  minWidth?: number;
  minHeight?: number;
  hotzoneSize?: number;
}

export interface ResizeState {
  isResizing: boolean;
  direction: string;
  currentWidth: number;
  currentHeight: number;
}

export function useWindowResize(options: WindowResizeOptions = {}) {
  const {
    minWidth = 800,
    minHeight = 600,
    hotzoneSize = 8
  } = options;

  const [resizeState, setResizeState] = useState<ResizeState>({
    isResizing: false,
    direction: '',
    currentWidth: window.innerWidth,
    currentHeight: window.innerHeight
  });

  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isInHotzone, setIsInHotzone] = useState(false);
  const [hotzoneDirection, setHotzoneDirection] = useState('');

  const startPosRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const containerRef = useRef<HTMLElement | null>(null);

  const getScreenSize = useCallback(() => {
    const screen = window.screen as any as Screen & { availLeft?: number; availTop?: number };
    return {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      availLeft: screen.availLeft || 0,
      availTop: screen.availTop || 0
    };
  }, []);

  const getCursor = useCallback((direction: string): string => {
    const cursors: Record<string, string> = {
      n: 'ns-resize',
      s: 'ns-resize',
      e: 'ew-resize',
      w: 'ew-resize',
      ne: 'nesw-resize',
      nw: 'nwse-resize',
      se: 'nwse-resize',
      sw: 'nesw-resize'
    };
    return cursors[direction] || 'default';
  }, []);

  const detectHotzone = useCallback((x: number, y: number, rect: DOMRect): string => {
    if (resizeState.isResizing) return resizeState.direction;

    const threshold = hotzoneSize;
    const isTop = y - rect.top <= threshold;
    const isBottom = rect.bottom - y <= threshold;
    const isLeft = x - rect.left <= threshold;
    const isRight = rect.right - x <= threshold;

    if (isTop && isLeft) return 'nw';
    if (isTop && isRight) return 'ne';
    if (isBottom && isLeft) return 'sw';
    if (isBottom && isRight) return 'se';
    if (isTop) return 'n';
    if (isBottom) return 's';
    if (isLeft) return 'w';
    if (isRight) return 'e';

    return '';
  }, [hotzoneSize, resizeState.isResizing, resizeState.direction]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    // Check if mousePosition is actually different before setting state
    setMousePosition(prev => {
      if (prev.x === e.clientX && prev.y === e.clientY) return prev;
      return { x: e.clientX, y: e.clientY };
    });

    if (!resizeState.isResizing) {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const direction = detectHotzone(e.clientX, e.clientY, rect);
        const newIsInHotzone = direction !== '';
        
        setIsInHotzone(prev => prev === newIsInHotzone ? prev : newIsInHotzone);
        setHotzoneDirection(prev => prev === direction ? prev : direction);

        if (containerRef.current instanceof HTMLElement) {
          containerRef.current.style.cursor = direction ? getCursor(direction) : '';
        }
      }
      return;
    }

    const deltaX = e.clientX - startPosRef.current.x;
    const deltaY = e.clientY - startPosRef.current.y;
    const direction = resizeState.direction;

    let newWidth = startPosRef.current.width;
    let newHeight = startPosRef.current.height;
    const screen = getScreenSize();

    if (direction.includes('e')) {
      newWidth = Math.min(Math.max(startPosRef.current.width + deltaX, minWidth), screen.availWidth);
    }
    if (direction.includes('w')) {
      const potentialWidth = startPosRef.current.width - deltaX;
      if (potentialWidth >= minWidth) {
        newWidth = potentialWidth;
      } else {
        newWidth = minWidth;
      }
    }
    if (direction.includes('s')) {
      newHeight = Math.min(Math.max(startPosRef.current.height + deltaY, minHeight), screen.availHeight);
    }
    if (direction.includes('n')) {
      const potentialHeight = startPosRef.current.height - deltaY;
      if (potentialHeight >= minHeight) {
        newHeight = potentialHeight;
      } else {
        newHeight = minHeight;
      }
    }

    window.resizeTo(newWidth, newHeight);
    setResizeState(prev => {
      if (prev.currentWidth === newWidth && prev.currentHeight === newHeight) return prev;
      return {
        ...prev,
        currentWidth: newWidth,
        currentHeight: newHeight
      };
    });
  }, [resizeState, detectHotzone, getCursor, getScreenSize, minWidth, minHeight]);

  const handleMouseUp = useCallback(() => {
    if (resizeState.isResizing) {
      setResizeState(prev => {
        if (!prev.isResizing && prev.direction === '') return prev;
        return {
          ...prev,
          isResizing: false,
          direction: ''
        };
      });

      if (containerRef.current instanceof HTMLElement) {
        containerRef.current.style.cursor = hotzoneDirection ? getCursor(hotzoneDirection) : '';
      }
    }
  }, [resizeState.isResizing, hotzoneDirection, getCursor]);

  const _handleMouseLeave = useCallback(() => {
    if (!resizeState.isResizing) {
      setIsInHotzone(prev => prev === false ? prev : false);
      setHotzoneDirection(prev => prev === '' ? prev : '');
      if (containerRef.current instanceof HTMLElement) {
        containerRef.current.style.cursor = '';
      }
    }
  }, [resizeState.isResizing]);

  const startResize = useCallback((direction: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    startPosRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: window.innerWidth,
      height: window.innerHeight
    };

    setResizeState(prev => ({
      ...prev,
      isResizing: true,
      direction
    }));

    if (containerRef.current instanceof HTMLElement) {
      containerRef.current.style.cursor = getCursor(direction);
    }
  }, [getCursor]);

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => handleMouseMove(e);
    const handleGlobalMouseUp = () => handleMouseUp();

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  useEffect(() => {
    const handleResize = () => {
      setResizeState(prev => {
        if (prev.currentWidth === window.innerWidth && prev.currentHeight === window.innerHeight) return prev;
        return {
          ...prev,
          currentWidth: window.innerWidth,
          currentHeight: window.innerHeight
        };
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const setContainerRef = useCallback((element: HTMLElement | null) => {
    containerRef.current = element;
  }, []);

  return {
    containerRef,
    setContainerRef,
    resizeState,
    mousePosition,
    isInHotzone,
    hotzoneDirection,
    startResize,
    detectHotzone,
    getCursor,
    hotzoneSize
  };
}
