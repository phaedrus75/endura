/**
 * Expo push notification client for Endura.
 *
 * Responsibilities:
 *  1. Ask the OS for notification permission (iOS shows a system prompt; Android
 *     13+ also requires it).
 *  2. Fetch the Expo push token (`ExponentPushToken[xxx]`).
 *  3. Register that token with our FastAPI backend so we can target the user.
 *  4. Configure foreground display + tap handlers and route deep links.
 *
 * Design notes:
 *  - We never call Apple's APNs or FCM directly. Expo handles that for us — we
 *    just get a single Expo token and POST it to our backend.
 *  - The flow is opt-in but front-loaded: we ask after the user reaches the
 *    main app (post-onboarding) so the prompt feels like *real* permission for
 *    a value-aligned feature, not a cold "App wants to send notifications" hit
 *    on launch.
 *  - All work is best-effort. A failure here must NEVER block app render or
 *    auth flow — we log and move on. Sentry sees real errors.
 *  - `expo-device` simulator detection skips real registration on simulators
 *    (Expo can't issue a token without a real APNs/FCM-capable device).
 */
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { pushAPI } from './api';
import { Sentry } from './monitoring';

let _hasConfiguredHandler = false;
let _navigationRef: { current: any } | null = null;
let _subscriptions: Notifications.Subscription[] = [];

/** When the OS taps a notification, we want to navigate. Wire the navigation
 *  container ref from App.tsx so we can call `.navigate(deep_link)`. */
export function setNavigationRef(ref: { current: any }) {
  _navigationRef = ref;
}

/** Configure how notifications behave when the app is in the foreground.
 *  Idempotent — safe to call multiple times. */
function configureForegroundHandler() {
  if (_hasConfiguredHandler) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
  _hasConfiguredHandler = true;
}

/** Android needs an explicit notification channel for high-importance pushes. */
async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#5E7F6E',
      sound: 'default',
    });
  } catch (e) {
    if (__DEV__) console.log('Android channel setup failed:', e);
  }
}

/** Returns the Expo push token, requesting permission if needed.
 *  Returns null if permission denied, on simulator, or any error. */
async function fetchExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    if (__DEV__) console.log('Push notifications skipped: not a real device');
    return null;
  }
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      if (__DEV__) console.log('Push permission not granted:', finalStatus);
      return null;
    }
    // Use the Expo project ID from app.json — required for SDK 49+ tokens.
    const Constants = require('expo-constants').default;
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return tokenResponse.data || null;
  } catch (e: any) {
    if (__DEV__) console.warn('Failed to fetch Expo push token:', e?.message || e);
    Sentry.captureException(e, { tags: { source: 'push_token_fetch' } });
    return null;
  }
}

/**
 * Public entry point: request permission, get token, register with backend.
 * Idempotent — call on every app start once the user is authenticated.
 * Returns the token (or null if not registered).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  configureForegroundHandler();
  await ensureAndroidChannel();
  const token = await fetchExpoPushToken();
  if (!token) return null;

  try {
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    await pushAPI.registerToken(token, platform);
    if (__DEV__) console.log('Push token registered with backend:', token.slice(0, 24) + '…');
    return token;
  } catch (e: any) {
    if (__DEV__) console.warn('Backend push registration failed:', e?.message || e);
    Sentry.captureException(e, { tags: { source: 'push_token_register' } });
    return token; // we still got a token, just couldn't tell the server
  }
}

/** Optional: clear the token on the server (e.g. on logout or settings off). */
export async function unregisterPushNotifications(): Promise<void> {
  try {
    await pushAPI.removeToken();
  } catch (e: any) {
    if (__DEV__) console.log('Push unregister failed (non-fatal):', e?.message || e);
  }
}

/**
 * Set up listeners for incoming push notifications and notification taps.
 * Call once near app root (after navigation is ready).
 *
 * - `addNotificationReceivedListener` fires when the app is foregrounded.
 * - `addNotificationResponseReceivedListener` fires when the user taps a
 *   notification, regardless of app state. This is where deep linking happens.
 */
export function setupNotificationListeners(): () => void {
  configureForegroundHandler();

  // Drop any prior listeners before attaching new ones (hot reload safety).
  _subscriptions.forEach(s => s.remove());
  _subscriptions = [];

  const receivedSub = Notifications.addNotificationReceivedListener(notification => {
    if (__DEV__) console.log('Notification received in foreground:', notification.request.content.title);
    void reportLocalFired(notification, false);
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
    void reportLocalFired(response.notification, true);

    const data = response.notification.request.content.data || {};
    const deepLink = (data as any).deep_link as string | undefined;
    if (!deepLink) return;
    const nav = _navigationRef?.current;
    if (!nav) {
      if (__DEV__) console.log('Notification tap: navigation not ready, deep_link =', deepLink);
      return;
    }
    try {
      // Common screens are inside the MainStack — navigate by route name.
      // Supported deep_links: "Profile" | "Friends" | "Tips" | "Shop" | "TakeAction" | "Timer" | "Sanctuary" | "Progress"
      nav.navigate(deepLink);
    } catch (e) {
      if (__DEV__) console.log('Deep link navigation failed:', deepLink, e);
    }
  });

  _subscriptions = [receivedSub, responseSub];

  return () => {
    _subscriptions.forEach(s => s.remove());
    _subscriptions = [];
  };
}

/** If a notification carries a `template_key` in its data payload, POST to
 *  /push/local-fired so admin metrics see device-scheduled notifications.
 *  Server-sent pushes (which are already logged by the backend at send time)
 *  don't carry `template_key` in `data`, so they are skipped here. Called from
 *  both `received` (delivery) and `response` (tap) listeners — backend dedupes
 *  on `identifier` and just flips `opened` on the second call. */
async function reportLocalFired(
  notification: Notifications.Notification,
  opened: boolean,
): Promise<void> {
  try {
    const data = (notification.request.content.data || {}) as Record<string, unknown>;
    const templateKey = typeof data.template_key === 'string' ? data.template_key : null;
    if (!templateKey) return;
    await pushAPI.logLocalFired({
      template_key: templateKey,
      identifier: notification.request.identifier,
      title: notification.request.content.title || undefined,
      body: notification.request.content.body || undefined,
      category: typeof data.category === 'string' ? data.category : 'local',
      opened,
    });
  } catch (e: any) {
    if (__DEV__) console.log('logLocalFired failed (non-fatal):', e?.message || e);
  }
}

/** Reset the app icon badge count (e.g. when user opens the app). */
export async function clearBadgeCount(): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch {}
}

/**
 * Schedule a *local* notification to fire after `seconds` seconds.
 *
 * Used for the focus timer: we want the OS to ping the user the moment their
 * session ends, even if the app was force-closed or backgrounded. Local
 * notifications do not require network or the Expo push service — the OS
 * itself wakes us up at the scheduled time.
 *
 * Returns the scheduled identifier (or null if scheduling failed) so the
 * caller can cancel it later (e.g. user finishes the timer in-app and we
 * don't want a redundant ping).
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  seconds: number,
  data: Record<string, unknown> = {}
): Promise<string | null> {
  if (seconds <= 0) return null;
  try {
    configureForegroundHandler();
    await ensureAndroidChannel();
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        data,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(seconds)),
        repeats: false,
      } as Notifications.TimeIntervalTriggerInput,
    });
    return id || null;
  } catch (e: any) {
    if (__DEV__) console.warn('scheduleLocalNotification failed:', e?.message || e);
    return null;
  }
}

/** Cancel a previously scheduled local notification by id. Best-effort. */
export async function cancelLocalNotification(id: string | null | undefined): Promise<void> {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {}
}
