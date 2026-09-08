import React, { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title = '确认操作',
  message,
  confirmText = '确定',
  cancelText = '取消',
  variant = 'warning'
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: 'text-red-400',
      button: 'bg-red-500 hover:bg-red-600',
      border: 'border-red-500/30'
    },
    warning: {
      icon: 'text-yellow-400',
      button: 'bg-yellow-500 hover:bg-yellow-600',
      border: 'border-yellow-500/30'
    },
    info: {
      icon: 'text-gray-400',
      button: 'bg-[#007AFF] hover:bg-[#0056CC]',
      border: 'border-[#007AFF]/30'
    }
  };

  const style = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
        onClick={onCancel}
      />
      <div className={cn(
        "relative bg-[#1F1F1F] rounded-xl shadow-2xl border p-6 w-full max-w-sm mx-4",
        "transform transition-all duration-200 animate-in fade-in zoom-in-95",
        style.border
      )}>
        <div className="flex items-start gap-4">
          <div className={cn("p-2 rounded-lg bg-white/5", style.icon)}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
            <p className="text-sm text-gray-400 leading-relaxed">{message}</p>
          </div>
        </div>
        
        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-[#2D2D2D] hover:bg-[#3D3D3D] text-gray-300 rounded-lg transition-colors text-sm font-medium"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              "flex-1 px-4 py-2.5 text-white rounded-lg transition-colors text-sm font-medium",
              style.button
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

let pendingConfirm: ((result: boolean) => void) | null = null;

export const confirm = (message: string, options?: {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}): Promise<boolean> => {
  return new Promise((resolve) => {
    pendingConfirm = resolve;
    window.dispatchEvent(new CustomEvent('show-confirm-dialog', {
      detail: {
        message,
        title: options?.title,
        confirmText: options?.confirmText,
        cancelText: options?.cancelText,
        variant: options?.variant
      }
    }));
  });
};

export const handleConfirmResult = (result: boolean) => {
  if (pendingConfirm) {
    pendingConfirm(result);
    pendingConfirm = null;
  }
};
