import { NextRequest, NextResponse } from 'next/server';
import { logger } from './lib/middleware/logger';

/**
 * Global middleware for CORS configuration
 * This middleware runs before all routes to ensure proper CORS headers
 */
export function proxy(request: NextRequest) {
  const origin = request.headers.get('origin');
  const response = NextResponse.next();

  if (process.env.SITE_NOINDEX === 'true') {
    response.headers.set('X-Robots-Tag', 'noindex, follow');
  }

  // Define allowed origins based on environment
  const allowedOrigins = getAllowedOrigins();

  // Determine if origin is allowed (normalize for comparison)
  const isOriginAllowed = origin ? allowedOrigins.includes(origin) : true; // No origin = same-origin = allowed

  // Log CORS check for debugging (only in production for problematic requests)
  if (process.env.NODE_ENV === 'production' && origin && !isOriginAllowed) {
    logger.warn(`CORS block - Origin: "${origin}", Allowed: [${allowedOrigins.join(', ')}]`, {
      path: request.nextUrl.pathname,
      method: request.method,
    });
  }

  // Add CORS headers if origin is allowed
  if (origin && isOriginAllowed) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-CSRF-Token, X-Requested-With',
    );
    response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
  }

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    // Block preflight if origin is not allowed
    if (origin && !isOriginAllowed) {
      return new NextResponse(
        JSON.stringify({
          error: 'Origin not allowed',
          message: 'CORS policy: This origin is not allowed to access this resource',
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }
    return new NextResponse(null, {
      status: 204,
      headers: response.headers,
    });
  }

  // Block requests from unauthorized origins for API routes
  if (request.nextUrl.pathname.startsWith('/api')) {
    if (origin && !isOriginAllowed) {
      return new NextResponse(
        JSON.stringify({
          error: 'Origin not allowed',
          message: 'CORS policy: This origin is not allowed to access this resource',
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }
  }

  return response;
}

/**
 * Get allowed origins based on environment
 * Normalizes origins by removing trailing slashes and extra whitespace
 */
function getAllowedOrigins(): string[] {
  const nodeEnv = process.env.NODE_ENV;

  // Development environment - allow localhost on various ports
  if (nodeEnv === 'development' || nodeEnv === 'test') {
    return ['http://localhost:3000', 'http://127.0.0.1:3000'];
  }

  // Production environment - only allow specific domain(s)
  const rawOrigins = process.env.ALLOWED_ORIGINS;

  if (!rawOrigins || rawOrigins.trim() === '') {
    // Log warning if ALLOWED_ORIGINS is not configured in production
    logger.error(
      'ALLOWED_ORIGINS environment variable is not set in production! Using placeholder domains.',
    );
    return ['https://placeholder.fr', 'https://www.placeholder.fr'];
  }

  const productionOrigins = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
    .map((origin) => origin.replace(/\/$/, '')); // Remove trailing slash

  // Log the configured origins for debugging
  if (process.env.DEBUG_CORS === 'true') {
    logger.info(`CORS allowed origins: [${productionOrigins.join(', ')}]`);
  }

  return productionOrigins;
}

/**
 * Configure which paths the middleware should run on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     * - monitoring (Sentry tunnel route)
     */
    '/((?!_next/static|_next/image|favicon.ico|monitoring|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
