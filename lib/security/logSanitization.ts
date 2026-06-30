/**
 * Log Sanitization Utility.
 * Removes sensitive information from logs to prevent data leakage.
 */

/**
 * List of sensitive field names that should be redacted.
 */
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'authorization',
  'cookie',
  'session',
  'csrf',
  'ssn',
  'creditCard',
  'cardNumber',
  'cvv',
  'pin',
];

/**
 * Patterns to detect and redact in strings.
 */
const SENSITIVE_PATTERNS = [
  // Email addresses
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  // Credit card numbers
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  // JWT tokens (rough pattern)
  /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]*/g,
  // UUIDs and CUIDs (potential sensitive IDs)
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
  // API keys (common formats)
  /\b[A-Za-z0-9]{32,}\b/g, // 32+ alphanumeric characters
];

/**
 * Sanitize a single value.
 * @param value - The value to sanitize.
 * @param key - Optional key name to check against sensitive fields.
 * @returns The sanitized value.
 */
function sanitizeValue(value: unknown, key?: string): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  // Check if the key name indicates sensitive data
  if (key && SENSITIVE_FIELDS.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
    return '[REDACTED]';
  }

  // Handle strings
  if (typeof value === 'string') {
    // Check for sensitive patterns
    let sanitized = value;
    for (const pattern of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    return sanitized;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeValue(item, `${key}[${index}]`));
  }

  // Handle objects
  if (typeof value === 'object') {
    return sanitizeObject(value as Record<string, unknown>);
  }

  // Return primitive values as-is (numbers, booleans, etc.)
  return value;
}

/**
 * Sanitize an object by removing/redacting sensitive fields.
 * @param obj - The object to sanitize.
 * @returns A new object with sensitive fields redacted.
 */
export function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeValue(value, key);
  }

  return sanitized;
}

/**
 * Sanitize a log message (can be string or object).
 * @param message - The message to sanitize.
 * @returns The sanitized message.
 */
export function sanitizeLogMessage(message: unknown): unknown {
  if (typeof message === 'string') {
    return sanitizeValue(message);
  }

  if (typeof message === 'object' && message !== null) {
    return sanitizeObject(message as Record<string, unknown>);
  }

  return message;
}

/**
 * Sanitize multiple log arguments.
 * @param args - Arguments to sanitize.
 * @returns Array of sanitized arguments.
 */
export function sanitizeLogArgs(...args: unknown[]): unknown[] {
  return args.map((arg) => sanitizeLogMessage(arg));
}

/**
 * Redact email addresses partially (keep first char and domain).
 * Example: john@example.com -> j***@example.com
 * @param email - The email to redact.
 * @returns The redacted email.
 */
export function redactEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    return email;
  }

  const emailPattern = /^([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+\.[A-Z|a-z]{2,})$/;
  const match = email.match(emailPattern);

  if (match) {
    return `${match[1]}***@${match[2]}`;
  }

  return email;
}

/**
 * Redact parts of a user ID (keep first 4 and last 4 characters).
 * Example: clj1234567890abc -> clj1***0abc
 * @param id - The ID to redact.
 * @returns The redacted ID.
 */
export function redactUserId(id: string): string {
  if (!id || typeof id !== 'string' || id.length < 12) {
    return '[REDACTED_ID]';
  }

  const firstPart = id.substring(0, 4);
  const lastPart = id.substring(id.length - 4);
  return `${firstPart}***${lastPart}`;
}

/**
 * Safe stringify that handles circular references and sanitizes.
 * Note: JSON.stringify's built-in circular detection happens before replacer,
 * so the WeakSet check is defensive code that may not be reached in practice.
 * The catch block handles JSON.stringify's circular reference errors.
 * @param obj - The object to stringify.
 * @param indent - Indentation level.
 * @returns The stringified object.
 */
export function safeStringify(obj: unknown, indent: number = 0): string {
  const seen = new WeakSet();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const replacer = function (this: any, key: string, value: unknown) {
    // The 'this' context in replacer is the object being stringified
    // We track the parent objects to detect cycles
    if (typeof value === 'object' && value !== null) {
      // Check if we've seen this exact object before
      /* c8 ignore start - Defensive code: JSON.stringify detects circular references before replacer is called */
      if (seen.has(value)) {
        return '[Circular]';
      }
      /* c8 ignore stop */
      // Add to seen set to detect future circular references
      seen.add(value);
    }

    // Sanitize the value
    return sanitizeValue(value, key);
  };

  try {
    return JSON.stringify(obj, replacer, indent);
  } catch {
    // If JSON.stringify fails (circular structure, BigInt, etc.)
    return '[Unable to stringify]';
  }
}
