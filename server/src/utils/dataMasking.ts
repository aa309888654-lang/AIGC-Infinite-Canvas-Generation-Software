const SENSITIVE_FIELDS = [
  'password',
  'passwd',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'apikey',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'authorization',
  'auth',
  'credential',
  'privateKey',
  'private_key',
  'ssn',
  'socialSecurityNumber',
  'idCard',
  'id_card',
  'creditCard',
  'credit_card',
  'cardNumber',
  'card_number',
  'cvv',
  'cvc',
  'pin',
  'bankAccount',
  'bank_account',
];

const PHONE_REGEX = /(\d{3})\d{4}(\d{4})/g;
const ID_CARD_REGEX = /(\d{6})\d{8}(\d{4})/g;
const EMAIL_REGEX = /(\w)(\w+)@(\w+)\.(\w+)/g;
const CREDIT_CARD_REGEX = /(\d{4})\d{8,12}(\d{4})/g;
const IP_REGEX = /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g;

export interface MaskingOptions {
  maskChar?: string;
  preserveLength?: boolean;
  maxMaskLength?: number;
}

const DEFAULT_MASKING_OPTIONS: MaskingOptions = {
  maskChar: '*',
  preserveLength: true,
  maxMaskLength: 20,
};

export function maskSensitiveData(
  data: any,
  options: MaskingOptions = {}
): any {
  const opts = { ...DEFAULT_MASKING_OPTIONS, ...options };
  
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return maskString(data, opts);
  }

  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveData(item, opts));
  }

  if (typeof data === 'object') {
    const masked: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (isSensitiveField(key)) {
        masked[key] = maskValue(value, opts);
      } else if (typeof value === 'object' && value !== null) {
        masked[key] = maskSensitiveData(value, opts);
      } else {
        masked[key] = value;
      }
    }
    
    return masked;
  }

  return data;
}

function isSensitiveField(fieldName: string): boolean {
  const lowerFieldName = fieldName.toLowerCase();
  
  return SENSITIVE_FIELDS.some(sensitive => 
    lowerFieldName.includes(sensitive.toLowerCase())
  );
}

function maskValue(value: any, options: MaskingOptions): any {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return maskString(value, options);
  }

  if (typeof value === 'number') {
    return value;
  }

  if (Array.isArray(value)) {
    return '[Array]';
  }

  if (typeof value === 'object') {
    return '[Object]';
  }

  return value;
}

function maskString(str: string, options: MaskingOptions): string {
  if (!str || str.length === 0) {
    return str;
  }

  let masked = str;

  masked = masked.replace(PHONE_REGEX, (_, p1, p2) => 
    `${p1}****${p2}`
  );

  masked = masked.replace(ID_CARD_REGEX, (_, p1, p2) => 
    `${p1}********${p2}`
  );

  masked = masked.replace(CREDIT_CARD_REGEX, (_, p1, p2) => 
    `${p1}************${p2}`
  );

  masked = masked.replace(EMAIL_REGEX, (_, p1, p2, p3, p4) => 
    `${p1}***@${p3}.${p4}`
  );

  if (options.preserveLength && masked.length <= options.maxMaskLength!) {
    const maskCount = Math.min(Math.floor(masked.length / 2), options.maxMaskLength!);
    return masked.slice(0, maskCount) + options.maskChar!.repeat(maskCount);
  }

  return options.maskChar!.repeat(Math.min(str.length, options.maxMaskLength!));
}

export function maskRequestBody(body: any, options?: MaskingOptions): any {
  return maskSensitiveData(body, options);
}

export function maskRequestHeaders(headers: any, options?: MaskingOptions): any {
  const maskedHeaders: any = {};
  
  for (const [key, value] of Object.entries(headers)) {
    if (isSensitiveField(key)) {
      maskedHeaders[key] = '[REDACTED]';
    } else {
      maskedHeaders[key] = value;
    }
  }
  
  return maskedHeaders;
}

export function maskQueryParams(params: any, options?: MaskingOptions): any {
  return maskSensitiveData(params, options);
}

export function maskUserInfo(user: any): any {
  if (!user) return user;

  const masked = { ...user };

  if (masked.password) masked.password = '[REDACTED]';
  if (masked.email) masked.email = maskEmail(masked.email);
  if (masked.phone) masked.phone = maskPhone(masked.phone);
  if (masked.idCard) masked.idCard = maskIdCard(masked.idCard);

  return masked;
}

export function maskEmail(email: string): string {
  if (!email) return email;
  return email.replace(EMAIL_REGEX, (_, p1, p2, p3, p4) => 
    `${p1}***@${p3}.${p4}`
  );
}

export function maskPhone(phone: string): string {
  if (!phone) return phone;
  return phone.replace(PHONE_REGEX, (_, p1, p2) => `${p1}****${p2}`);
}

export function maskIdCard(idCard: string): string {
  if (!idCard) return idCard;
  return idCard.replace(ID_CARD_REGEX, (_, p1, p2) => `${p1}********${p2}`);
}

export function maskCreditCard(cardNumber: string): string {
  if (!cardNumber) return cardNumber;
  return cardNumber.replace(CREDIT_CARD_REGEX, (_, p1, p2) => 
    `${p1}************${p2}`
  );
}

export function createMaskingMiddleware() {
  return (req: any, res: any, next: any) => {
    if (req.body) {
      req.body = maskRequestBody(req.body);
    }
    
    if (req.query) {
      req.query = maskQueryParams(req.query);
    }
    
    next();
  };
}

export function addMaskingToResponse(originalJson: (body: any) => any) {
  return function(this: any, body: any) {
    const maskedBody = maskSensitiveData(body);
    return originalJson.call(this, maskedBody);
  };
}
