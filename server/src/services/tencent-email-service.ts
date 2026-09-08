import crypto from 'crypto';
import * as TencentCloud from 'tencentcloud-sdk-nodejs';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { normalizeEmail } from '../utils/encryption';
const SESClient = TencentCloud.ses.v20201002.Client;

interface TencentEmailConfig {
  secretId: string;
  secretKey: string;
  region?: string;
  domain: string;
  senderAddress: string;
  templateId: number;
}

export type EmailVerificationPurpose = 'verification' | 'reset_password' | 'bind_email';

class TencentEmailService {
  private config: TencentEmailConfig;
  private client: any;
  private configLoaded: boolean = false;
  private readonly CODE_LENGTH = 6;
  private readonly CODE_EXPIRY_MINUTES = 10;
  private readonly RESEND_INTERVAL_SECONDS = 120;
  private readonly IP_RESEND_INTERVAL_SECONDS = 120;
  private readonly DAILY_LIMIT = 10;
  private readonly MAX_VERIFICATION_ATTEMPTS = 5;

  constructor() {
    this.config = {
      secretId: '',
      secretKey: '',
      region: 'ap-guangzhou',
      domain: '',
      senderAddress: '',
      templateId: 0,
    };
    this.loadConfigFromEnv();
  }

  private loadConfigFromEnv(): void {
    this.config = {
      secretId: process.env.TENCENT_EMAIL_SECRET_ID || '',
      secretKey: process.env.TENCENT_EMAIL_SECRET_KEY || '',
      region: process.env.TENCENT_EMAIL_REGION || 'ap-guangzhou',
      domain: process.env.TENCENT_EMAIL_DOMAIN || '',
      senderAddress: process.env.TENCENT_EMAIL_SENDER || '',
      templateId: parseInt(process.env.TENCENT_EMAIL_TEMPLATE_ID || '0'),
    };

    if (this.config.secretId && this.config.secretKey) {
      this.initClient();
      this.configLoaded = true;
    }
  }

  private initClient(): void {
    try {
      this.client = new SESClient({
        credential: {
          secretId: this.config.secretId,
          secretKey: this.config.secretKey,
        },
        region: this.config.region,
        profile: {
          httpProfile: {
            endpoint: `ses.${this.config.region}.tencentcloudapi.com`,
            protocol: 'https://',
          },
        },
      });
      logger.debug('[Tencent Email] Client initialized with region:', this.config.region);
    } catch (error) {
      logger.error('[Tencent Email] Client init failed:', error);
    }
  }

  private async ensureConfig(): Promise<void> {
    if (this.configLoaded && this.config.secretId && this.config.secretKey) {
      return;
    }

    try {
      const row = await prisma.systemConfig.findUnique({
        where: { key: 'tencent_email_config' },
      });
      if (row) {
        const dbConfig = JSON.parse(row.value);
        if (dbConfig.secretId && dbConfig.secretKey && dbConfig.secretKey !== '********') {
          this.config = {
            secretId: dbConfig.secretId || this.config.secretId,
            secretKey: dbConfig.secretKey || this.config.secretKey,
            region: dbConfig.region || this.config.region || 'ap-guangzhou',
            domain: dbConfig.domain || this.config.domain,
            senderAddress: dbConfig.sender || dbConfig.senderAddress || this.config.senderAddress,
            templateId: dbConfig.templateId || this.config.templateId,
          };
          this.initClient();
          this.configLoaded = true;
          logger.info('[Tencent Email] Config loaded from database');
          return;
        }
      }
    } catch (e) {
      logger.warn('[Tencent Email] Failed to load config from DB:', e);
    }

    this.loadConfigFromEnv();
  }

