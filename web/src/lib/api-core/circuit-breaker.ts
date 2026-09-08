import { CircuitBreakerError } from './errors';

export class CircuitBreaker {
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private isResetting: boolean = false; // Mutex for half-open state
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
      // Don't count CircuitBreakerError as a real failure
      if (error instanceof CircuitBreakerError) {
        throw error;
      }
      this.onFailure();
      throw error;
    }
  }

  private isOpen(): boolean {
    if (this.failureCount >= this.threshold) {
      const now = Date.now();
      // Add jitter to reset timeout to prevent thundering herd
      const jitter = Math.random() * this.resetTimeoutMs * 0.1;
      if (now - this.lastFailureTime > this.resetTimeoutMs + jitter) {
        // Half-open state: allow exactly one request through using a mutex
        if (this.isResetting) {
          return true; // Another request is already probing
        }
        this.isResetting = true;
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
    this.isResetting = false;
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.isResetting = false;
  }
}
