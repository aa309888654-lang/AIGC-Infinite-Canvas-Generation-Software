import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import sharp from 'sharp';

interface CaptchaCode {
  code: string;
  createdAt: number;
}

interface VisualCaptchaPoint {
  x: number;
  y: number;
  symbol: string;
}

interface VisualCaptchaChallenge {
  sequence: string[];
  points: VisualCaptchaPoint[];
  createdAt: number;
  ownerKey: string;
  attempts: number;
}

interface VisualCaptchaTicket {
  createdAt: number;
  ownerKey: string;
}
class CaptchaService {
  private static instance: CaptchaService;
  private captchas: Map<string, CaptchaCode> = new Map();
  private visualCaptchas: Map<string, VisualCaptchaChallenge> = new Map();
  private visualCaptchaTickets: Map<string, VisualCaptchaTicket> = new Map();
  private readonly VISUAL_TICKET_EXPIRY = 3 * 60 * 1000;
  private readonly VISUAL_MAX_ATTEMPTS = 3;
  private readonly CAPTCHA_EXPIRY = 2 * 60 * 1000;
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    if (process.env.NODE_ENV !== 'test') {
      this.startCleanup();
    }
  }

  public static getInstance(): CaptchaService {
    if (!CaptchaService.instance) {
      CaptchaService.instance = new CaptchaService();
    }
    return CaptchaService.instance;
  }

  private generateCaptchaId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateRandomCode(length: number = 4): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  public generateCaptchaSVG(code: string): string {
    const width = 120;
    const height = 40;

    const bgColor = '#f0f0f0';
    
    const lineColors = ['#a0a0a0', '#b0b0b0', '#c0c0c0', '#d0d0d0', '#909090'];
    
    const textColors = ['#2d3748', '#1a365d', '#234e52', '#285e61', '#1e429f', '#553c9a', '#702459', '#9b2c2c', '#7c2d12', '#744210'];

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;
    
    svg += `<rect width="${width}" height="${height}" fill="${bgColor}"/>`;

    for (let i = 0; i < 4; i++) {
      const x1 = Math.random() * width;
      const y1 = Math.random() * height;
      const x2 = Math.random() * width;
      const y2 = Math.random() * height;
      const color = lineColors[Math.floor(Math.random() * lineColors.length)];
      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.5"/>`;
    }

    for (let i = 0; i < 80; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const r = Math.random() * 1.5;
      svg += `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(${Math.floor(Math.random()*255)},${Math.floor(Math.random()*255)},${Math.floor(Math.random()*255)},0.5)"/>`;
    }

    const fontSize = height * 0.6;
    for (let i = 0; i < code.length; i++) {
      const char = code[i];
      const x = (width / code.length) * i + (width / code.length / 4);
      const y = height / 2 + (Math.random() - 0.5) * 8;
      const color = textColors[Math.floor(Math.random() * textColors.length)];
      const rotation = (Math.random() - 0.5) * 0.4;
      
      svg += `<text x="${x + fontSize / 4}" y="${y}" 
        font-family="Arial, sans-serif" 
        font-size="${fontSize}" 
        font-weight="bold" 
        fill="${color}"
        transform="rotate(${rotation * 180 / Math.PI}, ${x + fontSize / 4}, ${y})">${char}</text>`;
    }

    svg += '</svg>';
    return svg;
  }

  public createCaptcha(): { captchaId: string; svg: string } {
    const captchaId = this.generateCaptchaId();
    const code = this.generateRandomCode(4);
    const svg = this.generateCaptchaSVG(code);
    
    this.captchas.set(captchaId, {
      code,
      createdAt: Date.now()
    });

    return { captchaId, svg };
  }

  public verifyCaptcha(captchaId: string, inputCode: string): {
    success: boolean;
    error?: string;
  } {
    const captcha = this.captchas.get(captchaId);
    
    if (!captcha) {
      return { success: false, error: '验证码不存在或已过期' };
    }

    if (Date.now() - captcha.createdAt > this.CAPTCHA_EXPIRY) {
      this.captchas.delete(captchaId);
      return { success: false, error: '验证码已过期' };
    }

    if (inputCode.toLowerCase() !== captcha.code.toLowerCase()) {
      return { success: false, error: '验证码错误' };
    }

    this.captchas.delete(captchaId);
    return { success: true };
  }

  /**
   * Creates a server-owned visual challenge. The browser receives only pixels and
   * the requested sequence; hit areas and the answer remain on the server.
   */
  public async createVisualCaptcha(ownerKey: string): Promise<{ captchaId: string; image: string; sequence: string[] }> {
    const symbols = [...'23456789ABCDEFGHJKLMNPQRSTUVWXYZ'];
    const sequenceLength = 3 + crypto.randomInt(3);
    const sequence = this.shuffle([...symbols]).slice(0, sequenceLength);
    const distractorPool = symbols.filter((symbol) => !sequence.includes(symbol));
    const patternSymbols = [...sequence];
    while (patternSymbols.length < 12) patternSymbols.push(distractorPool[crypto.randomInt(distractorPool.length)]);

    const orderedSymbols = this.shuffle(patternSymbols);
    const cells = this.shuffle(Array.from({ length: 12 }, (_, index) => index));
    const points = orderedSymbols.map((symbol, index) => {
      const cell = cells[index];
      return {
        symbol,
        x: 130 + (cell % 4) * 250 + crypto.randomInt(81) - 40,
        y: 125 + Math.floor(cell / 4) * 195 + crypto.randomInt(81) - 40,
      };
    });

    const captchaId = this.generateCaptchaId();
    this.visualCaptchas.set(captchaId, { sequence, points, createdAt: Date.now(), ownerKey, attempts: 0 });
    const imageBuffer = await sharp(Buffer.from(this.generateVisualCaptchaSvg(points))).png({ compressionLevel: 9 }).toBuffer();
    return { captchaId, sequence, image: 'data:image/png;base64,' + imageBuffer.toString('base64') };
  }

  public verifyVisualCaptcha(
    captchaId: string,
    clicks: Array<{ x: number; y: number }>,
    ownerKey: string,
  ): { success: boolean; captchaTicket?: string; error?: string } {
    const challenge = this.visualCaptchas.get(captchaId);
    if (!challenge || challenge.ownerKey !== ownerKey) return { success: false, error: '验证码不存在或已失效，请刷新题目' };

    if (Date.now() - challenge.createdAt > this.CAPTCHA_EXPIRY) {
      this.visualCaptchas.delete(captchaId);
      return { success: false, error: '验证码已过期，请刷新题目' };
    }

    const isCorrect = clicks.length === challenge.sequence.length && clicks.every((click, index) => {
      const hit = challenge.points.find((point) => Math.hypot(point.x - click.x, point.y - click.y) <= 58);
      return hit?.symbol === challenge.sequence[index];
    });

    if (!isCorrect) {
      challenge.attempts += 1;
      if (challenge.attempts >= this.VISUAL_MAX_ATTEMPTS) {
        this.visualCaptchas.delete(captchaId);
        return { success: false, error: '尝试次数过多，请刷新题目' };
      }
      return { success: false, error: '字符或顺序不正确，请重新尝试' };
    }

    this.visualCaptchas.delete(captchaId);
    const captchaTicket = crypto.randomBytes(32).toString('base64url');
    this.visualCaptchaTickets.set(captchaTicket, { createdAt: Date.now(), ownerKey });
    return { success: true, captchaTicket };
  }

  /** Consumes a one-time proof before an expensive SMS is sent. */
  public consumeVisualCaptchaTicket(captchaTicket: string, ownerKey: string): boolean {
    const ticket = this.visualCaptchaTickets.get(captchaTicket);
    this.visualCaptchaTickets.delete(captchaTicket);
    return Boolean(ticket && ticket.ownerKey === ownerKey && Date.now() - ticket.createdAt <= this.VISUAL_TICKET_EXPIRY);
  }

  private generateVisualCaptchaSvg(points: VisualCaptchaPoint[]): string {
    const width = 1000;
    const height = 640;
    const backgroundHue = crypto.randomInt(360);
    const accentHue = (backgroundHue + 100 + crypto.randomInt(120)) % 360;
    const noise = Array.from({ length: 80 }, () => {
      const x = crypto.randomInt(width);
      const y = crypto.randomInt(height);
      const radius = 1 + crypto.randomInt(5);
      const hue = (backgroundHue + crypto.randomInt(120)) % 360;
      return `<circle cx="${x}" cy="${y}" r="${radius}" fill="hsl(${hue} 45% 78% / .34)"/>`;
    }).join('');
    const lines = Array.from({ length: 14 }, () => {
      const color = `hsl(${(accentHue + crypto.randomInt(80)) % 360} 55% 82% / .34)`;
      return `<path d="M ${crypto.randomInt(width)} ${crypto.randomInt(height)} Q ${crypto.randomInt(width)} ${crypto.randomInt(height)} ${crypto.randomInt(width)} ${crypto.randomInt(height)}" fill="none" stroke="${color}" stroke-width="${1 + crypto.randomInt(4)}"/>`;
    }).join('');
    const characters = points.map((point) => this.renderVisualCharacter(point)).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${backgroundHue} 52% 91%)"/><stop offset="1" stop-color="hsl(${accentHue} 58% 86%)"/></linearGradient><filter id="soft"><feGaussianBlur stdDeviation="2.2"/></filter></defs>
      <rect width="100%" height="100%" rx="28" fill="url(#bg)"/>
      <g filter="url(#soft)"><circle cx="145" cy="96" r="126" fill="hsl(${accentHue} 68% 77% / .30)"/><circle cx="854" cy="530" r="175" fill="hsl(${backgroundHue} 65% 79% / .28)"/></g>
      ${lines}${noise}<g>${characters}</g>
    </svg>`;
  }

  private renderVisualCharacter(point: VisualCaptchaPoint): string {
    const fill = ['#0f766e', '#1d4ed8', '#7c3aed', '#be185d', '#b45309', '#047857'][crypto.randomInt(6)];
    const rotation = crypto.randomInt(-14, 15);
    const fontSize = 78 + crypto.randomInt(13);
    return `<text x="${point.x}" y="${point.y}" text-anchor="middle" dominant-baseline="central"
      font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="800"
      fill="${fill}" stroke="#ffffff" stroke-width="5" paint-order="stroke fill"
      transform="rotate(${rotation} ${point.x} ${point.y})">${point.symbol}</text>`;
  }

  private shuffle<T>(items: T[]): T[] {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const swapIndex = crypto.randomInt(index + 1);
      [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }
    return items;
  }

  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [id, captcha] of this.captchas.entries()) {
      if (now - captcha.createdAt > this.CAPTCHA_EXPIRY) {
        this.captchas.delete(id);
        cleanedCount++;
      }
    }

    for (const [id, challenge] of this.visualCaptchas.entries()) {
      if (now - challenge.createdAt > this.CAPTCHA_EXPIRY) {
        this.visualCaptchas.delete(id);
        cleanedCount++;
      }
    }

    for (const [ticket, proof] of this.visualCaptchaTickets.entries()) {
      if (now - proof.createdAt > this.VISUAL_TICKET_EXPIRY) {
        this.visualCaptchaTickets.delete(ticket);
        cleanedCount++;
      }
    }
    if (cleanedCount > 0) {
      logger.info(`🧹 验证码清理: 删除了 ${cleanedCount} 条过期验证码`);
    }
  }

  private startCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);
  }

  public getStats(): { activeCaptchas: number } {
    return {
      activeCaptchas: this.captchas.size
    };
  }
}

export const captchaService = CaptchaService.getInstance();

interface RateLimitConfig {
  count: number;
  lastRequest: number;
  lockedUntil?: number;
}

class OneMinuteRateLimiter {
  private static instance: OneMinuteRateLimiter;
  private limits: Map<string, RateLimitConfig> = new Map();
  private readonly MAX_REQUESTS_PER_MINUTE = 5;
  private readonly LOCKOUT_DURATION = 30 * 1000; // 30秒限制

  private constructor() {}

  public static getInstance(): OneMinuteRateLimiter {
    if (!OneMinuteRateLimiter.instance) {
      OneMinuteRateLimiter.instance = new OneMinuteRateLimiter();
    }
    return OneMinuteRateLimiter.instance;
  }

  public checkRateLimit(identifier: string): { allowed: boolean; remaining: number; retryAfter?: number } {
    const now = Date.now();
    const limit = this.limits.get(identifier);

    if (!limit) {
      this.limits.set(identifier, {
        count: 1,
        lastRequest: now
      });
      return { allowed: true, remaining: this.MAX_REQUESTS_PER_MINUTE - 1 };
    }

    if (limit.lockedUntil && now < limit.lockedUntil) {
      const retryAfter = Math.ceil((limit.lockedUntil - now) / 1000);
      return { allowed: false, remaining: 0, retryAfter };
    }

    const isSamePeriod = (now - limit.lastRequest) < 30 * 1000; // 30秒时间窗口

    if (!isSamePeriod) {
      this.limits.set(identifier, {
        count: 1,
        lastRequest: now
      });
      return { allowed: true, remaining: this.MAX_REQUESTS_PER_MINUTE - 1 };
    }

    limit.count++;
    limit.lastRequest = now;

    if (limit.count > this.MAX_REQUESTS_PER_MINUTE) {
      limit.lockedUntil = now + this.LOCKOUT_DURATION;
      this.limits.set(identifier, limit);
      
      return { allowed: false, remaining: 0, retryAfter: 30 };
    }

    return { allowed: true, remaining: this.MAX_REQUESTS_PER_MINUTE - limit.count };
  }

  public resetLimit(identifier: string): void {
    this.limits.delete(identifier);
  }
}

