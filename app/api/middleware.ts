import { NextRequest, NextResponse } from 'next/server';

import jwt from 'jsonwebtoken';

import { Role } from '@/app/generated/prisma';
import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';
import { validateCSRFToken } from '@/lib/auth/csrfProtection';
import {
  checkRateLimit,
  getClientIdentifier as getClientId,
  RATE_LIMIT_CONFIGS,
} from '@/lib/middleware/serverRateLimit';
// Read JWT secrets directly from environment

// Interface for authenticated requests
export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string;
    role: Role;
    institution_ids: string[]; // Changed to support multiple institutions
  };
}

// Interface for middleware options
export interface MiddlewareOptions {
  requireAuth?: boolean;
  requiredRoles?: Role[];
  allowSameUser?: boolean;
  requireEmailVerification?: boolean;
  requireCSRF?: boolean; // New option for CSRF protection
  enableRateLimit?: boolean; // New option for rate limiting
  rateLimitConfig?: keyof typeof RATE_LIMIT_CONFIGS; // Which rate limit config to use
}

/**
 * Authentication and authorization middleware for API routes
 * @param options Configuration options for the middleware
 * @returns Middleware function that can be used in API routes
 */
export function createAuthMiddleware(options: MiddlewareOptions = {}) {
  const {
    requireAuth = true,
    requiredRoles = [],
    allowSameUser = false,
    requireEmailVerification = false,
    requireCSRF = true, // Default to true for security
    enableRateLimit = true, // Enable by default
    rateLimitConfig = 'api', // Default to general API limits
  } = options; // Default options if not provided

  return async (
    req: AuthenticatedRequest,
    handler: (req: AuthenticatedRequest) => Promise<NextResponse>,
  ): Promise<NextResponse> => {
    try {
      const method = req.method;

      // Rate Limiting - check early to prevent wasted processing
      if (enableRateLimit) {
        const clientId = getClientId(req);
        const rateLimitResult = await checkRateLimit(clientId, RATE_LIMIT_CONFIGS[rateLimitConfig]);

        if (!rateLimitResult.success) {
          return NextResponse.json(
            {
              error: 'Trop de requêtes. Veuillez patienter.',
              resetAt: rateLimitResult.resetAt,
              remaining: rateLimitResult.remaining,
            },
            {
              status: 429,
              headers: {
                'X-RateLimit-Limit': RATE_LIMIT_CONFIGS[rateLimitConfig].maxAttempts.toString(),
                'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
                'X-RateLimit-Reset': rateLimitResult.resetAt.toString(),
              },
            },
          );
        }
      }

      // CSRF Protection for state-changing methods
      if (requireCSRF && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        const csrfToken = req.headers.get('x-csrf-token');

        // Get identifier for CSRF validation
        let identifier: string;
        const authHeader = req.headers.get('authorization');

        if (authHeader?.startsWith('Bearer ')) {
          const token = authHeader.split(' ')[1];
          try {
            const accessSecret = process.env.ACCESS_TOKEN_SECRET || '';
            const decoded = jwt.verify(token, accessSecret) as { id: string };
            identifier = decoded.id;
          } catch {
            // If token is invalid, use IP-based identifier
            identifier = getClientIdentifier(req);
          }
        } else {
          identifier = getClientIdentifier(req);
        }

        // Validate CSRF token
        const isValidCSRF = await validateCSRFToken(csrfToken, identifier);
        if (!isValidCSRF) {
          return NextResponse.json(
            {
              error: 'Token CSRF invalide ou expiré',
              code: 'CSRF_TOKEN_INVALID',
              message: 'Veuillez rafraîchir la page et réessayer',
            },
            { status: 403 },
          );
        }
      }

      // Get the Authorization header
      const authHeader = req.headers.get('authorization');

      // If authentication is required, check for Bearer token
      if (requireAuth && !authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: "Token d'authentification requis" }, { status: 401 });
      }

      // If Bearer token is present, extract it
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];

        try {
          // Verify the JWT token
          const accessSecret = process.env.ACCESS_TOKEN_SECRET || '';
          const decoded = jwt.verify(token, accessSecret) as {
            id: string;
            email: string;
            role: Role;
            institution_ids: string[];
          };

          // Fetch user from database to ensure they still exist and get latest data
          const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
              role: true,
              lastActivity: true,
              userInstitutions: {
                select: {
                  institution_id: true,
                },
              },
              email_verification_token: requireEmailVerification,
            },
          });

          // If user not found, return 401
          if (!user) {
            return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 401 });
          }

          // Check session timeout (30 minutes of inactivity)
          const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
          if (user.lastActivity) {
            const timeSinceLastActivity = Date.now() - new Date(user.lastActivity).getTime();
            if (timeSinceLastActivity > SESSION_TIMEOUT_MS) {
              return NextResponse.json(
                {
                  error: "Session expirée en raison d'inactivité",
                  code: 'SESSION_EXPIRED',
                },
                { status: 401 },
              );
            }
          }

          // Update last activity timestamp
          await prisma.user.update({
            where: { id: user.id },
            data: { lastActivity: new Date() },
          });

          // Check email verification if required
          if (requireEmailVerification && user.email_verification_token) {
            return NextResponse.json(
              {
                error: 'Veuillez vérifier votre adresse email pour accéder à cette ressource',
                code: 'EMAIL_NOT_VERIFIED',
              },
              { status: 403 },
            );
          }

          // Attach user to request with institution_ids
          req.user = {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role,
            institution_ids: user.userInstitutions.map((ui) => ui.institution_id),
          };

          // Check role-based permissions
          if (requiredRoles.length > 0) {
            const hasRequiredRole = requiredRoles.includes(user.role);

            if (!hasRequiredRole) {
              // When user does not have required role, check if allowSameUser is true, if so check if user is accessing their own resource
              if (allowSameUser) {
                const userId = extractUserIdFromUrl(req.url);
                if (userId && userId === user.id) {
                  // User can access their own resources
                } else {
                  // User does not have required role and is not accessing their own resource
                  return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 });
                }
              } else {
                // User does not have required role and allowSameUser is false
                return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 });
              }
            }
          }
        } catch {
          // If token verification fails, return 401
          return NextResponse.json({ error: 'Token invalide' }, { status: 401 });
        }
      } else if (requireAuth) {
        // If authentication is required but no token is provided, return 401
        return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
      }

      // Call the actual handler
      return await handler(req);
    } catch (error) {
      // Handle any unexpected errors
      logger.error('Middleware error:', ...sanitizeLogArgs(error));
      return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
    }
  };
}

