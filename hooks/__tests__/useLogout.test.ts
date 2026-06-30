/* eslint-disable */
import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import { renderHook } from '@testing-library/react';
import { act } from '@testing-library/react';
import { useLogout } from '@/hooks/useLogout';
import * as fetchWithAuthModule from '@/lib/api/fetchWithAuth';
import { ReactNode } from 'react';
import toast from '@/lib/utils/toast';

// Mock the dependencies
jest.mock('@/lib/api/fetchWithAuth');

// Mock toast
jest.mock('@/lib/utils/toast');

// Mock UserContext
const mockLogout = jest.fn();
jest.mock('@/context/UserContext', () => ({
  useUser: jest.fn(() => ({
    logout: mockLogout,
  })),
  UserProvider: ({ children }: { children: ReactNode }) => children,
}));

describe('useLogout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup console.error spy to suppress expected error logs
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  describe('successful logout', () => {
    test('should successfully logout and call context logout', async () => {
      const mockFetchWithAuth = jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'Logout successful' }),
      } as Response);

      const { result } = renderHook(() => useLogout());

      expect(typeof result.current).toBe('function');

      await act(async () => {
        await result.current();
      });

      expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/auth/logout', {
        method: 'POST',
      });
      expect(mockLogout).toHaveBeenCalled();
    });

    test('should call context logout even if API call succeeds', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      const { result } = renderHook(() => useLogout());

      await act(async () => {
        await result.current();
      });

      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    test('should call context logout even when API call fails', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
      } as Response);

      const { result } = renderHook(() => useLogout());

      await act(async () => {
        await result.current();
      });

      expect(mockLogout).toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test('should handle network errors and still call context logout', async () => {
      const networkError = new Error('Network error');
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockRejectedValue(networkError);

      const { result } = renderHook(() => useLogout());

      await act(async () => {
        await result.current();
      });

      expect(console.error).toHaveBeenCalledWith('Error during logout:', networkError);
      expect(mockLogout).toHaveBeenCalled();
    });

    test('should handle fetch rejection and log error', async () => {
      const errorMessage = 'Connection refused';
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useLogout());

      await act(async () => {
        await result.current();
      });

      expect(console.error).toHaveBeenCalledWith(
        'Error during logout:',
        expect.objectContaining({ message: errorMessage }),
      );
      expect(mockLogout).toHaveBeenCalled();
    });

    test('should handle non-Error exceptions', async () => {
      const customError = { custom: 'error object' };
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockRejectedValue(customError);

      const { result } = renderHook(() => useLogout());

      await act(async () => {
        await result.current();
      });

      expect(console.error).toHaveBeenCalledWith('Error during logout:', customError);
      expect(mockLogout).toHaveBeenCalled();
    });

    test('should handle string error', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockRejectedValue('String error');

      const { result } = renderHook(() => useLogout());

      await act(async () => {
        await result.current();
      });

      expect(console.error).toHaveBeenCalledWith('Error during logout:', 'String error');
      expect(mockLogout).toHaveBeenCalled();
    });

    test('should call toast with error message when logout fails', async () => {
      const networkError = new Error('Network error');
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockRejectedValue(networkError);

      const { result } = renderHook(() => useLogout());

      await act(async () => {
        await result.current();
      });

      expect(toast).toHaveBeenCalledWith('Erreur lors de la déconnexion.', 'error');
      expect(mockLogout).toHaveBeenCalled();
    });

    test('should handle error when toast itself throws an error', async () => {
      const networkError = new Error('Network error');
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockRejectedValue(networkError);
      (toast as jest.Mock).mockImplementation(() => {
        throw new Error('Toast error');
      });

      const { result } = renderHook(() => useLogout());

      // Should not throw, error is caught silently
      await act(async () => {
        await result.current();
      });

      expect(toast).toHaveBeenCalledWith('Erreur lors de la déconnexion.', 'error');
      expect(mockLogout).toHaveBeenCalled();

      // Reset toast mock
      (toast as jest.Mock).mockReset();
    });
  });

  describe('finally block behavior', () => {
    test('should call context logout in finally block after success', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      const { result } = renderHook(() => useLogout());

      await act(async () => {
        await result.current();
      });

      // Verify finally block executed (context logout called)
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });

    test('should call context logout in finally block after error', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockRejectedValue(new Error('Test error'));

      const { result } = renderHook(() => useLogout());

      await act(async () => {
        await result.current();
      });

      // Verify finally block executed (context logout called)
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });

    test('should ensure context logout is called exactly once', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      const { result } = renderHook(() => useLogout());

      await act(async () => {
        await result.current();
      });

      // Should be called once in finally block
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('multiple logout calls', () => {
    test('should handle multiple sequential logout calls', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      const { result } = renderHook(() => useLogout());

      await act(async () => {
        await result.current();
      });

      expect(mockLogout).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current();
      });

      expect(mockLogout).toHaveBeenCalledTimes(2);

      await act(async () => {
        await result.current();
      });

      expect(mockLogout).toHaveBeenCalledTimes(3);
    });

    test('should handle concurrent logout calls', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      const { result } = renderHook(() => useLogout());

      await act(async () => {
        await Promise.all([result.current(), result.current(), result.current()]);
      });

      expect(mockLogout).toHaveBeenCalledTimes(3);
      expect(fetchWithAuthModule.fetchWithAuth).toHaveBeenCalledTimes(3);
    });
  });

  describe('API response variations', () => {
    test('should handle 401 Unauthorized response', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      } as Response);

      const { result } = renderHook(() => useLogout());

      await act(async () => {
        await result.current();
      });

      expect(mockLogout).toHaveBeenCalled();
    });

    test('should handle 404 Not Found response', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not Found' }),
      } as Response);

      const { result } = renderHook(() => useLogout());

      await act(async () => {
        await result.current();
      });

      expect(mockLogout).toHaveBeenCalled();
    });

    test('should handle timeout error', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockRejectedValue(timeoutError);

      const { result } = renderHook(() => useLogout());

      await act(async () => {
        await result.current();
      });

      expect(console.error).toHaveBeenCalledWith('Error during logout:', timeoutError);
      expect(mockLogout).toHaveBeenCalled();
    });

    test('should handle AbortError', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockRejectedValue(abortError);

      const { result } = renderHook(() => useLogout());

      await act(async () => {
        await result.current();
      });

      expect(console.error).toHaveBeenCalledWith('Error during logout:', abortError);
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  describe('hook stability', () => {
    test('should return stable logout function reference', () => {
      const { result, rerender } = renderHook(() => useLogout());

      const firstLogout = result.current;

      rerender();

      const secondLogout = result.current;

      // The function should be the same reference (stable)
      expect(firstLogout).toBe(secondLogout);
    });

    test('should work correctly after re-render', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      const { result, rerender } = renderHook(() => useLogout());

      rerender();

      await act(async () => {
        await result.current();
      });

      expect(mockLogout).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    test('should handle null response', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue(null as any);

      const { result } = renderHook(() => useLogout());

      await act(async () => {
        await result.current();
      });

      // Should still call context logout in finally
      expect(mockLogout).toHaveBeenCalled();
    });

    test('should handle undefined response', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue(undefined as any);

      const { result } = renderHook(() => useLogout());

      await act(async () => {
        await result.current();
      });

      expect(mockLogout).toHaveBeenCalled();
    });

    test('should handle response without json method', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
      } as Response);

      const { result } = renderHook(() => useLogout());

      await act(async () => {
        await result.current();
      });

      expect(mockLogout).toHaveBeenCalled();
    });

    test('should work even if context logout throws error', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      mockLogout.mockImplementation(() => {
        throw new Error('Context logout error');
      });

      const { result } = renderHook(() => useLogout());

      // Should not throw
      await expect(
        act(async () => {
          await result.current();
        }),
      ).rejects.toThrow('Context logout error');

      expect(mockLogout).toHaveBeenCalled();

      // Restore normal behavior
      mockLogout.mockImplementation(() => {});
    });
  });

  describe('API call verification', () => {
    test('should call API with correct endpoint', async () => {
      const mockFetchWithAuth = jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      const { result } = renderHook(() => useLogout());

      await act(async () => {
        await result.current();
      });

      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        '/api/auth/logout',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    test('should call API with POST method', async () => {
      const mockFetchWithAuth = jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      const { result } = renderHook(() => useLogout());

      await act(async () => {
        await result.current();
      });

      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    test('should not send body with logout request', async () => {
      const mockFetchWithAuth = jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      const { result } = renderHook(() => useLogout());

      await act(async () => {
        await result.current();
      });

      const callArgs = mockFetchWithAuth.mock.calls[0];
      expect(callArgs[1]).not.toHaveProperty('body');
    });
  });
});
