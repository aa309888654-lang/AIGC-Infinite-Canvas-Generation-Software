import { UnifiedApiResponse } from './dto';

export type TaskStatusChecker = (taskId: string) => Promise<UnifiedApiResponse>;

export class TaskTracker {
  private webhookCallbacks: Map<string, (response: UnifiedApiResponse) => void> = new Map();

  /**
   * 启动轮询+Webhook双通道追踪
   * @param taskId 任务ID
   * @param checkStatus 轮询状态的方法
   * @param maxPollingCount 最大轮询次数(默认60次)
   * @param pollingIntervalMs 轮询间隔(默认2000ms)
   * @param webhookTimeoutMs Webhook超时阈值(默认45000ms)
   */
  async track(
    taskId: string, 
    checkStatus: TaskStatusChecker,
    maxPollingCount: number = 60,
    pollingIntervalMs: number = 2000,
    webhookTimeoutMs: number = 45000
  ): Promise<UnifiedApiResponse> {
    
    // 1. Webhook Promise
    const webhookPromise = new Promise<UnifiedApiResponse>((resolve) => {
      const timeoutId = setTimeout(() => {
        this.webhookCallbacks.delete(taskId);
        resolve({ success: false, error: 'Webhook timeout', message: 'Webhook超时，依赖轮询结果' } as any as UnifiedApiResponse);
        console.warn(`[TaskTracker] Webhook timeout for task ${taskId} after ${webhookTimeoutMs}ms`);
      }, webhookTimeoutMs);

      this.webhookCallbacks.set(taskId, (response) => {
        clearTimeout(timeoutId);
        this.webhookCallbacks.delete(taskId);
        resolve(response);
      });
    });

    // 2. Polling Promise
    const pollingPromise = this.startPolling(taskId, checkStatus, maxPollingCount, pollingIntervalMs);

    // 双通道，谁先返回结果就用谁的
    return Promise.race([webhookPromise, pollingPromise]);
  }

  private async startPolling(
    taskId: string, 
    checkStatus: TaskStatusChecker, 
    maxCount: number, 
    intervalMs: number
  ): Promise<UnifiedApiResponse> {
    let count = 0;
    
    while (count < maxCount) {
      await this.sleep(intervalMs);
      count++;
      
      try {
        const response = await checkStatus(taskId);
        if (response.status === 'success' || response.status === 'failed') {
          return response;
        }
        // pending or processing, continue polling
      } catch (error) {
        console.error(`[TaskTracker] Polling error for task ${taskId}:`, error);
        // Continue polling despite errors, might be transient
      }
    }
    
    throw new Error(`Polling timeout after ${maxCount} attempts`);
  }

  /**
   * 模拟接收到 Webhook 回调
   */
  public receiveWebhook(taskId: string, response: UnifiedApiResponse): void {
    const callback = this.webhookCallbacks.get(taskId);
    if (callback) {
      // console.log(`[TaskTracker] Received webhook for task ${taskId}`);
      callback(response);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const taskTracker = new TaskTracker();
