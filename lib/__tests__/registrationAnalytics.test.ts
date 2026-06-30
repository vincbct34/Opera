import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  calculateInstitutionHistory,
  calculateMultipleInstitutionHistories,
  formatHistorySummary,
  getHistoryHealth,
  generateHistoryReport,
  historyCache,
  calculateInstitutionHistoryWithCache,
} from '../events/registrationAnalytics';
import type { InstitutionHistory } from '../scoring/scoringEngine';
import { RegistrationStatus } from '@/app/generated/prisma/enums';
import { type PrismaClient } from '@/app/generated/prisma/client';

// Type for mock registration records (using string for easier test writing)
interface MockRegistrationInput {
  id: string;
  event_id: string;
  status: string;
  date: Date;
  created_at: Date;
  was_present_comment: string | null;
  booked_seats?: number;
  caretaker_count?: number | null;
  aesh_count?: number | null;
  category?: string[] | null;
  grades?: string[] | null;
  age_ranges?: string[] | null;
  want_formation?: boolean | null;
  want_preparation?: boolean | null;
  disabilities?: Array<{ count: number }>;
  event: {
    id: string;
    title: string;
    location?: string | null;
  };
}

// Type with proper RegistrationStatus
interface MockRegistration {
  id: string;
  event_id: string;
  status: RegistrationStatus;
  date: Date;
  created_at: Date;
  was_present_comment: string | null;
  booked_seats: number;
  caretaker_count?: number | null;
  aesh_count?: number | null;
  category?: string[] | null;
  grades?: string[] | null;
  age_ranges?: string[] | null;
  want_formation?: boolean | null;
  want_preparation?: boolean | null;
  disabilities?: Array<{ count: number }>;
  event: {
    id: string;
    title: string;
    location?: string | null;
  };
}

// Mock Prisma Client - accepts input with string status and casts internally
const createMockPrisma = (registrations: MockRegistrationInput[] = []): PrismaClient => {
  const typedRegistrations: MockRegistration[] = registrations.map((r) => ({
    ...r,
    status: r.status as RegistrationStatus,
    booked_seats: r.booked_seats ?? 0,
  }));
  return {
    registration: {
      findMany: async () => typedRegistrations,
    },
  } as unknown as PrismaClient;
};

