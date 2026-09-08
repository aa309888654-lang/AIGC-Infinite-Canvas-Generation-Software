import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return (
    <div
      className={cn(
        'animate-pulse bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 bg-[length:200%_100%]',
        className
      )}
    />
  );
};

export const SkeletonLoading: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col">
      {/* 顶部工具栏骨架 */}
      <div className="h-14 border-b border-white/10 flex items-center px-4 gap-4">
        <Skeleton className="w-32 h-8 rounded" />
        <div className="flex-1" />
        <Skeleton className="w-24 h-8 rounded-lg" />
        <Skeleton className="w-24 h-8 rounded-lg" />
        <Skeleton className="w-24 h-8 rounded-lg" />
        <Skeleton className="w-8 h-8 rounded-full" />
      </div>

      <div className="flex-1 flex">
        {/* 左侧面板骨架 */}
        <div className="w-64 border-r border-white/10 p-4 space-y-4">
          <Skeleton className="w-full h-10 rounded-lg" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="w-full h-12 rounded-lg" />
            ))}
          </div>
          <Skeleton className="w-full h-32 rounded-lg" />
        </div>

        {/* 主画布区域骨架 */}
        <div className="flex-1 p-8">
          {/* 工具栏骨架 */}
          <div className="flex gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="w-10 h-10 rounded-lg" />
            ))}
          </div>

          {/* 画布骨架 */}
          <div className="relative bg-[#1a1a1a] rounded-xl border border-white/10 h-[calc(100vh-200px)] overflow-hidden">
            {/* 网格背景 */}
            <div className="absolute inset-0 opacity-10">
              <div className="w-full h-full" style={{
                backgroundImage: `
                  linear-gradient(to right, #333 1px, transparent 1px),
                  linear-gradient(to bottom, #333 1px, transparent 1px)
                `,
                backgroundSize: '20px 20px'
              }} />
            </div>

            {/* 示例节点骨架 */}
            <div className="absolute top-20 left-20">
              <div className="bg-[#252525] rounded-lg border border-white/10 p-4 w-48">
                <div className="flex items-center gap-2 mb-3">
                  <Skeleton className="w-6 h-6 rounded" />
                  <Skeleton className="w-24 h-4 rounded" />
                </div>
                <Skeleton className="w-full h-8 rounded mb-2" />
                <Skeleton className="w-full h-8 rounded" />
              </div>
            </div>

            <div className="absolute top-40 left-72">
              <div className="bg-[#252525] rounded-lg border border-white/10 p-4 w-48">
                <div className="flex items-center gap-2 mb-3">
                  <Skeleton className="w-6 h-6 rounded" />
                  <Skeleton className="w-24 h-4 rounded" />
                </div>
                <Skeleton className="w-full h-8 rounded mb-2" />
                <Skeleton className="w-full h-8 rounded" />
              </div>
            </div>

            <div className="absolute bottom-32 right-32">
              <div className="bg-[#252525] rounded-lg border border-white/10 p-4 w-48">
                <div className="flex items-center gap-2 mb-3">
                  <Skeleton className="w-6 h-6 rounded" />
                  <Skeleton className="w-24 h-4 rounded" />
                </div>
                <Skeleton className="w-full h-8 rounded mb-2" />
                <Skeleton className="w-full h-8 rounded" />
              </div>
            </div>

            {/* 连接线骨架 */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <path
                d="M 140 100 Q 220 100 280 160"
                stroke="rgba(255, 255, 255, 0.1)"
                strokeWidth="2"
                fill="none"
                strokeDasharray="5,5"
              />
              <path
                d="M 340 180 Q 420 180 480 300"
                stroke="rgba(255, 255, 255, 0.1)"
                strokeWidth="2"
                fill="none"
                strokeDasharray="5,5"
              />
            </svg>

            {/* 缩放控制 */}
            <div className="absolute bottom-4 right-4 flex gap-2">
              <Skeleton className="w-8 h-8 rounded-lg" />
              <Skeleton className="w-16 h-8 rounded-lg" />
              <Skeleton className="w-8 h-8 rounded-lg" />
            </div>
          </div>
        </div>

        {/* 右侧面板骨架 */}
        <div className="w-72 border-l border-white/10 p-4 space-y-4">
          <Skeleton className="w-full h-40 rounded-lg" />
          <Skeleton className="w-full h-32 rounded-lg" />
          <Skeleton className="w-full h-48 rounded-lg" />
        </div>
      </div>

      {/* 底部状态栏骨架 */}
      <div className="h-8 border-t border-white/10 flex items-center px-4 text-xs text-gray-500">
        <Skeleton className="w-32 h-4 rounded" />
        <div className="flex-1" />
        <Skeleton className="w-24 h-4 rounded" />
      </div>
    </div>
  );
};

export default SkeletonLoading;
