import { API_BASE_URL } from './api-config';

interface MonitorConfig {
  endpoint: string;
  appId: string;
  sessionTimeout: number;
  heartbeatInterval: number;
  maxBatchSize: number;
  maxQueueSize: number;
  sampleRate: number;
  enableAutoPageView: boolean;
  enablePerformance: boolean;
  enableError: boolean;
  enableBehavior: boolean;
}

interface SessionData {
  sessionId: string;
  userId?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  lastHeartbeat: number;
  pageCount: number;
  eventCount: number;
  errorCount: number;
}

interface EventData {
  sessionId: string;
  eventType: string;
  eventName: string;
  category?: string;
  label?: string;
  value?: number;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

interface ErrorData {
  sessionId: string;
  errorType: string;
  errorMessage: string;
  stackTrace?: string;
  source?: string;
  lineNumber?: number;
  columnNumber?: number;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

interface MetricData {
  sessionId: string;
  metricName: string;
  metricValue: number;
  metricUnit?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

interface PageViewData {
  sessionId: string;
  pageUrl: string;
  pageTitle?: string;
  referrer?: string;
  utmParams?: Record<string, string>;
  timestamp: number;
}

interface DeviceInfo {
  userAgent: string;
  screenWidth: number;
  screenHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  deviceType: string;
  browserName: string;
  browserVersion: string;
  osName: string;
  osVersion: string;
  language: string;
  timezone: string;
}

class FrontendMonitor {
  private config: MonitorConfig;
  private session: SessionData | null = null;
  private eventQueue: EventData[] = [];
  private errorQueue: ErrorData[] = [];
  private metricQueue: MetricData[] = [];
  private flushTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private userId: string | null = null;
  private deviceInfo: DeviceInfo | null = null;

  constructor(config: Partial<MonitorConfig> = {}) {
    this.config = {
      endpoint: config.endpoint || `${API_BASE_URL}/monitor`,
      appId: config.appId || 'default',
      sessionTimeout: config.sessionTimeout || 1800000,
      heartbeatInterval: config.heartbeatInterval || 30000,
      maxBatchSize: config.maxBatchSize || 20,
      maxQueueSize: config.maxQueueSize || 100,
      sampleRate: config.sampleRate || 1.0,
      enableAutoPageView: config.enableAutoPageView !== false,
      enablePerformance: config.enablePerformance !== false,
      enableError: config.enableError !== false,
      enableBehavior: config.enableBehavior !== false,
    };

    this.deviceInfo = this.getDeviceInfo();
    this.init();
  }

  private init() {
    if (typeof window === 'undefined') return;

    this.startSession();
    this.setupAutoTracking();
    this.startFlushTimer();
    this.startHeartbeat();
    this.setupVisibilityHandler();
  }

