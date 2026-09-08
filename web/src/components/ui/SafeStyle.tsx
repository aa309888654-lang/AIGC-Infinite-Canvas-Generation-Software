import { useEffect, useRef } from 'react';

interface SafeStyleProps {
  css: string;
}

export function SafeStyle({ css }: SafeStyleProps) {
  const ref = useRef<HTMLStyleElement | null>(null);

  useEffect(() => {
    if (!ref.current) {
      ref.current = document.createElement('style');
      document.head.appendChild(ref.current);
    }
    ref.current.textContent = css;
    return () => {
      if (ref.current) {
        ref.current.remove();
        ref.current = null;
      }
    };
  }, [css]);

  return null;
}
