import axios from 'axios';
import { Alert } from './backend-stability-monitor';
import { loggingService } from './logging-service';

/**
 * 告警服务 - P0 修复
 * 订阅 backendStabilityMonitor 的 alert 事件，通过 webhook/邮件外发告警
 * 支持告警去重与抑制（相同告警 5 分钟内不重复发送）
 */

interface AlertChannel {
  type: 'webhook' | 'email';
  url?: string;
  enabled: boolean;
}

class AlertService {
  private channels: AlertChannel[] = [];
  // 去重缓存：key = `${service}:${type}`，value = 上次发送时间戳
  private dedupCache = new Map<string, number>();
  private readonly DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 分钟去重窗口
  private initialized = false;

  init() {
    if (this.initialized) return;
    this.initialized = true;

    // 读取 webhook 配置
    const webhookUrl = process.env.ALERT_WEBHOOK_URL || process.env.WEBHOOK_URL;
    if (webhookUrl) {
      this.channels.push({
        type: 'webhook',
        url: webhookUrl,
        enabled: true,
      });
      console.log(`[AlertService] Webhook 告警通道已启用: ${webhookUrl.substring(0, 40)}...`);
    } else {
      console.warn('[AlertService] 未配置 ALERT_WEBHOOK_URL，告警将仅记录日志');
    }

    // 邮件告警配置（可选，预留）
    const alertEmail = process.env.ALERT_EMAIL;
    if (alertEmail) {
      this.channels.push({ type: 'email', enabled: false }); // email 通道暂不实现发送，仅预留
    }
  }

  /**
   * 处理告警事件
   */
  async handleAlert(alert: Alert): Promise<void> {
    const dedupKey = `${alert.service}:${alert.type}`;
    const now = Date.now();

    // 去重：5 分钟内相同告警不重复发送
    const lastSent = this.dedupCache.get(dedupKey);
    if (lastSent && now - lastSent < this.DEDUP_WINDOW_MS) {
      return; // 抑制重复告警
    }
    this.dedupCache.set(dedupKey, now);

    // 清理过期去重缓存（超过 1 小时）
    if (this.dedupCache.size > 100) {
      for (const [key, ts] of this.dedupCache.entries()) {
        if (now - ts > 60 * 60 * 1000) {
          this.dedupCache.delete(key);
        }
      }
    }

    const level = alert.type === 'critical' ? '🚨 CRITICAL' : '⚠️ WARNING';
    const message = `[${level}] ${alert.service}: ${alert.message}`;
    console.warn(`[AlertService] ${message}`);

    // 记录到日志系统
    loggingService.error('系统告警', {
      alert,
      message,
    });

    // 并行发送到所有启用的通道
    const sendPromises = this.channels
      .filter((ch) => ch.enabled)
      .map((ch) => this.sendToChannel(ch, alert, message));
    await Promise.allSettled(sendPromises);
  }

  private async sendToChannel(channel: AlertChannel, alert: Alert, message: string): Promise<void> {
    try {
      if (channel.type === 'webhook' && channel.url) {
        await this.sendWebhook(channel.url, alert, message);
      }
      // email 通道预留
    } catch (error) {
      console.error(`[AlertService] 发送到 ${channel.type} 通道失败:`, error);
    }
  }

  private async sendWebhook(url: string, alert: Alert, message: string): Promise<void> {
    // 兼容飞书/钉钉/企业微信 webhook 格式
    const payload = {
      msg_type: 'text',
      content: {
        text: `${message}\n\n指标: ${alert.metric || 'N/A'}\n当前值: ${alert.value ?? 'N/A'}\n阈值: ${alert.threshold ?? 'N/A'}\n时间: ${alert.timestamp}\n服务: ${alert.service}`,
      },
      // 额外字段，供自定义 webhook 使用
      alert,
      message,
      timestamp: alert.timestamp,
      level: alert.type,
    };

    await axios.post(url, payload, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const alertService = new AlertService();
