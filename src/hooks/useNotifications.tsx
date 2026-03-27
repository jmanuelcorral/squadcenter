import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { Notification } from '@shared/types';
import { fetchNotifications, markNotificationRead, clearNotifications as clearNotificationsApi } from '../lib/api';
import { useIpcEvents } from './useIpcEvents';

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (n: Notification) => void;
  markRead: (id: string) => void;
  clearAll: () => void;
  loading: boolean;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { messages } = useIpcEvents();
  const processedCount = useRef(0);

  useEffect(() => {
    fetchNotifications()
      .then((data) => setNotifications(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Process ALL new notification messages, not just the last one
  useEffect(() => {
    // Handle array cap/shrink: reset if array is smaller than our counter
    if (messages.length < processedCount.current) {
      processedCount.current = 0;
    }
    if (messages.length <= processedCount.current) return;

    const newMessages = messages.slice(processedCount.current);
    processedCount.current = messages.length;

    const newNotifications = newMessages
      .filter(m => m.type === 'notification')
      .map(m => m.payload as Notification);

    if (newNotifications.length > 0) {
      setNotifications((prev) => {
        const existingIds = new Set(prev.map(n => n.id));
        const deduped = newNotifications.filter(n => !existingIds.has(n.id));
        return [...deduped, ...prev];
      });
    }
  }, [messages]);

  const addNotification = useCallback((n: Notification) => {
    setNotifications((prev) => [n, ...prev]);
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    markNotificationRead(id).catch(() => {});
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    clearNotificationsApi().catch(() => {});
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, addNotification, markRead, clearAll, loading }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
