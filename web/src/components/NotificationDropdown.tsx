'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import type { AppNotification } from '@/lib/types';

interface NotificationDropdownProps {
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => Promise<AppNotification | void>;
  onMarkAllAsRead: () => Promise<void>;
  onDismiss: (id: string) => Promise<void>;
  onClose: () => void;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'just now';
  } else if (diffMin < 60) {
    return `${diffMin}m ago`;
  } else if (diffHour < 24) {
    return `${diffHour}h ago`;
  } else if (diffDay < 7) {
    return `${diffDay}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

function SeverityIcon({ severity }: { severity: 'info' | 'warning' | 'critical' }) {
  switch (severity) {
    case 'critical':
      return (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      );
    case 'warning':
      return (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
          <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      );
    case 'info':
    default:
      return (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
          <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      );
  }
}

export default function NotificationDropdown({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDismiss,
  onClose,
}: NotificationDropdownProps) {
  const handleMarkAllAsRead = useCallback(async () => {
    await onMarkAllAsRead();
  }, [onMarkAllAsRead]);

  const handleNotificationClick = useCallback(
    async (notification: AppNotification) => {
      if (!notification.read) {
        await onMarkAsRead(notification.id);
      }
    },
    [onMarkAsRead]
  );

  const handleDismiss = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      e.preventDefault();
      await onDismiss(id);
    },
    [onDismiss]
  );

  const getNotificationLink = (notification: AppNotification): string | null => {
    if (
      notification.type === 'device_offline' ||
      notification.type === 'device_online'
    ) {
      const deviceId = (notification.metadata as any)?.deviceId;
      if (deviceId) {
        return `/dashboard/devices/${deviceId}`;
      }
    }
    return null;
  };

  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div
      className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden"
      role="menu"
      aria-label="Notifications"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
        {hasUnread && (
          <button
            onClick={handleMarkAllAsRead}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Notification list */}
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <svg
              className="w-12 h-12 mx-auto text-gray-300 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <p className="text-sm text-gray-500">No notifications</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {notifications.map((notification) => {
              const link = getNotificationLink(notification);
              const content = (
                <div
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                    notification.read
                      ? 'bg-white hover:bg-gray-50'
                      : 'bg-blue-50 hover:bg-blue-100'
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                  role="menuitem"
                >
                  <SeverityIcon severity={notification.severity} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-sm font-medium truncate ${
                          notification.read ? 'text-gray-900' : 'text-gray-900'
                        }`}
                      >
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <span className="flex-shrink-0 w-2 h-2 mt-1.5 bg-blue-600 rounded-full" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2 mt-0.5">
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatTimeAgo(notification.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDismiss(e, notification.id)}
                    className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors"
                    title="Dismiss"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              );

              return (
                <li key={notification.id}>
                  {link ? (
                    <Link href={link} onClick={onClose}>
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
