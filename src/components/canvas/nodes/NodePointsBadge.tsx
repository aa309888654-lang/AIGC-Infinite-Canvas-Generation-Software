import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

export function NodePointsBadge({
  points,
  className,
}: {
  points: number;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/16 bg-white/[0.06] px-2 py-1 text-[10px] text-white/70',
        className,
      )}
    >
      <Zap className="h-3.5 w-3.5" />
      <span className="tabular-nums">{points}</span>
    </span>
  );
}
