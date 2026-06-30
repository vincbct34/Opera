/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { GET as ListEvents, POST as CreateEvent } from '@/app/api/admin/events/route';
import { GET as GetStats } from '@/app/api/admin/stats/route';
import { POST as CreateScoringConfig } from '@/app/api/admin/scoring-config/route';
import { NextRequest } from 'next/server';
import prisma from '@/lib/middleware/prismaConfig';
import { Role, EventType, PublicCategory } from '@/app/generated/prisma';
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
jest.mock('@/lib/middleware/prismaConfig', () => ({
  __esModule: true,
  default: {
    event: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    scoringConfiguration: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

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
