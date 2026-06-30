/**
 * Institution duplicate detection service.
 * Finds similar institutions to prevent duplicates in the database.
 */

import prisma from '@/lib/middleware/prismaConfig';
import { calculateFrenchSimilarity } from '@/lib/search/fuzzySearch';
import type { PublicCategory, Institution } from '@/app/generated/prisma';

type InstitutionWithAddress = Institution & {
  address: {
    city: string;
    zip_code: string | null;
  };
};

export interface SimilarInstitution {
  id: string;
  name: string;
  city: string;
  zipCode: string | null;
  type: PublicCategory[];
  nameSimilarity: number;
  citySimilarity: number;
  overallSimilarity: number;
  matchReason: string;
}

export interface DuplicateDetectionOptions {
  name: string;
  city: string;
  zipCode: string | null;
  type: PublicCategory[];
  nameSimilarityThreshold?: number; // Default: 80
  citySimilarityThreshold?: number; // Default: 70
}

/**
 * Find similar institutions that might be duplicates.
 * @param options - Detection options.
 * @returns Array of similar institutions sorted by similarity.
 */
export async function findSimilarInstitutions(
  options: DuplicateDetectionOptions,
): Promise<SimilarInstitution[]> {
  const {
    name,
    city,
    zipCode,
    type,
    nameSimilarityThreshold = 80,
    citySimilarityThreshold = 70,
  } = options;

  // Get all institutions from the same department or nearby
  const department = zipCode?.substring(0, 2) || '';

  const institutions = await prisma.institution.findMany({
    where: {
      address: {
        OR: [
          { zip_code: { startsWith: department } }, // Same department
          { city: { contains: city, mode: 'insensitive' } }, // Same city name
        ],
      },
    },
    include: {
      address: true,
    },
  });

  const similarInstitutions: SimilarInstitution[] = [];

  for (const institution of institutions) {
    const nameSimilarity = calculateFrenchSimilarity(name, institution.name);
    const citySimilarity = calculateFrenchSimilarity(city, institution.address.city);

    // Skip if not similar enough (must match BOTH name and city criteria)
    if (nameSimilarity < nameSimilarityThreshold || citySimilarity < citySimilarityThreshold) {
      continue;
    }

    // Calculate overall similarity (weighted average)
    const overallSimilarity = Math.round(nameSimilarity * 0.7 + citySimilarity * 0.3);

    let matchReason = '';

    // Determine match reason
    if (nameSimilarity >= 95 && citySimilarity >= 95) {
      matchReason = 'Nom et ville quasi-identiques';
    } else {
      matchReason = `Nom très similaire (${nameSimilarity}%)`;
    }

    // Add type overlap information
    const commonTypes = type.filter((t) => institution.type.includes(t));
    if (commonTypes.length > 0) {
      matchReason += ` - Même type: ${commonTypes.join(', ')}`;
    }

    similarInstitutions.push({
      id: institution.id,
      name: institution.name,
      city: institution.address.city,
      zipCode: institution.address.zip_code,
      type: institution.type as PublicCategory[],
      nameSimilarity,
      citySimilarity,
      overallSimilarity,
      matchReason,
    });
  }

  // Sort by overall similarity (highest first)
  similarInstitutions.sort((a, b) => b.overallSimilarity - a.overallSimilarity);

  return similarInstitutions;
}

/**
 * Check if an institution with exact name already exists.
 * @param name - Institution name.
 * @returns The existing institution or null.
 */
export async function findExactNameMatch(name: string): Promise<InstitutionWithAddress | null> {
  return (await prisma.institution.findFirst({
    where: { name },
    include: { address: true },
  })) as InstitutionWithAddress | null;
}

/**
 * Check if an institution type is ASSOCIATION.
 * Associations can be created freely without duplicate checks.
 * @param types - Array of institution types.
 * @returns True if contains ASSOCIATION type.
 */
export function isAssociation(types: PublicCategory[]): boolean {
  return types.includes('ASSOCIATION' as PublicCategory);
}

/**
 * Determine if institution creation should be allowed.
 * @param name - Institution name.
 * @param city - City name.
 * @param zipCode - Postal code.
 * @param types - Institution types.
 * @param forceCreate - Force creation even if similar institutions exist.
 * @returns Object indicating if creation is allowed and any similar institutions found.
 */
export async function checkInstitutionCreation(
  name: string,
  city: string,
  zipCode: string,
  types: PublicCategory[],
  forceCreate: boolean = false,
): Promise<{
  allowed: boolean;
  reason: string;
  similarInstitutions: SimilarInstitution[];
}> {
  // Check for exact name match first
  const exactMatch = await findExactNameMatch(name);
  if (exactMatch) {
    return {
      allowed: false,
      reason: 'Une institution avec ce nom exact existe déjà',
      similarInstitutions: [
        {
          id: exactMatch.id,
          name: exactMatch.name,
          city: exactMatch.address.city,
          zipCode: exactMatch.address.zip_code,
          type: exactMatch.type as PublicCategory[],
          nameSimilarity: 100,
          citySimilarity: calculateFrenchSimilarity(city, exactMatch.address.city),
          overallSimilarity: 100,
          matchReason: 'Nom identique',
        },
      ],
    };
  }

  // Allow associations without duplicate check
  if (isAssociation(types)) {
    return {
      allowed: true,
      reason: 'Création autorisée (type ASSOCIATION)',
      similarInstitutions: [],
    };
  }

  // Find similar institutions
  const similarInstitutions = await findSimilarInstitutions({
    name,
    city,
    zipCode,
    type: types,
    nameSimilarityThreshold: 90,
    citySimilarityThreshold: 85,
  });

  // If similar institutions found and not forcing creation
  if (similarInstitutions.length > 0 && !forceCreate) {
    return {
      allowed: false,
      reason: `${similarInstitutions.length} établissement(s) similaire(s) trouvé(s). Vérifiez qu'il ne s'agit pas d'un doublon.`,
      similarInstitutions,
    };
  }

  // Allow creation if no similar institutions or force_create is true
  return {
    allowed: true,
    reason: forceCreate
      ? "Création forcée par l'utilisateur"
      : 'Aucun établissement similaire trouvé',
    similarInstitutions,
  };
}
