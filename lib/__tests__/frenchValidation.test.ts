import { describe, expect, it } from '@jest/globals';
import {
  isValidFrenchPostalCode,
  isValidFrenchPhoneNumber,
  isValidEmail,
  formatFrenchPostalCode,
  formatFrenchPhoneNumber,
  getDepartmentFromPostalCode,
} from '../validation/frenchValidation';

describe('frenchValidation', () => {
  describe('isValidFrenchPostalCode', () => {
    it('should accept valid 5-digit postal codes', () => {
      expect(isValidFrenchPostalCode('34000')).toBe(true);
      expect(isValidFrenchPostalCode('75001')).toBe(true);
      expect(isValidFrenchPostalCode('13000')).toBe(true);
      expect(isValidFrenchPostalCode('69000')).toBe(true);
    });

    it('should reject invalid postal codes', () => {
      expect(isValidFrenchPostalCode('1234')).toBe(false); // Too short
      expect(isValidFrenchPostalCode('123456')).toBe(false); // Too long
      expect(isValidFrenchPostalCode('abcde')).toBe(false); // Letters
      expect(isValidFrenchPostalCode('')).toBe(false); // Empty
    });

    it('should accept postal codes with spaces (removes them)', () => {
      expect(isValidFrenchPostalCode('12 345')).toBe(true); // Space removed
    });
  });

  describe('isValidFrenchPhoneNumber', () => {
    it('should accept valid French phone numbers', () => {
      expect(isValidFrenchPhoneNumber('0612345678')).toBe(true);
      expect(isValidFrenchPhoneNumber('06 12 34 56 78')).toBe(true);
      expect(isValidFrenchPhoneNumber('+33 6 12 34 56 78')).toBe(true);
      expect(isValidFrenchPhoneNumber('+33612345678')).toBe(true);
      expect(isValidFrenchPhoneNumber('06-12-34-56-78')).toBe(true);
      expect(isValidFrenchPhoneNumber('01 23 45 67 89')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(isValidFrenchPhoneNumber('12345')).toBe(false); // Too short
      expect(isValidFrenchPhoneNumber('1234567890123')).toBe(false); // Too long
      expect(isValidFrenchPhoneNumber('abcdefghij')).toBe(false); // Letters
      expect(isValidFrenchPhoneNumber('')).toBe(false); // Empty
    });
  });

  describe('isValidEmail', () => {
    it('should accept valid email addresses', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('test.user@domain.co.uk')).toBe(true);
      expect(isValidEmail('admin+tag@example.com')).toBe(true);
      expect(isValidEmail('user123@test-domain.com')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('notanemail')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('user @example.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('formatFrenchPostalCode', () => {
    it('should format valid postal codes by removing spaces', () => {
      expect(formatFrenchPostalCode('34 000')).toBe('34000');
      expect(formatFrenchPostalCode('75 001')).toBe('75001');
      expect(formatFrenchPostalCode('  34000  ')).toBe('34000');
    });

    it('should return cleaned version for valid postal codes', () => {
      expect(formatFrenchPostalCode('34000')).toBe('34000');
      expect(formatFrenchPostalCode('75001')).toBe('75001');
    });

    it('should return original string for invalid postal codes', () => {
      expect(formatFrenchPostalCode('1234')).toBe('1234');
      expect(formatFrenchPostalCode('invalid')).toBe('invalid');
      expect(formatFrenchPostalCode('')).toBe('');
    });
  });

  describe('formatFrenchPhoneNumber', () => {
    it('should format valid national phone numbers', () => {
      expect(formatFrenchPhoneNumber('0612345678')).toBe('06 12 34 56 78');
      expect(formatFrenchPhoneNumber('01 23 45 67 89')).toBe('01 23 45 67 89');
      expect(formatFrenchPhoneNumber('06-12-34-56-78')).toBe('06 12 34 56 78');
    });

    it('should format international format to national format', () => {
      expect(formatFrenchPhoneNumber('+33612345678')).toBe('06 12 34 56 78');
      expect(formatFrenchPhoneNumber('+33 6 12 34 56 78')).toBe('06 12 34 56 78');
      expect(formatFrenchPhoneNumber('+33123456789')).toBe('01 23 45 67 89');
    });

    it('should return original string for invalid phone numbers', () => {
      expect(formatFrenchPhoneNumber('12345')).toBe('12345');
      expect(formatFrenchPhoneNumber('invalid')).toBe('invalid');
      expect(formatFrenchPhoneNumber('')).toBe('');
    });
  });

  describe('getDepartmentFromPostalCode', () => {
    it('should extract department code from metropolitan postal codes', () => {
      expect(getDepartmentFromPostalCode('34000')).toBe('34');
      expect(getDepartmentFromPostalCode('75001')).toBe('75');
      expect(getDepartmentFromPostalCode('13000')).toBe('13');
      expect(getDepartmentFromPostalCode('01000')).toBe('01');
    });

    it('should handle Corsica special cases (2A, 2B)', () => {
      expect(getDepartmentFromPostalCode('20000')).toBe('2A'); // Corse-du-Sud
      expect(getDepartmentFromPostalCode('20100')).toBe('2A'); // Corse-du-Sud
      expect(getDepartmentFromPostalCode('20200')).toBe('2B'); // Haute-Corse
      expect(getDepartmentFromPostalCode('20600')).toBe('2B'); // Haute-Corse
    });

    it('should handle overseas territories (3 digits)', () => {
      expect(getDepartmentFromPostalCode('97100')).toBe('971'); // Guadeloupe
      expect(getDepartmentFromPostalCode('97200')).toBe('972'); // Martinique
      expect(getDepartmentFromPostalCode('97300')).toBe('973'); // Guyane
      expect(getDepartmentFromPostalCode('97400')).toBe('974'); // Réunion
      expect(getDepartmentFromPostalCode('98000')).toBe('980'); // Nouvelle-Calédonie
    });

    it('should return null for invalid postal codes', () => {
      expect(getDepartmentFromPostalCode('1234')).toBe(null);
      expect(getDepartmentFromPostalCode('invalid')).toBe(null);
      expect(getDepartmentFromPostalCode('')).toBe(null);
      expect(getDepartmentFromPostalCode('abcde')).toBe(null);
    });

    it('should handle postal codes with spaces', () => {
      expect(getDepartmentFromPostalCode('34 000')).toBe('34');
      expect(getDepartmentFromPostalCode('  75001  ')).toBe('75');
    });
  });
});
