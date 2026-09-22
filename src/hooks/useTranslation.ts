import { useCallback } from 'react';
import { i18n } from '@/lib/i18n';
import { useLanguageStore } from '@/store/useLanguageStore';

export function useTranslation() {
  const language = useLanguageStore((state) => state.language);
  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => i18n.t(key, params),
    [language],
  );
  return { t, language };
}
