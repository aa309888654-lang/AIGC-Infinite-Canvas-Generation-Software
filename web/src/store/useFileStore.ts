import { ensureAuthToken, getAuthToken, clearAuthToken } from '@/lib/auth-check';
import { transformLocalhostUrl } from '@/lib/api-config';
import { create } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';
import { FileItem } from '@/types/ai-models';
import { getProxiedImageUrl } from '@/lib/utils';
import {
  saveImageToLocal,
  saveVideoToLocal,
  saveAudioToLocal,
  type SaveResult,
} from '@/services/local-save';
import { invoke } from '@tauri-apps/api/core';

import { useTimelineStore } from './editmaster/useTimelineStore';
import type { MediaAsset } from './editmaster/types';
import { mergeFetchedCloudFiles } from './file-catalog-merge';

const safeStorage: PersistStorage<any> = {
  getItem: (name: string): StorageValue<any> | Promise<StorageValue<any>> | null => {
    try {
      const raw = localStorage.getItem(name);
      if (raw === null) return null;
      const parsed = JSON.parse(raw) as StorageValue<any>;
      if (parsed && typeof parsed === 'object' && 'state' in parsed) return parsed;
      localStorage.removeItem(name);
      return null;
    } catch (e) {
      console.warn('[FileStore] localStorage getItem 失败，清除脏数据:', name);
      localStorage.removeItem(name);
      return null;
    }
  },
  setItem: (name: string, value: unknown): void => {
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(name, serialized);
    } catch (e) {
      if (
        e instanceof DOMException &&
        (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
      ) {
        console.error('[FileStore] ⚠️ localStorage 配额已满，尝试清理旧数据...');
        try {
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('infinite-flow-')) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach((k) => localStorage.removeItem(k));
          const serialized = typeof value === 'string' ? value : JSON.stringify(value);
          localStorage.setItem(name, serialized);
          // console.log('[FileStore] ✅ 清理后写入成功');
        } catch (retryError) {
          console.error('[FileStore] ❌ 清理后仍无法写入，放弃持久化:', retryError);
        }
      } else {
        console.warn('[FileStore] localStorage setItem 失败:', e);
      }
    }
  },
  removeItem: (name: string): void => {
    try {
      localStorage.removeItem(name);
    } catch (e) {
      console.warn('[FileStore] localStorage removeItem 失败:', e);
    }
  },
};

export interface StoragePaths {
  base: string;
  images: string;
  videos: string;
  audios: string;
  documents: string;
  outputs: string;
}

export interface DiskSpaceInfo {
  totalSpace: number;
  freeSpace: number;
  usedSpace: number;
  usagePercent: number;
  isLowSpace: boolean;
}

export interface FileState {
  files: FileItem[];
  storagePaths: StoragePaths;
  diskSpace: DiskSpaceInfo | null;
  isMonitoringDisk: boolean;
  isLoadingCloudFiles: boolean;

  addFile: (file: FileItem) => void;
  registerGeneratedFile: (file: Omit<FileItem, 'id' | 'createdAt'> & { id?: string; createdAt?: string }) => Promise<FileItem>;
  deleteFile: (fileId: string) => void;
  updateFile: (fileId: string, updates: Partial<FileItem>) => void;
  clearFiles: () => void;
  setFiles: (files: FileItem[]) => void;

  // 云端文件同步
  fetchCloudFiles: (options?: { type?: string; onlyDeleted?: boolean; includeDeleted?: boolean }) => Promise<void>;
  softDeleteCloudFile: (fileId: string) => Promise<boolean>;
  restoreCloudFile: (fileId: string) => Promise<boolean>;
  permanentlyDeleteCloudFile: (fileId: string) => Promise<boolean>;
  uploadThumbnail: (fileId: string, thumbnailDataUrl: string) => Promise<string | null>;

  setStoragePath: (path: string) => void;
  setSpecificStoragePath: (type: keyof StoragePaths, path: string) => void;
  resetStoragePaths: () => void;

