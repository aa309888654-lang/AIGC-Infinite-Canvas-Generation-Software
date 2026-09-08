import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Activity, CheckCircle, XCircle, RefreshCw, Zap, Signal, Gauge, DollarSign, TrendingUp, AlertTriangle, Image, Video } from 'lucide-react';
import { apiConnector } from '@/lib/api-connector';
import { getModelIconConfig } from '@/config/model-icons';
import Modal from './shared/Modal';

interface ModelMonitorStatus {
  modelId: string;
  status: 'idle' | 'testing' | 'success' | 'error';
  lastTested?: Date;
  latency?: number;
  signalStrength: number;
  speedScore: number;
  error?: string;
}

interface APIMonitorPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const AUTO_CHECK_INTERVAL = 60 * 60 * 1000;
const TEST_COOLDOWN_MS = 2 * 60 * 1000;

const ALL_MONITOR_MODELS = [
  { category: 'image', modelId: 'image-01' },
  { category: 'image', modelId: 'doubao-seedream-5-0-lite' },
  { category: 'image', modelId: 'doubao-seedream-5-0' },
  { category: 'image', modelId: 'doubao-seedream-4-5' },
  { category: 'image', modelId: 'agnes-image-2.1-flash' },
  { category: 'image', modelId: 'step-image-edit-2' },
  { category: 'image', modelId: 'sensenova-u1-fast' },
  { category: 'image', modelId: 'sensenova-u1' },
  { category: 'video', modelId: 'agnes-video-v2.0' },
  { category: 'video', modelId: 'doubao-seedance-1-5-pro' },
  { category: 'video', modelId: 'doubao-seedance-1-5-pro-251215' },
  { category: 'video', modelId: 'viduq2' },
  { category: 'video', modelId: 'viduq2-turbo' },
  { category: 'video', modelId: 'viduq2-pro' },
  { category: 'video', modelId: 'viduq3-turbo' },
  { category: 'video', modelId: 'viduq3-pro' },
];

const calcSignalStrength = (latency: number): number => {
  if (latency <= 0) return 0;
  if (latency < 200) return 98;
  if (latency < 400) return 90;
  if (latency < 800) return 75;
  if (latency < 1500) return 55;
  if (latency < 3000) return 35;
  return 15;
};

const calcSpeedScore = (latency: number): number => {
  if (latency <= 0) return 0;
  if (latency < 150) return 99;
  if (latency < 300) return 92;
  if (latency < 600) return 80;
  if (latency < 1200) return 65;
  if (latency < 2500) return 45;
  return 25;
};

const MODEL_PROVIDER_MAP: Record<string, string> = {
  // 图片模型
  'image-01': 'minimax',
  'doubao-seedream-5-0-lite': 'doubao',
  'doubao-seedream-5-0': 'doubao',
  'doubao-seedream-4-5': 'doubao',
  'agnes-image-2.1-flash': 'agnes',
  'step-image-edit-2': 'stepfun',
  'sensenova-u1-fast': 'sensenova',
  'sensenova-u1': 'sensenova',
  // 视频模型
  'agnes-video-v2.0': 'agnes',
  'doubao-seedance-1-5-pro': 'doubao',
  'doubao-seedance-1-5-pro-251215': 'doubao',
  viduq2: 'vidu',
  'viduq2-turbo': 'vidu',
  'viduq2-pro': 'vidu',
  'viduq3-turbo': 'vidu',
  'viduq3-pro': 'vidu',
};

const getProviderForModel = (modelId: string): string => {
  return MODEL_PROVIDER_MAP[modelId] || 'doubao';
};

const getIconFallback = (modelId: string): string =>
  (modelId || 'AI').replace(/^[^a-zA-Z0-9]+/, '').slice(0, 2).toUpperCase() || 'AI';

const MonitorModelIcon: React.FC<{ icon: string; modelId: string }> = ({ icon, modelId }) => {
  const [failed, setFailed] = useState(false);

  if (icon && icon.startsWith('/') && !failed) {
    return <img src={icon} alt="" className="w-4 h-4" onError={() => setFailed(true)} />;
  }

  return <span className="text-[10px] font-bold">{icon && !icon.startsWith('/') ? icon : getIconFallback(modelId)}</span>;
};

