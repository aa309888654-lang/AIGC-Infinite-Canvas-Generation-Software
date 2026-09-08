import { useEffect, useRef, useState, type RefObject } from 'react';

interface UseScrollAnimationOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

/**
 * 滚动动画 Hook
 * 当元素进入视口时触发动画
 */
export function useScrollAnimation<T extends HTMLElement = HTMLDivElement>(
  options: UseScrollAnimationOptions = {}
): [RefObject<T | null>, boolean] {
  const { threshold = 0.1, rootMargin = '0px', triggerOnce = true } = options;
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // 如果 triggerOnce 为 true 且已经可见，跳过
    if (triggerOnce && isVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (triggerOnce) {
            observer.unobserve(element);
          }
        } else if (!triggerOnce) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [threshold, rootMargin, triggerOnce, isVisible]);

  return [ref, isVisible];
}

/**
 * 批量滚动动画 Hook
 * 用于列表或网格中的多个元素
 */
export function useBatchScrollAnimation<T extends HTMLElement = HTMLDivElement>(
  itemCount: number,
  options: UseScrollAnimationOptions = {}
): RefObject<T | null>[] {
  const { threshold = 0.1, rootMargin = '0px' } = options;
  const refs = useRef<(RefObject<T | null> | null)[]>([]);
  const [_visibleItems, setVisibleItems] = useState<Set<number>>(new Set());

  // 初始化 refs 数组
  if (refs.current.length !== itemCount) {
    refs.current = Array(itemCount)
      .fill(null)
      .map((_, i) => refs.current[i] || { current: null });
  }

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    refs.current.forEach((refItem, index) => {
      const element = refItem?.current;
      if (!element) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setVisibleItems((prev) => new Set([...prev, index]));
            observer.unobserve(element);
          }
        },
        { threshold, rootMargin }
      );

      observer.observe(element);
      observers.push(observer);
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, [itemCount, threshold, rootMargin]);

  return refs.current as RefObject<T | null>[];
}

/**
 * 滚动方向检测 Hook
 */
export function useScrollDirection(): 'up' | 'down' | null {
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const updateScrollDirection = () => {
      const scrollY = window.scrollY;
      const direction = scrollY > lastScrollY.current ? 'down' : 'up';

      if (direction !== scrollDirection && (scrollY > 50 || scrollY < 50)) {
        setScrollDirection(direction);
      }
      lastScrollY.current = scrollY > 0 ? scrollY : 0;
    };

    window.addEventListener('scroll', updateScrollDirection, { passive: true });

    return () => {
      window.removeEventListener('scroll', updateScrollDirection);
    };
  }, [scrollDirection]);

  return scrollDirection;
}
