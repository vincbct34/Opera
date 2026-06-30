/* eslint-disable */
import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import {
  sanitizeInput,
  isValidEmail,
  isValidPassword,
  detectSuspiciousInput,
  loginRateLimiter,
  logSuspiciousActivity,
} from '@/lib/security/securityUtils';

describe('securityUtils helpers', () => {
  describe('sanitizeInput', () => {
    test('removes script tags using xss library', () => {
      const raw = '<script>alert(1)</script>';
      const sanitized = sanitizeInput(raw);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
    });

    test('trims whitespace and limits length', () => {
      const raw = '   normal text   ';
      const sanitized = sanitizeInput(raw);
      expect(sanitized).toBe('normal text');
      expect(sanitized.length).toBeLessThanOrEqual(1000);
    });

    test('removes null bytes', () => {
      const raw = 'text\0with\0nulls';
      const sanitized = sanitizeInput(raw);
      expect(sanitized).not.toContain('\0');
    });

    test('normalizes Unicode characters', () => {
      const raw = '\uFE64script\uFE65'; // Unicode variants
      const sanitized = sanitizeInput(raw);
      // xss library removes script-like content
      expect(sanitized).toBe('[removed]');
    });

    test('returns empty string for non-string input', () => {
      // cast to any to simulate bad input coming from runtime
      expect(sanitizeInput(null as any)).toBe('');
      expect(sanitizeInput(undefined as any)).toBe('');
      expect(sanitizeInput(123 as any)).toBe('');
    });
  });

  describe('isValidEmail', () => {
    test('accepts a normal email', () => {
      expect(isValidEmail('alice@example.com')).toBe(true);
    });

    test('rejects invalid emails', () => {
      expect(isValidEmail('not-an-email')).toBe(false);
      expect(isValidEmail('no-at-sign.com')).toBe(false);
      expect(isValidEmail('missingdomain@')).toBe(false);
    });

    test('rejects emails that are too long', () => {
      const local = 'a'.repeat(250);
      const email = `${local}@ex.com`;
      // isValidEmail should fail because the total length > 254
      expect(email.length).toBeGreaterThan(254);
      expect(isValidEmail(email)).toBe(false);
    });
  });

  describe('isValidPassword', () => {
    test('accepts passwords within allowed range', () => {
      expect(isValidPassword('abcdefghij')).toBe(true); // length 10
      expect(isValidPassword('a'.repeat(128))).toBe(true); // max length
    });

    test('rejects too short or too long passwords', () => {
      expect(isValidPassword('short')).toBe(false);
      expect(isValidPassword('a'.repeat(129))).toBe(false);
    });
  });

  describe('detectSuspiciousInput', () => {
    test('detects script tags and javascript: URIs', () => {
      expect(detectSuspiciousInput('<script>alert(1)</script>')).toBe(true);
      expect(detectSuspiciousInput('javascript:alert(1)')).toBe(true);
    });

    test('detects URL-encoded malicious input', () => {
      expect(detectSuspiciousInput('%3Cscript%3Ealert(1)%3C/script%3E')).toBe(true);
      expect(detectSuspiciousInput('%6A%61%76%61%73%63%72%69%70%74%3A')).toBe(true);
    });

    test('detects HTML entity encoded malicious input', () => {
      expect(detectSuspiciousInput('&lt;script&gt;alert(1)&lt;/script&gt;')).toBe(true);
    });

    test('detects SQL injection attempts', () => {
      expect(detectSuspiciousInput("' UNION SELECT * FROM users--")).toBe(true);
      expect(detectSuspiciousInput('1; DROP TABLE users;')).toBe(true);
      expect(detectSuspiciousInput("admin' OR 1=1--")).toBe(true);
    });

    test('detects event handlers', () => {
      expect(detectSuspiciousInput('<img onerror=alert(1)>')).toBe(true);
      expect(detectSuspiciousInput('<div onclick="malicious()">')).toBe(true);
    });

    test('detects path traversal attempts', () => {
      expect(detectSuspiciousInput('../../../etc/passwd')).toBe(true);
    });

    test('detects other XSS vectors', () => {
      expect(detectSuspiciousInput('<iframe src="evil.com"></iframe>')).toBe(true);
      expect(detectSuspiciousInput('data:text/html,<script>alert(1)</script>')).toBe(true);
      expect(detectSuspiciousInput('vbscript:msgbox(1)')).toBe(true);
    });

    test('does not flag benign strings', () => {
      expect(detectSuspiciousInput('Hello, world!')).toBe(false);
      expect(detectSuspiciousInput('john.doe@example.com')).toBe(false);
      expect(detectSuspiciousInput('Normal text with numbers 123')).toBe(false);
    });

    test('handles non-string input gracefully', () => {
      expect(detectSuspiciousInput(null as any)).toBe(false);
      expect(detectSuspiciousInput(undefined as any)).toBe(false);
      expect(detectSuspiciousInput(123 as any)).toBe(false);
    });
  });

  describe('loginRateLimiter', () => {
    beforeEach(() => {
      // Reset the limiter map by creating a fresh instance's internal map via private access workaround
      // We simulate behaviour by using unique keys per test so state doesn't leak between tests.
      jest.useFakeTimers();
      jest.setSystemTime(Date.now());
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('allows attempts when no record exists and counts failures', () => {
      const key = 'user1';
      expect(loginRateLimiter.canAttempt(key)).toBe(true);

      // record 5 failed attempts
      for (let i = 0; i < 5; i++) {
        loginRateLimiter.recordAttempt(key, true);
      }

      // After 5 failed attempts, canAttempt should be false
      expect(loginRateLimiter.canAttempt(key)).toBe(false);
      // remaining time should be > 0
      expect(loginRateLimiter.getRemainingTime(key)).toBeGreaterThan(0);
    });

    test('resets counter on success', () => {
      const key = 'user2';
      // fail once
      loginRateLimiter.recordAttempt(key, true);
      expect(loginRateLimiter.canAttempt(key)).toBe(true);

      // success should reset
      loginRateLimiter.recordAttempt(key, false);
      expect(loginRateLimiter.canAttempt(key)).toBe(true);
      expect(loginRateLimiter.getRemainingTime(key)).toBe(0);
    });

    test('handles success when no record exists (covers ternary false branch)', () => {
      const key = 'user0';
      // ensure no record exists
      expect(loginRateLimiter.canAttempt(key)).toBe(true);

      // Record a success when there's no prior record — should set count to 0 path
      loginRateLimiter.recordAttempt(key, false);
      expect(loginRateLimiter.canAttempt(key)).toBe(true);
      expect(loginRateLimiter.getRemainingTime(key)).toBe(0);
    });

    test('resets after window expires', () => {
      const key = 'user3';
      // fail maxAttempts times
      for (let i = 0; i < 5; i++) loginRateLimiter.recordAttempt(key, true);
      expect(loginRateLimiter.canAttempt(key)).toBe(false);

      // advance time past the window (15 minutes)
      jest.advanceTimersByTime(15 * 60 * 1000 + 1000);
      // now canAttempt should be true again
      expect(loginRateLimiter.canAttempt(key)).toBe(true);
    });
  });

  describe('logSuspiciousActivity', () => {
    test('calls console.warn when in browser dev environment', () => {
      // Simulate browser environment and development mode
      // @ts-ignore
      global.window = {};
      const orig = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = 'development';

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      logSuspiciousActivity('test-activity', { foo: 'bar' });
      expect(warnSpy).toHaveBeenCalledWith('🚨 Activité suspecte détectée:', 'test-activity', {
        foo: 'bar',
      });

      warnSpy.mockRestore();
      (process.env as any).NODE_ENV = orig;
      // @ts-ignore
      delete global.window;
    });

    test('does nothing when not in browser or not development', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      // Ensure no window and NODE_ENV != development
      const orig = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = 'production';
      // @ts-ignore
      delete (global as any).window;

      logSuspiciousActivity('ignored', null);
      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
      (process.env as any).NODE_ENV = orig;
    });

    test('does nothing when in browser but production mode', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      // @ts-ignore
      global.window = {};
      const orig = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = 'production';

      logSuspiciousActivity('production-ignored', { test: 'data' });
      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
      (process.env as any).NODE_ENV = orig;
      // @ts-ignore
      delete global.window;
    });

    test('calls console.warn with null details', () => {
      // @ts-ignore
      global.window = {};
      const orig = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = 'development';

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      logSuspiciousActivity('test-with-null', null);
      expect(warnSpy).toHaveBeenCalledWith(
        '🚨 Activité suspecte détectée:',
        'test-with-null',
        null,
      );

      warnSpy.mockRestore();
      (process.env as any).NODE_ENV = orig;
      // @ts-ignore
      delete global.window;
    });
  });

  describe('detectXSSAttempt edge cases', () => {
    test('should handle malformed URL encoding that throws in decodeURIComponent', () => {
      // These strings will cause decodeURIComponent to throw
      const malformedStrings = ['%', '%E0%A', 'test%', '%GG'];

      malformedStrings.forEach((str) => {
        // Should not throw, should return original string
        const result = detectSuspiciousInput(str);
        expect(typeof result).toBe('boolean');
      });
    });

    test('should decode HTML entities in XSS detection', () => {
      const htmlEntityPayloads = [
        '&lt;script&gt;alert(1)&lt;/script&gt;',
        '&lt;img src=x onerror=alert(1)&gt;',
        '&lt;svg onload=alert(1)&gt;',
      ];

      htmlEntityPayloads.forEach((payload) => {
        expect(detectSuspiciousInput(payload)).toBe(true);
      });
    });

    test('should handle multiple URL encodings', () => {
      // Double encoded script tag: %253Cscript%253E = %3Cscript%3E = <script>
      const doubleEncoded = '%253Cscript%253Ealert(1)%253C/script%253E';
      expect(detectSuspiciousInput(doubleEncoded)).toBe(true);
    });

    test('should handle unknown HTML entities', () => {
      // Test with an unknown entity that will be returned as-is
      const unknownEntity = '&unknown;test&fake123;';
      // Should not crash, should handle gracefully
      const result = detectSuspiciousInput(unknownEntity);
      expect(typeof result).toBe('boolean');
    });

    test('should handle various HTML entity formats', () => {
      const payloads = [
        '&amp;lt;script&amp;gt;', // Double-encoded
        '&#60;script&#62;', // Decimal entities
        '&#x3C;script&#x3E;', // Hex entities
      ];

      payloads.forEach((payload) => {
        const result = detectSuspiciousInput(payload);
        expect(typeof result).toBe('boolean');
      });
    });
  });
});
