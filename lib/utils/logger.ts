/**
 * Secure Logger Utility
 * Environment-aware logging with sensitive data sanitization
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
  enableInProduction?: boolean;
  sanitizeData?: boolean;
  logLevel?: LogLevel;
}

class SecureLogger {
  private isDevelopment: boolean;
  private isProduction: boolean;
  private enableInProduction: boolean;
  private sanitizeData: boolean;
  private logLevel: LogLevel;
  private sensitiveKeys: Set<string>;

  constructor(options: LoggerOptions = {}) {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isProduction = process.env.NODE_ENV === 'production';
    this.enableInProduction = options.enableInProduction ?? false;
    this.sanitizeData = options.sanitizeData ?? true;
    this.logLevel = options.logLevel ?? (this.isDevelopment ? 'debug' : 'error');
    
    // List of sensitive keys to redact
    this.sensitiveKeys = new Set([
      'password',
      'token',
      'secret',
      'apiKey',
      'api_key',
      'authorization',
      'cookie',
      'session',
      'creditCard',
      'credit_card',
      'ssn',
      'email',
      'phone',
      'user_metadata',
      'raw_user_meta_data',
    ]);
  }

  /**
   * Sanitize sensitive data from objects
   */
  private sanitize(data: any): any {
    if (!this.sanitizeData || !data) return data;
    
    if (typeof data !== 'object') return data;
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitize(item));
    }
    
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      
      // Check if key contains sensitive information
      const isSensitive = Array.from(this.sensitiveKeys).some(
        sensitiveKey => lowerKey.includes(sensitiveKey.toLowerCase())
      );
      
      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * Check if logging is enabled for the current level
   */
  private shouldLog(level: LogLevel): boolean {
    if (this.isProduction && !this.enableInProduction) {
      return level === 'error'; // Only log errors in production by default
    }
    
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const requestedLevelIndex = levels.indexOf(level);
    
    return requestedLevelIndex >= currentLevelIndex;
  }

  /**
   * Format the log message with timestamp and level
   */
  private format(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    if (data) {
      const sanitizedData = this.sanitize(data);
      return `${prefix} ${message} ${JSON.stringify(sanitizedData, null, 2)}`;
    }
    
    return `${prefix} ${message}`;
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog('debug')) {
      console.log(this.format('debug', message, data));
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog('info')) {
      console.info(this.format('info', message, data));
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog('warn')) {
      console.warn(this.format('warn', message, data));
    }
  }

  error(message: string, error?: any): void {
    if (this.shouldLog('error')) {
      const errorData = error instanceof Error ? {
        message: error.message,
        stack: this.isDevelopment ? error.stack : undefined,
        name: error.name,
      } : error;
      
      console.error(this.format('error', message, errorData));
    }
  }

  /**
   * Create a child logger with specific context
   */
  child(context: string, options?: LoggerOptions): SecureLogger {
    const childLogger = new SecureLogger({
      ...options,
      enableInProduction: options?.enableInProduction ?? this.enableInProduction,
      sanitizeData: options?.sanitizeData ?? this.sanitizeData,
      logLevel: options?.logLevel ?? this.logLevel,
    });
    
    // Override methods to include context
    const originalDebug = childLogger.debug.bind(childLogger);
    const originalInfo = childLogger.info.bind(childLogger);
    const originalWarn = childLogger.warn.bind(childLogger);
    const originalError = childLogger.error.bind(childLogger);
    
    childLogger.debug = (msg: string, data?: any) => originalDebug(`[${context}] ${msg}`, data);
    childLogger.info = (msg: string, data?: any) => originalInfo(`[${context}] ${msg}`, data);
    childLogger.warn = (msg: string, data?: any) => originalWarn(`[${context}] ${msg}`, data);
    childLogger.error = (msg: string, data?: any) => originalError(`[${context}] ${msg}`, data);
    
    return childLogger;
  }
}

// Export singleton instance for general use
export const logger = new SecureLogger();

// Export class for custom instances
export { SecureLogger };

// Export type
export type { LogLevel, LoggerOptions };