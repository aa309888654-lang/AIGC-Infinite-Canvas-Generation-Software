/**
 * 邮箱域名校验
 * 仅允许 QQ 号邮箱（纯数字@qq.com）和 @gmail.com 邮箱
 * 不支持 @foxmail.com、@vip.qq.com、QQ 英文邮箱（非纯数字本地部分）及其他域名
 */

const QQ_NUMBER_EMAIL_REGEX = /^\d+@qq\.com$/i;
const GMAIL_EMAIL_REGEX = /^[^@]+@gmail\.com$/i;

export const ALLOWED_EMAIL_DOMAINS_DESCRIPTION =
  '仅支持 QQ 号邮箱（如 12345678@qq.com）或 @gmail.com 邮箱，不支持 foxmail、vip.qq.com、QQ 英文邮箱及其他邮箱';

export function isAllowedEmailDomain(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  return QQ_NUMBER_EMAIL_REGEX.test(trimmed) || GMAIL_EMAIL_REGEX.test(trimmed);
}

export function getAllowedEmailError(email: string): string | null {
  if (!email || typeof email !== 'string' || !email.trim()) {
    return '请输入邮箱地址';
  }
  if (!isAllowedEmailDomain(email)) {
    return ALLOWED_EMAIL_DOMAINS_DESCRIPTION;
  }
  return null;
}
