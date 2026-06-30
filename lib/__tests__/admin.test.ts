/* eslint-disable */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import {
  getDashboardStats,
  getUpcomingEvents,
  getTotalUpcomingEventsCount,
  getRegistrationStatsByStatus,
  getUserStatsByRole,
  getEventCapacityStats,
  getRegistrationTrendData,
  getTopInstitutionsByRegistrations,
  getTopEventsByRegistrations,
} from '@/lib/middleware/admin';

jest.mock('@/lib/middleware/prismaConfig', () => {
  return {
    __esModule: true,
    default: {
      event: {
        findMany: jest.fn(),
      },
      user: {
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      institution: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      registration: {
        count: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn(),
      },
    },
  };
});

const prisma = require('@/lib/middleware/prismaConfig').default;

describe('lib/admin helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getDashboardStats returns counts and upcomingEvents without date filter', async () => {
    // Mock events: one with future date, one without
    const now = new Date();
    const future = new Date(now.getTime() + 1000 * 60 * 60 * 24).toISOString();
    const past = new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString();

    prisma.event.findMany.mockResolvedValue([{ event_dates: [future] }, { event_dates: [past] }]);
    prisma.user.count.mockResolvedValue(42);
    prisma.institution.count.mockResolvedValue(5);
    prisma.registration.count.mockResolvedValue(3);

    const stats = await getDashboardStats();

    expect(stats.upcomingEvents).toBe(1);
    expect(stats.totalUsers).toBe(42);
    expect(stats.totalInstitutions).toBe(5);
    expect(stats.pendingRegistrations).toBe(3);
  });

  test('getDashboardStats with days filter applies date range', async () => {
    const now = new Date();
    const future = new Date(now.getTime() + 1000 * 60 * 60 * 24).toISOString();
    const past = new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString();

    prisma.event.findMany.mockResolvedValue([{ event_dates: [future] }]);
    prisma.user.count.mockResolvedValue(10);
    prisma.institution.count.mockResolvedValue(2);
    prisma.registration.count.mockResolvedValue(5);

    const stats = await getDashboardStats(7); // Last 7 days

    expect(stats.upcomingEvents).toBe(1);
    expect(stats.totalUsers).toBe(10);
    expect(prisma.event.findMany).toHaveBeenCalled();
    expect(prisma.user.count).toHaveBeenCalled();
  });

  test('getUpcomingEvents returns normalized upcoming events', async () => {
    const now = new Date();
    const future1 = new Date(now.getTime() + 1000 * 60 * 60 * 24).toISOString();
    const future2 = new Date(now.getTime() + 1000 * 60 * 60 * 48).toISOString();

    prisma.event.findMany.mockResolvedValue([
      {
        id: '1',
        title: 'Event 1',
        location: null,
        event_dates: [future2, future1],
        total_seats: 100,
        booked_seats: 10,
        registrations: [{}, {}],
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        title: 'Event 2',
        location: 'Somewhere',
        event_dates: [],
        total_seats: 0,
        booked_seats: 0,
        registrations: [],
        created_at: new Date().toISOString(),
      },
    ]);

    const events = await getUpcomingEvents();

    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
    const e = events[0];
    expect(e.id).toBe('1');
    expect(e.location).toBe(''); // normalized
    expect(e.totalSeats).toBe(100);
    expect(e.bookedSeats).toBe(10);
    expect(e.registrationsCount).toBe(2);
  });

  test('getUpcomingEvents handles null total_seats and booked_seats', async () => {
    const now = new Date();
    const future = new Date(now.getTime() + 1000 * 60 * 60 * 24).toISOString();

    prisma.event.findMany.mockResolvedValue([
      {
        id: '3',
        title: 'Event with nulls',
        location: 'Test Location',
        event_dates: [future],
        total_seats: null,
        booked_seats: null,
        registrations: [{}],
        created_at: new Date().toISOString(),
      },
    ]);

    const events = await getUpcomingEvents();

    expect(events.length).toBe(1);
    expect(events[0].totalSeats).toBe(0);
    expect(events[0].bookedSeats).toBe(0);
  });

  test('getUpcomingEvents supports pagination with default limit of 4', async () => {
    const now = new Date();
    const futureBase = now.getTime() + 1000 * 60 * 60 * 24;

    // Create 10 mock events
    const mockEvents = Array.from({ length: 10 }, (_, i) => ({
      id: `event-${i}`,
      title: `Event ${i}`,
      location: `Location ${i}`,
      event_dates: [new Date(futureBase + i * 1000 * 60 * 60).toISOString()],
      total_seats: 100,
      booked_seats: 10,
      registrations: [],
      created_at: new Date().toISOString(),
    }));

    prisma.event.findMany.mockResolvedValue(mockEvents);

    // Test first page (default limit = 4)
    const page1 = await getUpcomingEvents(1);
    expect(page1.length).toBe(4);
    expect(page1[0].id).toBe('event-0');
    expect(page1[3].id).toBe('event-3');

    // Test second page
    const page2 = await getUpcomingEvents(2);
    expect(page2.length).toBe(4);
    expect(page2[0].id).toBe('event-4');
    expect(page2[3].id).toBe('event-7');

    // Test third page
    const page3 = await getUpcomingEvents(3);
    expect(page3.length).toBe(2);
    expect(page3[0].id).toBe('event-8');
    expect(page3[1].id).toBe('event-9');
  });

  test('getUpcomingEvents supports custom limit', async () => {
    const now = new Date();
    const futureBase = now.getTime() + 1000 * 60 * 60 * 24;

    // Create 6 mock events
    const mockEvents = Array.from({ length: 6 }, (_, i) => ({
      id: `event-${i}`,
      title: `Event ${i}`,
      location: `Location ${i}`,
      event_dates: [new Date(futureBase + i * 1000 * 60 * 60).toISOString()],
      total_seats: 100,
      booked_seats: 10,
      registrations: [],
      created_at: new Date().toISOString(),
    }));

    prisma.event.findMany.mockResolvedValue(mockEvents);

    // Test with custom limit of 2
    const page1 = await getUpcomingEvents(1, 2);
    expect(page1.length).toBe(2);
    expect(page1[0].id).toBe('event-0');

    const page2 = await getUpcomingEvents(2, 2);
    expect(page2.length).toBe(2);
    expect(page2[0].id).toBe('event-2');

    const page3 = await getUpcomingEvents(3, 2);
    expect(page3.length).toBe(2);
    expect(page3[0].id).toBe('event-4');
  });

  test('getUpcomingEvents returns empty array for out-of-range page', async () => {
    const now = new Date();
    const futureBase = now.getTime() + 1000 * 60 * 60 * 24;

    // Create 4 mock events
    const mockEvents = Array.from({ length: 4 }, (_, i) => ({
      id: `event-${i}`,
      title: `Event ${i}`,
      location: `Location ${i}`,
      event_dates: [new Date(futureBase + i * 1000 * 60 * 60).toISOString()],
      total_seats: 100,
      booked_seats: 10,
      registrations: [],
      created_at: new Date().toISOString(),
    }));

    prisma.event.findMany.mockResolvedValue(mockEvents);

    // Request page 10 (out of range)
    const page10 = await getUpcomingEvents(10, 4);
    expect(page10.length).toBe(0);
  });

  test('getTotalUpcomingEventsCount returns the correct count', async () => {
    const now = new Date();
    const future = new Date(now.getTime() + 1000 * 60 * 60 * 24).toISOString();
    const past = new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString();

    prisma.event.findMany.mockResolvedValue([
      { event_dates: [future] },
      { event_dates: [future, past] }, // mixed dates
      { event_dates: [past] }, // only past
      { event_dates: [future] },
    ]);

    const count = await getTotalUpcomingEventsCount();

    // Should count only events with at least one future date
    expect(count).toBe(3);
  });

  test('getTotalUpcomingEventsCount returns 0 when no upcoming events', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString();

    prisma.event.findMany.mockResolvedValue([{ event_dates: [past] }, { event_dates: [past] }]);

    const count = await getTotalUpcomingEventsCount();
    expect(count).toBe(0);
  });

  test('getTotalUpcomingEventsCount returns 0 when no events exist', async () => {
    prisma.event.findMany.mockResolvedValue([]);

    const count = await getTotalUpcomingEventsCount();
    expect(count).toBe(0);
  });

  test('getRegistrationStatsByStatus returns all statuses with correct counts', async () => {
    prisma.registration.groupBy.mockResolvedValue([
      { status: 'PENDING', _count: { id: 5 } },
      { status: 'CONFIRMED', _count: { id: 10 } },
      { status: 'CANCELLED', _count: { id: 2 } },
      { status: 'ATTENDED', _count: { id: 8 } },
    ]);

    const stats = await getRegistrationStatsByStatus();

    expect(stats.PENDING).toBe(5);
    expect(stats.CONFIRMED).toBe(10);
    expect(stats.CANCELLED).toBe(2);
    expect(stats.ATTENDED).toBe(8);
    expect(stats.REJECTED).toBe(0);
    expect(stats.NO_SHOW).toBe(0);
  });

  test('getRegistrationStatsByStatus with date filter', async () => {
    prisma.registration.groupBy.mockResolvedValue([
      { status: 'PENDING', _count: { id: 2 } },
      { status: 'CONFIRMED', _count: { id: 3 } },
    ]);

    const stats = await getRegistrationStatsByStatus(30);

    expect(stats.PENDING).toBe(2);
    expect(stats.CONFIRMED).toBe(3);
    expect(stats.CANCELLED).toBe(0);
  });

  test('getRegistrationStatsByStatus returns all zeros when no registrations', async () => {
    prisma.registration.groupBy.mockResolvedValue([]);

    const stats = await getRegistrationStatsByStatus();

    expect(stats.PENDING).toBe(0);
    expect(stats.CONFIRMED).toBe(0);
    expect(stats.CANCELLED).toBe(0);
    expect(stats.REJECTED).toBe(0);
    expect(stats.ATTENDED).toBe(0);
    expect(stats.NO_SHOW).toBe(0);
  });

  test('getUserStatsByRole returns all roles with correct counts', async () => {
    prisma.user.groupBy.mockResolvedValue([
      { role: 'USER', _count: { id: 100 } },
      { role: 'ADMIN', _count: { id: 5 } },
      { role: 'SUPERADMIN', _count: { id: 1 } },
    ]);

    const stats = await getUserStatsByRole();

    expect(stats.USER).toBe(100);
    expect(stats.ADMIN).toBe(5);
    expect(stats.SUPERADMIN).toBe(1);
  });

  test('getUserStatsByRole with date filter', async () => {
    prisma.user.groupBy.mockResolvedValue([
      { role: 'USER', _count: { id: 20 } },
      { role: 'ADMIN', _count: { id: 1 } },
    ]);

    const stats = await getUserStatsByRole(7);

    expect(stats.USER).toBe(20);
    expect(stats.ADMIN).toBe(1);
    expect(stats.SUPERADMIN).toBe(0);
  });

  test('getUserStatsByRole returns all zeros when no users', async () => {
    prisma.user.groupBy.mockResolvedValue([]);

    const stats = await getUserStatsByRole();

    expect(stats.USER).toBe(0);
    expect(stats.ADMIN).toBe(0);
    expect(stats.SUPERADMIN).toBe(0);
  });

  test('getEventCapacityStats calculates correct stats', async () => {
    prisma.event.findMany.mockResolvedValue([
      { total_seats: 100, booked_seats: 50 },
      { total_seats: 50, booked_seats: 40 },
      { total_seats: 200, booked_seats: 100 },
    ]);

    const stats = await getEventCapacityStats();

    expect(stats.totalEvents).toBe(3);
    expect(stats.totalCapacity).toBe(350);
    expect(stats.totalBooked).toBe(190);
    expect(stats.occupancyRate).toBe(54); // 190/350 * 100 = 54.28 -> 54
    expect(stats.averageCapacityPerEvent).toBe(117); // 350/3 = 116.67 -> 117
  });

  test('getEventCapacityStats with date filter', async () => {
    prisma.event.findMany.mockResolvedValue([{ total_seats: 100, booked_seats: 50 }]);

    const stats = await getEventCapacityStats(30);

    expect(stats.totalEvents).toBe(1);
    expect(stats.totalCapacity).toBe(100);
    expect(stats.totalBooked).toBe(50);
    expect(stats.occupancyRate).toBe(50);
  });

  test('getEventCapacityStats handles null values', async () => {
    prisma.event.findMany.mockResolvedValue([
      { total_seats: null, booked_seats: null },
      { total_seats: 100, booked_seats: 20 },
    ]);

    const stats = await getEventCapacityStats();

    expect(stats.totalEvents).toBe(2);
    expect(stats.totalCapacity).toBe(100);
    expect(stats.totalBooked).toBe(20);
    expect(stats.occupancyRate).toBe(20);
  });

  test('getEventCapacityStats with no events returns zeros', async () => {
    prisma.event.findMany.mockResolvedValue([]);

    const stats = await getEventCapacityStats();

    expect(stats.totalEvents).toBe(0);
    expect(stats.totalCapacity).toBe(0);
    expect(stats.totalBooked).toBe(0);
    expect(stats.occupancyRate).toBe(0);
    expect(stats.averageCapacityPerEvent).toBe(0);
  });

  test('getEventCapacityStats with zero total_seats', async () => {
    prisma.event.findMany.mockResolvedValue([{ total_seats: 0, booked_seats: 0 }]);

    const stats = await getEventCapacityStats();

    expect(stats.totalCapacity).toBe(0);
    expect(stats.occupancyRate).toBe(0);
  });

  test('getRegistrationTrendData groups registrations by date', async () => {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];

    prisma.registration.findMany.mockResolvedValue([
      { created_at: new Date(currentDate + 'T10:00:00Z') },
      { created_at: new Date(currentDate + 'T14:00:00Z') },
    ]);

    const trend = await getRegistrationTrendData(2);

    expect(trend.length).toBe(2);
    expect(Array.isArray(trend)).toBe(true);
    expect(trend[0]).toHaveProperty('date');
    expect(trend[0]).toHaveProperty('count');
    expect(typeof trend[0].date).toBe('string');
    expect(typeof trend[0].count).toBe('number');
  });

  test('getRegistrationTrendData defaults to 30 days when days is null', async () => {
    const now = new Date();
    prisma.registration.findMany.mockResolvedValue([]);

    const trend = await getRegistrationTrendData(null);

    expect(trend.length).toBe(30);
    trend.forEach((entry) => {
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.count).toBe(0);
    });
  });

  test('getRegistrationTrendData fills missing dates with zero count', async () => {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];

    prisma.registration.findMany.mockResolvedValue([
      { created_at: new Date(currentDate + 'T10:00:00Z') },
      { created_at: new Date(currentDate + 'T14:00:00Z') },
    ]);

    const trend = await getRegistrationTrendData(3);

    expect(trend.length).toBe(3);
    // Verify all items have count property
    trend.forEach((entry) => {
      expect(typeof entry.count).toBe('number');
      expect(entry.count >= 0).toBe(true);
    });
  });

  test('getTopInstitutionsByRegistrations without date filter uses optimized query', async () => {
    prisma.registration.groupBy.mockResolvedValue([
      { institution_id: '1', _count: { institution_id: 50 } },
      { institution_id: '2', _count: { institution_id: 30 } },
      { institution_id: '3', _count: { institution_id: 20 } },
    ]);

    prisma.institution.findMany.mockResolvedValue([
      { id: '1', name: 'Institution A' },
      { id: '2', name: 'Institution B' },
      { id: '3', name: 'Institution C' },
    ]);

    const result = await getTopInstitutionsByRegistrations(10);

    expect(result.length).toBe(3);
    expect(result[0].name).toBe('Institution A');
    expect(result[0].count).toBe(50);
    expect(result[1].name).toBe('Institution B');
    expect(result[2].name).toBe('Institution C');
  });

  test('getTopInstitutionsByRegistrations with date filter counts filtered registrations', async () => {
    prisma.registration.groupBy.mockResolvedValue([
      { institution_id: '1', _count: { institution_id: 3 } },
      { institution_id: '2', _count: { institution_id: 2 } },
    ]);

    prisma.institution.findMany.mockResolvedValue([
      { id: '1', name: 'Institution A' },
      { id: '2', name: 'Institution B' },
    ]);

    const result = await getTopInstitutionsByRegistrations(10, 30);

    expect(result.length).toBe(2);
    expect(result[0].name).toBe('Institution A');
    expect(result[0].count).toBe(3);
    expect(result[1].count).toBe(2);
  });

  test('getTopInstitutionsByRegistrations respects limit with date filter', async () => {
    // Simulate DB query returning limited results
    prisma.registration.groupBy.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        institution_id: `${i}`,
        _count: { institution_id: 15 - i },
      })),
    );

    prisma.institution.findMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        id: `${i}`,
        name: `Institution ${i}`,
      })),
    );

    const result = await getTopInstitutionsByRegistrations(5, 30);

    expect(result.length).toBe(5);
    expect(prisma.registration.groupBy).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
  });

  test('getTopInstitutionsByRegistrations without date filter uses database limit', async () => {
    // Check if take is passed to groupBy
    prisma.registration.groupBy.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        institution_id: `${i}`,
        _count: { institution_id: 5 - i },
      })),
    );
    prisma.institution.findMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({ id: `${i}`, name: `Institution ${i}` })),
    );

    const result = await getTopInstitutionsByRegistrations(5);

    expect(result.length).toBe(5);
    expect(prisma.registration.groupBy).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
  });

  test('getTopInstitutionsByRegistrations handles missing institution details', async () => {
    prisma.registration.groupBy.mockResolvedValue([
      { institution_id: '1', _count: { institution_id: 10 } },
    ]);
    prisma.institution.findMany.mockResolvedValue([]);

    const result = await getTopInstitutionsByRegistrations(10);

    expect(result[0].name).toBe('Inconnu');
    expect(result[0].count).toBe(10);
  });

  test('getTopInstitutionsByRegistrations sorts by count descending', async () => {
    // Check if orderBy is correct in groupBy
    prisma.registration.groupBy.mockResolvedValue([
      { institution_id: '2', _count: { institution_id: 100 } },
      { institution_id: '3', _count: { institution_id: 50 } },
      { institution_id: '1', _count: { institution_id: 10 } },
    ]);
    prisma.institution.findMany.mockResolvedValue([
      { id: '1', name: 'Low' },
      { id: '2', name: 'High' },
      { id: '3', name: 'Medium' },
    ]);

    const result = await getTopInstitutionsByRegistrations(10);

    expect(result[0].id).toBe('2');
    expect(result[0].count).toBe(100);
    expect(result[1].id).toBe('3');
    expect(result[1].count).toBe(50);
    expect(result[2].id).toBe('1');
    expect(result[2].count).toBe(10);
  });

  test('getTopInstitutionsByRegistrations handles institution with address but missing city', async () => {
    prisma.registration.groupBy.mockResolvedValue([
      { institution_id: '1', _count: { institution_id: 10 } },
      { institution_id: '2', _count: { institution_id: 5 } },
    ]);
    prisma.institution.findMany.mockResolvedValue([
      { id: '1', name: 'Institution A', address: { city: 'Paris' } },
      { id: '2', name: 'Institution B', address: { city: null } },
    ]);

    const result = await getTopInstitutionsByRegistrations(10);

    expect(result[0].name).toBe('Institution A');
    expect(result[0].city).toBe('Paris');
    expect(result[1].name).toBe('Institution B');
    expect(result[1].city).toBe(''); // Fallback to empty string when city is null
  });

  test('getTopEventsByRegistrations without date filter uses optimized query', async () => {
    prisma.registration.groupBy.mockResolvedValue([
      { event_id: '1', _count: { event_id: 3 } },
      { event_id: '2', _count: { event_id: 2 } },
    ]);

    prisma.event.findMany.mockResolvedValue([
      { id: '1', title: 'Event A', total_seats: 100, booked_seats: 80, slug: 'event-a' },
      { id: '2', title: 'Event B', total_seats: 50, booked_seats: 25, slug: 'event-b' },
    ]);

    const result = await getTopEventsByRegistrations(10);

    expect(result.length).toBe(2);
    expect(result[0].title).toBe('Event A');
    expect(result[0].registrationsCount).toBe(3);
    expect(result[0].occupancyRate).toBe(80);
    expect(result[1].occupancyRate).toBe(50);
  });

  test('getTopEventsByRegistrations with date filter counts filtered registrations', async () => {
    prisma.registration.groupBy.mockResolvedValue([{ event_id: '1', _count: { event_id: 3 } }]);

    prisma.event.findMany.mockResolvedValue([
      { id: '1', title: 'Event A', total_seats: 100, booked_seats: 80, slug: 'event-a' },
    ]);

    const result = await getTopEventsByRegistrations(10, 30);

    expect(result.length).toBe(1);
    expect(result[0].registrationsCount).toBe(3);
    expect(result[0].occupancyRate).toBe(80);
  });

  test('getTopEventsByRegistrations calculates occupancy rate correctly', async () => {
    prisma.registration.groupBy.mockResolvedValue([{ event_id: '1', _count: { event_id: 0 } }]);

    prisma.event.findMany.mockResolvedValue([
      { id: '1', title: 'Event A', total_seats: 100, booked_seats: 75, slug: 'event-a' },
    ]);

    const result = await getTopEventsByRegistrations(10);

    expect(result[0].occupancyRate).toBe(75);
  });

  test('getTopEventsByRegistrations with zero total_seats', async () => {
    prisma.registration.groupBy.mockResolvedValue([{ event_id: '1', _count: { event_id: 0 } }]);

    prisma.event.findMany.mockResolvedValue([
      { id: '1', title: 'Event A', total_seats: 0, booked_seats: 0, slug: 'event-a' },
    ]);

    const result = await getTopEventsByRegistrations(10);

    expect(result[0].occupancyRate).toBe(0);
  });

  test('getTopEventsByRegistrations handles null total_seats', async () => {
    prisma.registration.groupBy.mockResolvedValue([{ event_id: '1', _count: { event_id: 0 } }]);

    prisma.event.findMany.mockResolvedValue([
      { id: '1', title: 'Event A', total_seats: null, booked_seats: 50, slug: 'event-a' },
    ]);

    const result = await getTopEventsByRegistrations(10);

    expect(result[0].occupancyRate).toBe(0);
  });

  test('getTopEventsByRegistrations handles null booked_seats', async () => {
    prisma.registration.groupBy.mockResolvedValue([{ event_id: '1', _count: { event_id: 10 } }]);

    prisma.event.findMany.mockResolvedValue([
      {
        id: '1',
        title: 'Event A',
        total_seats: 100,
        booked_seats: null as any,
        slug: 'event-a',
      },
    ]);

    const result = await getTopEventsByRegistrations(10);

    expect(result[0].occupancyRate).toBe(0);
    expect(result[0].registrationsCount).toBe(10);
  });

  test('getTopEventsByRegistrations with date filter and zero total_seats', async () => {
    prisma.registration.groupBy.mockResolvedValue([{ event_id: '1', _count: { event_id: 2 } }]);

    prisma.event.findMany.mockResolvedValue([
      { id: '1', title: 'Event A', total_seats: 0, booked_seats: 0, slug: 'event-a' },
    ]);

    const result = await getTopEventsByRegistrations(10, 30);

    expect(result[0].occupancyRate).toBe(0);
  });

  test('getTopEventsByRegistrations with date filter and null total_seats', async () => {
    prisma.registration.groupBy.mockResolvedValue([{ event_id: '1', _count: { event_id: 2 } }]);

    prisma.event.findMany.mockResolvedValue([
      { id: '1', title: 'Event A', total_seats: null, booked_seats: 50, slug: 'event-a' },
    ]);

    const result = await getTopEventsByRegistrations(10, 30);

    expect(result[0].occupancyRate).toBe(0);
  });

  test('getTopEventsByRegistrations respects limit with date filter', async () => {
    // Generate 5 entries (limit)
    prisma.registration.groupBy.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        event_id: `${i}`,
        _count: { event_id: 15 - i },
      })),
    );

    prisma.event.findMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        id: `${i}`,
        title: `Event ${i}`,
        total_seats: 100,
        booked_seats: 50,
        slug: `event-${i}`,
      })),
    );

    const result = await getTopEventsByRegistrations(5, 30);

    expect(result.length).toBe(5);
    expect(result[0].registrationsCount >= result[4].registrationsCount).toBe(true);
  });

  test('getTopEventsByRegistrations handles event with null slug', async () => {
    prisma.registration.groupBy.mockResolvedValue([{ event_id: '1', _count: { event_id: 10 } }]);
    prisma.event.findMany.mockResolvedValue([
      { id: '1', title: 'Event A', total_seats: 100, booked_seats: 50, slug: null },
    ]);

    const result = await getTopEventsByRegistrations(10);

    expect(result[0].title).toBe('Event A');
    expect(result[0].slug).toBeNull();
  });

  test('getTopEventsByRegistrations handles event ID mismatch', async () => {
    prisma.registration.groupBy.mockResolvedValue([{ event_id: '1', _count: { event_id: 10 } }]);
    // Return an event with a different ID
    prisma.event.findMany.mockResolvedValue([
      { id: '2', title: 'Event B', total_seats: 100, booked_seats: 50, slug: 'event-b' },
    ]);

    const result = await getTopEventsByRegistrations(10);

    expect(result[0].title).toBe('Événement inconnu');
    expect(result[0].registrationsCount).toBe(10);
  });

  test('getTopEventsByRegistrations handles event with empty title and empty slug', async () => {
    prisma.registration.groupBy.mockResolvedValue([{ event_id: '1', _count: { event_id: 10 } }]);
    prisma.event.findMany.mockResolvedValue([
      { id: '1', title: '', total_seats: 0, booked_seats: 0, slug: '' },
    ]);

    const result = await getTopEventsByRegistrations(10);

    expect(result[0].title).toBe('Événement inconnu');
    expect(result[0].slug).toBeNull();
    expect(result[0].occupancyRate).toBe(0);
  });

  test('getTopEventsByRegistrations handles event with undefined properties', async () => {
    prisma.registration.groupBy.mockResolvedValue([{ event_id: '1', _count: { event_id: 10 } }]);
    prisma.event.findMany.mockResolvedValue([
      {
        id: '1',
        title: undefined as any,
        total_seats: undefined as any,
        booked_seats: undefined as any,
        slug: undefined as any,
      },
    ]);

    const result = await getTopEventsByRegistrations(10);

    // Should fall back to defaults
    expect(result[0].title).toBe('Événement inconnu');
    expect(result[0].slug).toBeNull();
    expect(result[0].occupancyRate).toBe(0);
  });

  test('getTopEventsByRegistrations without date filter uses database limit', async () => {
    prisma.registration.groupBy.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        event_id: `${i}`,
        _count: { event_id: 5 - i },
      })),
    );
    prisma.event.findMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        id: `${i}`,
        title: `Event ${i}`,
        total_seats: 100,
        booked_seats: 50,
        slug: `event-${i}`,
      })),
    );

    const result = await getTopEventsByRegistrations(5);

    expect(result.length).toBe(5);
    expect(prisma.registration.groupBy).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
  });
});
