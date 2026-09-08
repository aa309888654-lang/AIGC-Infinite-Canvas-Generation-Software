import React, { useState, useEffect } from 'react';
import { useFileStore } from '@/store/useFileStore';
import { createImageThumbnail, createVideoThumbnail } from '@/services/enhanced-file-processor';

interface ThumbnailGeneratorProps {
  file: File;
  onThumbnailGenerated: (thumbnailUrl: string) => void;
}

/**
 * 缩略图生成器
 * 为文件生成缩略图并更新到文件存储
 */
export const ThumbnailGenerator: React.FC<ThumbnailGeneratorProps> = ({ file, onThumbnailGenerated }) => {
  const [, setIsGenerating] = useState(true);
  const [, setError] = useState<string | null>(null);

  useEffect(() => {
    const generateThumbnail = async () => {
      try {
        setIsGenerating(true);
        setError(null);

        let thumbnailUrl = '';
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');

        if (isImage) {
          thumbnailUrl = await createImageThumbnail(file);
        } else if (isVideo) {
          thumbnailUrl = await createVideoThumbnail(file);
        }

        onThumbnailGenerated(thumbnailUrl);
      } catch (err) {
        console.error('生成缩略图失败:', err);
        setError('生成缩略图失败');
        onThumbnailGenerated('');
      } finally {
        setIsGenerating(false);
      }
    };

    generateThumbnail();
  }, [file, onThumbnailGenerated]);

  return null; // 这个组件不需要渲染任何内容
};

/**
 * 为现有文件生成缩略图
 */
export const generateThumbnailsForExistingFiles = async () => {
  const { files, updateFile } = useFileStore.getState();
  
  for (const file of files) {
    if (!file.thumbnailUrl) {
      try {
        // 从 URL 创建 File 对象
        const response = await fetch(file.url);
        const blob = await response.blob();
        const fileObj = new File([blob], file.name, { type: blob.type });

        let thumbnailUrl = '';
        if (file.type === 'image') {
          thumbnailUrl = await createImageThumbnail(fileObj);
        } else if (file.type === 'video') {
          thumbnailUrl = await createVideoThumbnail(fileObj);
        }

        if (thumbnailUrl) {
          updateFile(file.id, { thumbnailUrl });
        }
      } catch (err) {
        console.error(`为文件 ${file.name} 生成缩略图失败:`, err);
      }
    }
  }
};

/**
 * 检查并修复文件的缩略图
 */
export const ensureFileThumbnail = async (file: any) => {
  if (!file.thumbnailUrl) {
    try {
      const response = await fetch(file.url);
      const blob = await response.blob();
      const fileObj = new File([blob], file.name, { type: blob.type });

      let thumbnailUrl = '';
      if (file.type === 'image') {
        thumbnailUrl = await createImageThumbnail(fileObj);
      } else if (file.type === 'video') {
        thumbnailUrl = await createVideoThumbnail(fileObj);
      }

      return thumbnailUrl;
    } catch (err) {
      console.error('生成缩略图失败:', err);
      return '';
    }
  }
  return file.thumbnailUrl;
};
