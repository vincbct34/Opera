/* eslint-disable */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { useNotifications, NotificationType } from '@/hooks/useNotifications';
import * as fetchWithAuthModule from '@/lib/api/fetchWithAuth';
import * as errorMessagesModule from '@/lib/validation/errorMessages';
import { ReactNode } from 'react';
import { Bell, CheckCircle, XCircle, Calendar, Settings } from '@deemlol/next-icons';

// Mock the dependencies
jest.mock('@/lib/api/fetchWithAuth');
jest.mock('@/lib/validation/errorMessages');

// Mock UserContext
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
};

jest.mock('@/context/UserContext', () => ({
  useUser: jest.fn(() => ({
    user: mockUser,
    isAuthenticated: true,
  })),
  UserProvider: ({ children }: { children: ReactNode }) => children,
}));

const mockUseUser = require('@/context/UserContext').useUser;

describe('useNotifications', () => {
  const mockNotifications = [
    {
      id: 'notif-1',
      user_id: 'user-123',
      title: 'Test Notification 1',
      message: 'This is a test notification',
      type: 'REGISTRATION_CONFIRMED' as NotificationType,
      read: false,
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T10:00:00Z',
    },
    {
      id: 'notif-2',
      user_id: 'user-123',
      title: 'Test Notification 2',
      message: 'Another test notification',
      type: 'EVENT_REMINDER' as NotificationType,
      read: true,
      created_at: '2024-01-01T11:00:00Z',
      updated_at: '2024-01-01T11:00:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    (errorMessagesModule.normalizeApiError as jest.Mock).mockImplementation(
      (data: unknown, defaultMsg: unknown) => {
        if (data instanceof Error) return data.message;
        return (data as any)?.message ?? defaultMsg;
      },
    );

    mockUseUser.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    });
  });

  describe('initial state', () => {
    test('should return initial state with empty notifications', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({ notifications: [], unreadCount: 0, hasMore: false }),
      } as Response);

      const { result } = renderHook(() => useNotifications());

      // Wait for the useEffect fetch to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.notifications).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(typeof result.current.fetchNotifications).toBe('function');
      expect(typeof result.current.markAsRead).toBe('function');
      expect(typeof result.current.markAllAsRead).toBe('function');
    });

    test('should not fetch notifications if user is not authenticated', () => {
      mockUseUser.mockReturnValue({
        user: null,
        isAuthenticated: false,
      });

      const mockFetchWithAuth = jest.spyOn(fetchWithAuthModule, 'fetchWithAuth');

      renderHook(() => useNotifications());

      expect(mockFetchWithAuth).not.toHaveBeenCalled();
    });
  });

  describe('fetchNotifications', () => {
    test('should successfully fetch notifications', async () => {
      const mockFetchWithAuth = jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({
          notifications: mockNotifications,
          unreadCount: 1,
          hasMore: false,
        }),
      } as Response);

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.notifications).toEqual(mockNotifications);
      expect(result.current.unreadCount).toBe(1);
      expect(result.current.error).toBe(null);
      expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/notifications');
    });

    test('should fetch only unread notifications when unreadOnly is true', async () => {
      const unreadNotifications = [mockNotifications[0]];
      const mockFetchWithAuth = jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({
          notifications: unreadNotifications,
          unreadCount: 1,
          hasMore: false,
        }),
      } as Response);

      const { result } = renderHook(() => useNotifications());

      // Wait for initial fetch to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.fetchNotifications(true);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/notifications?unreadOnly=true');
      expect(result.current.notifications).toEqual(unreadNotifications);
    });

    test('should handle fetch error with error response', async () => {
      const errorData = { message: 'Failed to fetch notifications' };
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: false,
        json: async () => errorData,
      } as Response);

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to fetch notifications');
      expect(result.current.notifications).toEqual([]);
    });

    test('should handle network error during fetch', async () => {
      jest
        .spyOn(fetchWithAuthModule, 'fetchWithAuth')
        .mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Erreur réseau lors du chargement des notifications');
    });

    test('should handle malformed JSON in error response', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: false,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as unknown as Response);

      (errorMessagesModule.normalizeApiError as jest.Mock).mockReturnValue(
        'Erreur lors du chargement des notifications',
      );

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Erreur lors du chargement des notifications');
    });

    test('should set loading state correctly during fetch', async () => {
      let resolvePromise: (value: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockReturnValue(fetchPromise as any);

      const { result } = renderHook(() => useNotifications());

      // Should start loading
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });

      // Resolve the promise
      await act(async () => {
        resolvePromise!({
          ok: true,
          json: async () => ({ notifications: [], unreadCount: 0, hasMore: false }),
        });
        await fetchPromise;
      });

      // Should stop loading
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    test('should not fetch if user is not authenticated', async () => {
      mockUseUser.mockReturnValue({
        user: null,
        isAuthenticated: false,
      });

      const mockFetchWithAuth = jest.spyOn(fetchWithAuthModule, 'fetchWithAuth');

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.fetchNotifications();
      });

      expect(mockFetchWithAuth).not.toHaveBeenCalled();
    });

    test('should not fetch if user is null', async () => {
      mockUseUser.mockReturnValue({
        user: null,
        isAuthenticated: true,
      });

      const mockFetchWithAuth = jest.spyOn(fetchWithAuthModule, 'fetchWithAuth');

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.fetchNotifications();
      });

      expect(mockFetchWithAuth).not.toHaveBeenCalled();
    });

    test('should prevent concurrent fetch calls', async () => {
      const loggerDebugSpy = jest
        .spyOn(require('@/lib/middleware/logger').logger, 'debug')
        .mockImplementation(() => {});

      const { result } = renderHook(() => useNotifications());

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Start two concurrent fetch calls
      const promise1 = result.current.fetchNotifications();
      const promise2 = result.current.fetchNotifications();

      await Promise.all([promise1, promise2]);

      // Second call should be ignored
      expect(loggerDebugSpy).toHaveBeenCalledWith('⚠️ Fetch notifications déjà en cours, ignoré');

      loggerDebugSpy.mockRestore();
    });
  });

  describe('markAsRead', () => {
    test('should successfully mark notification as read', async () => {
      // Setup initial notifications
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({
          notifications: mockNotifications,
          unreadCount: 1,
          hasMore: false,
        }),
      } as Response);

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Mock the markAsRead API call
      const mockFetchWithAuth = jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await act(async () => {
        await result.current.markAsRead('notif-1');
      });

      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        '/api/notifications',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notificationIds: ['notif-1'] }),
        }),
      );

      // Check that notification was marked as read in local state
      const updatedNotif = result.current.notifications.find((n) => n.id === 'notif-1');
      expect(updatedNotif?.read).toBe(true);
      expect(result.current.unreadCount).toBe(0);
    });

    test('should handle error when marking as read', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({
          notifications: mockNotifications,
          unreadCount: 1,
          hasMore: false,
        }),
      } as Response);

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Mock error response
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Update failed' }),
      } as Response);

      await act(async () => {
        await result.current.markAsRead('notif-1');
      });

      expect(result.current.error).toBeTruthy();
    });

    test('should not mark as read if user is not authenticated', async () => {
      // Start with authenticated user
      mockUseUser.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
      });

      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({
          notifications: mockNotifications,
          unreadCount: 1,
          hasMore: false,
        }),
      } as Response);

      const { result, rerender } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Now mock unauthenticated state
      mockUseUser.mockReturnValue({
        user: null,
        isAuthenticated: false,
      });

      // Trigger re-render with new context
      rerender();

      const mockFetchWithAuth = jest.spyOn(fetchWithAuthModule, 'fetchWithAuth');
      const callCountBefore = mockFetchWithAuth.mock.calls.length;

      await act(async () => {
        await result.current.markAsRead('notif-1');
      });

      // Should not make additional API calls
      expect(mockFetchWithAuth).toHaveBeenCalledTimes(callCountBefore);
    });

    test('should handle network error when marking as read', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({
          notifications: mockNotifications,
          unreadCount: 1,
          hasMore: false,
        }),
      } as Response);

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      jest
        .spyOn(fetchWithAuthModule, 'fetchWithAuth')
        .mockRejectedValue(new Error('Network error'));

      await act(async () => {
        await result.current.markAsRead('notif-1');
      });

      expect(result.current.error).toBeTruthy();
    });

    test('should decrement unreadCount correctly', async () => {
      const notifications = [
        { ...mockNotifications[0], read: false },
        { ...mockNotifications[1], read: false },
      ];

      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({
          notifications,
          unreadCount: 2,
          hasMore: false,
        }),
      } as Response);

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.unreadCount).toBe(2);
      });

      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await act(async () => {
        await result.current.markAsRead('notif-1');
      });

      expect(result.current.unreadCount).toBe(1);
    });

    test('should not allow unreadCount to go below 0', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({
          notifications: mockNotifications,
          unreadCount: 0,
          hasMore: false,
        }),
      } as Response);

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.unreadCount).toBe(0);
      });

      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await act(async () => {
        await result.current.markAsRead('notif-1');
      });

      expect(result.current.unreadCount).toBe(0);
    });
  });

  describe('markAllAsRead', () => {
    test('should successfully mark all notifications as read', async () => {
      const notifications = [
        { ...mockNotifications[0], read: false },
        { ...mockNotifications[1], read: false },
      ];

      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({
          notifications,
          unreadCount: 2,
          hasMore: false,
        }),
      } as Response);

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.unreadCount).toBe(2);
      });

      const mockFetchWithAuth = jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await act(async () => {
        await result.current.markAllAsRead();
      });

      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        '/api/notifications',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ markAllAsRead: true }),
        }),
      );

      // All notifications should be read
      result.current.notifications.forEach((notification) => {
        expect(notification.read).toBe(true);
      });
      expect(result.current.unreadCount).toBe(0);
    });

    test('should handle error when marking all as read', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({
          notifications: mockNotifications,
          unreadCount: 1,
          hasMore: false,
        }),
      } as Response);

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Update failed' }),
      } as Response);

      await act(async () => {
        await result.current.markAllAsRead();
      });

      expect(result.current.error).toBeTruthy();
    });

    test('should not mark all as read if user is not authenticated', async () => {
      // Start with authenticated user
      mockUseUser.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
      });

      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({
          notifications: mockNotifications,
          unreadCount: 1,
          hasMore: false,
        }),
      } as Response);

      const { result, rerender } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Now mock unauthenticated state
      mockUseUser.mockReturnValue({
        user: null,
        isAuthenticated: false,
      });

      // Trigger re-render with new context
      rerender();

      const mockFetchWithAuth = jest.spyOn(fetchWithAuthModule, 'fetchWithAuth');
      const callCountBefore = mockFetchWithAuth.mock.calls.length;

      await act(async () => {
        await result.current.markAllAsRead();
      });

      expect(mockFetchWithAuth).toHaveBeenCalledTimes(callCountBefore);
    });

    test('should handle network error when marking all as read', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({
          notifications: mockNotifications,
          unreadCount: 1,
          hasMore: false,
        }),
      } as Response);

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      jest
        .spyOn(fetchWithAuthModule, 'fetchWithAuth')
        .mockRejectedValue(new Error('Network error'));

      await act(async () => {
        await result.current.markAllAsRead();
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('utility functions', () => {
    test('getNotificationIcon should return correct icons', () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({ notifications: [], unreadCount: 0, hasMore: false }),
      } as Response);

      const { result } = renderHook(() => useNotifications());

      expect(result.current.getNotificationIcon('REGISTRATION_CONFIRMED')).toBe(CheckCircle);
      expect(result.current.getNotificationIcon('REGISTRATION_CANCELLED')).toBe(XCircle);
      expect(result.current.getNotificationIcon('REGISTRATION_REJECTED')).toBe(XCircle);
      expect(result.current.getNotificationIcon('EVENT_REMINDER')).toBe(Calendar);
      expect(result.current.getNotificationIcon('SYSTEM_UPDATE')).toBe(Settings);
      expect(result.current.getNotificationIcon('UNKNOWN_TYPE' as NotificationType)).toBe(Bell);
    });

    test('getNotificationColor should return correct colors', () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({ notifications: [], unreadCount: 0, hasMore: false }),
      } as Response);

      const { result } = renderHook(() => useNotifications());

      expect(result.current.getNotificationColor('REGISTRATION_CONFIRMED')).toBe('text-green-600');
      expect(result.current.getNotificationColor('REGISTRATION_CANCELLED')).toBe('text-red-600');
      expect(result.current.getNotificationColor('REGISTRATION_REJECTED')).toBe('text-red-600');
      expect(result.current.getNotificationColor('EVENT_REMINDER')).toBe('text-yellow-600');
      expect(result.current.getNotificationColor('SYSTEM_UPDATE')).toBe('text-gray-600');
      expect(result.current.getNotificationColor('UNKNOWN_TYPE' as NotificationType)).toBe(
        'text-gray-600',
      );
    });

    test('getNotificationTypeLabel should return correct labels', () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({ notifications: [], unreadCount: 0, hasMore: false }),
      } as Response);

      const { result } = renderHook(() => useNotifications());

      expect(result.current.getNotificationTypeLabel('REGISTRATION_CONFIRMED')).toBe(
        "Demande d'inscription confirmée",
      );
      expect(result.current.getNotificationTypeLabel('REGISTRATION_CANCELLED')).toBe(
        "Demande d'inscription annulée",
      );
      expect(result.current.getNotificationTypeLabel('REGISTRATION_REJECTED')).toBe(
        "Demande d'inscription refusée",
      );
      expect(result.current.getNotificationTypeLabel('EVENT_REMINDER')).toBe("Rappel d'événement");
      expect(result.current.getNotificationTypeLabel('SYSTEM_UPDATE')).toBe('Mise à jour système');
      expect(result.current.getNotificationTypeLabel('UNKNOWN_TYPE' as NotificationType)).toBe(
        'Notification',
      );
    });

    test('utility functions should have stable references', () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({ notifications: [], unreadCount: 0, hasMore: false }),
      } as Response);

      const { result, rerender } = renderHook(() => useNotifications());

      const iconFunc1 = result.current.getNotificationIcon;
      const colorFunc1 = result.current.getNotificationColor;
      const labelFunc1 = result.current.getNotificationTypeLabel;

      rerender();

      expect(result.current.getNotificationIcon).toBe(iconFunc1);
      expect(result.current.getNotificationColor).toBe(colorFunc1);
      expect(result.current.getNotificationTypeLabel).toBe(labelFunc1);
    });
  });

  describe('useEffect behavior', () => {
    test('should fetch notifications on mount when authenticated', async () => {
      const mockFetchWithAuth = jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({
          notifications: mockNotifications,
          unreadCount: 1,
          hasMore: false,
        }),
      } as Response);

      renderHook(() => useNotifications());

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalled();
      });
    });

    test('should not fetch on mount if not authenticated', () => {
      mockUseUser.mockReturnValue({
        user: null,
        isAuthenticated: false,
      });

      const mockFetchWithAuth = jest.spyOn(fetchWithAuthModule, 'fetchWithAuth');

      renderHook(() => useNotifications());

      expect(mockFetchWithAuth).not.toHaveBeenCalled();
    });

    test('should refetch when user authentication changes', async () => {
      mockUseUser.mockReturnValue({
        user: null,
        isAuthenticated: false,
      });

      const mockFetchWithAuth = jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({
          notifications: [],
          unreadCount: 0,
          hasMore: false,
        }),
      } as Response);

      const { rerender } = renderHook(() => useNotifications());

      expect(mockFetchWithAuth).not.toHaveBeenCalled();

      // User logs in
      mockUseUser.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
      });

      rerender();

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalled();
      });
    });
  });

  describe('error handling edge cases', () => {
    test('should handle JSON parse error in markAsRead', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({
          notifications: mockNotifications,
          unreadCount: 1,
          hasMore: false,
        }),
      } as Response);

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: false,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as unknown as Response);

      (errorMessagesModule.normalizeApiError as jest.Mock).mockReturnValue(
        'Erreur lors de la mise à jour',
      );

      await act(async () => {
        await result.current.markAsRead('notif-1');
      });

      expect(result.current.error).toBeTruthy();
    });

    test('should handle JSON parse error in markAllAsRead', async () => {
      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: true,
        json: async () => ({
          notifications: mockNotifications,
          unreadCount: 1,
          hasMore: false,
        }),
      } as Response);

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      jest.spyOn(fetchWithAuthModule, 'fetchWithAuth').mockResolvedValue({
        ok: false,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as unknown as Response);

      (errorMessagesModule.normalizeApiError as jest.Mock).mockReturnValue(
        'Erreur lors de la mise à jour',
      );

      await act(async () => {
        await result.current.markAllAsRead();
      });

      expect(result.current.error).toBeTruthy();
    });
  });
});
