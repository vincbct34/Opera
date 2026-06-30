'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import type { Notification, NotificationType } from '@/hooks/useNotifications';

// Type definition for the context
/**
 * Interface defining the shape of the NotificationContext.
 */
type NotificationContextType = {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  fetchNotifications: (unreadOnly?: boolean) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  getNotificationIcon: (
    type: NotificationType,
  ) => React.ComponentType<{ size?: number; className?: string }>;
  getNotificationColor: (type: NotificationType) => string;
  getNotificationTypeLabel: (type: NotificationType) => string;
};

// Create the context
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Custom hook to use the notification context
/**
 * Custom hook to access the NotificationContext.
 * @returns The notification context value.
 * @throws Error if used outside of a NotificationProvider.
 */
export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
};

// Provider component
/**
 * Provider component for the NotificationContext.
 * Wraps the application with notification state management.
 * @param children - The child components to render.
 */
export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  // Utiliser le hook une seule fois ici
  const notificationData = useNotifications();

  return (
    <NotificationContext.Provider value={notificationData}>{children}</NotificationContext.Provider>
  );
};
