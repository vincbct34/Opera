/**
 * Secure Cookie Configuration Utilities
 * Ensures cookies are properly secured in production environments
 */

/**
 * Options for configuring a secure cookie.
 */
export interface SecureCookieOptions {
  name: string;
  value: string;
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  maxAge?: number;
  path?: string;
}

/**
 * Get secure cookie configuration.
 * Forces secure flag in production, allows HTTP in development.
 * @param options - The cookie options.
 * @returns The configured cookie object.
 */
export function getSecureCookieConfig(options: SecureCookieOptions) {
  const isProduction = process.env.NODE_ENV === 'production';
  const isSecureContext = process.env.FORCE_HTTPS === 'true' || isProduction;

  return {
    name: options.name,
    value: options.value,
    httpOnly: options.httpOnly ?? true,
    secure: isSecureContext, // Always secure in production
    sameSite: options.sameSite ?? 'strict',
    maxAge: options.maxAge,
    path: options.path ?? '/',
  };
}

/**
 * Helper function to check if environment is production.
 * Exported for testing purposes.
 * @returns true if NODE_ENV is 'production'.
 */
export function checkIsProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Helper function to validate protocol security.
 * Exported for testing purposes.
 * @param proto - The protocol string (e.g., 'http', 'https').
 * @param isProduction - Whether the environment is production.
 * @returns true if the protocol is secure for the environment.
 */
export function validateProtocolSecurity(proto: string | null, isProduction: boolean): boolean {
  // In production, require HTTPS
  if (isProduction && proto !== 'https') {
    return false;
  }
  return true;
}

/**
 * Validate that we're in a secure context for sensitive operations.
 * Checks x-forwarded-proto header in production.
 * @param request - The incoming request.
 * @returns true if the context is secure.
 */
export function isSecureContext(request: Request): boolean {
  const proto = request.headers.get('x-forwarded-proto');
  const isProduction = checkIsProduction();

  return validateProtocolSecurity(proto, isProduction);
}
