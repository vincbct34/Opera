import { logger } from '@/lib/middleware/logger';
import { Accessibility, PublicCategory, SchoolGrade, AgeRange } from '@/app/generated/prisma/enums';
import {
  formatLocation,
  mapAccessibilityIds,
  mapEventType,
  mapPublicIdsToCategories,
  mapPublicNamesToCategories,
  mapAgeIdsToRanges,
} from '@/lib/cron/scraperMappings';
import type { EventType } from '@/lib/cron/scraperMappings';

// Re-export type for backward compatibility (types don't generate ESM getters)
export type { EventType };

export type EventDate = {
  date: string;
  complet: boolean;
  annule: boolean;
  report: boolean;
};

export type ApiEvent = {
  // Mapped to DB Event model (formatted for Prisma)
  title: string;
  slug: string | null;
  description: string | null;
  type: EventType[];
  category: PublicCategory[];
  grades: SchoolGrade[];
  age_ranges: AgeRange[];
  location: string;
  duration: number; // in minutes
  total_seats: number;
  caretaker: number | null; // Number of caretakers/supervisors allowed
  image_url: string | null;
  event_dates: Date[]; // Array of DateTime
  has_initial_formation: boolean;
  has_musical_preparation: boolean;
  accessibility: Accessibility[]; // Accessibility types for this event

  // Additional fields from WordPress
  link: string;
};

// WordPress API Event type
type WordPressEvent = {
  class_list?: string[];
  link?: string;
  slug?: string;
  title?: {
    rendered?: string;
  };
  acf?: {
    diaporama_header?: Array<{
      visuel?: number;
    }>;
    colonne_centrale?: {
      texte?: string;
    };
    colonne_de_gauche?: {
      duree?: string;
      public?: number[];
      age?: number[];
      accessibilite?: number[];
    };
    colonne_de_droite?: {
      dates?: EventDate[];
    };
  };
};

const WP_API_BASE = 'https://www.opera-orchestre-montpellier.fr/wp-json/wp/v2';

/**
 * Get the current academic season
 * Academic year runs from September to July
 * Returns both long format (YYYY-YY) and short format (YY-YY)
 * Example: September 2025 to July 2026 = { long: "2025-26", short: "25-26" }
 */
export function getCurrentSeason(): { long: string; short: string } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed

  // If we're between September (9) and December (12), we're in the first part of the academic year
  // If we're between January (1) and July (7), we're in the second part of the academic year
  // If we're in August (8), we consider it as the next academic year starting soon

  let startYear: number;
  if (currentMonth >= 9) {
    // September to December: current year is the start year
    startYear = currentYear;
  } else if (currentMonth >= 1 && currentMonth <= 7) {
    // January to July: previous year is the start year
    startYear = currentYear - 1;
  } else {
    // August: next academic year starts soon, use current year
    startYear = currentYear;
  }

  const endYear = startYear + 1;
  const startYearShort = startYear.toString().slice(-2); // Get last 2 digits
  const endYearShort = endYear.toString().slice(-2); // Get last 2 digits

  return {
    long: `${startYear}-${endYearShort}`, // e.g., "2025-26"
    short: `${startYearShort}-${endYearShort}`, // e.g., "25-26"
  };
}

/**
 * Filter callback to find event type classes
 * Matches classes starting with "etypes-"
 */
export function filterEventTypeClass(cls: string): boolean {
  return cls.startsWith('etypes-');
}

/**
 * Map callback to extract event type from class name
 * Removes the "etypes-" prefix
 */
export function mapEventTypeFromClass(cls: string): string {
  return cls.replace('etypes-', '');
}

/**
 * Extract event types from class_list
 * Looks for classes starting with "etypes-" and returns all parts after the prefix
 */
export function extractEventTypes(classList: string[]): string[] {
  const typeClasses = classList.filter(filterEventTypeClass);
  return typeClasses.map(mapEventTypeFromClass);
}

/**
 * Named public class filter callback
 * Created by createPublicClassFilter to filter classes
 * Exported for testing purposes
 */
export function publicClassFilterCallback(
  this: { seasonPrefix: string; genericClass: string },
  cls: string,
): boolean {
  return cls.startsWith(this.seasonPrefix) && cls !== this.genericClass;
}

