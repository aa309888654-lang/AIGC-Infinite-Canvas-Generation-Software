import type { ReactNode } from 'react';
import { useLanguageStore } from '@/store/useLanguageStore';

/**
 * 语言切换时通过 key 触发子树重挂载，确保未订阅 language 的组件也能刷新 t() 文案。
 */
export function LanguageRefreshBoundary({ children }: { children: ReactNode }) {
  const language = useLanguageStore((state) => state.language);
  return (
    <div key={language} className="contents">
      {children}
    </div>
  );
}
