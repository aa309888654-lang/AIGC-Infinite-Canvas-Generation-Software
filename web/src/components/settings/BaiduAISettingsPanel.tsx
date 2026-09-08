import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Loader2, RefreshCw, Server, XCircle } from 'lucide-react';
import { baiduConfigService } from '@/services/baidu-config';

interface BaiduAISettingsPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const BaiduAISettingsPanel: React.FC<BaiduAISettingsPanelProps> = ({
  isOpen = true,
  onClose,
}) => {
  const [isTesting, setIsTesting] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [message, setMessage] = useState('正在检查后端配置...');

  const refreshStatus = useCallback(async () => {
    setIsTesting(true);
    try {
      const configured = await baiduConfigService.fetchAndApplyFromBackend();
      setIsConfigured(configured);
      setMessage(configured ? '百度 AI 后端代理可用' : '百度 AI Provider 尚未在后端配置');
    } catch (error) {
      setIsConfigured(false);
      setMessage(error instanceof Error ? error.message : '后端连接检查失败');
    } finally {
      setIsTesting(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) void refreshStatus();
  }, [isOpen, refreshStatus]);

  if (!isOpen) return null;

  return (
    <div className="space-y-4 rounded-lg bg-neutral-900 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">百度 AI 图像处理</h2>
          <p className="mt-1 text-sm text-gray-400">后端托管</p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="text-gray-400 transition-colors hover:text-white">
            关闭
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-neutral-700 bg-neutral-800 p-4">
        <Server className="h-5 w-5 text-gray-300" />
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-white">
            {isTesting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isConfigured ? (
              <CheckCircle className="h-4 w-4 text-green-400" />
            ) : (
              <XCircle className="h-4 w-4 text-red-400" />
            )}
            <span>{message}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refreshStatus()}
          disabled={isTesting}
          title="刷新状态"
          className="rounded p-2 text-gray-300 transition-colors hover:bg-neutral-700 disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default BaiduAISettingsPanel;
