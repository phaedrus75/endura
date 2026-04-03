import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, ActivityIndicator, Platform, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { colors, shadows, spacing } from './theme/colors';
import { PostHogProvider } from 'posthog-react-native';
import { posthogClient, identifyUser, resetUser, Analytics } from './services/analytics';
import { registerForPushNotifications, addNotificationResponseListener } from './services/pushNotifications';

// Screens
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import TimerScreen from './screens/TimerScreen';
import CollectionScreen from './screens/CollectionScreen';
import ProgressScreen from './screens/ProgressScreen';
import TipsScreen from './screens/TipsScreen';
import SocialScreen from './screens/SocialScreen';
import ProfileScreen from './screens/ProfileScreen';
import ShopScreen from './screens/ShopScreen';
import TakeActionScreen from './screens/TakeActionScreen';
import ReactionOverlay from './components/ReactionOverlay';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TimerTabButton = () => {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.25, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={styles.timerTabWrapper}>
      <View style={styles.timerTabIconContainer}>
        <Animated.View style={[styles.timerTabGlow, { transform: [{ scale: pulse }] }]} />
        <LinearGradient
          colors={['#B5E0DB', '#7AAFC4']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.timerTabIcon}
        >
          <Text style={styles.timerTabEmoji}>⌛️</Text>
        </LinearGradient>
      </View>
      <Text style={styles.timerTabLabel}>Timer</Text>
    </View>
  );
};

// Tab Icons with proper styling
const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => {
  const icons: Record<string, string> = {
    Home: '🏠',
    Timer: '⌛️',
    Sanctuary: '🥚',
    Progress: '🏆',
    Friends: '👥',
  };

  if (name === 'Timer') {
    return <TimerTabButton />;
  }

  return (
    <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
      <Text style={[styles.tabEmoji, focused && styles.tabEmojiFocused]}>
        {icons[name]}
      </Text>
    </View>
  );
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        headerShown: false,
        sceneStyle: { backgroundColor: colors.surface },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Sanctuary" component={CollectionScreen} />
      <Tab.Screen name="Timer" component={TimerScreen} options={{
        tabBarLabel: () => null,
      }} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
      <Tab.Screen name="Friends" component={SocialScreen} />
    </Tab.Navigator>
  );
}

// Main stack includes tabs + Profile screen
const MainStack = createNativeStackNavigator();

function MainStackNavigator() {
  return (
    <>
    <MainStack.Navigator screenOptions={{ headerShown: false }}>
      <MainStack.Screen name="Tabs" component={MainTabs} />
      <MainStack.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
      <MainStack.Screen 
        name="Tips" 
        component={TipsScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
      <MainStack.Screen 
        name="Shop" 
        component={ShopScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
      <MainStack.Screen 
        name="TakeAction" 
        component={TakeActionScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
    </MainStack.Navigator>
    <ReactionOverlay />
    </>
  );
}

function AppNavigator({ navigationRef }: { navigationRef: any }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    if (user) {
      identifyUser(user.id, {
        username: user.username,
        total_study_minutes: user.total_study_minutes,
        current_streak: user.current_streak,
      });
      Analytics.appOpened();
      registerForPushNotifications(user.id).catch(() => {});
    } else {
      resetUser();
    }
  }, [user?.id]);

  useEffect(() => {
    const sub = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.screen === 'Timer') {
        const nav = navigationRef.current;
        if (!nav) return;
        nav.navigate('Main', { screen: 'Tabs', params: { screen: 'Timer' } });
      }
    });
    return () => sub.remove();
  }, []);
  
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <Text style={styles.loadingEmoji}>🥚</Text>
        </View>
        <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
        <Text style={styles.loadingText}>Loading Endura...</Text>
      </View>
    );
  }
  
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthScreen} />
      ) : !user?.username ? (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : (
        <Stack.Screen name="Main" component={MainStackNavigator} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const navigationRef = useNavigationContainerRef();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <NotificationProvider>
            <NavigationContainer ref={navigationRef}>
              <PostHogProvider client={posthogClient} autocapture={false}>
                <StatusBar style="dark" />
                <AppNavigator navigationRef={navigationRef} />
              </PostHogProvider>
            </NavigationContainer>
          </NotificationProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.medium,
  },
  loadingEmoji: {
    fontSize: 48,
  },
  spinner: {
    marginBottom: spacing.md,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  tabBar: {
    backgroundColor: colors.surface,
    borderTopWidth: 0,
    height: 88,
    paddingBottom: 24,
    paddingTop: 12,
    ...shadows.small,
  },
  tabItem: {
    paddingTop: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  tabIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  tabIconFocused: {
    backgroundColor: colors.primaryLight + '30',
  },
  tabEmoji: {
    fontSize: 24,
    opacity: 0.6,
  },
  tabEmojiFocused: {
    opacity: 1,
    transform: [{ scale: 1.1 }],
  },
  timerTabWrapper: {
    alignItems: 'center',
    marginTop: -16,
  },
  timerTabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    height: 72,
  },
  timerTabGlow: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#B5E0DB',
    opacity: 0.15,
  },
  timerTabIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.surface,
    ...Platform.select({
      ios: {
        shadowColor: '#7AAFC4',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
    }),
  },
  timerTabEmoji: {
    fontSize: 28,
  },
  timerTabLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7AAFC4',
    marginTop: 1,
  },
});
