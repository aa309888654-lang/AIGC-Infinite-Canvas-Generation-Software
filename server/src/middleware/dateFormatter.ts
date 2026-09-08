import { Response, NextFunction } from 'express';
import { formatDate, DateFormat } from '../utils/dateFormatter';

export interface DateFormattedRequest {
  formatDate: (date: Date | string | number) => string;
}

export function dateFormatterMiddleware(
  req: any,
  res: Response,
  next: NextFunction
) {
  req.formatDate = (date: Date | string | number) => {
    return formatDate(date, { format: DateFormat.ISO });
  };

  req.formatShortDate = (date: Date | string | number) => {
    return formatDate(date, { format: DateFormat.DATE });
  };

  req.formatDateTime = (date: Date | string | number) => {
    return formatDate(date, { format: DateFormat.DATETIME });
  };

  next();
}

export function formatResponseDates(
  data: any,
  format: DateFormat = DateFormat.ISO
): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => formatResponseDates(item, format));
  }

  if (typeof data === 'object') {
    const result: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (value instanceof Date) {
        result[key] = formatDate(value, { format });
      } else if (typeof value === 'string' && isDateString(value)) {
        try {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            result[key] = formatDate(date, { format });
          } else {
            result[key] = value;
          }
        } catch {
          result[key] = value;
        }
      } else if (typeof value === 'object' && value !== null) {
        result[key] = formatResponseDates(value, format);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  return data;
}

function isDateString(value: string): boolean {
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/;
  return isoDateRegex.test(value);
}

export function responseDateFormatter(
  req: any,
  res: Response,
  next: NextFunction
) {
  const originalJson = res.json.bind(res);

  res.json = function(body: any) {
    if (body && typeof body === 'object') {
      const formattedBody = formatResponseDates(body);
      return originalJson(formattedBody);
    }
    return originalJson(body);
  };

  next();
}
