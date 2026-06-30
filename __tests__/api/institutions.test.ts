/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { GET, POST } from '@/app/api/institutions/route';
import { PublicCategory, Role } from '@/app/generated/prisma/enums';
import prisma from '@/lib/middleware/prismaConfig';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/middleware/prismaConfig', () => ({
  institution: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  address: {
    create: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn((callback: any) => callback(prisma)),
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

jest.mock('@/lib/search/institutionDuplicateDetection', () => ({
  checkInstitutionCreation: jest.fn(),
}));

jest.mock('@/lib/auth/csrfProtection', () => ({
  validateCSRFToken: jest.fn(),
}));

// Import mocked modules
import { checkInstitutionCreation } from '@/lib/search/institutionDuplicateDetection';
import { validateCSRFToken } from '@/lib/auth/csrfProtection';
import jwt from 'jsonwebtoken';

// Helper to create a mock request that satisfies the handler's needs
function createMockRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {},
): NextRequest {
  const { method = 'GET', headers = {}, body } = options;

  // Normalize headers to lowercase
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

describe('/api/institutions', () => {
  const mockUser = {
    id: 'user-123',
    email: 'admin@example.com',
    first_name: 'Admin',
    last_name: 'User',
    role: Role.ADMIN,
    userInstitutions: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default auth mock: Valid Admin Token
    (
      jwt.verify as unknown as unknown as jest.Mock<(...args: unknown[]) => unknown>
    ).mockReturnValue({ id: mockUser.id });
    (
      prisma.user.findUnique as unknown as unknown as jest.Mock<
        (...args: unknown[]) => Promise<unknown>
      >
    ).mockResolvedValue(mockUser);

    // Default CSRF mock: Valid
    (
      validateCSRFToken as unknown as unknown as jest.Mock<(...args: unknown[]) => Promise<unknown>>
    ).mockResolvedValue(true);
  });

  describe('GET', () => {
    it('should return a list of institutions for admin', async () => {
      const mockInstitutions = [
        { id: 'inst-1', name: 'Institution 1', address: { city: 'Paris' } },
        { id: 'inst-2', name: 'Institution 2', address: { city: 'Lyon' } },
      ];

      (
        prisma.institution.findMany as unknown as unknown as jest.Mock<
          (...args: unknown[]) => Promise<unknown>
        >
      ).mockResolvedValue(mockInstitutions);
      (
        prisma.institution.count as unknown as unknown as jest.Mock<
          (...args: unknown[]) => Promise<unknown>
        >
      ).mockResolvedValue(2);

      const req = createMockRequest('http://localhost/api/institutions?page=1&limit=10', {
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.institutions).toHaveLength(2);
      expect(data.pagination.total).toBe(2);
      expect(prisma.institution.findMany).toHaveBeenCalled();
    });

    it('should return 401 if no token provided', async () => {
      const req = createMockRequest('http://localhost/api/institutions');
      const response = await GET(req);

      expect(response.status).toBe(401);
    });

    it('should return 403 if user is not admin', async () => {
      (
        prisma.user.findUnique as unknown as unknown as jest.Mock<
          (...args: unknown[]) => Promise<unknown>
        >
      ).mockResolvedValue({
        ...mockUser,
        role: Role.USER,
      });

      const req = createMockRequest('http://localhost/api/institutions', {
        headers: { Authorization: 'Bearer valid-token' },
      });

      const response = await GET(req);

      expect(response.status).toBe(403);
    });
  });

  describe('POST', () => {
    const validInstitutionData = {
      name: 'New School',
      address: {
        street: "123 Rue de l'Ecole",
        zip_code: '75001',
        city: 'Paris',
      },
      type: [PublicCategory.LYCEE],
      email: 'contact@school.com',
    };

    beforeEach(() => {
      // Default success for duplicate check
      (
        checkInstitutionCreation as unknown as unknown as jest.Mock<
          (...args: unknown[]) => Promise<unknown>
        >
      ).mockResolvedValue({ allowed: true });
    });

    it('should create an institution with valid data', async () => {
      const req = createMockRequest('http://localhost/api/institutions', {
        method: 'POST',
        body: validInstitutionData,
      });

      // Mock transaction results
      (
        prisma.address.create as unknown as unknown as jest.Mock<
          (...args: unknown[]) => Promise<unknown>
        >
      ).mockResolvedValue({
        id: 'addr-1',
        ...validInstitutionData.address,
      });
      (
        prisma.institution.create as unknown as unknown as jest.Mock<
          (...args: unknown[]) => Promise<unknown>
        >
      ).mockResolvedValue({
        id: 'inst-new',
        ...validInstitutionData,
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.institution.name).toBe(validInstitutionData.name);
      expect(prisma.institution.create).toHaveBeenCalled();
    });

    it('should return 400 if required fields are missing', async () => {
      const req = createMockRequest('http://localhost/api/institutions', {
        method: 'POST',
        body: { name: 'Incomplete' },
      });

      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it('should return 409 if duplicate detected', async () => {
      (
        checkInstitutionCreation as unknown as unknown as jest.Mock<
          (...args: unknown[]) => Promise<unknown>
        >
      ).mockResolvedValue({
        allowed: false,
        reason: 'Duplicate found',
        similarInstitutions: [],
      });

      const req = createMockRequest('http://localhost/api/institutions', {
        method: 'POST',
        body: validInstitutionData,
      });

      const response = await POST(req);
      expect(response.status).toBe(409);
    });

    it('should return 400 for invalid email format', async () => {
      const req = createMockRequest('http://localhost/api/institutions', {
        method: 'POST',
        body: { ...validInstitutionData, email: 'invalid-email' },
      });

      const response = await POST(req);
      expect(response.status).toBe(400);
    });
  });
});
