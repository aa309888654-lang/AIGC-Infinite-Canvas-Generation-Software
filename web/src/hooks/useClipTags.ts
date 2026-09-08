/**
 * 片段标签Hook
 * 支持给片段添加标签和分类
 */

import { useState, useCallback } from 'react';

export interface ClipTag {
  id: string;
  name: string;
  color: string;
  description?: string;
  createdAt: number;
}

export interface ClipTaggingState {
  tags: ClipTag[];
  clipTags: Map<number, Set<string>>;
}

const DEFAULT_TAGS: ClipTag[] = [
  {
    id: 'important',
    name: '重要',
    color: '#EF4444',
    description: '标记为重要片段',
    createdAt: 0,
  },
  {
    id: 'good',
    name: '优质',
    color: '#10B981',
    description: '高质量片段',
    createdAt: 0,
  },
  {
    id: 'review',
    name: '待审核',
    color: '#00E5FF',
    description: '需要人工审核',
    createdAt: 0,
  },
  {
    id: 'music',
    name: '音乐',
    color: '#00E5FF',
    description: '包含音乐的片段',
    createdAt: 0,
  },
  {
    id: 'speech',
    name: '语音',
    color: '#9CA3AF',
    description: '包含语音的片段',
    createdAt: 0,
  },
];

export function useClipTags() {
  const [state, setState] = useState<ClipTaggingState>({
    tags: DEFAULT_TAGS,
    clipTags: new Map(),
  });

  const addTag = useCallback((name: string, color: string, description?: string) => {
    const tag: ClipTag = {
      id: `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      color,
      description,
      createdAt: Date.now(),
    };

    setState(prev => ({
      ...prev,
      tags: [...prev.tags, tag],
    }));

    return tag.id;
  }, []);

  const removeTag = useCallback((tagId: string) => {
    setState(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t.id !== tagId),
      clipTags: new Map(
        Array.from(prev.clipTags.entries()).map(([clipIndex, tags]) => [
          clipIndex,
          new Set(Array.from(tags).filter(id => id !== tagId)),
        ])
      ),
    }));
  }, []);

  const tagClip = useCallback((clipIndex: number, tagId: string) => {
    setState(prev => {
      const newClipTags = new Map(prev.clipTags);
      const existingTags = newClipTags.get(clipIndex) || new Set();
      newClipTags.set(clipIndex, new Set([...existingTags, tagId]));
      return { ...prev, clipTags: newClipTags };
    });
  }, []);

  const untagClip = useCallback((clipIndex: number, tagId: string) => {
    setState(prev => {
      const newClipTags = new Map(prev.clipTags);
      const existingTags = newClipTags.get(clipIndex);
      if (existingTags) {
        existingTags.delete(tagId);
        if (existingTags.size === 0) {
          newClipTags.delete(clipIndex);
        }
      }
      return { ...prev, clipTags: newClipTags };
    });
  }, []);

  const toggleClipTag = useCallback((clipIndex: number, tagId: string) => {
    setState(prev => {
      const newClipTags = new Map(prev.clipTags);
      const existingTags = new Set(newClipTags.get(clipIndex) || []);

      if (existingTags.has(tagId)) {
        existingTags.delete(tagId);
      } else {
        existingTags.add(tagId);
      }

      if (existingTags.size > 0) {
        newClipTags.set(clipIndex, existingTags);
      } else {
        newClipTags.delete(clipIndex);
      }

      return { ...prev, clipTags: newClipTags };
    });
  }, []);

  const getClipTags = useCallback((clipIndex: number): ClipTag[] => {
    const tagIds = state.clipTags.get(clipIndex) || new Set();
    return state.tags.filter(t => tagIds.has(t.id));
  }, [state.tags, state.clipTags]);

  const getClipsByTag = useCallback((tagId: string): number[] => {
    return Array.from(state.clipTags.entries())
      .filter(([, tags]) => tags.has(tagId))
      .map(([clipIndex]) => clipIndex);
  }, [state.clipTags]);

  const clearClipTags = useCallback((clipIndex: number) => {
    setState(prev => {
      const newClipTags = new Map(prev.clipTags);
      newClipTags.delete(clipIndex);
      return { ...prev, clipTags: newClipTags };
    });
  }, []);

  const getTagUsageCount = useCallback((tagId: string): number => {
    return Array.from(state.clipTags.values()).filter(tags => tags.has(tagId)).length;
  }, [state.clipTags]);

  return {
    tags: state.tags,
    addTag,
    removeTag,
    tagClip,
    untagClip,
    toggleClipTag,
    getClipTags,
    getClipsByTag,
    clearClipTags,
    getTagUsageCount,
  };
}