describe('registrationAnalytics', () => {
  beforeEach(() => {
    historyCache.clear();
  });

  describe('calculateInstitutionHistory', () => {
    it('should return empty history for institution with no registrations', async () => {
      const prisma = createMockPrisma([]);

      const result = await calculateInstitutionHistory('inst-123', prisma);

      expect(result.institutionId).toBe('inst-123');
      expect(result.totalRegistrations).toBe(0);
      expect(result.confirmedCount).toBe(0);
      expect(result.attendedCount).toBe(0);
      expect(result.noShowCount).toBe(0);
      expect(result.cancelledCount).toBe(0);
      expect(result.attendanceRate).toBe(0);
      expect(result.confirmationRate).toBe(0);
      expect(result.lastAttendedDate).toBeNull();
      expect(result.monthsSinceLastAttendance).toBeNull();
      expect(result.recentNoShow).toBe(false);
      expect(result.recentRegistrations).toHaveLength(0);
    });

    it('should count confirmed registrations correctly', async () => {
      const registrations = [
        {
          id: '1',
          event_id: 'event-1',
          status: 'CONFIRMED',
          date: new Date('2024-01-01'),
          created_at: new Date('2023-12-01'),
          was_present_comment: null,
          event: { id: 'event-1', title: 'Event 1' },
        },
        {
          id: '2',
          event_id: 'event-2',
          status: 'CONFIRMED',
          date: new Date('2024-02-01'),
          created_at: new Date('2024-01-01'),
          was_present_comment: null,
          event: { id: 'event-2', title: 'Event 2' },
        },
      ];

      const prisma = createMockPrisma(registrations);
      const result = await calculateInstitutionHistory('inst-123', prisma);

      expect(result.totalRegistrations).toBe(2);
      expect(result.confirmedCount).toBe(2);
      expect(result.attendedCount).toBe(0);
      expect(result.confirmationRate).toBe(100);
      expect(result.attendanceRate).toBe(0);
    });

    it('should count attended registrations correctly', async () => {
      const registrations = [
        {
          id: '1',
          event_id: 'event-1',
          status: 'ATTENDED',
          date: new Date('2024-01-15'),
          created_at: new Date('2023-12-01'),
          was_present_comment: 'Great event',
          event: { id: 'event-1', title: 'Event 1' },
        },
        {
          id: '2',
          event_id: 'event-2',
          status: 'ATTENDED',
          date: new Date('2024-02-15'),
          created_at: new Date('2024-01-01'),
          was_present_comment: null,
          event: { id: 'event-2', title: 'Event 2' },
        },
      ];

      const prisma = createMockPrisma(registrations);
      const result = await calculateInstitutionHistory('inst-123', prisma);

      expect(result.totalRegistrations).toBe(2);
      expect(result.confirmedCount).toBe(2);
      expect(result.attendedCount).toBe(2);
      expect(result.attendanceRate).toBe(100);
    });

    it('should calculate attendance rate correctly', async () => {
      const registrations = [
        {
          id: '1',
          event_id: 'event-1',
          status: 'ATTENDED',
          date: new Date('2024-01-01'),
          created_at: new Date('2023-12-01'),
          was_present_comment: null,
          event: { id: 'event-1', title: 'Event 1' },
        },
        {
          id: '2',
          event_id: 'event-2',
          status: 'ATTENDED',
          date: new Date('2024-02-01'),
          created_at: new Date('2024-01-01'),
          was_present_comment: null,
          event: { id: 'event-2', title: 'Event 2' },
        },
        {
          id: '3',
          event_id: 'event-3',
          status: 'NO_SHOW',
          date: new Date('2024-03-01'),
          created_at: new Date('2024-02-01'),
          was_present_comment: null,
          event: { id: 'event-3', title: 'Event 3' },
        },
        {
          id: '4',
          event_id: 'event-4',
          status: 'CONFIRMED',
          date: new Date('2024-04-01'),
          created_at: new Date('2024-03-01'),
          was_present_comment: null,
          event: { id: 'event-4', title: 'Event 4' },
        },
      ];

      const prisma = createMockPrisma(registrations);
      const result = await calculateInstitutionHistory('inst-123', prisma);

      // 2 attended out of 4 confirmed = 50%
      expect(result.confirmedCount).toBe(4);
      expect(result.attendedCount).toBe(2);
      expect(result.attendanceRate).toBe(50);
    });

    it('should detect recent no-show within 6 months', async () => {
      const fourMonthsAgo = new Date();
      fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);

      const registrations = [
        {
          id: '1',
          event_id: 'event-1',
          status: 'NO_SHOW',
          date: fourMonthsAgo,
          created_at: new Date('2023-12-01'),
          was_present_comment: null,
          event: { id: 'event-1', title: 'Event 1' },
        },
      ];

      const prisma = createMockPrisma(registrations);
      const result = await calculateInstitutionHistory('inst-123', prisma);

      expect(result.recentNoShow).toBe(true);
      expect(result.noShowCount).toBe(1);
    });

    it('should not detect no-show older than 6 months as recent', async () => {
      const sevenMonthsAgo = new Date();
      sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);

      const registrations = [
        {
          id: '1',
          event_id: 'event-1',
          status: 'NO_SHOW',
          date: sevenMonthsAgo,
          created_at: new Date('2023-01-01'),
          was_present_comment: null,
          event: { id: 'event-1', title: 'Event 1' },
        },
      ];

      const prisma = createMockPrisma(registrations);
      const result = await calculateInstitutionHistory('inst-123', prisma);

      expect(result.recentNoShow).toBe(false);
      expect(result.noShowCount).toBe(1);
    });

    it('should count cancelled registrations correctly', async () => {
      const registrations = [
        {
          id: '1',
          event_id: 'event-1',
          status: 'CANCELLED',
          date: new Date('2024-01-01'),
          created_at: new Date('2023-12-01'),
          was_present_comment: null,
          event: { id: 'event-1', title: 'Event 1' },
        },
        {
          id: '2',
          event_id: 'event-2',
          status: 'CANCELLED',
          date: new Date('2024-02-01'),
          created_at: new Date('2024-01-01'),
          was_present_comment: null,
          event: { id: 'event-2', title: 'Event 2' },
        },
      ];

      const prisma = createMockPrisma(registrations);
      const result = await calculateInstitutionHistory('inst-123', prisma);

      expect(result.totalRegistrations).toBe(2);
      expect(result.cancelledCount).toBe(2);
      expect(result.confirmedCount).toBe(0);
    });

    it('should calculate confirmation rate correctly', async () => {
      const registrations = [
        {
          id: '1',
          event_id: 'event-1',
          status: 'CONFIRMED',
          date: new Date('2024-01-01'),
          created_at: new Date('2023-12-01'),
          was_present_comment: null,
          event: { id: 'event-1', title: 'Event 1' },
        },
        {
          id: '2',
          event_id: 'event-2',
          status: 'CANCELLED',
          date: new Date('2024-02-01'),
          created_at: new Date('2024-01-01'),
          was_present_comment: null,
          event: { id: 'event-2', title: 'Event 2' },
        },
        {
          id: '3',
          event_id: 'event-3',
          status: 'PENDING',
          date: new Date('2024-03-01'),
          created_at: new Date('2024-02-01'),
          was_present_comment: null,
          event: { id: 'event-3', title: 'Event 3' },
        },
      ];

      const prisma = createMockPrisma(registrations);
      const result = await calculateInstitutionHistory('inst-123', prisma);

      // 1 confirmed out of 3 total = 33.33%
      expect(result.totalRegistrations).toBe(3);
      expect(result.confirmedCount).toBe(1);
      expect(result.confirmationRate).toBeCloseTo(33.3, 1);
    });

    it('should track last attended date correctly', async () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-03-15');
      const date3 = new Date('2024-02-10');

      const registrations = [
        {
          id: '1',
          event_id: 'event-1',
          status: 'ATTENDED',
          date: date1,
          created_at: new Date('2023-12-01'),
          was_present_comment: null,
          event: { id: 'event-1', title: 'Event 1' },
        },
        {
          id: '2',
          event_id: 'event-2',
          status: 'ATTENDED',
          date: date2,
          created_at: new Date('2024-01-01'),
          was_present_comment: null,
          event: { id: 'event-2', title: 'Event 2' },
        },
        {
          id: '3',
          event_id: 'event-3',
          status: 'ATTENDED',
          date: date3,
          created_at: new Date('2024-02-01'),
          was_present_comment: null,
          event: { id: 'event-3', title: 'Event 3' },
        },
      ];

      const prisma = createMockPrisma(registrations);
      const result = await calculateInstitutionHistory('inst-123', prisma);

      expect(result.lastAttendedDate).toEqual(date2);
    });

    it('should calculate months since last attendance', async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      sixMonthsAgo.setDate(1); // Set to first of month for consistency

      const registrations = [
        {
          id: '1',
          event_id: 'event-1',
          status: 'ATTENDED',
          date: sixMonthsAgo,
          created_at: new Date('2023-12-01'),
          was_present_comment: null,
          event: { id: 'event-1', title: 'Event 1' },
        },
      ];

      const prisma = createMockPrisma(registrations);
      const result = await calculateInstitutionHistory('inst-123', prisma);

      expect(result.monthsSinceLastAttendance).toBeGreaterThanOrEqual(5);
      expect(result.monthsSinceLastAttendance).toBeLessThanOrEqual(7);
    });

    it('should limit recent registrations to 10', async () => {
      const registrations = Array.from({ length: 15 }, (_, i) => ({
        id: `reg-${i}`,
        event_id: `event-${i}`,
        status: 'CONFIRMED',
        date: new Date(`2024-${String((i % 12) + 1).padStart(2, '0')}-01`),
        created_at: new Date('2023-12-01'),
        was_present_comment: null,
        event: { id: `event-${i}`, title: `Event ${i}` },
      }));

      const prisma = createMockPrisma(registrations);
      const result = await calculateInstitutionHistory('inst-123', prisma);

      expect(result.recentRegistrations).toHaveLength(10);
    });

    it('should set wasPresent flag correctly in recent registrations', async () => {
      const registrations = [
        {
          id: '1',
          event_id: 'event-1',
          status: 'ATTENDED',
          date: new Date('2024-01-01'),
          created_at: new Date('2023-12-01'),
          was_present_comment: 'Great',
          event: { id: 'event-1', title: 'Event 1' },
        },
        {
          id: '2',
          event_id: 'event-2',
          status: 'NO_SHOW',
          date: new Date('2024-02-01'),
          created_at: new Date('2024-01-01'),
          was_present_comment: 'Absent',
          event: { id: 'event-2', title: 'Event 2' },
        },
        {
          id: '3',
          event_id: 'event-3',
          status: 'CONFIRMED',
          date: new Date('2024-03-01'),
          created_at: new Date('2024-02-01'),
          was_present_comment: null,
          event: { id: 'event-3', title: 'Event 3' },
        },
      ];

      const prisma = createMockPrisma(registrations);
      const result = await calculateInstitutionHistory('inst-123', prisma);

      expect(result.recentRegistrations[0].wasPresent).toBe(true);
      expect(result.recentRegistrations[1].wasPresent).toBe(false);
      expect(result.recentRegistrations[2].wasPresent).toBeNull();
    });

    it('should include all optional fields in recent registrations', async () => {
      const registrations = [
        {
          id: '1',
          event_id: 'event-1',
          status: 'ATTENDED',
          date: new Date('2024-01-01'),
          created_at: new Date('2023-12-01'),
          was_present_comment: 'Excellent participation',
          booked_seats: 25,
          caretaker_count: 2,
          aesh_count: 1,
          category: ['MATERNELLE', 'ELEMENTAIRE'],
          grades: ['PS', 'CP', 'CE1'],
          age_ranges: ['AGE_3_6', 'AGE_6_11'],
          want_formation: true,
          want_preparation: true,
          disabilities: [{ count: 2 }, { count: 1 }],
          event: { id: 'event-1', title: 'Event 1', location: 'Salle Mozart' },
        },
        {
          id: '2',
          event_id: 'event-2',
          status: 'ATTENDED',
          date: new Date('2024-02-01'),
          created_at: new Date('2024-01-01'),
          was_present_comment: null,
          booked_seats: 30,
          caretaker_count: null,
          aesh_count: null,
          category: [],
          grades: [],
          age_ranges: [],
          want_formation: null,
          want_preparation: null,
          disabilities: [],
          event: { id: 'event-2', title: 'Event 2', location: null },
        },
        {
          id: '3',
          event_id: 'event-3',
          status: 'ATTENDED',
          date: new Date('2024-03-01'),
          created_at: new Date('2024-02-01'),
          was_present_comment: null,
          booked_seats: 20,
          event: { id: 'event-3', title: 'Event 3' },
        },
      ];

      const prisma = createMockPrisma(registrations);
      const result = await calculateInstitutionHistory('inst-123', prisma);

      // Check first registration with all fields populated
      expect(result.recentRegistrations[0].comment).toBe('Excellent participation');
      expect(result.recentRegistrations[0].bookedSeats).toBe(25);
      expect(result.recentRegistrations[0].caretakerCount).toBe(2);
      expect(result.recentRegistrations[0].aeshCount).toBe(1);
      expect(result.recentRegistrations[0].category).toEqual(['MATERNELLE', 'ELEMENTAIRE']);
      expect(result.recentRegistrations[0].grades).toEqual(['PS', 'CP', 'CE1']);
      expect(result.recentRegistrations[0].ageRanges).toEqual(['AGE_3_6', 'AGE_6_11']);
      expect(result.recentRegistrations[0].wantFormation).toBe(true);
      expect(result.recentRegistrations[0].wantPreparation).toBe(true);
      expect(result.recentRegistrations[0].disabilitiesCount).toBe(3);
      expect(result.recentRegistrations[0].eventLocation).toBe('Salle Mozart');

      // Check second registration with empty/null arrays (should be undefined)
      expect(result.recentRegistrations[1].caretakerCount).toBeUndefined();
      expect(result.recentRegistrations[1].aeshCount).toBeUndefined();
      expect(result.recentRegistrations[1].category).toBeUndefined();
      expect(result.recentRegistrations[1].grades).toBeUndefined();
      expect(result.recentRegistrations[1].ageRanges).toBeUndefined();
      expect(result.recentRegistrations[1].wantFormation).toBeUndefined();
      expect(result.recentRegistrations[1].wantPreparation).toBeUndefined();
      expect(result.recentRegistrations[1].disabilitiesCount).toBeUndefined();
      expect(result.recentRegistrations[1].eventLocation).toBeUndefined();

      // Check third registration without optional fields
      expect(result.recentRegistrations[2].bookedSeats).toBe(20);
    });
  });

  describe('calculateMultipleInstitutionHistories', () => {
    it('should calculate histories for multiple institutions', async () => {
      const registrations1 = [
        {
          id: '1',
          event_id: 'event-1',
          status: 'ATTENDED',
          date: new Date('2024-01-01'),
          created_at: new Date('2023-12-01'),
          was_present_comment: null,
          event: { id: 'event-1', title: 'Event 1' },
        },
      ];

      const registrations2 = [
        {
          id: '2',
          event_id: 'event-2',
          status: 'CONFIRMED',
          date: new Date('2024-02-01'),
          created_at: new Date('2024-01-01'),
          was_present_comment: null,
          event: { id: 'event-2', title: 'Event 2' },
        },
      ];

      // Create a mock that returns different data based on institution_id
      const prisma = {
        registration: {
          findMany: async ({ where }: { where: { institution_id: string } }) => {
            if (where.institution_id === 'inst-1') return registrations1;
            if (where.institution_id === 'inst-2') return registrations2;
            return [];
          },
        },
      } as unknown as PrismaClient;

      const result = await calculateMultipleInstitutionHistories(['inst-1', 'inst-2'], prisma);

      expect(result.size).toBe(2);
      expect(result.get('inst-1')?.institutionId).toBe('inst-1');
      expect(result.get('inst-2')?.institutionId).toBe('inst-2');
      expect(result.get('inst-1')?.attendedCount).toBe(1);
      expect(result.get('inst-2')?.confirmedCount).toBe(1);
    });

    it('should return empty map for empty institution list', async () => {
      const prisma = createMockPrisma([]);

      const result = await calculateMultipleInstitutionHistories([], prisma);

      expect(result.size).toBe(0);
    });
  });

  describe('formatHistorySummary', () => {
    it('should format summary for institution with no participations', () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 0,
        confirmedCount: 0,
        attendedCount: 0,
        noShowCount: 0,
        cancelledCount: 0,
        attendanceRate: 0,
        confirmationRate: 0,
        lastAttendedDate: null,
        monthsSinceLastAttendance: null,
        recentNoShow: false,
        recentRegistrations: [],
      };

      const summary = formatHistorySummary(history);

      expect(summary).toBe('Aucune participation');
    });

    it('should format summary with total registrations', () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 5,
        confirmedCount: 0,
        attendedCount: 0,
        noShowCount: 0,
        cancelledCount: 0,
        attendanceRate: 0,
        confirmationRate: 0,
        lastAttendedDate: null,
        monthsSinceLastAttendance: null,
        recentNoShow: false,
        recentRegistrations: [],
      };

      const summary = formatHistorySummary(history);

      expect(summary).toContain('5 demande(s)');
    });

    it('should format summary with confirmed count', () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 5,
        confirmedCount: 4,
        attendedCount: 0,
        noShowCount: 0,
        cancelledCount: 0,
        attendanceRate: 0,
        confirmationRate: 80,
        lastAttendedDate: null,
        monthsSinceLastAttendance: null,
        recentNoShow: false,
        recentRegistrations: [],
      };

      const summary = formatHistorySummary(history);

      expect(summary).toContain('4 confirmée(s)');
    });

    it('should format summary with attendance rate', () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 5,
        confirmedCount: 4,
        attendedCount: 3,
        noShowCount: 1,
        cancelledCount: 0,
        attendanceRate: 75,
        confirmationRate: 80,
        lastAttendedDate: new Date('2024-01-01'),
        monthsSinceLastAttendance: null,
        recentNoShow: false,
        recentRegistrations: [],
      };

      const summary = formatHistorySummary(history);

      expect(summary).toContain('75% présence');
    });

    it('should format "this month" for 0 months ago', () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 1,
        confirmedCount: 1,
        attendedCount: 1,
        noShowCount: 0,
        cancelledCount: 0,
        attendanceRate: 100,
        confirmationRate: 100,
        lastAttendedDate: new Date(),
        monthsSinceLastAttendance: 0,
        recentNoShow: false,
        recentRegistrations: [],
      };

      const summary = formatHistorySummary(history);

      expect(summary).toContain('Dernière: ce mois');
    });

    it('should format "1 month ago" correctly', () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 1,
        confirmedCount: 1,
        attendedCount: 1,
        noShowCount: 0,
        cancelledCount: 0,
        attendanceRate: 100,
        confirmationRate: 100,
        lastAttendedDate: new Date(),
        monthsSinceLastAttendance: 1,
        recentNoShow: false,
        recentRegistrations: [],
      };

      const summary = formatHistorySummary(history);

      expect(summary).toContain('Dernière: il y a 1 mois');
    });

    it('should format "X months ago" for 2-11 months', () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 1,
        confirmedCount: 1,
        attendedCount: 1,
        noShowCount: 0,
        cancelledCount: 0,
        attendanceRate: 100,
        confirmationRate: 100,
        lastAttendedDate: new Date(),
        monthsSinceLastAttendance: 6,
        recentNoShow: false,
        recentRegistrations: [],
      };

      const summary = formatHistorySummary(history);

      expect(summary).toContain('Dernière: il y a 6 mois');
    });

    it('should format "X year(s) ago" for 12+ months', () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 1,
        confirmedCount: 1,
        attendedCount: 1,
        noShowCount: 0,
        cancelledCount: 0,
        attendanceRate: 100,
        confirmationRate: 100,
        lastAttendedDate: new Date(),
        monthsSinceLastAttendance: 18,
        recentNoShow: false,
        recentRegistrations: [],
      };

      const summary = formatHistorySummary(history);

      expect(summary).toContain('Dernière: il y a 1 an(s)');
    });
  });

  describe('getHistoryHealth', () => {
    it('should return "new" for institutions with no registrations', () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 0,
        confirmedCount: 0,
        attendedCount: 0,
        noShowCount: 0,
        cancelledCount: 0,
        attendanceRate: 0,
        confirmationRate: 0,
        lastAttendedDate: null,
        monthsSinceLastAttendance: null,
        recentNoShow: false,
        recentRegistrations: [],
      };

      const health = getHistoryHealth(history);

      expect(health.level).toBe('new');
      expect(health.color).toBe('purple');
      expect(health.icon).toBe('🆕');
    });

    it('should return "fair" for institutions with no confirmations', () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 3,
        confirmedCount: 0,
        attendedCount: 0,
        noShowCount: 0,
        cancelledCount: 3,
        attendanceRate: 0,
        confirmationRate: 0,
        lastAttendedDate: null,
        monthsSinceLastAttendance: null,
        recentNoShow: false,
        recentRegistrations: [],
      };

      const health = getHistoryHealth(history);

      expect(health.level).toBe('fair');
      expect(health.color).toBe('gray');
      expect(health.icon).toBe('➖');
    });

    it('should return "excellent" for attendance rate >= 80%', () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 10,
        confirmedCount: 10,
        attendedCount: 9,
        noShowCount: 1,
        cancelledCount: 0,
        attendanceRate: 90,
        confirmationRate: 100,
        lastAttendedDate: new Date(),
        monthsSinceLastAttendance: 0,
        recentNoShow: false,
        recentRegistrations: [],
      };

      const health = getHistoryHealth(history);

      expect(health.level).toBe('excellent');
      expect(health.color).toBe('emerald');
      expect(health.icon).toBe('✅');
    });

    it('should return "good" for attendance rate 60-79%', () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 10,
        confirmedCount: 10,
        attendedCount: 7,
        noShowCount: 3,
        cancelledCount: 0,
        attendanceRate: 70,
        confirmationRate: 100,
        lastAttendedDate: new Date(),
        monthsSinceLastAttendance: 0,
        recentNoShow: false,
        recentRegistrations: [],
      };

      const health = getHistoryHealth(history);

      expect(health.level).toBe('good');
      expect(health.color).toBe('blue');
      expect(health.icon).toBe('👍');
    });

    it('should return "fair" for attendance rate 40-59%', () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 10,
        confirmedCount: 10,
        attendedCount: 5,
        noShowCount: 5,
        cancelledCount: 0,
        attendanceRate: 50,
        confirmationRate: 100,
        lastAttendedDate: new Date(),
        monthsSinceLastAttendance: 0,
        recentNoShow: false,
        recentRegistrations: [],
      };

      const health = getHistoryHealth(history);

      expect(health.level).toBe('fair');
      expect(health.color).toBe('amber');
      expect(health.icon).toBe('⚠️');
    });

    it('should return "poor" for attendance rate < 40%', () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 10,
        confirmedCount: 10,
        attendedCount: 3,
        noShowCount: 7,
        cancelledCount: 0,
        attendanceRate: 30,
        confirmationRate: 100,
        lastAttendedDate: new Date(),
        monthsSinceLastAttendance: 0,
        recentNoShow: false,
        recentRegistrations: [],
      };

      const health = getHistoryHealth(history);

      expect(health.level).toBe('poor');
      expect(health.color).toBe('red');
      expect(health.icon).toBe('❌');
    });
  });

  describe('generateHistoryReport', () => {
    it('should generate report for new institution', () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 0,
        confirmedCount: 0,
        attendedCount: 0,
        noShowCount: 0,
        cancelledCount: 0,
        attendanceRate: 0,
        confirmationRate: 0,
        lastAttendedDate: null,
        monthsSinceLastAttendance: null,
        recentNoShow: false,
        recentRegistrations: [],
      };

      const report = generateHistoryReport(history);

      expect(report).toBe("Cet établissement n'a jamais fait de demande d'inscription auparavant.");
    });

    it('should handle lastAttendedDate with null monthsSinceLastAttendance', () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 1,
        confirmedCount: 1,
        attendedCount: 1,
        noShowCount: 0,
        cancelledCount: 0,
        attendanceRate: 100,
        confirmationRate: 100,
        lastAttendedDate: new Date(),
        monthsSinceLastAttendance: null,
        recentNoShow: false,
        recentRegistrations: [],
      };

      const report = generateHistoryReport(history);

      expect(report).toContain('Dernière participation: ce mois-ci');
    });

    it('should include total and confirmed registrations', () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 10,
        confirmedCount: 8,
        attendedCount: 6,
        noShowCount: 2,
        cancelledCount: 2,
        attendanceRate: 75,
        confirmationRate: 80,
        lastAttendedDate: new Date(),
        monthsSinceLastAttendance: 0,
        recentNoShow: false,
        recentRegistrations: [],
      };

      const report = generateHistoryReport(history);

      expect(report).toContain('📊 Statistiques globales');
      expect(report).toContain('Demandes totales: 10');
      expect(report).toContain('Confirmées: 8 (80%)');
    });

    it('should include attendance information when confirmations exist', () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 10,
        confirmedCount: 8,
        attendedCount: 6,
        noShowCount: 2,
        cancelledCount: 2,
        attendanceRate: 75,
        confirmationRate: 80,
        lastAttendedDate: new Date(),
        monthsSinceLastAttendance: 0,
        recentNoShow: false,
        recentRegistrations: [],
      };

      const report = generateHistoryReport(history);

      expect(report).toContain('Présences effectives: 6 (75% de taux de présence)');
      expect(report).toContain('Absences: 2');
    });

    it('should include cancellations when present', () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 10,
        confirmedCount: 7,
        attendedCount: 5,
        noShowCount: 2,
        cancelledCount: 3,
        attendanceRate: 71.4,
        confirmationRate: 70,
        lastAttendedDate: new Date(),
        monthsSinceLastAttendance: 0,
        recentNoShow: false,
        recentRegistrations: [],
      };

      const report = generateHistoryReport(history);

      expect(report).toContain('Annulations: 3');
    });

    it('should format last participation for 0 months', () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 1,
        confirmedCount: 1,
        attendedCount: 1,
        noShowCount: 0,
        cancelledCount: 0,
        attendanceRate: 100,
        confirmationRate: 100,
        lastAttendedDate: new Date(),
        monthsSinceLastAttendance: 0,
        recentNoShow: false,
        recentRegistrations: [],
      };

      const report = generateHistoryReport(history);

      expect(report).toContain('Dernière participation: ce mois-ci');
    });

    it('should format last participation for 1 month', () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 1,
        confirmedCount: 1,
        attendedCount: 1,
        noShowCount: 0,
        cancelledCount: 0,
        attendanceRate: 100,
        confirmationRate: 100,
        lastAttendedDate: new Date(),
        monthsSinceLastAttendance: 1,
        recentNoShow: false,
        recentRegistrations: [],
      };

      const report = generateHistoryReport(history);

      expect(report).toContain('Dernière participation: il y a 1 mois');
    });

    it('should format last participation for multiple months', () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 1,
        confirmedCount: 1,
        attendedCount: 1,
        noShowCount: 0,
        cancelledCount: 0,
        attendanceRate: 100,
        confirmationRate: 100,
        lastAttendedDate: new Date(),
        monthsSinceLastAttendance: 8,
        recentNoShow: false,
        recentRegistrations: [],
      };

      const report = generateHistoryReport(history);

      expect(report).toContain('Dernière participation: il y a 8 mois');
    });

    it('should format last participation for 1 year (singular)', () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 1,
        confirmedCount: 1,
        attendedCount: 1,
        noShowCount: 0,
        cancelledCount: 0,
        attendanceRate: 100,
        confirmationRate: 100,
        lastAttendedDate: new Date(),
        monthsSinceLastAttendance: 15,
        recentNoShow: false,
        recentRegistrations: [],
      };

      const report = generateHistoryReport(history);

      expect(report).toContain('Dernière participation: il y a 1 an et 3 mois');
    });

    it('should format last participation for years', () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 1,
        confirmedCount: 1,
        attendedCount: 1,
        noShowCount: 0,
        cancelledCount: 0,
        attendanceRate: 100,
        confirmationRate: 100,
        lastAttendedDate: new Date(),
        monthsSinceLastAttendance: 25,
        recentNoShow: false,
        recentRegistrations: [],
      };

      const report = generateHistoryReport(history);

      expect(report).toContain('Dernière participation: il y a 2 ans et 1 mois');
    });

    it('should include recent no-show warning', () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 2,
        confirmedCount: 2,
        attendedCount: 1,
        noShowCount: 1,
        cancelledCount: 0,
        attendanceRate: 50,
        confirmationRate: 100,
        lastAttendedDate: new Date(),
        monthsSinceLastAttendance: 0,
        recentNoShow: true,
        recentRegistrations: [],
      };

      const report = generateHistoryReport(history);

      expect(report).toContain('⚠️  Absence récente (dans les 6 derniers mois)');
    });

    it('should use dynamic labels when provided', () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 10,
        confirmedCount: 8,
        attendedCount: 6,
        noShowCount: 2,
        cancelledCount: 2,
        attendanceRate: 75,
        confirmationRate: 80,
        lastAttendedDate: new Date('2026-01-15'),
        monthsSinceLastAttendance: 0,
        recentNoShow: false,
        recentRegistrations: [],
      };

      const customLabels: Record<string, string> = {
        CONFIRMED: 'Validées',
        ATTENDED: 'Présences réelles',
        NO_SHOW: 'Absences injustifiées',
        CANCELLED: 'Désistements',
      };

      const report = generateHistoryReport(history, customLabels);

      expect(report).toContain('Validées: 8 (80%)');
      expect(report).toContain('Présences réelles effectives: 6 (75% de taux de présence)');
      expect(report).toContain('Absences injustifiées: 2');
      expect(report).toContain('Désistements: 2');
    });
  });

  describe('HistoryCache', () => {
    beforeEach(() => {
      historyCache.clear();
      jest.clearAllTimers();
    });

    it('should return null for non-existent cache entry', () => {
      const cached = historyCache.get('non-existent');

      expect(cached).toBeNull();
    });

    it('should store and retrieve cache entry', () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 5,
        confirmedCount: 4,
        attendedCount: 3,
        noShowCount: 1,
        cancelledCount: 1,
        attendanceRate: 75,
        confirmationRate: 80,
        lastAttendedDate: new Date(),
        monthsSinceLastAttendance: 2,
        recentNoShow: false,
        recentRegistrations: [],
      };

      historyCache.set('inst-1', history);
      const cached = historyCache.get('inst-1');

      expect(cached).toEqual(history);
    });

    it('should expire cache after TTL (5 minutes)', () => {
      jest.useFakeTimers();

      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 5,
        confirmedCount: 4,
        attendedCount: 3,
        noShowCount: 1,
        cancelledCount: 1,
        attendanceRate: 75,
        confirmationRate: 80,
        lastAttendedDate: new Date(),
        monthsSinceLastAttendance: 2,
        recentNoShow: false,
        recentRegistrations: [],
      };

      historyCache.set('inst-1', history);

      // Should be available before TTL
      expect(historyCache.get('inst-1')).toEqual(history);

      // Advance time by 6 minutes (more than TTL)
      jest.advanceTimersByTime(6 * 60 * 1000);

      // Should be null after TTL
      expect(historyCache.get('inst-1')).toBeNull();

      jest.useRealTimers();
    });

    it('should clear all cache entries', () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 5,
        confirmedCount: 4,
        attendedCount: 3,
        noShowCount: 1,
        cancelledCount: 1,
        attendanceRate: 75,
        confirmationRate: 80,
        lastAttendedDate: new Date(),
        monthsSinceLastAttendance: 2,
        recentNoShow: false,
        recentRegistrations: [],
      };

      historyCache.set('inst-1', history);
      historyCache.set('inst-2', history);
      historyCache.clear();

      expect(historyCache.get('inst-1')).toBeNull();
      expect(historyCache.get('inst-2')).toBeNull();
    });

    it('should clear specific institution cache', () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 5,
        confirmedCount: 4,
        attendedCount: 3,
        noShowCount: 1,
        cancelledCount: 1,
        attendanceRate: 75,
        confirmationRate: 80,
        lastAttendedDate: new Date(),
        monthsSinceLastAttendance: 2,
        recentNoShow: false,
        recentRegistrations: [],
      };

      historyCache.set('inst-1', history);
      historyCache.set('inst-2', history);
      historyCache.clearInstitution('inst-1');

      expect(historyCache.get('inst-1')).toBeNull();
      expect(historyCache.get('inst-2')).toEqual(history);
    });
  });

  describe('calculateInstitutionHistoryWithCache', () => {
    beforeEach(() => {
      historyCache.clear();
    });

    it('should return cached result if available', async () => {
      const history: InstitutionHistory = {
        institutionId: 'inst-1',
        totalRegistrations: 5,
        confirmedCount: 4,
        attendedCount: 3,
        noShowCount: 1,
        cancelledCount: 1,
        attendanceRate: 75,
        confirmationRate: 80,
        lastAttendedDate: new Date(),
        monthsSinceLastAttendance: 2,
        recentNoShow: false,
        recentRegistrations: [],
      };

      historyCache.set('inst-1', history);

      const prisma = createMockPrisma([]);
      const result = await calculateInstitutionHistoryWithCache('inst-1', prisma);

      expect(result).toEqual(history);
    });

    it('should calculate and cache if not in cache', async () => {
      const registrations = [
        {
          id: '1',
          event_id: 'event-1',
          status: 'ATTENDED',
          date: new Date('2024-01-01'),
          created_at: new Date('2023-12-01'),
          was_present_comment: null,
          event: { id: 'event-1', title: 'Event 1' },
        },
      ];

      const prisma = createMockPrisma(registrations);
      const result = await calculateInstitutionHistoryWithCache('inst-1', prisma);

      expect(result.institutionId).toBe('inst-1');
      expect(result.attendedCount).toBe(1);

      // Verify it was cached
      const cached = historyCache.get('inst-1');
      expect(cached).toEqual(result);
    });
  });
});
