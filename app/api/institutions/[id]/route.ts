import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin, requireAuth, AuthenticatedRequest } from '@/app/api/middleware';

import prisma from '@/lib/middleware/prismaConfig';

import { PublicCategory, SchoolGrade, AgeRange } from '@prisma/client';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';

/**
 * GET /api/institutions/[id]
 * Get a specific institution by ID.
 * @param req - NextRequest object containing the request data.
 * @param context - Route parameters containing the institution ID.
 * @returns NextResponse with institution information or error message.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return requireAuth(req as AuthenticatedRequest, async () => {
    try {
      // Extract institution ID from params
      const { id } = await context.params;

      // Find institution
      const institution = await prisma.institution.findUnique({
        where: { id },
        include: {
          address: true,
          _count: {
            select: { userInstitutions: true, registrations: true },
          },
        },
      });

      // Check if institution exists
      if (!institution) {
        return NextResponse.json({ error: 'Institution non trouvée' }, { status: 404 });
      }

      // Return institution data with related establishment info
      return NextResponse.json({ institution });
    } catch (error) {
      logger.error('Error fetching institution:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: "Erreur lors de la récupération de l'institution" },
        { status: 500 },
      );
    }
  });
}

/**
 * PUT /api/institutions/[id]
 * Update a specific institution by ID.
 * Body: { name?, email?, phone_number?, address?, type?, not_listed?, grades?, age_ranges? }
 * @param req - NextRequest object containing the request data.
 * @param context - Route parameters containing the institution ID.
 * @returns NextResponse with updated institution information or error message.
 */
export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return requireAdmin(req as AuthenticatedRequest, async (req: AuthenticatedRequest) => {
    try {
      // Extract institution ID from params
      const { id } = await context.params;

      // Extract update data from request body
      const body = await req.json();
      const { name, email, phone_number, address, type, not_listed, grades, age_ranges } = body;

      // Check if institution exists
      const existingInstitution = await prisma.institution.findUnique({
        where: { id },
        include: { address: true },
      });

      if (!existingInstitution) {
        return NextResponse.json({ error: 'Institution non trouvée' }, { status: 404 });
      }

      // Validate institution type if provided (should be an array)
      if (type) {
        if (!Array.isArray(type) || type.length === 0) {
          return NextResponse.json(
            {
              error: "Le type d'institution doit être un tableau non vide",
            },
            { status: 400 },
          );
        }

        const validTypes = Object.values(PublicCategory);
        if (!type.every((t: string) => validTypes.includes(t as PublicCategory))) {
          return NextResponse.json(
            {
              error: "Type(s) d'institution invalide(s)",
            },
            { status: 400 },
          );
        }
      }

      // Validate grades if provided (new SchoolGrade enum)
      if (grades) {
        if (!Array.isArray(grades)) {
          return NextResponse.json(
            {
              error: 'Les grades doivent être un tableau',
            },
            { status: 400 },
          );
        }
        const validGrades = Object.values(SchoolGrade);
        if (!grades.every((t: string) => validGrades.includes(t as SchoolGrade))) {
          return NextResponse.json(
            {
              error: 'Niveau(x) scolaire(s) invalide(s)',
            },
            { status: 400 },
          );
        }
      }

      // Validate age_ranges if provided (new AgeRange enum)
      if (age_ranges) {
        if (!Array.isArray(age_ranges)) {
          return NextResponse.json(
            {
              error: 'Les age_ranges doivent être un tableau',
            },
            { status: 400 },
          );
        }
        const validAgeRanges = Object.values(AgeRange);
        if (!age_ranges.every((t: string) => validAgeRanges.includes(t as AgeRange))) {
          return NextResponse.json(
            {
              error: "Tranche(s) d'âge invalide(s)",
            },
            { status: 400 },
          );
        }
      }

      // Check if the new name is already in use by another institution
      if (name && name !== existingInstitution.name) {
        const nameExists = await prisma.institution.findFirst({
          where: { name },
        });
        if (nameExists) {
          return NextResponse.json(
            {
              error: 'Une institution avec ce nom existe déjà',
            },
            { status: 400 },
          );
        }
      }

      // Check if the new email is already in use by another institution
      if (email && email !== existingInstitution.email) {
        const emailExists = await prisma.institution.findFirst({
          where: { email },
        });
        if (emailExists) {
          return NextResponse.json(
            {
              error: 'Cette adresse email est déjà utilisée par une autre institution',
            },
            { status: 400 },
          );
        }
      }

      // Update institution and address in a transaction
      const updatedInstitution = await prisma.$transaction(async (tx) => {
        // Update address if provided
        if (address) {
          await tx.address.update({
            where: { id: existingInstitution.address_id },
            data: {
              ...(address.street && { street: address.street }),
              ...(address.zip_code && { zip_code: address.zip_code }),
              ...(address.city && { city: address.city }),
            },
          });
        }

        // Update institution
        const updated = await tx.institution.update({
          where: { id },
          data: {
            ...(name && { name }),
            ...(email !== undefined && { email: email || null }),
            ...(phone_number !== undefined && { phone_number: phone_number || null }),
            ...(type && { type }),
            ...(grades && { grades }),
            ...(age_ranges && { age_ranges }),
            ...(not_listed !== undefined && { not_listed: not_listed || null }),
          },
          include: {
            address: true,
          },
        });

        return updated;
      });

      return NextResponse.json({
        institution: updatedInstitution,
        message: 'Institution mise à jour avec succès',
      });
    } catch (error) {
      logger.error('Error updating institution:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: "Erreur lors de la mise à jour de l'institution" },
        { status: 500 },
      );
    }
  });
}

/**
 * DELETE /api/institutions/[id]
 * Delete a specific institution by ID.
 * @param req - NextRequest object containing the request data.
 * @param context - Route parameters containing the institution ID.
 * @returns NextResponse with success message or error message.
 */
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return requireAdmin(req as AuthenticatedRequest, async () => {
    try {
      // Extract institution ID from params
      const { id } = await context.params;

      // Check if institution exists and get relation counts
      const existingInstitution = await prisma.institution.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              userInstitutions: true,
              registrations: true,
            },
          },
        },
      });

      if (!existingInstitution) {
        return NextResponse.json({ error: 'Institution non trouvée' }, { status: 404 });
      }

      // Check if institution has users or registrations
      if (existingInstitution._count.userInstitutions > 0) {
        return NextResponse.json(
          {
            error: 'Impossible de supprimer cette institution car elle a des utilisateurs associés',
          },
          { status: 400 },
        );
      }

      if (existingInstitution._count.registrations > 0) {
        return NextResponse.json(
          {
            error:
              "Impossible de supprimer cette institution car elle a des demandes d'inscription associées",
          },
          { status: 400 },
        );
      }

      // Delete institution and its address in a transaction
      await prisma.$transaction(async (tx) => {
        // Delete institution first (due to foreign key constraint)
        await tx.institution.delete({
          where: { id },
        });

        // Delete associated address
        await tx.address.delete({
          where: { id: existingInstitution.address_id },
        });
      });

      return NextResponse.json({
        message: 'Institution supprimée avec succès',
      });
    } catch (error) {
      logger.error('Error deleting institution:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: "Erreur lors de la suppression de l'institution" },
        { status: 500 },
      );
    }
  });
}
