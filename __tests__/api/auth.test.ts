import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { POST as LoginPOST } from '@/app/api/auth/login/route';
import { POST as RegisterPOST } from '@/app/api/auth/register/route';
import { Role } from '@/app/generated/prisma';
import prisma from '@/lib/middleware/prismaConfig';

// Mock next/server to handle NextResponse.json and cookies
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
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mock-access-token'),
  verify: jest.fn(),
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

jest.mock('@/lib/middleware/serverRateLimit', () => ({
  checkRateLimit: jest.fn(),
  getClientIdentifier: jest.fn(() => 'test-client-id'),
  resetRateLimit: jest.fn(),
  RATE_LIMIT_CONFIGS: { auth: {} },
}));

jest.mock('@/lib/notifications/emailService', () => ({
  sendEmail: jest.fn(),
  generateEmailVerificationToken: jest.fn(() => 'mock-verification-token'),
  generateVerificationUrl: jest.fn(() => 'http://localhost/verify'),
}));

jest.mock('@/lib/auth/refreshTokenManager', () => ({
  generateRefreshToken: jest.fn(() => ({ token: 'mock-refresh-token' })),
}));

jest.mock('@/lib/auth/csrfProtection', () => ({
  generateCSRFToken: jest.fn(() => 'mock-csrf-token'),
}));

jest.mock('@/lib/security/securityLogger', () => ({
  logLoginSuccess: jest.fn(),
  logLoginFailed: jest.fn(),
  logRateLimitExceeded: jest.fn(),
  logRegistration: jest.fn(),
}));

jest.mock('@/lib/auth/accountLockout', () => ({
  isAccountLocked: jest.fn(),
  recordFailedLogin: jest.fn(),
  resetFailedAttempts: jest.fn(),
}));

jest.mock('@/lib/auth/cookieConfig', () => ({
  getSecureCookieConfig: jest.fn(() => ({
    name: 'jwt',
    value: 'mock-refresh-token',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 604800,
  })),
}));

jest.mock('@/lib/middleware/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import mocked modules
import { checkRateLimit } from '@/lib/middleware/serverRateLimit';
import { isAccountLocked, recordFailedLogin } from '@/lib/auth/accountLockout';
import bcrypt from 'bcrypt';

// Helper to create a mock request
function createMockRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {},
): NextRequest {
  const { method = 'POST', headers = {}, body } = options;

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
    cookies: {
      set: jest.fn(),
    },
  } as unknown as NextRequest;
}

describe('/api/auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default rate limit success
    (
      checkRateLimit as unknown as jest.Mock<(...args: unknown[]) => Promise<unknown>>
    ).mockResolvedValue({ success: true });
    // Default account not locked
    (
      isAccountLocked as unknown as jest.Mock<(...args: unknown[]) => Promise<unknown>>
    ).mockResolvedValue({ locked: false });
  });

  describe('POST /login', () => {
    const validLoginData = {
      email: 'user@example.com',
      password: 'password123',
    };

    const mockUser = {
      id: 'user-123',
      email: 'user@example.com',
      password: 'hashed-password',
      role: Role.USER,
      userInstitutions: [],
      email_verification_token: null,
    };

    it('should login successfully with valid credentials', async () => {
      (
        prisma.user.findUnique as unknown as jest.Mock<(...args: unknown[]) => Promise<unknown>>
      ).mockResolvedValue(mockUser);
      (
        bcrypt.compare as unknown as jest.Mock<(...args: unknown[]) => Promise<unknown>>
      ).mockResolvedValue(true);

      const req = createMockRequest('http://localhost/api/auth/login', {
        body: validLoginData,
      });

      const response = await LoginPOST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.accessToken).toBe('mock-access-token');
      expect(data.user.email).toBe(validLoginData.email);
    });

    it('should return 401 for invalid credentials', async () => {
      (
        prisma.user.findUnique as unknown as jest.Mock<(...args: unknown[]) => Promise<unknown>>
      ).mockResolvedValue(mockUser);
      (
        bcrypt.compare as unknown as jest.Mock<(...args: unknown[]) => Promise<unknown>>
      ).mockResolvedValue(false);
      (
        recordFailedLogin as unknown as jest.Mock<(...args: unknown[]) => Promise<unknown>>
      ).mockResolvedValue({ locked: false, attemptsRemaining: 3 });

      const req = createMockRequest('http://localhost/api/auth/login', {
        body: { ...validLoginData, password: 'wrong-password' },
      });

      const response = await LoginPOST(req);
      expect(response.status).toBe(401);
    });

    it('should return 401 if user not found', async () => {
      (
        prisma.user.findUnique as unknown as jest.Mock<(...args: unknown[]) => Promise<unknown>>
      ).mockResolvedValue(null);

      const req = createMockRequest('http://localhost/api/auth/login', {
        body: validLoginData,
      });

      const response = await LoginPOST(req);
      expect(response.status).toBe(401);
    });

    it('should return 429 if rate limit exceeded', async () => {
      (
        checkRateLimit as unknown as jest.Mock<(...args: unknown[]) => Promise<unknown>>
      ).mockResolvedValue({
        success: false,
        resetAt: Date.now() + 60000,
      });

      const req = createMockRequest('http://localhost/api/auth/login', {
        body: validLoginData,
      });

      const response = await LoginPOST(req);
      expect(response.status).toBe(429);
    });
  });

  describe('POST /register', () => {
    const validRegisterData = {
      email: 'newuser@example.com',
      password: 'Password123!',
      first_name: 'John',
      last_name: 'Doe',
      phone_number: '0612345678',
      // Use a valid CUID format
      institution_ids: ['clq2p4x8m000008l66y306y30'],
      email_notifications_enabled: true,
      events_reminders_enabled: true,
    };

    it('should register a new user successfully', async () => {
      (
        prisma.user.findUnique as unknown as jest.Mock<(...args: unknown[]) => Promise<unknown>>
      ).mockResolvedValue(null); // No existing user
      (
        bcrypt.hash as unknown as jest.Mock<(...args: unknown[]) => Promise<unknown>>
      ).mockResolvedValue('hashed-password');
      (
        prisma.user.create as unknown as jest.Mock<(...args: unknown[]) => Promise<unknown>>
      ).mockResolvedValue({
        id: 'new-user-id',
        ...validRegisterData,
        role: Role.USER,
        created_at: new Date(),
        userInstitutions: [{ institution_id: 'clq2p4x8m000008l66y306y30' }],
      });

      const req = createMockRequest('http://localhost/api/auth/register', {
        body: validRegisterData,
      });

      const response = await RegisterPOST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.email).toBe(validRegisterData.email);
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should return 400 if email already exists', async () => {
      (
        prisma.user.findUnique as unknown as jest.Mock<(...args: unknown[]) => Promise<unknown>>
      ).mockResolvedValue({ id: 'existing' });

      const req = createMockRequest('http://localhost/api/auth/register', {
        body: validRegisterData,
      });

      const response = await RegisterPOST(req);
      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid data (zod validation)', async () => {
      const req = createMockRequest('http://localhost/api/auth/register', {
        body: { ...validRegisterData, email: 'invalid-email' },
      });

      const response = await RegisterPOST(req);
      expect(response.status).toBe(400);
    });
  });
});
