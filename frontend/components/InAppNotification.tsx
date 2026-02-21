import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type NotificationType = 'success' | 'info' | 'warning' | 'celebration' | 'friend' | 'badge' | 'donation';
export type NotificationPosition = 'top' | 'bottom';

export interface NotificationConfig {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  emoji?: string;
  duration?: number;
  position?: NotificationPosition;
  onPress?: () => void;
  onDismiss?: () => void;
}

const TYPE_STYLES: Record<NotificationType, { colors: [string, string]; defaultEmoji: string }> = {
  success:     { colors: ['#E7EFEA', '#D4E8DE'], defaultEmoji: '✅' },
  info:        { colors: ['#E8EFF5', '#D1E3F0'], defaultEmoji: '💡' },
  warning:     { colors: ['#FFF5E6', '#FFE8C2'], defaultEmoji: '⚠️' },
  celebration: { colors: ['#E7EFEA', '#C2DDD0'], defaultEmoji: '🎉' },
  friend:      { colors: ['#E8EFF5', '#D4E8DE'], defaultEmoji: '👋' },
  badge:       { colors: ['#E7EFEA', '#D4E8DE'], defaultEmoji: '🏅' },
  donation:    { colors: ['#E7EFEA', '#C2DDD0'], defaultEmoji: '💚' },
};

interface Props {
  notification: NotificationConfig;
  onFinish: (id: string) => void;
}

export default function InAppNotification({ notification, onFinish }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  const {
    id, type, title, message, emoji,
    duration = 3500,
    position = 'top',
    onPress, onDismiss,
  } = notification;

  const typeStyle = TYPE_STYLES[type] || TYPE_STYLES.info;
  const displayEmoji = emoji || typeStyle.defaultEmoji;

  useEffect(() => {
    const startVal = position === 'top' ? -120 : 120;
    translateY.setValue(startVal);

    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => dismiss(), duration);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    const endVal = position === 'top' ? -120 : 120;
    Animated.parallel([
      Animated.timing(translateY, { toValue: endVal, duration: 250, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      onDismiss?.();
      onFinish(id);
    });
  };

  const positionStyle = position === 'top'
    ? { top: insets.top + 8 }
    : { bottom: insets.bottom + 80 };

  return (
    <Animated.View
      style={[
        styles.container,
        positionStyle,
        { transform: [{ translateY }, { scale }], opacity },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => { onPress?.(); dismiss(); }}
        style={styles.touchable}
      >
        <LinearGradient
          colors={typeStyle.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <Text style={styles.emoji}>{displayEmoji}</Text>
          <View style={styles.textWrap}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {message ? <Text style={styles.message} numberOfLines={2}>{message}</Text> : null}
          </View>
          <TouchableOpacity onPress={dismiss} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.dismiss}>✕</Text>
          </TouchableOpacity>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 9999,
  },
  touchable: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  emoji: {
    fontSize: 28,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2F4A3E',
  },
  message: {
    fontSize: 13,
    color: '#5E7F6E',
    marginTop: 2,
    fontWeight: '500',
  },
  dismiss: {
    fontSize: 16,
    color: '#7C8F86',
    fontWeight: '600',
    padding: 4,
  },
});
