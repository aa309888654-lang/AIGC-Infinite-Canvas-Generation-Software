import { useState, useRef, useEffect, useCallback } from 'react';
import { Key, CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp, Shield, Trash2, X, Square } from 'lucide-react';
import useUnifiedAPIConfigStore from '@/store/useUnifiedAPIConfigStore';
import { apiConnector } from '@/lib/api-connector';
import { APIProvider, DEFAULT_PROVIDER_CONFIGS, DEFAULT_AUTH_CONFIG, APIAuthConfig } from '@/types/api-controller';

interface APIKeyManagerPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const APIKeyManagerPanel = ({ isOpen, onClose }: APIKeyManagerPanelProps) => {
  // 计算画布中心位置
  const getCenterPosition = () => {
    const panelWidth = 500;
    const panelHeight = 600;
    const centerX = Math.max(0, (window.innerWidth - panelWidth) / 2);
    const centerY = Math.max(0, (window.innerHeight - panelHeight) / 2);
    return { x: centerX, y: centerY };
  };
  
  const [position, setPosition] = useState(getCenterPosition);
  const [size, setSize] = useState({ width: 500, height: 600 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; error?: string }>>({});
  const [localAuthConfigs, setLocalAuthConfigs] = useState<Record<APIProvider, APIAuthConfig>>({} as Record<APIProvider, APIAuthConfig>);

  const unifiedConfigStore = useUnifiedAPIConfigStore();

  const panelRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initialConfigs: Record<APIProvider, APIAuthConfig> = {} as Record<APIProvider, APIAuthConfig>;
    DEFAULT_PROVIDER_CONFIGS.forEach(provider => {
      const config = unifiedConfigStore.getConfig(provider.id);
      
      if (config) {
        initialConfigs[provider.id] = config;
      }
    });
    setLocalAuthConfigs(initialConfigs);
  }, [unifiedConfigStore]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (dragHandleRef.current && dragHandleRef.current.contains(e.target as Node)) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
      e.preventDefault();
    }
  }, [position]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    });
    e.preventDefault();
    e.stopPropagation();
  }, [size]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
      if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        setSize({
          width: Math.max(400, resizeStart.width + deltaX),
          height: Math.max(300, resizeStart.height + deltaY)
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragOffset, resizeStart]);

  const toggleProviderExpansion = (providerId: string) => {
    setExpandedProviders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(providerId)) {
        newSet.delete(providerId);
      } else {
        newSet.add(providerId);
      }
      return newSet;
    });
  };

  const handleAuthConfigChange = (providerId: APIProvider, field: keyof APIAuthConfig, value: string) => {
    // 清理输入值：去除首尾空格、特殊字符
    let cleanedValue = value.trim();
    
    // 对于API Key等敏感字段，去除多余的空白字符
    if (field === 'apiKey' || field === 'accessKey' || field === 'secretKey') {
      // 移除所有不可见字符
      cleanedValue = cleanedValue.replace(/\s+/g, '');
      // 移除可能存在的特殊字符
      cleanedValue = cleanedValue.replace(/[^\w-]/g, '');
    }
    
    setLocalAuthConfigs(prev => ({
      ...prev,
      [providerId]: {
        ...prev[providerId],
        [field]: cleanedValue || undefined,
      },
    }));
  };

  const handleTestConnection = async (providerId: APIProvider) => {
    const config = localAuthConfigs[providerId];
    if (!config) return;

    setTestingProvider(providerId);
    setTestResults(prev => ({ ...prev, [providerId]: { success: false } }));

    try {
      const result = await apiConnector.testConnection(providerId, config);
      
      if (result.success) {
        unifiedConfigStore.setConfig(providerId, config);
        setTestResults(prev => ({ ...prev, [providerId]: { success: true } }));
      } else {
        setTestResults(prev => ({ ...prev, [providerId]: { success: false, error: result.message } }));
      }
    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        [providerId]: { 
          success: false, 
          error: error instanceof Error ? error.message : '连接测试失败' 
        } 
      }));
    } finally {
      setTestingProvider(null);
    }
  };

  const handleSaveConfig = (providerId: APIProvider) => {
    const config = localAuthConfigs[providerId];
    if (config) {
      const providerInfo = DEFAULT_PROVIDER_CONFIGS.find(p => p.id === providerId);
      const hasRequiredFields = providerInfo?.authFields.every(field => {
        const value = config[field.key as keyof APIAuthConfig];
        return value && typeof value === 'string' && value.length > 0;
      });

      if (hasRequiredFields) {
        unifiedConfigStore.setConfig(providerId, config);
        setTestResults(prev => ({ ...prev, [providerId]: { success: true } }));
      } else {
        setTestResults(prev => ({ ...prev, [providerId]: { success: false, error: '请填写完整的认证信息' } }));
      }
    }
  };

  const handleClearConfig = (providerId: APIProvider) => {
    unifiedConfigStore.clearConfig(providerId);
    setLocalAuthConfigs(prev => ({
      ...prev,
      [providerId]: { ...DEFAULT_AUTH_CONFIG }
    }));
    setTestResults(prev => {
      const newResults = { ...prev };
      delete newResults[providerId];
      return newResults;
    });
  };

  const getStatusIcon = (providerId: string) => {
    if (testingProvider === providerId) {
      return <Loader2 className="w-4 h-4 animate-spin text-gray-500" />;
    }
    const result = testResults[providerId];
    if (result?.success) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    if (result?.success === false) {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
    return null;
  };

  if (!isOpen) return null;

  if (isHidden) {
    return (
      <div className="fixed inset-0 z-50 pointer-events-none">
        <button
          onClick={(e) => { e.stopPropagation(); setIsHidden(false); }}
          className="pointer-events-auto absolute top-4 left-4 w-10 h-10 rounded flex items-center justify-center cursor-pointer"
          style={{ backgroundColor: '#6610F2' }}
          title="显示API密钥管理"
        >
          <Key className="w-5 h-5 text-white" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        ref={panelRef}
        className="pointer-events-auto relative shadow-2xl overflow-hidden flex flex-col"
        style={{
          position: 'absolute',
          left: position.x,
          top: position.y,
          width: size.width,
          height: isMinimized ? 'auto' : size.height,
          backgroundColor: '#404040',
          border: '1px solid #5A5A5A',
          borderRadius: '2px',
        }}
        onMouseDown={handleMouseDown}
      >
        <div
          ref={dragHandleRef}
          className="flex items-center justify-between px-3 py-2 cursor-move select-none"
          style={{ background: '#6610F2' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded flex items-center justify-center"
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
              }}
            >
              <Key className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-white">API密钥管理</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); setIsHidden(true); }}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              style={{ background: 'rgba(255, 255, 255, 0.1)' }}
              title="隐藏"
            >
              <Square className="w-4 h-4 text-white/90" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              title={isMinimized ? '展开' : '收起'}
            >
              {isMinimized ? (
                <ChevronDown className="w-4 h-4 text-white/90" />
              ) : (
                <ChevronUp className="w-4 h-4 text-white/90" />
              )}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="p-1 hover:bg-red-500/80 rounded transition-colors"
              title="关闭"
              style={{ background: 'rgba(255, 255, 255, 0.1)' }}
            >
              <X className="w-4 h-4 text-white/90" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {DEFAULT_PROVIDER_CONFIGS.map(provider => {
              const config = localAuthConfigs[provider.id] || { ...DEFAULT_AUTH_CONFIG };
              const isExpanded = expandedProviders.has(provider.id);

              return (
                <div
                  key={provider.id}
                  className="p-3 rounded"
                  style={{ background: '#4A4A4A', border: '1px solid #5A5A5A' }}
                >
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleProviderExpansion(provider.id)}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: provider.color }}
                      />
                      <span className="text-sm font-medium text-white">{provider.name}</span>
                      {getStatusIcon(provider.id)}
                    </div>
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-white/50" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-white/50" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 space-y-3">
                      <div className="text-xs text-white/50 mb-2">{provider.description}</div>
                      
                      <div className="space-y-2">
                        {provider.authFields.map(field => (
                          <div key={field.key}>
                            <label className="block text-xs text-white/50 mb-1">{field.label}</label>
                            <input
                        type={field.type}
                        value={config[field.key as keyof APIAuthConfig] || ''}
                        onChange={(e) => handleAuthConfigChange(provider.id, field.key as keyof APIAuthConfig, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full px-2 py-1.5 text-xs bg-[#1E1E2E] border border-[#4A4A5A] rounded-md text-white focus:outline-none focus:border-[#00E5FF] cursor-pointer"
                      />
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleTestConnection(provider.id)}
                    disabled={testingProvider === provider.id}
                    className="flex-1 px-2 py-1.5 text-xs font-medium rounded bg-white/5 hover:bg-white/10 text-white transition-colors disabled:opacity-50"
                  >
                    {testingProvider === provider.id ? '测试中...' : '测试连接'}
                  </button>
                  <button
                    onClick={() => handleSaveConfig(provider.id)}
                    className="flex-1 px-2 py-1.5 text-xs font-medium rounded bg-[#10B981]/20 hover:bg-[#10B981]/30 text-[#10B981] transition-colors"
                  >
                    保存密钥
                  </button>
                  <button
                    onClick={() => handleClearConfig(provider.id)}
                    className="px-2 py-1.5 text-xs font-medium rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                      {testResults[provider.id]?.error && (
                        <p className="mt-2 text-xs text-red-400">{testResults[provider.id].error}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="p-3 rounded" style={{ background: '#4A4A4A', border: '1px solid #5A5A5A' }}>
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-gray-400 mt-0.5" />
              <div className="text-xs text-gray-300">
                <p className="font-medium text-gray-200 mb-1">安全提示</p>
                <p>API 密钥仅存储在本地浏览器中，不会发送到我们的服务器。请妥善保管您的密钥。</p>
              </div>
            </div>
          </div>
          </div>
        )}

        <div
          className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize"
          onMouseDown={handleResizeMouseDown}
        >
          <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-white/30" />
        </div>
      </div>
    </div>
  );
};

export default APIKeyManagerPanel;
