import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, Languages } from 'lucide-react';
import { useLanguageStore } from '@/store/useLanguageStore';
import { getLanguageDisplayName, SUPPORTED_LANGUAGES } from '@/lib/i18n';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

const LANGUAGES = SUPPORTED_LANGUAGES.map((value) => ({ value, label: getLanguageDisplayName(value) }));

export function LanguageSwitcher({ menuPosition = 'right' }: { menuPosition?: 'right' | 'bottom' }) {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative flex justify-center">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'inline-flex h-9 min-w-[82px] items-center justify-center gap-1.5 rounded-lg px-2 text-white/70 transition-all',
          'hover:bg-white/[0.08] hover:text-white active:scale-[0.94]',
          open && 'bg-white/[0.1] text-white',
        )}
        title={getLanguageDisplayName(language)}
        aria-label={t('toolbar.language')}
        aria-expanded={open}
      >
        <Languages className="h-[18px] w-[18px]" strokeWidth={1.8} />
        <span className="max-w-[92px] truncate text-xs font-medium">{getLanguageDisplayName(language)}</span>
      </button>
      {open && (
        <div className={cn(
          'absolute z-[1200] w-56 overflow-hidden rounded-xl border border-white/[0.1] bg-[#161619]/95 p-1.5 shadow-2xl backdrop-blur-xl',
          menuPosition === 'bottom' ? 'right-0 top-11' : 'left-12 top-0',
        )}>
          <div className="px-2.5 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
            {t('toolbar.language')}
          </div>
          {LANGUAGES.map((item) => {
            const active = item.value === language;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  setLanguage(item.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
                  active ? 'bg-white/[0.09] text-white' : 'text-white/65 hover:bg-white/[0.06] hover:text-white',
                )}
              >
                <span className="flex h-5 w-5 items-center justify-center text-white/40">
                  {active ? <Check className="h-3.5 w-3.5 text-cyan-300" /> : <ChevronRight className="h-3 w-3" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-xs font-medium">{item.label}</span>
                  <span className="truncate text-[10px] text-white/35">{item.value}</span>
                </span>
              </button>
            );
          })}
          <div className="px-2.5 pb-1 pt-1 text-[10px] text-white/30">{t('language.preference_saved')}</div>
        </div>
      )}
    </div>
  );
}
