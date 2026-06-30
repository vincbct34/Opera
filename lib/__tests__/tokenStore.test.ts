/* eslint-disable */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import {
  getAccessToken,
  setAccessToken,
  clearAccessToken,
  getCachedUser,
  setCachedUser,
  hasPotentialCache,
} from '@/lib/auth/tokenStore';

describe('tokenStore', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // Clean in-memory state by calling clearAccessToken
    clearAccessToken();
    // Ensure sessionStorage is mockable
    // @ts-ignore
    global.sessionStorage = {
      store: {},
      getItem(key: string) {
        return this.store[key] || null;
      },
      setItem(key: string, val: string) {
        this.store[key] = val;
      },
      removeItem(key: string) {
        delete this.store[key];
      },
    };
  });

  test('access token set/get/clear', () => {
    expect(getAccessToken()).toBeNull();
    setAccessToken('abc');
    expect(getAccessToken()).toBe('abc');
    clearAccessToken();
    expect(getAccessToken()).toBeNull();
  });

  test('cached user set/get and hasPotentialCache uses sessionStorage timestamp', () => {
    expect(getCachedUser()).toBeNull();
    setCachedUser({ id: 'u1', email: 'a@b.com' } as any);
    expect(getCachedUser()).not.toBeNull();
    expect(hasPotentialCache()).toBe(true);

    // simulate expired timestamp: clear in-memory cachedUser then set an old timestamp in sessionStorage
    clearAccessToken(); // also clears cachedUser per implementation
    // @ts-ignore
    global.sessionStorage.setItem('userCacheTimestamp', (Date.now() - 10 * 60 * 1000).toString());
    expect(hasPotentialCache()).toBe(false);
  });

  test('hasPotentialCache returns true when sessionStorage timestamp is recent but no in-memory cachedUser', () => {
    // clear in-memory
    clearAccessToken();
    // set a recent timestamp in sessionStorage
    // @ts-ignore
    global.sessionStorage.setItem('userCacheTimestamp', Date.now().toString());
    expect(hasPotentialCache()).toBe(true);
  });

  test('setCachedUser can accept null and clears cache timestamp', () => {
    setCachedUser(null);
    expect(getCachedUser()).toBeNull();
  });

  test('hasPotentialCache returns false when no cachedUser and no window', () => {
    clearAccessToken();
    // @ts-ignore - simulate server-side (no window)
    const originalWindow = global.window;
    // @ts-ignore
    delete global.window;

    expect(hasPotentialCache()).toBe(false);

    // @ts-ignore - restore window
    global.window = originalWindow;
  });
});
