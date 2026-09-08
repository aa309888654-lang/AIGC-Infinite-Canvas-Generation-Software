import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showHeader?: boolean;
  headerIcon?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className,
  size = 'md',
  showHeader = true,
  headerIcon
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-6xl"
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div 
        className={cn(
          "relative bg-[#1A1A1D] border border-[#2D2D2D] shadow-2xl overflow-hidden flex flex-col",
          "animate-scaleIn",
          sizeClasses[size],
          className
        )}
        style={{
          borderRadius: '8px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)'
        }}
        role="dialog"
        aria-modal="true"
      >
        {showHeader && title && (
          <div 
            className="flex items-center justify-between px-4 py-3 border-b border-[#2D2D2D]"
            style={{ background: 'linear-gradient(180deg, #252528 0%, #1A1A1D 100%)' }}
          >
            <div className="flex items-center gap-3">
              {headerIcon && (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#007AFF] to-[#0056CC] flex items-center justify-center">
                  {headerIcon}
                </div>
              )}
              <h2 className="text-sm font-semibold text-[#FAFAFA]" style={{ letterSpacing: '0.01em' }}>
                {title}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-[#71717A] hover:text-[#FAFAFA] hover:bg-[#3F3F46] transition-all duration-150"
              aria-label="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        
        {!showHeader && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-md text-[#71717A] hover:text-[#FAFAFA] hover:bg-[#3F3F46] transition-all duration-150 z-10"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        
        <div className="flex-1 overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