/**
 * Extract user ID from URL path (for same-user access control)
 * Assumes URLs like /api/users/[id] or /api/user/[id]/something
 */
function extractUserIdFromUrl(url: string): string | null {
  const urlObj = new URL(url);
  const pathSegments = urlObj.pathname.split('/').filter(Boolean);

  // Look for patterns like /api/users/[id] or /api/user/[id]
  const userIndex = pathSegments.findIndex((segment) => segment === 'user' || segment === 'users');

  if (userIndex !== -1 && pathSegments[userIndex + 1]) {
    return pathSegments[userIndex + 1];
  }

  return null;
}

/**
 * Convenience middleware for routes that require authentication
 */
export const requireAuth = createAuthMiddleware({ requireAuth: true });

/**
 * Convenience middleware for routes that require admin role
 */
export const requireAdmin = createAuthMiddleware({
  requireAuth: true,
  requiredRoles: [Role.ADMIN, Role.SUPERADMIN],
  rateLimitConfig: 'sensitive', // Stricter limits for admin actions
});

export const requireSuperAdmin = createAuthMiddleware({
  requireAuth: true,
  requiredRoles: [Role.SUPERADMIN],
  rateLimitConfig: 'sensitive',
});

/**
 * Convenience middleware for routes that allow user or admin access
 */
export const requireUserOrAdmin = createAuthMiddleware({
  requireAuth: true,
  requiredRoles: [Role.USER, Role.ADMIN, Role.SUPERADMIN],
});

/**
 * Convenience middleware for routes that require admin or same user access
 */
export const requireAdminOrSameUser = createAuthMiddleware({
  requireAuth: true,
  requiredRoles: [Role.ADMIN, Role.SUPERADMIN],
  allowSameUser: true,
});

/**
 * Convenience middleware for routes that require authentication and email verification
 */
export const requireAuthAndVerifiedEmail = createAuthMiddleware({
  requireAuth: true,
  requireEmailVerification: true,
});

/**
 * Convenience middleware for routes that require admin role and email verification
 */
export const requireAdminAndVerifiedEmail = createAuthMiddleware({
  requireAuth: true,
  requiredRoles: [Role.ADMIN, Role.SUPERADMIN],
  requireEmailVerification: true,
});

/**
 * Middleware for public routes (no authentication required)
 */
export const publicRoute = createAuthMiddleware({
  requireAuth: false,
  requireCSRF: true, // CSRF protection enabled for all state-changing methods (POST/PUT/PATCH/DELETE)
  enableRateLimit: false, // Rate limiting handled individually on sensitive public routes
});

/**
 * Get a unique identifier for the client based on IP and User-Agent
 * Used for CSRF token validation for unauthenticated users
 */
function getClientIdentifier(req: NextRequest): string {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  // Create a unique identifier combining IP and user agent
  return `${ip}:${userAgent}`;
}