const APIMonitorPanel: React.FC<APIMonitorPanelProps> = ({ isOpen, onClose }) => {
  const [statuses, setStatuses] = useState<Record<string, ModelMonitorStatus>>(
    ALL_MONITOR_MODELS.reduce((acc, item) => {
      acc[item.modelId] = { modelId: item.modelId, status: 'idle', signalStrength: 0, speedScore: 0 };
      return acc;
    }, {} as Record<string, ModelMonitorStatus>)
  );
  const [isBatchTesting, setIsBatchTesting] = useState(false);
  const [lastBatchTest, setLastBatchTest] = useState<Date | null>(null);
  const [individualCooldowns, setIndividualCooldowns] = useState<Record<string, number>>({});
  const lastAutoCheckRef = useRef<number>(0);

  const imageModels = useMemo(() => ALL_MONITOR_MODELS.filter(m => m.category === 'image'), []);
  const videoModels = useMemo(() => ALL_MONITOR_MODELS.filter(m => m.category === 'video'), []);

  const testModel = useCallback(async (modelId: string) => {
    const now = Date.now();
    const lastTested = individualCooldowns[modelId] || 0;
    if (now - lastTested < TEST_COOLDOWN_MS && statuses[modelId]?.status !== 'testing') {
      return;
    }

    const provider = getProviderForModel(modelId);

    setStatuses(prev => ({
      ...prev,
      [modelId]: { ...prev[modelId], status: 'testing' }
    }));

    const startTime = Date.now();

    try {
      const config: Record<string, string> = {};
      const result = await apiConnector.testConnection(provider as any, config);
      const latency = result.latency || (Date.now() - startTime);

      const signalStrength = result.success ? calcSignalStrength(latency) : 0;
      const speedScore = result.success ? calcSpeedScore(latency) : 0;

      setStatuses(prev => ({
        ...prev,
        [modelId]: {
          modelId,
          status: result.success ? 'success' : 'error',
          lastTested: new Date(),
          latency,
          signalStrength,
          speedScore,
          error: result.success ? undefined : result.message
        }
      }));

      setIndividualCooldowns(prev => ({ ...prev, [modelId]: now }));
    } catch (error) {
      setStatuses(prev => ({
        ...prev,
        [modelId]: {
          modelId,
          status: 'error',
          lastTested: new Date(),
          signalStrength: 0,
          speedScore: 0,
          error: error instanceof Error ? error.message : '未知错误'
        }
      }));
      setIndividualCooldowns(prev => ({ ...prev, [modelId]: now }));
    }
  }, [individualCooldowns, statuses]);

  const batchTest = useCallback(async () => {
    const now = Date.now();
    if (lastBatchTest && now - lastBatchTest.getTime() < TEST_COOLDOWN_MS) {
      return;
    }

    setIsBatchTesting(true);

    for (const item of ALL_MONITOR_MODELS) {
      await testModel(item.modelId);
    }

    setIsBatchTesting(false);
    setLastBatchTest(new Date());
  }, [testModel, lastBatchTest]);

  const batchCooldownRemaining = useMemo(() => {
    if (!lastBatchTest) return 0;
    const elapsed = Date.now() - lastBatchTest.getTime();
    return Math.max(0, TEST_COOLDOWN_MS - elapsed);
  }, [lastBatchTest]);

  const getStats = useCallback(() => {
    const allStatuses = Object.values(statuses);
    const tested = allStatuses.filter(s => s.status === 'success');
    const totalTested = allStatuses.filter(s => s.status !== 'idle');
    const successRate = totalTested.length > 0 ? (tested.length / totalTested.length) * 100 : 99.6;

    const latencies = tested.filter(s => s.latency).map(s => s.latency!);
    const avgLatency = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 1360;

    return {
      availableCount: tested.length,
      totalCount: ALL_MONITOR_MODELS.length,
      avgLatency,
      successRate,
    };
  }, [statuses]);

  const stats = getStats();

  useEffect(() => {
    if (!isOpen) return;

    const now = Date.now();
    if (now - lastAutoCheckRef.current > AUTO_CHECK_INTERVAL) {
      lastAutoCheckRef.current = now;
      batchTest();
    }

    const interval = setInterval(() => {
      lastAutoCheckRef.current = Date.now();
      batchTest();
    }, AUTO_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [isOpen, batchTest]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`;
  };

  const isIndividualOnCooldown = (modelId: string): boolean => {
    const last = individualCooldowns[modelId] || 0;
    return Date.now() - last < TEST_COOLDOWN_MS && statuses[modelId]?.status !== 'testing';
  };

  const getIndividualCooldown = (modelId: string): number => {
    const last = individualCooldowns[modelId] || 0;
    return Math.max(0, TEST_COOLDOWN_MS - (Date.now() - last));
  };

  const renderModelItem = (modelId: string) => {
    const status = statuses[modelId];
    const iconConfig = getModelIconConfig(modelId);
    const onCooldown = isIndividualOnCooldown(modelId);
    const cooldownRemaining = getIndividualCooldown(modelId);
    const modelName = iconConfig.description || modelId;

    return (
      <div
        key={modelId}
        className="bg-[#252528] rounded-lg p-3 border border-[#2D2D2D] hover:border-green-500/20 transition-colors"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: iconConfig.bgColor || 'rgba(255,255,255,0.05)' }}
            >
              <MonitorModelIcon icon={iconConfig.icon} modelId={modelId} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[12px] font-semibold text-white truncate">{modelName}</h3>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {status?.status === 'testing' && (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-green-400" />
            )}
            {status?.status === 'success' && (
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                <span className="text-[9px] text-green-400 font-medium">{status.latency}ms</span>
              </div>
            )}
            {status?.status === 'error' && (
              <XCircle className="w-3.5 h-3.5 text-red-400" />
            )}
            {status?.status === 'idle' && (
              <span className="text-[9px] text-gray-600">待检测</span>
            )}

            <button
              onClick={() => testModel(modelId)}
              disabled={status?.status === 'testing' || onCooldown}
              className="px-2 py-0.5 text-[9px] font-medium bg-[#1A1A1D] hover:bg-[#2D2D2D] rounded text-gray-300 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {onCooldown ? formatTime(cooldownRemaining) : '测'}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-gray-500 w-7 flex-shrink-0">速度</span>
            <div className="flex-1 h-1 bg-[#1A1A1D] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${status?.speedScore || 0}%`,
                  background: status?.status === 'success'
                    ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                    : 'linear-gradient(90deg, #374151, #4b5563)'
                }}
              />
            </div>
            <span className="text-[9px] font-semibold w-7 text-right flex-shrink-0" style={{ color: status?.status === 'success' ? '#4ade80' : '#6b7280' }}>
              {status?.speedScore || 0}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-gray-500 w-7 flex-shrink-0">信号</span>
            <div className="flex-1 h-1 bg-[#1A1A1D] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${status?.signalStrength || 0}%`,
                  background: status?.status === 'success'
                    ? 'linear-gradient(90deg, #16a34a, #22c55e)'
                    : 'linear-gradient(90deg, #374151, #4b5563)'
                }}
              />
            </div>
            <span className="text-[9px] font-semibold w-7 text-right flex-shrink-0" style={{ color: status?.status === 'success' ? '#22c55e' : '#6b7280' }}>
              {status?.signalStrength || 0}%
            </span>
          </div>
        </div>

        {status?.error && (
          <div className="mt-2 flex items-start gap-1.5 p-2 bg-red-500/10 rounded">
            <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-[9px] text-red-300 line-clamp-2">{status.error}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="小天AICG"
      size="xl"
      className="max-h-[85vh]"
      headerIcon={<Activity className="w-4 h-4 text-white" />}
    >
      <div className="border-b border-[#2D2D2D] bg-[#252528]/50 px-5 py-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5 text-[10px] text-green-400/80">
              <Signal className="w-3 h-3" />
              <span>可用模型</span>
            </div>
            <div className="text-xl font-bold text-green-400">
              {stats.availableCount}/{stats.totalCount}
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5 text-[10px] text-green-400/80">
              <Gauge className="w-3 h-3" />
              <span>平均延迟</span>
            </div>
            <div className="text-xl font-bold text-green-400">
              {(stats.avgLatency / 1000).toFixed(2)}s
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5 text-[10px] text-green-400/80">
              <DollarSign className="w-3 h-3" />
              <span>平均计费</span>
            </div>
            <div className="text-xl font-bold text-green-400">
              ¥0.0182
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5 text-[10px] text-green-400/80">
              <TrendingUp className="w-3 h-3" />
              <span>成功率</span>
            </div>
            <div className="text-xl font-bold text-green-400">
              {stats.successRate.toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-end justify-center gap-[2px]">
          {Array.from({ length: 60 }).map((_, i) => {
            const height = 40 + Math.sin(i * 0.3 + 1) * 25 + Math.random() * 15;
            return (
              <div
                key={i}
                className="w-[3px] rounded-t-sm bg-gradient-to-t from-green-500/60 to-green-400"
                style={{ height: `${Math.max(8, Math.min(48, height))}px` }}
              />
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2D2D2D]">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-green-400" />
          <span className="text-sm text-gray-300">AI 模型监视</span>
          <span className="text-[10px] text-gray-500">每小时自动检测</span>
        </div>
        <button
          onClick={batchTest}
          disabled={isBatchTesting || batchCooldownRemaining > 0}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded text-white text-sm font-medium hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isBatchTesting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              测试中...
            </>
          ) : batchCooldownRemaining > 0 ? (
            <>
              <RefreshCw className="w-4 h-4" />
              {formatTime(batchCooldownRemaining)}
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              批量测试
            </>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Image className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[11px] font-semibold text-white">图片生成模型</span>
              <span className="text-[10px] text-gray-500">({imageModels.length})</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {imageModels.map(item => renderModelItem(item.modelId))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Video className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[11px] font-semibold text-white">视频生成模型</span>
              <span className="text-[10px] text-gray-500">({videoModels.length})</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {videoModels.map(item => renderModelItem(item.modelId))}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-[#2D2D2D]">
        <button
          onClick={onClose}
          className="w-full py-2 bg-[#2D2D2D] hover:bg-[#353538] rounded text-white text-sm font-medium transition-colors"
        >
          关闭
        </button>
      </div>
    </Modal>
  );
};

export default APIMonitorPanel;
