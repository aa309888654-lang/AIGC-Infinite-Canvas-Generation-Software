import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  isError?: boolean;
  errorMessage?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, isError, errorMessage, ...props }, ref) => {
    return (
      <div className="w-full relative">
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-3 text-[#71717A] pointer-events-none flex items-center justify-center">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              "w-full bg-[#1A1A1D] border rounded-lg px-3 py-2 text-sm text-[#FAFAFA] placeholder:text-[#71717A]",
              "focus:outline-none focus:ring-1 transition-all duration-200",
              icon ? "pl-9" : "",
              isError 
                ? "border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]" 
                : "border-white/10 focus:border-[#00E5FF] focus:ring-[#00E5FF]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              className
            )}
            {...props}
          />
        </div>
        {isError && errorMessage && (
          <p className="mt-1.5 text-xs text-[#EF4444]">{errorMessage}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
