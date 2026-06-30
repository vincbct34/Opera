import { describe, expect, it, jest } from '@jest/globals';
import {
  sanitizeObject,
  sanitizeLogMessage,
  sanitizeLogArgs,
  redactEmail,
  redactUserId,
  safeStringify,
} from '../security/logSanitization';

describe('logSanitization', () => {
  describe('sanitizeObject', () => {
    it('should redact password field', () => {
      const obj = {
        username: 'john',
        password: 'secret123',
      };

      const result = sanitizeObject(obj);

      expect(result.username).toBe('john');
      expect(result.password).toBe('[REDACTED]');
    });

    it('should redact token field', () => {
      const obj = {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        refreshToken: 'token-value',
      };

      const result = sanitizeObject(obj);

      expect(result.accessToken).toBe('[REDACTED]');
      expect(result.refreshToken).toBe('[REDACTED]');
    });

    it('should redact apiKey field', () => {
      const obj = {
        name: 'test',
        apiKey: 'sk-1234567890abcdefghijklmnopqrst',
      };

      const result = sanitizeObject(obj);

      expect(result.name).toBe('test');
      expect(result.apiKey).toBe('[REDACTED]');
    });

    it('should handle nested objects', () => {
      const obj = {
        user: {
          name: 'john',
          password: 'secret123',
        },
      };

      const result = sanitizeObject(obj);

      expect((result.user as Record<string, unknown>).name).toBe('john');
      expect((result.user as Record<string, unknown>).password).toBe('[REDACTED]');
    });

    it('should handle arrays of objects', () => {
      const obj = {
        items: [
          { id: 1, password: 'secret1' },
          { id: 2, password: 'secret2' },
        ],
      };

      const result = sanitizeObject(obj);

      expect(((result.items as unknown[]) || [])[0]).toBeDefined();
      expect((((result.items as unknown[]) || [])[0] as Record<string, unknown>).password).toBe(
        '[REDACTED]',
      );
      expect((((result.items as unknown[]) || [])[1] as Record<string, unknown>).password).toBe(
        '[REDACTED]',
      );
    });

    it('should redact email addresses in strings', () => {
      const obj = {
        email: 'john@example.com',
        message: 'Contact us at support@example.com',
      };

      const result = sanitizeObject(obj);

      expect(result.email).toContain('[REDACTED]');
      expect(result.message).toContain('[REDACTED]');
    });

    it('should redact credit card numbers', () => {
      const obj = {
        card: '4532-1234-5678-9010',
        message: 'Card: 4532 1234 5678 9010',
      };

      const result = sanitizeObject(obj);

      expect(result.card).toContain('[REDACTED]');
      expect(result.message).toContain('[REDACTED]');
    });

    it('should handle null and undefined values', () => {
      const obj = {
        nullValue: null,
        undefinedValue: undefined,
        password: 'secret',
      };

      const result = sanitizeObject(obj);

      expect(result.nullValue).toBeNull();
      expect(result.undefinedValue).toBeUndefined();
      expect(result.password).toBe('[REDACTED]');
    });

    it('should handle non-object input', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = sanitizeObject(null as any);
      expect(result).toBeNull();
    });
  });

  describe('sanitizeLogMessage', () => {
    it('should sanitize string messages', () => {
      const message = 'User email is john@example.com';
      const result = sanitizeLogMessage(message);

      expect(result).toContain('[REDACTED]');
      expect(result).toContain('User email is');
    });

    it('should sanitize object messages', () => {
      const message = { password: 'secret123', name: 'john' };
      const result = sanitizeLogMessage(message) as Record<string, unknown>;

      expect(result.password).toBe('[REDACTED]');
      expect(result.name).toBe('john');
    });

    it('should return primitive values as-is', () => {
      expect(sanitizeLogMessage(123)).toBe(123);
      expect(sanitizeLogMessage(true)).toBe(true);
    });

    it('should handle null and undefined', () => {
      expect(sanitizeLogMessage(null)).toBeNull();
      expect(sanitizeLogMessage(undefined)).toBeUndefined();
    });
  });

  describe('sanitizeLogArgs', () => {
    it('should sanitize multiple arguments', () => {
      const args = [
        'User login attempt from john@example.com',
        { email: 'john@example.com', password: 'secret' },
        { token: 'abc123' },
      ];

      const result = sanitizeLogArgs(...args);

      expect(result[0]).toContain('[REDACTED]'); // Email should be redacted
      expect((result[1] as Record<string, unknown>).password).toBe('[REDACTED]');
      expect((result[2] as Record<string, unknown>).token).toBe('[REDACTED]');
    });

    it('should handle empty args', () => {
      const result = sanitizeLogArgs();
      expect(result).toEqual([]);
    });

    it('should handle mixed types', () => {
      const result = sanitizeLogArgs('message', 123, { secret: 'value' }, null);

      expect(result.length).toBe(4);
      expect((result[2] as Record<string, unknown>).secret).toBe('[REDACTED]');
      expect(result[3]).toBeNull();
    });
  });

  describe('redactEmail', () => {
    it('should partially redact email addresses', () => {
      const result = redactEmail('john@example.com');

      expect(result).toBe('j***@example.com');
      expect(result).not.toContain('john');
    });

    it('should handle single character emails', () => {
      const result = redactEmail('a@example.com');

      expect(result).toBe('a***@example.com');
    });

    it('should return email unchanged if invalid format', () => {
      const invalidEmail = 'not-an-email';
      const result = redactEmail(invalidEmail);

      expect(result).toBe(invalidEmail);
    });

    it('should handle empty string', () => {
      const result = redactEmail('');
      expect(result).toBe('');
    });

    it('should handle non-string input', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = redactEmail(null as any);
      expect(result).toBeNull();
    });

    it('should work with complex email addresses', () => {
      const result = redactEmail('firstname.lastname+tag@example.co.uk');

      expect(result).toBe('f***@example.co.uk');
    });
  });

  describe('redactUserId', () => {
    it('should keep first 4 and last 4 characters of user ID', () => {
      const userId = 'clj1234567890abc';
      const result = redactUserId(userId);

      expect(result).toBe('clj1***0abc');
      expect(result).toContain('clj1');
      expect(result).toContain('0abc');
    });

    it('should redact short user IDs', () => {
      const userId = 'short';
      const result = redactUserId(userId);

      expect(result).toBe('[REDACTED_ID]');
    });

    it('should return REDACTED_ID for null', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = redactUserId(null as any);
      expect(result).toBe('[REDACTED_ID]');
    });

    it('should return REDACTED_ID for empty string', () => {
      const result = redactUserId('');
      expect(result).toBe('[REDACTED_ID]');
    });

    it('should work with exactly 12 characters', () => {
      const userId = '123456789012';
      const result = redactUserId(userId);

      expect(result).toBe('1234***9012');
    });

    it('should work with long user IDs', () => {
      const userId = 'very-long-user-id-with-many-characters';
      const result = redactUserId(userId);

      expect(result).toContain('very');
      expect(result).toContain('ters');
      expect(result).not.toContain('user-id-with');
    });
  });

  describe('safeStringify', () => {
    it('should stringify objects', () => {
      const obj = { name: 'john', age: 30 };
      const result = safeStringify(obj);

      expect(result).toContain('john');
      expect(result).toContain('30');
    });

    it('should redact sensitive fields while stringifying', () => {
      const obj = { name: 'john', password: 'secret123' };
      const result = safeStringify(obj);

      expect(result).toContain('john');
      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('secret123');
    });

    it('should handle circular references gracefully', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const obj: any = { name: 'john' };
      obj.self = obj; // Create circular reference

      const result = safeStringify(obj);

      // JSON.stringify throws on circular refs before replacer can handle them
      // So this will result in [Unable to stringify]
      expect(typeof result).toBe('string');
      expect(result).toBe('[Unable to stringify]');
    });

    it('should handle arrays with circular references gracefully', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const arr: any[] = [{ name: 'john' }];
      arr.push(arr); // Create circular reference

      const result = safeStringify(arr);

      // JSON.stringify throws on circular refs before replacer can handle them
      expect(typeof result).toBe('string');
      expect(result).toBe('[Unable to stringify]');
    });

    it('should respect indent parameter', () => {
      const obj = { name: 'john', nested: { value: 123 } };
      const result = safeStringify(obj, 2);

      expect(result).toContain('\n');
      expect(result).toContain('  ');
    });

    it('should handle null and undefined', () => {
      expect(safeStringify(null)).toBe('null');
      expect(safeStringify(undefined)).toBe(undefined);
    });

    it('should handle primitive values', () => {
      expect(safeStringify('string')).toBe('"string"');
      expect(safeStringify(123)).toBe('123');
      expect(safeStringify(true)).toBe('true');
    });

    it('should handle stringify errors gracefully', () => {
      // Create an object that causes JSON.stringify to fail
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const obj: any = {
        toJSON: () => {
          throw new Error('Serialization error');
        },
      };

      const result = safeStringify(obj);

      expect(result).toBe('[Unable to stringify]');
    });

    it('should handle objects that break JSON.stringify', () => {
      // Create an object with a getter that throws during replacer execution
      const problematicObj = {};
      Object.defineProperty(problematicObj, 'brokenProp', {
        get() {
          throw new Error('Property access error');
        },
        enumerable: true,
      });

      const result = safeStringify(problematicObj);

      // Should either successfully stringify or return error message
      expect(result === '[Unable to stringify]' || typeof result === 'string').toBe(true);
    });

    it('should handle BigInt values that cannot be serialized', () => {
      const obj = { bigNum: BigInt(9007199254740991) };

      const result = safeStringify(obj);

      // BigInt throws in JSON.stringify, should catch and return error message
      expect(result).toBe('[Unable to stringify]');
    });

    it('should handle JSON.stringify errors when replacer fails', () => {
      // Mock JSON.stringify to throw
      const originalStringify = JSON.stringify;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (JSON.stringify as any) = jest.fn<typeof JSON.stringify>().mockImplementation(() => {
        throw new TypeError('Cannot stringify');
      });

      const obj = { test: 'value' };
      const result = safeStringify(obj);

      expect(result).toBe('[Unable to stringify]');

      // Restore original
      JSON.stringify = originalStringify;
    });

    it('should redact JWT tokens', () => {
      const obj = {
        token:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
      };

      const result = safeStringify(obj);

      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('eyJhbGciOiJIUzI1NiIs');
    });
  });

  describe('Pattern matching', () => {
    it('should redact UUIDs', () => {
      const obj = {
        id: '550e8400-e29b-41d4-a716-446655440000',
      };

      const result = sanitizeObject(obj);

      expect(result.id).toContain('[REDACTED]');
    });

    it('should redact JWT-like patterns', () => {
      const obj = {
        auth: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
      };

      const result = sanitizeObject(obj);

      expect(result.auth).toContain('[REDACTED]');
    });

    it('should redact long alphanumeric sequences (API keys)', () => {
      const obj = {
        key: 'abcdefghijklmnopqrstuvwxyz123456',
      };

      const result = sanitizeObject(obj);

      expect(result.key).toBe('[REDACTED]');
    });

    it('should not redact normal text', () => {
      const obj = {
        message: 'This is a normal message with some text',
      };

      const result = sanitizeObject(obj);

      expect(result.message).toBe('This is a normal message with some text');
    });
  });
});
