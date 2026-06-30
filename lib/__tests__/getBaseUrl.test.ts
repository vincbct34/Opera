import getServerBaseUrl from '../utils/getBaseUrl';
import { describe, beforeEach, jest, afterAll, it, expect, afterEach, test } from '@jest/globals';

describe('getServerBaseUrl', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    // Use a mutable record to modify environment keys without using `any`
    const env = process.env as unknown as Record<string, string | undefined>;
    delete env.APP_URL;
    delete env.NEXT_PUBLIC_BASE_URL;
    delete env.NODE_ENV;
    process.env = env as unknown as NodeJS.ProcessEnv;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('returns localhost default when no env vars set', () => {
    expect(getServerBaseUrl()).toBe('http://localhost:3000');
  });

  it('returns NEXT_PUBLIC_BASE_URL when set and APP_URL unset', () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://public.example';
    // re-import not necessary here because function reads process.env at call time
    expect(getServerBaseUrl()).toBe('https://public.example');
  });

  it('prefers APP_URL when present', () => {
    process.env.APP_URL = 'https://app.example';
    process.env.NEXT_PUBLIC_BASE_URL = 'https://public.example';
    expect(getServerBaseUrl()).toBe('https://app.example');
  });

  it('throws in production if APP_URL is missing', () => {
    const env = process.env as unknown as Record<string, string | undefined>;
    env.NODE_ENV = 'production';
    delete env.APP_URL;
    process.env = env as unknown as NodeJS.ProcessEnv;
    expect(() => getServerBaseUrl()).toThrow('APP_URL must be defined in production environment');
  });
});

describe('getBaseUrl', () => {
  const origAppUrl = process.env.APP_URL;
  afterEach(() => {
    process.env.APP_URL = origAppUrl;
  });

  test('returns APP_URL when set', () => {
    process.env.APP_URL = 'https://example.com';
    expect(getServerBaseUrl()).toBe('https://example.com');
  });

  test('falls back to localhost when APP_URL not set', () => {
    delete process.env.APP_URL;
    expect(getServerBaseUrl()).toBe('http://localhost:3000');
  });
});
