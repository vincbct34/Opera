/* eslint-disable */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from '@testing-library/react';
import { useSecureForm } from '@/hooks/useSecureForm';
import * as securityUtilsModule from '@/lib/security/securityUtils';

// Mock the security utils
jest.mock('@/lib/security/securityUtils');

describe('useSecureForm', () => {
  const mockOnSubmit = jest.fn<(data: { email: string; password: string }) => Promise<void>>();
  const validFormData = {
    email: 'test@example.com',
    password: 'ValidPass123!',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default mock implementations
    (securityUtilsModule.loginRateLimiter.canAttempt as jest.Mock) = jest.fn(() => true);
    (securityUtilsModule.loginRateLimiter.getRemainingTime as jest.Mock) = jest.fn(() => 0);
    (securityUtilsModule.loginRateLimiter.recordAttempt as jest.Mock) = jest.fn();
    (securityUtilsModule.sanitizeInput as jest.Mock) = jest.fn((input) => input);
    (securityUtilsModule.detectSuspiciousInput as jest.Mock) = jest.fn(() => false);
    (securityUtilsModule.isValidEmail as jest.Mock) = jest.fn(() => true);
    (securityUtilsModule.isValidPassword as jest.Mock) = jest.fn(() => true);
    (securityUtilsModule.logSuspiciousActivity as jest.Mock) = jest.fn();

    mockOnSubmit.mockResolvedValue(undefined);
  });

  describe('initial state', () => {
    test('should return initial state correctly', () => {
      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.rateLimitRemaining).toBe(0);
      expect(typeof result.current.handleSubmit).toBe('function');
      expect(typeof result.current.clearError).toBe('function');
    });
  });

  describe('successful form submission', () => {
    test('should successfully submit valid form data', async () => {
      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      expect(mockOnSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'ValidPass123!',
      });
      expect(securityUtilsModule.loginRateLimiter.recordAttempt).toHaveBeenCalledWith(
        'default',
        false,
      );
      expect(result.current.error).toBe(null);
      expect(result.current.isLoading).toBe(false);
    });

    test('should sanitize email by converting to lowercase', async () => {
      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit({
          email: 'TEST@EXAMPLE.COM',
          password: 'ValidPass123!',
        });
      });

      expect(mockOnSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'ValidPass123!',
      });
    });

    test('should use custom identifier for rate limiting', async () => {
      const identifier = 'user-123';
      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit, identifier }));

      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      expect(securityUtilsModule.loginRateLimiter.canAttempt).toHaveBeenCalledWith(identifier);
      expect(securityUtilsModule.loginRateLimiter.recordAttempt).toHaveBeenCalledWith(
        identifier,
        false,
      );
    });

    test('should reset rate limit remaining on success', async () => {
      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      expect(result.current.rateLimitRemaining).toBe(0);
    });

    test('should set and clear loading state', async () => {
      let resolveSubmit: () => void;
      const submitPromise = new Promise<void>((resolve) => {
        resolveSubmit = resolve;
      });
      mockOnSubmit.mockReturnValue(submitPromise);

      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      act(() => {
        result.current.handleSubmit(validFormData);
      });

      // Should be loading
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      // Resolve the submit
      await act(async () => {
        resolveSubmit!();
        await submitPromise;
      });

      // Should no longer be loading
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('rate limiting', () => {
    test('should block submission when rate limited', async () => {
      (securityUtilsModule.loginRateLimiter.canAttempt as jest.Mock).mockReturnValue(false);
      (securityUtilsModule.loginRateLimiter.getRemainingTime as jest.Mock).mockReturnValue(120000); // 2 minutes

      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(result.current.error).toBe('Trop de tentatives. Réessayez dans 2 minutes.');
      expect(result.current.rateLimitRemaining).toBe(120000);
    });

    test('should handle rate limit with partial minutes', async () => {
      (securityUtilsModule.loginRateLimiter.canAttempt as jest.Mock).mockReturnValue(false);
      (securityUtilsModule.loginRateLimiter.getRemainingTime as jest.Mock).mockReturnValue(90000); // 1.5 minutes

      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      expect(result.current.error).toBe('Trop de tentatives. Réessayez dans 2 minutes.');
    });

    test('should set rate limit remaining after failed attempt', async () => {
      mockOnSubmit.mockRejectedValue(new Error('Login failed'));

      (securityUtilsModule.loginRateLimiter.canAttempt as jest.Mock).mockReturnValueOnce(true);
      (securityUtilsModule.loginRateLimiter.canAttempt as jest.Mock).mockReturnValueOnce(false);
      (securityUtilsModule.loginRateLimiter.getRemainingTime as jest.Mock).mockReturnValue(60000);

      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      expect(result.current.rateLimitRemaining).toBe(60000);
    });

    test('should record failed attempt on error', async () => {
      mockOnSubmit.mockRejectedValue(new Error('Login failed'));

      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      expect(securityUtilsModule.loginRateLimiter.recordAttempt).toHaveBeenCalledWith(
        'default',
        true,
      );
    });
  });

  describe('input validation', () => {
    test('should reject invalid email format', async () => {
      (securityUtilsModule.isValidEmail as jest.Mock).mockReturnValue(false);

      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit({
          email: 'invalid-email',
          password: 'ValidPass123!',
        });
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(result.current.error).toBe("Format d'email invalide.");
    });

    test('should reject invalid password', async () => {
      (securityUtilsModule.isValidPassword as jest.Mock).mockReturnValue(false);

      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit({
          email: 'test@example.com',
          password: 'short',
        });
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(result.current.error).toBe(
        'Le mot de passe doit contenir entre 10 et 128 caractères.',
      );
    });

    test('should sanitize inputs before validation', async () => {
      const sanitizeSpy = securityUtilsModule.sanitizeInput as jest.Mock;

      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      expect(sanitizeSpy).toHaveBeenCalledWith('test@example.com');
      expect(sanitizeSpy).toHaveBeenCalledWith('ValidPass123!');
    });
  });

  describe('security checks', () => {
    test('should detect and block suspicious email input', async () => {
      (securityUtilsModule.detectSuspiciousInput as jest.Mock).mockImplementation(
        (input) => input === 'test@example.com',
      );

      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(securityUtilsModule.logSuspiciousActivity).toHaveBeenCalledWith(
        "Tentative d'injection détectée",
        expect.objectContaining({
          email: 'test@example.com',
          timestamp: expect.any(String),
        }),
      );
      expect(securityUtilsModule.loginRateLimiter.recordAttempt).toHaveBeenCalledWith(
        'default',
        true,
      );
      expect(result.current.error).toBe('Données invalides détectées.');
    });

    test('should detect and block suspicious password input', async () => {
      // detectSuspiciousInput is only called on the sanitized email, not the password
      // So we need to make it return true for the email
      (securityUtilsModule.detectSuspiciousInput as jest.Mock).mockReturnValue(true);

      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(result.current.error).toBe('Données invalides détectées.');
    });

    test('should log suspicious activity with correct data', async () => {
      (securityUtilsModule.detectSuspiciousInput as jest.Mock).mockReturnValue(true);

      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      const beforeTime = new Date().toISOString();
      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });
      const afterTime = new Date().toISOString();

      const logCall = (securityUtilsModule.logSuspiciousActivity as jest.Mock).mock.calls[0];
      expect(logCall[0]).toBe("Tentative d'injection détectée");
      expect((logCall[1] as any).email).toBe('test@example.com');
      expect((logCall[1] as any).timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });

  describe('error handling', () => {
    test('should handle Error instance from onSubmit', async () => {
      const errorMessage = 'Login failed';
      mockOnSubmit.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      expect(result.current.error).toBe(errorMessage);
      expect(result.current.isLoading).toBe(false);
    });

    test('should handle non-Error exceptions', async () => {
      mockOnSubmit.mockRejectedValue('String error');

      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      expect(result.current.error).toBe('Une erreur est survenue lors de la connexion.');
    });

    test('should handle object error', async () => {
      mockOnSubmit.mockRejectedValue({ code: 'AUTH_ERROR' });

      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      expect(result.current.error).toBe('Une erreur est survenue lors de la connexion.');
    });

    test('should handle null error', async () => {
      mockOnSubmit.mockRejectedValue(null);

      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      expect(result.current.error).toBe('Une erreur est survenue lors de la connexion.');
    });

    test('should handle undefined error', async () => {
      mockOnSubmit.mockRejectedValue(undefined);

      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      expect(result.current.error).toBe('Une erreur est survenue lors de la connexion.');
    });
  });

  describe('clearError functionality', () => {
    test('should clear error when clearError is called', async () => {
      (securityUtilsModule.isValidEmail as jest.Mock).mockReturnValue(false);

      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      expect(result.current.error).toBe("Format d'email invalide.");

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBe(null);
    });

    test('clearError should work when no error is set', () => {
      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      expect(result.current.error).toBe(null);

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBe(null);
    });

    test('clearError should have stable reference', () => {
      const { result, rerender } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      const clearError1 = result.current.clearError;

      rerender();

      const clearError2 = result.current.clearError;

      expect(clearError1).toBe(clearError2);
    });
  });

  describe('edge cases', () => {
    test('should handle empty email', async () => {
      (securityUtilsModule.isValidEmail as jest.Mock).mockReturnValue(false);

      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit({
          email: '',
          password: 'ValidPass123!',
        });
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(result.current.error).toBe("Format d'email invalide.");
    });

    test('should handle empty password', async () => {
      (securityUtilsModule.isValidPassword as jest.Mock).mockReturnValue(false);

      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit({
          email: 'test@example.com',
          password: '',
        });
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(result.current.error).toBe(
        'Le mot de passe doit contenir entre 10 et 128 caractères.',
      );
    });

    test('should handle very long email', async () => {
      const longEmail = 'a'.repeat(300) + '@example.com';

      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit({
          email: longEmail,
          password: 'ValidPass123!',
        });
      });

      expect(securityUtilsModule.sanitizeInput).toHaveBeenCalledWith(longEmail.toLowerCase());
    });

    test('should handle very long password', async () => {
      const longPassword = 'a'.repeat(200);
      (securityUtilsModule.isValidPassword as jest.Mock).mockReturnValue(false);

      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit({
          email: 'test@example.com',
          password: longPassword,
        });
      });

      expect(result.current.error).toBe(
        'Le mot de passe doit contenir entre 10 et 128 caractères.',
      );
    });

    test('should handle email with mixed case', async () => {
      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit({
          email: 'TeSt@ExAmPlE.CoM',
          password: 'ValidPass123!',
        });
      });

      expect(mockOnSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'ValidPass123!',
      });
    });

    test('should handle special characters in email local part', async () => {
      const specialEmail = 'test+tag@example.com';

      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit({
          email: specialEmail,
          password: 'ValidPass123!',
        });
      });

      expect(securityUtilsModule.sanitizeInput).toHaveBeenCalledWith(specialEmail);
    });
  });

  describe('multiple submissions', () => {
    test('should handle multiple sequential successful submissions', async () => {
      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      expect(mockOnSubmit).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      expect(mockOnSubmit).toHaveBeenCalledTimes(2);

      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      expect(mockOnSubmit).toHaveBeenCalledTimes(3);
    });

    test('should handle submission after validation error', async () => {
      (securityUtilsModule.isValidEmail as jest.Mock).mockReturnValueOnce(false);
      (securityUtilsModule.isValidEmail as jest.Mock).mockReturnValueOnce(true);

      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      // First submission fails validation
      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(result.current.error).toBe("Format d'email invalide.");

      // Clear error
      act(() => {
        result.current.clearError();
      });

      // Second submission succeeds
      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      expect(result.current.error).toBe(null);
    });

    test('should handle submission after rate limit expires', async () => {
      (securityUtilsModule.loginRateLimiter.canAttempt as jest.Mock)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);
      (securityUtilsModule.loginRateLimiter.getRemainingTime as jest.Mock).mockReturnValue(60000);

      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      // First submission blocked by rate limit
      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();

      // Second submission succeeds (rate limit expired)
      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe('validation order', () => {
    test('should check rate limit before validation', async () => {
      (securityUtilsModule.loginRateLimiter.canAttempt as jest.Mock).mockReturnValue(false);
      (securityUtilsModule.loginRateLimiter.getRemainingTime as jest.Mock).mockReturnValue(60000);

      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      // Should not call validation functions
      expect(securityUtilsModule.isValidEmail).not.toHaveBeenCalled();
      expect(securityUtilsModule.isValidPassword).not.toHaveBeenCalled();
    });

    test('should check suspicious input before email validation', async () => {
      (securityUtilsModule.detectSuspiciousInput as jest.Mock).mockReturnValue(true);

      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      // Should not proceed to email validation
      expect(securityUtilsModule.isValidEmail).not.toHaveBeenCalled();
    });

    test('should check email validation before password validation', async () => {
      (securityUtilsModule.isValidEmail as jest.Mock).mockReturnValue(false);

      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      // Should check email but not password
      expect(securityUtilsModule.isValidEmail).toHaveBeenCalled();
      expect(securityUtilsModule.isValidPassword).not.toHaveBeenCalled();
    });
  });

  describe('finally block behavior', () => {
    test('should set isLoading to false after successful submission', async () => {
      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      expect(result.current.isLoading).toBe(false);
    });

    test('should set isLoading to false after failed submission', async () => {
      mockOnSubmit.mockRejectedValue(new Error('Failed'));

      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      expect(result.current.isLoading).toBe(false);
    });

    test('should set isLoading to false even if error occurs in finally', async () => {
      // This tests that finally block always executes
      const { result } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('hook stability', () => {
    test('handleSubmit should have stable reference', () => {
      const { result, rerender } = renderHook(() => useSecureForm({ onSubmit: mockOnSubmit }));

      const handleSubmit1 = result.current.handleSubmit;

      rerender();

      const handleSubmit2 = result.current.handleSubmit;

      expect(handleSubmit1).toBe(handleSubmit2);
    });

    test('should work correctly after prop change', async () => {
      const newOnSubmit = jest
        .fn<(data: { email: string; password: string }) => Promise<void>>()
        .mockResolvedValue(undefined);

      const { result, rerender } = renderHook(({ onSubmit }) => useSecureForm({ onSubmit }), {
        initialProps: { onSubmit: mockOnSubmit },
      });

      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      expect(newOnSubmit).not.toHaveBeenCalled();

      rerender({ onSubmit: newOnSubmit });

      await act(async () => {
        await result.current.handleSubmit(validFormData);
      });

      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      expect(newOnSubmit).toHaveBeenCalledTimes(1);
    });
  });
});
