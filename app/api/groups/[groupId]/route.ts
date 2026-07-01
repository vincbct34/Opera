import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/app/api/middleware';
import { PublicCategory, SchoolGrade, AgeRange, Accessibility } from '@prisma/client';
import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';

/**
 * PATCH /api/groups/:groupId
 * Updates a specific group.
 * Body: { name?: string, category?: string[], grades?: string[], age_ranges?: string[], students_count?: number, disabilities?: Array<{type: Accessibility, count: number}> }
 * @param req - The incoming request containing update data.
 * @param context - The route context containing the group ID.
 * @returns JSON response with the updated group.
 */
export async function PATCH(req: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  return requireAuth(req as AuthenticatedRequest, async (authReq) => {
    try {
      const { groupId } = await context.params;
      const body = await req.json().catch(() => ({}));
      const { name, category, grades, age_ranges, students_count, disabilities } = body || {};

      if (
        name === undefined &&
        !category &&
        !grades &&
        !age_ranges &&
        students_count === undefined &&
        disabilities === undefined
      ) {
        return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 });
      }

      const updateData: {
        name?: string | null;
        category?: PublicCategory[];
        grades?: SchoolGrade[];
        age_ranges?: AgeRange[];
        students_count?: number;
      } = {};

      if (name !== undefined) {
        updateData.name = name || null;
      }

      if (category) {
        if (!Array.isArray(category) || category.length === 0) {
          return NextResponse.json(
            { error: 'category doit être une liste non vide' },
            { status: 400 },
          );
        }

        // Validate all category values are valid PublicCategory values
        const validCategories = Object.values(PublicCategory);
        if (!category.every((t: string) => validCategories.includes(t as PublicCategory))) {
          return NextResponse.json({ error: 'Valeur(s) category invalide(s)' }, { status: 400 });
        }

        updateData.category = category as PublicCategory[];
      }

      // Validate grades if provided (new SchoolGrade enum)
      if (grades) {
        if (!Array.isArray(grades)) {
          return NextResponse.json({ error: 'grades doit être une liste' }, { status: 400 });
        }

        const validGrades = Object.values(SchoolGrade);
        if (!grades.every((t: string) => validGrades.includes(t as SchoolGrade))) {
          return NextResponse.json({ error: 'Valeur(s) grades invalide(s)' }, { status: 400 });
        }

        updateData.grades = grades as SchoolGrade[];
      }

      // Validate age_ranges if provided (new AgeRange enum)
      if (age_ranges) {
        if (!Array.isArray(age_ranges)) {
          return NextResponse.json({ error: 'age_ranges doit être une liste' }, { status: 400 });
        }

        const validAgeRanges = Object.values(AgeRange);
        if (!age_ranges.every((t: string) => validAgeRanges.includes(t as AgeRange))) {
          return NextResponse.json({ error: 'Valeur(s) age_ranges invalide(s)' }, { status: 400 });
        }

        updateData.age_ranges = age_ranges as AgeRange[];
      }

      if (students_count !== undefined) {
        if (typeof students_count !== 'number' || students_count < 0) {
          return NextResponse.json(
            { error: 'students_count doit être un nombre >= 0' },
            { status: 400 },
          );
        }
        updateData.students_count = students_count;
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

      // Vérifier propriété: seul propriétaire du groupe ou admin peut modifier
      const existing = await prisma.group.findUnique({
        where: { id: groupId },
        select: { user_id: true },
      });
      if (!existing) return NextResponse.json({ error: 'Groupe introuvable' }, { status: 404 });

      if (
        authReq.user?.role !== 'ADMIN' &&
        authReq.user?.role !== 'SUPERADMIN' &&
        authReq.user?.id !== existing.user_id
      ) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
      }

      // Update the group and handle disabilities
      const updated = await prisma.group.update({
        where: { id: groupId },
        data: {
          ...updateData,
          ...(disabilities !== undefined && {
            disabilities: {
              deleteMany: {}, // Delete all existing disabilities
              create: disabilities.map(
                (d: { type: Accessibility; count: number; details?: string }) => ({
                  type: d.type,
                  count: d.count,
                  details: d.type === 'OTHER' ? d.details || null : null,
                }),
              ),
            },
          }),
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

      return NextResponse.json({ group: updated });
    } catch (error) {
      logger.error('Error updating group:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: 'Erreur lors de la mise à jour du groupe' },
        { status: 500 },
      );
    }
  });
}

/**
 * DELETE /api/groups/:groupId
 * Deletes an existing group.
 * @param req - The incoming request.
 * @param context - The route context containing the group ID.
 * @returns JSON response indicating success or failure.
 */
export async function DELETE(req: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  return requireAuth(req as AuthenticatedRequest, async (authReq) => {
    try {
      const { groupId } = await context.params;

      // Vérifier propriété: seul propriétaire du groupe ou admin peut supprimer
      const existing = await prisma.group.findUnique({
        where: { id: groupId },
        select: { user_id: true },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Groupe introuvable' }, { status: 404 });
      }

      if (
        authReq.user?.role !== 'ADMIN' &&
        authReq.user?.role !== 'SUPERADMIN' &&
        authReq.user?.id !== existing.user_id
      ) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
      }

      await prisma.group.delete({
        where: { id: groupId },
      });

      return NextResponse.json({ message: 'Groupe supprimé avec succès' });
    } catch (error) {
      logger.error('Error deleting group:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: 'Erreur lors de la suppression du groupe' },
        { status: 500 },
      );
    }
  });
}
