import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Check, X, AlertCircle, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toast: (type: ToastType, message: string) => void;
  showToast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within AdminToastProvider');
  return ctx;
};

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <Check className="w-5 h-5 text-emerald-400" />,
  error: <XCircle className="w-5 h-5 text-red-400" />,
  warning: <AlertCircle className="w-5 h-5 text-amber-400" />,
  info: <Info className="w-5 h-5 text-gray-400" />,
};

const bgMap: Record<ToastType, string> = {
  success: 'bg-emerald-500/10 border-emerald-500/20',
  error: 'bg-red-500/10 border-red-500/20',
  warning: 'bg-amber-500/10 border-amber-500/20',
  info: 'bg-gray-500/10 border-gray-500/20',
};

const textMap: Record<ToastType, string> = {
  success: 'text-emerald-400',
  error: 'text-red-400',
  warning: 'text-amber-400',
  info: 'text-gray-400',
};

export const AdminToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string) => {
      const id = Date.now().toString() + Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => removeToast(id), 3500);
    },
    [removeToast]
  );

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      addToast(type, message);
    },
    [addToast]
  );

  const value: ToastContextType = useMemo(() => ({
    toast: addToast,
    showToast,
    success: (m: string) => addToast('success', m),
    error: (m: string) => addToast('error', m),
    warning: (m: string) => addToast('warning', m),
    info: (m: string) => addToast('info', m),
  }), [addToast, showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 420 }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-lg shadow-black/20 animate-slide-in-right',
              bgMap[t.type]
            )}
          >
            {iconMap[t.type]}
            <span className={cn('text-sm font-medium flex-1', textMap[t.type])}>{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="p-0.5 rounded hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
