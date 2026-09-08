/**
 * P2 修复 #18：Prometheus 指标服务
 * 基于 prom-client 提供：
 * - collectDefaultMetrics()：Node.js 默认指标（事件循环延迟、GC、内存、CPU 等）
 * - HTTP 请求直方图：http_request_duration_seconds（按 method/route/status 分桶）
 * - HTTP 请求计数器：http_requests_total
 * - HTTP 错误计数器：http_errors_total
 * - DB 查询延迟直方图：db_query_duration_seconds
 * - Redis 操作延迟直方图：redis_operation_duration_seconds
 *
 * 暴露端点：GET /metrics（Prometheus 标准抓取路径）
 */
import {
  Registry,
  collectDefaultMetrics,
  Histogram,
  Counter,
  Gauge,
} from 'prom-client';

class MetricsService {
  private registry: Registry;
  private httpDuration: Histogram<string>;
  private httpRequestsTotal: Counter<string>;
  private httpErrorsTotal: Counter<string>;
  private dbQueryDuration: Histogram<string>;
  private redisOpDuration: Histogram<string>;
  private activeConnections: Gauge<string>;

  constructor() {
    this.registry = new Registry();

    // P2 修复 #18：启用 Node.js 默认指标采集
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'nodejs_',
    });

    // HTTP 请求耗时直方图（关键指标）
    this.httpDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP 请求处理耗时（秒）',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    // HTTP 请求总数
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'HTTP 请求总数',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    // HTTP 错误总数（5xx）
    this.httpErrorsTotal = new Counter({
      name: 'http_errors_total',
      help: 'HTTP 5xx 错误总数',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    // 数据库查询耗时
    this.dbQueryDuration = new Histogram({
      name: 'db_query_duration_seconds',
      help: '数据库查询耗时（秒）',
      labelNames: ['model', 'operation'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
      registers: [this.registry],
    });

    // Redis 操作耗时
    this.redisOpDuration = new Histogram({
      name: 'redis_operation_duration_seconds',
      help: 'Redis 操作耗时（秒）',
      labelNames: ['operation'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
      registers: [this.registry],
    });

    // 活跃连接数
    this.activeConnections = new Gauge({
      name: 'active_connections',
      help: '当前活跃连接数',
      registers: [this.registry],
    });
  }

  /** 记录 HTTP 请求（由 metrics 中间件调用） */
  recordHttpRequest(method: string, route: string, statusCode: number, durationSeconds: number): void {
    const labels = { method, route, status_code: String(statusCode) };
    this.httpRequestsTotal.inc(labels);
    this.httpDuration.observe(labels, durationSeconds);
    if (statusCode >= 500) {
      this.httpErrorsTotal.inc(labels);
    }
  }

  /** 记录数据库查询（由 prisma 扩展或手动埋点调用） */
  recordDbQuery(model: string, operation: string, durationSeconds: number): void {
    this.dbQueryDuration.observe({ model, operation }, durationSeconds);
  }

  /** 记录 Redis 操作 */
  recordRedisOp(operation: string, durationSeconds: number): void {
    this.redisOpDuration.observe({ operation }, durationSeconds);
  }

  /** 设置活跃连接数 */
  setActiveConnections(count: number): void {
    this.activeConnections.set(count);
  }

  /** 获取 Prometheus 格式文本（供 /metrics 端点） */
  async metrics(): Promise<string> {
    return this.registry.metrics();
  }

  /** 获取 Content-Type（Prometheus 0.0.4 格式） */
  getContentType(): string {
    return this.registry.contentType;
  }
}

export const metricsService = new MetricsService();
export default metricsService;
