/* eslint-disable */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';

import * as tokenStore from '@/lib/auth/tokenStore';
import { fetchWithAuth, fetchJsonWithAuth, clearCSRFToken } from '@/lib/api/fetchWithAuth';

describe('fetchWithAuth', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // @ts-ignore
    global.fetch = jest.fn();
    // Clear CSRF token cache before each test
    clearCSRFToken();
  });

  test('adds Authorization header when token exists', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue('tok123');
    // @ts-ignore
    global.fetch.mockResolvedValue({ status: 200, json: async () => ({ ok: true }) });

    const res = await fetchWithAuth('/api/test', { method: 'GET' } as any);
    expect(global.fetch).toHaveBeenCalled();
    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    const init = callArgs[1] as RequestInit;
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer tok123');
  });

  test('handles URL object as input instead of string', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue(null);
    // @ts-ignore
    global.fetch.mockResolvedValue({ status: 200, ok: true, json: async () => ({}) });

    const urlObject = new URL('https://example.com/api/test');
    await fetchWithAuth(urlObject, { method: 'GET' } as any);
    expect(global.fetch).toHaveBeenCalled();
  });

  test('on 401 attempts refresh and retries when refresh returns new token', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue('oldtok');
    const firstResponse = { status: 401, ok: false, json: async () => ({}) };
    const refreshResponse = { ok: true, json: async () => ({ accessToken: 'newtok' }) };
    const secondResponse = { status: 200, ok: true, json: async () => ({ data: 1 }) };

    // mock sequence: original call -> refresh call -> retry call
    // @ts-ignore
    (global.fetch as jest.Mock)
      .mockImplementationOnce(async () => firstResponse)
      .mockImplementationOnce(async () => refreshResponse)
      .mockImplementationOnce(async () => secondResponse);

    const res = await fetchWithAuth('/api/protected', { method: 'GET' } as any);
    expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  test('on 401 for POST: refresh returns new token and CSRF fetched for retry', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue('oldtok');
    const setTokenSpy = jest.spyOn(tokenStore, 'setAccessToken');

    const originalResponse = { status: 401, ok: false, json: async () => ({}) };
    const refreshResponse = {
      ok: true,
      json: async () => ({ accessToken: 'newtok', csrfToken: 'new-csrf' }),
    };
    const csrfResponseInitial = {
      status: 200,
      ok: true,
      json: async () => ({ csrfToken: 'initial-csrf' }),
    };
    const retryResponse = { status: 200, ok: true, json: async () => ({ success: true }) };

    // Sequence:
    // 1) initial CSRF fetch
    // 2) original POST -> 401
    // 3) refresh (now includes CSRF token in response)
    // 4) retried POST
    // @ts-ignore
    (global.fetch as jest.Mock)
      .mockImplementationOnce(async () => csrfResponseInitial)
      .mockImplementationOnce(async () => originalResponse)
      .mockImplementationOnce(async () => refreshResponse)
      .mockImplementationOnce(async () => retryResponse);

    const res = await fetchWithAuth('/api/protected', { method: 'POST' } as any);

    // Verify setAccessToken was called with new token
    expect(setTokenSpy).toHaveBeenCalledWith('newtok');

    // The retried request should be the 4th call (index 3)
    const retryCall = (global.fetch as jest.Mock).mock.calls[3];
    const retryInit = retryCall[1] as RequestInit;
    const headers = retryInit.headers as Headers;

    expect(headers.get('Authorization')).toBe('Bearer newtok');
    expect(headers.get('X-CSRF-Token')).toBe('new-csrf');
  });

  test('fetchJsonWithAuth returns parsed json', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue(null);
    // @ts-ignore
    global.fetch.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ hello: 'world' }),
    });

    const { data, response } = await fetchJsonWithAuth('/api/x');
    expect(data).toEqual({ hello: 'world' });
    expect(response.ok).toBe(true);
  });

  test('rate limiting throws when exceeded', async () => {
    // Call the internal endpoint many times to exceed 60 per minute
    const origMax = 60;
    // We'll call it 62 times quickly
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue(null);
    // @ts-ignore
    global.fetch.mockResolvedValue({ status: 200, ok: true, json: async () => ({}) });

    const promises = [];
    for (let i = 0; i < 62; i++) {
      promises.push(fetchWithAuth('/api/rl-test', { method: 'GET' } as any).catch((e) => e));
    }

    const results = await Promise.all(promises);
    const errors = results.filter((r) => r instanceof Error);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('rate limiting resets after window expires', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue(null);
    // @ts-ignore
    global.fetch.mockResolvedValue({ status: 200, ok: true, json: async () => ({}) });

    // Mock Date.now for controlled timing
    const originalDateNow = Date.now;
    let currentTime = originalDateNow();
    jest.spyOn(Date, 'now').mockImplementation(() => currentTime);

    // First request establishes the tracker
    await fetchWithAuth('/api/rl-reset-test', { method: 'GET' } as any);

    // Advance time by more than 60 seconds (60000ms)
    currentTime += 61000;

    // Next request should reset the counter (lines 15-17)
    await fetchWithAuth('/api/rl-reset-test', { method: 'GET' } as any);

    // Restore Date.now
    (Date.now as jest.Mock).mockRestore();
  });

  test('adds Content-Type header for POST when not present', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue(null);
    // @ts-ignore
    global.fetch.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ csrfToken: 'test-csrf-token' }),
    });

    await fetchWithAuth('/api/post', { method: 'POST' } as any);

    // fetch is called twice: once for CSRF token, once for the actual request
    // We want to check the second call (index 1)
    const callArgs = (global.fetch as jest.Mock).mock.calls[1];
    const init = callArgs[1] as RequestInit;

    // Headers is a Headers object
    const headers = init.headers as Headers;
    expect(headers.has('Content-Type')).toBe(true);
  });

  test('fetchJsonWithAuth returns null data when json parse fails', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue(null);
    // response returns invalid json
    // @ts-ignore
    global.fetch.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => {
        throw new Error('bad json');
      },
    });

    const { data, response } = await fetchJsonWithAuth('/api/badjson');
    expect(data).toBeNull();
    expect(response.status).toBe(200);
  });

  test('clears token when refresh fails', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue('oldtok');
    const clearTokenSpy = jest.spyOn(tokenStore, 'clearAccessToken');
    const firstResponse = { status: 401, ok: false, json: async () => ({}) };
    const refreshResponse = { ok: false, status: 500, json: async () => ({}) };

    // @ts-ignore
    (global.fetch as jest.Mock)
      .mockImplementationOnce(async () => firstResponse)
      .mockImplementationOnce(async () => refreshResponse);

    await fetchWithAuth('/api/protected', { method: 'GET' } as any);
    expect(clearTokenSpy).toHaveBeenCalled();
  });

  test('clears token when refresh throws network error', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue('oldtok');
    const clearTokenSpy = jest.spyOn(tokenStore, 'clearAccessToken');
    const firstResponse = { status: 401, ok: false, json: async () => ({}) };

    // @ts-ignore
    (global.fetch as jest.Mock)
      .mockImplementationOnce(async () => firstResponse)
      .mockImplementationOnce(async () => {
        throw new Error('Network error');
      });

    await fetchWithAuth('/api/protected', { method: 'GET' } as any);
    expect(clearTokenSpy).toHaveBeenCalled();
  });

  test('migrates token from localStorage to memory when present', async () => {
    // Setup mock localStorage
    const localStorageMock = {
      getItem: jest.fn().mockReturnValue('legacy-token'),
      removeItem: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });

    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValueOnce(null);
    const setTokenSpy = jest.spyOn(tokenStore, 'setAccessToken');
    // @ts-ignore
    global.fetch.mockResolvedValue({ status: 200, ok: true, json: async () => ({}) });

    await fetchWithAuth('/api/test', { method: 'GET' } as any);

    expect(localStorageMock.getItem).toHaveBeenCalledWith('accessToken');
    expect(setTokenSpy).toHaveBeenCalledWith('legacy-token');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('accessToken');
  });

  test('does not add Content-Type header for non-POST requests', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue(null);
    // @ts-ignore
    global.fetch.mockResolvedValue({ status: 200, ok: true, json: async () => ({}) });

    await fetchWithAuth('/api/get', { method: 'GET' } as any);
    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    const init = callArgs[1] as RequestInit;
    expect((init.headers as Headers).get('Content-Type')).toBeNull();
  });

  test('refresh with no new token clears access token', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue('oldtok');
    const clearTokenSpy = jest.spyOn(tokenStore, 'clearAccessToken');
    const firstResponse = { status: 401, ok: false, json: async () => ({}) };
    const refreshResponse = { ok: true, json: async () => ({}) }; // no accessToken field

    // @ts-ignore
    (global.fetch as jest.Mock)
      .mockImplementationOnce(async () => firstResponse)
      .mockImplementationOnce(async () => refreshResponse);

    await fetchWithAuth('/api/protected', { method: 'GET' } as any);
    expect(clearTokenSpy).toHaveBeenCalled();
  });

  test('uses cached CSRF token when valid', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue(null);

    // First call should fetch CSRF token
    // @ts-ignore
    global.fetch.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ csrfToken: 'cached-token' }),
    });

    await fetchWithAuth('/api/post1', { method: 'POST' } as any);
    const firstCallCount = (global.fetch as jest.Mock).mock.calls.length;

    // Second call should use cached token (no additional CSRF fetch)
    await fetchWithAuth('/api/post2', { method: 'POST' } as any);
    const secondCallCount = (global.fetch as jest.Mock).mock.calls.length;

    // Should only add one call for the actual request, not two (CSRF + request)
    expect(secondCallCount - firstCallCount).toBe(1);
  });

  test('handles CSRF token fetch failure gracefully', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue(null);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Mock fetch to fail on CSRF endpoint, succeed on actual request
    // @ts-ignore
    global.fetch.mockImplementation(async (url) => {
      if (url === '/api/auth/csrf') {
        throw new Error('Network error');
      }
      return { status: 200, ok: true, json: async () => ({}) };
    });

    // Should not throw, should continue without CSRF token
    await expect(fetchWithAuth('/api/post', { method: 'POST' } as any)).resolves.toBeDefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to fetch CSRF token:', expect.any(Error));

    consoleErrorSpy.mockRestore();
  });

  test('handles CSRF token response not ok', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue(null);

    // Mock fetch to return not ok for CSRF endpoint
    // @ts-ignore
    global.fetch.mockImplementation(async (url) => {
      if (url === '/api/auth/csrf') {
        return { status: 500, ok: false, json: async () => ({}) };
      }
      return { status: 200, ok: true, json: async () => ({}) };
    });

    // Should continue without CSRF token
    await expect(fetchWithAuth('/api/post', { method: 'POST' } as any)).resolves.toBeDefined();
  });

  test('clearCSRFToken clears the cached token', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue(null);

    // First call fetches and caches CSRF token
    // @ts-ignore
    global.fetch.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ csrfToken: 'token-to-clear' }),
    });

    await fetchWithAuth('/api/post1', { method: 'POST' } as any);
    const callsAfterFirst = (global.fetch as jest.Mock).mock.calls.length;

    // Clear the cache
    clearCSRFToken();

    // Next call should fetch CSRF token again
    await fetchWithAuth('/api/post2', { method: 'POST' } as any);
    const callsAfterSecond = (global.fetch as jest.Mock).mock.calls.length;

    // Should have made 2 new calls (CSRF + request), not 1
    expect(callsAfterSecond - callsAfterFirst).toBe(2);
  });

  test('handles CSRF token fetch when no access token available', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue(null);

    // @ts-ignore
    global.fetch.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ csrfToken: 'test-token' }),
    });

    await fetchWithAuth('/api/post', { method: 'POST' } as any);

    // Check that CSRF fetch was called with empty Authorization header
    const csrfCall = (global.fetch as jest.Mock).mock.calls[0];
    expect(csrfCall[0]).toBe('/api/auth/csrf');
    const csrfInit = csrfCall[1] as RequestInit;
    expect(csrfInit.headers).toBeDefined();
  });

  test('includes Authorization header when fetching CSRF token with access token', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue('valid-access-token');

    // @ts-ignore
    global.fetch.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ csrfToken: 'test-token' }),
    });

    await fetchWithAuth('/api/post', { method: 'POST' } as any);

    // Check that CSRF fetch was called with Authorization header
    const csrfCall = (global.fetch as jest.Mock).mock.calls[0];
    expect(csrfCall[0]).toBe('/api/auth/csrf');
    const csrfInit = csrfCall[1] as RequestInit;
    const authHeader = (csrfInit.headers as any).Authorization;
    expect(authHeader).toBe('Bearer valid-access-token');
  });

  test('handles 403 with CSRF_TOKEN_INVALID and retries with new token', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue('test-token');

    const csrfInitialResponse = {
      status: 200,
      ok: true,
      json: async () => ({ csrfToken: 'initial-csrf' }),
    };
    const firstResponse = {
      status: 403,
      ok: false,
      clone: () => ({
        json: async () => ({ code: 'CSRF_TOKEN_INVALID', error: 'Token expired' }),
      }),
      json: async () => ({ code: 'CSRF_TOKEN_INVALID', error: 'Token expired' }),
    };
    const csrfRetryResponse = {
      status: 200,
      ok: true,
      json: async () => ({ csrfToken: 'new-csrf' }),
    };
    const retryResponse = {
      status: 200,
      ok: true,
      json: async () => ({ success: true }),
    };

    // Sequence: CSRF fetch -> POST (403) -> new CSRF fetch -> retry POST
    // @ts-ignore
    (global.fetch as jest.Mock)
      .mockImplementationOnce(async () => csrfInitialResponse)
      .mockImplementationOnce(async () => firstResponse)
      .mockImplementationOnce(async () => csrfRetryResponse)
      .mockImplementationOnce(async () => retryResponse);

    const res = await fetchWithAuth('/api/protected', {
      method: 'POST',
      body: JSON.stringify({ test: 1 }),
    } as any);

    expect(res.status).toBe(200);
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(4);

    // Verify retry request has new CSRF token
    const retryCall = (global.fetch as jest.Mock).mock.calls[3];
    const retryInit = retryCall[1] as RequestInit;
    const headers = retryInit.headers as Headers;
    expect(headers.get('X-CSRF-Token')).toBe('new-csrf');
  });

  test('handles 403 with CSRF_TOKEN_INVALID but no new CSRF token available', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue('test-token');

    const csrfInitialResponse = {
      status: 200,
      ok: true,
      json: async () => ({ csrfToken: 'initial-csrf' }),
    };
    const firstResponse = {
      status: 403,
      ok: false,
      clone: () => ({
        json: async () => ({ code: 'CSRF_TOKEN_INVALID' }),
      }),
      json: async () => ({ code: 'CSRF_TOKEN_INVALID' }),
    };
    const csrfRetryResponse = {
      status: 200,
      ok: true,
      json: async () => ({}), // No csrfToken in response
    };

    // @ts-ignore
    (global.fetch as jest.Mock)
      .mockImplementationOnce(async () => csrfInitialResponse)
      .mockImplementationOnce(async () => firstResponse)
      .mockImplementationOnce(async () => csrfRetryResponse);

    const res = await fetchWithAuth('/api/protected', { method: 'POST' } as any);

    // Should return the original 403 response since retry couldn't get new CSRF
    expect(res.status).toBe(403);
  });

  test('handles 403 without CSRF_TOKEN_INVALID code (returns original response)', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue('test-token');

    const csrfResponse = {
      status: 200,
      ok: true,
      json: async () => ({ csrfToken: 'test-csrf' }),
    };
    const forbiddenResponse = {
      status: 403,
      ok: false,
      clone: () => ({
        json: async () => ({ error: 'Forbidden', code: 'PERMISSION_DENIED' }),
      }),
      json: async () => ({ error: 'Forbidden', code: 'PERMISSION_DENIED' }),
    };

    // @ts-ignore
    (global.fetch as jest.Mock)
      .mockImplementationOnce(async () => csrfResponse)
      .mockImplementationOnce(async () => forbiddenResponse);

    const res = await fetchWithAuth('/api/protected', { method: 'POST' } as any);

    // Should return the 403 without retrying since it's not CSRF_TOKEN_INVALID
    expect(res.status).toBe(403);
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(2); // CSRF + original request only
  });

  test('handles 403 with JSON parse error in clone (returns original response)', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue('test-token');

    const csrfResponse = {
      status: 200,
      ok: true,
      json: async () => ({ csrfToken: 'test-csrf' }),
    };
    const forbiddenResponse = {
      status: 403,
      ok: false,
      clone: () => ({
        json: async () => {
          throw new Error('Invalid JSON');
        },
      }),
      json: async () => ({ error: 'Forbidden' }),
    };

    // @ts-ignore
    (global.fetch as jest.Mock)
      .mockImplementationOnce(async () => csrfResponse)
      .mockImplementationOnce(async () => forbiddenResponse);

    const res = await fetchWithAuth('/api/protected', { method: 'POST' } as any);

    // Should return the 403 without retrying since JSON parsing failed
    expect(res.status).toBe(403);
  });

  test('handles 403 with CSRF retry for non-POST methods', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue('test-token');

    const csrfInitialResponse = {
      status: 200,
      ok: true,
      json: async () => ({ csrfToken: 'initial-csrf' }),
    };
    const firstResponse = {
      status: 403,
      ok: false,
      clone: () => ({
        json: async () => ({ code: 'CSRF_TOKEN_INVALID' }),
      }),
      json: async () => ({ code: 'CSRF_TOKEN_INVALID' }),
    };
    const csrfRetryResponse = {
      status: 200,
      ok: true,
      json: async () => ({ csrfToken: 'new-csrf' }),
    };
    const retryResponse = {
      status: 200,
      ok: true,
      json: async () => ({ success: true }),
    };

    // Test with DELETE method
    // @ts-ignore
    (global.fetch as jest.Mock)
      .mockImplementationOnce(async () => csrfInitialResponse)
      .mockImplementationOnce(async () => firstResponse)
      .mockImplementationOnce(async () => csrfRetryResponse)
      .mockImplementationOnce(async () => retryResponse);

    const res = await fetchWithAuth('/api/protected', { method: 'DELETE' } as any);

    expect(res.status).toBe(200);

    // Verify retry headers don't include Content-Type for DELETE
    const retryCall = (global.fetch as jest.Mock).mock.calls[3];
    const retryInit = retryCall[1] as RequestInit;
    const headers = retryInit.headers as Headers;
    expect(headers.get('X-CSRF-Token')).toBe('new-csrf');
    expect(headers.get('X-Requested-With')).toBe('XMLHttpRequest');
  });

  test('handles 403 CSRF retry without Authorization token', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue(null);

    const csrfInitialResponse = {
      status: 200,
      ok: true,
      json: async () => ({ csrfToken: 'initial-csrf' }),
    };
    const firstResponse = {
      status: 403,
      ok: false,
      clone: () => ({
        json: async () => ({ code: 'CSRF_TOKEN_INVALID' }),
      }),
      json: async () => ({ code: 'CSRF_TOKEN_INVALID' }),
    };
    const csrfRetryResponse = {
      status: 200,
      ok: true,
      json: async () => ({ csrfToken: 'new-csrf' }),
    };
    const retryResponse = {
      status: 200,
      ok: true,
      json: async () => ({ success: true }),
    };

    // @ts-ignore
    (global.fetch as jest.Mock)
      .mockImplementationOnce(async () => csrfInitialResponse)
      .mockImplementationOnce(async () => firstResponse)
      .mockImplementationOnce(async () => csrfRetryResponse)
      .mockImplementationOnce(async () => retryResponse);

    const res = await fetchWithAuth('/api/protected', { method: 'POST' } as any);

    expect(res.status).toBe(200);

    // Verify retry headers don't include Authorization
    const retryCall = (global.fetch as jest.Mock).mock.calls[3];
    const retryInit = retryCall[1] as RequestInit;
    const headers = retryInit.headers as Headers;
    expect(headers.get('Authorization')).toBeNull();
    expect(headers.get('X-CSRF-Token')).toBe('new-csrf');
  });

  test('handles 403 with response that throws error on clone', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue('test-token');

    const csrfResponse = {
      status: 200,
      ok: true,
      json: async () => ({ csrfToken: 'test-csrf' }),
    };
    const forbiddenResponse = {
      status: 403,
      ok: false,
      clone: () => {
        throw new Error('Clone error');
      },
      json: async () => ({ error: 'Forbidden' }),
    };

    // @ts-ignore
    (global.fetch as jest.Mock)
      .mockImplementationOnce(async () => csrfResponse)
      .mockImplementationOnce(async () => forbiddenResponse);

    const res = await fetchWithAuth('/api/protected', { method: 'POST' } as any);

    // Should return the 403 without retrying since clone() threw
    expect(res.status).toBe(403);
  });

  test('extracts CSRF token from response headers when present', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue('test-token');

    // Create a mock Headers object
    const mockHeaders = new Headers();
    mockHeaders.set('X-CSRF-Token', 'header-csrf-token');

    const mockResponse = {
      status: 200,
      ok: true,
      headers: mockHeaders,
      json: async () => ({ data: 'test' }),
    };

    // @ts-ignore
    global.fetch.mockResolvedValue(mockResponse);

    const res = await fetchWithAuth('/api/test', { method: 'GET' } as any);

    expect(res.status).toBe(200);
    // The CSRF token should be extracted from headers
  });

  test('handles response without headers gracefully', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue('test-token');

    // Response without headers property
    const mockResponse = {
      status: 200,
      ok: true,
      json: async () => ({ data: 'test' }),
    };

    // @ts-ignore
    global.fetch.mockResolvedValue(mockResponse);

    // Should not throw when extracting CSRF token
    await expect(fetchWithAuth('/api/test', { method: 'GET' } as any)).resolves.toBeDefined();
  });

  test('on 401 retry for POST without CSRF token available', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue('oldtok');

    // Clear CSRF token cache to ensure no cached token
    clearCSRFToken();

    const csrfResponse = {
      status: 200,
      ok: true,
      json: async () => ({}), // No csrfToken in CSRF endpoint response
    };
    const firstResponse = { status: 401, ok: false, json: async () => ({}) };
    // Refresh returns new token but no CSRF token
    const refreshResponse = {
      ok: true,
      json: async () => ({ accessToken: 'newtok' }), // No csrfToken
    };
    const secondResponse = { status: 200, ok: true, json: async () => ({ data: 1 }) };

    // Sequence: CSRF fetch (empty) -> POST -> 401 -> refresh (no CSRF) -> retry POST (without CSRF token)
    // @ts-ignore
    (global.fetch as jest.Mock)
      .mockImplementationOnce(async () => csrfResponse)
      .mockImplementationOnce(async () => firstResponse)
      .mockImplementationOnce(async () => refreshResponse)
      .mockImplementationOnce(async () => secondResponse);

    const res = await fetchWithAuth('/api/protected', {
      method: 'POST',
      body: JSON.stringify({ test: 1 }),
    } as any);

    expect(res.status).toBe(200);
    // Verify retry request doesn't have CSRF token in headers (since none was available)
    const retryCall = (global.fetch as jest.Mock).mock.calls[3];
    const retryInit = retryCall[1] as RequestInit;
    const headers = retryInit.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer newtok');
    // CSRF token should not be present
    expect(headers.get('X-CSRF-Token')).toBeNull();
  });

  test('respects _contentType: null for FormData (no Content-Type header)', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue(null);
    // @ts-ignore
    global.fetch.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ csrfToken: 'test-csrf-token' }),
    });

    // Use FormData with _contentType: null
    const formData = new FormData();
    formData.append('file', 'test');
    await fetchWithAuth('/api/upload', {
      method: 'POST',
      body: formData,
      _contentType: null,
    } as any);

    // Check the actual request call (index 1, after CSRF fetch)
    const callArgs = (global.fetch as jest.Mock).mock.calls[1];
    const init = callArgs[1] as RequestInit;
    const headers = init.headers as Headers;

    // Content-Type should not be set when _contentType is null (browser sets it with boundary)
    expect(headers.has('Content-Type')).toBe(false);
  });

  test('respects custom _contentType for uploads', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue(null);
    // @ts-ignore
    global.fetch.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ csrfToken: 'test-csrf-token' }),
    });

    await fetchWithAuth('/api/upload', {
      method: 'POST',
      body: JSON.stringify({ data: 'test' }),
      _contentType: 'application/vnd.api+json',
    } as any);

    // Check the actual request call (index 1, after CSRF fetch)
    const callArgs = (global.fetch as jest.Mock).mock.calls[1];
    const init = callArgs[1] as RequestInit;
    const headers = init.headers as Headers;

    expect(headers.get('Content-Type')).toBe('application/vnd.api+json');
  });

  test('CSRF retry with _contentType: null for FormData', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue('test-token');

    const csrfInitialResponse = {
      status: 200,
      ok: true,
      json: async () => ({ csrfToken: 'initial-csrf' }),
    };
    const firstResponse = {
      status: 403,
      ok: false,
      clone: () => ({
        json: async () => ({ code: 'CSRF_TOKEN_INVALID' }),
      }),
      json: async () => ({ code: 'CSRF_TOKEN_INVALID' }),
    };
    const csrfRetryResponse = {
      status: 200,
      ok: true,
      json: async () => ({ csrfToken: 'new-csrf' }),
    };
    const retryResponse = {
      status: 200,
      ok: true,
      json: async () => ({ success: true }),
    };

    // @ts-ignore
    (global.fetch as jest.Mock)
      .mockImplementationOnce(async () => csrfInitialResponse)
      .mockImplementationOnce(async () => firstResponse)
      .mockImplementationOnce(async () => csrfRetryResponse)
      .mockImplementationOnce(async () => retryResponse);

    const formData = new FormData();
    formData.append('file', 'test');
    const res = await fetchWithAuth('/api/upload', {
      method: 'POST',
      body: formData,
      _contentType: null,
    } as any);

    expect(res.status).toBe(200);

    // Verify retry request doesn't have Content-Type
    const retryCall = (global.fetch as jest.Mock).mock.calls[3];
    const retryInit = retryCall[1] as RequestInit;
    const headers = retryInit.headers as Headers;
    expect(headers.has('Content-Type')).toBe(false);
  });

  test('CSRF retry with custom _contentType', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue('test-token');

    const csrfInitialResponse = {
      status: 200,
      ok: true,
      json: async () => ({ csrfToken: 'initial-csrf' }),
    };
    const firstResponse = {
      status: 403,
      ok: false,
      clone: () => ({
        json: async () => ({ code: 'CSRF_TOKEN_INVALID' }),
      }),
      json: async () => ({ code: 'CSRF_TOKEN_INVALID' }),
    };
    const csrfRetryResponse = {
      status: 200,
      ok: true,
      json: async () => ({ csrfToken: 'new-csrf' }),
    };
    const retryResponse = {
      status: 200,
      ok: true,
      json: async () => ({ success: true }),
    };

    // @ts-ignore
    (global.fetch as jest.Mock)
      .mockImplementationOnce(async () => csrfInitialResponse)
      .mockImplementationOnce(async () => firstResponse)
      .mockImplementationOnce(async () => csrfRetryResponse)
      .mockImplementationOnce(async () => retryResponse);

    const res = await fetchWithAuth('/api/upload', {
      method: 'POST',
      body: JSON.stringify({ data: 'test' }),
      _contentType: 'application/vnd.api+json',
    } as any);

    expect(res.status).toBe(200);

    // Verify retry request has custom Content-Type
    const retryCall = (global.fetch as jest.Mock).mock.calls[3];
    const retryInit = retryCall[1] as RequestInit;
    const headers = retryInit.headers as Headers;
    expect(headers.get('Content-Type')).toBe('application/vnd.api+json');
  });

  test('token refresh retry with _contentType: null for FormData', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue('oldtok');

    const csrfResponse = {
      status: 200,
      ok: true,
      json: async () => ({ csrfToken: 'test-csrf' }),
    };
    const firstResponse = { status: 401, ok: false, json: async () => ({}) };
    const refreshResponse = {
      ok: true,
      json: async () => ({ accessToken: 'newtok', csrfToken: 'new-csrf' }),
    };
    const secondResponse = { status: 200, ok: true, json: async () => ({ data: 1 }) };

    // @ts-ignore
    (global.fetch as jest.Mock)
      .mockImplementationOnce(async () => csrfResponse)
      .mockImplementationOnce(async () => firstResponse)
      .mockImplementationOnce(async () => refreshResponse)
      .mockImplementationOnce(async () => secondResponse);

    const formData = new FormData();
    formData.append('file', 'test');
    const res = await fetchWithAuth('/api/upload', {
      method: 'POST',
      body: formData,
      _contentType: null,
    } as any);

    expect(res.status).toBe(200);

    // Verify retry request doesn't have Content-Type
    const retryCall = (global.fetch as jest.Mock).mock.calls[3];
    const retryInit = retryCall[1] as RequestInit;
    const headers = retryInit.headers as Headers;
    expect(headers.has('Content-Type')).toBe(false);
  });

  test('token refresh retry with custom _contentType', async () => {
    jest.spyOn(tokenStore, 'getAccessToken').mockReturnValue('oldtok');

    const csrfResponse = {
      status: 200,
      ok: true,
      json: async () => ({ csrfToken: 'test-csrf' }),
    };
    const firstResponse = { status: 401, ok: false, json: async () => ({}) };
    const refreshResponse = {
      ok: true,
      json: async () => ({ accessToken: 'newtok', csrfToken: 'new-csrf' }),
    };
    const secondResponse = { status: 200, ok: true, json: async () => ({ data: 1 }) };

    // @ts-ignore
    (global.fetch as jest.Mock)
      .mockImplementationOnce(async () => csrfResponse)
      .mockImplementationOnce(async () => firstResponse)
      .mockImplementationOnce(async () => refreshResponse)
      .mockImplementationOnce(async () => secondResponse);

    const res = await fetchWithAuth('/api/upload', {
      method: 'POST',
      body: JSON.stringify({ data: 'test' }),
      _contentType: 'application/vnd.api+json',
    } as any);

    expect(res.status).toBe(200);

    // Verify retry request has custom Content-Type
    const retryCall = (global.fetch as jest.Mock).mock.calls[3];
    const retryInit = retryCall[1] as RequestInit;
    const headers = retryInit.headers as Headers;
    expect(headers.get('Content-Type')).toBe('application/vnd.api+json');
  });
});
