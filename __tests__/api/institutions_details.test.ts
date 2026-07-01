/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  GET as GetInstitution,
  PUT as UpdateInstitution,
  DELETE as DeleteInstitution,
} from '@/app/api/institutions/[id]/route';
import { GET as GetHistory } from '@/app/api/institutions/[id]/history/route';
import { GET as GetRegistrations } from '@/app/api/institutions/[id]/registrations/route';
import { GET as SearchInstitutions } from '@/app/api/institutions/search/route';
import { NextRequest } from 'next/server';
import prisma from '@/lib/middleware/prismaConfig';
import { Role } from '@prisma/client';
import { calculateInstitutionHistoryWithCache } from '@/lib/events/registrationAnalytics';

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
    institution: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    address: {
      update: jest.fn(),
      delete: jest.fn(),
    },
    registration: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn((callback: any) => callback(prisma)),
  },
}));

// Mock Middleware
jest.mock('@/app/api/middleware', () => ({
  requireAuth: jest.fn((req: any, handler: any) => {
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
  createAuthMiddleware: jest.fn(() => (req: any, handler: any) => handler(req)),
}));

// Mock Analytics
jest.mock('@/lib/events/registrationAnalytics', () => ({
  calculateInstitutionHistoryWithCache: jest.fn(),
  formatHistorySummary: jest.fn(),
  getHistoryHealth: jest.fn(),
  generateHistoryReport: jest.fn(),
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

describe('Institution Details API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/institutions/[id]', () => {
    it('should return institution details', async () => {
      const mockInst = { id: 'inst-1', name: 'Test Inst' };
      (prisma.institution.findUnique as unknown as jest.Mock<any>).mockResolvedValue(mockInst);

      const req = createMockRequest('http://localhost/api/institutions/inst-1', {
        user: { id: 'user-1', role: Role.USER },
      });

      const res = await GetInstitution(req, { params: Promise.resolve({ id: 'inst-1' }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.institution).toEqual(mockInst);
    });

    it('should return 404 if not found', async () => {
      (prisma.institution.findUnique as unknown as jest.Mock<any>).mockResolvedValue(null);

      const req = createMockRequest('http://localhost/api/institutions/inst-1', {
        user: { id: 'user-1', role: Role.USER },
      });

      const res = await GetInstitution(req, { params: Promise.resolve({ id: 'inst-1' }) });
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/institutions/[id]', () => {
    const mockInst = {
      id: 'inst-1',
      name: 'Old Name',
      address_id: 'addr-1',
      email: 'old@test.com',
    };

    it('should update institution', async () => {
      (prisma.institution.findUnique as unknown as jest.Mock<any>).mockResolvedValueOnce(mockInst); // Find existing
      (prisma.institution.findFirst as unknown as jest.Mock<any>).mockResolvedValueOnce(null); // Check name uniqueness

      (prisma.institution.update as unknown as jest.Mock<any>).mockResolvedValue({
        ...mockInst,
        name: 'New Name',
      });

      const req = createMockRequest('http://localhost/api/institutions/inst-1', {
        method: 'PUT',
        body: { name: 'New Name' },
        user: { id: 'admin-1', role: Role.ADMIN },
      });

      const res = await UpdateInstitution(req, { params: Promise.resolve({ id: 'inst-1' }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.institution.name).toBe('New Name');
    });

    it('should deny non-admin', async () => {
      const req = createMockRequest('http://localhost/api/institutions/inst-1', {
        method: 'PUT',
        body: { name: 'New Name' },
        user: { id: 'user-1', role: Role.USER },
      });

      const res = await UpdateInstitution(req, { params: Promise.resolve({ id: 'inst-1' }) });
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/institutions/[id]', () => {
    const mockInst = {
      id: 'inst-1',
      address_id: 'addr-1',
      _count: { userInstitutions: 0, registrations: 0 },
    };

    it('should delete institution', async () => {
      (prisma.institution.findUnique as unknown as jest.Mock<any>).mockResolvedValue(mockInst);

      const req = createMockRequest('http://localhost/api/institutions/inst-1', {
        method: 'DELETE',
        user: { id: 'admin-1', role: Role.ADMIN },
      });

      const res = await DeleteInstitution(req, { params: Promise.resolve({ id: 'inst-1' }) });
      expect(res.status).toBe(200);
    });

    it('should prevent deletion if dependencies exist', async () => {
      (prisma.institution.findUnique as unknown as jest.Mock<any>).mockResolvedValue({
        ...mockInst,
        _count: { userInstitutions: 1, registrations: 0 },
      });

      const req = createMockRequest('http://localhost/api/institutions/inst-1', {
        method: 'DELETE',
        user: { id: 'admin-1', role: Role.ADMIN },
      });

      const res = await DeleteInstitution(req, { params: Promise.resolve({ id: 'inst-1' }) });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/institutions/[id]/history', () => {
    it('should return history', async () => {
      (prisma.institution.findUnique as unknown as jest.Mock<any>).mockResolvedValue({
        id: 'inst-1',
      });
      (calculateInstitutionHistoryWithCache as unknown as jest.Mock<any>).mockResolvedValue({
        institutionId: 'inst-1',
        totalRegistrations: 10,
      });

      const req = createMockRequest('http://localhost/api/institutions/inst-1/history', {
        user: { id: 'admin-1', role: Role.ADMIN },
      });

      const res = await GetHistory(req, { params: Promise.resolve({ id: 'inst-1' }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.history.totalRegistrations).toBe(10);
    });
  });

  describe('GET /api/institutions/[id]/registrations', () => {
    it('should return registrations', async () => {
      (prisma.registration.findMany as unknown as jest.Mock<any>).mockResolvedValue([
        { id: 'reg-1' },
      ]);
      (prisma.registration.count as unknown as jest.Mock<any>).mockResolvedValue(1);

      const req = createMockRequest('http://localhost/api/institutions/inst-1/registrations', {
        user: { id: 'user-1', role: Role.USER },
      });

      const res = await GetRegistrations(req, { params: Promise.resolve({ id: 'inst-1' }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.registrations).toHaveLength(1);
    });
  });

  describe('GET /api/institutions/search', () => {
    it('should search institutions by name', async () => {
      (prisma.institution.findMany as unknown as jest.Mock<any>).mockResolvedValue([
        {
          id: 'inst-1',
          name: 'Paris School',
          type: ['ELEMENTAIRE'],
          address: { street: '1 rue de Paris', city: 'Paris', zip_code: '75001' },
        },
      ]);

      const req = createMockRequest('http://localhost/api/institutions/search?name=Paris');

      const res = await SearchInstitutions(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.institutions).toBeDefined();
      expect(data.institutions.length).toBeGreaterThan(0);
    });

    it('should search institutions by name and city', async () => {
      (prisma.institution.findMany as unknown as jest.Mock<any>).mockResolvedValue([
        {
          id: 'inst-1',
          name: 'School',
          type: ['ELEMENTAIRE'],
          address: { street: '1 rue de Paris', city: 'Paris', zip_code: '75001' },
        },
      ]);

      const req = createMockRequest(
        'http://localhost/api/institutions/search?name=School&city=Paris',
      );

      const res = await SearchInstitutions(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.institutions).toBeDefined();
      expect(data.institutions.length).toBeGreaterThan(0);
    });

    it('should require min 2 chars for name', async () => {
      const req = createMockRequest('http://localhost/api/institutions/search?name=P');

      const res = await SearchInstitutions(req);
      const data = await res.json();

      expect(data.institutions).toHaveLength(0);
      expect(data.message).toContain('2 caractères');
    });
  });
});
