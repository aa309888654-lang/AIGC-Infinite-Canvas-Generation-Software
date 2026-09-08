/**
 * Blob URL 统一管理 hook
 *
 * 解决问题：VideoComposeNode、CharacterConsistencyNode、Director3DNode 等多个节点
 * 通过 URL.createObjectURL 创建 Blob URL 但永不释放，导致内存泄漏。
 *
 * 用法：
 *   const { createBlobUrl, revokeBlobUrl, revokeAllBlobUrls } = useBlobUrlManager();
 *   const url = createBlobUrl(blob);  // 自动登记
 *   // 组件 unmount 时自动 revoke 全部
 *
 *   // 重新生成前可手动清理：
 *   revokeAllBlobUrls();
 */

import { useRef, useCallback, useEffect } from 'react';

export interface UseBlobUrlManagerReturn {
  /** 创建并登记一个 Blob URL */
  createBlobUrl: (blob: Blob) => string;
  /** 释放指定 Blob URL（仅限本 hook 创建的） */
  revokeBlobUrl: (url: string) => void;
  /** 释放本 hook 创建的所有 Blob URL */
  revokeAllBlobUrls: () => void;
  /** 当前登记的 Blob URL 集合（debug 用） */
  blobUrlsRef: React.MutableRefObject<Set<string>>;
}

export function useBlobUrlManager(): UseBlobUrlManagerReturn {
  const blobUrlsRef = useRef<Set<string>>(new Set());

  const createBlobUrl = useCallback((blob: Blob): string => {
    const url = URL.createObjectURL(blob);
    blobUrlsRef.current.add(url);
    return url;
  }, []);

  const revokeBlobUrl = useCallback((url: string): void => {
    if (blobUrlsRef.current.has(url)) {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        // 释放失败可忽略
        console.warn('[useBlobUrlManager] revoke failed', e);
      }
      blobUrlsRef.current.delete(url);
    }
  }, []);

  const revokeAllBlobUrls = useCallback((): void => {
    blobUrlsRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        // 释放失败可忽略
        console.warn('[useBlobUrlManager] revokeAll failed', e);
      }
    });
    blobUrlsRef.current.clear();
  }, []);

  // 组件 unmount 时自动释放
  useEffect(() => {
    return () => {
      revokeAllBlobUrls();
    };
  }, [revokeAllBlobUrls]);

  return { createBlobUrl, revokeBlobUrl, revokeAllBlobUrls, blobUrlsRef };
}
