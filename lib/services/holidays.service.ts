import { logger } from '@/lib/middleware/logger';

// Types for the OpenData API response
type OpenDataRecord = {
  description: string;
  population: string;
  start_date: string;
  end_date: string;
  location: string;
  zones: string;
  annee_scolaire: string;
};

type OpenDataResponse = {
  total_count: number;
  results: OpenDataRecord[];
};

export type HolidayDates = {
  toussaint: { start: Date; end: Date } | null;
  christmas: { start: Date; end: Date } | null;
};

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export class HolidaysService {
  private static readonly API_BASE_URL =
    'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records';

  /**
   * Get the current academic season (e.g., "2025-2026")
   */
  private static getCurrentSeason(): string {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Academic year starts in September
    if (currentMonth >= 9) {
      return `${currentYear}-${currentYear + 1}`;
    } else {
      return `${currentYear - 1}-${currentYear}`;
    }
  }

  /**
   * Fetch holidays for the current season and Montpellier academy
   */
  /**
   * Fetch holidays for the current season and Montpellier academy
   */
  static async fetchHolidayDates(retryCount = 0): Promise<HolidayDates> {
    const season = this.getCurrentSeason();
    // Filter for Montpellier academy and student holidays ("Élèves")
    const query = encodeURIComponent(
      `location="Montpellier" AND annee_scolaire="${season}" AND population="Élèves" AND (description="Vacances de la Toussaint" OR description="Vacances de Noël")`,
    );

    const url = `${this.API_BASE_URL}?where=${query}&limit=10`;

    try {
      const response = await fetch(url, { next: { revalidate: 86400 } }); // Cache for 24h

      if (!response.ok) {
        throw new Error(`Failed to fetch holidays: ${response.statusText}`);
      }

      const data: OpenDataResponse = await response.json();

      const holidays: HolidayDates = {
        toussaint: null,
        christmas: null,
      };

      for (const record of data.results) {
        // Parse dates (API returns YYYY-MM-DDTHH:mm:ss+ZZ:ZZ)
        const start = new Date(record.start_date);
        const end = new Date(record.end_date);

        if (record.description === 'Vacances de la Toussaint') {
          holidays.toussaint = { start, end };
        } else if (record.description === 'Vacances de Noël') {
          holidays.christmas = { start, end };
        }
      }

      logger.info('Fetched holiday dates', { season, holidays });
      return holidays;
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        logger.warn(
          `Failed to fetch holidays (attempt ${retryCount + 1}/${MAX_RETRIES}), retrying...`,
          error,
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        return this.fetchHolidayDates(retryCount + 1);
      }

      logger.error('Error fetching holiday dates after retries:', error);
      // Return nulls if we can't fetch, calling code should handle fallbacks
      return { toussaint: null, christmas: null };
    }
  }

  /**
   * Calculate the limit date for opening events
   * @param overrideDate Optional date to simulate "now" (for testing/debugging)
   */
  static async getOpeningLimitDate(overrideDate?: Date): Promise<Date> {
    const now = overrideDate || new Date();
    const holidays = await this.fetchHolidayDates();

    // Default fallback dates if API fails (approximate for 2025-2026 based on common patterns)
    // These should definitely be correct in the DB/API, but as a fallback:
    // Toussaint: End of Oct / Start of Nov
    // Christmas: End of Dec / Start of Jan

    // Safety fallback: if no data, open everything (or nothing? User said "events open petit a petit").
    // Better to be conservative? Or permissive?
    // If API fails, let's look at the implementation plan logic.
    // If we can't get dates, we can't implement the waves.
    // Let's assume we return a far future date if we can't decide, or "end of season".
    // Actually, if we fail, maybe we shouldn't block everything.
    // Let's try to infer from typical months if holidays are missing.

    const currentYear = now.getFullYear();
    const toussaintEnd = holidays.toussaint?.end || new Date(currentYear, 10, 7); // ~Nov 7th default
    const christmasEnd =
      holidays.christmas?.end || new Date(currentYear + (now.getMonth() >= 9 ? 1 : 0), 0, 6); // ~Jan 6th default

    // Logic:
    // 1. Sept -> Toussaint End: Open until Toussaint End
    if (now <= toussaintEnd) {
      return toussaintEnd;
    }

    // 2. Toussaint End -> Christmas End: Open until Christmas End
    if (now <= christmasEnd) {
      return christmasEnd;
    }

    // 3. Christmas End -> End of Season: Open everything (End of Season ~ July)
    // Return a date far in the future
    return new Date(now.getFullYear() + 1, 6, 31); // July 31st next year
  }
}
