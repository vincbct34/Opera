/**
 * SERVER-ONLY: Dynamic label mappings with database integration
 *
 * This file MUST ONLY be imported in server components, API routes, or server actions.
 * DO NOT import this file in client components - use labelMappings.ts instead.
 *
 * These functions retrieve labels from the database configuration via configService,
 * with automatic fallback to static defaults when the database is unavailable.
 */

import { getConfig } from '@/lib/config/configService';
import {
  DEFAULT_ACCESSIBILITY_LABELS,
  DEFAULT_AGE_RANGE_LABELS,
  DEFAULT_EVENT_TYPE_LABELS,
  DEFAULT_PUBLIC_CATEGORY_LABELS,
  DEFAULT_REGISTRATION_STATUS_LABELS,
  DEFAULT_EVENT_STATUS_LABELS,
  DEFAULT_SCHOOL_GRADE_LABELS,
} from '@/lib/config/labelDefaults';

// ============================================================================
// Type Definitions
// ============================================================================

type LabelMap = Record<string, string>;

// ============================================================================
// Dynamic helper functions (SERVER-ONLY)
// ============================================================================

/**
 * SERVER-ONLY: Get event type labels from database config (with defaults fallback)
 * @example const label = await getEventTypeLabelAsync('OPERA')
 */
export async function getEventTypeLabelAsync(type: string): Promise<string> {
  const labels = await getEventTypeLabelsMapAsync();
  return labels[type] || type;
}

/**
 * SERVER-ONLY: Get all event type labels from database config (with defaults fallback)
 */
export async function getEventTypeLabelsMapAsync(): Promise<LabelMap> {
  try {
    const config = await getConfig('event_type_labels');
    return { ...DEFAULT_EVENT_TYPE_LABELS, ...config };
  } catch {
    return DEFAULT_EVENT_TYPE_LABELS;
  }
}

/**
 * SERVER-ONLY: Get public category labels from database config (with defaults fallback)
 */
export async function getPublicCategoryLabelAsync(type: string): Promise<string> {
  const labels = await getPublicCategoryLabelsMapAsync();
  return labels[type] || type;
}

/**
 * SERVER-ONLY: Get all public category labels from database config (with defaults fallback)
 */
export async function getPublicCategoryLabelsMapAsync(): Promise<LabelMap> {
  try {
    const config = await getConfig('public_category_labels');
    return { ...DEFAULT_PUBLIC_CATEGORY_LABELS, ...config };
  } catch {
    return DEFAULT_PUBLIC_CATEGORY_LABELS;
  }
}

/**
 * SERVER-ONLY: Get school grade labels from database config (with defaults fallback)
 */
export async function getSchoolGradeLabelsMapAsync(): Promise<LabelMap> {
  try {
    const config = await getConfig('school_grade_labels');
    return { ...DEFAULT_SCHOOL_GRADE_LABELS, ...config };
  } catch {
    return DEFAULT_SCHOOL_GRADE_LABELS;
  }
}

/**
 * SERVER-ONLY: Get age range labels from database config (with defaults fallback)
 */
export async function getAgeRangeLabelsMapAsync(): Promise<LabelMap> {
  try {
    const config = await getConfig('age_range_labels');
    return { ...DEFAULT_AGE_RANGE_LABELS, ...config };
  } catch {
    return DEFAULT_AGE_RANGE_LABELS;
  }
}

/**
 * @deprecated Use getPublicCategoryLabelAsync instead
 */
export async function getPublicTypeLabelAsync(type: string): Promise<string> {
  return getPublicCategoryLabelAsync(type);
}

/**
 * @deprecated Use getPublicCategoryLabelsMapAsync instead
 */
export async function getPublicTypeLabelsMapAsync(): Promise<LabelMap> {
  return getPublicCategoryLabelsMapAsync();
}

/**
 * SERVER-ONLY: Get registration status labels from database config (with defaults fallback)
 */
export async function getRegistrationStatusLabelAsync(status: string): Promise<string> {
  const labels = await getRegistrationStatusLabelsMapAsync();
  return labels[status] || status;
}

/**
 * SERVER-ONLY: Get all registration status labels from database config (with defaults fallback)
 */
export async function getRegistrationStatusLabelsMapAsync(): Promise<LabelMap> {
  try {
    const config = await getConfig('registration_status_labels');
    return { ...DEFAULT_REGISTRATION_STATUS_LABELS, ...config };
  } catch {
    return DEFAULT_REGISTRATION_STATUS_LABELS;
  }
}

/**
 * SERVER-ONLY: Get accessibility labels from database config (with defaults fallback)
 */
export async function getAccessibilityLabelAsync(type: string): Promise<string> {
  const labels = await getAccessibilityLabelsMapAsync();
  return labels[type] || type;
}

/**
 * SERVER-ONLY: Get all accessibility labels from database config (with defaults fallback)
 */
export async function getAccessibilityLabelsMapAsync(): Promise<LabelMap> {
  try {
    const config = await getConfig('accessibility_labels');
    return { ...DEFAULT_ACCESSIBILITY_LABELS, ...config };
  } catch {
    return DEFAULT_ACCESSIBILITY_LABELS;
  }
}

/**
 * SERVER-ONLY: Get event status labels from database config (with defaults fallback)
 */
export async function getEventStatusLabelAsync(status: string): Promise<string> {
  const labels = await getEventStatusLabelsMapAsync();
  return labels[status] || status;
}

/**
 * SERVER-ONLY: Get all event status labels from database config (with defaults fallback)
 */
export async function getEventStatusLabelsMapAsync(): Promise<LabelMap> {
  try {
    const config = await getConfig('event_status_labels');
    return { ...DEFAULT_EVENT_STATUS_LABELS, ...config };
  } catch {
    return DEFAULT_EVENT_STATUS_LABELS;
  }
}

/**
 * SERVER-ONLY: Get all label categories at once (efficient batch loading)
 * Returns a map of category -> labels
 */
export async function getAllLabelsAsync(): Promise<Record<string, LabelMap>> {
  try {
    const [eventType, publicCategory, eventStatus, registrationStatus, accessibility] =
      await Promise.all([
        getConfig('event_type_labels'),
        getConfig('public_category_labels'),
        getConfig('event_status_labels'),
        getConfig('registration_status_labels'),
        getConfig('accessibility_labels'),
      ]);

    return {
      event_type_labels: { ...DEFAULT_EVENT_TYPE_LABELS, ...eventType },
      public_category_labels: { ...DEFAULT_PUBLIC_CATEGORY_LABELS, ...publicCategory },
      event_status_labels: { ...DEFAULT_EVENT_STATUS_LABELS, ...eventStatus },
      registration_status_labels: { ...DEFAULT_REGISTRATION_STATUS_LABELS, ...registrationStatus },
      accessibility_labels: { ...DEFAULT_ACCESSIBILITY_LABELS, ...accessibility },
    };
  } catch {
    return {
      event_type_labels: DEFAULT_EVENT_TYPE_LABELS,
      public_category_labels: DEFAULT_PUBLIC_CATEGORY_LABELS,
      event_status_labels: DEFAULT_EVENT_STATUS_LABELS,
      registration_status_labels: DEFAULT_REGISTRATION_STATUS_LABELS,
      accessibility_labels: DEFAULT_ACCESSIBILITY_LABELS,
    };
  }
}
