import { ApiNetworkError, ParamValidationError, CircuitBreakerError } from './errors';

export interface AlertConfig {
  dingtalkWebhook?: string;
  emailEndpoint?: string;
}

export class AlertService {
  private config: AlertConfig;

  constructor(config: AlertConfig = {}) {
    this.config = config;
  }

  public setConfig(config: AlertConfig) {
    this.config = config;
  }

  /**
   * 异常分类处理入口
   */
  public async handleError(error: unknown, context: Record<string, unknown> = {}): Promise<void> {
    const isRetryable = this.isRetryable(error);

    if (!isRetryable) {
      // 不可重试的错误，直接进入失败队列并触发告警
      await this.triggerAlert(error, context);
      this.addToFailedQueue(error, context);
    }
  }

  private isRetryable(error: unknown): boolean {
    if (error instanceof ParamValidationError) return false; // 参数错误不可重试
    if (error instanceof ApiNetworkError) return error.retryable;
    if (error instanceof CircuitBreakerError) return false; // 熔断期间不可重试，等熔断恢复

    // 默认未知错误不可重试
    return false;
  }

  private async triggerAlert(error: unknown, context: Record<string, unknown>): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const alertMsg = `
      [🔥 ALERT] AI Generation Task Failed
      Error: ${errorMessage}
      Context: ${JSON.stringify(context)}
      Time: ${new Date().toISOString()}
    `;

    console.error(alertMsg);

    const alertPromises: Promise<void>[] = [];

    if (this.config.dingtalkWebhook) {
      alertPromises.push(this.sendDingTalkAlert(alertMsg));
    }

    if (this.config.emailEndpoint) {
      alertPromises.push(this.sendEmailAlert(alertMsg));
    }

    if (alertPromises.length > 0) {
      try {
        await Promise.allSettled(alertPromises);
      } catch (e) {
        console.error('Failed to send alerts', e);
      }
    }
  }

  private async sendDingTalkAlert(message: string): Promise<void> {
    if (!this.config.dingtalkWebhook) return;

    try {
      await fetch(this.config.dingtalkWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'text',
          text: { content: message }
        })
      });
    } catch (e) {
      console.error('DingTalk alert failed', e);
    }
  }

  private async sendEmailAlert(message: string): Promise<void> {
    if (!this.config.emailEndpoint) return;

    try {
      await fetch(this.config.emailEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: 'AI Generation API Alert',
          body: message
        })
      });
    } catch (e) {
      console.error('Email alert failed', e);
    }
  }

  private addToFailedQueue(error: unknown, context: Record<string, unknown>): void {
    // 这里可以将失败任务存入本地存储或发送到后端死信队列
    const errorMessage = error instanceof Error ? error.message : String(error);
    const failedTask = {
      error: errorMessage,
      context,
      timestamp: Date.now()
    };
    
    // 简单存在 localStorage 作为演示
    try {
      const queue = JSON.parse(localStorage.getItem('failed_tasks_queue') || '[]');
      queue.push(failedTask);
      localStorage.setItem('failed_tasks_queue', JSON.stringify(queue.slice(-100))); // 保留最近100条
    } catch (e) {
      // 忽略存储错误
    }
  }
}

export const alertService = new AlertService();
