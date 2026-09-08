export enum DateFormat {
  ISO = 'YYYY-MM-DDTHH:mm:ss.SSSZ',
  ISO_SHORT = 'YYYY-MM-DDTHH:mm:ss',
  DATE = 'YYYY-MM-DD',
  TIME = 'HH:mm:ss',
  DATETIME = 'YYYY-MM-DD HH:mm:ss',
  TIMESTAMP = 'x',
  RELATIVE = 'relative',
}

export enum Locale {
  ZH_CN = 'zh-CN',
  EN_US = 'en-US',
}

export interface DateFormatOptions {
  format?: DateFormat;
  locale?: Locale;
  timezone?: string;
  includeTimezone?: boolean;
}

const ISO_FORMAT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?$/;

export function isValidDateString(dateStr: string): boolean {
  if (!ISO_FORMAT.test(dateStr)) {
    return false;
  }
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

export function formatDate(
  date: Date | string | number,
  options: DateFormatOptions = {}
): string {
  const {
    format = DateFormat.ISO,
    timezone = 'Asia/Shanghai',
    includeTimezone = true,
  } = options;

  let dateObj: Date;

  if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === 'string' || typeof date === 'number') {
    dateObj = new Date(date);
  } else {
    throw new Error('Invalid date input');
  }

  if (isNaN(dateObj.getTime())) {
    throw new Error('Invalid date');
  }

  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const seconds = String(dateObj.getSeconds()).padStart(2, '0');
  const milliseconds = String(dateObj.getMilliseconds()).padStart(3, '0');

  const offset = dateObj.getTimezoneOffset();
  const offsetSign = offset > 0 ? '-' : '+';
  const offsetHours = String(Math.abs(Math.floor(offset / 60))).padStart(2, '0');
  const offsetMinutes = String(Math.abs(offset % 60)).padStart(2, '0');
  const offsetStr = `${offsetSign}${offsetHours}:${offsetMinutes}`;

  switch (format) {
    case DateFormat.ISO:
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}${includeTimezone ? offsetStr : 'Z'}`;
    
    case DateFormat.ISO_SHORT:
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    
    case DateFormat.DATE:
      return `${year}-${month}-${day}`;
    
    case DateFormat.TIME:
      return `${hours}:${minutes}:${seconds}`;
    
    case DateFormat.DATETIME:
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    
    case DateFormat.TIMESTAMP:
      return String(dateObj.getTime());
    
    case DateFormat.RELATIVE:
      return formatRelativeTime(dateObj);
    
    default:
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}${includeTimezone ? offsetStr : 'Z'}`;
  }
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSeconds < 60) {
    return '刚刚';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}分钟前`;
  } else if (diffHours < 24) {
    return `${diffHours}小时前`;
  } else if (diffDays < 7) {
    return `${diffDays}天前`;
  } else if (diffWeeks < 4) {
    return `${diffWeeks}周前`;
  } else if (diffMonths < 12) {
    return `${diffMonths}个月前`;
  } else {
    return `${diffYears}年前`;
  }
}

export function parseDate(
  dateStr: string,
  timezone: string = 'Asia/Shanghai'
): Date {
  if (!isValidDateString(dateStr)) {
    throw new Error(`Invalid date string: ${dateStr}`);
  }
  return new Date(dateStr);
}

export function formatDateRange(
  startDate: Date | string | number,
  endDate: Date | string | number,
  format: DateFormat = DateFormat.DATETIME
): string {
  const start = formatDate(startDate, { format });
  const end = formatDate(endDate, { format });
  return `${start} - ${end}`;
}

export function getDateBoundary(
  period: 'today' | 'week' | 'month' | 'year'
): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    
    case 'week':
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    
    case 'month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
    
    case 'year':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
      break;
  }

  return { start, end };
}

export function formatISODate(date: Date | string | number): string {
  return formatDate(date, { format: DateFormat.ISO });
}

export function formatShortDate(date: Date | string | number): string {
  return formatDate(date, { format: DateFormat.DATE });
}

export function formatDateTime(date: Date | string | number): string {
  return formatDate(date, { format: DateFormat.DATETIME });
}

export function formatRelativeDate(date: Date | string | number): string {
  return formatDate(date, { format: DateFormat.RELATIVE });
}

export function getTimestamp(date?: Date | string | number): number {
  const dateObj = date ? new Date(date) : new Date();
  return dateObj.getTime();
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

export function addMinutes(date: Date, minutes: number): Date {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

export function isExpired(expirationDate: Date | string | number): boolean {
  const expDate = new Date(expirationDate);
  return expDate.getTime() < Date.now();
}

export function getDaysUntil(expirationDate: Date | string | number): number {
  const expDate = new Date(expirationDate);
  const now = new Date();
  const diffMs = expDate.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
