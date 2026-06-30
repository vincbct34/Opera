/**
 * Next.js Instrumentation
 * This file runs once when the server starts
 * Used for initialization tasks like secret validation
 */

export async function register() {
  // Only run on server-side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateSecrets } = await import('./lib/config/validateSecrets');
    const { logger } = await import('./lib/middleware/logger');

    try {
      // Validate all required secrets at startup
      validateSecrets();
    } catch (error) {
      // Log error and exit if secrets are invalid
      logger.error('Failed to start application:', error);
      process.exit(1);
    }
  }
}
