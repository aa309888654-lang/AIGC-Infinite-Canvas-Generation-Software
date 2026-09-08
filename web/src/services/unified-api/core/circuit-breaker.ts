/**
 * 熔断器实现
 * 合并 lib/api-core/circuit-breaker.ts
 */

import { CircuitBreakerError } from './errors';

export class CircuitBreaker {
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private readonly threshold: number;
  private readonly resetTimeoutMs: number;

  constructor(threshold: number = 5, resetTimeoutMs: number = 60000) {
    this.threshold = threshold;
    this.resetTimeoutMs = resetTimeoutMs;
  }

  async execute<T>(action: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new CircuitBreakerError(`Circuit breaker is open. Please wait ${this.getRemainingTimeout()}ms`);
    }

    try {
      const result = await action();
      this.onSuccess();
      return result;
    } catch (error: unknown) {
      this.onFailure();
      throw error;
    }
  }

  private isOpen(): boolean {
    if (this.failureCount >= this.threshold) {
      const now = Date.now();
      if (now - this.lastFailureTime > this.resetTimeoutMs) {
        this.failureCount = this.threshold - 1;
        return false;
      }
      return true;
    }
    return false;
  }

  private getRemainingTimeout(): number {
    const now = Date.now();
    const elapsed = now - this.lastFailureTime;
    return Math.max(0, this.resetTimeoutMs - elapsed);
  }

  private onSuccess(): void {
    this.failureCount = 0;
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
  }

  public getState(): 'closed' | 'open' | 'half-open' {
    if (this.failureCount >= this.threshold) {
      const now = Date.now();
      if (now - this.lastFailureTime > this.resetTimeoutMs) {
        return 'half-open';
      }
      return 'open';
    }
    return 'closed';
  }

  public getFailureCount(): number {
    return this.failureCount;
  }

  public reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}
