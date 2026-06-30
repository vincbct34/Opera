/**
 * Label mappings for displaying database enum values as human-readable French text
 *
 * CLIENT-SAFE FILE: This file contains ONLY static labels and synchronous functions.
 * It can be safely imported in client components.
 *
 * For dynamic labels from database (server-only), use labelMappingsServer.ts instead.
 *
 * Usage:
 * - Client components: Use getEventTypeLabel() etc. for static defaults
 * - Server components: Import from labelMappingsServer.ts for dynamic labels
 */

import {
  DEFAULT_ACCESSIBILITY_LABELS,
  DEFAULT_AGE_RANGE_LABELS,
  DEFAULT_EVENT_TYPE_LABELS,
  DEFAULT_PUBLIC_CATEGORY_LABELS,
  DEFAULT_REGISTRATION_STATUS_LABELS,
  DEFAULT_EVENT_STATUS_LABELS,
  DEFAULT_SCHOOL_GRADE_LABELS,
  getAccessibilityLabel,
  getAccessibilityLabels,
  getAgeRangeLabel,
  getAgeRangeLabels,
  getEventStatusLabel,
  getEventTypeLabel,
  getEventTypeLabels,
  getPublicCategoryLabel,
  getPublicCategoryLabels,
  getRegistrationStatusLabel,
  getSchoolGradeLabel,
  getSchoolGradeLabels,
} from '@/lib/config/labelDefaults';

// ============================================================================
// Re-export static defaults for backward compatibility
// ============================================================================

export const EVENT_TYPE_LABELS = DEFAULT_EVENT_TYPE_LABELS;
export const PUBLIC_TYPE_LABELS = DEFAULT_PUBLIC_CATEGORY_LABELS; // Kept for backward compatibility
export const PUBLIC_CATEGORY_LABELS = DEFAULT_PUBLIC_CATEGORY_LABELS;
export const EVENT_STATUS_LABELS = DEFAULT_EVENT_STATUS_LABELS;
export const REGISTRATION_STATUS_LABELS = DEFAULT_REGISTRATION_STATUS_LABELS;
export const ACCESSIBILITY_LABELS = DEFAULT_ACCESSIBILITY_LABELS;
export const SCHOOL_GRADE_LABELS = DEFAULT_SCHOOL_GRADE_LABELS;
export const AGE_RANGE_LABELS = DEFAULT_AGE_RANGE_LABELS;

// ============================================================================
// Re-export static helper functions (for client components)
// These are re-exports from labelDefaults.ts - actual functions are tested there
// ============================================================================

/* c8 ignore start */
export {
  getEventTypeLabel,
  getEventTypeLabels,
  getPublicCategoryLabel,
  getPublicCategoryLabels,
  getEventStatusLabel,
  getRegistrationStatusLabel,
  getAccessibilityLabel,
  getAccessibilityLabels,
  getSchoolGradeLabel,
  getSchoolGradeLabels,
  getAgeRangeLabel,
  getAgeRangeLabels,
};
/* c8 ignore stop */
