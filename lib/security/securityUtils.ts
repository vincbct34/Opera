// Security utilities to protect the application
import xss from 'xss';
import { logger } from '../middleware/logger';
import { sanitizeLogArgs } from '../security/logSanitization';

/**
 * Simple client-side rate limiting (complementing server-side rate limiting).
 */
class ClientRateLimiter {
  private attempts: Map<string, { count: number; lastAttempt: number }> = new Map();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(maxAttempts: number = 5, windowMs: number = 2 * 60 * 1000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  canAttempt(key: string): boolean {
    const now = Date.now();
    const record = this.attempts.get(key);

    if (!record) {
      return true;
    }

    // Reset if time window has expired
    if (now - record.lastAttempt > this.windowMs) {
      this.attempts.delete(key);
      return true;
    }

    return record.count < this.maxAttempts;
  }

  recordAttempt(key: string, failed: boolean): void {
    const now = Date.now();
    const record = this.attempts.get(key) || { count: 0, lastAttempt: 0 };

    if (now - record.lastAttempt > this.windowMs) {
      // New window
      record.count = failed ? 1 : 0;
    } else if (failed) {
      record.count++;
    } else {
      // Success - reset counter
      this.attempts.delete(key);
      return;
    }

    record.lastAttempt = now;
    this.attempts.set(key, record);
  }

  getRemainingTime(key: string): number {
    const record = this.attempts.get(key);
    if (!record || record.count < this.maxAttempts) {
      return 0;
    }

    const elapsed = Date.now() - record.lastAttempt;
    return Math.max(0, this.windowMs - elapsed);
  }
}

export const loginRateLimiter = new ClientRateLimiter(5, 2 * 60 * 1000); // 5 tentatives par 2 minutes

/**
 * Function to sanitize user input with advanced XSS protection.
 * @param input - The input string to sanitize.
 * @returns The sanitized string.
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';

  // Unicode normalization to avoid bypasses
  const normalized = input.normalize('NFKC');

  // Use xss library for robust protection
  const sanitized = xss(normalized, {
    whiteList: {}, // No HTML tags allowed
    stripIgnoreTag: true, // Remove unauthorized tags
    stripIgnoreTagBody: ['script', 'style'], // Remove content of script and style tags
  });

  return sanitized
    .trim()
    .replace(/\0/g, '') // Remove null bytes
    .substring(0, 1000); // Limit length
}

/**
 * Function to validate an email.
 * @param email - The email to validate.
 * @returns true if valid.
 */
export function isValidEmail(email: string): boolean {
  // Regex RFC 5322 compliant pour une validation email robuste
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Function to validate a password.
 * @param password - The password to validate.
 * @returns true if valid.
 */
export function isValidPassword(password: string): boolean {
  return password.length >= 10 && password.length <= 128;
}

/**
 * Enhanced function to detect injection attempts with encoding handling.
 * @param input - The input to check.
 * @returns true if suspicious patterns are detected.
 */
export function detectSuspiciousInput(input: string): boolean {
  if (typeof input !== 'string') return false;

  // Decode HTML entities and URL before verification
  const decoded = decodeURIComponentSafe(input);
  const htmlDecoded = decodeHTMLEntities(decoded);

  const suspiciousPatterns = [
    // XSS patterns
    /<script[\s\S]*?>/i,
    /<iframe[\s\S]*?>/i,
    /<embed[\s\S]*?>/i,
    /<object[\s\S]*?>/i,
    /javascript:/i,
    /on\w+\s*=/i, // Event handlers: onclick=, onerror=, etc.
    /eval\s*\(/i,
    /expression\s*\(/i, // CSS expression()
    /vbscript:/i,
    /data:text\/html/i,

    // SQL Injection patterns
    /(\bunion\b.*\bselect\b)/i,
    /(\bselect\b.*\bfrom\b)/i,
    /(\binsert\b.*\binto\b)/i,
    /(\bupdate\b.*\bset\b)/i,
    /(\bdelete\b.*\bfrom\b)/i,
    /(\bdrop\b.*\btable\b)/i,
    /(\bexec\b.*\()/i,
    /(\bexecute\b.*\()/i,
    /(--|;|\/\*|\*\/)/i, // SQL comment patterns

    // Command Injection patterns
    /[;&|`$(){}[\]<>]/,
    /\.\.\//g, // Path traversal

    // LDAP Injection
    /[()&|]/,
  ];

  return suspiciousPatterns.some((pattern) => pattern.test(htmlDecoded));
}

// Helper function to safely decode URLs
function decodeURIComponentSafe(str: string): string {
  try {
    let decoded = str;
    let previous = '';
    // Decode recursively to avoid double encodings
    while (decoded !== previous && decoded.includes('%')) {
      previous = decoded;
      decoded = decodeURIComponent(decoded);
    }
    return decoded;
  } catch {
    return str;
  }
}

// Helper function to decode HTML entities
function decodeHTMLEntities(str: string): string {
  const entities: Record<string, string> = {
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#39;': "'",
    '&#47;': '/',
  };

  return str.replace(/&[#\w]+;/g, (entity) => entities[entity] || entity);
}

/**
 * Log suspicious activity.
 * @param activity - Description of the activity.
 * @param details - Additional details.
 */
export function logSuspiciousActivity(activity: string, details: unknown): void {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    logger.warn('🚨 Activité suspecte détectée:', activity, ...sanitizeLogArgs(details));
  }
}
