import { useState, useEffect, useCallback, useMemo } from 'react';

type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

interface BreakpointConfig {
  name: Breakpoint;
  minWidth: number;
}

const BREAKPOINTS: BreakpointConfig[] = [
  { name: 'xs', minWidth: 0 },
  { name: 'sm', minWidth: 640 },
  { name: 'md', minWidth: 768 },
  { name: 'lg', minWidth: 1024 },
  { name: 'xl', minWidth: 1280 },
  { name: '2xl', minWidth: 1536 },
  { name: '3xl', minWidth: 1920 },
];

interface UseBreakpointResult {
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLargeDesktop: boolean;
  isGreaterThan: (breakpoint: Breakpoint) => boolean;
  isLessThan: (breakpoint: Breakpoint) => boolean;
  isBetween: (min: Breakpoint, max: Breakpoint) => boolean;
  width: number;
  height: number;
}

export function useBreakpoint(): UseBreakpointResult {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 720,
  });

  const currentBreakpoint = useMemo((): Breakpoint => {
    for (let i = BREAKPOINTS.length - 1; i >= 0; i--) {
      if (windowSize.width >= BREAKPOINTS[i].minWidth) {
        return BREAKPOINTS[i].name;
      }
    }
    return 'xs';
  }, [windowSize.width]);

  const isGreaterThan = useCallback(
    (breakpoint: Breakpoint): boolean => {
      const breakpointIndex = BREAKPOINTS.findIndex(b => b.name === breakpoint);
      const currentIndex = BREAKPOINTS.findIndex(b => b.name === currentBreakpoint);
      return currentIndex > breakpointIndex;
    },
    [currentBreakpoint]
  );

  const isLessThan = useCallback(
    (breakpoint: Breakpoint): boolean => {
      const breakpointIndex = BREAKPOINTS.findIndex(b => b.name === breakpoint);
      const currentIndex = BREAKPOINTS.findIndex(b => b.name === currentBreakpoint);
      return currentIndex < breakpointIndex;
    },
    [currentBreakpoint]
  );

  const isBetween = useCallback(
    (min: Breakpoint, max: Breakpoint): boolean => {
      const minIndex = BREAKPOINTS.findIndex(b => b.name === min);
      const maxIndex = BREAKPOINTS.findIndex(b => b.name === max);
      const currentIndex = BREAKPOINTS.findIndex(b => b.name === currentBreakpoint);
      return currentIndex >= minIndex && currentIndex <= maxIndex;
    },
    [currentBreakpoint]
  );

  const isMobile = useMemo(() => isLessThan('md'), [isLessThan]);
  const isTablet = useMemo(() => isBetween('md', 'lg'), [isBetween]);
  const isDesktop = useMemo(() => isGreaterThan('lg'), [isGreaterThan]);
  const isLargeDesktop = useMemo(() => isGreaterThan('xl'), [isGreaterThan]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return {
    breakpoint: currentBreakpoint,
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,
    isGreaterThan,
    isLessThan,
    isBetween,
    width: windowSize.width,
    height: windowSize.height,
  };
}

interface UseResponsiveValueOptions<T> {
  xs?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  '2xl'?: T;
  '3xl'?: T;
  defaultValue: T;
}

export function useResponsiveValue<T>(options: UseResponsiveValueOptions<T>): T {
  const { breakpoint } = useBreakpoint();

  return useMemo(() => {
    const orderedBreakpoints: Breakpoint[] = ['3xl', '2xl', 'xl', 'lg', 'md', 'sm', 'xs'];
    for (const bp of orderedBreakpoints) {
      if (options[bp] !== undefined) {
        return options[bp] as T;
      }
    }
    return options.defaultValue;
  }, [breakpoint, options]);
}

interface UseResponsiveClassOptions {
  base?: string;
  xs?: string;
  sm?: string;
  md?: string;
  lg?: string;
  xl?: string;
  '2xl'?: string;
  '3xl'?: string;
}

export function useResponsiveClass(options: UseResponsiveClassOptions): string {
  const { breakpoint } = useBreakpoint();

  return useMemo(() => {
    const classes: string[] = [];

    if (options.base) {
      classes.push(options.base);
    }

    const orderedBreakpoints: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'];
    const currentIndex = orderedBreakpoints.indexOf(breakpoint);

    for (let i = 0; i <= currentIndex; i++) {
      const bp = orderedBreakpoints[i];
      if (options[bp]) {
        classes.push(options[bp] as string);
      }
    }

    return classes.join(' ');
  }, [breakpoint, options]);
}

interface UseOrientationResult {
  isPortrait: boolean;
  isLandscape: boolean;
  orientation: 'portrait' | 'landscape';
}

export function useOrientation(): UseOrientationResult {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    typeof window !== 'undefined' && window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOrientationChange = () => {
      setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
    };

    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  return {
    isPortrait: orientation === 'portrait',
    isLandscape: orientation === 'landscape',
    orientation,
  };
}

interface UseTouchDeviceResult {
  isTouchDevice: boolean;
  hasCoarsePointer: boolean;
  hasFinePointer: boolean;
  supportsHover: boolean;
}

