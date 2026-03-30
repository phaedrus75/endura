import React, { useRef } from 'react';
import { Animated, PanResponder, Dimensions, View, ViewStyle, StyleProp } from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DISMISS_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 0.3;

interface SwipeDismissProps {
  onDismiss: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function DragHandle() {
  return (
    <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
      <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: '#C4C4C4' }} />
    </View>
  );
}

export default function SwipeDismiss({ onDismiss, children, style }: SwipeDismissProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = translateY.interpolate({
    inputRange: [0, SCREEN_HEIGHT * 0.35],
    outputRange: [1, 0.3],
    extrapolate: 'clamp',
  });

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onMoveShouldSetPanResponderCapture: (_, g) =>
        g.dy > 20 && Math.abs(g.dy) > Math.abs(g.dx) * 2.5,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) {
          translateY.setValue(g.dy);
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_THRESHOLD || g.vy > VELOCITY_THRESHOLD) {
          Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            onDismiss();
            translateY.setValue(0);
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 10,
          }).start();
        }
      },
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[{ flex: 1, transform: [{ translateY }], opacity }, style]}
    >
      {children}
    </Animated.View>
  );
}
