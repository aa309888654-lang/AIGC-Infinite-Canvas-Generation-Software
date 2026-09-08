import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  total,
  pageSize,
  onPageChange,
}) => {
  if (totalPages <= 1) return null;

  const maxVisible = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = startPage + maxVisible - 1;
  if (endPage > totalPages) {
    endPage = totalPages;
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
      <p className="text-gray-500 text-sm">
        显示 <span className="text-gray-300">{start}</span>-<span className="text-gray-300">{end}</span> 共 <span className="text-gray-300">{total}</span> 条
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 hover:bg-white/10 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-gray-400" />
        </button>
        {startPage > 1 && (
          <>
            <button onClick={() => onPageChange(1)} className={cn(
              'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
              currentPage === 1 ? 'bg-gray-600 text-white' : 'text-gray-400 hover:bg-white/10'
            )}>1</button>
            {startPage > 2 && <span className="text-gray-600 px-1">...</span>}
          </>
        )}
        {Array.from({ length: endPage - startPage + 1 }, (_, i) => {
          const page = startPage + i;
          return (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={cn(
                'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                currentPage === page
                  ? 'bg-gray-600 text-white'
                  : 'text-gray-400 hover:bg-white/10'
              )}
            >
              {page}
            </button>
          );
        })}
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="text-gray-600 px-1">...</span>}
            <button onClick={() => onPageChange(totalPages)} className={cn(
              'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
              currentPage === totalPages ? 'bg-gray-600 text-white' : 'text-gray-400 hover:bg-white/10'
            )}>{totalPages}</button>
          </>
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 hover:bg-white/10 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
