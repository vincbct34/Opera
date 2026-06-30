/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  GET as UpdateStatus,
  POST as ManualUpdateStatus,
} from '@/app/api/cron/events/status-update/route';
import { NextRequest } from 'next/server';
import prisma from '@/lib/middleware/prismaConfig';
import { EventStatus } from '@/app/generated/prisma/enums';
import { HolidaysService } from '@/lib/services/holidays.service';

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
      update: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

// Mock Cron Auth
jest.mock('@/lib/middleware/cronAuth', () => ({
  requireCronAuth: jest.fn((req: any, handler: any) => handler(req)),
}));

// Mock Logger
jest.mock('@/lib/middleware/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// We DON'T mock the whole module for HolidaysService so we can spy on the method
// But if it calls fetch, we might want to mock the fetch inside it?
// Or we can just mock the static method directly if we want to test the ROUTE not the SERVICE.
// Since we are testing the route, mocking the service is fine.
// Using jest.spyOn requires the method to exist.
// Let's just mock the method on the class prototype or static property.

// Helper to create mock request
const createMockRequest = (url: string, options: any = {}) => {
  const req: any = {
    nextUrl: new URL(url),
    url,
    method: options.method || 'GET',
    headers: new Headers(options.headers || {}),
    json: async () => options.body || {},
  };
  return req as NextRequest;
};

describe('Cron API', () => {
  let getOpeningLimitDateSpy: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Spy on the static method
    // Note: If HolidaysService is a class with static method, we can spy on it.
    // However, if we previously mocked the module with jest.mock, we can't easily use spyOn on the real implementation.
    // So we need to ensure we are mocking the specific method.

    // If we remove the jest.mock('@/lib/services/holidays.service'), we run into issues if the service does real work (fetch).
    // The previous mock was:
    // jest.mock('@/lib/services/holidays.service', () => ({ HolidaysService: { getOpeningLimitDate: jest.fn() } }));
    // This is fine. Use 'as jest.Mock' on the imported object.

    const farFuture = new Date();
    farFuture.setFullYear(farFuture.getFullYear() + 10);

    // Setup default mock implementation
    getOpeningLimitDateSpy = jest
      .spyOn(HolidaysService, 'getOpeningLimitDate')
      .mockResolvedValue(farFuture);
  });

  afterEach(() => {
    getOpeningLimitDateSpy.mockRestore();
  });

  describe('GET /api/cron/events/status-update', () => {
    it('should close past events', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const events = [
        { id: 'evt-1', title: 'Past Event', status: EventStatus.OPEN, event_dates: [pastDate] },
      ];
      (prisma.event.findMany as unknown as jest.Mock<any>).mockResolvedValue(events);

      const req = createMockRequest('http://localhost/api/cron/events/status-update');
      const res = await UpdateStatus(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.summary.updatedToClosedCount).toBe(1);
      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: 'evt-1' },
        data: { status: EventStatus.CLOSED },
      });
    });

    it('should open future events (standard case)', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const events = [
        {
          id: 'evt-2',
          title: 'Future Event',
          status: EventStatus.CLOSED,
          event_dates: [futureDate],
        },
      ];
      (prisma.event.findMany as unknown as jest.Mock<any>).mockResolvedValue(events);

      const req = createMockRequest('http://localhost/api/cron/events/status-update');
      const res = await UpdateStatus(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.summary.updatedToOpenCount).toBe(1);
      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: 'evt-2' },
        data: { status: EventStatus.OPEN },
      });
    });
    it('should NOT open future events if they start after the opening limit date', async () => {
      // Mock opening limit to be tomorrow
      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() + 1);
      getOpeningLimitDateSpy.mockResolvedValue(limitDate);

      // Event starts in 2 days (after limit)
      const farFutureDate = new Date();
      farFutureDate.setDate(farFutureDate.getDate() + 2);

      const events = [
        {
          id: 'evt-3',
          title: 'Far Future Event',
          status: EventStatus.CLOSED,
          event_dates: [farFutureDate],
        },
      ];
      (prisma.event.findMany as unknown as jest.Mock<any>).mockResolvedValue(events);

      const req = createMockRequest('http://localhost/api/cron/events/status-update');
      const res = await UpdateStatus(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      // specific check: evt-3 is NOT updated to OPEN
      expect(prisma.event.update).not.toHaveBeenCalledWith({
        where: { id: 'evt-3' },
        data: { status: EventStatus.OPEN },
      });
      // It might be counted as 'skipped' or just not 'updatedToOpen'
      expect(data.summary.updatedToOpenCount).toBe(0);
    });

    it('should open future events if they start before or on the opening limit date', async () => {
      // Mock opening limit to be in 7 days
      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() + 7);
      getOpeningLimitDateSpy.mockResolvedValue(limitDate);

      // Event starts in 2 days (before limit)
      const nearFutureDate = new Date();
      nearFutureDate.setDate(nearFutureDate.getDate() + 2);

      const events = [
        {
          id: 'evt-4',
          title: 'Near Future Event',
          status: EventStatus.CLOSED,
          event_dates: [nearFutureDate],
        },
      ];
      (prisma.event.findMany as unknown as jest.Mock<any>).mockResolvedValue(events);

      const req = createMockRequest('http://localhost/api/cron/events/status-update');
      const res = await UpdateStatus(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.summary.updatedToOpenCount).toBe(1);
      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: 'evt-4' },
        data: { status: EventStatus.OPEN },
      });
    });

    it('should not update events whose status is protected', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const events = [
        {
          id: 'evt-5',
          title: 'Protected Status Event',
          status: EventStatus.OPEN,
          event_dates: [pastDate],
          protected_fields: ['status'],
        },
      ];
      (prisma.event.findMany as unknown as jest.Mock<any>).mockResolvedValue(events);

      const req = createMockRequest('http://localhost/api/cron/events/status-update');
      const res = await UpdateStatus(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.summary.updatedToClosedCount).toBe(0);
      expect(data.summary.updatedToOpenCount).toBe(0);
      expect(prisma.event.update).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/cron/events/status-update', () => {
    it('should support dry run', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const events = [
        { id: 'evt-1', title: 'Past Event', status: EventStatus.OPEN, event_dates: [pastDate] },
      ];
      (prisma.event.findMany as unknown as jest.Mock<any>).mockResolvedValue(events);

      const req = createMockRequest('http://localhost/api/cron/events/status-update', {
        method: 'POST',
        body: { dryRun: true },
      });

      const res = await ManualUpdateStatus(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.dryRun).toBe(true);
      expect(data.summary.toCloseCount).toBe(1);
      expect(prisma.event.update).not.toHaveBeenCalled();
    });

    it('should ignore events whose status is protected', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const events = [
        {
          id: 'evt-6',
          title: 'Protected Status Event',
          status: EventStatus.OPEN,
          event_dates: [pastDate],
          protected_fields: ['status'],
        },
      ];
      (prisma.event.findMany as unknown as jest.Mock<any>).mockResolvedValue(events);

      const req = createMockRequest('http://localhost/api/cron/events/status-update', {
        method: 'POST',
        body: {},
      });

      const res = await ManualUpdateStatus(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.summary.toCloseCount).toBe(0);
      expect(data.summary.toOpenCount).toBe(0);
      expect(prisma.event.update).not.toHaveBeenCalled();
    });
  });
});
