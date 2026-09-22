/**
 * SeedButton - 随机种子按钮
 * 支持随机生成和固定种子的切换
 */
import React, { memo, useCallback, useMemo } from 'react';
import { RefreshCw, Lock, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SeedButtonProps {
  value: number; // -1 表示随机
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  size?: 'sm' | 'md';
  showLock?: boolean;
  locked?: boolean;
  onLockToggle?: (locked: boolean) => void;
  className?: string;
  accentColor?: string;
}

const DEFAULT_MIN = 0;
const DEFAULT_MAX = 9999999999;

export const SeedButton = memo<SeedButtonProps>(({
  value,
  onChange,
  min = DEFAULT_MIN,
  max = DEFAULT_MAX,
  label = '种子',
  size = 'md',
  showLock = false,
  locked = false,
  onLockToggle,
  className,
  accentColor = '#6610F2',
}) => {
  const isRandom = value === -1;

  const displayValue = useMemo(() => {
    if (isRandom) return '随机';
    return value.toString();
  }, [isRandom, value]);

  const handleRandomize = useCallback(() => {
    const newSeed = Math.floor(Math.random() * (max - min + 1)) + min;
    onChange(newSeed);
  }, [max, min, onChange]);

  const handleReset = useCallback(() => {
    onChange(-1);
  }, [onChange]);

  const handleLockToggle = useCallback(() => {
    if (onLockToggle) {
      onLockToggle(!locked);
    }
  }, [locked, onLockToggle]);

  const sizeClass = size === 'sm'
    ? 'py-1 px-2 text-[11px]'
    : 'py-1.5 px-3 text-xs';

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-white/60">{label}</span>
        {showLock && onLockToggle && (
          <button
            onClick={handleLockToggle}
            className={cn(
              'p-1 rounded transition-colors',
              locked
                ? 'text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20'
                : 'text-white/40 hover:text-white/60'
            )}
            title={locked ? '解锁种子' : '锁定种子'}
          >
            {locked
              ? <Lock className={iconSize} />
              : <Unlock className={iconSize} />
            }
          </button>
        )}
      </div>

      <div className="flex gap-1">
        <div
          className={cn(
            'flex-1 rounded text-center font-mono font-medium flex items-center justify-center gap-1',
            sizeClass,
            isRandom
              ? 'bg-[#252528] text-[#ABABAB]'
              : 'text-white'
          )}
          style={!isRandom ? { backgroundColor: `${accentColor}20`, border: `1px solid ${accentColor}40` } : undefined}
        >
          {isRandom ? (
            <span className="text-[#ABABAB]">🎲 {displayValue}</span>
          ) : (
            <span>{displayValue}</span>
          )}
        </div>

        <button
          onClick={handleRandomize}
          disabled={locked && !isRandom}
          className={cn(
            'rounded font-medium transition-all flex items-center justify-center gap-1',
            sizeClass,
            isRandom
              ? 'bg-[#252528] text-[#ABABAB] hover:bg-[#303033]'
              : 'text-white hover:opacity-90',
            locked && !isRandom && 'opacity-50 cursor-not-allowed'
          )}
          style={isRandom ? undefined : { backgroundColor: accentColor }}
          title="生成随机种子"
        >
          <RefreshCw className={cn(iconSize, isRandom && 'animate-spin')} />
          随机
        </button>

        {!isRandom && (
          <button
            onClick={handleReset}
            className={cn(
              'py-1.5 px-2 rounded text-xs bg-[#252528] text-[#ABABAB] hover:bg-[#303033] font-medium transition-colors flex items-center',
              size
            )}
            title="重置为随机"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
});

SeedButton.displayName = 'SeedButton';

export default SeedButton;
