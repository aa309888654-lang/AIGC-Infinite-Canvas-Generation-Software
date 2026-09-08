import crypto from 'crypto';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { normalizePhone } from '../utils/encryption';
import DyPnsClient, {
  SendSmsVerifyCodeRequest,
  CheckSmsVerifyCodeRequest,
} from '@alicloud/dypnsapi20170525';
import DysmsClient, { SendSmsRequest } from '@alicloud/dysmsapi20170525';
import * as OpenApi from '@alicloud/openapi-client';
import * as Util from '@alicloud/tea-util';

interface SmsServiceConfig {
  provider: 'aliyun_dypns' | 'aliyun' | 'tencent' | 'mock';
  accessKeyId?: string;
  accessKeySecret?: string;
  signName?: string;
  templateCode?: string;
  schemeName?: string;
}

export type SmsVerificationPurpose = 'verification' | 'reset_password' | 'bind_phone' | 'login';

class SmsService {
  private config: SmsServiceConfig;
  private dypnsClient: DyPnsClient | null = null;
  private dysmsClient: DysmsClient | null = null;
  private readonly CODE_LENGTH = 6;
  private readonly CODE_EXPIRY_SECONDS = 300;
  private readonly RESEND_INTERVAL_SECONDS = 30;
  private readonly DAILY_LIMIT = 10;
  private readonly MAX_ATTEMPTS = 5;
  // DYPNS occasionally times out on the network path even though the code is
  // still valid. Retrying verification is safe: it does not send another SMS
  // and we only consume the local record after the provider returns PASS.
  private readonly VERIFY_RETRY_ATTEMPTS = 3;

  constructor() {
    this.config = {
      provider: (process.env.SMS_PROVIDER as any) || 'mock',
      accessKeyId: process.env.SMS_ACCESS_KEY_ID,
      accessKeySecret: process.env.SMS_ACCESS_KEY_SECRET,
      signName: process.env.SMS_SIGN_NAME || '',
      templateCode: process.env.SMS_TEMPLATE_CODE || '',
      schemeName: process.env.SMS_SCHEME_NAME || '',
    };

    // Initialize Dypns SDK client
    if (this.config.accessKeyId && this.config.accessKeySecret) {
      try {
        const config = new OpenApi.Config({
          accessKeyId: this.config.accessKeyId,
          accessKeySecret: this.config.accessKeySecret,
          endpoint: 'dypnsapi.aliyuncs.com',
        });
        this.dypnsClient = new DyPnsClient(config);
        // Also init Dysms client for standard SMS fallback
        const dysmsConfig = new OpenApi.Config({
          accessKeyId: this.config.accessKeyId,
          accessKeySecret: this.config.accessKeySecret,
          endpoint: 'dysmsapi.aliyuncs.com',
        });
        this.dysmsClient = new DysmsClient(dysmsConfig);
        logger.info('[SMS] Dypns + Dysms SDK clients initialized');
      } catch (error) {
        logger.error('[SMS] Dypns SDK client init failed:', error);
      }
    }
  }

  public validatePhone(phone: string, countryCode: string = '86'): boolean {
    const cleanPhone = phone.replace(/\D/g, '');
    if (countryCode === '86') {
      return /^1[3-9]\d{9}$/.test(cleanPhone);
    }
    return cleanPhone.length >= 10 && cleanPhone.length <= 15;
  }

  public async checkRateLimit(phone: string): Promise<{
    canSend: boolean;
    remainingSeconds: number;
    todayCount: number;
  }> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const todayCount = await prisma.smsVerification.count({
      where: {
        phone,
        status: { in: ['sent', 'pending', 'verified'] },
        createdAt: { gte: startOfDay, lt: endOfDay },
      },
    });

    if (todayCount >= this.DAILY_LIMIT) {
      return { canSend: false, remainingSeconds: 0, todayCount };
    }

    const lastSent = await prisma.smsVerification.findFirst({
      where: { phone, status: { in: ['sent', 'pending', 'verified'] }, createdAt: { lte: now } },
      orderBy: { createdAt: 'desc' },
    });

    if (lastSent) {
      const elapsed = Math.floor((now.getTime() - new Date(lastSent.createdAt).getTime()) / 1000);
      const remaining = Math.max(0, this.RESEND_INTERVAL_SECONDS - elapsed);
      if (remaining > 0) {
        return { canSend: false, remainingSeconds: remaining, todayCount };
      }
    }

