/**
 * Badge/acronym constants for SchoolGrade and AgeRange enums to be used in UI components
 *
 * These constants provide shortened versions suitable for circular badges in the UI.
 * They are designed to be concise and visually compact.
 *
 * Usage:
 *   import { SCHOOL_GRADE_ACRONYMS, AGE_RANGE_ACRONYMS } from '@/lib/config/badgeConstants';
 *
 *   const acronym = SCHOOL_GRADE_ACRONYMS[SchoolGrade.SIXIEME]; // Returns '6ème'
 */

import { SchoolGrade, AgeRange } from '@/app/generated/prisma';

// ============================================================================
// School Grade Acronyms (for circular badges)
// ============================================================================

/**
 * Acronyms for SchoolGrade enum values to display in circular badges
 * Format: Short, 2-4 character abbreviations with French ordinal indicators
 */
export const SCHOOL_GRADE_ACRONYMS: Record<SchoolGrade, string> = {
  PS: 'PS',
  MS: 'MS',
  GS: 'GS',
  CP: 'CP',
  CE1: 'CE1',
  CE2: 'CE2',
  CM1: 'CM1',
  CM2: 'CM2',
  SIXIEME: '6ème',
  CINQUIEME: '5ème',
  QUATRIEME: '4ème',
  TROISIEME: '3ème',
  SECONDE: '2nde',
  PREMIERE: '1ère',
  TERMINALE: 'Term',
};

// ============================================================================
// Age Range Acronyms (for circular badges)
// ============================================================================

/**
 * Acronyms for AgeRange enum values to display in circular badges
 * Format: Age range indicators (e.g., "0-3", "18+")
 */
export const AGE_RANGE_ACRONYMS: Record<AgeRange, string> = {
  AGE_0_3: '0-3',
  AGE_3_6: '3-6',
  AGE_6_11: '6-11',
  AGE_11_15: '11-15',
  AGE_15_18: '15-18',
  AGE_18_PLUS: '18+',
};

// ============================================================================
// Display Order Constants (from youngest to oldest)
// ============================================================================

/**
 * Ordered array of SchoolGrade values from youngest to oldest
 * Useful for sorting or iterating through grades in ascending order
 */
export const SCHOOL_GRADE_ORDER: SchoolGrade[] = [
  SchoolGrade.PS,
  SchoolGrade.MS,
  SchoolGrade.GS,
  SchoolGrade.CP,
  SchoolGrade.CE1,
  SchoolGrade.CE2,
  SchoolGrade.CM1,
  SchoolGrade.CM2,
  SchoolGrade.SIXIEME,
  SchoolGrade.CINQUIEME,
  SchoolGrade.QUATRIEME,
  SchoolGrade.TROISIEME,
  SchoolGrade.SECONDE,
  SchoolGrade.PREMIERE,
  SchoolGrade.TERMINALE,
];

/**
 * Ordered array of AgeRange values from youngest to oldest
 * Useful for sorting or iterating through age ranges in ascending order
 */
export const AGE_RANGE_ORDER: AgeRange[] = [
  AgeRange.AGE_0_3,
  AgeRange.AGE_3_6,
  AgeRange.AGE_6_11,
  AgeRange.AGE_11_15,
  AgeRange.AGE_15_18,
  AgeRange.AGE_18_PLUS,
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the acronym for a school grade to display in a UI badge
 * @param grade - The SchoolGrade enum value
 * @returns The acronym string for display in badges
 */
export function getSchoolGradeAcronym(grade: SchoolGrade): string {
  return SCHOOL_GRADE_ACRONYMS[grade];
}

/**
 * Get the acronym for an age range to display in a UI badge
 * @param range - The AgeRange enum value
 * @returns The acronym string for display in badges
 */
export function getAgeRangeAcronym(range: AgeRange): string {
  return AGE_RANGE_ACRONYMS[range];
}

/**
 * Get acronyms for multiple school grades
 * @param grades - Array of SchoolGrade enum values
 * @returns Array of acronym strings
 */
export function getSchoolGradeAcronyms(grades: SchoolGrade[]): string[] {
  return grades.map(getSchoolGradeAcronym);
}

/**
 * Get acronyms for multiple age ranges
 * @param ranges - Array of AgeRange enum values
 * @returns Array of acronym strings
 */
export function getAgeRangeAcronyms(ranges: AgeRange[]): string[] {
  return ranges.map(getAgeRangeAcronym);
}

// ============================================================================
// School Grades by Type Mapping
// ============================================================================

/**
 * Mapping of school types to their relevant grade levels
 * Each school type only shows grades that are applicable to that level
 */
export const GRADES_BY_SCHOOL_TYPE: Record<string, SchoolGrade[]> = {
  MATERNELLE: [SchoolGrade.PS, SchoolGrade.MS, SchoolGrade.GS],
  ELEMENTAIRE: [SchoolGrade.CP, SchoolGrade.CE1, SchoolGrade.CE2, SchoolGrade.CM1, SchoolGrade.CM2],
  COLLEGE: [
    SchoolGrade.SIXIEME,
    SchoolGrade.CINQUIEME,
    SchoolGrade.QUATRIEME,
    SchoolGrade.TROISIEME,
  ],
  LYCEE: [SchoolGrade.SECONDE, SchoolGrade.PREMIERE, SchoolGrade.TERMINALE],
};

/**
 * Get relevant school grades for a given school type
 * @param schoolType - The PublicCategory school type
 * @returns Array of applicable SchoolGrade values
 */
export function getGradesForSchoolType(schoolType: string): SchoolGrade[] {
  return GRADES_BY_SCHOOL_TYPE[schoolType] || [];
}

/**
 * Get all relevant school grades for multiple school types
 * @param schoolTypes - Array of PublicCategory school types
 * @returns Array of applicable SchoolGrade values (unique, sorted)
 */
export function getGradesForSchoolTypes(schoolTypes: string[]): SchoolGrade[] {
  const allGrades = new Set<SchoolGrade>();
  for (const type of schoolTypes) {
    const grades = getGradesForSchoolType(type);
    grades.forEach((grade) => allGrades.add(grade));
  }
  // Return in the order defined by SCHOOL_GRADE_ORDER
  return SCHOOL_GRADE_ORDER.filter((grade) => allGrades.has(grade));
}