  refreshDiskSpace: (path?: string) => Promise<void>;
  startDiskMonitoring: () => void;
  stopDiskMonitoring: () => void;

  saveImageToLocalFolder: (imageUrl: string, filename?: string) => Promise<SaveResult>;
  saveVideoToLocalFolder: (videoUrl: string, filename?: string) => Promise<SaveResult>;
  saveAudioToLocalFolder: (audioUrl: string, filename?: string) => Promise<SaveResult>;

  deleteLocalFile: (path: string) => Promise<boolean>;
  deleteLocalFiles: (paths: string[]) => Promise<string[]>;
  copyLocalFile: (source: string, dest: string) => Promise<string>;
  moveLocalFile: (source: string, dest: string) => Promise<string>;
  renameLocalFile: (oldPath: string, newName: string) => Promise<string>;
  createLocalDirectory: (path: string, recursive?: boolean) => Promise<void>;
}

const defaultStoragePaths = (base: string): StoragePaths => ({
  base,
  images: `${base}\\Images`,
  videos: `${base}\\Videos`,
  audios: `${base}\\Audios`,
  documents: `${base}\\Documents`,
  outputs: `${base}\\Outputs`,
});

export const useFileStore = create<FileState>()(
  persist(
    (set, get) => {
      let diskMonitorInterval: number | null = null;

      return {
        files: [],
        storagePaths: defaultStoragePaths('C:\\AI+AE\\InfiniteFlowStudio'),
        diskSpace: null,
        isMonitoringDisk: false,
        isLoadingCloudFiles: false,

        addFile: (file) => {
          set((state) => ({ files: [file, ...state.files] }));

          if (file.type !== 'video' && file.type !== 'image' && file.type !== 'audio') {
            return;
          }

          // 异步添加到魔法剪辑的资源池，并生成缩略图
          (async () => {
            try {
              let thumbnailUrl = file.thumbnailUrl || '';
              let duration = file.metadata?.duration;
              
              // 如果没有缩略图，尝试生成
              if (!thumbnailUrl && file.url && (file.type === 'video' || file.type === 'image')) {
                if (file.type === 'video') {
                  thumbnailUrl = await new Promise<string>((resolve, _reject) => {
                    const video = document.createElement('video');
                    const proxiedVideoUrl = getProxiedImageUrl(file.url);
                    if (proxiedVideoUrl === file.url) {
                      video.crossOrigin = 'anonymous';
                    }
                    video.preload = 'metadata';
                    video.muted = true;
                    video.src = proxiedVideoUrl;
                    
                    video.onloadedmetadata = () => {
                      duration = video.duration;
                      video.currentTime = Math.min(1, video.duration * 0.1 || 0);
                    };
                    
                    video.onseeked = () => {
                      try {
                        const canvas = document.createElement('canvas');
                        const aspectRatio = video.videoWidth / video.videoHeight;
                        const maxWidth = 320;
                        const maxHeight = 180;
                        
                        let width, height;
                        if (aspectRatio > maxWidth / maxHeight) {
                          width = maxWidth;
                          height = Math.round(maxWidth / aspectRatio);
                        } else {
                          height = maxHeight;
                          width = Math.round(maxHeight * aspectRatio);
                        }
                        
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                          ctx.drawImage(video, 0, 0, width, height);
                          resolve(canvas.toDataURL('image/jpeg', 0.7));
                        } else {
                          resolve('');
                        }
                      } catch (err) {
                        resolve('');
                      }
                    };
                    
                    video.onerror = () => resolve('');
                  });
                } else if (file.type === 'image') {
                  thumbnailUrl = await new Promise<string>((resolve) => {
                    const img = new Image();
                    const proxiedUrl = getProxiedImageUrl(file.url);
                    if (proxiedUrl === file.url) {
                      img.crossOrigin = 'anonymous';
                    }
                    img.onload = () => {
                      try {
                        const canvas = document.createElement('canvas');
                        const maxWidth = 320;
                        const scale = Math.min(1, maxWidth / img.width);
                        canvas.width = img.width * scale;
                        canvas.height = img.height * scale;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                          resolve(canvas.toDataURL('image/jpeg', 0.7));
                        } else {
                          resolve('');
                        }
                      } catch (e) {
                        resolve('');
                      }
                    };
                    img.onerror = () => resolve('');
                    img.src = proxiedUrl;
                  });
                }
                
                // 更新自身 store 的 thumbnailUrl
                if (thumbnailUrl) {
                  get().updateFile(file.id, { thumbnailUrl, metadata: { ...file.metadata, duration } });
                }

                if (thumbnailUrl && file.source === 'cloud' && file.id) {
                  get().uploadThumbnail(file.id, thumbnailUrl);
                }
              }

              // 添加到魔法剪辑
              useTimelineStore.getState().addAsset({
                id: file.id,
                name: file.name,
                type: file.type === 'video' ? 'video' : file.type === 'image' ? 'image' : 'audio',
                url: file.url,
                thumbnailUrl: thumbnailUrl || file.thumbnailUrl,
                duration: duration || file.metadata?.duration || (file.type === 'video' ? 5 : undefined),
                file: null,
              } as MediaAsset);
            } catch (err) {
              console.error('[FileStore] Failed to add asset to timelineStore', err);
              useTimelineStore.getState().addAsset({
                id: file.id,
                name: file.name,
                type: file.type === 'video' ? 'video' : file.type === 'image' ? 'image' : 'audio',
                url: file.url,
                file: null,
              } as MediaAsset);
            }
          })();
        },

        registerGeneratedFile: async (input) => {
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).slice(2, 8);
          const fileId = input.id || `generated_${timestamp}_${randomSuffix}`;
          const createdAt = input.createdAt || new Date().toISOString();
          const initialFile: FileItem = {
            ...input,
            id: fileId,
            createdAt,
            source: input.source || 'generated',
            metadata: {
              ...input.metadata,
              generatedAt: timestamp,
              isProcessing: true,
            },
          };

          const existingById = get().files.find((file) => file.id === initialFile.id);
          const existingByUrl = initialFile.url
            ? get().files.find((file) => file.url === initialFile.url && file.type === initialFile.type)
            : undefined;
          const existingByName = get().files.find((file) => file.name === initialFile.name);
          
          if (!existingById && !existingByUrl && !existingByName) {
            get().addFile(initialFile);
          } else {
            const existingFile = existingById || existingByUrl || existingByName;
            get().updateFile(existingFile.id, {
              ...initialFile,
              id: existingFile.id,
            });
          }

          const persistedId = (existingById || existingByUrl || existingByName)?.id || fileId;

          const syncToCloud = async () => {
            const token = getAuthToken();

            // 跳过失效 URL：旧的 /storage/aicg-files/ 路径、已废弃跨域资源、blob/data URL
            // BUG-4: 同时跳过 localhost/内网地址，避免被后端 SSRF 防护拦截返回 403
            const fileUrl = initialFile.url || '';
            const isInvalidLegacyUrl = /\/storage\/aicg-files\//.test(fileUrl)
              || /sudu\.sqxw\.cn/i.test(fileUrl)
              || /^(blob|data):/i.test(fileUrl)
              || /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/i.test(fileUrl);
            if (isInvalidLegacyUrl) {
              get().updateFile(persistedId, {
                metadata: {
                  ...get().files.find(f => f.id === persistedId)?.metadata,
                  isProcessing: false,
                  isSynced: false,
                  syncError: 'URL 已失效，跳过云端同步',
                },
              });
              return false;
            }

            if (token && /^https?:\/\//i.test(initialFile.url)) {
              try {
                const response = await fetch(`/api/v1/files/upload-url`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    url: initialFile.url,
                    type: initialFile.type,
                    name: initialFile.name,
                  }),
                });

                if (!response.ok) {
                  // BUG-4: 403 通常是配额已满或内网地址限制，静默跳过不记为错误
                  if (response.status === 403) {
                    let quotaBody: { message?: string } | null = null;
                    try { quotaBody = await response.json(); } catch { /* ignore */ }
                    get().updateFile(persistedId, {
                      metadata: {
                        ...get().files.find(f => f.id === persistedId)?.metadata,
                        isProcessing: false,
                        isSynced: false,
                        syncError: quotaBody?.message === '存储空间已满' ? undefined : (quotaBody?.message || '同步被拒绝'),
                      },
                    });
                    return false;
                  }
                  throw new Error(`上传请求失败: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                if (data?.success) {
                  get().updateFile(persistedId, {
                    id: data.fileId || persistedId,
                    source: 'cloud',
                    url: data.fileUrl || initialFile.url,
                    thumbnailUrl: data.thumbnailUrl || initialFile.thumbnailUrl,
                    metadata: {
                      ...get().files.find(f => f.id === persistedId)?.metadata,
                      isProcessing: false,
                      isSynced: true,
                    },
                  });
                  return true;
                }
              } catch (error) {
                // 静默处理同步失败，仅记录到文件 metadata，不再输出 error 级别日志
                get().updateFile(persistedId, {
                  metadata: {
                    ...get().files.find(f => f.id === persistedId)?.metadata,
                    isProcessing: false,
                    isSynced: false,
                    syncError: error instanceof Error ? error.message : '同步失败',
                  },
                });
                return false;
              }
            }
            get().updateFile(persistedId, {
              metadata: {
                ...get().files.find(f => f.id === persistedId)?.metadata,
                isProcessing: false,
                isSynced: false,
              },
            });
            return false;
          };

          const _saveLocally = async () => {
            try {
              if (initialFile.type === 'video') {
                await get().saveVideoToLocalFolder(initialFile.url, initialFile.name);
              } else if (initialFile.type === 'image') {
                await get().saveImageToLocalFolder(initialFile.url, initialFile.name);
              } else if (initialFile.type === 'audio') {
                await get().saveAudioToLocalFolder(initialFile.url, initialFile.name);
              }
              return true;
            } catch (error) {
              console.error('[FileStore] 生成内容保存本地失败:', error);
              return false;
            }
          };

          syncToCloud();
          // 移除自动保存到本地，避免在网页端弹出下载窗口
          // _saveLocally();

          return get().files.find((file) => file.id === persistedId || file.url === initialFile.url) || initialFile;
        },

        deleteFile: (fileId) =>
          set((state) => ({
            files: state.files.filter((file) => file.id !== fileId),
          })),

        updateFile: (fileId, updates) =>
          set((state) => ({
            files: state.files.map((file) => (file.id === fileId ? { ...file, ...updates } : file)),
          })),

        clearFiles: () => set({ files: [] }),

        setFiles: (files) => set({ files }),

        fetchCloudFiles: async (options) => {
          set({ isLoadingCloudFiles: true });
          try {
            const token = await ensureAuthToken().catch(() => getAuthToken());
            if (!token) return;

            const queryParams = new URLSearchParams();
            if (options?.type) queryParams.set('type', options.type);
            if (options?.onlyDeleted) queryParams.set('onlyDeleted', 'true');
            if (options?.includeDeleted) queryParams.set('includeDeleted', 'true');
            const query = queryParams.toString() ? `?${queryParams.toString()}` : '';

            const response = await fetch(`/api/v1/files/list${query}`, {
              headers: { Authorization: `Bearer ${token}` },
            });


            if (response.status === 401) { clearAuthToken(); return; }
            if (!response.ok) {
              throw new Error(`获取文件列表失败: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success && Array.isArray(data.files)) {
              const cloudFiles = data.files.map((f: Record<string, unknown>) => ({
                id: (f.id || f.fileId) as string,
                name: (f.originalName || f.filename || f.fileName) as string,
                type: (f.type || f.fileType || f.contentType || 'other') as string,
                url: transformLocalhostUrl((f.url as string) || ''),
                thumbnailUrl: f.thumbnailUrl
                  ? transformLocalhostUrl(f.thumbnailUrl as string)
                  : undefined,
                size: (f.size || f.fileSize) as number | undefined,
                createdAt: (f.createdAt || f.uploadedAt) as string | undefined,
                path: f.storagePath as string | undefined,
                duration: (f.metadata as Record<string, unknown>)?.duration as number | undefined,
                metadata: f.metadata as Record<string, unknown> | undefined,
                isDeleted: Boolean(f.isDeleted),
                deletedAt: f.deletedAt as string | undefined,
                source: 'cloud',
              }));
              set((state) => ({
                files: mergeFetchedCloudFiles(state.files, cloudFiles, options),
              }));
            }
          } catch (error) {
            console.error('[FileStore] 获取云端文件失败:', error);
          } finally {
            set({ isLoadingCloudFiles: false });
          }
        },

        softDeleteCloudFile: async (fileId: string) => {
          try {
            const token = getAuthToken();
            if (!token) return false;

            const response = await fetch(`/api/v1/files/${fileId}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });

            if (!response.ok) {
              throw new Error(`软删除文件失败: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return Boolean(data.success);
          } catch (error) {
            console.error('[FileStore] 软删除云端文件失败:', error);
            return false;
          }
        },

        restoreCloudFile: async (fileId: string) => {
          try {
            const token = getAuthToken();
            if (!token) return false;

            const response = await fetch(`/api/v1/files/${fileId}/restore`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
            });

            if (!response.ok) {
              throw new Error(`恢复文件失败: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return Boolean(data.success);
          } catch (error) {
            console.error('[FileStore] 恢复云端文件失败:', error);
            return false;
          }
        },

        permanentlyDeleteCloudFile: async (fileId: string) => {
          try {
            const token = getAuthToken();
            if (!token) return false;

            const response = await fetch(`/api/v1/files/${fileId}/permanent`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });

            if (!response.ok) {
              throw new Error(`永久删除文件失败: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return Boolean(data.success);
          } catch (error) {
            console.error('[FileStore] 永久删除云端文件失败:', error);
            return false;
          }
        },

        uploadThumbnail: async (fileId: string, thumbnailDataUrl: string): Promise<string | null> => {
          try {
            const token = getAuthToken();
            if (!token) return null;

            const res = await fetch(thumbnailDataUrl);
            const blob = await res.blob();

            const formData = new FormData();
            formData.append('thumbnail', blob, 'thumbnail.jpg');

            const response = await fetch(`/api/v1/files/${fileId}/thumbnail`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: formData,
            });

            if (!response.ok) {
              throw new Error(`上传缩略图失败: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            if (data.success && data.thumbnailUrl) {
              get().updateFile(fileId, { thumbnailUrl: data.thumbnailUrl });
              return data.thumbnailUrl;
            }
            return null;
          } catch (error) {
            console.error('[FileStore] 上传缩略图失败:', error);
            return null;
          }
        },

        setStoragePath: (path) => set({ storagePaths: defaultStoragePaths(path) }),

        setSpecificStoragePath: (type, path) =>
          set((state) => ({
            storagePaths: { ...state.storagePaths, [type]: path },
          })),

        resetStoragePaths: () =>
          set({ storagePaths: defaultStoragePaths('C:\\AI+AE\\InfiniteFlowStudio') }),

        refreshDiskSpace: async (path?: string) => {
          try {
            const targetPath = path || get().storagePaths.base;
            const space = await invoke<DiskSpaceInfo>('get_disk_space', { path: targetPath });
            set({ diskSpace: space });
          } catch (error) {
            console.error('刷新磁盘空间失败:', error);
          }
        },

        startDiskMonitoring: () => {
          if (diskMonitorInterval) return;
          set({ isMonitoringDisk: true });

          get().refreshDiskSpace();

          diskMonitorInterval = window.setInterval(() => {
            get().refreshDiskSpace();
          }, 30000);
        },

        stopDiskMonitoring: () => {
          if (diskMonitorInterval) {
            clearInterval(diskMonitorInterval);
            diskMonitorInterval = null;
          }
          set({ isMonitoringDisk: false });
        },

        saveImageToLocalFolder: async (
          imageUrl: string,
          filename?: string
        ): Promise<SaveResult> => {
          const { storagePaths } = get();
          if (!storagePaths.images) {
            const finalFilename = filename || `image_${Date.now()}.png`;
            try {
              const a = document.createElement('a');
              a.href = imageUrl;
              a.download = finalFilename;
              a.target = '_blank';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              return { success: true, filePath: finalFilename };
            } catch (error) {
              return { success: false, error: String(error) };
            }
          }
          return saveImageToLocal(imageUrl, storagePaths.images, filename);
        },

        saveVideoToLocalFolder: async (
          videoUrl: string,
          filename?: string
        ): Promise<SaveResult> => {
          const { storagePaths } = get();
          if (!storagePaths.videos) {
            const finalFilename = filename || `video_${Date.now()}.mp4`;
            try {
              const a = document.createElement('a');
              a.href = videoUrl;
              a.download = finalFilename;
              a.target = '_blank';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              return { success: true, filePath: finalFilename };
            } catch (error) {
              return { success: false, error: String(error) };
            }
          }
          return saveVideoToLocal(videoUrl, storagePaths.videos, filename);
        },

        saveAudioToLocalFolder: async (
          audioUrl: string,
          filename?: string
        ): Promise<SaveResult> => {
          const { storagePaths } = get();
          if (!storagePaths.audios) {
            const finalFilename = filename || `audio_${Date.now()}.mp3`;
            try {
              const a = document.createElement('a');
              a.href = audioUrl;
              a.download = finalFilename;
              a.target = '_blank';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              return { success: true, filePath: finalFilename };
            } catch (error) {
              return { success: false, error: String(error) };
            }
          }
          return saveAudioToLocal(audioUrl, storagePaths.audios, filename);
        },

        deleteLocalFile: async (path: string): Promise<boolean> => {
          return await invoke('delete_file', { path });
        },

        deleteLocalFiles: async (paths: string[]): Promise<string[]> => {
          return await invoke('delete_files', { paths });
        },

        copyLocalFile: async (source: string, dest: string): Promise<string> => {
          return await invoke('copy_file', { source, dest });
        },

        moveLocalFile: async (source: string, dest: string): Promise<string> => {
          return await invoke('move_file', { source, dest });
        },

        renameLocalFile: async (oldPath: string, newName: string): Promise<string> => {
          return await invoke('rename_file', { oldPath, newName });
        },

        createLocalDirectory: async (path: string, recursive: boolean = true): Promise<void> => {
          await invoke('create_directory', { path, recursive });
        },
      };
    },
    {
      name: 'infinite-flow-files',
      version: 4,
      storage: safeStorage,
      partialize: (state: FileState) => ({
        storagePaths: state.storagePaths,
        files: state.files,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // console.log('[FileStore] ✅ 存储路径配置恢复完成');
      },
      migrate: (persistedState: unknown, version) => {
        if (version === 1 || version === 2) {
          const oldState = persistedState as Record<string, unknown>;
          const basePath =
            version === 1
              ? (oldState.storagePath as string) || 'C:\\AI+AE\\InfiniteFlowStudio'
              : 'C:\\AI+AE\\InfiniteFlowStudio';
          return {
            storagePaths: defaultStoragePaths(basePath),
          };
        }
        if (version === 3) {
          // console.log('[FileStore] 🔄 v3→v4 迁移: 移除 files 持久化，仅保留 storagePaths');
          const oldState = persistedState as Record<string, unknown>;
          const state = oldState?.state as Record<string, unknown> | undefined;
          return {
            storagePaths:
              state?.storagePaths || defaultStoragePaths('C:\\AI+AE\\InfiniteFlowStudio'),
          };
        }
        return persistedState;
      },
    }
  )
);
