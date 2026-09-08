import { useState, useCallback, useRef } from 'react';

interface SwipeState {
  direction: 'left' | 'right' | 'up' | 'down' | null;
  distance: number;
  velocity: number;
}

interface UseSwipeOptions {
  threshold?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

export function useSwipe(options: UseSwipeOptions = {}) {
  const { threshold = 50, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown } = options;
  const [swipeState, setSwipeState] = useState<SwipeState>({
    direction: null,
    distance: 0,
    velocity: 0,
  });
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!touchStartRef.current) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const distance = Math.sqrt(deltaX ** 2 + deltaY ** 2);

    let direction: SwipeState['direction'] = null;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      direction = deltaX > 0 ? 'right' : 'left';
    } else {
      direction = deltaY > 0 ? 'down' : 'up';
    }

    setSwipeState({
      direction,
      distance,
      velocity: 0,
    });
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current) return;

    const { x: startX, y: startY, time: startTime } = touchStartRef.current;
    const endTime = Date.now();
    const timeDelta = endTime - startTime;

    const currentTouch = document.elementFromPoint(startX, startY);
    const endX = currentTouch ? (currentTouch as any).clientX || startX : startX;
    const endY = currentTouch ? (currentTouch as any).clientY || startY : startY;

    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const distance = Math.sqrt(deltaX ** 2 + deltaY ** 2);
    const _velocity = distance / timeDelta;

    if (distance > threshold) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0 && onSwipeRight) {
          onSwipeRight();
        } else if (deltaX < 0 && onSwipeLeft) {
          onSwipeLeft();
        }
      } else {
        if (deltaY > 0 && onSwipeDown) {
          onSwipeDown();
        } else if (deltaY < 0 && onSwipeUp) {
          onSwipeUp();
        }
      }
    }

    touchStartRef.current = null;
  }, [threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  return {
    swipeState,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}

interface UseLongPressOptions {
  onLongPress?: () => void;
  onLongPressComplete?: () => void;
  delay?: number;
}

export function useLongPress(options: UseLongPressOptions = {}) {
  const { onLongPress, onLongPressComplete, delay = 500 } = options;
  const [isPressed, setIsPressed] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  const start = useCallback(() => {
    setIsPressed(true);
    isLongPressRef.current = false;

    if (onLongPress) {
      timeoutRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        onLongPress();
      }, delay);
    }
  }, [delay, onLongPress]);

  const stop = useCallback(() => {
    setIsPressed(false);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (isLongPressRef.current && onLongPressComplete) {
      onLongPressComplete();
    }
  }, [onLongPressComplete]);

  return {
    isPressed,
    handlers: {
      onMouseDown: start,
      onMouseUp: stop,
      onMouseLeave: stop,
      onTouchStart: start,
      onTouchEnd: stop,
    },
  };
}

interface UsePinchZoomOptions {
  minScale?: number;
  maxScale?: number;
  onZoomChange?: (scale: number) => void;
}

export function usePinchZoom(options: UsePinchZoomOptions = {}) {
  const { minScale = 0.5, maxScale = 3, onZoomChange } = options;
  const [scale, setScale] = useState(1);
  const initialDistanceRef = useRef<number | null>(null);
  const initialScaleRef = useRef(1);

  const getDistance = (touches: TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      initialDistanceRef.current = getDistance(e.touches);
      initialScaleRef.current = scale;
    }
  }, [scale]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2 && initialDistanceRef.current) {
      const currentDistance = getDistance(e.touches);
      const newScale = (currentDistance / initialDistanceRef.current) * initialScaleRef.current;
      const clampedScale = Math.min(Math.max(newScale, minScale), maxScale);
      
      setScale(clampedScale);
      onZoomChange?.(clampedScale);
    }
  }, [minScale, maxScale, onZoomChange]);

  const handleTouchEnd = useCallback(() => {
    initialDistanceRef.current = null;
  }, []);

  return {
    scale,
    setScale,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}

export default {
  useSwipe,
  useLongPress,
  usePinchZoom,
};
