/**
 * 统一素材库面板 — 资源库与文件管理全面打通
 *
 * 对外接口保持 AssetLibraryTab（all/project/image/video/audio/character/voice/favorite/recent/trash），
 * 内部直接复用 UnifiedFileManager 的完整能力（12分类、网格/列表视图、预览、收藏、回收站、
 * 拖拽到时间线、云空间进度条等），不再维护两套独立面板。
 */

import { useMemo } from 'react';
import type { AssetLibraryTab } from '@/store/useAppPanelStore';
import UnifiedFileManager from '@/components/file-manager/UnifiedFileManager';

type FileManagerTab = Parameters<typeof UnifiedFileManager>[0]['initialTab'];

/** 资源库 tab → 文件管理 tab 映射 */
const TAB_MAP: Record<AssetLibraryTab, FileManagerTab> = {
  all: 'all',
  project: 'project',
  image: 'image',
  video: 'video',
  audio: 'audio',
  character: 'character',
  voice: 'audio',        // 文件管理无独立 voice tab，映射到 audio
  favorite: 'favorite',
  recent: 'recent',
  trash: 'trash',
};

interface UnifiedAssetLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: AssetLibraryTab;
}

const UnifiedAssetLibrary: React.FC<UnifiedAssetLibraryProps> = ({
  isOpen,
  onClose,
  initialTab,
}) => {
  const fileManagerTab = useMemo<FileManagerTab>(() => {
    const tab = initialTab ?? 'all';
    return TAB_MAP[tab];
  }, [initialTab]);

  return (
    <UnifiedFileManager
      isOpen={isOpen}
      onClose={onClose}
      initialTab={fileManagerTab}
    />
  );
};

export default UnifiedAssetLibrary;