/**
 * Create a filter function for public name classes
 * Returns a function that filters classes by season prefix and excludes "scolaires"
 * @param seasonPrefix - The season prefix (e.g., "saisons-25-26-")
 * @returns A filter function for Array.filter
 */
export function createPublicClassFilter(seasonPrefix: string): (cls: string) => boolean {
  const genericClass = `${seasonPrefix}scolaires`;
  return publicClassFilterCallback.bind({ seasonPrefix, genericClass });
}

/**
 * Named public name mapper callback
 * Created by createPublicNameMapper to extract public names
 * Exported for testing purposes
 */
export function publicNameMapperCallback(this: { seasonPrefix: string }, cls: string): string {
  return cls.replace(this.seasonPrefix, '').replace(/-/g, ' ');
}

/**
 * Create a mapper function to extract public names from classes
 * Returns a function that removes season prefix and replaces hyphens with spaces
 * @param seasonPrefix - The season prefix to remove
 * @returns A mapper function for Array.map
 */
export function createPublicNameMapper(seasonPrefix: string): (cls: string) => string {
  return publicNameMapperCallback.bind({ seasonPrefix });
}

/**
 * Extract public names from class_list
 * Looks for classes matching pattern: saisons-XX-YY-<public_name>
 * Examples: "saisons-25-26-lycees", "saisons-25-26-associations"
 * @param classList - Array of class names from WordPress
 * @param season - Current season in format "YY-YY" (short format)
 * @returns Array of public names
 */
export function extractPublicNames(classList: string[], season: string): string[] {
  const seasonPrefix = `saisons-${season}-`;

  // Filter classes that start with the season prefix and exclude the generic "scolaires" one
  const publicClassFilter = createPublicClassFilter(seasonPrefix);
  const publicClasses = classList.filter(publicClassFilter);

  // Extract public names by removing the season prefix and replacing hyphens with spaces
  const publicNameMapper = createPublicNameMapper(seasonPrefix);
  const publicNames = publicClasses.map(publicNameMapper);

  return publicNames;
}

/**
 * Extract duration in minutes from HTML duration string
 */
export function extractDuration(durationHtml: string | null): number {
  if (!durationHtml) return 90;

  // Try to extract hours and minutes
  // hourMatch: digits followed by 'h' (e.g., "1h", "1 h")
  const hourMatch = durationHtml.match(/(\d+)\s*h/i);
  // minuteMatch: digits immediately after 'h' OR digits followed by 'min'/'mn'
  // Handles: "1h30", "1h 30", "35min", "35 min", "1h30min"
  const minuteMatch = durationHtml.match(/(?:h\s*(\d+))|(\d+)\s*(?:min|mn)/i);

  let totalMinutes = 0;
  if (hourMatch) {
    totalMinutes += parseInt(hourMatch[1], 10) * 60;
  }

  if (minuteMatch) {
    const mins = minuteMatch[1] || minuteMatch[2];
    if (mins) {
      totalMinutes += parseInt(mins, 10);
    }
  }

  // Fallback: if no units found, try to extract any number (e.g., "90")
  if (totalMinutes === 0) {
    const rawMatch = durationHtml.match(/(\d+)/);
    if (rawMatch) {
      totalMinutes = parseInt(rawMatch[1], 10);
    }
  }

  return totalMinutes > 0 ? totalMinutes : 90;
}

/**
 * Strip HTML tags from text
 */
export function stripHtml(html: string | null): string | null {
  if (!html) return null;
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&rsquo;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\r\n/g, '\n')
    .replace(/&#038;/g, '&')
    .trim();
}

/**
 * Parse description to extract formation and preparation information
 * and remove the "Autour du concert" or "Autour du spectacle" section
 */
export function parseDescriptionForEducationalContent(description: string | null): {
  hasInitialFormation: boolean;
  hasMusicalPreparation: boolean;
  enhancedDescription: string | null;
} {
  if (!description) {
    return {
      hasInitialFormation: false,
      hasMusicalPreparation: false,
      enhancedDescription: null,
    };
  }

  // Check for "Autour du concert" or "Autour du spectacle" section and look for specific items
  const hasInitialFormation = /Autour du (?:concert|spectacle)[\s\S]*?\s*Formation/i.test(
    description,
  );

  const hasMusicalPreparation =
    /Autour du (?:concert|spectacle)[\s\S]*?\s*Préparation musicale/i.test(description);

  // Remove "Autour du concert" or "Autour du spectacle" section from description
  const enhancedDescription = description
    .replace(/Autour du (?:concert|spectacle)[\s\S]*/i, '')
    .trim();

  return {
    hasInitialFormation,
    hasMusicalPreparation,
    enhancedDescription,
  };
}

