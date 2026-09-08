import { useState, useRef, useCallback, useMemo} from 'react';

interface VirtualScrollProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
  children: (item: T, index: number) => React.ReactNode;
}

export function VirtualScroll<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 3,
  children
}: VirtualScrollProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = items.length * itemHeight;

  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );
    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex);
  }, [items, visibleRange]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const offsetY = visibleRange.startIndex * itemHeight;

  return (
    <div
      ref={containerRef}
      className="overflow-y-auto"
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div
        className="relative w-full"
        style={{ height: totalHeight }}
      >
        <div
          className="absolute w-full"
          style={{ transform: `translateY(${offsetY}px)` }}
        >
          {visibleItems.map((item, i) => {
            const actualIndex = visibleRange.startIndex + i;
            return (
              <div key={actualIndex} style={{ height: itemHeight }}>
                {children(item, actualIndex)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
