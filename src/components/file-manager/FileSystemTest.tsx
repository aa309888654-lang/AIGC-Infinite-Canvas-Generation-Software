import React, { useState } from 'react';
import { useFileStore } from '@/store/useFileStore';
import { processFile } from '@/services/enhanced-file-processor';

/**
 * 文件管理系统测试组件
 * 用于深度检测文件上传和缩略图生成功能
 */
export const FileSystemTest: React.FC = () => {
  const { files, addFile, deleteFile, clearFiles } = useFileStore();
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<Array<{ type: 'success' | 'error'; message: string }>>([]);

  // 测试文件上传和缩略图生成
  const testFileUpload = async () => {
    setIsTesting(true);
    setTestResults([]);

    try {
      // 测试 1: 上传图片文件
      await testImageUpload();
      
      // 测试 2: 上传视频文件
      await testVideoUpload();
      
      // 测试 3: 验证缩略图生成
      testThumbnailGeneration();
      
      setTestResults(prev => [...prev, { type: 'success', message: '所有测试通过！' }]);
    } catch (error) {
      setTestResults(prev => [...prev, { type: 'error', message: `测试失败: ${error}` }]);
    } finally {
      setIsTesting(false);
    }
  };

  // 测试图片上传
  const testImageUpload = async () => {
    try {
      // 创建测试图片
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(0, 0, 100, 100);
      
      canvas.toBlob(async (blob) => {
        if (blob) {
          const testImage = new File([blob], 'test-image.png', { type: 'image/png' });
          const processedFile = await processFile(testImage, {
            createThumbnail: true,
            extractMetadata: true
          });
          
          addFile({
            id: processedFile.id,
            name: processedFile.name,
            type: processedFile.type,
            size: processedFile.size,
            url: processedFile.url,
            thumbnailUrl: processedFile.thumbnailUrl,
            createdAt: new Date().toISOString(),
            metadata: processedFile.metadata
          });
          
          setTestResults(prev => [...prev, { type: 'success', message: '图片上传测试通过' }]);
        }
      });
    } catch (error) {
      setTestResults(prev => [...prev, { type: 'error', message: `图片上传测试失败: ${error}` }]);
    }
  };

  // 测试视频上传
  const testVideoUpload = async () => {
    try {
      // 创建测试视频（空视频文件）
      const testVideo = new File([new ArrayBuffer(1024)], 'test-video.mp4', { type: 'video/mp4' });
      const processedFile = await processFile(testVideo, {
        createThumbnail: true,
        extractMetadata: true
      });
      
      addFile({
        id: processedFile.id,
        name: processedFile.name,
        type: processedFile.type,
        size: processedFile.size,
        url: processedFile.url,
        thumbnailUrl: processedFile.thumbnailUrl,
        createdAt: new Date().toISOString(),
        metadata: processedFile.metadata
      });
      
      setTestResults(prev => [...prev, { type: 'success', message: '视频上传测试通过' }]);
    } catch (error) {
      setTestResults(prev => [...prev, { type: 'error', message: `视频上传测试失败: ${error}` }]);
    }
  };

  // 测试缩略图生成
  const testThumbnailGeneration = () => {
    const filesWithThumbnails = files.filter(file => file.thumbnailUrl);
    const filesWithoutThumbnails = files.filter(file => !file.thumbnailUrl);
    
    if (filesWithThumbnails.length > 0) {
      setTestResults(prev => [...prev, { type: 'success', message: `缩略图生成测试通过: ${filesWithThumbnails.length} 个文件有缩略图` }]);
    }
    
    if (filesWithoutThumbnails.length > 0) {
      setTestResults(prev => [...prev, { type: 'error', message: `缩略图生成测试失败: ${filesWithoutThumbnails.length} 个文件无缩略图` }]);
    }
  };

  // 清空测试文件
  const clearTestFiles = () => {
    clearFiles();
    setTestResults([]);
  };

  return (
    <div className="p-4 bg-[#1A1A1D] rounded-lg border border-white/10">
      <h3 className="text-lg font-semibold text-white mb-4">文件管理系统测试</h3>
      
      <div className="mb-4">
        <button
          onClick={testFileUpload}
          disabled={isTesting}
          className="px-4 py-2 bg-[#007AFF] text-white rounded-lg hover:bg-[#0056b3] transition-colors"
        >
          {isTesting ? '测试中...' : '开始测试'}
        </button>
        <button
          onClick={clearTestFiles}
          className="ml-2 px-4 py-2 bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 transition-colors"
        >
          清空测试
        </button>
      </div>

      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-300 mb-2">当前文件状态:</h4>
        <div className="text-xs text-gray-400">
          总文件数: {files.length}<br />
          有缩略图: {files.filter(f => f.thumbnailUrl).length}<br />
          无缩略图: {files.filter(f => !f.thumbnailUrl).length}
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-300">测试结果:</h4>
        {testResults.map((result, index) => (
          <div
            key={index}
            className={`px-3 py-2 rounded text-sm ${
              result.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}
          >
            {result.message}
          </div>
        ))}
      </div>

      <div className="mt-4">
        <h4 className="text-sm font-medium text-gray-300 mb-2">文件列表:</h4>
        <div className="space-y-1">
          {files.map(file => (
            <div key={file.id} className="flex items-center justify-between px-3 py-2 bg-[#2D2D2D] rounded text-xs">
              <div>
                <span className="text-white">{file.name}</span>
                <span className="ml-2 text-gray-500">({file.size} bytes)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded ${file.thumbnailUrl ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {file.thumbnailUrl ? '有缩略图' : '无缩略图'}
                </span>
                <button
                  onClick={() => deleteFile(file.id)}
                  className="text-gray-400 hover:text-red-400"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
