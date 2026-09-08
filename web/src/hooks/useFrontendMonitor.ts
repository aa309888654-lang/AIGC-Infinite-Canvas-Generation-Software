import { useEffect, useRef, useCallback } from 'react';
import { initFrontendMonitor, getFrontendMonitor, destroyFrontendMonitor, FrontendMonitor } from '../lib/frontend-monitor';

interface UseFrontendMonitorOptions {
  endpoint?: string;
  appId?: string;
  sessionTimeout?: number;
  heartbeatInterval?: number;
  sampleRate?: number;
  enableAutoPageView?: boolean;
  enablePerformance?: boolean;
  enableError?: boolean;
  enableBehavior?: boolean;
  autoInit?: boolean;
}

interface UseFrontendMonitorReturn {
  monitor: FrontendMonitor | null;
  trackEvent: (eventType: string, eventName: string, category?: string, metadata?: Record<string, unknown>) => void;
  trackError: (errorType: string, errorMessage: string, stackTrace?: string, source?: string, lineNumber?: number, columnNumber?: number, metadata?: Record<string, unknown>) => void;
  trackMetric: (metricName: string, metricValue: number, metricUnit?: string, metadata?: Record<string, unknown>) => void;
  trackPageView: (pageUrl?: string, pageTitle?: string) => void;
  setUserId: (userId: string | null) => void;
  getSessionId: () => string | null;
  destroy: () => void;
}

export function useFrontendMonitor(options: UseFrontendMonitorOptions = {}): UseFrontendMonitorReturn {
  const {
    autoInit = true,
    ...monitorOptions
  } = options;

  const monitorRef = useRef<FrontendMonitor | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (autoInit && !initializedRef.current) {
      monitorRef.current = initFrontendMonitor(monitorOptions);
      initializedRef.current = true;
    } else if (!autoInit) {
      monitorRef.current = getFrontendMonitor();
    }

    return () => {
      if (autoInit && initializedRef.current) {
        destroyFrontendMonitor();
        initializedRef.current = false;
      }
    };
  }, [autoInit, JSON.stringify(monitorOptions), monitorOptions]);

  const trackEvent = useCallback((
    eventType: string,
    eventName: string,
    category?: string,
    metadata?: Record<string, unknown>
  ) => {
    monitorRef.current?.trackEvent(eventType, eventName, category, metadata);
  }, []);

  const trackError = useCallback((
    errorType: string,
    errorMessage: string,
    stackTrace?: string,
    source?: string,
    lineNumber?: number,
    columnNumber?: number,
    metadata?: Record<string, unknown>
  ) => {
    monitorRef.current?.trackError(errorType, errorMessage, stackTrace, source, lineNumber, columnNumber, metadata);
  }, []);

  const trackMetric = useCallback((
    metricName: string,
    metricValue: number,
    metricUnit?: string,
    metadata?: Record<string, unknown>
  ) => {
    monitorRef.current?.trackMetric(metricName, metricValue, metricUnit, metadata);
  }, []);

  const trackPageView = useCallback((pageUrl?: string, pageTitle?: string) => {
    monitorRef.current?.trackPageView(pageUrl, pageTitle);
  }, []);

  const setUserId = useCallback((userId: string | null) => {
    monitorRef.current?.setUserId(userId);
  }, []);

  const getSessionId = useCallback(() => {
    return monitorRef.current?.getSessionId() || null;
  }, []);

  const destroy = useCallback(() => {
    if (autoInit && initializedRef.current) {
      destroyFrontendMonitor();
      initializedRef.current = false;
      monitorRef.current = null;
    }
  }, [autoInit]);

  return {
    monitor: monitorRef.current,
    trackEvent,
    trackError,
    trackMetric,
    trackPageView,
    setUserId,
    getSessionId,
    destroy,
  };
}
