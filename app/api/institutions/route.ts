import { NextRequest, NextResponse } from 'next/server';

import { publicRoute, requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';

import prisma from '@/lib/middleware/prismaConfig';

import { PublicCategory, SchoolGrade, AgeRange, Prisma } from '@prisma/client';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';
import {
  isValidFrenchPostalCode,
  isValidFrenchPhoneNumber,
  isValidEmail,
} from '@/lib/validation/frenchValidation';
import { checkInstitutionCreation } from '@/lib/search/institutionDuplicateDetection';
import { buildSearchWhereClause } from '@/lib/search/institutionSearch';

/**
 * POST /api/institutions
 * Create a new institution with enhanced validation and duplicate detection.
 *
 * Features:
 * - ASSOCIATION type creation without restriction
 * - Fuzzy search for duplicate detection (>80% similarity)
 * - Name + city verification to avoid real duplicates
 * - Returns suggestions if similar institutions found (status 409)
 * - French postal code validation
 * - Email format validation
 * - Phone format validation
 * - Requires explicit confirmation with `force_create=true` parameter
 * - Age range support for non-school establishments
 * - NEW: SchoolGrade and AgeRange support for more granular targeting
 *
 * @param req - NextRequest object containing the request data.
 * @returns NextResponse with institution information or error message.
 */
export async function POST(req: NextRequest) {
  // Use publicRoute as everyone can create an institution
  return publicRoute(req as AuthenticatedRequest, async (req: AuthenticatedRequest) => {
    // Extract institution data from the request body
    const body = await req.json();
    const {
      name,
      email,
      phone_number,
      address,
      type,
      not_listed,
      force_create,
      grades,
      age_ranges,
    } = body;

    // Check if all required fields are provided
    if (!name || !address || !type) {
      return NextResponse.json(
        { error: 'Champs obligatoires manquants (name, address, type)' },
        { status: 400 },
      );
    }

    // Validate address object
    if (!address.street || !address.zip_code || !address.city) {
      return NextResponse.json(
        {
          error: 'Adresse incomplète (street, zip_code, city requis)',
        },
        { status: 400 },
      );
    }

    // Validate institution type (should be an array)
    if (!Array.isArray(type) || type.length === 0) {
      return NextResponse.json(
        {
          error: "Le type d'institution doit être un tableau non vide",
        },
        { status: 400 },
      );
    }

    // Validate all types are valid PublicCategory values
    const validCategories = Object.values(PublicCategory);
    if (!type.every((t: string) => validCategories.includes(t as PublicCategory))) {
      return NextResponse.json(
        {
          error: "Type(s) d'institution invalide(s)",
        },
        { status: 400 },
      );
    }

    // Validate grades if provided (new SchoolGrade enum)
    if (grades && Array.isArray(grades)) {
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
    if (age_ranges && Array.isArray(age_ranges)) {
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

    // Validate French postal code
    if (!isValidFrenchPostalCode(address.zip_code)) {
      return NextResponse.json(
        {
          error: 'Code postal invalide. Format attendu: 5 chiffres (ex: 34000)',
        },
        { status: 400 },
      );
    }

    // Validate email if provided
    if (email && !isValidEmail(email)) {
      return NextResponse.json(
        {
          error: "Format d'email invalide",
        },
        { status: 400 },
      );
    }

    // Validate phone number if provided
    if (phone_number && !isValidFrenchPhoneNumber(phone_number)) {
      return NextResponse.json(
        {
          error:
            'Format de téléphone invalide. Format attendu: 06 12 34 56 78 ou +33 6 12 34 56 78',
        },
        { status: 400 },
      );
    }

    try {
      // Check for duplicates and similar institutions
      const creationCheck = await checkInstitutionCreation(
        name,
        address.city,
        address.zip_code,
        type as PublicCategory[],
        force_create === true || force_create === 'true',
      );

      // If creation not allowed, return 409 with similar institutions
      if (!creationCheck.allowed) {
        return NextResponse.json(
          {
            error: creationCheck.reason,
            similarInstitutions: creationCheck.similarInstitutions,
            suggestion:
              'Vérifiez que votre établissement ne figure pas déjà dans la liste. Si vous êtes sûr(e), ajoutez force_create: true à votre requête.',
          },
          { status: 409 },
        );
      }

      // Check if the email is already in use (if provided)
      if (email) {
        const existingEmail = await prisma.institution.findFirst({
          where: { email },
        });
        if (existingEmail) {
          return NextResponse.json(
            {
              error: 'Cette adresse email est déjà utilisée par une autre institution',
            },
            { status: 400 },
          );
        }
      }

      // Create the institution with its address in a transaction
      const institution = await prisma.$transaction(async (tx) => {
        // First, create the address
        const createdAddress = await tx.address.create({
          data: {
            street: address.street,
            zip_code: address.zip_code,
            city: address.city,
          },
        });

        // Then, create the institution
        const createdInstitution = await tx.institution.create({
          data: {
            name,
            email: email || null,
            phone_number: phone_number || null,
            address_id: createdAddress.id,
            type,
            grades: grades || [],
            age_ranges: age_ranges || [],
            not_listed: not_listed || null,
          },
          include: {
            address: true,
          },
        });

        return createdInstitution;
      });

      // Return the created institution
      return NextResponse.json(
        {
          institution,
          message: 'Institution créée avec succès',
        },
        { status: 201 },
      );
    } catch (error) {
      logger.error('Error creating institution:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: "Erreur lors de la création de l'institution" },
        { status: 500 },
      );
    }
  });
}

/**
 * GET /api/institutions
 * Get all institutions (admin only).
 * Query params:
 *   - page (optional): Page number
 *   - limit (optional): Items per page
 *   - search (optional): Search by name
 *   - city (optional): Filter by city
 *   - type (optional): Filter by institution type
 *   - hasRegistrations (optional): Filter by presence of registrations
 * @param req - NextRequest object containing the request data.
 * @returns NextResponse with institutions list.
 */
export async function GET(req: NextRequest) {
  // Use requireAdmin to ensure only admins can list all institutions
  return requireAdmin(req as AuthenticatedRequest, async (req: AuthenticatedRequest) => {
    try {
      // Extract query parameters for filtering and pagination
      const { searchParams } = new URL(req.url);
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '10');
      const search = searchParams.get('search') || '';
      const city = searchParams.get('city') || '';
      const type = searchParams.get('type') as PublicCategory | null;
      const hasRegistrations =
        (searchParams.get('hasRegistrations') || '').toLowerCase() === 'true' ||
        searchParams.get('hasRegistrations') === '1';

      // Calculate offset for pagination
      const offset = (page - 1) * limit;

      // Build where clause using advanced fuzzy search when search/city provided
      // Otherwise use a simple where clause
      let where: Prisma.InstitutionWhereInput = {};

      if (search || city) {
        // Use advanced fuzzy search with buildSearchWhereClause
        // Only use if search has at least 2 characters (matching the search endpoint behavior)
        const nameQuery = search.length >= 2 ? search : undefined;
        const cityQuery = city.length >= 2 ? city : undefined;

        if (nameQuery || cityQuery) {
          where = buildSearchWhereClause(nameQuery || '', cityQuery);
        }
      }

      // Apply type filter (additive to search)
      if (type && Object.values(PublicCategory).includes(type)) {
        where.type = { has: type };
      }

      if (hasRegistrations) {
        // Filter institutions that have at least one registration
        where.registrations = { some: {} };
      }

      // Get institutions with pagination and filtering
      const [institutions, total] = await Promise.all([
        prisma.institution.findMany({
          where,
          include: {
            address: true,
            _count: {
              select: {
                userInstitutions: true,
                registrations: true,
              },
            },
          },
          orderBy: { created_at: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.institution.count({ where }),
      ]);

      return NextResponse.json({
        institutions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error('Error fetching institutions:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des institutions' },
        { status: 500 },
      );
    }
  });
}
