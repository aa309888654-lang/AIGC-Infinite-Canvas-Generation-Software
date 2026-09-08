import { logger } from '@/lib/logger';

export interface APIRequest {
  id: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
  timestamp: number;
  provider?: string;
  model?: string;
}

export interface APIResponse {
  requestId: string;
  status: number;
  statusText?: string;
  headers?: Record<string, string>;
  data?: unknown;
  duration: number;
  timestamp: number;
  error?: string;
}

export interface APIAnalysisEntry {
  id: string;
  request: APIRequest;
  response?: APIResponse;
  status: 'pending' | 'success' | 'error' | 'timeout';
  totalDuration?: number;
  error?: string;
  retryCount: number;
  tags?: string[];
  notes?: string;
}

export interface APIStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  totalDataTransferred: number;
  mostUsedEndpoints: Map<string, number>;
  errorTypes: Map<string, number>;
}

export interface AnalysisFilter {
  status?: APIAnalysisEntry['status'];
  provider?: string;
  startTime?: number;
  endTime?: number;
  searchQuery?: string;
}

class APIAnalyzer {
  private entries: APIAnalysisEntry[] = [];
  private maxEntries = 500;
  private listeners: Array<(entries: APIAnalysisEntry[]) => void> = [];

  private generateId(): string {
    return `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener([...this.entries]));
  }

  startCapture(): string {
    const id = this.generateId();
    return id;
  }

  logRequest(id: string, request: APIRequest): void {
    const entry: APIAnalysisEntry = {
      id,
      request: {
        ...request,
        id,
        timestamp: request.timestamp || Date.now(),
      },
      status: 'pending',
      retryCount: 0,
    };

    this.entries.unshift(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(0, this.maxEntries);
    }

    this.notifyListeners();
    logger.info(`API请求记录: ${request.method} ${request.url}`);
  }

  logResponse(id: string, response: APIResponse): void {
    const entry = this.entries.find(e => e.id === id);
    if (entry) {
      entry.response = response;
      entry.status = response.error ? 'error' : 'success';
      entry.totalDuration = response.duration;
      if (response.error) {
        entry.error = response.error;
      }
      this.notifyListeners();
      logger.info(`API响应记录: ${response.status} - ${response.duration}ms`);
    }
  }

  logError(id: string, error: string): void {
    const entry = this.entries.find(e => e.id === id);
    if (entry) {
      entry.status = 'error';
      entry.error = error;
      this.notifyListeners();
      logger.error(`API错误记录: ${error}`);
    }
  }

  incrementRetry(id: string): void {
    const entry = this.entries.find(e => e.id === id);
    if (entry) {
      entry.retryCount++;
    }
  }

  addTag(id: string, tag: string): void {
    const entry = this.entries.find(e => e.id === id);
    if (entry) {
      entry.tags = entry.tags || [];
      if (!entry.tags.includes(tag)) {
        entry.tags.push(tag);
      }
    }
  }

  addNote(id: string, note: string): void {
    const entry = this.entries.find(e => e.id === id);
    if (entry) {
      entry.notes = note;
    }
  }

  getEntries(filter?: AnalysisFilter): APIAnalysisEntry[] {
    let filtered = [...this.entries];

    if (filter) {
      if (filter.status) {
        filtered = filtered.filter(e => e.status === filter.status);
      }
      if (filter.provider) {
        filtered = filtered.filter(e => e.request.provider === filter.provider);
      }
      if (filter.startTime) {
        filtered = filtered.filter(e => e.request.timestamp >= filter.startTime!);
      }
      if (filter.endTime) {
        filtered = filtered.filter(e => e.request.timestamp <= filter.endTime!);
      }
      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        filtered = filtered.filter(e =>
          e.request.url.toLowerCase().includes(query) ||
          e.request.method.toLowerCase().includes(query) ||
          (e.request.provider?.toLowerCase().includes(query)) ||
          (e.error?.toLowerCase().includes(query))
        );
      }
    }

    return filtered;
  }

  getEntry(id: string): APIAnalysisEntry | undefined {
    return this.entries.find(e => e.id === id);
  }

  getStats(filter?: AnalysisFilter): APIStats {
    const entries = this.getEntries(filter);
    
    const successful = entries.filter(e => e.status === 'success');
    const failed = entries.filter(e => e.status === 'error');

    const avgTime = entries.reduce((sum, e) => sum + (e.totalDuration || 0), 0) / 
      (entries.length || 1);

    const endpoints = new Map<string, number>();
    const errors = new Map<string, number>();

    entries.forEach(e => {
      const endpoint = e.request.url;
      endpoints.set(endpoint, (endpoints.get(endpoint) || 0) + 1);
      
      if (e.error) {
        const errorType = this.categorizeError(e.error);
        errors.set(errorType, (errors.get(errorType) || 0) + 1);
      }
    });

    return {
      totalRequests: entries.length,
      successfulRequests: successful.length,
      failedRequests: failed.length,
      averageResponseTime: Math.round(avgTime),
      totalDataTransferred: this.calculateDataTransferred(entries),
      mostUsedEndpoints: endpoints,
      errorTypes: errors,
    };
  }

  private categorizeError(error: string): string {
    if (error.includes('401') || error.includes('403')) return '认证错误';
    if (error.includes('429')) return '限流错误';
    if (error.includes('500') || error.includes('502') || error.includes('503')) return '服务器错误';
    if (error.includes('timeout')) return '超时错误';
    if (error.includes('network') || error.includes('fetch')) return '网络错误';
    return '其他错误';
  }

  private calculateDataTransferred(entries: APIAnalysisEntry[]): number {
    return entries.reduce((sum, e) => {
      const requestSize = e.request.body ? JSON.stringify(e.request.body).length : 0;
      const responseSize = e.response?.data ? JSON.stringify(e.response.data).length : 0;
      return sum + requestSize + responseSize;
    }, 0);
  }

  exportToJSON(): string {
    return JSON.stringify({
      exportTime: new Date().toISOString(),
      entries: this.entries,
      stats: this.getStats(),
    }, null, 2);
  }

  exportToCSV(): string {
    const headers = ['ID', '时间', '方法', 'URL', '状态', '耗时(ms)', '错误', '提供商', '模型'];
    const rows = this.entries.map(e => [
      e.id,
      new Date(e.request.timestamp).toISOString(),
      e.request.method,
      e.request.url,
      e.status,
      e.totalDuration || 0,
      e.error || '',
      e.request.provider || '',
      e.request.model || '',
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  clear(filter?: AnalysisFilter): void {
    if (filter) {
      this.entries = this.entries.filter(e => {
        if (filter.status && e.status === filter.status) return false;
        if (filter.provider && e.request.provider === filter.provider) return false;
        if (filter.startTime && e.request.timestamp < filter.startTime) return false;
        if (filter.endTime && e.request.timestamp > filter.endTime) return false;
        return true;
      });
    } else {
      this.entries = [];
    }
    this.notifyListeners();
  }

  subscribe(listener: (entries: APIAnalysisEntry[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  getTimeline(filter?: AnalysisFilter): Array<{ time: number; type: string; entry: APIAnalysisEntry }> {
    const entries = this.getEntries(filter);
    const timeline: Array<{ time: number; type: string; entry: APIAnalysisEntry }> = [];

    entries.forEach(entry => {
      timeline.push({
        time: entry.request.timestamp,
        type: 'request',
        entry,
      });

      if (entry.response) {
        timeline.push({
          time: entry.response.timestamp,
          type: 'response',
          entry,
        });
      }
    });

    return timeline.sort((a, b) => b.time - a.time);
  }

  getErrorBreakdown(): Map<string, { count: number; percentage: number; examples: string[] }> {
    const errors = new Map<string, { count: number; percentage: number; examples: string[] }>();
    const totalErrors = this.entries.filter(e => e.status === 'error').length;

    this.entries.forEach(e => {
      if (e.status === 'error' && e.error) {
        const category = this.categorizeError(e.error);
        const existing = errors.get(category);
        if (existing) {
          existing.count++;
          if (existing.examples.length < 3) {
            existing.examples.push(e.error);
          }
        } else {
          errors.set(category, {
            count: 1,
            percentage: 0,
            examples: [e.error],
          });
        }
      }
    });

    errors.forEach((value) => {
      value.percentage = totalErrors > 0 ? Math.round((value.count / totalErrors) * 100) : 0;
    });

    return errors;
  }

  getPerformanceMetrics(filter?: AnalysisFilter): {
    p50: number;
    p90: number;
    p99: number;
    fastest: number;
    slowest: number;
  } {
    const entries = this.getEntries(filter)
      .filter(e => e.totalDuration !== undefined)
      .sort((a, b) => (a.totalDuration || 0) - (b.totalDuration || 0));

    if (entries.length === 0) {
      return { p50: 0, p90: 0, p99: 0, fastest: 0, slowest: 0 };
    }

    const getPercentile = (arr: APIAnalysisEntry[], p: number) => {
      const index = Math.ceil((p / 100) * arr.length) - 1;
      return arr[Math.max(0, index)]?.totalDuration || 0;
    };

    return {
      p50: getPercentile(entries, 50),
      p90: getPercentile(entries, 90),
      p99: getPercentile(entries, 99),
      fastest: entries[0]?.totalDuration || 0,
      slowest: entries[entries.length - 1]?.totalDuration || 0,
    };
  }
}

export const apiAnalyzer = new APIAnalyzer();

export default apiAnalyzer;
