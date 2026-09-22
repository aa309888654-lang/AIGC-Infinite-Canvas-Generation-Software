/**
 * API测试报告组件
 * 展示详细的测试结果和分析
 */

import React, { useMemo } from 'react';
import { BatchTestResult, StabilityTestResult } from '@/services/api-node-tester';

interface APITestReportProps {
  batchResult: BatchTestResult;
  stabilityResults?: Map<string, StabilityTestResult>;
  className?: string;
}

// 状态颜色映射
const STATUS_COLORS = {
  success: 'text-green-500 bg-green-900/30',
  failed: 'text-red-500 bg-red-900/30',
  timeout: 'text-yellow-500 bg-yellow-900/30',
  unauthorized: 'text-orange-500 bg-orange-900/30',
  error: 'text-red-500 bg-red-900/30',
};

export const APITestReport: React.FC<APITestReportProps> = ({
  batchResult,
  stabilityResults,
  className = '',
}) => {
  // 计算统计数据
  const stats = useMemo(() => {
    const results = batchResult.results;
    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'failed' || r.status === 'error');
    const timeouts = results.filter(r => r.status === 'timeout');
    const unauthorized = results.filter(r => r.status === 'unauthorized');

    const avgResponseTime = successful.length > 0
      ? Math.round(successful.reduce((sum, r) => sum + r.responseTime, 0) / successful.length)
      : 0;

    const minResponseTime = successful.length > 0
      ? Math.min(...successful.map(r => r.responseTime))
      : 0;

    const maxResponseTime = successful.length > 0
      ? Math.max(...successful.map(r => r.responseTime))
      : 0;

    // 按响应时间排序
    const sortedByTime = [...successful].sort((a, b) => a.responseTime - b.responseTime);
    const medianResponseTime = sortedByTime.length > 0
      ? sortedByTime[Math.floor(sortedByTime.length / 2)].responseTime
      : 0;

    return {
      total: results.length,
      success: successful.length,
      failed: failed.length,
      timeout: timeouts.length,
      unauthorized: unauthorized.length,
      avgResponseTime,
      minResponseTime,
      maxResponseTime,
      medianResponseTime,
      successRate: Math.round((successful.length / results.length) * 100),
    };
  }, [batchResult]);

  // 生成报告文本
  const reportText = useMemo(() => {
    const lines: string[] = [];
    lines.push('═'.repeat(60));
    lines.push('API节点检测报告');
    lines.push('═'.repeat(60));
    lines.push('');
    lines.push(`生成时间: ${new Date(batchResult.timestamp).toLocaleString()}`);
    lines.push(`总耗时: ${batchResult.duration}ms`);
    lines.push('');
    lines.push('【统计摘要】');
    lines.push(`总节点数: ${stats.total}`);
    lines.push(`成功: ${stats.success} (${stats.successRate}%)`);
    lines.push(`失败: ${stats.failed}`);
    lines.push(`超时: ${stats.timeout}`);
    lines.push(`未授权: ${stats.unauthorized}`);
    lines.push('');
    lines.push('【性能指标】');
    lines.push(`平均响应时间: ${stats.avgResponseTime}ms`);
    lines.push(`最小响应时间: ${stats.minResponseTime}ms`);
    lines.push(`最大响应时间: ${stats.maxResponseTime}ms`);
    lines.push(`中位数响应时间: ${stats.medianResponseTime}ms`);
    lines.push('');
    lines.push('【详细结果】');

    batchResult.results.forEach(result => {
      lines.push('');
      lines.push(`▶ ${result.name} (${result.provider})`);
      lines.push(`  状态: ${result.status.toUpperCase()}`);
      lines.push(`  响应时间: ${result.responseTime}ms`);
      if (result.error) {
        lines.push(`  错误: ${result.error}`);
      }

      // 稳定性数据
      const stability = stabilityResults?.get(result.provider);
      if (stability) {
        lines.push(`  稳定性测试:`);
        lines.push(`    - 成功率: ${stability.successRate}%`);
        lines.push(`    - 平均响应: ${stability.avgResponseTime}ms`);
        lines.push(`    - 抖动范围: ${stability.jitter}ms`);
        lines.push(`    - 测试次数: ${stability.totalTests}`);
      }
    });

    lines.push('');
    lines.push('═'.repeat(60));
    lines.push('报告结束');
    lines.push('═'.repeat(60));

    return lines.join('\n');
  }, [batchResult, stats, stabilityResults]);

  // 导出报告
  const exportReport = (format: 'txt' | 'json') => {
    if (format === 'txt') {
      const blob = new Blob([reportText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `api-test-report-${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const data = {
        timestamp: batchResult.timestamp,
        duration: batchResult.duration,
        stats,
        results: batchResult.results,
        stability: stabilityResults ? Object.fromEntries(stabilityResults) : null,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `api-test-report-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className={`bg-gray-900 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">测试报告</h2>
        <div className="flex gap-2">
          <button
            onClick={() => exportReport('txt')}
            className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
          >
            导出 TXT
          </button>
          <button
            onClick={() => exportReport('json')}
            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
          >
            导出 JSON
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className={`p-3 rounded border ${STATUS_COLORS.success}`}>
          <div className="text-2xl font-bold">{stats.success}</div>
          <div className="text-sm">成功</div>
        </div>
        <div className={`p-3 rounded border ${STATUS_COLORS.failed}`}>
          <div className="text-2xl font-bold">{stats.failed}</div>
          <div className="text-sm">失败</div>
        </div>
        <div className={`p-3 rounded border ${STATUS_COLORS.timeout}`}>
          <div className="text-2xl font-bold">{stats.timeout}</div>
          <div className="text-sm">超时</div>
        </div>
        <div className={`p-3 rounded border ${STATUS_COLORS.unauthorized}`}>
          <div className="text-2xl font-bold">{stats.unauthorized}</div>
          <div className="text-sm">未授权</div>
        </div>
      </div>

      {/* 性能指标 */}
      <div className="bg-gray-800 rounded p-3 mb-4">
        <h3 className="text-sm font-medium text-gray-300 mb-2">性能指标</h3>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-white">{stats.avgResponseTime}ms</div>
            <div className="text-xs text-gray-400">平均</div>
          </div>
          <div>
            <div className="text-lg font-bold text-white">{stats.minResponseTime}ms</div>
            <div className="text-xs text-gray-400">最小</div>
          </div>
          <div>
            <div className="text-lg font-bold text-white">{stats.maxResponseTime}ms</div>
            <div className="text-xs text-gray-400">最大</div>
          </div>
          <div>
            <div className="text-lg font-bold text-white">{stats.medianResponseTime}ms</div>
            <div className="text-xs text-gray-400">中位数</div>
          </div>
        </div>
      </div>

      {/* 成功率进度条 */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-400">成功率</span>
          <span className="text-white font-medium">{stats.successRate}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${
              stats.successRate >= 80 ? 'bg-green-500' :
              stats.successRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${stats.successRate}%` }}
          />
        </div>
      </div>

      {/* 详细结果表格 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 px-2 text-gray-400 font-medium">提供商</th>
              <th className="text-center py-2 px-2 text-gray-400 font-medium">状态</th>
              <th className="text-right py-2 px-2 text-gray-400 font-medium">响应时间</th>
              <th className="text-left py-2 px-2 text-gray-400 font-medium">错误信息</th>
            </tr>
          </thead>
          <tbody>
            {batchResult.results.map(result => (
              <tr key={result.provider} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="py-2 px-2">
                  <div className="font-medium text-white">{result.name}</div>
                  <div className="text-xs text-gray-500">{result.provider}</div>
                </td>
                <td className="text-center py-2 px-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    result.status === 'success' ? 'bg-green-900 text-green-400' :
                    result.status === 'timeout' ? 'bg-yellow-900 text-yellow-400' :
                    result.status === 'unauthorized' ? 'bg-orange-900 text-orange-400' :
                    'bg-red-900 text-red-400'
                  }`}>
                    {result.status.toUpperCase()}
                  </span>
                </td>
                <td className="text-right py-2 px-2">
                  {result.status === 'success' ? (
                    <span className="text-green-400">{result.responseTime}ms</span>
                  ) : (
                    <span className="text-gray-500">-</span>
                  )}
                </td>
                <td className="py-2 px-2">
                  {result.error && (
                    <span className="text-red-400 text-xs truncate block max-w-xs">
                      {result.error}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 预览报告文本 */}
      <details className="mt-4">
        <summary className="text-sm text-gray-400 cursor-pointer hover:text-white">
          查看完整报告文本
        </summary>
        <pre className="mt-2 p-3 bg-gray-800 rounded text-xs text-gray-300 overflow-x-auto max-h-64">
          {reportText}
        </pre>
      </details>
    </div>
  );
};

export default APITestReport;
