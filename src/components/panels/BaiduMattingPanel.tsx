/**
 * 百度AI智能抠图面板组件
 * 提供完整的抠图配置和处理界面
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Scissors, Download, RotateCcw, CheckCircle, XCircle, Loader2, Image as ImageIcon, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { baiduAIService } from '@/services/baidu-ai-service';
import { toast } from 'sonner';

interface MattingOption {
  id: string;
  name: string;
  description: string;
  method: string;
  returnForm: string;
  refineMask: boolean;
}

interface BaiduMattingPanelProps {
  imageUrl: string;
  onResult?: (resultUrl: string) => void;
  onClose?: () => void;
  defaultOption?: MattingOption;
}

const defaultMattingOption: MattingOption = {
  id: 'auto-rgba',
  name: '智能抠图',
  description: '自动识别主体，透明背景',
  method: 'auto',
  returnForm: 'rgba',
  refineMask: true,
};

const mattingOptions: MattingOption[] = [
  defaultMattingOption,
  {
    id: 'auto-mask',
    name: '主体蒙版',
    description: '返回二值蒙版图',
    method: 'auto',
    returnForm: 'mask',
    refineMask: false,
  },
  {
    id: 'control-box',
    name: '框选抠图',
    description: '手动框选主体区域',
    method: 'control',
    returnForm: 'rgba',
    refineMask: true,
  },
];

export const BaiduMattingPanel: React.FC<BaiduMattingPanelProps> = ({ 
  imageUrl, 
  onResult,
  defaultOption 
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [showOptions, setShowOptions] = useState(false);
  const [selectedOption, setSelectedOption] = useState<MattingOption>(
    defaultOption || defaultMattingOption
  );
  
  useEffect(() => {
    if (imageUrl) {
      setResultUrl('');
      setError('');
    }
  }, [imageUrl]);

  const handleMatting = useCallback(async () => {
    if (!imageUrl) {
      toast.warning('请先上传图片');
      return;
    }

    setIsProcessing(true);
    setError('');
    setResultUrl('');

    try {
      // console.log('[BaiduMattingPanel] 开始智能抠图...');
      // console.log('[BaiduMattingPanel] 选项:', selectedOption);
      
      const result = await baiduAIService.removeBackground(imageUrl);
      
      // console.log('[BaiduMattingPanel] 抠图成功');
      setResultUrl(result);
      
      if (onResult) {
        onResult(result);
      }
    } catch (err) {
      console.error('[BaiduMattingPanel] 抠图失败:', err);
      const errorMessage = (err as Error).message || '处理失败';
      setError(errorMessage);
      toast.error('抠图失败：' + errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [imageUrl, onResult, selectedOption]);

  const handleDownload = useCallback(() => {
    if (!resultUrl) return;
    
    const link = document.createElement('a');
    link.href = resultUrl;
    link.download = `matting_${Date.now()}.png`;
    link.click();
  }, [resultUrl]);

  const handleReset = useCallback(() => {
    setResultUrl('');
    setError('');
  }, []);

  const handleApplyToNode = useCallback(() => {
    if (resultUrl && onResult) {
      onResult(resultUrl);
    }
  }, [resultUrl, onResult]);

  const handleSelectOption = (option: MattingOption) => {
    setSelectedOption(option);
    setShowOptions(false);
  };

  if (!imageUrl) {
    return (
      <div className="bg-neutral-800 rounded-lg p-6">
        <div className="text-center text-gray-400">
          <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>请先上传图片</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-800 rounded-lg overflow-hidden">
      {/* 头部 */}
      <div className="bg-gradient-to-r from-red-600 to-orange-500 text-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold">百度AI智能抠图</h3>
              <p className="text-xs text-white/80">智能识别 · 一键抠图</p>
            </div>
          </div>
          <button 
            onClick={() => setShowOptions(!showOptions)}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="选择抠图方式"
          >
            {showOptions ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* 选项面板 */}
      {showOptions && (
        <div className="bg-neutral-700/50 px-4 py-3 border-b border-neutral-600">
          <div className="space-y-2">
            {mattingOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => handleSelectOption(option)}
                className={`w-full p-3 rounded-lg transition-all text-left ${
                  selectedOption.id === option.id
                    ? 'bg-red-600/20 border-2 border-red-500 text-white'
                    : 'bg-neutral-600/50 border-2 border-transparent hover:bg-neutral-600 text-gray-300'
                }`}
              >
                <div className="font-medium text-sm flex items-center justify-between">
                  <span>{option.name}</span>
                  {selectedOption.id === option.id && (
                    <CheckCircle className="w-4 h-4 text-red-400" />
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {option.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 内容区域 */}
      <div className="p-4">
        {/* 预览对比 */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* 原图 */}
          <div>
            <div className="text-xs text-gray-400 mb-2 flex items-center gap-2">
              <ImageIcon className="w-3 h-3" />
              <span>原图</span>
            </div>
            <div className="bg-neutral-900 rounded-lg overflow-hidden aspect-video">
              <img 
                src={imageUrl} 
                alt="原图" 
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* 结果图 */}
          <div>
            <div className="text-xs text-gray-400 mb-2 flex items-center gap-2">
              <Sparkles className="w-3 h-3" />
              <span>抠图结果</span>
              {resultUrl && <CheckCircle className="w-3 h-3 text-green-500" />}
            </div>
            <div className="bg-neutral-900 rounded-lg overflow-hidden aspect-video relative">
              {resultUrl ? (
                <img 
                  src={resultUrl} 
                  alt="结果" 
                  className="w-full h-full object-contain"
                />
              ) : isProcessing ? (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
                </div>
              ) : error ? (
                <div className="w-full h-full flex items-center justify-center text-red-400 text-xs">
                  <XCircle className="w-6 h-6 mr-2" />
                  <span>处理失败</span>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                  等待处理...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 错误信息 */}
        {error && (
          <div className="mb-4 px-3 py-2 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-xs">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="w-4 h-4" />
              <span className="font-semibold">处理失败</span>
            </div>
            <div className="text-red-400">{error}</div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <button
            onClick={handleMatting}
            disabled={isProcessing}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/30"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>处理中...</span>
              </>
            ) : (
              <>
                <Scissors className="w-4 h-4" />
                <span>开始抠图</span>
              </>
            )}
          </button>

          {resultUrl && (
            <>
              <button 
                onClick={handleReset}
                className="px-3 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors"
                title="重新处理"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button 
                onClick={handleDownload}
                className="px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
                title="下载结果"
              >
                <Download className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* 应用到节点按钮 */}
        {resultUrl && (
          <button
            onClick={handleApplyToNode}
            className="w-full mt-3 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-medium rounded-lg transition-colors"
          >
            应用到节点
          </button>
        )}

        {/* API状态 */}
        <div className="mt-4 pt-4 border-t border-neutral-700">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-gray-400">
              API状态: 后端托管
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BaiduMattingPanel;