  private getDeviceInfo(): DeviceInfo {
    const ua = navigator.userAgent;
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let deviceType = 'desktop';
    if (/mobile/i.test(ua)) deviceType = 'mobile';
    if (/tablet|ipad/i.test(ua)) deviceType = 'tablet';

    let browserName = 'unknown';
    let browserVersion = '';
    if (ua.includes('Firefox')) {
      browserName = 'Firefox';
      browserVersion = ua.match(/Firefox\/([\d.]+)/)?.[1] || '';
    } else if (ua.includes('Chrome')) {
      browserName = 'Chrome';
      browserVersion = ua.match(/Chrome\/([\d.]+)/)?.[1] || '';
    } else if (ua.includes('Safari')) {
      browserName = 'Safari';
      browserVersion = ua.match(/Version\/([\d.]+)/)?.[1] || '';
    } else if (ua.includes('Edge')) {
      browserName = 'Edge';
      browserVersion = ua.match(/Edge\/([\d.]+)/)?.[1] || '';
    }

    let osName = 'unknown';
    let osVersion = '';
    if (ua.includes('Windows')) {
      osName = 'Windows';
      osVersion = ua.match(/Windows NT ([\d.]+)/)?.[1] || '';
    } else if (ua.includes('Mac OS')) {
      osName = 'macOS';
      osVersion = ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replace('_', '.') || '';
    } else if (ua.includes('Linux')) {
      osName = 'Linux';
    } else if (ua.includes('Android')) {
      osName = 'Android';
      osVersion = ua.match(/Android ([\d.]+)/)?.[1] || '';
    } else if (ua.includes('iOS')) {
      osName = 'iOS';
      osVersion = ua.match(/OS ([\d_]+)/)?.[1]?.replace('_', '.') || '';
    }

    return {
      userAgent: ua,
      screenWidth,
      screenHeight,
      viewportWidth,
      viewportHeight,
      deviceType,
      browserName,
      browserVersion,
      osName,
      osVersion,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async startSession() {
    this.session = {
      sessionId: this.generateSessionId(),
      userId: this.userId || undefined,
      startTime: Date.now(),
      lastHeartbeat: Date.now(),
      pageCount: 0,
      eventCount: 0,
      errorCount: 0,
    };

    try {
      const response = await fetch(`${this.config.endpoint}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.session.sessionId,
          userId: this.session.userId,
          ...this.deviceInfo,
          startTime: this.session.startTime,
          entryPage: window.location.href,
          referrer: document.referrer,
          utmSource: this.getUrlParam('utm_source'),
          utmMedium: this.getUrlParam('utm_medium'),
          utmCampaign: this.getUrlParam('utm_campaign'),
        }),
      });

      if (!response.ok) {
        console.warn('[FrontendMonitor] Failed to create session on server');
      }
    } catch (error) {
      console.warn('[FrontendMonitor] Error creating session:', error);
    }

    if (this.config.enableAutoPageView) {
      this.trackPageView();
    }
  }

  private setupAutoTracking() {
    if (this.config.enablePerformance) {
      this.setupPerformanceTracking();
    }

    if (this.config.enableError) {
      this.setupErrorTracking();
    }

    if (this.config.enableBehavior) {
      this.setupBehaviorTracking();
    }
  }

  private setupPerformanceTracking() {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const metricData: MetricData = {
            sessionId: this.session!.sessionId,
            metricName: entry.name,
            metricValue: (entry as PerformanceEntry & { value: number }).value,
            timestamp: Date.now(),
          };

          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            metricData.metricUnit = 'ms';
            metricData.metadata = {
              type: navEntry.type,
              domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart,
              loadComplete: navEntry.loadEventEnd - navEntry.fetchStart,
            };
          } else if (entry.entryType === 'paint') {
            metricData.metricUnit = 'ms';
          }

          this.metricQueue.push(metricData);
          this.checkQueueSize();
        }
      });

      observer.observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint', 'first-input'] });

      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.trackMetric('long_task', entry.duration, 'ms', {
            startTime: entry.startTime,
          });
        }
      });

      longTaskObserver.observe({ entryTypes: ['longtask'] });

      window.addEventListener('load', () => {
        setTimeout(() => {
          if ('web-vitals' in window) {
            import('web-vitals').then(({ onCLS, onINP, onFCP, onLCP, onTTFB }) => {
              onCLS((metric) => this.trackMetric('CLS', metric.value, 'score', { id: metric.id }));
              onINP((metric) => this.trackMetric('INP', metric.value, 'ms', { id: metric.id }));
              onFCP((metric) => this.trackMetric('FCP', metric.value, 'ms', { id: metric.id }));
              onLCP((metric) => this.trackMetric('LCP', metric.value, 'ms', { id: metric.id }));
              onTTFB((metric) => this.trackMetric('TTFB', metric.value, 'ms', { id: metric.id }));
            }).catch((err) => { void err; });
          }
        }, 3000);
      });
    } catch (error) {
      console.warn('[FrontendMonitor] Performance tracking setup failed:', error);
    }
  }

  private setupErrorTracking() {
    if (typeof window === 'undefined') return;

    const originalOnerror = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      this.trackError('javascript_error', String(message), error?.stack, source, lineno, colno);
      if (originalOnerror) {
        return originalOnerror.call(window, message, source, lineno, colno, error);
      }
      return false;
    };

    const originalOnunhandledrejection = window.onunhandledrejection;
    window.onunhandledrejection = (event) => {
      const error = event.reason;
      this.trackError(
        'unhandled_promise_rejection',
        error?.message || String(error),
        error?.stack,
        undefined,
        undefined,
        undefined,
        { reason: error }
      );
      if (originalOnunhandledrejection) {
        return originalOnunhandledrejection.call(window, event);
      }
      return false;
    };

    window.addEventListener('error', (event) => {
      if (event.target && event.target !== window) {
        const target = event.target as HTMLElement & { src?: string; href?: string };
        if (target.tagName === 'SCRIPT' || target.tagName === 'IMG') {
          const resourceUrl = target.src || target.href || '';
          this.trackError(
            'resource_error',
            `Failed to load ${target.tagName.toLowerCase()}: ${resourceUrl}`,
            undefined,
            resourceUrl
          );
        }
      }
    });
  }

  private setupBehaviorTracking() {
    if (typeof window === 'undefined') return;

    let clickTimeout: number | null = null;
    let clickPosition = { x: 0, y: 0 };

    document.addEventListener('click', (event) => {
      if (clickTimeout) {
        clearTimeout(clickTimeout);
      }

      clickPosition = { x: event.clientX, y: event.clientY };

      clickTimeout = window.setTimeout(() => {
        const target = event.target as HTMLElement;
        const trackableElement = this.findTrackableElement(target);

        if (trackableElement) {
          this.trackEvent('click', trackableElement.dataset.trackName || trackableElement.textContent?.trim() || 'unknown', 'user_behavior', {
            element: trackableElement.tagName.toLowerCase(),
            className: trackableElement.className,
            id: trackableElement.id,
            text: trackableElement.textContent?.trim().substring(0, 50),
            x: clickPosition.x,
            y: clickPosition.y,
          });
        }
      }, 150);
    });

    document.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement;
      if (target.dataset.trackInput) {
        this.trackEvent('input', target.name || target.id || 'unknown', 'user_behavior', {
          inputType: target.type,
          valueLength: target.value.length,
        });
      }
    });

    let scrollTimeout: number | null = null;
    let maxScrollDepth = 0;

    window.addEventListener('scroll', () => {
      if (scrollTimeout) return;

      scrollTimeout = window.setTimeout(() => {
        scrollTimeout = null;

        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight;
        const clientHeight = document.documentElement.clientHeight;
        const scrollPercent = (scrollTop / (scrollHeight - clientHeight)) * 100;

        if (scrollPercent > maxScrollDepth) {
          maxScrollDepth = scrollPercent;
          if (maxScrollDepth > 10 && maxScrollDepth % 25 < 15) {
            this.trackMetric('scroll_depth', Math.round(maxScrollDepth), '%');
          }
        }
      }, 100);
    });

    let focusTime = 0;
    let lastFocusTime = 0;

    window.addEventListener('focus', () => {
      lastFocusTime = Date.now();
    });

    window.addEventListener('blur', () => {
      if (lastFocusTime > 0) {
        focusTime += Date.now() - lastFocusTime;
        this.trackMetric('active_time', focusTime, 'ms');
        lastFocusTime = 0;
      }
    });
  }

  private findTrackableElement(element: HTMLElement): HTMLElement | null {
    let current: HTMLElement | null = element;

    while (current && current !== document.body) {
      if (current.dataset.track === 'true' || current.dataset.trackId) {
        return current;
      }
      current = current.parentElement;
    }

    return null;
  }

  private setupVisibilityHandler() {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.endSession();
      }
    });

    window.addEventListener('beforeunload', () => {
      this.endSession();
    });
  }

  private startFlushTimer() {
    this.flushTimer = window.setInterval(() => {
      this.flush();
    }, 5000);
  }

  private startHeartbeat() {
    this.heartbeatTimer = window.setInterval(async () => {
      if (!this.session) return;

      this.session.lastHeartbeat = Date.now();

      try {
        await fetch(`${this.config.endpoint}/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: this.session.sessionId,
            duration: Date.now() - this.session.startTime,
            pageCount: this.session.pageCount,
            eventCount: this.session.eventCount,
            errorCount: this.session.errorCount,
            endTime: Date.now(),
          }),
        });
      } catch (error) {
        console.warn('[FrontendMonitor] Heartbeat failed:', error);
      }
    }, this.config.heartbeatInterval);
  }

