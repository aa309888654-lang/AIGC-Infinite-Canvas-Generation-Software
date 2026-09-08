/**
 * API节点检测服务
 * 用于测试所有AI模型提供商的连接状态
 */

export interface NodeTestResult {
  provider: string;
  status: 'success' | 'failure' | 'failed' | 'error' | 'timeout' | 'unauthorized';
  latency: number;
  responseTime?: number;
  name?: string;
  error?: string;
  timestamp: number;
}

export interface BatchTestResult {
  results: NodeTestResult[];
  totalTime: number;
  timestamp?: number;
  duration?: number;
  total?: number;
  success?: number;
  successCount: number;
  failureCount: number;
}

export interface StabilityTestResult {
  provider: string;
  successRate: number;
  avgLatency: number;
  avgResponseTime?: number;
  maxLatency: number;
  minLatency: number;
  minResponseTime?: number;
  maxResponseTime?: number;
  totalTests?: number;
  successfulTests?: number;
  failedTests?: number;
  jitter?: number;
  errorRates: Record<string, number>;
}

export interface TestConfig {
  timeout?: number;
  retries?: number;
  retryCount?: number;
  concurrency?: number;
  concurrentLimit?: number;
}

class APINodeTester {
  async testNode(_provider: string, _config?: TestConfig): Promise<NodeTestResult> {
    return {
      provider: _provider,
      status: 'timeout',
      latency: 0,
      timestamp: Date.now(),
    };
  }

  async testAllNodes(
    _configs: Partial<Record<string, unknown>>,
    _config?: TestConfig,
    _onProgress?: (current: number, total: number, result: NodeTestResult) => void
  ): Promise<BatchTestResult> {
    return {
      results: [],
      totalTime: 0,
      successCount: 0,
      failureCount: 0,
    };
  }

  async batchTest(_providers: string[], _config?: TestConfig): Promise<BatchTestResult> {
    return {
      results: [],
      totalTime: 0,
      successCount: 0,
      failureCount: 0,
    };
  }

  async testStability(_provider: string, _providerConfig?: unknown, _iterations: number = 5, _config?: TestConfig): Promise<StabilityTestResult> {
    return {
      provider: _provider,
      successRate: 0,
      avgLatency: 0,
      maxLatency: 0,
      minLatency: 0,
      errorRates: {},
    };
  }

  stopTest(): void { /* noop */ }

  getProviderList(): Array<{ id: string; name: string }> {
    return [];
  }
}

export const apiNodeTester = new APINodeTester();
