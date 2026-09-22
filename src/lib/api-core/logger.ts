export class ApiLogger {
  private static logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';

  static setLogLevel(level: 'debug' | 'info' | 'warn' | 'error') {
    this.logLevel = level;
  }

  static generateCurl(url: string, method: string, headers: Record<string, string>, body?: unknown): string {
    let curl = `curl -X ${method} '${url}' \\\n`;

    for (const [key, value] of Object.entries(headers)) {
      const safeValue = key.toLowerCase().includes('authorization') || key.toLowerCase().includes('key')
        ? `${value.substring(0, 8)}...${value.substring(value.length - 4)}`
        : value;
      curl += `  -H '${key}: ${safeValue}' \\\n`;
    }

    if (body) {
      curl += `  -d '${JSON.stringify(body)}'`;
    }

    return curl;
  }

  static logRequest(url: string, method: string, headers: Record<string, string>, body?: unknown): void {
    const _curl = this.generateCurl(url, method, headers, body);
    // console.log(`[API Request] \n${curl}`);
  }

  static logResponse(_taskId: string, _status: number, _costMs: number, _data?: unknown): void {
    // console.log(`[API Response] TaskId: ${taskId} | Status: ${status} | Cost: ${costMs}ms\n`, data);
  }

  static debug(_message: string, ..._args: unknown[]): void {
    if (this.shouldLog('debug')) {
      // console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  static info(_message: string, ..._args: unknown[]): void {
    if (this.shouldLog('info')) {
      // console.info(`[INFO] ${message}`, ...args);
    }
  }

  static warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  static error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }

  private static shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels: Record<string, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    return levels[level] >= levels[this.logLevel];
  }
}