/**
 * Convert WordPress event dates to Date objects
 */
/**
 * Filter callback to check if an event date is valid (not cancelled or postponed)
 */
export function filterValidEventDate(d: EventDate): boolean {
  return !d.annule && !d.report;
}

/**
 * Map callback to convert EventDate to Date object
 */
export function mapEventDateToDate(d: EventDate): Date {
  return new Date(d.date);
}

/**
 * Filter callback to check if a Date is valid
 */
export function filterValidDate(d: Date): boolean {
  return !isNaN(d.getTime());
}

/**
 * Convert WordPress event dates to Date objects
 */
export function convertEventDates(wpDates: EventDate[]): Date[] {
  return wpDates.filter(filterValidEventDate).map(mapEventDateToDate).filter(filterValidDate);
}

/**
 * Filter classes that start with "lieux-" prefix
 * Used by extractLocation to find location classes
 */
export function filterLocationClasses(classList: string[]): string[] {
  return classList.filter((cls) => cls.startsWith('lieux-'));
}

/**
 * Reduce callback to find the location with the longest formatted name
 * Used by extractLocation to select the most specific location
 */
export function findLongestLocationClass(longest: string, current: string): string {
  const longestFormatted = formatLocation(longest).location;
  const currentFormatted = formatLocation(current).location;
  return currentFormatted.length > longestFormatted.length ? current : longest;
}

/**
 * Extract location from class_list
 * Looks for classes starting with "lieux-" and returns the one with the longest formatted name
 */
export function extractLocation(classList: string[]): string | null {
  // Filter all classes that start with "lieux-"
  const locationClasses = filterLocationClasses(classList);

  // If no location classes found, return null
  if (locationClasses.length === 0) return null;

  // Return the one with the longest formatted location name (most specific)
  return locationClasses.reduce(findLongestLocationClass);
}

/**
 * Fetch the image URL from WordPress media API
 * @param mediaId - The media ID to fetch
 * @returns The image URL from guid.rendered or null if not found
 */
export async function fetchImageUrl(mediaId: number | null): Promise<string | null> {
  if (!mediaId) return null;

  try {
    const res = await fetch(`${WP_API_BASE}/media/${mediaId}`, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      logger.error(`Failed to fetch media ${mediaId}:`, res.statusText);
      return null;
    }
    const mediaData = await res.json();
    return mediaData.guid?.rendered || null;
  } catch (error) {
    logger.error(`Error fetching media ${mediaId}:`, error);
    return null;
  }
}

/**
 * Check if an event belongs to the current season
 * @param event - The WordPress event to check
 * @param seasonFilter - The season filter string (e.g., "saisons-2025-26-scolaires")
 * @returns true if the event belongs to the specified season
 */
export function isCurrentSeasonEvent(event: WordPressEvent, seasonFilter: string): boolean {
  return !!(event.class_list && event.class_list.includes(seasonFilter));
}

/**
 * Named season filter callback
 * Created by createSeasonFilter to filter events by season
 * Exported for testing purposes
 */
export function seasonFilterCallback(
  this: { seasonFilter: string },
  event: WordPressEvent,
): boolean {
  return isCurrentSeasonEvent(event, this.seasonFilter);
}

/**
 * Create a filter function for a specific season
 * Returns a filter function that can be used with Array.filter
 * @param seasonFilter - The season filter string
 * @returns A filter function for Array.filter
 */
export function createSeasonFilter(
  seasonFilter: string,
): (event: { class_list?: string[] }) => boolean {
  return seasonFilterCallback.bind({ seasonFilter });
}

/**
 * Transform a WordPress event to an API event
 * @param event - The WordPress event to transform
 * @param currentSeason - The current academic season info
 * @returns The transformed API event
 */
