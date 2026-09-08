/**
 * API节点检测面板
 * 用于测试所有AI模型提供商的连接状态
 */

import React, { useState, useCallback } from 'react';
import {
  apiNodeTester,
  NodeTestResult,
  BatchTestResult,
  StabilityTestResult,
  TestConfig,
} from '@/services/api-node-tester';
import { APIProvider } from '@/types/api-controller';
import { useUnifiedAPIConfig } from '@/services/unified-api';

// 图标组件
const StatusIcon = ({ status }: { status: NodeTestResult['status'] }) => {
  switch (status) {
    case 'success':
      return <span className="text-green-500">✓</span>;
    case 'failed':
    case 'error':
      return <span className="text-red-500">✗</span>;
    case 'timeout':
      return <span className="text-yellow-500">⏱</span>;
    case 'unauthorized':
      return <span className="text-orange-500">🔐</span>;
    default:
      return <span className="text-gray-500">?</span>;
  }
};

const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const StopIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

interface APINodeTesterPanelProps {
  className?: string;
}

export const APINodeTesterPanel: React.FC<APINodeTesterPanelProps> = ({ className = '' }) => {
  // 状态
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [batchResult, setBatchResult] = useState<BatchTestResult | null>(null);
  const [stabilityResults, setStabilityResults] = useState<Map<APIProvider, StabilityTestResult>>(new Map());
  const [, setSelectedProvider] = useState<APIProvider | null>(null);
  const [view, setView] = useState<'list' | 'stability'>('list');

  // 获取配置
  const { configs } = useUnifiedAPIConfig();

  // 测试配置
  const [testConfig, setTestConfig] = useState<TestConfig>({
    timeout: 8000,
    retryCount: 1,
    concurrentLimit: 5,
  });

  // 运行批量测试
  const runBatchTest = useCallback(async () => {
    if (isRunning) return;

    setIsRunning(true);
    setProgress({ current: 0, total: 0 });
    setBatchResult(null);
    setStabilityResults(new Map());

    try {
      const result = await apiNodeTester.testAllNodes(
        configs as Partial<Record<string, unknown>>,
        testConfig,
        (current, total, _result) => {
          setProgress({ current, total });
        }
      );
      setBatchResult(result);
    } catch (error) {
      console.error('批量测试失败:', error);
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, configs, testConfig]);

  // 运行稳定性测试
  const runStabilityTest = useCallback(async (provider: APIProvider) => {
    setSelectedProvider(provider);

    try {
      const result = await apiNodeTester.testStability(
        provider,
        configs[provider] || {},
        5,
        testConfig
      );
      setStabilityResults(prev => new Map(prev).set(provider, result));
    } catch (error) {
      console.error('稳定性测试失败:', error);
    }
  }, [configs, testConfig]);

  // 停止测试
  const stopTest = useCallback(() => {
    apiNodeTester.stopTest();
    setIsRunning(false);
  }, []);

  // 获取提供商列表
  const providers = apiNodeTester.getProviderList();

  // 计算统计
  const stats = batchResult ? {
    success: batchResult.results.filter(r => r.status === 'success').length,
    failed: batchResult.results.filter(r => r.status === 'failed' || r.status === 'error').length,
    timeout: batchResult.results.filter(r => r.status === 'timeout').length,
    unauthorized: batchResult.results.filter(r => r.status === 'unauthorized').length,
    avgResponseTime: Math.round(
      batchResult.results
        .filter(r => r.status === 'success')
        .reduce((sum, r) => sum + r.responseTime, 0) /
      Math.max(1, batchResult.results.filter(r => r.status === 'success').length)
    ),
  } : null;

  return (
    <div className={`bg-gray-900 rounded-lg p-4 ${className}`}>
      {/* 标题 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <ChartIcon />
          API节点检测
        </h2>

        {/* 视图切换 */}
        <div className="flex gap-2">
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1 rounded text-sm ${
              view === 'list'
                ? 'bg-gray-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            列表视图
          </button>
          <button
            onClick={() => setView('stability')}
            className={`px-3 py-1 rounded text-sm ${
              view === 'stability'
                ? 'bg-gray-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            稳定性视图
          </button>
        </div>
      </div>

      {/* 配置 */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">超时时间 (ms)</label>
          <input
            type="number"
            value={testConfig.timeout}
            onChange={e => setTestConfig(prev => ({ ...prev, timeout: parseInt(e.target.value) || 8000 }))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
            min={1000}
            max={30000}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">重试次数</label>
          <input
            type="number"
            value={testConfig.retryCount}
            onChange={e => setTestConfig(prev => ({ ...prev, retryCount: parseInt(e.target.value) || 0 }))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
            min={0}
            max={3}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">并发数</label>
          <input
            type="number"
            value={testConfig.concurrentLimit}
            onChange={e => setTestConfig(prev => ({ ...prev, concurrentLimit: parseInt(e.target.value) || 5 }))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
            min={1}
            max={10}
          />
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={runBatchTest}
          disabled={isRunning}
          className={`flex items-center gap-2 px-4 py-2 rounded font-medium ${
            isRunning
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-gray-600 text-white hover:bg-gray-700'
          }`}
        >
          <RefreshIcon />
          {isRunning ? '检测中...' : '批量检测所有节点'}
        </button>

        {isRunning && (
          <button
            onClick={stopTest}
            className="flex items-center gap-2 px-4 py-2 rounded font-medium bg-red-600 text-white hover:bg-red-700"
          >
            <StopIcon />
            停止
          </button>
        )}
      </div>

      {/* 进度条 */}
      {isRunning && progress.total > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-400 mb-1">
            <span>检测进度</span>
            <span>{progress.current} / {progress.total}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-gray-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* 统计信息 */}
      {stats && (
        <div className="grid grid-cols-5 gap-3 mb-4">
          <div className="bg-green-900/30 border border-green-700 rounded p-3 text-center">
            <div className="text-2xl font-bold text-green-500">{stats.success}</div>
            <div className="text-xs text-green-400">成功</div>
          </div>
          <div className="bg-red-900/30 border border-red-700 rounded p-3 text-center">
            <div className="text-2xl font-bold text-red-500">{stats.failed}</div>
            <div className="text-xs text-red-400">失败</div>
          </div>
          <div className="bg-yellow-900/30 border border-yellow-700 rounded p-3 text-center">
            <div className="text-2xl font-bold text-yellow-500">{stats.timeout}</div>
            <div className="text-xs text-yellow-400">超时</div>
          </div>
          <div className="bg-orange-900/30 border border-orange-700 rounded p-3 text-center">
            <div className="text-2xl font-bold text-orange-500">{stats.unauthorized}</div>
            <div className="text-xs text-orange-400">未授权</div>
          </div>
          <div className="bg-gray-900/30 border border-gray-700 rounded p-3 text-center">
            <div className="text-2xl font-bold text-gray-500">{stats.avgResponseTime}ms</div>
            <div className="text-xs text-gray-400">平均延迟</div>
          </div>
        </div>
      )}

      {/* 列表视图 */}
      {view === 'list' && batchResult && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {batchResult.results.map(result => (
            <div
              key={result.provider}
              className={`p-3 rounded border ${
                result.status === 'success'
                  ? 'bg-green-900/20 border-green-700'
                  : result.status === 'timeout'
                  ? 'bg-yellow-900/20 border-yellow-700'
                  : result.status === 'unauthorized'
                  ? 'bg-orange-900/20 border-orange-700'
                  : 'bg-red-900/20 border-red-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusIcon status={result.status} />
                  <div>
                    <div className="font-medium text-white">{result.name}</div>
                    <div className="text-xs text-gray-400">{result.provider}</div>
                  </div>
                </div>
                <div className="text-right">
                  {result.status === 'success' && (
                    <div className="text-green-400 font-medium">{result.responseTime}ms</div>
                  )}
                  {result.error && (
                    <div className="text-red-400 text-sm max-w-xs truncate">{result.error}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 稳定性视图 */}
      {view === 'stability' && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {providers.map(provider => {
            const stability = stabilityResults.get(provider.id as any);
            const batchItem = batchResult?.results.find(r => r.provider === provider.id);

            return (
              <div
                key={provider.id}
                className={`p-3 rounded border ${
                  stability
                    ? stability.successRate >= 80
                      ? 'bg-green-900/20 border-green-700'
                      : stability.successRate >= 50
                      ? 'bg-yellow-900/20 border-yellow-700'
                      : 'bg-red-900/20 border-red-700'
                    : batchItem?.status === 'success'
                    ? 'bg-gray-900/20 border-gray-700'
                    : 'bg-gray-800 border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusIcon status={stability ? (stability.successRate >= 80 ? 'success' : 'failed') : (batchItem?.status || 'error')} />
                    <div>
                      <div className="font-medium text-white">{provider.name}</div>
                      <div className="text-xs text-gray-400">{provider.id}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {stability ? (
                      <>
                        <div className="text-right">
                          <div className="text-lg font-bold text-white">{stability.successRate}%</div>
                          <div className="text-xs text-gray-400">成功率</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-white">{stability.avgResponseTime}ms</div>
                          <div className="text-xs text-gray-400">
                            {stability.minResponseTime}-{stability.maxResponseTime}ms
                          </div>
                        </div>
                      </>
                    ) : (
                      <button
                        onClick={() => runStabilityTest(provider.id as APIProvider)}
                        disabled={isRunning}
                        className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
                      >
                        测试稳定性
                      </button>
                    )}
                  </div>
                </div>

                {stability && (
                  <div className="mt-2 text-xs text-gray-400">
                    测试 {stability.totalTests} 次 | 成功 {stability.successfulTests} | 失败 {stability.failedTests} | 抖动 {stability.jitter}ms
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 测试报告 */}
      {batchResult && (
        <div className="mt-4 p-3 bg-gray-800 rounded border border-gray-700">
          <h3 className="font-medium text-white mb-2">测试报告</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-400">
              测试时间: <span className="text-white">{new Date(batchResult.timestamp).toLocaleString()}</span>
            </div>
            <div className="text-gray-400">
              总耗时: <span className="text-white">{batchResult.duration}ms</span>
            </div>
            <div className="text-gray-400">
              总节点数: <span className="text-white">{batchResult.total}</span>
            </div>
            <div className="text-gray-400">
              通过率: <span className="text-green-400">{Math.round((batchResult.success / batchResult.total) * 100)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default APINodeTesterPanel;
