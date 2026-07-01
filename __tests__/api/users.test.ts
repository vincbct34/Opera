/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { GET as ListUsers, POST as CreateUser } from '@/app/api/users/route';
import {
  GET as GetUser,
  PATCH as UpdateUser,
  DELETE as DeleteUser,
} from '@/app/api/users/[id]/route';
import { Role } from '@prisma/client';
import prisma from '@/lib/middleware/prismaConfig';

// Mock next/server
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn((body, init?: { status?: number }) => ({
      status: init?.status || 200,
      json: async () => body,
      headers: {
        set: jest.fn(),
        get: jest.fn(),
      },
      cookies: {
        set: jest.fn(),
        get: jest.fn(),
      },
    })),
  },
}));

import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/middleware/prismaConfig', () => ({
  user: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn((callback: any) => callback(prisma)),
  // Mock other models used in delete transaction
  group: { deleteMany: jest.fn() },
  registration: {
    findMany: (
      jest.fn() as unknown as jest.Mock<(...args: unknown[]) => Promise<unknown>>
    ).mockResolvedValue([]), // Fix: Return empty array
    deleteMany: jest.fn(),
  },
  registrationDisability: { deleteMany: jest.fn() },
  notification: { deleteMany: jest.fn() },
  userInstitution: { deleteMany: jest.fn(), createMany: jest.fn() },
  passwordResetToken: { deleteMany: jest.fn() },
  passwordHistory: { deleteMany: jest.fn() },
  refreshTokenBlacklist: { deleteMany: jest.fn() },
}));

// Mock middleware directly to bypass auth/csrf/ratelimit logic
jest.mock('@/app/api/middleware', () => ({
  requireAdmin: jest.fn((req: any, handler: any) => {
    // Simulate authenticated admin user
    req.user = {
      id: 'admin-123',
      email: 'admin@example.com',
      role: 'ADMIN',
      institution_ids: [],
    };
    return handler(req);
  }),
  requireAdminOrSameUser: jest.fn((req: any, handler: any) => {
    // Simulate authenticated admin user
    req.user = {
      id: 'admin-123',
      email: 'admin@example.com',
      role: 'ADMIN',
      institution_ids: [],
    };
    return handler(req);
  }),
  publicRoute: jest.fn((req: any, handler: any) => handler(req)),
  createAuthMiddleware: jest.fn(() => (req: any, handler: any) => handler(req)),
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

jest.mock('@/lib/notifications/emailService', () => ({
  sendEmail: jest.fn(),
  generateEmailVerificationToken: jest.fn(() => 'mock-token'),
  generateVerificationUrl: jest.fn(() => 'http://localhost/verify'),
}));

jest.mock('@/lib/notifications/notificationService', () => ({
  NotificationService: {
    createNotification: jest.fn(),
  },
}));

jest.mock('@/lib/security/securityLogger', () => ({
  logAdminAccess: jest.fn(),
  logDataModification: jest.fn(),
}));

jest.mock('@/lib/middleware/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Fix: return an array
jest.mock('@/lib/security/logSanitization', () => ({
  sanitizeLogArgs: jest.fn((args: any) => [args]),
}));

// Helper to create a mock request
function createMockRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {},
): NextRequest {
  const { method = 'GET', headers = {}, body } = options;

  const normalizedHeaders: Record<string, string> = {};
  Object.keys(headers).forEach((key) => {
    normalizedHeaders[key.toLowerCase()] = headers[key];
  });

  return {
    url,
    method,
    headers: {
      get: (name: string) => normalizedHeaders[name.toLowerCase()] || null,
    },
    json: async () => body || {},
  } as unknown as NextRequest;
}

describe('/api/users', () => {
  const mockAdminUser = {
    id: 'admin-123',
    email: 'admin@example.com',
    role: Role.ADMIN,
  };

  const mockUser = {
    id: 'user-123',
    email: 'user@example.com',
    first_name: 'John',
    last_name: 'Doe',
    role: Role.USER,
    userInstitutions: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (
      prisma.user.findUnique as unknown as jest.Mock<(...args: unknown[]) => Promise<unknown>>
    ).mockImplementation((args: any) => {
      if (args.where.id === mockAdminUser.id) return Promise.resolve(mockAdminUser);
      if (args.where.id === mockUser.id) return Promise.resolve(mockUser);
      return Promise.resolve(null);
    });
  });

  describe('GET /', () => {
    it('should return list of users for admin', async () => {
      (
        prisma.user.findMany as unknown as jest.Mock<(...args: unknown[]) => Promise<unknown>>
      ).mockResolvedValue([mockUser]);
      (
        prisma.user.count as unknown as jest.Mock<(...args: unknown[]) => Promise<unknown>>
      ).mockResolvedValue(1);

      const req = createMockRequest('http://localhost/api/users', {
        headers: { Authorization: 'Bearer token' },
      });

      const response = await ListUsers(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.users).toHaveLength(1);
      expect(prisma.user.findMany).toHaveBeenCalled();
    });
  });

  describe('POST /', () => {
    const newUser = {
      email: 'new@example.com',
      password: 'Password123!',
      first_name: 'New',
      last_name: 'User',
      phone_number: '0600000000',
      institution_ids: ['inst-1'],
    };

    it('should create a user', async () => {
      (
        prisma.user.findUnique as unknown as jest.Mock<(...args: unknown[]) => Promise<unknown>>
      ).mockImplementation((args: any) => {
        if (args.where.id === mockAdminUser.id) return Promise.resolve(mockAdminUser);
        return Promise.resolve(null); // New user doesn't exist
      });
      (
        prisma.user.create as unknown as jest.Mock<(...args: unknown[]) => Promise<unknown>>
      ).mockResolvedValue({ id: 'new-id', ...newUser });

      const req = createMockRequest('http://localhost/api/users', {
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
        body: newUser,
      });

      const response = await CreateUser(req);
      expect(response.status).toBe(200);
      expect(prisma.user.create).toHaveBeenCalled();
    });
  });

  describe('GET /[id]', () => {
    it('should return user details', async () => {
      const req = createMockRequest(`http://localhost/api/users/${mockUser.id}`, {
        headers: { Authorization: 'Bearer token' },
      });

      const response = await GetUser(req, { params: Promise.resolve({ id: mockUser.id }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.id).toBe(mockUser.id);
    });
  });

  describe('PATCH /[id]', () => {
    it('should update user details', async () => {
      const updateData = { first_name: 'Updated' };
      (
        prisma.user.update as unknown as jest.Mock<(...args: unknown[]) => Promise<unknown>>
      ).mockResolvedValue({ ...mockUser, ...updateData });

      const req = createMockRequest(`http://localhost/api/users/${mockUser.id}`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer token' },
        body: updateData,
      });

      const response = await UpdateUser(req, { params: Promise.resolve({ id: mockUser.id }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.first_name).toBe('Updated');
    });
  });

  describe('DELETE /[id]', () => {
    it('should delete user', async () => {
      const req = createMockRequest(`http://localhost/api/users/${mockUser.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer token' },
      });

      const response = await DeleteUser(req, { params: Promise.resolve({ id: mockUser.id }) });

      if (response.status !== 200) {
        const body = await response.json();
        throw new Error(
          `DeleteUser failed with status ${response.status}. Body: ${JSON.stringify(body)}`,
        );
      }

      expect(response.status).toBe(200);
      expect(prisma.user.delete).toHaveBeenCalled();
    });
  });
});
