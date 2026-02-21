import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import InAppNotification, { NotificationConfig, NotificationType } from '../components/InAppNotification';

interface NotificationContextType {
  notify: (config: Omit<NotificationConfig, 'id'>) => void;
  success: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  celebration: (title: string, message?: string, emoji?: string) => void;
  badgeEarned: (badgeName: string, badgeEmoji: string) => void;
  friendNotify: (title: string, message?: string) => void;
  donationNotify: (amount: number) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}

let _idCounter = 0;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<NotificationConfig[]>([]);

  const notify = useCallback((config: Omit<NotificationConfig, 'id'>) => {
    const id = `notif-${++_idCounter}-${Date.now()}`;
    const full: NotificationConfig = { id, ...config };
    setQueue(prev => {
      if (prev.length >= 3) return [...prev.slice(1), full];
      return [...prev, full];
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setQueue(prev => prev.filter(n => n.id !== id));
  }, []);

  const dismissAll = useCallback(() => setQueue([]), []);

  const success = useCallback((title: string, message?: string) => {
    notify({ type: 'success', title, message });
  }, [notify]);

  const info = useCallback((title: string, message?: string) => {
    notify({ type: 'info', title, message });
  }, [notify]);

  const celebration = useCallback((title: string, message?: string, emoji?: string) => {
    notify({ type: 'celebration', title, message, emoji, duration: 4500 });
  }, [notify]);

  const badgeEarned = useCallback((badgeName: string, badgeEmoji: string) => {
    notify({
      type: 'badge',
      title: 'Badge Earned!',
      message: `${badgeEmoji} ${badgeName}`,
      emoji: badgeEmoji,
      duration: 4000,
    });
  }, [notify]);

  const friendNotify = useCallback((title: string, message?: string) => {
    notify({ type: 'friend', title, message, duration: 4000 });
  }, [notify]);

  const donationNotify = useCallback((amount: number) => {
    notify({
      type: 'donation',
      title: 'Thank you for donating!',
      message: `Your $${amount} helps protect endangered species`,
      emoji: '💚',
      duration: 5000,
    });
  }, [notify]);

  return (
    <NotificationContext.Provider
      value={{ notify, success, info, celebration, badgeEarned, friendNotify, donationNotify, dismiss, dismissAll }}
    >
      {children}
      <View style={styles.overlay} pointerEvents="box-none">
        {queue.map((n, i) => (
          <View key={n.id} style={{ marginTop: i * 8 }} pointerEvents="box-none">
            <InAppNotification notification={n} onFinish={dismiss} />
          </View>
        ))}
      </View>
    </NotificationContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
    pointerEvents: 'box-none',
  },
});
