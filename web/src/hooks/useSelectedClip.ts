/**
 * useSelectedClip — 选中剪辑片段 Hook（存根）
 *
 * AI剪辑板块已移除，此文件保留空实现以维持编译兼容。
 */

import { useState } from 'react';

export function useSelectedClip() {
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);

  return {
    selectedClipIds,
    setSelectedClipIds,
    selectClip: (_id: string) => {},
    deselectClip: (_id: string) => {},
    clearSelection: () => setSelectedClipIds([]),
    isSelected: (_id: string) => false,
  };
}