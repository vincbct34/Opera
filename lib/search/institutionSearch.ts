/**
 * Institution search utilities with fuzzy matching and relevance scoring
 * Provides advanced search capabilities for finding institutions in a large database
 */

import { normalizeFrenchText, calculateSimilarity } from './fuzzySearch';
import { PublicCategory } from '@/app/generated/prisma/enums';
import { Prisma } from '@/app/generated/prisma/client';

/**
 * Institution data structure for search
 */
export interface InstitutionSearchData {
  id: string;
  name: string;
  type: PublicCategory[];
  address: {
    street: string | null;
    zip_code: string | null;
    city: string;
  };
}

/**
 * Search result with relevance score
 */
export interface InstitutionSearchResult extends InstitutionSearchData {
  score: number;
  matchReasons: string[];
}

/**
 * Search configuration
 */
interface SearchConfig {
  fuzzyThreshold: number; // Minimum similarity % for fuzzy matches
  maxResults: number; // Maximum number of results to return
  minScore: number; // Minimum score to include in results
}

const DEFAULT_CONFIG: SearchConfig = {
  fuzzyThreshold: 70,
  maxResults: 20,
  minScore: 10,
};

/**
 * Calculate relevance score for an institution against separate name and city queries
 * @param institution - Institution to score
 * @param nameQuery - Search query for institution name
 * @param cityQuery - Search query for city
 * @returns Score object with total score and match reasons
 */
export function calculateInstitutionScore(
  institution: InstitutionSearchData,
  nameQuery: string,
  cityQuery?: string,
): { score: number; matchReasons: string[] } {
  let score = 0;
  const matchReasons: string[] = [];

  // Normalize institution data
  const normalizedName = normalizeFrenchText(institution.name);
  const normalizedCity = normalizeFrenchText(institution.address.city);
  const normalizedZip = (institution.address.zip_code || '').trim();

  // Normalize queries
  const normalizedNameQuery = normalizeFrenchText(nameQuery);
  const nameKeywords = normalizedNameQuery.split(/\s+/).filter((k) => k.length > 0);

  const normalizedCityQuery = cityQuery ? normalizeFrenchText(cityQuery) : '';
  const cityKeywords = normalizedCityQuery.split(/\s+/).filter((k) => k.length > 0);

  // === NAME MATCHING ===

  // 1. EXACT MATCH in name (highest priority)
  if (normalizedName === normalizedNameQuery) {
    score += 1000;
    matchReasons.push('Nom correspond exactement');
  }

  // 2. NAME STARTS WITH query (very high priority)
  if (normalizedName.startsWith(normalizedNameQuery)) {
    score += 500;
    matchReasons.push('Nom commence par la recherche');
  }

  // 3. NAME CONTAINS query (high priority)
  if (normalizedName.includes(normalizedNameQuery)) {
    score += 300;
    matchReasons.push('Nom contient la recherche');
  }

  // 4. NAME KEYWORD MATCHING
  let nameKeywordMatchCount = 0;
  for (const keyword of nameKeywords) {
    if (keyword.length < 2) continue;

    if (normalizedName.includes(keyword)) {
      nameKeywordMatchCount++;
      score += 50;
    }
  }

  if (nameKeywordMatchCount > 0 && nameKeywordMatchCount === nameKeywords.length) {
    score += 100; // Bonus if all keywords found
    matchReasons.push(`Tous les mots-clés du nom trouvés (${nameKeywordMatchCount})`);
  } else if (nameKeywordMatchCount > 0) {
    matchReasons.push(`${nameKeywordMatchCount}/${nameKeywords.length} mots-clés du nom trouvés`);
  }

  // 5. FUZZY NAME MATCHING (for typos)
  const nameSimilarity = calculateSimilarity(normalizedName, normalizedNameQuery);
  if (nameSimilarity >= 70 && nameSimilarity < 100) {
    score += Math.floor(nameSimilarity * 2);
    matchReasons.push(`Nom similaire (${nameSimilarity}%)`);
  }

  // === CITY MATCHING (if city query provided) ===

  if (normalizedCityQuery) {
    // 6. EXACT CITY MATCH
    if (normalizedCity === normalizedCityQuery) {
      score += 500;
      matchReasons.push('Ville correspond exactement');
    } else if (normalizedCity.startsWith(normalizedCityQuery)) {
      score += 300;
      matchReasons.push('Ville commence par la recherche');
    } else if (normalizedCity.includes(normalizedCityQuery)) {
      score += 200;
      matchReasons.push('Ville contient la recherche');
    }

    // 7. CITY KEYWORD MATCHING
    let cityKeywordMatchCount = 0;
    for (const keyword of cityKeywords) {
      if (keyword.length < 2) continue;

      if (normalizedCity.includes(keyword)) {
        cityKeywordMatchCount++;
        score += 30;
      }
    }

    if (cityKeywordMatchCount > 0 && cityKeywordMatchCount === cityKeywords.length) {
      score += 50; // Bonus if all city keywords found
      matchReasons.push(`Tous les mots-clés de la ville trouvés (${cityKeywordMatchCount})`);
    }

    // 8. ZIP CODE MATCHING (if city query is a number)
    if (/^\d+$/.test(normalizedCityQuery)) {
      if (normalizedZip === normalizedCityQuery || normalizedZip.startsWith(normalizedCityQuery)) {
        score += 400;
        matchReasons.push('Code postal correspond');
      }
    }

    // 9. FUZZY CITY MATCHING
    const citySimilarity = calculateSimilarity(normalizedCity, normalizedCityQuery);
    if (citySimilarity >= 70 && citySimilarity < 100) {
      score += Math.floor(citySimilarity * 1.5);
      matchReasons.push(`Ville similaire (${citySimilarity}%)`);
    }
  }

  // 10. TYPE MATCHING (bonus for type in name query)
  const typeLabels: Record<PublicCategory, string[]> = {
    [PublicCategory.CRECHE]: ['creche', 'crèche'],
    [PublicCategory.MATERNELLE]: ['maternelle', 'mat'],
    [PublicCategory.ELEMENTAIRE]: ['elementaire', 'élémentaire', 'elem', 'primaire'],
    [PublicCategory.COLLEGE]: ['college', 'collège'],
    [PublicCategory.LYCEE]: ['lycee', 'lycée'],
    [PublicCategory.SUPERIEUR]: ['superieur', 'supérieur', 'universite', 'université', 'fac'],
    [PublicCategory.ASSOCIATION]: ['association', 'asso'],
    [PublicCategory.CONSERVATOIRE]: ['conservatoire'],
    [PublicCategory.PERISCOLAIRE]: ['centre', 'loisirs', 'periscolaire', 'périscolaire'],
    [PublicCategory.PUBLICS_EMPECHES]: ['empêchés', 'empeches', 'handicap', 'santé'],
    [PublicCategory.AUTRE]: ['autre'],
  };

  for (const type of institution.type) {
    const labels = typeLabels[type];
    if (labels) {
      for (const label of labels) {
        if (normalizedNameQuery.includes(label)) {
          score += 40;
          matchReasons.push(`Type correspondant: ${type}`);
          break;
        }
      }
    }
  }

  return { score, matchReasons };
}