export function useTouchDevice(): UseTouchDeviceResult {
  const [deviceInfo, setDeviceInfo] = useState<UseTouchDeviceResult>({
    isTouchDevice: false,
    hasCoarsePointer: false,
    hasFinePointer: true,
    supportsHover: true,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
    const supportsHover = window.matchMedia('(hover: hover)').matches;

    setDeviceInfo({
      isTouchDevice,
      hasCoarsePointer,
      hasFinePointer,
      supportsHover,
    });
  }, []);

  return deviceInfo;
}

interface UseReducedMotionResult {
  prefersReducedMotion: boolean;
}

export function useReducedMotion(): UseReducedMotionResult {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return { prefersReducedMotion };
}

interface UseColorSchemeResult {
  colorScheme: 'light' | 'dark';
  isDark: boolean;
  isLight: boolean;
}

export function useColorScheme(): UseColorSchemeResult {
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setColorScheme(mediaQuery.matches ? 'dark' : 'light');

    const handleChange = (e: MediaQueryListEvent) => {
      setColorScheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return {
    colorScheme,
    isDark: colorScheme === 'dark',
    isLight: colorScheme === 'light',
  };
}

interface UseContainerQueriesOptions {
  containerRef: React.RefObject<HTMLElement>;
  breakpoints: { [key: string]: number };
}

export function useContainerQueries<T extends { [key: string]: number }>(
  options: UseContainerQueriesOptions
) {
  const { containerRef, breakpoints } = options;
  const [activeBreakpoints, setActiveBreakpoints] = useState<Set<keyof T>>(new Set());

  useEffect(() => {
    if (!containerRef.current || typeof ResizeObserver === 'undefined') return;

    const checkBreakpoints = (width: number) => {
      const active = new Set<keyof T>();
      Object.entries(breakpoints).forEach(([name, minWidth]) => {
        if (width >= minWidth) {
          active.add(name);
        }
      });
      setActiveBreakpoints(active);
    };

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        checkBreakpoints(entry.contentRect.width);
      }
    });

    observer.observe(containerRef.current);
    checkBreakpoints(containerRef.current.clientWidth);

    return () => observer.disconnect();
  }, [containerRef, breakpoints]);

  const isActive = useCallback(
    (breakpoint: keyof T): boolean => activeBreakpoints.has(breakpoint),
    [activeBreakpoints]
  );

  return {
    activeBreakpoints,
    isActive,
  };
}

type SimpleBreakpoint = 'mobile' | 'tablet' | 'desktop';

export function useResponsive(): {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  breakpoint: SimpleBreakpoint;
} {
  const { isMobile, isTablet, isDesktop } = useBreakpoint();

  const simpleBreakpoint = useMemo((): SimpleBreakpoint => {
    if (isMobile) return 'mobile';
    if (isTablet) return 'tablet';
    return 'desktop';
  }, [isMobile, isTablet]);

  return {
    isMobile,
    isTablet,
    isDesktop,
    breakpoint: simpleBreakpoint,
  };
}

export const responsiveUtils = {
  breakpoints: BREAKPOINTS,
  
  getBreakpoint: (width: number): Breakpoint => {
    for (let i = BREAKPOINTS.length - 1; i >= 0; i--) {
      if (width >= BREAKPOINTS[i].minWidth) {
        return BREAKPOINTS[i].name;
      }
    }
    return 'xs';
  },

  isGreaterThan: (current: Breakpoint, target: Breakpoint): boolean => {
    const currentIndex = BREAKPOINTS.findIndex(b => b.name === current);
    const targetIndex = BREAKPOINTS.findIndex(b => b.name === target);
    return currentIndex > targetIndex;
  },

  isLessThan: (current: Breakpoint, target: Breakpoint): boolean => {
    const currentIndex = BREAKPOINTS.findIndex(b => b.name === current);
    const targetIndex = BREAKPOINTS.findIndex(b => b.name === target);
    return currentIndex < targetIndex;
  },

  isBetween: (current: Breakpoint, min: Breakpoint, max: Breakpoint): boolean => {
    const minIndex = BREAKPOINTS.findIndex(b => b.name === min);
    const maxIndex = BREAKPOINTS.findIndex(b => b.name === max);
    const currentIndex = BREAKPOINTS.findIndex(b => b.name === current);
    return currentIndex >= minIndex && currentIndex <= maxIndex;
  },

  clamp: (value: number, min: number, max: number): number => {
    return Math.min(Math.max(value, min), max);
  },

  lerp: (start: number, end: number, t: number): number => {
    return start + (end - start) * t;
  },

  getResponsiveValue: <T>(
    width: number,
    options: UseResponsiveValueOptions<T>
  ): T => {
    const orderedBreakpoints: Breakpoint[] = ['3xl', '2xl', 'xl', 'lg', 'md', 'sm', 'xs'];
    
    for (const bp of orderedBreakpoints) {
      if (options[bp] !== undefined) {
        return options[bp] as T;
      }
    }
    return options.defaultValue;
  },
};
