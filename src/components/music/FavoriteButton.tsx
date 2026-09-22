import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { musicService } from '@/services/music-service';

interface FavoriteButtonProps {
  songId: string;
  isFavorite: boolean;
  onToggle?: (newState: boolean) => void;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  songId,
  isFavorite: initialFavorite,
  onToggle,
  size = 'md',
  showLabel = false,
}) => {
  const [isFavorite, setIsFavorite] = useState(initialFavorite);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    setIsAnimating(true);
    
    try {
      const newState = !isFavorite;
      await musicService.toggleFavorite(songId, newState ? 'add' : 'remove');
      setIsFavorite(newState);
      onToggle?.(newState);
    } catch (error) {
      console.error('[FavoriteButton] Failed to toggle favorite:', error);
    } finally {
      setIsLoading(false);
      setTimeout(() => setIsAnimating(false), 500);
    }
  };

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      className={cn(
        'flex items-center gap-2 transition-all',
        showLabel ? 'px-4 py-2 rounded-xl' : sizeClasses[size],
        !showLabel && 'rounded-full',
        isFavorite
          ? 'bg-red-500/20 hover:bg-red-500/30'
          : 'bg-gray-800/50 hover:bg-gray-700/50',
        isLoading && 'opacity-50'
      )}
      title={isFavorite ? '取消收藏' : '添加收藏'}
    >
      <Heart
        className={cn(
          iconSizes[size],
          'transition-all',
          isFavorite ? 'text-red-500 fill-red-500' : 'text-gray-400',
          isAnimating && isFavorite && 'scale-125'
        )}
      />
      {showLabel && (
        <span className={cn(
          'text-sm font-medium',
          isFavorite ? 'text-red-400' : 'text-gray-400'
        )}>
          {isFavorite ? '已收藏' : '收藏'}
        </span>
      )}
    </button>
  );
};

export default FavoriteButton;
