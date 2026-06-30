/**
 * Environment Secrets Validation
 * Validates that all required security secrets are present at startup
 * Prevents the application from starting with missing or empty secrets
 */

import { logger } from '../middleware/logger';

/**
 * Interface defining the validation rules for a secret.
 */
interface SecretValidation {
  name: string;
  value: string | undefined;
  required: boolean;
  minLength?: number;
}

/**
 * Validate all required environment secrets.
 * Checks for presence, minimum length, and weak values in production.
 * @throws Error if any required secret is missing or invalid.
 */
export function validateSecrets(): void {
  const secrets: SecretValidation[] = [
    {
      name: 'ACCESS_TOKEN_SECRET',
      value: process.env.ACCESS_TOKEN_SECRET,
      required: true,
      minLength: 32,
    },
    {
      name: 'JWT_REFRESH_SECRET',
      value: process.env.JWT_REFRESH_SECRET,
      required: true,
      minLength: 32,
    },
    {
      name: 'DATABASE_URL',
      value: process.env.DATABASE_URL,
      required: true,
    },
    {
      name: 'SMTP2GO_API_KEY',
      value: process.env.SMTP2GO_API_KEY,
      required: true,
    },
    {
      name: 'CRON_SECRET',
      value: process.env.CRON_SECRET,
      required: process.env.NODE_ENV === 'production',
      minLength: 32,
    },
  ];

  const errors: string[] = [];
  const warnings: string[] = [];

  for (const secret of secrets) {
    // Check if required secret is missing
    if (secret.required && !secret.value) {
      errors.push(`❌ Required secret "${secret.name}" is missing or empty`);
      continue;
    }

    // Skip further checks if not required and not present
    if (!secret.required && !secret.value) {
      warnings.push(`⚠️  Optional secret "${secret.name}" is not set`);
      continue;
    }

    // Check minimum length if specified
    if (secret.minLength && secret.value && secret.value.length < secret.minLength) {
      errors.push(
        `❌ Secret "${secret.name}" is too short (minimum ${secret.minLength} characters required)`,
      );
    }
  }

  // Check for development-only weak secrets in production
  if (process.env.NODE_ENV === 'production') {
    const weakSecrets = ['secret', 'password', '123456', 'admin', 'test', 'changeme', 'default'];

    for (const secret of secrets) {
      if (secret.value) {
        const lowerValue = secret.value.toLowerCase();
        if (weakSecrets.some((weak) => lowerValue.includes(weak))) {
          errors.push(
            `❌ CRITICAL: Secret "${secret.name}" contains a weak/common value in production. This is a security risk.`,
          );
        }
      }
    }
  }

  // Log warnings
  if (warnings.length > 0) {
    logger.warn('Secret validation warnings:');
    warnings.forEach((warning) => logger.warn(warning));
  }

  // Fail fast on errors
  if (errors.length > 0) {
    logger.error('Secret validation failed:');
    errors.forEach((error) => logger.error(error));
    throw new Error(
      `Application startup failed: ${errors.length} required secret(s) are missing or invalid. Check your environment variables.`,
    );
  }

  // Log success
  logger.info(
    `✅ All ${secrets.filter((s) => s.required).length} required secrets validated successfully`,
  );

  // Require Redis in production for distributed deployments
  if (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL) {
    errors.push(
      '❌ CRITICAL: REDIS_URL is REQUIRED in production. CSRF tokens and rate limiting MUST be shared across server instances. In-memory storage is NOT suitable for load-balanced deployments.',
    );
  }

  // Re-throw if errors were added (Redis check)
  if (errors.length > 0) {
    logger.error('Secret validation failed:');
    errors.forEach((error) => logger.error(error));
    throw new Error(
      `Application startup failed: ${errors.length} validation error(s). Check your environment variables.`,
    );
  }
}

/**
 * Validate secrets for specific operations
 */
export function validateCronSecret(providedSecret: string | null): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // In development, allow access without secret (but warn)
  if (process.env.NODE_ENV !== 'production' && !cronSecret) {
    logger.warn('CRON_SECRET not set in development - allowing access');
    return true;
  }

  // In production, require secret
  if (!cronSecret) {
    logger.error('CRON_SECRET is not configured');
    return false;
  }

  if (!providedSecret) {
    logger.warn('Cron request missing secret');
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(providedSecret, cronSecret);
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
