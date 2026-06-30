import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { generateCSRFToken } from '@/lib/auth/csrfProtection';
// Read JWT secrets directly from environment
import { logger } from '@/lib/middleware/logger';

/**
 * GET endpoint to retrieve a CSRF token.
 * The token is tied to the user's session/ID if authenticated,
 * or to their IP address if not authenticated.
 * @param req - The incoming request.
 * @returns JSON response with the CSRF token.
 */
export async function GET(req: NextRequest) {
  try {
    let identifier: string;

    // Try to get user ID from JWT token if authenticated
    const authHeader = req.headers.get('authorization');

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const accessSecret = process.env.ACCESS_TOKEN_SECRET || '';
        const decoded = jwt.verify(token, accessSecret) as { id: string };
        identifier = decoded.id;
      } catch {
        // If token is invalid, fall back to IP-based identifier
        identifier = getClientIdentifier(req);
      }
    } else {
      // For unauthenticated users, use IP-based identifier
      identifier = getClientIdentifier(req);
    }

    // Generate CSRF token
    const csrfToken = await generateCSRFToken(identifier);

    return NextResponse.json({ csrfToken }, { status: 200 });
  } catch (error) {
    logger.error('Error generating CSRF token:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du token CSRF' },
      { status: 500 },
    );
  }
}

/**
 * Get a unique identifier for the client based on IP and User-Agent.
 * @param req - The incoming request.
 * @returns A unique identifier string.
 */
function getClientIdentifier(req: NextRequest): string {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  return `${ip}:${userAgent}`;
}