    return { canSend: true, remainingSeconds: 0, todayCount };
  }

  public async sendVerificationCode(
    phone: string,
    type: 'verification' | 'reset_password' | 'bind_phone' | 'login' = 'verification',
    ipAddress?: string,
    countryCode: string = '86'
  ): Promise<{
    success: boolean;
    expiresAt?: Date;
    error?: string;
  }> {
    if (!this.validatePhone(phone, countryCode)) {
      return { success: false, error: '手机号格式不正确' };
    }

    // 统一在服务层 normalize 手机号，保证 send / verify / DB 存储一致
    const normalizedPhone = normalizePhone(phone, countryCode);

    const rateLimit = await this.checkRateLimit(normalizedPhone);
    if (!rateLimit.canSend) {
      if (rateLimit.todayCount >= this.DAILY_LIMIT) {
        return { success: false, error: `今日发送次数已达上限(${this.DAILY_LIMIT}次)，请明天再试` };
      }
      return { success: false, error: `请等待${rateLimit.remainingSeconds}秒后再发送` };
    }

    await this.invalidatePreviousCodes(normalizedPhone);

    const expiresAt = new Date(Date.now() + this.CODE_EXPIRY_SECONDS * 1000);

    try {
      // Aliyun DYPNS API 需要原始手机号（不含 +86 前缀），DB 使用 normalizedPhone
      const sendResult = await this.sendSms(phone, countryCode, type);

      await prisma.smsVerification.create({
        data: {
          phone: normalizedPhone,
          countryCode,
          code: sendResult.code || '',
          type,
          status: sendResult.success ? 'sent' : 'failed',
          expiresAt,
          ipAddress: ipAddress || null,
        },
      });

      if (sendResult.success) {
        logger.info(`[SMS] 验证码发送成功: ${phone}`);
        return { success: true, expiresAt };
      } else {
        return { success: false, error: sendResult.error || '短信发送失败' };
      }
    } catch (error: unknown) {
      logger.error(`[SMS] 发送异常: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, error: '短信发送失败，请稍后重试' };
    }
  }

  public async verifyCode(
    phone: string,
    code: string,
    purpose: SmsVerificationPurpose,
    countryCode: string = '86'
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    const normalizedPhone = normalizePhone(phone, countryCode);

    // Aliyun DYPNS API 使用原始手机号（不含 +86 前缀）
    if (this.config.provider === 'aliyun_dypns') {
      const pending = await prisma.smsVerification.findFirst({
        where: {
          phone: normalizedPhone,
          type: purpose,
          status: { in: ['sent', 'verified'] },
          expiresAt: { gt: new Date() },
          attempts: { lt: this.MAX_ATTEMPTS },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!pending) return { success: false, error: '验证码错误或已过期' };
      return await this.verifyCodeViaDypns(phone, code, purpose, countryCode);
    }

    // 本地 DB 校验使用 normalizedPhone，保证与 send 时的存储一致
    return await this.verifyCodeLocal(normalizedPhone, code, purpose);
  }

  public async consumeCode(
    phone: string,
    code: string,
    purpose: SmsVerificationPurpose,
    countryCode: string = '86'
  ): Promise<{ success: boolean; error?: string }> {
    const normalizedPhone = normalizePhone(phone, countryCode);
    const now = new Date();
    const isDypns = this.config.provider === 'aliyun_dypns';

    if (isDypns) {
      const pending = await prisma.smsVerification.findFirst({
        where: {
          phone: normalizedPhone,
          type: purpose,
          status: { in: ['sent', 'verified'] },
          expiresAt: { gt: now },
          attempts: { lt: this.MAX_ATTEMPTS },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!pending) return { success: false, error: '验证码错误或已过期' };
      const dypnsResult = await this.verifyCodeViaDypns(phone, code, purpose, countryCode);
      if (!dypnsResult.success) return dypnsResult;
    }

    const where: any = {
      phone: normalizedPhone,
      type: purpose,
      status: { in: ['sent', 'verified'] },
      expiresAt: { gt: now },
      attempts: { lt: this.MAX_ATTEMPTS },
    };
    if (!isDypns) {
      where.code = code;
    }

    const consumed = await prisma.smsVerification.updateMany({
      where,
      data: { status: 'consumed', verifiedAt: now },
    });

    if (consumed.count > 0) return { success: true };
    return this.recordFailedAttempt(normalizedPhone, purpose);
  }

  private async verifyCodeViaDypns(
    phone: string,
    code: string,
    purpose: SmsVerificationPurpose,
    countryCode: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      if (this.dypnsClient) {
        const request = new CheckSmsVerifyCodeRequest({
          phoneNumber: phone,
          countryCode,
          verifyCode: code,
          schemeName: this.config.schemeName || undefined,
        });
        const result = await this.retryVerificationRequest(
          () => this.dypnsClient!.checkSmsVerifyCodeWithOptions(
            request,
            new Util.RuntimeOptions({ connectTimeout: 5000, readTimeout: 8000 }),
          ),
          phone,
        );

        if (result.body?.success && result.body?.model?.verifyResult === 'PASS') {
          const consumed = await this.markCodeVerified(phone, code, purpose, countryCode);
          if (consumed) {
            logger.info(`[SMS SDK] 验证码校验通过: ${phone}`);
            return { success: true };
          }
          return { success: false, error: '验证码已使用或已过期' };
        }

        await this.recordFailedAttempt(normalizePhone(phone, countryCode), purpose);
        logger.warn(`[SMS SDK] 验证码校验失败: ${phone}, result=${JSON.stringify(result.body)}`);
        return { success: false, error: '验证码错误或已过期' };
      }

      // Fallback to manual API
      const result = await this.retryVerificationRequest(
        () => this.callDypnsApi('CheckSmsVerifyCode', {
          PhoneNumber: phone,
          CountryCode: countryCode,
          VerifyCode: code,
          SchemeName: this.config.schemeName || undefined,
        }),
        phone,
      );

      if (result.Success && result.Model?.VerifyResult === 'PASS') {
        const consumed = await this.markCodeVerified(phone, code, purpose, countryCode);
        if (consumed) {
          logger.info(`[SMS] 验证码校验通过: ${phone}`);
          return { success: true };
        }
        return { success: false, error: '验证码已使用或已过期' };
      }

      await this.recordFailedAttempt(normalizePhone(phone, countryCode), purpose);
      logger.warn(`[SMS] 验证码校验失败: ${phone}, result=${JSON.stringify(result)}`);
      return { success: false, error: '验证码错误或已过期' };
    } catch (error: unknown) {
      logger.error(
        `[SMS] 验证码校验异常: ${error instanceof Error ? error.message : String(error)}`
      );
      // Do not increment attempts or consume the code when the provider could
      // not be reached. The user can retry the same code until it expires.
      return { success: false, error: '验证码服务暂时不可用，请稍后重试' };
    }
  }

  private async retryVerificationRequest<T>(request: () => Promise<T>, phone: string): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.VERIFY_RETRY_ATTEMPTS; attempt += 1) {
      try {
        return await request();
      } catch (error) {
        lastError = error;
        if (attempt === this.VERIFY_RETRY_ATTEMPTS) break;
        const delayMs = attempt * 300;
        logger.warn(`[SMS] 验证码校验网络异常，${delayMs}ms 后重试 (${attempt}/${this.VERIFY_RETRY_ATTEMPTS}): ${phone}`);
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw lastError;
  }

  private async verifyCodeLocal(
    phone: string,
    code: string,
    purpose: SmsVerificationPurpose
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    const verification = await prisma.smsVerification.findFirst({
      where: {
        phone,
        code,
        type: purpose,
        status: { in: ['sent', 'verified'] },
        expiresAt: { gt: new Date() },
        attempts: { lt: this.MAX_ATTEMPTS },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      return this.recordFailedAttempt(phone, purpose);
    }

    if (verification.status === 'sent') {
      await prisma.smsVerification.updateMany({
        where: { id: verification.id, type: purpose, status: 'sent' },
        data: { status: 'verified', verifiedAt: new Date() },
      });
    }

    return { success: true };
  }

  private async markCodeVerified(
    phone: string,
    code: string,
    purpose: SmsVerificationPurpose,
    countryCode: string = '86'
  ): Promise<boolean> {
    const normalizedPhone = normalizePhone(phone, countryCode);
    const isDypns = this.config.provider === 'aliyun_dypns';
    const where: any = { phone: normalizedPhone, type: purpose, status: { in: ['sent', 'verified'] } };
    if (!isDypns) {
      where.code = code;
    }
    const existing = await prisma.smsVerification.findFirst({ where });
    if (!existing) return false;
    if (existing.status === 'sent') {
      await prisma.smsVerification.updateMany({
        where: { id: existing.id, status: 'sent' },
        data: { status: 'verified', verifiedAt: new Date() },
      });
    }
    return true;
  }

  private async recordFailedAttempt(
    phone: string,
    purpose: SmsVerificationPurpose
  ): Promise<{ success: false; error: string }> {
    const pending = await prisma.smsVerification.findFirst({
      where: {
        phone,
        type: purpose,
        status: 'sent',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!pending) return { success: false, error: '验证码错误或已过期' };

    const attempts = pending.attempts + 1;
    await prisma.smsVerification.update({
      where: { id: pending.id },
      data: {
        attempts,
        ...(attempts >= this.MAX_ATTEMPTS ? { status: 'expired' } : {}),
      },
    });

    return {
      success: false,
      error:
        attempts >= this.MAX_ATTEMPTS ? '验证码错误次数过多，请重新获取' : '验证码错误或已过期',
    };
  }

  private async invalidatePreviousCodes(phone: string): Promise<void> {
    await prisma.smsVerification.updateMany({
      where: { phone, status: { in: ['pending', 'sent', 'verified'] } },
      data: { status: 'expired' },
    });
  }

  private async sendSms(
    phone: string,
    countryCode: string,
    type: string
  ): Promise<{ success: boolean; code?: string; error?: string }> {
    switch (this.config.provider) {
      case 'aliyun_dypns':
        return await this.sendDypnsSms(phone, countryCode);
      case 'aliyun':
        return await this.sendLegacyAliyunSms(phone);
      case 'tencent':
        return await this.sendTencentSms(phone);
      case 'mock':
      default: {
        if (process.env.NODE_ENV === 'production') {
          logger.error('[SMS] Production is configured with mock SMS provider; refusing to send');
          return { success: false, error: '短信服务未配置，暂不可用' };
        }
        const mockCode = String(crypto.randomInt(100000, 999999));
        logger.info(`[SMS Mock] Sending to ${phone}: Code is ${mockCode}`);
        return { success: true, code: mockCode };
      }
    }
  }

  private async sendDypnsSms(
    phone: string,
    countryCode: string
  ): Promise<{
    success: boolean;
    code?: string;
    error?: string;
  }> {
    try {
      if (!this.config.signName) {
        logger.warn('[SMS Dypns] SignName未配置，请在阿里云号码认证控制台获取赠送签名');
        return { success: false, error: '短信签名未配置，请在阿里云号码认证控制台配置赠送签名' };
      }

      if (!this.dypnsClient) {
        logger.warn('[SMS Dypns] SDK客户端未初始化，尝试手动签名');
        return await this.sendDypnsSmsManual(phone, countryCode);
      }

      // Use official SDK
      const request = new SendSmsVerifyCodeRequest({
        phoneNumber: phone,
        countryCode,
        signName: this.config.signName,
        templateCode: this.config.templateCode || undefined,
        templateParam: JSON.stringify({ code: '##code##', min: '5' }),
        codeLength: this.CODE_LENGTH,
        validTime: this.CODE_EXPIRY_SECONDS,
        interval: this.RESEND_INTERVAL_SECONDS,
        schemeName: this.config.schemeName || undefined,
      });

      const runtime = new Util.RuntimeOptions({});
      const result = await this.dypnsClient.sendSmsVerifyCodeWithOptions(request, runtime);

      logger.debug(
        `[SMS Dypns SDK] Response: code=${result.body?.code}, message=${result.body?.message}, success=${result.body?.success}`
      );

      if (result.body?.success && result.body?.code === 'OK') {
        const returnedCode = result.body?.model?.verifyCode;
        logger.info(`[SMS Dypns SDK] 发送成功: ${phone}, requestId=${result.body?.requestId}`);
        return { success: true, code: returnedCode };
      }

      const errorCode = result.body?.code || 'UNKNOWN';
      const errorMsg = result.body?.message || 'Unknown error';
      const dypnsError = this.translateDypnsError(errorCode, errorMsg);
      logger.warn(`[SMS Dypns SDK] 发送失败: ${phone}, code=${errorCode}, msg=${errorMsg}`);
      return { success: false, error: dypnsError };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`[SMS Dypns SDK] 发送异常: ${msg}`);
      // Fallback to manual signing
      return await this.sendDypnsSmsManual(phone, countryCode);
    }
  }

  private async sendDypnsSmsManual(
    phone: string,
    countryCode: string
  ): Promise<{
    success: boolean;
    code?: string;
    error?: string;
  }> {
    try {
      const params: Record<string, string | number | boolean | undefined> = {
        PhoneNumber: phone,
        CountryCode: countryCode,
        SignName: this.config.signName || undefined,
        TemplateCode: this.config.templateCode || undefined,
        TemplateParam: JSON.stringify({ code: '##code##', min: '5' }),
        CodeLength: this.CODE_LENGTH,
        ValidTime: this.CODE_EXPIRY_SECONDS,
        Interval: this.RESEND_INTERVAL_SECONDS,
        SchemeName: this.config.schemeName || undefined,
      };

      const result = await this.callDypnsApi('SendSmsVerifyCode', params);

      logger.debug(`[SMS Dypns Manual] Full API response: ${JSON.stringify(result)}`);

      if (result.Success && result.Code === 'OK') {
        const returnedCode = result.Model?.VerifyCode;
        logger.info(`[SMS Dypns Manual] 发送成功: ${phone}, requestId=${result.RequestId}`);
        return { success: true, code: returnedCode };
      }

      const dypnsError = this.translateDypnsError(result.Code, result.Message);
      logger.warn(
        `[SMS Dypns Manual] 发送失败: ${phone}, code=${result.Code}, msg=${result.Message}`
      );
      return { success: false, error: dypnsError };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`[SMS Dypns Manual] 发送异常: ${msg}`);
      return { success: false, error: '短信发送失败，请稍后重试' };
    }
  }

  private async callDypnsApi(action: string, bizParams: Record<string, unknown>): Promise<any> {
    const accessKeyId = this.config.accessKeyId;
    const accessKeySecret = this.config.accessKeySecret;

    if (!accessKeyId || !accessKeySecret) {
      throw new Error('阿里云短信 AccessKey 未配置');
    }

    const commonParams: Record<string, string> = {
      AccessKeyId: accessKeyId,
      Action: action,
      Format: 'JSON',
      Version: '2017-05-25',
      RegionId: 'cn-hangzhou',
      SignatureMethod: 'HMAC-SHA1',
      Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      SignatureVersion: '1.0',
      SignatureNonce: crypto.randomUUID(),
    };

    for (const [key, value] of Object.entries(bizParams)) {
      if (value !== undefined && value !== null && value !== '') {
        commonParams[key] = String(value);
      }
    }

    const sortedKeys = Object.keys(commonParams).sort();
    const canonicalQuery = sortedKeys
      .map((k) => `${this.percentEncode(k)}=${this.percentEncode(commonParams[k])}`)
      .join('&');

    const stringToSign = 'GET&%2F&' + this.percentEncode(canonicalQuery);
    const signature = crypto
      .createHmac('sha1', accessKeySecret + '&')
      .update(stringToSign)
      .digest('base64');

    const finalParams = { ...commonParams, Signature: signature };
    const queryString = Object.entries(finalParams)
      .map(([k, v]) => `${this.percentEncode(k)}=${this.percentEncode(v as string)}`)
      .join('&');

    const url = `https://dypnsapi.aliyuncs.com/?${queryString}`;

    logger.debug(`[SMS Dypns] Request URL: ${url.substring(0, 200)}...`);
    logger.debug(`[SMS Dypns] Params keys: ${Object.keys(commonParams).join(', ')}`);

    const response = await fetch(url, { method: 'GET' });
    const data = await response.json();

    return data;
  }

  private percentEncode(str: string): string {
    return encodeURIComponent(str)
      .replace(/\+/g, '%20')
      .replace(/\*/g, '%2A')
      .replace(/%7E/g, '~')
      .replace(/'/g, '%27')
      .replace(/!/g, '%21')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29');
  }

  private translateDypnsError(code: string, message: string): string {
    const errorMap: Record<string, string> = {
      MOBILE_NUMBER_ILLEGAL: '手机号格式不正确',
      BUSINESS_LIMIT_CONTROL: '短信发送频率超限，请稍后再试',
      FREQUENCY_FAIL: '发送过于频繁，请稍后再试',
      INVALID_PARAMETERS: '请求参数错误',
      FUNCTION_NOT_OPENED: '短信服务未开通，请联系管理员',
      SIGNATURE_INVALID: '短信签名无效',
      TEMPLATE_INVALID: '短信模板无效',
      ACCOUNT_NOT_EXISTS: '短信账户不存在',
      ACCOUNT_ABNORMAL: '短信账户异常',
      MissingSignName: '短信签名未配置，请在阿里云号码认证控制台配置赠送签名',
      MissingTemplateCode: '短信模板未配置，请在阿里云号码认证控制台配置赠送模板',
      'isv.SMS_SIGNATURE_ILLEGAL': '短信签名不合法',
      'isv.SMS_TEMPLATE_ILLEGAL': '短信模板不合法',
      SIGN_NAME_ILLEGAL: '短信签名不合法',
      'biz.FREQUENCY': '发送过于频繁，请稍后再试',
    };
    return errorMap[code] || message || `短信发送失败(${code})`;
  }

  private async sendLegacyAliyunSms(phone: string): Promise<{
    success: boolean;
    code?: string;
    error?: string;
  }> {
    try {
      const code = String(crypto.randomInt(100000, 999999));

      if (!this.config.accessKeyId || !this.config.accessKeySecret) {
        return { success: false, error: '阿里云短信 AccessKey 未配置' };
      }

      // Use Dysms SDK if available
      if (this.dysmsClient) {
        const request = new SendSmsRequest({
          phoneNumbers: phone,
          signName: this.config.signName || undefined,
          templateCode: this.config.templateCode || undefined,
          templateParam: JSON.stringify({ code }),
        });
        const runtime = new Util.RuntimeOptions({});
        const result = await this.dysmsClient.sendSmsWithOptions(request, runtime);

        if (result.body?.code === 'OK') {
          logger.info(`[SMS Dysms SDK] 发送成功: ${phone}`);
          return { success: true, code };
        }

        const errMsg = this.translateDypnsError(
          result.body?.code || '',
          result.body?.message || ''
        );
        logger.warn(
          `[SMS Dysms SDK] 发送失败: ${phone}, code=${result.body?.code}, msg=${result.body?.message}`
        );
        return { success: false, error: errMsg };
      }

      // Fallback to manual API call
      const accessKeyId = this.config.accessKeyId;
      const accessKeySecret = this.config.accessKeySecret;

      const commonParams: Record<string, string> = {
        AccessKeyId: accessKeyId!,
        Action: 'SendSms',
        Format: 'JSON',
        Version: '2017-05-25',
        RegionId: 'cn-hangzhou',
        SignatureMethod: 'HMAC-SHA1',
        Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        SignatureVersion: '1.0',
        SignatureNonce: crypto.randomUUID(),
        PhoneNumbers: phone,
        SignName: this.config.signName || '',
        TemplateCode: this.config.templateCode || '',
        TemplateParam: JSON.stringify({ code }),
      };

      // Remove empty values
      for (const key of Object.keys(commonParams)) {
        if (!commonParams[key]) delete commonParams[key];
      }

      const sortedKeys = Object.keys(commonParams).sort();
      const canonicalQuery = sortedKeys
        .map((k) => `${this.percentEncode(k)}=${this.percentEncode(commonParams[k])}`)
        .join('&');

      const stringToSign = 'GET&%2F&' + this.percentEncode(canonicalQuery);
      const signature = crypto
        .createHmac('sha1', accessKeySecret + '&')
        .update(stringToSign)
        .digest('base64');

      const finalParams = { ...commonParams, Signature: signature };
      const queryString = Object.entries(finalParams)
        .map(([k, v]) => `${this.percentEncode(k)}=${this.percentEncode(v as string)}`)
        .join('&');

      const url = `https://dysmsapi.aliyuncs.com/?${queryString}`;

      const response = await fetch(url, { method: 'GET' });
      const data = (await response.json()) as { Code?: string; Message?: string };

      if (data.Code === 'OK') {
        return { success: true, code };
      }

      const errMsg = this.translateDypnsError(data.Code, data.Message);
      logger.warn(`[SMS Aliyun] 发送失败: ${phone}, code=${data.Code}, msg=${data.Message}`);
      return { success: false, error: errMsg };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async sendTencentSms(phone: string): Promise<{
    success: boolean;
    code?: string;
    error?: string;
  }> {
    try {
      const code = String(crypto.randomInt(100000, 999999));
      const axios = (await import('axios')).default;

      const response = await axios.post(
        'https://sms.tencentcloudapi.com/',
        {
          PhoneNumberSet: [phone],
          SmsSdkAppId: this.config.accessKeyId,
          TemplateId: this.config.templateCode,
          TemplateParamSet: [code],
          Sign: this.config.signName,
        },
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (response.data.Response?.SendStatusSet?.[0]?.Code === 'Ok') {
        return { success: true, code };
      }
      return {
        success: false,
        error: response.data.Response?.SendStatusSet?.[0]?.Message || '发送失败',
      };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  public getConfig(): SmsServiceConfig {
    return { ...this.config };
  }
}

export const smsService = new SmsService();
