/* eslint-disable */
import { describe, expect, test, jest } from '@jest/globals';

jest.mock('@prisma/extension-accelerate', () => ({
  withAccelerate: jest.fn().mockReturnValue({}),
}));

jest.mock('@/app/generated/prisma', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $extends: jest.fn().mockReturnThis(),
  })),
}));

describe('Prisma Config', () => {
  test('exports prisma client', () => {
    const prisma = require('@/lib/middleware/prismaConfig').default;
    expect(prisma).toBeDefined();
  });

  test('prisma client is singleton in development', () => {
    const prisma1 = require('@/lib/middleware/prismaConfig').default;
    const prisma2 = require('@/lib/middleware/prismaConfig').default;
    expect(prisma1).toBe(prisma2);
  });

  test('handles production environment', () => {
    const originalEnv = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production',
      writable: true,
      configurable: true,
    });
    delete require.cache[require.resolve('@/lib/middleware/prismaConfig')];
    const prisma = require('@/lib/middleware/prismaConfig').default;
    expect(prisma).toBeDefined();
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv,
      writable: true,
      configurable: true,
    });
  });

  test('handles non-production environment', () => {
    const originalEnv = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      writable: true,
      configurable: true,
    });
    delete require.cache[require.resolve('@/lib/middleware/prismaConfig')];
    const prisma = require('@/lib/middleware/prismaConfig').default;
    expect(prisma).toBeDefined();
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv,
      writable: true,
      configurable: true,
    });
  });
});
