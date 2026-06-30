import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrSameUser, AuthenticatedRequest } from '@/app/api/middleware';
import { PublicCategory, SchoolGrade, AgeRange, Accessibility } from '@/app/generated/prisma/enums';
import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';

/**
 * GET /api/users/[id]/groups
 * Get all groups for a user.
 * @param req - The incoming request.
 * @param context - The route context containing the user ID.
 * @returns JSON response with the user's groups.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return requireAdminOrSameUser(req as AuthenticatedRequest, async () => {
    try {
      const { id } = await context.params;

      const groups = await prisma.group.findMany({
        where: { user_id: id },
        select: {
          id: true,
          name: true,
          category: true,
          grades: true,
          age_ranges: true,
          students_count: true,
          updated_at: true,
          disabilities: {
            select: {
              id: true,
              type: true,
              count: true,
              details: true,
            },
          },
        },
        orderBy: { updated_at: 'desc' },
      });

      return NextResponse.json({ groups });
    } catch (error) {
      logger.error('Error fetching user groups:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des groupes' },
        { status: 500 },
      );
    }
  });
}

/**
 * POST /api/users/[id]/groups
 * Create a group for a user (self or admin).
 * Body: { name?: string, category: string[], grades?: string[], age_ranges?: string[], students_count?: number, disabilities?: Array<{type: Accessibility, count: number}> }
 * @param req - The incoming request.
 * @param context - The route context containing the user ID.
 * @returns JSON response with the created group.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return requireAdminOrSameUser(req as AuthenticatedRequest, async () => {
    try {
      const { id } = await context.params;
      const body = await req.json().catch(() => ({}));
      const { name, category, grades, age_ranges, students_count, disabilities } = body || {};

      if (!Array.isArray(category) || category.length === 0) {
        return NextResponse.json(
          { error: 'category est requis (liste non vide)' },
          { status: 400 },
        );
      }
      if (typeof students_count !== 'number' || students_count < 0) {
        return NextResponse.json({ error: 'students_count requis et >= 0' }, { status: 400 });
      }

      // Validate all category values are valid PublicCategory values
      const validCategories = Object.values(PublicCategory);
      if (!category.every((t: string) => validCategories.includes(t as PublicCategory))) {
        return NextResponse.json({ error: 'Valeur(s) category invalide(s)' }, { status: 400 });
      }

      // Validate grades if provided (new SchoolGrade enum)
      let validatedGrades: SchoolGrade[] = [];
      if (grades) {
        if (!Array.isArray(grades)) {
          return NextResponse.json({ error: 'grades doit être une liste' }, { status: 400 });
        }
        const validGrades = Object.values(SchoolGrade);
        if (!grades.every((t: string) => validGrades.includes(t as SchoolGrade))) {
          return NextResponse.json({ error: 'Valeur(s) grades invalide(s)' }, { status: 400 });
        }
        validatedGrades = grades as SchoolGrade[];
      }

      // Validate age_ranges if provided (new AgeRange enum)
      let validatedAgeRanges: AgeRange[] = [];
      if (age_ranges) {
        if (!Array.isArray(age_ranges)) {
          return NextResponse.json({ error: 'age_ranges doit être une liste' }, { status: 400 });
        }
        const validAgeRanges = Object.values(AgeRange);
        if (!age_ranges.every((t: string) => validAgeRanges.includes(t as AgeRange))) {
          return NextResponse.json({ error: 'Valeur(s) age_ranges invalide(s)' }, { status: 400 });
        }
        validatedAgeRanges = age_ranges as AgeRange[];
      }

      // Validate disabilities if provided
      if (disabilities !== undefined) {
        if (!Array.isArray(disabilities)) {
          return NextResponse.json({ error: 'disabilities doit être un tableau' }, { status: 400 });
        }
        const validAccessibilities = Object.values(Accessibility);
        for (const d of disabilities) {
          if (!d.type || !validAccessibilities.includes(d.type)) {
            return NextResponse.json({ error: 'Type de handicap invalide' }, { status: 400 });
          }
          if (typeof d.count !== 'number' || d.count < 0) {
            return NextResponse.json({ error: 'Count de handicap invalide' }, { status: 400 });
          }
        }
      }

      const created = await prisma.group.create({
        data: {
          user_id: id,
          name: name || null,
          category: category as PublicCategory[],
          grades: validatedGrades,
          age_ranges: validatedAgeRanges,
          students_count,
          disabilities:
            disabilities && disabilities.length > 0
              ? {
                  create: disabilities.map(
                    (d: { type: Accessibility; count: number; details?: string }) => ({
                      type: d.type,
                      count: d.count,
                      details: d.type === 'OTHER' ? d.details || null : null,
                    }),
                  ),
                }
              : undefined,
        },
        select: {
          id: true,
          name: true,
          category: true,
          grades: true,
          age_ranges: true,
          students_count: true,
          updated_at: true,
          disabilities: {
            select: {
              id: true,
              type: true,
              count: true,
              details: true,
            },
          },
        },
      });

      return NextResponse.json({ group: created }, { status: 201 });
    } catch (error) {
      logger.error('Error creating group:', ...sanitizeLogArgs(error));
      return NextResponse.json({ error: 'Erreur lors de la création du groupe' }, { status: 500 });
    }
  });
}
