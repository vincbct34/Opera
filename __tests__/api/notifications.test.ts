/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  GET as ListNotifications,
  PUT as UpdateNotifications,
  DELETE as DeleteNotifications,
} from '@/app/api/notifications/route';
import { NextRequest } from 'next/server';
import prisma from '@/lib/middleware/prismaConfig';
import { Role } from '@/app/generated/prisma/enums';

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
    notification: {
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
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

describe('Notifications API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/notifications', () => {
    it('should return user notifications', async () => {
      (prisma.notification.findMany as unknown as jest.Mock<any>).mockResolvedValue([
        { id: 'notif-1', message: 'Test' },
      ]);
      (prisma.notification.count as unknown as jest.Mock<any>).mockResolvedValue(1);

      const req = createMockRequest('http://localhost/api/notifications', {
        user: { id: 'user-1', role: Role.USER },
      });

      const res = await ListNotifications(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.notifications).toHaveLength(1);
      expect(data.total).toBe(1);
    });
  });

  describe('PUT /api/notifications', () => {
    it('should mark notifications as read', async () => {
      (prisma.notification.updateMany as unknown as jest.Mock<any>).mockResolvedValue({ count: 2 });

      const req = createMockRequest('http://localhost/api/notifications', {
        method: 'PUT',
        body: { notificationIds: ['n1', 'n2'] },
        user: { id: 'user-1', role: Role.USER },
      });

      const res = await UpdateNotifications(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.updatedCount).toBe(2);
    });

    it('should mark all as read', async () => {
      (prisma.notification.updateMany as unknown as jest.Mock<any>).mockResolvedValue({ count: 5 });

      const req = createMockRequest('http://localhost/api/notifications', {
        method: 'PUT',
        body: { markAllAsRead: true },
        user: { id: 'user-1', role: Role.USER },
      });

      const res = await UpdateNotifications(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.updatedCount).toBe(5);
    });
  });

  describe('DELETE /api/notifications', () => {
    it('should delete notifications', async () => {
      (prisma.notification.deleteMany as unknown as jest.Mock<any>).mockResolvedValue({ count: 1 });

      const req = createMockRequest('http://localhost/api/notifications', {
        method: 'DELETE',
        body: { notificationIds: ['n1'] },
        user: { id: 'user-1', role: Role.USER },
      });

      const res = await DeleteNotifications(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.deletedCount).toBe(1);
    });
  });
});
