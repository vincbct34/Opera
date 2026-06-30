/* eslint-disable */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { useAuth, type LoginCredentials, type RegisterCredentials } from '@/hooks/useAuth';
import * as fetchWithAuthModule from '@/lib/api/fetchWithAuth';
import * as tokenStoreModule from '@/lib/auth/tokenStore';
import * as errorMessagesModule from '@/lib/validation/errorMessages';
import { ReactNode } from 'react';

// Mock the dependencies
jest.mock('@/lib/api/fetchWithAuth');
jest.mock('@/lib/auth/tokenStore');
jest.mock('@/lib/validation/errorMessages');

// Mock UserContext
const mockRefreshUser = jest.fn();
jest.mock('@/context/UserContext', () => ({
  useUser: jest.fn(() => ({
    refreshUser: mockRefreshUser,
  })),
  UserProvider: ({ children }: { children: ReactNode }) => children,
}));

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // refreshUser returns Promise<void>
    (mockRefreshUser as jest.MockedFunction<() => Promise<void>>).mockResolvedValue(undefined);

    // normalizeApiError has a generic unknown-function signature; accept unknown args
    (errorMessagesModule.normalizeApiError as jest.Mock).mockImplementation(
      (data: unknown, ...args: unknown[]) => {
        const defaultMsg = args[0] as string | undefined;
        return (data as any)?.message ?? defaultMsg;
      },
    );
  });

  describe('initial state', () => {
    test('should return initial isLoading as false', () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.login).toBeDefined();
      expect(result.current.register).toBeDefined();
    });
  });

  describe('login', () => {
    const validCredentials: LoginCredentials = {
      email: 'test@example.com',
      password: 'password123',
    };

    test('should successfully login with valid credentials', async () => {
      const mockAccessToken = 'test-access-token-123';
      const mockFetchWithAuth = jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({ accessToken: mockAccessToken }),
      } as Response);

      const mockSetAccessToken = jest.spyOn(tokenStoreModule, 'setAccessToken');

      const { result } = renderHook(() => useAuth());

      // Check loading state before login
      expect(result.current.isLoading).toBe(false);

      // Call login
      let loginResult;
      await act(async () => {
        loginResult = await result.current.login(validCredentials);
      });

      // Wait for loading to be false after completion
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        '/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validCredentials),
        }),
      );
      expect(mockSetAccessToken).toHaveBeenCalledWith(mockAccessToken);
      expect(mockRefreshUser).toHaveBeenCalled();
      expect(loginResult).toEqual({ success: true });
    });

    test('should successfully login with csrfToken in response', async () => {
      const mockAccessToken = 'test-access-token-456';
      const mockCsrfToken = 'test-csrf-token-789';
      const mockFetchWithAuth = jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({ accessToken: mockAccessToken, csrfToken: mockCsrfToken }),
      } as Response);

      const mockSetAccessToken = jest.spyOn(tokenStoreModule, 'setAccessToken');
      const mockSetCSRFToken = jest.spyOn(fetchWithAuthModule, 'setCSRFToken');

      const { result } = renderHook(() => useAuth());

      let loginResult;
      await act(async () => {
        loginResult = await result.current.login(validCredentials);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockSetAccessToken).toHaveBeenCalledWith(mockAccessToken);
      expect(mockSetCSRFToken).toHaveBeenCalledWith(mockCsrfToken);
      expect(mockRefreshUser).toHaveBeenCalled();
      expect(loginResult).toEqual({ success: true });
    });

    test('should handle login failure with error message', async () => {
      const errorMessage = 'Invalid credentials';
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: false,
        json: async () => ({
          message: errorMessage,
          code: 'INVALID_CREDENTIALS',
          email: validCredentials.email,
        }),
      } as Response);

      const { result } = renderHook(() => useAuth());

      let loginResult;
      await act(async () => {
        loginResult = await result.current.login(validCredentials);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(loginResult).toEqual({
        success: false,
        error: errorMessage,
        code: 'INVALID_CREDENTIALS',
        email: validCredentials.email,
      });
      expect(tokenStoreModule.setAccessToken).not.toHaveBeenCalled();
      expect(mockRefreshUser).not.toHaveBeenCalled();
    });

    test('should handle login with missing accessToken', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({}), // No accessToken
      } as Response);

      (errorMessagesModule.normalizeApiError as jest.Mock).mockReturnValue('Connexion impossible.');

      const { result } = renderHook(() => useAuth());

      let loginResult;
      await act(async () => {
        loginResult = await result.current.login(validCredentials);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(loginResult).toEqual({
        success: false,
        error: 'Connexion impossible.',
        code: undefined,
        email: undefined,
      });
      expect(tokenStoreModule.setAccessToken).not.toHaveBeenCalled();
    });

    test('should handle network error during login', async () => {
      jest
        .spyOn(fetchWithAuthModule, 'fetchWithAuth')
        .mockRejectedValue(new Error('Network error'));

      (errorMessagesModule.normalizeApiError as jest.Mock).mockReturnValue(
        'Erreur réseau. Vérifiez votre connexion.',
      );

      const { result } = renderHook(() => useAuth());

      let loginResult;
      await act(async () => {
        loginResult = await result.current.login(validCredentials);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(loginResult).toEqual({
        success: false,
        error: 'Erreur réseau. Vérifiez votre connexion.',
      });
      expect(errorMessagesModule.normalizeApiError).toHaveBeenCalledWith(
        null,
        'Erreur réseau. Vérifiez votre connexion.',
      );
    });

    test('should handle malformed JSON response', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as unknown as Response);

      (errorMessagesModule.normalizeApiError as jest.Mock).mockReturnValue('Connexion impossible.');

      const { result } = renderHook(() => useAuth());

      let loginResult;
      await act(async () => {
        loginResult = await result.current.login(validCredentials);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(loginResult).toEqual({
        success: false,
        error: 'Connexion impossible.',
        code: undefined,
        email: undefined,
      });
    });

    test('should set loading state correctly throughout login process', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({ accessToken: 'test-token' }),
      } as Response);

      const { result } = renderHook(() => useAuth());

      // Initial state
      expect(result.current.isLoading).toBe(false);

      // Start login and wait for it to complete
      await act(async () => {
        await result.current.login(validCredentials);
      });

      // Should no longer be loading
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('register', () => {
    const validUserData: RegisterCredentials = {
      email: 'newuser@example.com',
      password: 'SecurePass123!',
      first_name: 'John',
      last_name: 'Doe',
      phone_number: '+1234567890',
      institution_ids: ['inst-123'],
      email_notifications_enabled: true,
      events_reminders_enabled: true,
    };

    test('should successfully register a new user', async () => {
      const mockUser = {
        id: 'user-123',
        email: validUserData.email,
        first_name: validUserData.first_name,
        last_name: validUserData.last_name,
      };

      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({ user: mockUser }),
      } as Response);

      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(false);

      let registerResult;
      await act(async () => {
        registerResult = await result.current.register(validUserData);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(fetchWithAuthModule.fetchWithAuth).toHaveBeenCalledWith(
        '/api/auth/register',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validUserData),
        }),
      );
      expect(registerResult).toEqual({ success: true });
      // Register doesn't set token automatically
      expect(tokenStoreModule.setAccessToken).not.toHaveBeenCalled();
    });

    test('should handle registration failure with error message', async () => {
      const errorMessage = 'Email already exists';
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: false,
        json: async () => ({
          message: errorMessage,
        }),
      } as Response);

      const { result } = renderHook(() => useAuth());

      let registerResult;
      await act(async () => {
        registerResult = await result.current.register(validUserData);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(registerResult).toEqual({
        success: false,
        error: errorMessage,
      });
    });

    test('should handle registration with missing user in response', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({}), // No user
      } as Response);

      (errorMessagesModule.normalizeApiError as jest.Mock).mockReturnValue(
        'Inscription impossible.',
      );

      const { result } = renderHook(() => useAuth());

      let registerResult;
      await act(async () => {
        registerResult = await result.current.register(validUserData);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(registerResult).toEqual({
        success: false,
        error: 'Inscription impossible.',
      });
    });

    test('should handle network error during registration', async () => {
      jest
        .spyOn(fetchWithAuthModule, 'fetchWithAuth')
        .mockRejectedValue(new Error('Network error'));

      (errorMessagesModule.normalizeApiError as jest.Mock).mockReturnValue(
        'Erreur réseau. Vérifiez votre connexion.',
      );

      const { result } = renderHook(() => useAuth());

      let registerResult;
      await act(async () => {
        registerResult = await result.current.register(validUserData);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(registerResult).toEqual({
        success: false,
        error: 'Erreur réseau. Vérifiez votre connexion.',
      });
      expect(errorMessagesModule.normalizeApiError).toHaveBeenCalledWith(
        null,
        'Erreur réseau. Vérifiez votre connexion.',
      );
    });

    test('should handle malformed JSON response during registration', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as unknown as Response);

      (errorMessagesModule.normalizeApiError as jest.Mock).mockReturnValue(
        'Inscription impossible.',
      );

      const { result } = renderHook(() => useAuth());

      let registerResult;
      await act(async () => {
        registerResult = await result.current.register(validUserData);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(registerResult).toEqual({
        success: false,
        error: 'Inscription impossible.',
      });
    });

    test('should set loading state correctly throughout registration process', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({ user: { id: '123' } }),
      } as Response);

      const { result } = renderHook(() => useAuth());

      // Initial state
      expect(result.current.isLoading).toBe(false);

      // Start registration and wait for it to complete
      await act(async () => {
        await result.current.register(validUserData);
      });

      // Should no longer be loading
      expect(result.current.isLoading).toBe(false);
    });

    test('should handle registration with minimal optional fields', async () => {
      const minimalUserData: RegisterCredentials = {
        email: 'minimal@example.com',
        password: 'Pass123!',
        first_name: 'Jane',
        last_name: 'Smith',
        phone_number: '+9876543210',
        institution_ids: ['inst-456'],
      };

      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({ user: { id: 'user-456' } }),
      } as Response);

      const { result } = renderHook(() => useAuth());

      let registerResult;
      await act(async () => {
        registerResult = await result.current.register(minimalUserData);
      });

      expect(registerResult).toEqual({ success: true });
      expect(fetchWithAuthModule.fetchWithAuth).toHaveBeenCalledWith(
        '/api/auth/register',
        expect.objectContaining({
          body: JSON.stringify(minimalUserData),
        }),
      );
    });
  });

  describe('loading state management', () => {
    test('should handle multiple sequential calls correctly', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({ accessToken: 'token' }),
      } as Response);

      const { result } = renderHook(() => useAuth());

      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'password',
      };

      // Start first login
      await act(async () => {
        await result.current.login(credentials);
      });

      expect(result.current.isLoading).toBe(false);

      // Start second login
      await act(async () => {
        await result.current.login(credentials);
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('finally coverage', () => {
    test('login finally should set isLoading false after pending rejection', async () => {
      // Create a deferred promise to control resolution
      type Deferred = {
        promise: Promise<any>;
        resolve: (v: unknown) => void;
        reject: (e: unknown) => void;
      };
      const makeDeferred = (): Deferred => {
        let resolve!: (v: unknown) => void;
        let reject!: (e: unknown) => void;
        const promise = new Promise((res, rej) => {
          resolve = res;
          reject = rej;
        });
        return { promise, resolve, reject };
      };

      const deferred = makeDeferred();

      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockReturnValue(deferred.promise as any);

      const { result } = renderHook(() => useAuth());

      // Start login but don't resolve the fetch yet
      act(() => {
        // call but don't await to allow checking intermediate state
        void result.current.login({ email: 'a@b.com', password: 'pw' });
      });

      // isLoading should be true while the fetch is pending
      await waitFor(() => expect(result.current.isLoading).toBe(true));

      // Now resolve the fetch with a value to continue the flow
      deferred.resolve({ ok: false, json: async () => ({ message: 'boom' }) });

      // Wait for the hook to finish
      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });

    test('register finally should set isLoading false after json parse throws', async () => {
      // Use deferred promise to control timing
      type Deferred = {
        promise: Promise<any>;
        resolve: (v: unknown) => void;
        reject: (e: unknown) => void;
      };
      const makeDeferred = (): Deferred => {
        let resolve!: (v: unknown) => void;
        let reject!: (e: unknown) => void;
        const promise = new Promise((res, rej) => {
          resolve = res;
          reject = rej;
        });
        return { promise, resolve, reject };
      };

      const deferred = makeDeferred();

      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockReturnValue(deferred.promise as any);

      const { result } = renderHook(() => useAuth());

      // Start register but don't resolve the fetch yet
      let registerResult: any;
      act(() => {
        void result.current.register({
          email: 'x@y.com',
          password: 'p',
          first_name: 'F',
          last_name: 'L',
          phone_number: '0',
          institution_ids: ['i'],
        } as any);
      });

      // isLoading should be true while the fetch is pending
      await waitFor(() => expect(result.current.isLoading).toBe(true));

      // Now resolve the fetch with a response whose json throws
      deferred.resolve({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      // Wait for hook to finish and get result by invoking register again to capture return
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Since the hook's register call returned a promise earlier, we can't capture it now; instead
      // call register again to assert behavior of parse error path (it will run similarly)
      await act(async () => {
        registerResult = await result.current.register({
          email: 'x@y.com',
          password: 'p',
          first_name: 'F',
          last_name: 'L',
          phone_number: '0',
          institution_ids: ['i'],
        } as any);
      });

      expect(result.current.isLoading).toBe(false);
      expect(registerResult).toEqual({ success: false, error: 'Inscription impossible.' });
    });
  });

  describe('error normalization', () => {
    test('should call normalizeApiError with correct parameters on login error', async () => {
      const errorData = { message: 'Custom error', code: 'CUSTOM_ERROR' };
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: false,
        json: async () => errorData,
      } as Response);

      const { result } = renderHook(() => useAuth());

      await result.current.login({ email: 'test@example.com', password: 'pass' });

      expect(errorMessagesModule.normalizeApiError).toHaveBeenCalledWith(
        errorData,
        'Connexion impossible.',
      );
    });

    test('should call normalizeApiError with correct parameters on register error', async () => {
      const errorData = { message: 'Registration failed' };
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: false,
        json: async () => errorData,
      } as Response);

      const { result } = renderHook(() => useAuth());

      const userData: RegisterCredentials = {
        email: 'test@example.com',
        password: 'pass',
        first_name: 'Test',
        last_name: 'User',
        phone_number: '+1234567890',
        institution_ids: ['inst-1'],
      };

      await result.current.register(userData);

      expect(errorMessagesModule.normalizeApiError).toHaveBeenCalledWith(
        errorData,
        'Inscription impossible.',
      );
    });
  });
});
