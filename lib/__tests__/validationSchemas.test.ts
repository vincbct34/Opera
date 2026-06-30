import { describe, expect, test } from '@jest/globals';
import {
  LoginSchema,
  RegisterSchema,
  ResetPasswordRequestSchema,
  ResetPasswordSchema,
  ChangePasswordSchema,
} from '@/lib/validation/validationSchemas';

describe('Validation Schemas', () => {
  describe('LoginSchema', () => {
    test('validates correct login data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'ValidPassword123!',
      };

      const result = LoginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    test('converts email to lowercase', () => {
      const data = {
        email: 'TEST@EXAMPLE.COM',
        password: 'ValidPassword123!',
      };

      const result = LoginSchema.parse(data);
      expect(result.email).toBe('test@example.com');
    });

    test('rejects invalid email format', () => {
      const invalidData = {
        email: 'not-an-email',
        password: 'ValidPassword123!',
      };

      const result = LoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('email');
      }
    });

    test('rejects email exceeding 254 characters', () => {
      const longEmail = 'a'.repeat(250) + '@test.com';
      const invalidData = {
        email: longEmail,
        password: 'ValidPassword123!',
      };

      const result = LoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    test('rejects empty password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: '',
      };

      const result = LoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    test('rejects password exceeding 128 characters', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'a'.repeat(129),
      };

      const result = LoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('RegisterSchema', () => {
    const validRegisterData = {
      email: 'test@example.com',
      password: 'ValidPass123!',
      first_name: 'John',
      last_name: 'Doe',
      phone_number: '0123456789',
      institution_ids: ['clxxx1234567890abc'],
    };

    test('validates correct registration data', () => {
      const result = RegisterSchema.safeParse(validRegisterData);
      expect(result.success).toBe(true);
    });

    test('rejects password without uppercase letter', () => {
      const invalidData = {
        ...validRegisterData,
        password: 'validpass123!',
      };

      const result = RegisterSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('majuscule');
      }
    });

    test('rejects password without lowercase letter', () => {
      const invalidData = {
        ...validRegisterData,
        password: 'VALIDPASS123!',
      };

      const result = RegisterSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    test('rejects password without number', () => {
      const invalidData = {
        ...validRegisterData,
        password: 'ValidPassword!',
      };

      const result = RegisterSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    test('rejects password without special character', () => {
      const invalidData = {
        ...validRegisterData,
        password: 'ValidPassword123',
      };

      const result = RegisterSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('caractère spécial');
      }
    });

    test('rejects password shorter than 10 characters', () => {
      const invalidData = {
        ...validRegisterData,
        password: 'Pass1!',
      };

      const result = RegisterSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('10 caractères');
      }
    });

    test('accepts password with various special characters', () => {
      const specialChars = ['!', '@', '#', '$', '%', '*', '?', '&'];

      specialChars.forEach((char) => {
        const validData = {
          ...validRegisterData,
          password: `ValidPass123${char}`,
        };

        const result = RegisterSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });

    test('rejects invalid characters in first_name', () => {
      const invalidData = {
        ...validRegisterData,
        first_name: 'John123',
      };

      const result = RegisterSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    test('accepts accented characters in names', () => {
      const validData = {
        ...validRegisterData,
        first_name: 'François',
        last_name: 'Müller',
      };

      const result = RegisterSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    test('rejects invalid phone number format', () => {
      const invalidData = {
        ...validRegisterData,
        phone_number: 'abc123',
      };

      const result = RegisterSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    test('rejects empty institution_ids array', () => {
      const invalidData = {
        ...validRegisterData,
        institution_ids: [],
      };

      const result = RegisterSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    test('rejects too many institutions', () => {
      const invalidData = {
        ...validRegisterData,
        institution_ids: Array(11).fill('clxxx1234567890abc'),
      };

      const result = RegisterSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    test('sets default values for optional fields', () => {
      const data = {
        ...validRegisterData,
      };

      const result = RegisterSchema.parse(data);
      expect(result.email_notifications_enabled).toBe(true);
      expect(result.events_reminders_enabled).toBe(true);
    });
  });

  describe('ResetPasswordRequestSchema', () => {
    test('validates correct email', () => {
      const validData = {
        email: 'test@example.com',
      };

      const result = ResetPasswordRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    test('rejects invalid email', () => {
      const invalidData = {
        email: 'not-an-email',
      };

      const result = ResetPasswordRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('ResetPasswordSchema', () => {
    test('validates correct reset password data', () => {
      const validData = {
        token: 'valid-token-string',
        password: 'NewPass123!',
      };

      const result = ResetPasswordSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    test('rejects weak password', () => {
      const invalidData = {
        token: 'valid-token-string',
        password: 'weak',
      };

      const result = ResetPasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    test('rejects password without special character', () => {
      const invalidData = {
        token: 'valid-token-string',
        password: 'ValidPass123',
      };

      const result = ResetPasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    test('rejects token exceeding max length', () => {
      const invalidData = {
        token: 'x'.repeat(501),
        password: 'ValidPass123!',
      };

      const result = ResetPasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('ChangePasswordSchema', () => {
    test('validates correct password change data', () => {
      const validData = {
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass123!',
      };

      const result = ChangePasswordSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    test('rejects weak new password', () => {
      const invalidData = {
        currentPassword: 'OldPass123!',
        newPassword: 'weak',
      };

      const result = ChangePasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    test('rejects new password without special character', () => {
      const invalidData = {
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass123',
      };

      const result = ChangePasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    test('rejects new password shorter than 10 characters', () => {
      const invalidData = {
        currentPassword: 'OldPass123!',
        newPassword: 'New1!',
      };

      const result = ChangePasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
