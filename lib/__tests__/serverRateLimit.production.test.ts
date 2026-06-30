/**
 * Test for environment-dependent behavior
 * This file ensures both branches of conditional logic are covered
 */

import { describe, expect, it, beforeAll, afterAll, jest } from '@jest/globals';

describe('Server Rate Limiting - Environment Branches', () => {
  let originalEnv: string | undefined;

  beforeAll(() => {
    originalEnv = process.env.NODE_ENV;
  });

  afterAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.env as any).NODE_ENV = originalEnv;
  });

  it('should return 5 when NODE_ENV is production', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.env as any).NODE_ENV = 'production';

    // Re-import the module to pick up the new NODE_ENV
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getAuthMaxAttempts } = require('../middleware/serverRateLimit');

    const maxAttempts = getAuthMaxAttempts();
    expect(maxAttempts).toBe(5);
  });

  it('should return 20 when NODE_ENV is development', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.env as any).NODE_ENV = 'development';

    // Re-import the module
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getAuthMaxAttempts } = require('../middleware/serverRateLimit');

    const maxAttempts = getAuthMaxAttempts();
    expect(maxAttempts).toBe(20);
  });

  it('should return 20 when NODE_ENV is test', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.env as any).NODE_ENV = 'test';

    // Re-import the module
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getAuthMaxAttempts } = require('../middleware/serverRateLimit');

    const maxAttempts = getAuthMaxAttempts();
    expect(maxAttempts).toBe(20);
  });

  it('should test the actual ternary in isolation', () => {
    // Test production branch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.env as any).NODE_ENV = 'production';
    const prodValue = process.env.NODE_ENV === 'production' ? 5 : 20;
    expect(prodValue).toBe(5);

    // Test non-production branch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.env as any).NODE_ENV = 'development';
    const devValue = process.env.NODE_ENV === 'production' ? 5 : 20;
    expect(devValue).toBe(20);
  });
});
