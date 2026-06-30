/**
 * @jest-environment node
 *
 * Cookie Configuration Tests
 * Tests for secure cookie utilities
 */

import { describe, expect, it } from '@jest/globals';
import {
  getSecureCookieConfig,
  checkIsProduction,
  validateProtocolSecurity,
} from '@/lib/auth/cookieConfig';

describe('Cookie Configuration', () => {
  describe('getSecureCookieConfig', () => {
    it('should return default secure cookie config', () => {
      const config = getSecureCookieConfig({
        name: 'test-cookie',
        value: 'test-value',
      });

      expect(config.name).toBe('test-cookie');
      expect(config.value).toBe('test-value');
      expect(config.httpOnly).toBe(true);
      expect(config.sameSite).toBe('strict');
      expect(config.path).toBe('/');
      // secure depends on NODE_ENV, which is 'test' in Jest
      expect(typeof config.secure).toBe('boolean');
    });

    it('should allow custom httpOnly setting', () => {
      const config = getSecureCookieConfig({
        name: 'test-cookie',
        value: 'test-value',
        httpOnly: false,
      });

      expect(config.httpOnly).toBe(false);
    });

    it('should allow custom sameSite setting', () => {
      const config = getSecureCookieConfig({
        name: 'test-cookie',
        value: 'test-value',
        sameSite: 'lax',
      });

      expect(config.sameSite).toBe('lax');
    });

    it('should allow strict sameSite', () => {
      const config = getSecureCookieConfig({
        name: 'test-cookie',
        value: 'test-value',
        sameSite: 'strict',
      });

      expect(config.sameSite).toBe('strict');
    });

    it('should allow none sameSite', () => {
      const config = getSecureCookieConfig({
        name: 'test-cookie',
        value: 'test-value',
        sameSite: 'none',
      });

      expect(config.sameSite).toBe('none');
    });

    it('should allow custom maxAge and path', () => {
      const config = getSecureCookieConfig({
        name: 'test-cookie',
        value: 'test-value',
        maxAge: 3600,
        path: '/api',
      });

      expect(config.maxAge).toBe(3600);
      expect(config.path).toBe('/api');
    });

    it('should use default path when not specified', () => {
      const config = getSecureCookieConfig({
        name: 'test-cookie',
        value: 'test-value',
      });

      expect(config.path).toBe('/');
    });

    it('should handle all cookie properties correctly', () => {
      const config = getSecureCookieConfig({
        name: 'full-cookie',
        value: 'full-value',
        httpOnly: false,
        sameSite: 'lax',
        maxAge: 7200,
        path: '/custom-path',
      });

      expect(config).toMatchObject({
        name: 'full-cookie',
        value: 'full-value',
        httpOnly: false,
        sameSite: 'lax',
        maxAge: 7200,
        path: '/custom-path',
      });
    });
  });

  describe('checkIsProduction', () => {
    it('should check if environment is production', () => {
      const result = checkIsProduction();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('validateProtocolSecurity', () => {
    it('should return false for HTTP in production', () => {
      expect(validateProtocolSecurity('http', true)).toBe(false);
    });

    it('should return true for HTTPS in production', () => {
      expect(validateProtocolSecurity('https', true)).toBe(true);
    });

    it('should return true for HTTP in development', () => {
      expect(validateProtocolSecurity('http', false)).toBe(true);
    });

    it('should return true for HTTPS in development', () => {
      expect(validateProtocolSecurity('https', false)).toBe(true);
    });

    it('should return false for null proto in production', () => {
      expect(validateProtocolSecurity(null, true)).toBe(false);
    });

    it('should return true for null proto in development', () => {
      expect(validateProtocolSecurity(null, false)).toBe(true);
    });

    it('should handle various protocol values in production', () => {
      expect(validateProtocolSecurity('https', true)).toBe(true);
      expect(validateProtocolSecurity('http', true)).toBe(false);
      expect(validateProtocolSecurity('wss', true)).toBe(false);
      expect(validateProtocolSecurity('', true)).toBe(false);
    });

    it('should handle various protocol values in development', () => {
      expect(validateProtocolSecurity('https', false)).toBe(true);
      expect(validateProtocolSecurity('http', false)).toBe(true);
      expect(validateProtocolSecurity('wss', false)).toBe(true);
      expect(validateProtocolSecurity('', false)).toBe(true);
      expect(validateProtocolSecurity(null, false)).toBe(true);
    });
  });
});
