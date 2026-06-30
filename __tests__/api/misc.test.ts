/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { PATCH as UpdateGroup, DELETE as DeleteGroup } from '@/app/api/groups/[groupId]/route';
import { POST as ReportCSP } from '@/app/api/csp-report/route';
import { NextRequest } from 'next/server';
import prisma from '@/lib/middleware/prismaConfig';
import { Role } from '@/app/generated/prisma/enums';

// Mock NextRequest/NextResponse
jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server') as any;
  const mockNextResponse = {
    json: jest.fn((body: any, init?: any) => ({
      json: () => Promise.resolve(body),
      status: init?.status || 200,
    })),
  };
  // Add constructor support
  Object.defineProperty(mockNextResponse, 'prototype', {
    value: {
      json: () => Promise.resolve({}),
    },
    writable: true,
  });
  return {
    ...actual,
    NextResponse: Object.assign(
      jest.fn((body?: any, init?: any) => ({
        json: () => Promise.resolve(body),
        status: init?.status || 200,
      })),
      mockNextResponse,
    ),
  };
});

// Mock Prisma
jest.mock('@/lib/middleware/prismaConfig', () => ({
  __esModule: true,
  default: {
    group: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
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

// Mock Logger
jest.mock('@/lib/middleware/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
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
    text: async () => JSON.stringify(options.body || {}),
  };

  if (options.user) {
    req.user = options.user;
  }

  return req as NextRequest;
};

describe('Misc API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PATCH /api/groups/[groupId]', () => {
    const mockGroup = { id: 'group-1', user_id: 'user-1', students_count: 20 };

    it('should update group successfully', async () => {
      (prisma.group.findUnique as unknown as jest.Mock<any>).mockResolvedValue(mockGroup);
      (prisma.group.update as unknown as jest.Mock<any>).mockResolvedValue({
        ...mockGroup,
        students_count: 25,
      });

      const req = createMockRequest('http://localhost/api/groups/group-1', {
        method: 'PATCH',
        body: { students_count: 25 },
        user: { id: 'user-1', role: Role.USER },
      });

      const res = await UpdateGroup(req, { params: Promise.resolve({ groupId: 'group-1' }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.group.students_count).toBe(25);
    });

    it('should deny update for non-owner', async () => {
      (prisma.group.findUnique as unknown as jest.Mock<any>).mockResolvedValue(mockGroup);

      const req = createMockRequest('http://localhost/api/groups/group-1', {
        method: 'PATCH',
        body: { students_count: 25 },
        user: { id: 'other-user', role: Role.USER },
      });

      const res = await UpdateGroup(req, { params: Promise.resolve({ groupId: 'group-1' }) });
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/groups/[groupId]', () => {
    const mockGroup = { id: 'group-1', user_id: 'user-1' };

    it('should delete group successfully', async () => {
      (prisma.group.findUnique as unknown as jest.Mock<any>).mockResolvedValue(mockGroup);
      (prisma.group.delete as unknown as jest.Mock<any>).mockResolvedValue(mockGroup);

      const req = createMockRequest('http://localhost/api/groups/group-1', {
        method: 'DELETE',
        user: { id: 'user-1', role: Role.USER },
      });

      const res = await DeleteGroup(req, { params: Promise.resolve({ groupId: 'group-1' }) });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/csp-report', () => {
    it('should accept CSP report', async () => {
      const req = createMockRequest('http://localhost/api/csp-report', {
        method: 'POST',
        body: {
          'csp-report': {
            'document-uri': 'http://localhost',
            'violated-directive': 'script-src',
          },
        },
      });

      const res = await ReportCSP(req);
      expect(res.status).toBe(204);
    });
  });
});
