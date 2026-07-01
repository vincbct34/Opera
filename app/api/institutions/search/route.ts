import { NextRequest, NextResponse } from 'next/server';

import { createAuthMiddleware, AuthenticatedRequest } from '@/app/api/middleware';

import prisma from '@/lib/middleware/prismaConfig';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';
import { buildSearchWhereClause, searchInstitutions } from '@/lib/search/institutionSearch';

/**
 * GET /api/institutions/search
 * Public endpoint to search institutions (for registration).
 * Uses advanced fuzzy matching and relevance scoring for improved precision with separate name and city fields.
 *
 * Query params:
 *   - name: Institution name (min 2 chars, required)
 *   - city: City or zip code (optional, min 2 chars)
 *   - limit (optional): Max results (default 10, max 50)
 * @param req - NextRequest object containing the request data.
 * @returns NextResponse with institutions list sorted by relevance.
 */
export async function GET(req: NextRequest) {
  // Use search rate limit config for public search endpoints
  const searchMiddleware = createAuthMiddleware({
    requireAuth: false,
    requireCSRF: false,
    enableRateLimit: true,
    rateLimitConfig: 'search',
  });

  return searchMiddleware(req as AuthenticatedRequest, async (req: AuthenticatedRequest) => {
    try {
      // Extract query parameters
      const { searchParams } = new URL(req.url);
      const name = searchParams.get('name') || '';
      const city = searchParams.get('city') || '';
      const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50); // Max 50 results

      // Minimum search length validation for name (required)
      if (name.length < 2) {
        return NextResponse.json({
          institutions: [],
          message: 'Veuillez saisir au moins 2 caractères pour le nom',
        });
      }

      // City is optional but if provided, must be at least 2 chars
      const cityQuery = city.trim().length >= 2 ? city : undefined;

      // Build optimized where clause for database pre-filtering
      const where: Prisma.InstitutionWhereInput = buildSearchWhereClause(name, cityQuery);

      // Get institutions with basic info only (public endpoint)
      // Fetch more results than needed for better ranking
      const rawInstitutions = await prisma.institution.findMany({
        where,
        select: {
          id: true,
          name: true,
          type: true,
          address: {
            select: {
              street: true,
              zip_code: true,
              city: true,
            },
          },
        },
        // Fetch up to 500 results for scoring (will be trimmed to limit after ranking)
        take: 500,
      });

      // Apply advanced scoring and ranking
      const rankedInstitutions = searchInstitutions(rawInstitutions, name, cityQuery, {
        maxResults: limit,
        minScore: 10, // Minimum relevance score
        fuzzyThreshold: 70, // 70% similarity for fuzzy matches
      });

      return NextResponse.json({
        institutions: rankedInstitutions,
        resultsCount: rankedInstitutions.length,
      });
    } catch (error) {
      logger.error('Error searching institutions:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: 'Erreur lors de la recherche des institutions' },
        { status: 500 },
      );
    }
  });
}
