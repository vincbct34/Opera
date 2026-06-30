import { useState, useCallback } from 'react';
import {
  loginRateLimiter,
  sanitizeInput,
  isValidEmail,
  isValidPassword,
  detectSuspiciousInput,
  logSuspiciousActivity,
} from '@/lib/security/securityUtils';

/**
 * Props for the useSecureForm hook.
 */
interface UseSecureFormProps {
  /** Function to call when form is submitted successfully */
  onSubmit: (data: { email: string; password: string }) => Promise<void>;
  /** Unique identifier for rate limiting (optional) */
  identifier?: string; // For rate limiting (default uses simulated IP)
}

/**
 * Custom hook for handling secure form submissions.
 * Includes rate limiting, input sanitization, and suspicious activity detection.
 * @param props - Hook configuration properties.
 * @returns Form handling functions and state.
 */
export function useSecureForm({ onSubmit, identifier }: UseSecureFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitRemaining, setRateLimitRemaining] = useState(0);

  const handleSubmit = useCallback(
    async (formData: { email: string; password: string }) => {
      const key = identifier || 'default';

      // Check rate limiting
      if (!loginRateLimiter.canAttempt(key)) {
        const remainingTime = loginRateLimiter.getRemainingTime(key);
        setRateLimitRemaining(remainingTime);
        setError(`Trop de tentatives. Réessayez dans ${Math.ceil(remainingTime / 60000)} minutes.`);
        return;
      }

      // Sanitize inputs
      const sanitizedEmail = sanitizeInput(formData.email.toLowerCase());
      const sanitizedPassword = sanitizeInput(formData.password);

      // Detect suspicious inputs
      if (detectSuspiciousInput(sanitizedEmail)) {
        logSuspiciousActivity("Tentative d'injection détectée", {
          email: sanitizedEmail,
          timestamp: new Date().toISOString(),
        });
        loginRateLimiter.recordAttempt(key, true);
        setError('Données invalides détectées.');
        return;
      }

      // Validate data
      if (!isValidEmail(sanitizedEmail)) {
        setError("Format d'email invalide.");
        return;
      }

      if (!isValidPassword(sanitizedPassword)) {
        setError('Le mot de passe doit contenir entre 10 et 128 caractères.');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        await onSubmit({
          email: sanitizedEmail,
          password: sanitizedPassword,
        });

        // Success - reset rate limiter
        loginRateLimiter.recordAttempt(key, false);
        setRateLimitRemaining(0);
      } catch (err) {
        // Failure - record attempt
        loginRateLimiter.recordAttempt(key, true);

        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Une erreur est survenue lors de la connexion.');
        }

        // Check if we've reached the limit
        if (!loginRateLimiter.canAttempt(key)) {
          const remainingTime = loginRateLimiter.getRemainingTime(key);
          setRateLimitRemaining(remainingTime);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [onSubmit, identifier],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    handleSubmit,
    isLoading,
    error,
    rateLimitRemaining,
    clearError,
  };
}
