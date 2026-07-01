/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { GET as ListEvents, POST as CreateEvent } from '@/app/api/admin/events/route';
import { PUT as UpdateEvent } from '@/app/api/admin/events/[id]/route';
import { GET as GetStats } from '@/app/api/admin/stats/route';
import { POST as CreateScoringConfig } from '@/app/api/admin/scoring-config/route';
import { NextRequest } from 'next/server';
import prisma from '@/lib/middleware/prismaConfig';
import { Role, EventType, PublicCategory, EventStatus } from '@prisma/client';
import { getDashboardStats } from '@/lib/middleware/admin';

// Mock NextRequest/NextResponse
jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server') as any;
  return {
    ...actual,
    NextResponse: {
      json: jest.fn((body: any, init?: any) => ({
        json: () => Promise.resolve(body),
        status: init?.status || 200,
      })),
    },
  };
});

// Mock Prisma
jest.mock('@/lib/middleware/prismaConfig', () => {
  const prismaMock: Record<string, any> = {
    event: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    eventRegistrationBlock: {
      deleteMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    scoringConfiguration: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  prismaMock.$transaction = jest.fn((callback: (tx: typeof prismaMock) => unknown) =>
    callback(prismaMock),
  );
  return { __esModule: true, default: prismaMock };
});

// Mock Middleware
jest.mock('@/app/api/middleware', () => ({
  requireAdmin: jest.fn((req: any, handler: any) => {
    if (req.user?.role !== Role.ADMIN && req.user?.role !== Role.SUPERADMIN) {
      return Promise.resolve({ status: 403, json: () => Promise.resolve({ error: 'Forbidden' }) });
    }
    return handler(req);
  }),
}));

// Mock Admin Lib
jest.mock('@/lib/middleware/admin', () => ({
  getDashboardStats: jest.fn(),
}));

// Mock Security Logger
jest.mock('@/lib/security/securityLogger', () => ({
  logAdminAccess: jest.fn(),
  logDataModification: jest.fn(),
}));

// Helper to create mock request
const createMockRequest = (url: string, options: any = {}) => {
  const req: any = {
    nextUrl: new URL(url),
    url,
    method: options.method || 'GET',
    headers: new Headers(options.headers || {}),
    json: async () => options.body || {},
  };

  if (options.user) {
    req.user = options.user;
  }

  return req as NextRequest;
};

describe('Admin API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/events', () => {
    it('should list events for admin', async () => {
      (prisma.event.findMany as unknown as jest.Mock<any>).mockResolvedValue([
        { id: 'evt-1', title: 'Test' },
      ]);

      const req = createMockRequest('http://localhost/api/admin/events', {
        user: { id: 'admin-1', role: Role.ADMIN },
      });

      const res = await ListEvents(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.events).toHaveLength(1);
    });

    it('should deny access to non-admin', async () => {
      const req = createMockRequest('http://localhost/api/admin/events', {
        user: { id: 'user-1', role: Role.USER },
      });

      const res = await ListEvents(req);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/admin/events', () => {
    const validEventData = {
      title: 'New Event',
      type: [EventType.OPERA],
      location: 'Paris',
      duration: 120,
      total_seats: 100,
      event_dates: [new Date().toISOString()],
      age_range: [PublicCategory.LYCEE],
    };

    it('should create event successfully', async () => {
      (prisma.event.create as unknown as jest.Mock<any>).mockResolvedValue({
        id: 'evt-new',
        ...validEventData,
      });

      const req = createMockRequest('http://localhost/api/admin/events', {
        method: 'POST',
        body: validEventData,
        user: { id: 'admin-1', role: Role.ADMIN },
      });

      const res = await CreateEvent(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.event.id).toBe('evt-new');
    });

    it('should return 400 for invalid data', async () => {
      const req = createMockRequest('http://localhost/api/admin/events', {
        method: 'POST',
        body: { title: '' }, // Invalid
        user: { id: 'admin-1', role: Role.ADMIN },
      });

      const res = await CreateEvent(req);
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/admin/events/[id]', () => {
    it('should not auto-protect fields when saving an unchanged event', async () => {
      const eventDate = new Date('2026-09-15T10:00:30.500Z');
      const submittedEventDate = '2026-09-15T10:00:00.000Z';
      const existingEvent = {
        id: 'evt-1',
        title: 'Existing Event',
        description: 'Line one\nLine two',
        type: [EventType.OPERA],
        location: 'Paris',
        duration: 120,
        total_seats: 100,
        caretaker: null,
        status: EventStatus.OPEN,
        image_url: null,
        event_dates: [eventDate],
        category: [PublicCategory.LYCEE],
        grades: [],
        age_ranges: [],
        has_initial_formation: false,
        has_musical_preparation: false,
        slug: null,
        manually_edited: false,
        protected_fields: [],
        accessibility: [],
      };

      (prisma.event.findUnique as unknown as jest.Mock<any>).mockResolvedValue(existingEvent);
      (prisma.event.update as unknown as jest.Mock<any>).mockResolvedValue(existingEvent);

      const req = createMockRequest('http://localhost/api/admin/events/evt-1', {
        method: 'PUT',
        body: {
          title: existingEvent.title,
          description: existingEvent.description,
          type: existingEvent.type,
          location: existingEvent.location,
          duration: existingEvent.duration,
          total_seats: existingEvent.total_seats,
          status: existingEvent.status,
          image_url: '',
          event_dates: [submittedEventDate],
          category: existingEvent.category,
          grades: existingEvent.grades,
          age_ranges: existingEvent.age_ranges,
          has_initial_formation: existingEvent.has_initial_formation,
          has_musical_preparation: existingEvent.has_musical_preparation,
          accessibility: [],
          protected_fields: [],
        },
        user: { id: 'admin-1', role: Role.ADMIN },
      });

      const res = await UpdateEvent(req, { params: Promise.resolve({ id: 'evt-1' }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.modified_fields).toEqual([]);
      expect(data.protected_fields).toEqual([]);
      expect(prisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'evt-1' },
          data: expect.objectContaining({
            description: undefined,
            image_url: undefined,
            event_dates: undefined,
            manually_edited: false,
            protected_fields: [],
          }),
        }),
      );
    });
  });

  describe('GET /api/admin/stats', () => {
    it('should return dashboard stats', async () => {
      const mockStats = { upcomingEvents: 5, totalUsers: 10 };
      (getDashboardStats as unknown as jest.Mock<any>).mockResolvedValue(mockStats);

      const req = createMockRequest('http://localhost/api/admin/stats', {
        user: { id: 'admin-1', role: Role.ADMIN },
      });

      const res = await GetStats(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.stats).toEqual(mockStats);
    });
  });

  describe('POST /api/admin/scoring-config', () => {
    const validConfig = {
      name: 'Test Config',
      criteria: [
        { type: 'ATTENDANCE_RATE', enabled: true, weight: 50 },
        { type: 'MONTHS_SINCE_LAST', enabled: true, weight: 50 },
      ],
    };

    it('should create scoring config', async () => {
      (prisma.scoringConfiguration.create as unknown as jest.Mock<any>).mockResolvedValue({
        id: 'conf-1',
        ...validConfig,
        criteria: validConfig.criteria,
      });

      const req = createMockRequest('http://localhost/api/admin/scoring-config', {
        method: 'POST',
        body: validConfig,
        user: { id: 'admin-1', role: Role.ADMIN },
      });

      const res = await CreateScoringConfig(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.configuration.id).toBe('conf-1');
    });

    it('should validate total weight is 100', async () => {
      const invalidConfig = {
        name: 'Bad Config',
        criteria: [
          { type: 'ATTENDANCE_RATE', enabled: true, weight: 10 }, // Total 10 != 100
        ],
      };

      const req = createMockRequest('http://localhost/api/admin/scoring-config', {
        method: 'POST',
        body: invalidConfig,
        user: { id: 'admin-1', role: Role.ADMIN },
      });

      const res = await CreateScoringConfig(req);
      expect(res.status).toBe(400);
    });
  });
});
