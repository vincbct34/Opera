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
const FIRST_OPENING_MONTH_INDEX = 5; // June
const FIRST_OPENING_DAY = 10;

function getAcademicSeasonStartYear(date: Date): number {
  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth() + 1;
  const isOnOrAfterFirstOpening =
    currentMonth > FIRST_OPENING_MONTH_INDEX + 1 ||
    (currentMonth === FIRST_OPENING_MONTH_INDEX + 1 && date.getDate() >= FIRST_OPENING_DAY);

  return isOnOrAfterFirstOpening ? currentYear : currentYear - 1;
}

export class HolidaysService {
  private static readonly API_BASE_URL =
    'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records';

  /**
   * Get the current academic season (e.g., "2025-2026")
   */
  private static getCurrentSeason(): string {
    const now = new Date();
    const startYear = getAcademicSeasonStartYear(now);

    // Registration season starts on June 10 for the following academic year.
    return `${startYear}-${startYear + 1}`;
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

    // Registration opens in waves anchored on school holiday ends. When the API is
    // unavailable we fall back to approximate dates for the Montpellier academy so the
    // waves still progress instead of blocking every event.
    const seasonStartYear = getAcademicSeasonStartYear(now);
    const toussaintEnd = holidays.toussaint?.end || new Date(seasonStartYear, 10, 7); // ~Nov 7th default
    const christmasEnd = holidays.christmas?.end || new Date(seasonStartYear + 1, 0, 6); // ~Jan 6th default

    // Wave 1 — June 10 to Toussaint end: open until Toussaint end.
    if (now <= toussaintEnd) {
      return toussaintEnd;
    }

    // Wave 2 — Toussaint end to Christmas end: open until Christmas end.
    if (now <= christmasEnd) {
      return christmasEnd;
    }

    // Wave 3 — Christmas end to end of season: open everything (~end of July).
    return new Date(seasonStartYear + 1, 6, 31); // July 31st
  }
}
