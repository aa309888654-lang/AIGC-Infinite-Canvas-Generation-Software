import { useState, useEffect } from 'react';
import useUnifiedAPIConfigStore from '@/store/useUnifiedAPIConfigStore';
import { getAllConnectionStatuses, testAllConnections } from '@/services/api-client';
import { APIProvider } from '@/types/api-controller';
import type { APIKeys } from '@/types/ai-models';
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';

interface ConnectionStatusPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const ConnectionStatusPanel = ({ isOpen, onClose }: ConnectionStatusPanelProps) => {
  const { configs } = useUnifiedAPIConfigStore();
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, { status: string; error?: string; responseTime?: number }>>({});
  const [isTesting, setIsTesting] = useState(false);

  const testConnections = async () => {
    setIsTesting(true);
    try {
      const statuses = await testAllConnections(configs as any as APIKeys);
      const transformed: Record<string, { status: string; error?: string; responseTime?: number }> = {};
      Object.entries(statuses).forEach(([key, val]) => {
        transformed[key] = { status: val.success ? 'connected' : 'error', error: val.error, responseTime: val.responseTime };
      });
      setConnectionStatuses(transformed);
    } catch (error) {
      console.error('连接测试失败:', error);
      const statuses = getAllConnectionStatuses();
      setConnectionStatuses(statuses);
    } finally {
      setIsTesting(false);
    }
  };

  useEffect(() => {
    testConnections();
  }, [testConnections]);

  if (!isOpen) return null;

  const configuredProviders = Object.keys(configs).filter(key => !!configs[key as APIProvider]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'testing':
        return <RefreshCw className="w-4 h-4 text-gray-500 animate-spin" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected':
        return '连接正常';
      case 'error':
        return '连接失败';
      case 'testing':
        return '测试中';
      default:
        return '未测试';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      case 'testing':
        return 'text-gray-500';
      default:
        return 'text-yellow-500';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1F1F1F] rounded-2xl border border-white/10 w-full max-w-lg overflow-hidden shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#007AFF] to-[#5856D6]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Wifi className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">API连接状态</h2>
              <p className="text-sm text-white/70">管理AI服务提供商的API连接状态</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
            <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6">
          {/* 测试按钮 */}
          <div className="mb-6 flex justify-between items-center">
            <h3 className="text-lg font-medium text-white">已配置的API服务</h3>
            <button
              onClick={testConnections}
              disabled={isTesting}
              className="px-4 py-2 bg-[#007AFF] hover:bg-[#0056CC] disabled:opacity-50 rounded-lg text-white text-sm flex items-center gap-2"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  测试中...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  重新测试
                </>
              )}
            </button>
          </div>

          {/* 连接状态列表 */}
          {configuredProviders.length === 0 ? (
            <div className="text-center py-8">
              <WifiOff className="w-12 h-12 text-white/30 mx-auto mb-4" />
              <p className="text-white/60">暂无配置的API服务</p>
              <p className="text-sm text-white/40 mt-2">请在设置面板中添加API密钥</p>
            </div>
          ) : (
            <div className="space-y-3">
              {configuredProviders.map((providerId) => {
                const status = connectionStatuses[providerId] || { status: 'unknown' };
                const providerName = providerId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                
                return (
                  <div key={providerId} className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(status.status)}
                        <div>
                          <h4 className="text-sm font-medium text-white">{providerName}</h4>
                          <p className={`text-xs ${getStatusColor(status.status)}`}>
                            {getStatusText(status.status)}
                          </p>
                        </div>
                      </div>
                      {status.responseTime && (
                        <span className="text-xs text-white/60">
                          {status.responseTime}ms
                        </span>
                      )}
                    </div>
                    {status.error && (
                      <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/20">
                        <p className="text-xs text-red-400">{status.error}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 说明信息 */}
          <div className="mt-6 p-3 rounded-lg bg-gray-500/10 border border-gray-500/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-gray-400 mt-0.5" />
              <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                <p className="font-medium" style={{ color: '#9CA3AF' }}>提示</p>
                <p>API连接状态会定期自动检查。如果连接失败，请检查您的API密钥是否正确。</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionStatusPanel;