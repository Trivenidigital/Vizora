'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../api';
import { useSocket } from './useSocket';
import { useAuth } from './useAuth';
import type { AppNotification } from '../types';

interface UseNotificationsOptions {
  pollInterval?: number;
  autoFetch?: boolean;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { pollInterval = 30000, autoFetch = true } = options;
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const unreadCountAbortRef = useRef<AbortController | null>(null);

  // Socket connection for real-time updates
  const { on, isConnected } = useSocket({
    autoConnect: !!user,
    auth: {
      organizationId: user?.organizationId,
    },
  });

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    try {
      setError(null);
      const response = await apiClient.getNotifications({ limit: 20 });
      // Filter out dismissed notifications
      const activeNotifications = response.data.filter(n => !n.dismissedAt);
      setNotifications(activeNotifications);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch notifications';
      setError(message);
      console.error('[Notifications] Fetch error:', message);
    }
  }, []);

  // Fetch unread count with request deduplication
  const fetchUnreadCount = useCallback(async () => {
    // Abort any in-flight unread-count request to prevent piling
    if (unreadCountAbortRef.current) {
      unreadCountAbortRef.current.abort();
    }

    const controller = new AbortController();
    unreadCountAbortRef.current = controller;

    // Use a 5s timeout instead of the default 30s
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(
        `${apiClient.getBaseUrl()}/notifications/unread-count`,
        {
          credentials: 'include',
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!response.ok) {
        return; // Silently fail — don't trigger "offline mode"
      }

      const data = await response.json();
      // Auto-unwrap response envelope
      const count = data?.data?.count ?? data?.count ?? 0;
      setUnreadCount(count);
    } catch {
      clearTimeout(timeoutId);
      // Silently ignore — AbortError or network failure
      // Don't log errors for aborted requests or timeouts
    } finally {
      if (unreadCountAbortRef.current === controller) {
        unreadCountAbortRef.current = null;
      }
    }
  }, []);

  // Refresh both notifications and count
  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchNotifications(), fetchUnreadCount()]);
    setLoading(false);
  }, [fetchNotifications, fetchUnreadCount]);

  // Mark single notification as read
  const markAsRead = useCallback(async (id: string) => {
    try {
      const updatedNotification = await apiClient.markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      return updatedNotification;
    } catch (err) {
      console.error('[Notifications] Failed to mark as read:', err);
      throw err;
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      await apiClient.markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('[Notifications] Failed to mark all as read:', err);
      throw err;
    }
  }, []);

  // Dismiss a notification
  const dismiss = useCallback(async (id: string) => {
    try {
      await apiClient.dismissNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      // Update unread count if the dismissed notification was unread
      const notification = notifications.find((n) => n.id === id);
      if (notification && !notification.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('[Notifications] Failed to dismiss:', err);
      throw err;
    }
  }, [notifications]);

  // Initial fetch
  useEffect(() => {
    if (autoFetch && user) {
      refresh();
    }
  }, [autoFetch, user, refresh]);

  // Polling for updates
  useEffect(() => {
    if (!autoFetch || !user) return;

    pollIntervalRef.current = setInterval(() => {
      fetchUnreadCount();
    }, pollInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      // Abort any in-flight request on cleanup
      if (unreadCountAbortRef.current) {
        unreadCountAbortRef.current.abort();
        unreadCountAbortRef.current = null;
      }
    };
  }, [autoFetch, user, pollInterval, fetchUnreadCount]);

  // Listen for real-time notification events
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = on('notification:new', (data: any) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Notifications] Received new notification:', data);
      }
      // Increment unread count
      setUnreadCount((prev) => prev + 1);
      // Fetch fresh notifications to get the full notification object
      fetchNotifications();
    });

    return unsubscribe;
  }, [isConnected, on, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    dismiss,
    refresh,
  };
}
