/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { GET as ListRegistrations } from '@/app/api/registrations/route';
import {
  GET as GetRegistration,
  PATCH as UpdateRegistration,
  DELETE as DeleteRegistration,
} from '@/app/api/registrations/[id]/route';
import { NextRequest } from 'next/server';
import prisma from '@/lib/middleware/prismaConfig';
import { Role } from '@prisma/client';

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
    registration: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    registrationDisability: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    event: {
      update: jest.fn(),
    },
    eventSession: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
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
}));

// Mock Notifications
jest.mock('@/lib/notifications/unifiedNotificationService', () => ({
  UnifiedNotificationService: {
    notifyRegistrationCancelled: jest.fn(),
  },
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

describe('Registrations API', () => {
  const mockRegistration = {
    id: 'reg-1',
    user_id: 'user-1',
    event_id: 'evt-1',
    institution_id: 'inst-1',
    status: 'PENDING',
    booked_seats: 5,
    want_formation: null,
    created_at: new Date(),
    event: { title: 'Event' },
    institution: { name: 'Inst' },
    disabilities: [],
    blockSelections: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/registrations', () => {
    it('should return user registrations', async () => {
      (prisma.registration.findMany as unknown as jest.Mock<any>).mockResolvedValue([
        mockRegistration,
      ]);
      (prisma.registration.count as unknown as jest.Mock<any>).mockResolvedValue(1);

      const req = createMockRequest('http://localhost/api/registrations', {
        user: { id: 'user-1', role: Role.USER },
      });

      const res = await ListRegistrations(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.registrations).toHaveLength(1);
    });
  });

  describe('GET /api/registrations/[id]', () => {
    it('should return registration details for owner', async () => {
      (prisma.registration.findUnique as unknown as jest.Mock<any>).mockResolvedValue(
        mockRegistration,
      );

      const req = createMockRequest(`http://localhost/api/registrations/${mockRegistration.id}`, {
        user: { id: 'user-1', role: Role.USER },
      });

      const res = await GetRegistration(req, {
        params: Promise.resolve({ id: mockRegistration.id }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.registration.id).toBe(mockRegistration.id);
    });

    it('should return 403 for non-owner', async () => {
      (prisma.registration.findUnique as unknown as jest.Mock<any>).mockResolvedValue(
        mockRegistration,
      );

      const req = createMockRequest(`http://localhost/api/registrations/${mockRegistration.id}`, {
        user: { id: 'other-user', role: Role.USER },
      });

      const res = await GetRegistration(req, {
        params: Promise.resolve({ id: mockRegistration.id }),
      });

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/registrations/[id]', () => {
    it('should allow user to cancel pending registration', async () => {
      (prisma.registration.findUnique as unknown as jest.Mock<any>)
        .mockResolvedValueOnce(mockRegistration)
        .mockResolvedValueOnce({
          ...mockRegistration,
          status: 'CANCELLED',
          date: new Date(),
        });

      (prisma.registration.update as unknown as jest.Mock<any>).mockResolvedValue({
        ...mockRegistration,
        status: 'CANCELLED',
        date: new Date(), // Needed for notification
      });

      const req = createMockRequest(`http://localhost/api/registrations/${mockRegistration.id}`, {
        method: 'PATCH',
        body: { status: 'CANCELLED' },
        user: { id: 'user-1', role: Role.USER },
      });

      const res = await UpdateRegistration(req, {
        params: Promise.resolve({ id: mockRegistration.id }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.registration.status).toBe('CANCELLED');
    });

    it('should allow user to update fields on pending registration', async () => {
      (prisma.registration.findUnique as unknown as jest.Mock<any>)
        .mockResolvedValueOnce(mockRegistration)
        .mockResolvedValueOnce({ ...mockRegistration, booked_seats: 10 });

      (prisma.registration.update as unknown as jest.Mock<any>).mockResolvedValue({
        ...mockRegistration,
        booked_seats: 10,
      });

      const req = createMockRequest(`http://localhost/api/registrations/${mockRegistration.id}`, {
        method: 'PATCH',
        body: { booked_seats: 10 },
        user: { id: 'user-1', role: Role.USER },
      });

      const res = await UpdateRegistration(req, {
        params: Promise.resolve({ id: mockRegistration.id }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.registration.id).toBe(mockRegistration.id);
    });

    it('should free up event and séance seats when an admin cancels a confirmed registration', async () => {
      const confirmedRegistration = {
        ...mockRegistration,
        status: 'CONFIRMED',
        date: new Date('2026-05-01T10:00:00Z'),
      };
      (prisma.registration.findUnique as unknown as jest.Mock<any>)
        .mockResolvedValueOnce(confirmedRegistration)
        .mockResolvedValueOnce({ ...confirmedRegistration, status: 'CANCELLED' });

      (prisma.registration.update as unknown as jest.Mock<any>).mockResolvedValue({
        ...confirmedRegistration,
        status: 'CANCELLED',
      });

      const req = createMockRequest(`http://localhost/api/registrations/${mockRegistration.id}`, {
        method: 'PATCH',
        body: { status: 'CANCELLED' },
        user: { id: 'admin-1', role: Role.ADMIN },
      });

      const res = await UpdateRegistration(req, {
        params: Promise.resolve({ id: mockRegistration.id }),
      });

      expect(res.status).toBe(200);
      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: confirmedRegistration.event_id },
        data: { booked_seats: { decrement: confirmedRegistration.booked_seats } },
      });
      expect(prisma.eventSession.updateMany).toHaveBeenCalledWith({
        where: { event_id: confirmedRegistration.event_id, date: confirmedRegistration.date },
        data: { booked_seats: { decrement: confirmedRegistration.booked_seats } },
      });
    });

    it('should prevent user from cancelling confirmed registration', async () => {
      (prisma.registration.findUnique as unknown as jest.Mock<any>).mockResolvedValue({
        ...mockRegistration,
        status: 'CONFIRMED',
      });

      const req = createMockRequest(`http://localhost/api/registrations/${mockRegistration.id}`, {
        method: 'PATCH',
        body: { status: 'CANCELLED' },
        user: { id: 'user-1', role: Role.USER },
      });

      const res = await UpdateRegistration(req, {
        params: Promise.resolve({ id: mockRegistration.id }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/registrations/[id]', () => {
    it('should allow user to delete own registration', async () => {
      (prisma.registration.findUnique as unknown as jest.Mock<any>).mockResolvedValue(
        mockRegistration,
      );
      (prisma.registration.delete as unknown as jest.Mock<any>).mockResolvedValue(mockRegistration);

      const req = createMockRequest(`http://localhost/api/registrations/${mockRegistration.id}`, {
        method: 'DELETE',
        user: { id: 'user-1', role: Role.USER },
      });

      const res = await DeleteRegistration(req, {
        params: Promise.resolve({ id: mockRegistration.id }),
      });

      expect(res.status).toBe(200);
    });

    it('should free up event and séance seats when deleting a confirmed registration', async () => {
      const confirmedRegistration = {
        ...mockRegistration,
        status: 'CONFIRMED',
        date: new Date('2026-05-01T10:00:00Z'),
      };
      (prisma.registration.findUnique as unknown as jest.Mock<any>).mockResolvedValue(
        confirmedRegistration,
      );
      (prisma.registration.delete as unknown as jest.Mock<any>).mockResolvedValue(
        confirmedRegistration,
      );

      const req = createMockRequest(`http://localhost/api/registrations/${mockRegistration.id}`, {
        method: 'DELETE',
        user: { id: 'user-1', role: Role.USER },
      });

      const res = await DeleteRegistration(req, {
        params: Promise.resolve({ id: mockRegistration.id }),
      });

      expect(res.status).toBe(200);
      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: confirmedRegistration.event_id },
        data: { booked_seats: { decrement: confirmedRegistration.booked_seats } },
      });
      expect(prisma.eventSession.updateMany).toHaveBeenCalledWith({
        where: { event_id: confirmedRegistration.event_id, date: confirmedRegistration.date },
        data: { booked_seats: { decrement: confirmedRegistration.booked_seats } },
      });
    });
  });
});
