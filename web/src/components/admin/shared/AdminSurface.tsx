import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminSectionProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function AdminSection({ title, description, action, children }: AdminSectionProps) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-[#111114]">
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-gray-400">{description}</p>}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function AdminLoadingState({ label = '加载中...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-white/[0.06] bg-[#111114] py-12 text-gray-400">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function AdminErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p>{message}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 text-xs font-medium text-red-200 underline decoration-red-200/40 underline-offset-4"
            >
              重试
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminEmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-8 text-center">
      <p className="text-sm font-medium text-white">{title}</p>
      {description && <p className="mt-1 text-xs text-gray-400">{description}</p>}
    </div>
  );
}

export function AdminMetric({
  label,
  value,
  subLabel,
  accentClassName,
}: {
  label: string;
  value: string | number;
  subLabel?: string;
  accentClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#111114] p-4">
      <div className="text-xs text-gray-400">{label}</div>
      <div className={cn('mt-2 text-2xl font-bold text-white', accentClassName)}>{value}</div>
      {subLabel && <div className="mt-1 text-xs text-gray-500">{subLabel}</div>}
    </div>
  );
}
