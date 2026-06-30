/**
 * Utility to centralize base URL selection for server and client code.
 * - Server: prefer APP_URL (server-only). Fallback to NEXT_PUBLIC_BASE_URL then localhost in dev.
 * - Client: if needed, use NEXT_PUBLIC_BASE_URL or relative paths.
 * @returns The base URL string.
 */
export function getServerBaseUrl(): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';

  // In production, APP_URL must be set
  if (isProduction && !process.env.APP_URL) {
    throw new Error('APP_URL must be defined in production environment');
  }

  // In test environment, use a default test URL
  if (isTest) {
    return process.env.APP_URL || 'http://localhost:3000';
  }

  return process.env.APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

export default getServerBaseUrl;
