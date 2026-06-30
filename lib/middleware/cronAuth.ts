/**
 * Cron Job Authentication Middleware
 * Protects cron endpoints from unauthorized access
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateCronSecret } from '../config/validateSecrets';
import { logger } from '../middleware/logger';

/**
 * Middleware to protect cron endpoints.
 * Validates the CRON_SECRET from Authorization header.
 * @param req - The incoming request.
 * @param handler - The handler to call if authentication succeeds.
 * @returns The response from the handler or an error response.
 */
export async function requireCronAuth(
  req: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    // Get the Authorization header
    const authHeader = req.headers.get('authorization');

    // Extract the token
    let token: string | null = null;
    if (authHeader) {
      // Support both "Bearer TOKEN" and just "TOKEN" formats
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else {
        token = authHeader;
      }
    }

    // Validate the token
    const isValid = validateCronSecret(token);

    if (!isValid) {
      logger.warn('Unauthorized cron access attempt', {
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        userAgent: req.headers.get('user-agent'),
        path: new URL(req.url).pathname,
      });

      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Invalid or missing cron authentication token',
        },
        { status: 401 },
      );
    }

    // Authentication successful, proceed with handler
    return await handler(req);
  } catch (error) {
    logger.error('Error in cron authentication:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'Authentication error',
      },
      { status: 500 },
    );
  }
}

/**
 * Helper to check if request has valid cron authentication.
 * @param req - NextRequest object.
 * @returns true if authenticated, false otherwise.
 */
export function isAuthorizedCronRequest(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');

  let token: string | null = null;
  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = authHeader;
    }
  }

  return validateCronSecret(token);
}
