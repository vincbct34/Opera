'use client';

import { useEffect, useRef } from 'react';
import { useNotificationContext } from '@/context/NotificationContext';
import Loader from '@/components/ui/Loader';
import { Check, CheckCircle } from '@deemlol/next-icons';

/**
 * Props for the NotificationDropdown component.
 */
interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  buttonRef?: React.RefObject<HTMLButtonElement>;
}

/**
 * Dropdown component for displaying user notifications.
 * Handles marking notifications as read and navigating to related content.
 */
export default function NotificationDropdown({
  isOpen,
  onClose,
  buttonRef,
}: NotificationDropdownProps) {
  const {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    getNotificationIcon,
    getNotificationColor,
    getNotificationTypeLabel,
  } = useNotificationContext();

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(target);
      const clickedOnButton = buttonRef?.current && buttonRef.current.contains(target);

      if (clickedOutsideDropdown && !clickedOnButton) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, buttonRef]);

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const now = new Date();
    const notificationDate = new Date(dateString);
    const diffInMs = now.getTime() - notificationDate.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) {
      return "À l'instant";
    } else if (diffInMinutes < 60) {
      return `Il y a ${diffInMinutes} min`;
    } else if (diffInHours < 24) {
      return `Il y a ${diffInHours}h`;
    } else if (diffInDays < 7) {
      return `Il y a ${diffInDays}j`;
    } else {
      return notificationDate.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
      });
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    await markAsRead(notificationId);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute top-12 right-0 bg-white border shadow-lg w-80 md:w-100 z-50 overflow-hidden p-6"
    >
      {/* Header */}
      <div className="mb-4 pb-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-poppins font-semibold text-lg text-black">Notifications</h3>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="text-sm font-ibm text-gray-600 cursor-pointer"
          >
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* Content */}
      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader />
          </div>
        ) : error ? (
          <div className="px-6 py-4 text-center">
            <p className="text-red-600 font-ibm text-sm">{error}</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <CheckCircle size={24} color="black" />
            </div>
            <p className="text-gray-500 font-ibm text-sm">Aucune notification</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 h-full">
            {notifications.map((notification) => {
              const IconComponent = getNotificationIcon(notification.type);
              const colorClass = getNotificationColor(notification.type);

              return (
                <div key={notification.id} className={`px-6 py-4 ${!notification.read ? '' : ''}`}>
                  <div className="flex items-start space-x-3">
                    {/* Icon */}
                    <div className={`${colorClass}`}>
                      <IconComponent size={20} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-poppins font-medium text-black text-sm mb-1">
                            {notification.title}
                          </p>
                          <p className="font-ibm text-gray-600 text-sm mb-2 leading-relaxed text-justify">
                            {notification.message}
                          </p>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs px-3 py-1 bg-black text-white font-poppins font-semibold">
                              {getNotificationTypeLabel(notification.type)}
                            </span>
                            <span className="text-xs text-gray-500 font-ibm">
                              {formatRelativeTime(notification.created_at)}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        {!notification.read && (
                          <div className="ml-2 shrink-0">
                            <button
                              onClick={() => handleMarkAsRead(notification.id)}
                              className="text-gray-400 p-1 rounded cursor-pointer"
                              title="Marquer comme lu"
                            >
                              <Check size={16} color="green" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
