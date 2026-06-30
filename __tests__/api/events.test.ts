/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { GET as ListEvents } from '@/app/api/events/route';
import { GET as GetEvent } from '@/app/api/events/[slug]/route';
import {
  GET as ListEventRegistrations,
  POST as CreateRegistration,
} from '@/app/api/events/[slug]/registrations/route';
import { NextRequest } from 'next/server';
import prisma from '@/lib/middleware/prismaConfig';
import { Role, PublicCategory } from '@/app/generated/prisma/enums';

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
jest.mock('@/lib/middleware/prismaConfig', () => ({
  __esModule: true,
  default: {
    event: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    registration: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    registrationBlockSelection: {
      createMany: jest.fn(),
    },
    userInstitution: {
      findFirst: jest.fn(),
    },
    scoringConfiguration: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

// Mock Middleware
jest.mock('@/app/api/middleware', () => ({
  createAuthMiddleware: jest.fn(() => (req: any, handler: any) => handler(req)),
  requireAuth: jest.fn((req: any, handler: any) => {
    // Default to authenticated user
    if (!req.user) {
      req.user = { id: 'user-1', role: Role.USER };
    }
    return handler(req);
  }),
  requireAdmin: jest.fn((req: any, handler: any) => {
    if (req.user?.role !== Role.ADMIN && req.user?.role !== Role.SUPERADMIN) {
      return Promise.resolve({ status: 403, json: () => Promise.resolve({ error: 'Forbidden' }) });
    }
    return handler(req);
  }),
}));

// Mock Scoring/Analytics
jest.mock('@/lib/scoring/scoringEngine', () => ({
  createScoringEngine: jest.fn(() => ({
    calculateScore: jest.fn(() => ({ normalizedScore: 100, breakdown: [] })),
  })),
}));

jest.mock('@/lib/events/registrationAnalytics', () => ({
  calculateMultipleInstitutionHistories: jest.fn(() => new Map()),
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

describe('Events API', () => {
  const mockEvent = {
    id: 'evt-1',
    slug: 'test-event',
    title: 'Test Event',
    description: 'Description',
    type: 'OPERA',
    category: [PublicCategory.LYCEE],
    grades: [],
    age_ranges: [],
    location: 'Paris',
    duration: 120,
    total_seats: 100,
    booked_seats: 10,
    status: 'OPEN',
    created_at: new Date(),
    updated_at: new Date(),
    event_dates: [new Date()],
    accessibility: [],
    has_initial_formation: true,
    is_formation_mandatory: false,
    has_musical_preparation: true,
    registrationBlocks: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/events', () => {
    it('should return list of events', async () => {
      (prisma.event.findMany as unknown as jest.Mock<any>).mockResolvedValue([mockEvent]);

      const req = createMockRequest('http://localhost/api/events');
      const res = await ListEvents(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.events).toHaveLength(1);
      expect(data.events[0].id).toBe(mockEvent.id);
    });
  });

  describe('GET /api/events/[slug]', () => {
    it('should return event details', async () => {
      (prisma.event.findFirst as unknown as jest.Mock<any>).mockResolvedValue(mockEvent);

      const req = createMockRequest(`http://localhost/api/events/${mockEvent.slug}`);
      const res = await GetEvent(req, { params: Promise.resolve({ slug: mockEvent.slug }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.event.id).toBe(mockEvent.id);
    });

    it('should return 404 if event not found', async () => {
      (prisma.event.findFirst as unknown as jest.Mock<any>).mockResolvedValue(null);
      (prisma.event.findUnique as unknown as jest.Mock<any>).mockResolvedValue(null);

      const req = createMockRequest('http://localhost/api/events/unknown');
      const res = await GetEvent(req, { params: Promise.resolve({ slug: 'unknown' }) });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/events/[slug]/registrations', () => {
    const validRegistrationData = {
      institution_id: 'inst-1',
      date: new Date().toISOString(),
      booked_seats: 5,
      want_formation: true,
      want_preparation: true,
    };

    it('should create registration successfully', async () => {
      (prisma.event.findFirst as unknown as jest.Mock<any>).mockResolvedValue(mockEvent);
      (prisma.userInstitution.findFirst as unknown as jest.Mock<any>).mockResolvedValue({
        id: 'ui-1',
      });
      (prisma.registration.create as unknown as jest.Mock<any>).mockResolvedValue({
        id: 'reg-1',
        status: 'PENDING',
        ...validRegistrationData,
      });

      const req = createMockRequest(`http://localhost/api/events/${mockEvent.slug}/registrations`, {
        method: 'POST',
        body: validRegistrationData,
        user: { id: 'user-1', role: Role.USER },
      });

      const res = await CreateRegistration(req, {
        params: Promise.resolve({ slug: mockEvent.slug }),
      });
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.registration.id).toBe('reg-1');
    });

    it('should reject registration when a mandatory block is not selected', async () => {
      const mandatoryBlockEvent = {
        ...mockEvent,
        registrationBlocks: [
          {
            id: 'block-1',
            title: 'Atelier obligatoire',
            dates: [new Date('2026-10-01T10:00:00.000Z')],
            enabled: true,
            registration_enabled: true,
            mandatory: true,
            order: 0,
          },
        ],
      };

      (prisma.event.findFirst as unknown as jest.Mock<any>).mockResolvedValue(mandatoryBlockEvent);
      (prisma.userInstitution.findFirst as unknown as jest.Mock<any>).mockResolvedValue({
        id: 'ui-1',
      });

      const req = createMockRequest(`http://localhost/api/events/${mockEvent.slug}/registrations`, {
        method: 'POST',
        body: validRegistrationData,
        user: { id: 'user-1', role: Role.USER },
      });

      const res = await CreateRegistration(req, {
        params: Promise.resolve({ slug: mockEvent.slug }),
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('obligatoire');
      expect(prisma.registration.create).not.toHaveBeenCalled();
    });

    it('should ignore hidden mandatory blocks when validating registration', async () => {
      const hiddenMandatoryBlockEvent = {
        ...mockEvent,
        registrationBlocks: [
          {
            id: 'block-1',
            title: 'Atelier masqué',
            dates: [new Date('2026-10-01T10:00:00.000Z')],
            enabled: false,
            registration_enabled: true,
            mandatory: true,
            order: 0,
          },
        ],
      };

      (prisma.event.findFirst as unknown as jest.Mock<any>).mockResolvedValue(
        hiddenMandatoryBlockEvent,
      );
      (prisma.userInstitution.findFirst as unknown as jest.Mock<any>).mockResolvedValue({
        id: 'ui-1',
      });
      (prisma.registration.create as unknown as jest.Mock<any>).mockResolvedValue({
        id: 'reg-1',
        status: 'PENDING',
        ...validRegistrationData,
      });

      const req = createMockRequest(`http://localhost/api/events/${mockEvent.slug}/registrations`, {
        method: 'POST',
        body: validRegistrationData,
        user: { id: 'user-1', role: Role.USER },
      });

      const res = await CreateRegistration(req, {
        params: Promise.resolve({ slug: mockEvent.slug }),
      });
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.registration.id).toBe('reg-1');
    });

    it('should return 403 if user not in institution', async () => {
      (prisma.event.findFirst as unknown as jest.Mock<any>).mockResolvedValue(mockEvent);
      (prisma.userInstitution.findFirst as unknown as jest.Mock<any>).mockResolvedValue(null);

      const req = createMockRequest(`http://localhost/api/events/${mockEvent.slug}/registrations`, {
        method: 'POST',
        body: validRegistrationData,
        user: { id: 'user-1', role: Role.USER },
      });

      const res = await CreateRegistration(req, {
        params: Promise.resolve({ slug: mockEvent.slug }),
      });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/events/[slug]/registrations', () => {
    it('should return registrations for admin', async () => {
      (prisma.event.findFirst as unknown as jest.Mock<any>).mockResolvedValue(mockEvent);
      (prisma.registration.findMany as unknown as jest.Mock<any>).mockResolvedValue([]);
      (prisma.registration.count as unknown as jest.Mock<any>).mockResolvedValue(0);
      (prisma.scoringConfiguration.findFirst as unknown as jest.Mock<any>).mockResolvedValue({
        id: 'conf-1',
        criteria: [],
        is_default: true,
      });

      const req = createMockRequest(`http://localhost/api/events/${mockEvent.slug}/registrations`, {
        user: { id: 'admin-1', role: Role.ADMIN },
      });

      const res = await ListEventRegistrations(req, {
        params: Promise.resolve({ slug: mockEvent.slug }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.registrations).toEqual([]);
    });

    it('should return 403 for non-admin', async () => {
      const req = createMockRequest(`http://localhost/api/events/${mockEvent.slug}/registrations`, {
        user: { id: 'user-1', role: Role.USER },
      });

      const res = await ListEventRegistrations(req, {
        params: Promise.resolve({ slug: mockEvent.slug }),
      });

      expect(res.status).toBe(403);
    });
  });
});