  private checkQueueSize() {
    const totalSize = this.eventQueue.length + this.errorQueue.length + this.metricQueue.length;

    if (totalSize >= this.config.maxQueueSize) {
      this.flush();
    }

    if (this.eventQueue.length >= this.config.maxBatchSize) {
      this.flushEvents();
    }

    if (this.metricQueue.length >= this.config.maxBatchSize) {
      this.flushMetrics();
    }
  }

  public trackEvent(eventType: string, eventName: string, category?: string, metadata?: Record<string, unknown>) {
    if (!this.session || Math.random() > this.config.sampleRate) return;

    const eventData: EventData = {
      sessionId: this.session.sessionId,
      eventType,
      eventName,
      category,
      metadata,
      timestamp: Date.now(),
    };

    this.eventQueue.push(eventData);
    this.session.eventCount++;
    this.checkQueueSize();
  }

  public trackError(
    errorType: string,
    errorMessage: string,
    stackTrace?: string,
    source?: string,
    lineNumber?: number,
    columnNumber?: number,
    metadata?: Record<string, unknown>
  ) {
    if (!this.session) return;

    const errorData: ErrorData = {
      sessionId: this.session.sessionId,
      errorType,
      errorMessage,
      stackTrace,
      source,
      lineNumber,
      columnNumber,
      metadata,
      timestamp: Date.now(),
    };

    this.errorQueue.push(errorData);
    this.session.errorCount++;
    this.checkQueueSize();
  }