  public generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < this.CODE_LENGTH; i++) {
      code += chars[crypto.randomInt(0, chars.length)];
    }
    return code;
  }

  public validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  public async checkRateLimit(
    email: string,
    ipAddress?: string
  ): Promise<{
    canSend: boolean;
    remainingSeconds: number;
    todayCount: number;
    error?: string;
  }> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const todayLogs = await prisma.emailSendLog.count({
      where: {
        email,
        status: 'sent',
        createdAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });

    if (todayLogs >= this.DAILY_LIMIT) {
      return {
        canSend: false,
        remainingSeconds: 0,
        todayCount: todayLogs,
        error: '今日发送次数已达上限',
      };
    }

    // 检查同一邮箱的发送间隔（10分钟）
    const lastSent = await prisma.emailVerification.findFirst({
      where: {
        email,
        status: { in: ['pending', 'verified'] },
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (lastSent) {
      const lastSentTime = new Date(lastSent.createdAt).getTime();
      const elapsedSeconds = (Date.now() - lastSentTime) / 1000;
      const remainingSeconds = Math.ceil(this.RESEND_INTERVAL_SECONDS - elapsedSeconds);

      if (remainingSeconds > 0) {
        return {
          canSend: false,
          remainingSeconds,
          todayCount: todayLogs,
          error: `验证码已发送，请${Math.ceil(remainingSeconds / 60)}分钟后重试`,
        };
      }
    }

    // 检查同一IP的发送间隔 - 防止换邮箱频繁发送
    // 修复：原查询未按 IP 过滤，导致不同用户互相阻挡触发"操作过于频繁"
    if (ipAddress) {
      const ipLastSent = await prisma.emailSendLog.findFirst({
        where: {
          ipAddress,
          status: 'sent',
          createdAt: {
            gte: new Date(Date.now() - this.IP_RESEND_INTERVAL_SECONDS * 1000),
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (ipLastSent && ipLastSent.email !== email) {
        const lastSentTime = new Date(ipLastSent.createdAt).getTime();
        const elapsedSeconds = (Date.now() - lastSentTime) / 1000;
        const remainingSeconds = Math.ceil(this.IP_RESEND_INTERVAL_SECONDS - elapsedSeconds);

        if (remainingSeconds > 0) {
          return {
            canSend: false,
            remainingSeconds,
            todayCount: todayLogs,
            error: `操作过于频繁，请${Math.ceil(remainingSeconds / 60)}分钟后重试`,
          };
        }
      }
    }

    return {
      canSend: true,
      remainingSeconds: 0,
      todayCount: todayLogs,
    };
  }

  public async sendVerificationCode(
    email: string,
    type: 'verification' | 'reset_password' | 'bind_email',
    ipAddress?: string
  ): Promise<{
    success: boolean;
    error?: string;
    expiresAt?: string;
  }> {
    const normalizedEmail = normalizeEmail(email);
    await this.ensureConfig();

    if (!this.config.secretId || !this.config.secretKey) {
      logger.error('[Tencent Email] Missing credentials after ensureConfig');
      return {
        success: false,
        error: '邮件服务未配置，请在管理后台配置邮件服务',
      };
    }

    if (!this.validateEmail(normalizedEmail)) {
      return {
        success: false,
        error: '邮箱格式不正确',
      };
    }

    const rateLimit = await this.checkRateLimit(normalizedEmail, ipAddress);
    if (!rateLimit.canSend) {
      return {
        success: false,
        error: rateLimit.error || '发送过于频繁，请稍后重试',
      };
    }

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + this.CODE_EXPIRY_MINUTES * 60 * 1000);

    await prisma.emailVerification.updateMany({
      where: { email: normalizedEmail, type, status: { in: ['pending', 'verified'] } },
      data: {
        status: 'expired',
      },
    });

    const verification = await prisma.emailVerification.create({
      data: {
        email: normalizedEmail,
        code,
        type,
        status: 'pending',
        expiresAt,
        ipAddress: ipAddress || '',
      },
    });

    const emailResult = await this.sendEmail(normalizedEmail, code);

    if (!emailResult.success) {
      logger.error('[Tencent Email] Email sending failed:', emailResult.error);
      await prisma.emailVerification.update({
        where: { id: verification.id },
        data: { status: 'failed' },
      });
      await prisma.emailSendLog.create({
        data: {
          email: normalizedEmail,
          type,
          status: 'failed',
          errorMessage: emailResult.error || 'Unknown error',
          ipAddress: ipAddress || null,
        },
      });
      return {
        success: false,
        error: emailResult.error || 'Failed to send email',
      };
    }

    await prisma.emailSendLog.create({
      data: {
        email: normalizedEmail,
        type,
        status: 'sent',
        messageId: emailResult.messageId,
        ipAddress: ipAddress || null,
      },
    });

    logger.info(
      `[Tencent Email] Verification code sent to ${normalizedEmail}, expires at ${expiresAt.toISOString()}`
    );

    return {
      success: true,
      expiresAt: expiresAt.toISOString(),
    };
  }

  public async verifyCode(
    email: string,
    code: string,
    purpose: EmailVerificationPurpose = 'verification'
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    const now = new Date();
    const normalizedEmail = normalizeEmail(email);
    logger.debug(`[verifyCode] 验证请求: email=${normalizedEmail}, purpose=${purpose}`);

    const verification = await prisma.emailVerification.findFirst({
      where: {
        email: normalizedEmail,
        code,
        type: purpose,
        status: { in: ['pending', 'verified'] },
        expiresAt: { gt: now },
        attempts: { lt: this.MAX_VERIFICATION_ATTEMPTS },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      return this.recordFailedAttempt(normalizedEmail, purpose, now);
    }

    if (verification.status === 'pending') {
      await prisma.emailVerification.updateMany({
        where: { id: verification.id, status: 'pending' },
        data: { status: 'verified', verifiedAt: now },
      });
    }

    return {
      success: true,
    };
  }

  /**
   * Atomically consume a verified contact code before a security-sensitive change.
   * Preliminary verification may mark a code as verified, but only this method authorizes binding,
   * registration, or password reset exactly once.
   */
  public async consumeCode(
    email: string,
    code: string,
    purpose: EmailVerificationPurpose
  ): Promise<{ success: boolean; error?: string }> {
    const now = new Date();
    const normalizedEmail = normalizeEmail(email);
    const consumed = await prisma.emailVerification.updateMany({
      where: {
        email: normalizedEmail,
        code,
        type: purpose,
        status: { in: ['pending', 'verified'] },
        expiresAt: { gt: now },
        attempts: { lt: this.MAX_VERIFICATION_ATTEMPTS },
      },
      data: { status: 'consumed', verifiedAt: now },
    });

    if (consumed.count > 0) return { success: true };
    return this.recordFailedAttempt(normalizedEmail, purpose, now);
  }

  private async recordFailedAttempt(
    email: string,
    purpose: EmailVerificationPurpose,
    now: Date
  ): Promise<{ success: false; error: string }> {
    const latest = await prisma.emailVerification.findFirst({
      where: {
        email,
        type: purpose,
        status: { in: ['pending', 'verified'] },
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!latest) return { success: false, error: '验证码错误或已过期' };

    const attempts = latest.attempts + 1;
    await prisma.emailVerification.update({
      where: { id: latest.id },
      data: {
        attempts,
        ...(attempts >= this.MAX_VERIFICATION_ATTEMPTS ? { status: 'expired' } : {}),
      },
    });

    return {
      success: false,
      error:
        attempts >= this.MAX_VERIFICATION_ATTEMPTS
          ? '验证码错误次数过多，请重新获取'
          : '验证码错误或已过期',
    };
  }

  public async sendPasswordResetNotification(email: string, newPassword: string): Promise<boolean> {
    await this.ensureConfig();

    const subject = '【AICG】您的密码已重置';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #333; text-align: center;">密码重置通知</h2>
        <p style="font-size: 16px; color: #555;">您好，</p>
        <p style="font-size: 16px; color: #555;">管理员已重置了您的账户密码。</p>
        <div style="background-color: #fff3e0; padding: 15px; border-radius: 4px; margin: 20px 0; text-align: center; border-left: 4px solid #ff9800;">
          <p style="font-size: 14px; color: #e65100; margin: 0;">为确保账户安全，新密码不再通过邮件发送。</p>
          <p style="font-size: 14px; color: #555; margin-top: 10px;">请联系管理员获取新密码，或在登录后立即修改密码。</p>
        </div>
        <p style="font-size: 14px; color: #777;">如果您未申请密码重置，请立即联系管理员。</p>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px;">
          <p>此邮件由系统自动发送，请勿回复。</p>
          <p>&copy; ${new Date().getFullYear()} AICG系统. 保留所有权利。</p>
        </div>
      </div>
    `;

    try {
      const params = {
        FromEmailAddress: `AICGXT <${this.config.senderAddress}>`,
        Destination: [email],
        Subject: subject,
        Simple: {
          Html: html,
        },
      };

      const response = await this.client.SendEmail(params);
      logger.info(`[Tencent Email] Password reset notification sent to ${email}`);
      return true;
    } catch (error) {
      logger.error('[Tencent Email] Failed to send password reset notification:', error);
      return false;
    }
  }
  private async sendEmail(
    email: string,
    code: string
  ): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    const regionsToTry = [
      { region: this.config.region, label: 'configured' },
      { region: 'ap-hongkong', label: 'hongkong' },
      { region: '', label: 'auto' },
    ];

    let lastError: string = '';

    for (const config of regionsToTry) {
      const region = config.region;
      try {
        logger.debug('[Tencent Email] Sending email to:', email);
        logger.debug('[Tencent Email] Attempting with region:', region || '(auto/nearest)');
        logger.debug('[Tencent Email] Sender:', this.config.senderAddress);
        logger.debug('[Tencent Email] Template ID:', this.config.templateId);

        const params = {
          FromEmailAddress: `AICGXT <${this.config.senderAddress}>`,
          Destination: [email],
          Subject: '验证码',
          Template: {
            TemplateID: this.config.templateId,
            TemplateData: JSON.stringify({ code }),
          },
        };

        let clientToUse: any;
        let endpointUrl: string;

        if (!region) {
          endpointUrl = 'ses.tencentcloudapi.com';
          clientToUse = new SESClient({
            credential: {
              secretId: this.config.secretId,
              secretKey: this.config.secretKey,
            },
            profile: {
              httpProfile: {
                endpoint: endpointUrl,
              },
            },
          });
        } else if (config.label === 'configured') {
          endpointUrl = `ses.${region}.tencentcloudapi.com`;
          clientToUse = this.client;
        } else {
          endpointUrl = `ses.${region}.tencentcloudapi.com`;
          clientToUse = new SESClient({
            credential: {
              secretId: this.config.secretId,
              secretKey: this.config.secretKey,
            },
            region,
            profile: {
              httpProfile: {
                endpoint: endpointUrl,
              },
            },
          });
        }

        logger.debug('[Tencent Email] Using endpoint:', endpointUrl);
        const res = await clientToUse.SendEmail(params);

        logger.debug('[Tencent Email] Response:', JSON.stringify(res, null, 2));

        if (res.MessageId) {
          logger.info(
            `[Tencent Email] Email sent successfully using endpoint ${endpointUrl}, MessageId:`,
            res.MessageId
          );
          return { success: true, messageId: res.MessageId };
        } else if (res.Response && res.Response.MessageId) {
          logger.info(
            `[Tencent Email] Email sent successfully (from Response) using endpoint ${endpointUrl}, MessageId:`,
            res.Response.MessageId
          );
          return { success: true, messageId: res.Response.MessageId };
        } else {
          logger.warn('[Tencent Email] No MessageId in response:', res);
          lastError = 'No MessageId returned from API';
          continue;
        }
      } catch (error: unknown) {
        const errObj = error as any;
        const errMsg =
          (error instanceof Error ? error.message : String(error)) || errObj?.code || 'SDK error';
        const errorCode = errObj?.code || 'UNKNOWN';
        const requestId = errObj?.requestId || 'N/A';

        logger.error(`[Tencent Email] ❌ Failed with region ${region || '(auto)'}:`);
        logger.error('  - Error Code:', errorCode);
        logger.error('  - Error Message:', errMsg);
        logger.error('  - Request ID:', requestId);

        lastError = errMsg;

        if (
          errorCode.includes('InvalidParameter') ||
          errMsg.includes('Region') ||
          errorCode.includes('AuthFailure') ||
          errMsg.includes('Invalid URL')
        ) {
          logger.debug(
            `[Tencent Email] Region/URL ${region || '(auto)'} not supported, trying next option...`
          );
          continue;
        } else {
          break;
        }
      }
    }

    logger.error('[Tencent Email] All attempts failed. Last error:', lastError);

    let userFriendlyError = lastError;

    if (lastError.includes('Region') || lastError.includes('Invalid URL')) {
      userFriendlyError = `邮件服务连接失败。已尝试多种配置方式均失败，请联系管理员检查腾讯云SES服务配置和网络连接。`;
    } else if (lastError.includes('UnauthorizedOperation') || lastError.includes('AuthFailure')) {
      userFriendlyError = '邮件服务认证失败：API密钥无效或已过期。';
    } else if (lastError.includes('LimitExceeded')) {
      userFriendlyError = '发送频率超限，请稍后重试。';
    } else {
      userFriendlyError = `验证码发送失败：${lastError}`;
    }

    return { success: false, error: userFriendlyError };
  }
}

export const tencentEmailService = new TencentEmailService();
