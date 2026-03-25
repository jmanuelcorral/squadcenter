import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Notification } from '@shared/types';
import { fetchNotifications, markNotificationRead, clearNotifications as clearNotificationsApi } from '../lib/api';
import { useWebSocket } from './useWebSocket';

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
  const { messages } = useWebSocket();

  useEffect(() => {
    fetchNotifications()
      .then((data) => setNotifications(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Listen for real-time notifications via WebSocket
  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (latest?.type === 'notification') {
      const n = latest.payload as Notification;
      setNotifications((prev) => [n, ...prev]);
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