/**
 * Search and rank institutions by relevance with separate name and city queries
 * @param institutions - List of institutions to search
 * @param nameQuery - Search query for institution name
 * @param cityQuery - Optional search query for city
 * @param config - Optional search configuration
 * @returns Ranked list of institutions with scores
 */
export function searchInstitutions(
  institutions: InstitutionSearchData[],
  nameQuery: string,
  cityQuery?: string,
  config: Partial<SearchConfig> = {},
): InstitutionSearchResult[] {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Calculate scores for all institutions
  const scoredInstitutions: InstitutionSearchResult[] = institutions
    .map((institution) => {
      const { score, matchReasons } = calculateInstitutionScore(institution, nameQuery, cityQuery);
      return {
        ...institution,
        score,
        matchReasons,
      };
    })
    .filter((inst) => inst.score >= finalConfig.minScore);

  // Sort by score (highest first), then by name
  scoredInstitutions.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.name.localeCompare(b.name, 'fr');
  });

  // Return top results
  return scoredInstitutions.slice(0, finalConfig.maxResults);
}

/**
 * Build optimized Prisma where clause for initial filtering with separate name and city
 * This reduces the number of institutions to score by pre-filtering with database queries
 * @param nameQuery - Search query for institution name
 * @param cityQuery - Optional search query for city
 * @returns Prisma where clause
 */
export function buildSearchWhereClause(
  nameQuery: string,
  cityQuery?: string,
): Prisma.InstitutionWhereInput {
  const andConditions = [];

  // Only add name conditions if query is long enough
  if (nameQuery.trim().length >= 2) {
    const normalizedNameQuery = normalizeFrenchText(nameQuery);
    const nameKeywords = normalizedNameQuery.split(/\s+/).filter((k) => k.length >= 2);

    // Name conditions (OR within name)
    const nameOrConditions = [];

    // Direct name match
    nameOrConditions.push({ name: { contains: nameQuery, mode: 'insensitive' as const } });

    // Name keyword matches
    for (const keyword of nameKeywords) {
      if (keyword.length >= 2) {
        nameOrConditions.push({ name: { contains: keyword, mode: 'insensitive' as const } });
      }
    }

    if (nameOrConditions.length > 0) {
      andConditions.push({ OR: nameOrConditions });
    }
  }

  // City conditions (if provided)
  if (cityQuery && cityQuery.trim().length >= 2) {
    const normalizedCityQuery = normalizeFrenchText(cityQuery);
    const cityKeywords = normalizedCityQuery.split(/\s+/).filter((k) => k.length >= 2);

    const cityOrConditions = [];

    // Direct city match
    cityOrConditions.push({
      address: { city: { contains: cityQuery, mode: 'insensitive' as const } },
    });

    // Zip code match (if city query is numeric)
    if (/^\d+$/.test(cityQuery.trim())) {
      cityOrConditions.push({ address: { zip_code: { startsWith: cityQuery.trim() } } });
    }

    // City keyword matches
    for (const keyword of cityKeywords) {
      if (keyword.length >= 2) {
        cityOrConditions.push({
          address: { city: { contains: keyword, mode: 'insensitive' as const } },
        });
      }
    }

    if (cityOrConditions.length > 0) {
      andConditions.push({ OR: cityOrConditions });
    }
  }

  // Return AND of name and city conditions
  if (andConditions.length === 0) {
    return {};
  } else if (andConditions.length === 1) {
    return andConditions[0];
  } else {
    return { AND: andConditions };
  }
}
