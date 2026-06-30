/**
 * Fuzzy search utilities for finding similar strings
 * Uses Levenshtein distance algorithm for similarity calculation
 */

/**
 * Calculate the Levenshtein distance between two strings.
 * @param str1 - First string.
 * @param str2 - Second string.
 * @returns The edit distance between the two strings.
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create a 2D array for dynamic programming
  const matrix: number[][] = Array.from({ length: len1 + 1 }, () => Array(len2 + 1).fill(0));

  // Initialize first column and row
  for (let i = 0; i <= len1; i++) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate the similarity percentage between two strings.
 * @param str1 - First string.
 * @param str2 - Second string.
 * @returns Similarity percentage (0-100).
 */
export function calculateSimilarity(str1: string, str2: string): number {
  // Normalize strings: lowercase and trim
  const normalized1 = str1.toLowerCase().trim();
  const normalized2 = str2.toLowerCase().trim();

  // Handle empty strings
  if (!normalized1 || !normalized2) {
    return 0;
  }

  // If strings are identical
  if (normalized1 === normalized2) {
    return 100;
  }

  // Calculate Levenshtein distance
  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);

  // Convert to similarity percentage
  const similarity = ((maxLength - distance) / maxLength) * 100;

  return Math.round(similarity);
}

/**
 * Check if two strings are similar based on a threshold.
 * @param str1 - First string.
 * @param str2 - Second string.
 * @param threshold - Minimum similarity percentage (default: 80).
 * @returns True if strings are similar enough.
 */
export function areSimilar(str1: string, str2: string, threshold: number = 80): boolean {
  const similarity = calculateSimilarity(str1, str2);
  return similarity >= threshold;
}

/**
 * Find similar strings in a list.
 * @param target - Target string to compare against.
 * @param candidates - List of candidate strings.
 * @param threshold - Minimum similarity percentage (default: 80).
 * @returns Array of similar strings with their similarity scores.
 */
export function findSimilarStrings(
  target: string,
  candidates: string[],
  threshold: number = 80,
): Array<{ value: string; similarity: number }> {
  const results: Array<{ value: string; similarity: number }> = [];

  for (const candidate of candidates) {
    const similarity = calculateSimilarity(target, candidate);
    if (similarity >= threshold) {
      results.push({ value: candidate, similarity });
    }
  }

  // Sort by similarity (highest first)
  results.sort((a, b) => b.similarity - a.similarity);

  return results;
}

/**
 * Normalize French text for comparison (remove accents, lowercase, trim).
 * @param text - Text to normalize.
 * @returns Normalized text.
 */
export function normalizeFrenchText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics
}

/**
 * Calculate similarity with French text normalization.
 * @param str1 - First string.
 * @param str2 - Second string.
 * @returns Similarity percentage (0-100).
 */
export function calculateFrenchSimilarity(str1: string, str2: string): number {
  const normalized1 = normalizeFrenchText(str1);
  const normalized2 = normalizeFrenchText(str2);
  return calculateSimilarity(normalized1, normalized2);
}