export async function transformWordPressEvent(
  event: WordPressEvent,
  currentSeason: { long: string; short: string },
): Promise<ApiEvent> {
  const classList = event.class_list!;
  const mediaId = event.acf?.diaporama_header?.[0]?.visuel;

  // Fetch image URL
  const imageUrl = await fetchImageUrl(mediaId ?? null);

  // Extract public IDs from ACF field (primary source)
  const publicIds = event.acf?.colonne_de_gauche?.public || [];
  // Fallback: Extract public names from class_list using short format (25-26)
  const publicNames = extractPublicNames(classList, currentSeason.short);
  // Extract age IDs from ACF field
  const ageIds = event.acf?.colonne_de_gauche?.age || [];
  // Extract accessibility IDs from ACF field
  const accessibilityIds = event.acf?.colonne_de_gauche?.accessibilite || [];

  const rawTypes = extractEventTypes(classList);
  const rawLocation = extractLocation(classList);
  const rawDescription = event.acf?.colonne_centrale?.texte ?? null;
  const rawDuration = event.acf?.colonne_de_gauche?.duree ?? null;
  const rawDates = event.acf?.colonne_de_droite?.dates || [];
  const rawTitle = event.title?.rendered ?? null;

  const locationData = formatLocation(rawLocation);

  // Parse description for educational content
  const strippedDescription = stripHtml(rawDescription);
  const educationalContent = parseDescriptionForEducationalContent(strippedDescription);

  // Map WordPress public data to category + grades
  const mappedPublicData =
    publicIds.length > 0
      ? mapPublicIdsToCategories(publicIds)
      : mapPublicNamesToCategories(publicNames);

  // Map WordPress age IDs to age_ranges
  const mappedAgeRanges = mapAgeIdsToRanges(ageIds);

  return {
    // WordPress specific
    link: event.link || '',

    // DB Event fields (formatted for Prisma)
    title: stripHtml(rawTitle) || 'Sans titre',
    slug: event.slug || null,
    description: educationalContent.enhancedDescription,
    type: mapEventType(rawTypes),
    category: mappedPublicData.categories,
    grades: mappedPublicData.grades,
    age_ranges: mappedAgeRanges,
    location: locationData.location,
    duration: extractDuration(rawDuration),
    total_seats: locationData.totalSeats,
    caretaker: null,
    image_url: imageUrl,
    event_dates: convertEventDates(rawDates),
    has_initial_formation: educationalContent.hasInitialFormation,
    has_musical_preparation: educationalContent.hasMusicalPreparation,
    accessibility: mapAccessibilityIds(accessibilityIds),
  };
}

/**
 * Named event mapper callback
 * Created by createEventMapper to transform WordPress events
 * Exported for testing purposes
 */
export async function eventMapperCallback(
  this: { currentSeason: { long: string; short: string } },
  event: WordPressEvent,
): Promise<ApiEvent> {
  return transformWordPressEvent(event, this.currentSeason);
}

/**
 * Create a mapper function for transforming events
 * Returns a callback that can be used with Array.map
 * @param currentSeason - The current academic season info
 * @returns A mapper function for Array.map
 */
export function createEventMapper(currentSeason: {
  long: string;
  short: string;
}): (event: WordPressEvent) => Promise<ApiEvent> {
  // Use bind to create a function with the currentSeason in context
  return eventMapperCallback.bind({ currentSeason });
}

/**
 * Scrape events from the WordPress API
 * Only includes events for the current academic season
 */
export async function scrapeEvents() {
  const events = [];

  const perPage = 100;
  let page = 1;

  // Get the current academic season dynamically
  const currentSeason = getCurrentSeason();
  // seasonFilter uses long format: "saisons-2025-26-scolaires"
  const seasonFilter = `saisons-${currentSeason.long}-scolaires`;

  while (true) {
    // Pagination loop
    const res = await fetch(`${WP_API_BASE}/spectacle?per_page=${perPage}&page=${page}`, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      logger.error('Failed to fetch events:', res.statusText);
      break;
    }

    const data = await res.json();
    if (data.length === 0) break;

    // Filter events that have the current season in their class_list
    const seasonFilterFn = createSeasonFilter(seasonFilter);
    const schoolEvents = data.filter(seasonFilterFn);

    // Map to fields corresponding to DB Event model (with async image fetching)
    const eventMapper = createEventMapper(currentSeason);
    const mappedEventsPromises = schoolEvents.map(eventMapper);

    // Wait for all image URLs to be fetched
    const mappedEvents = await Promise.all(mappedEventsPromises);

    events.push(...mappedEvents);
    if (data.length < perPage) break;
    page++;
  }

  return events;
}
