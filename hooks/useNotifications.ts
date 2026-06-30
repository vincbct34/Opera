import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { logger } from '@/lib/middleware/logger';
import { normalizeApiError } from '@/lib/validation/errorMessages';
import { useUser } from '@/context/UserContext';
import { Bell, CheckCircle, XCircle, Calendar, Settings } from '@deemlol/next-icons';
import toast from '@/lib/utils/toast';

/**
 * Represents a system notification.
 */
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Supported notification types.
 */
export type NotificationType =
  | 'REGISTRATION_CONFIRMED'
  | 'REGISTRATION_CANCELLED'
  | 'REGISTRATION_REJECTED'
  | 'EVENT_REMINDER'
  | 'SYSTEM_UPDATE';

export interface NotificationResponse {
  notifications: Notification[];
  unreadCount: number;
  hasMore: boolean;
}

/**
 * Custom hook for managing notifications.
 * Handles fetching, marking as read, and utility functions for display.
 * @returns Notification state and management functions.
 */
export const useNotifications = () => {
  const { user, isAuthenticated } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false); // Empêche les appels multiples au mount
  const isFetchingRef = useRef(false); // Empêche les appels simultanés

  /**
   * Fetch notifications from the API
   */
  const fetchNotifications = useCallback(
    async (unreadOnly: boolean = false) => {
      if (!isAuthenticated || !user) {
        return;
      }

      // Prevent simultaneous calls
      if (isFetchingRef.current) {
        logger.debug('⚠️ Fetch notifications déjà en cours, ignoré');
        return;
      }

      isFetchingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (unreadOnly) {
          params.append('unreadOnly', 'true');
        }

        const queryString = params.toString();
        const url = queryString ? `/api/notifications?${queryString}` : '/api/notifications';
        const response = await fetchWithAuth(url);

        if (response.ok) {
          const data: NotificationResponse = await response.json();
          setNotifications(data.notifications);
          setUnreadCount(data.unreadCount);
        } else {
          const errorData = await response.json().catch(() => ({}));
          setError(normalizeApiError(errorData, 'Erreur lors du chargement des notifications'));
        }
      } catch {
        const msg = 'Erreur réseau lors du chargement des notifications';
        setError(msg);
        toast(msg, 'error');
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    },
    [isAuthenticated, user],
  );

  /**
   * Mark a notification as read
   */
  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!isAuthenticated) return;

      try {
        const response = await fetchWithAuth('/api/notifications', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            notificationIds: [notificationId],
          }),
        });

        if (response.ok) {
          // Update local state
          setNotifications((prev) =>
            prev.map((notification) =>
              notification.id === notificationId ? { ...notification, read: true } : notification,
            ),
          );
          setUnreadCount((prev) => Math.max(0, prev - 1));
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(normalizeApiError(errorData, 'Erreur lors de la mise à jour'));
        }
      } catch (err) {
        const msg = normalizeApiError(err, 'Erreur lors de la mise à jour de la notification');
        setError(msg);
        toast(msg, 'error');
      }
    },
    [isAuthenticated],
  );

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const response = await fetchWithAuth('/api/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          markAllAsRead: true,
        }),
      });

      if (response.ok) {
        // Update local state
        setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
        setUnreadCount(0);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(normalizeApiError(errorData, 'Erreur lors de la mise à jour'));
      }
    } catch (err) {
      const msg = normalizeApiError(err, 'Erreur lors de la mise à jour des notifications');
      setError(msg);
      toast(msg, 'error');
    }
  }, [isAuthenticated]);

  /**
   * Get icon for notification type
   */
  const getNotificationIcon = useCallback(
    (type: NotificationType): React.ComponentType<{ size?: number; className?: string }> => {
      switch (type) {
        case 'REGISTRATION_CONFIRMED':
          return CheckCircle as React.ComponentType<{ size?: number; className?: string }>;
        case 'REGISTRATION_CANCELLED':
        case 'REGISTRATION_REJECTED':
          return XCircle as React.ComponentType<{ size?: number; className?: string }>;
        case 'EVENT_REMINDER':
          return Calendar as React.ComponentType<{ size?: number; className?: string }>;
        case 'SYSTEM_UPDATE':
          return Settings as React.ComponentType<{ size?: number; className?: string }>;
        default:
          return Bell as React.ComponentType<{ size?: number; className?: string }>;
      }
    },
    [],
  );

  /**
   * Get color for notification type
   */
  const getNotificationColor = useCallback((type: NotificationType) => {
    switch (type) {
      case 'REGISTRATION_CONFIRMED':
        return 'text-green-600';
      case 'REGISTRATION_CANCELLED':
      case 'REGISTRATION_REJECTED':
        return 'text-red-600';
      case 'EVENT_REMINDER':
        return 'text-yellow-600';
      case 'SYSTEM_UPDATE':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  }, []);

  /**
   * Get human-readable label for notification type
   */
  const getNotificationTypeLabel = useCallback((type: NotificationType) => {
    switch (type) {
      case 'REGISTRATION_CONFIRMED':
        return "Demande d'inscription confirmée";
      case 'REGISTRATION_CANCELLED':
        return "Demande d'inscription annulée";
      case 'REGISTRATION_REJECTED':
        return "Demande d'inscription refusée";
      case 'EVENT_REMINDER':
        return "Rappel d'événement";
      case 'SYSTEM_UPDATE':
        return 'Mise à jour système';
      default:
        return 'Notification';
    }
  }, []);

  // Fetch notifications on mount - OPTIMIZED to avoid multiple calls
  useEffect(() => {
    // Fetch only once AND only if authenticated
    if (isAuthenticated && user && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchNotifications();
    }

    // Reset flag if user logs out
    if (!isAuthenticated || !user) {
      hasFetchedRef.current = false;
    }
  }, [isAuthenticated, user, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    getNotificationIcon,
    getNotificationColor,
    getNotificationTypeLabel,
  };
};