  public trackMetric(metricName: string, metricValue: number, metricUnit?: string, metadata?: Record<string, unknown>) {
    if (!this.session || Math.random() > this.config.sampleRate) return;

    const metricData: MetricData = {
      sessionId: this.session.sessionId,
      metricName,
      metricValue,
      metricUnit,
      metadata,
      timestamp: Date.now(),
    };

    this.metricQueue.push(metricData);
    this.checkQueueSize();
  }

  public trackPageView(pageUrl?: string, pageTitle?: string) {
    if (!this.session) return;

    const pageViewData: PageViewData = {
      sessionId: this.session.sessionId,
      pageUrl: pageUrl || window.location.href,
      pageTitle: pageTitle || document.title,
      referrer: document.referrer,
      utmParams: {
        utm_source: this.getUrlParam('utm_source') || '',
        utm_medium: this.getUrlParam('utm_medium') || '',
        utm_campaign: this.getUrlParam('utm_campaign') || '',
      },
      timestamp: Date.now(),
    };

    this.session.pageCount++;

    fetch(`${this.config.endpoint}/pageview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pageViewData),
    }).catch((err) => { void err; });
  }

  public setUserId(userId: string | null) {
    this.userId = userId;
    if (this.session) {
      this.session.userId = userId || undefined;
    }
  }

  public getSessionId(): string | null {
    return this.session?.sessionId || null;
  }

  private async flush() {
    await Promise.all([
      this.flushEvents(),
      this.flushErrors(),
      this.flushMetrics(),
    ]);
  }

  private async flushEvents() {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      await fetch(`${this.config.endpoint}/events/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
      });
    } catch (error) {
      this.eventQueue.unshift(...events);
      console.warn('[FrontendMonitor] Failed to flush events:', error);
    }
  }

  private async flushErrors() {
    if (this.errorQueue.length === 0) return;

    const errors = [...this.errorQueue];
    this.errorQueue = [];

    try {
      await fetch(`${this.config.endpoint}/errors/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errors }),
      });
    } catch (error) {
      this.errorQueue.unshift(...errors);
      console.warn('[FrontendMonitor] Failed to flush errors:', error);
    }
  }

  private async flushMetrics() {
    if (this.metricQueue.length === 0) return;

    const metrics = [...this.metricQueue];
    this.metricQueue = [];

    try {
      await fetch(`${this.config.endpoint}/metrics/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics }),
      });
    } catch (error) {
      this.metricQueue.unshift(...metrics);
      console.warn('[FrontendMonitor] Failed to flush metrics:', error);
    }
  }

  private async endSession() {
    if (!this.session) return;

    this.session.endTime = Date.now();
    this.session.duration = this.session.endTime - this.session.startTime;

    await this.flush();

    try {
      await fetch(`${this.config.endpoint}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.session.sessionId,
          endTime: this.session.endTime,
          duration: this.session.duration,
          pageCount: this.session.pageCount,
          eventCount: this.session.eventCount,
          errorCount: this.session.errorCount,
          isBounce: this.session.pageCount <= 1,
          exitPage: window.location.href,
        }),
      });
    } catch (error) {
      console.warn('[FrontendMonitor] Failed to end session:', error);
    }
  }

  private getUrlParam(param: string): string {
    if (typeof window === 'undefined') return '';
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param) || '';
  }

  public destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    this.endSession();
    this.session = null;
  }
}

let monitorInstance: FrontendMonitor | null = null;

export function initFrontendMonitor(config?: Partial<MonitorConfig>): FrontendMonitor {
  if (monitorInstance) {
    console.warn('[FrontendMonitor] Already initialized. Use getInstance() instead.');
    return monitorInstance;
  }

  monitorInstance = new FrontendMonitor(config);
  return monitorInstance;
}

export function getFrontendMonitor(): FrontendMonitor | null {
  return monitorInstance;
}

export function destroyFrontendMonitor() {
  if (monitorInstance) {
    monitorInstance.destroy();
    monitorInstance = null;
  }
}

export { FrontendMonitor };
