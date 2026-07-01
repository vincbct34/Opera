/**
 * Types partagés pour le système de scoring
 */

import type { ScoringCriterionType, ParameterValue } from '@/lib/scoring/criteriaDefinitions';
import type { RegistrationStatus } from '@prisma/client';

/**
 * Configuration data for the scoring system.
 * Defines how registrations are scored based on various criteria.
 */
export interface ScoringConfigurationData {
  id?: string;
  name: string;
  is_default: boolean;
  event_id?: string | null;
  criteria: CriterionData[];
  event?: { id: string; title: string } | null;
}

/**
 * Definition of a single scoring criterion within a configuration.
 */
export interface CriterionData {
  id?: string;
  type: ScoringCriterionType;
  enabled: boolean;
  weight: number;
  parameters?: Record<string, ParameterValue>;
  order: number;
}

/**
 * Detailed breakdown of how a score was calculated for a specific criterion.
 */
export interface ScoreBreakdownItem {
  criterion: string;
  weight: number;
  rawScore: number;
  weightedScore: number;
}

/**
 * Item in the scoring preview list.
 * Represents a simulated score for a registration.
 */
export interface PreviewDataItem {
  registrationId: string;
  institutionId: string;
  institutionName: string;
  userFullName: string;
  score: number;
  breakdown: ScoreBreakdownItem[];
}

/**
 * Complete data structure for the scoring preview modal.
 * Includes the list of scored registrations and global statistics.
 */
export interface PreviewData {
  registrations: PreviewDataItem[];
  stats: {
    total: number;
    avgScore: number;
    minScore: number;
    maxScore: number;
  };
}

/**
 * Detailed history data for an institution.
 * Used to display the institution's track record and health status.
 */
export interface HistoryData {
  success: boolean;
  institutionId: string;
  institutionName: string;
  health?: {
    level: 'excellent' | 'good' | 'fair' | 'poor' | 'new';
    icon: string;
  };
  history?: {
    totalRegistrations: number;
    confirmedCount: number;
    attendedCount: number;
    noShowCount: number;
    cancelledCount: number;
    confirmationRate: number;
    attendanceRate: number;
    lastAttendedDate: Date | null;
    monthsSinceLastAttendance: number | null;
    recentNoShow: boolean;
    recentRegistrations?: Array<{
      eventId: string;
      eventTitle: string;
      eventLocation?: string;
      date: Date;
      status: RegistrationStatus;
      wasPresent: boolean | null;
      comment?: string;
      bookedSeats: number;
      caretakerCount?: number;
      aeshCount?: number;
      category?: string[];
      grades?: string[];
      ageRanges?: string[];
      disabilitiesCount?: number;
      wantFormation?: boolean;
      wantPreparation?: boolean;
    }>;
  };
  summary?: string;
  report?: string;
}
