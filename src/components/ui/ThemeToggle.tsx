/**
 * 主题切换组件
 * 提供亮色/暗色主题切换功能
 */

import { useTheme } from '@/hooks/useTheme';
import { Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { toggleTheme, isDark } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        'flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200',
        'hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)]',
        'border border-[var(--border-subtle)]',
        className
      )}
      title={isDark ? '切换到亮色模式' : '切换到暗色模式'}
      style={{
        backgroundColor: 'var(--bg-surface)',
        color: 'var(--text-primary)',
      }}
    >
      {isDark ? (
        <Sun className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
      ) : (
        <Moon className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
      )}
    </button>
  );
}

export default ThemeToggle;