import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const SENTRY_DSN = (Constants.expoConfig?.extra?.sentryDsn as string | undefined) || process.env.EXPO_PUBLIC_SENTRY_DSN || '';
const BOOT_PING_KEY = 'sentryBootPingSent';

/**
 * Initialise Sentry for crash + JS error reporting.
 *
 * Call once at the top of App.tsx (before any UI renders).
 * No-op if the DSN isn't configured (safe for local dev / OSS contributors).
 *
 * Config source of truth:
 *   - `expo.extra.sentryDsn` in app.json (preferred: cached in JS bundle)
 *   - or `EXPO_PUBLIC_SENTRY_DSN` env var (fallback for EAS builds)
 */
export function initMonitoring() {
  if (!SENTRY_DSN) {
    if (__DEV__) console.log('[monitoring] SENTRY_DSN not set — skipping Sentry init');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    release: Constants.expoConfig?.version,
    dist: String(
      Constants.expoConfig?.ios?.buildNumber ||
        Constants.expoConfig?.android?.versionCode ||
        '0',
    ),
    sendDefaultPii: false,
    tracesSampleRate: __DEV__ ? 0.0 : 0.05,
    enableAutoSessionTracking: true,
    attachStacktrace: true,
    enabled: !__DEV__,
    beforeSend(event) {
      if (event.request?.cookies) delete event.request.cookies;
      if (event.user?.ip_address) delete event.user.ip_address;
      return event;
    },
  });

  // One info event per install so Sentry Issues is not stuck on "waiting for first
  // error" when the app is healthy. Fingerprint collapses all into one issue.
  SecureStore.getItemAsync(BOOT_PING_KEY)
    .then((v) => {
      if (v === '1') return;
      return SecureStore.setItemAsync(BOOT_PING_KEY, '1').then(() => {
        Sentry.captureMessage('Sentry mobile bootstrap (connectivity check)', {
          level: 'info',
          fingerprint: ['endura-sentry-bootstrap-ping'],
        });
      });
    })
    .catch(() => {});
}

export function identifySentryUser(userId: number | string, username?: string | null) {
  if (!SENTRY_DSN) return;
  Sentry.setUser({ id: String(userId), username: username ?? undefined });
}

export function clearSentryUser() {
  if (!SENTRY_DSN) return;
  Sentry.setUser(null);
}

export function captureError(error: unknown, context?: Record<string, any>) {
  if (!SENTRY_DSN) {
    if (__DEV__) console.error('[monitoring]', error, context);
    return;
  }
  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

export { Sentry };
