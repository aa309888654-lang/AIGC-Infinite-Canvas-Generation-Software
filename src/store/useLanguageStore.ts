/**
 * 全局语言状态管理
 * 订阅 i18n 单例的语言变更，触发 React 组件重渲染
 */
import { create } from 'zustand';
import { i18n, setLanguage as persistLanguage, type Language } from '@/lib/i18n';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: i18n.getCurrentLanguage(),
  setLanguage: (lang: Language) => {
    persistLanguage(lang);
    set({ language: lang });
  },
}));

// 订阅 i18n 单例的语言变更，同步到 store
i18n.onLanguageChange((lang) => {
  useLanguageStore.setState({ language: lang });
});
