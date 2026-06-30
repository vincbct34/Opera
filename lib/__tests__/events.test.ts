/* eslint-disable */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { getEvents } from '@/lib/events/events';

jest.mock('@/lib/middleware/prismaConfig', () => {
  return {
    __esModule: true,
    default: {
      event: {
        findMany: jest.fn(),
      },
    },
  };
});

const prisma = require('@/lib/middleware/prismaConfig').default;

describe('lib/events helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getEvents returns normalized events', async () => {
    prisma.event.findMany.mockResolvedValue([
      {
        id: 'e1',
        title: 'Test Event',
        description: undefined,
        image_url: undefined,
        location: undefined,
        event_dates: [new Date().toISOString()],
        type: undefined,
        created_at: new Date().toISOString(),
      },
    ]);

    const events = await getEvents();
    expect(events.length).toBe(1);
    const e = events[0];
    expect(e.id).toBe('e1');
    expect(Array.isArray(e.event_dates)).toBe(true);
  });

  test('getEvents normalizes null fields to null', async () => {
    prisma.event.findMany.mockResolvedValue([
      {
        id: 'e2',
        title: 'Event with nulls',
        description: null,
        image_url: null,
        location: null,
        event_dates: null,
        type: null,
        created_at: new Date().toISOString(),
      },
    ]);

    const events = await getEvents();
    expect(events.length).toBe(1);
    const e = events[0];
    expect(e.description).toBeNull();
    expect(e.image_url).toBeNull();
    expect(e.location).toBeNull();
    expect(e.event_dates).toEqual([]);
    expect(e.type).toEqual([]);
  });

  test('getEvents handles empty event_dates array', async () => {
    prisma.event.findMany.mockResolvedValue([
      {
        id: 'e3',
        title: 'Event with empty dates',
        description: 'Test',
        image_url: 'https://example.com/img.jpg',
        location: 'Test Location',
        event_dates: [],
        type: ['OPERA'],
        created_at: new Date().toISOString(),
      },
    ]);

    const events = await getEvents();
    expect(events.length).toBe(1);
    expect(events[0].event_dates).toEqual([]);
  });

  test('getEvents excludes archived events by default', async () => {
    prisma.event.findMany.mockResolvedValue([]);

    await getEvents();

    expect(prisma.event.findMany).toHaveBeenCalledWith({
      where: { status: { not: 'ARCHIVED' } },
      orderBy: { event_dates: 'asc' },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        image_url: true,
        location: true,
        event_dates: true,
        type: true,
        category: true,
        grades: true,
        age_ranges: true,
        status: true,
      },
    });
  });

  test('getEvents includes archived events when includeArchived is true', async () => {
    prisma.event.findMany.mockResolvedValue([
      {
        id: 'e4',
        title: 'Archived Event',
        slug: 'archived-event',
        description: 'An archived event',
        image_url: null,
        location: 'Test Location',
        event_dates: [],
        type: ['OPERA'],
        age_range: [],
        status: 'ARCHIVED',
        created_at: new Date().toISOString(),
      },
    ]);

    const events = await getEvents(true);

    expect(prisma.event.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { event_dates: 'asc' },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        image_url: true,
        location: true,
        event_dates: true,
        type: true,
        category: true,
        grades: true,
        age_ranges: true,
        status: true,
      },
    });
    expect(events.length).toBe(1);
    expect(events[0].status).toBe('ARCHIVED');
  });
});
