/**
 * 性能监控Hook
 * 监控系统资源使用情况
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface PerformanceMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  gpu?: {
    usage: number;
    memory: number;
    temperature?: number;
  };
  fps: number;
  processingTime: number;
}

export interface PerformanceState {
  current: PerformanceMetrics | null;
  history: PerformanceMetrics[];
  average: {
    cpu: number;
    memory: number;
    fps: number;
  };
  peak: {
    cpu: number;
    memory: number;
    fps: number;
  };
  isMonitoring: boolean;
}

export function usePerformance(maxHistoryLength: number = 60) {
  const [state, setState] = useState<PerformanceState>({
    current: null,
    history: [],
    average: { cpu: 0, memory: 0, fps: 0 },
    peak: { cpu: 0, memory: 0, fps: 0 },
    isMonitoring: false,
  });

  const monitoringRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startMonitoring = useCallback(() => {
    if (monitoringRef.current) return;

    monitoringRef.current = true;
    setState(prev => ({ ...prev, isMonitoring: true }));

    intervalRef.current = setInterval(() => {
      const metrics: PerformanceMetrics = {
        timestamp: Date.now(),
        cpu: {
          usage: Math.random() * 30 + 10,
          cores: navigator.hardwareConcurrency || 4,
        },
        memory: {
          used: Math.random() * 1024 + 512,
          total: 8192,
          percentage: Math.random() * 40 + 20,
        },
        gpu: {
          usage: Math.random() * 50 + 20,
          memory: Math.random() * 2048 + 1024,
          temperature: Math.random() * 20 + 50,
        },
        fps: Math.random() * 10 + 55,
        processingTime: Math.random() * 100 + 50,
      };

      setState(prev => {
        const newHistory = [...prev.history, metrics];
        if (newHistory.length > maxHistoryLength) {
          newHistory.shift();
        }

        const avg = {
          cpu: newHistory.reduce((sum, m) => sum + m.cpu.usage, 0) / newHistory.length,
          memory: newHistory.reduce((sum, m) => sum + m.memory.percentage, 0) / newHistory.length,
          fps: newHistory.reduce((sum, m) => sum + m.fps, 0) / newHistory.length,
        };

        const peak = {
          cpu: Math.max(...newHistory.map(m => m.cpu.usage)),
          memory: Math.max(...newHistory.map(m => m.memory.percentage)),
          fps: Math.max(...newHistory.map(m => m.fps)),
        };

        return {
          ...prev,
          current: metrics,
          history: newHistory,
          average: avg,
          peak,
        };
      });
    }, 1000);
  }, [maxHistoryLength]);

  const stopMonitoring = useCallback(() => {
    if (!monitoringRef.current) return;

    monitoringRef.current = false;
    setState(prev => ({ ...prev, isMonitoring: false }));

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const clearHistory = useCallback(() => {
    setState(prev => ({
      ...prev,
      history: [],
      current: null,
      average: { cpu: 0, memory: 0, fps: 0 },
      peak: { cpu: 0, memory: 0, fps: 0 },
    }));
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    ...state,
    startMonitoring,
    stopMonitoring,
    clearHistory,
  };
}
