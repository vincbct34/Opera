/**
 * Centralized logging utility
 * Prevents sensitive data from being logged in production
 */

/* eslint-disable no-console */

class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  /**
   * Log general information (only in development).
   * @param args - Arguments to log.
   */
  log(...args: unknown[]): void {
    if (this.isDevelopment) {
      console.log(...args);
    }
  }

  /**
   * Log informational messages (only in development).
   * @param args - Arguments to log.
   */
  info(...args: unknown[]): void {
    if (this.isDevelopment) {
      console.info(...args);
    }
  }

  /**
   * Log warnings (always logged).
   * @param args - Arguments to log.
   */
  warn(...args: unknown[]): void {
    console.warn(...args);
  }

  /**
   * Log errors (always logged).
   * @param args - Arguments to log.
   */
  error(...args: unknown[]): void {
    console.error(...args);
  }

  /**
   * Log debug information (only in development).
   * @param args - Arguments to log.
   */
  debug(...args: unknown[]): void {
    if (this.isDevelopment) {
      console.debug(...args);
    }
  }

  /**
   * Log security events (only in development, use securityLogger for production).
   * @param message - The security message.
   * @param data - Optional data associated with the event.
   */
  security(message: string, data?: Record<string, unknown>): void {
    if (this.isDevelopment) {
      console.log('🔒 [SECURITY]', message, data || '');
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export default for convenience
export default logger;
