export class FeatureFlags {
  private userWhitelist: Set<string> = new Set();
  private grayPercentage: number = 0; // 0-100

  constructor(whitelist: string[] = [], percentage: number = 0) {
    this.userWhitelist = new Set(whitelist);
    this.grayPercentage = percentage;
  }

  public updateConfig(whitelist: string[], percentage: number) {
    this.userWhitelist = new Set(whitelist);
    this.grayPercentage = Math.max(0, Math.min(100, percentage));
  }

  public isEnabled(userId: string): boolean {
    if (this.userWhitelist.has(userId)) return true;
    
    // 基于 userId 的哈希决定是否命中灰度
    const hash = this.hashString(userId);
    return (hash % 100) < this.grayPercentage;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

// 简单的 Prometheus 指标模拟
export class MetricsService {
  private metrics = {
    requestsTotal: 0,
    successTotal: 0,
    retriesTotal: 0,
    latencyMs: [] as number[],
    failureReasons: new Map<string, number>()
  };

  public recordRequest() {
    this.metrics.requestsTotal++;
  }

  public recordSuccess(latencyMs: number) {
    this.metrics.successTotal++;
    this.metrics.latencyMs.push(latencyMs);
    // 保持内存不爆炸
    if (this.metrics.latencyMs.length > 1000) {
      this.metrics.latencyMs.shift();
    }
  }

  public recordRetry() {
    this.metrics.retriesTotal++;
  }

  public recordFailure(reason: string) {
    const count = this.metrics.failureReasons.get(reason) || 0;
    this.metrics.failureReasons.set(reason, count + 1);
  }

  /**
   * 输出 Prometheus 格式的指标
   */
  public exportMetrics(): string {
    const successRate = this.metrics.requestsTotal === 0 ? 0 : 
      (this.metrics.successTotal / this.metrics.requestsTotal) * 100;
    
    const avgLatency = this.metrics.latencyMs.length === 0 ? 0 :
      this.metrics.latencyMs.reduce((a, b) => a + b, 0) / this.metrics.latencyMs.length;

    let output = `# HELP api_requests_total Total number of API requests\n`;
    output += `# TYPE api_requests_total counter\n`;
    output += `api_requests_total ${this.metrics.requestsTotal}\n\n`;

    output += `# HELP api_success_total Total number of successful API requests\n`;
    output += `# TYPE api_success_total counter\n`;
    output += `api_success_total ${this.metrics.successTotal}\n\n`;

    output += `# HELP api_retries_total Total number of API retries\n`;
    output += `# TYPE api_retries_total counter\n`;
    output += `api_retries_total ${this.metrics.retriesTotal}\n\n`;

    output += `# HELP api_latency_avg_ms Average API latency in milliseconds\n`;
    output += `# TYPE api_latency_avg_ms gauge\n`;
    output += `api_latency_avg_ms ${avgLatency.toFixed(2)}\n\n`;

    output += `# HELP api_success_rate Percentage of successful requests\n`;
    output += `# TYPE api_success_rate gauge\n`;
    output += `api_success_rate ${successRate.toFixed(2)}\n\n`;

    output += `# HELP api_failure_reasons Count of failures by reason\n`;
    output += `# TYPE api_failure_reasons counter\n`;
    for (const [reason, count] of this.metrics.failureReasons.entries()) {
      output += `api_failure_reasons{reason="${reason.replace(/"/g, '\\"')}"} ${count}\n`;
    }

    return output;
  }
}

export const featureFlags = new FeatureFlags();
export const metricsService = new MetricsService();
