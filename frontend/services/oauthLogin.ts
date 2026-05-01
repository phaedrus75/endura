/**
 * Sign in with Apple + Google Sign-In flows for the Expo client.
 *
 * Both providers ultimately produce an `id_token` that we POST to the Endura
 * backend, which verifies it server-side and issues our own JWT. Native Apple
 * support is iOS-only and requires a development build (Apple sign-in is not
 * supported in plain Expo Go in all SDK versions). Google support uses
 * `expo-auth-session` and works on iOS / Android once OAuth client ids are
 * configured.
 */

import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { authAPI } from './api';

/**
 * Whether the device can present Sign in with Apple. Always false on Android
 * and on simulators with no Apple ID configured.
 */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Native Sign in with Apple → POST identity token to backend → store JWT.
 * Throws on cancel or failure; the caller should surface a non-blocking alert.
 */
export async function signInWithApple(): Promise<void> {
  // SHA-256 nonce (Apple expects the hash; we keep the raw nonce in case we
  // want to use it for replay protection later).
  const rawNonce = generateRandomString(32);
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!credential.identityToken) {
    throw new Error('Apple did not return an identity token');
  }

  await authAPI.loginWithApple({
    identity_token: credential.identityToken,
    email: credential.email ?? null,
  });
}

/**
 * Hook factory for Google Sign-In via expo-auth-session.
 *
 * Returns the same `[request, response, promptAsync]` tuple as
 * `Google.useIdTokenAuthRequest`, plus a `submit(idToken)` helper that posts
 * the token to our backend. Caller wires the `response` into a `useEffect` and
 * calls `submit(...)` when `response.type === 'success'`.
 */
export function useGoogleAuth() {
  const iosClientId = (Constants.expoConfig?.extra as any)?.googleIosClientId
    || process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const androidClientId = (Constants.expoConfig?.extra as any)?.googleAndroidClientId
    || process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  const webClientId = (Constants.expoConfig?.extra as any)?.googleWebClientId
    || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  return Google.useIdTokenAuthRequest({
    iosClientId,
    androidClientId,
    clientId: webClientId,
  });
}

export async function submitGoogleIdToken(idToken: string): Promise<void> {
  await authAPI.loginWithGoogle({ id_token: idToken });
}

/**
 * Discover whether Google sign-in is configured (some client id is present).
 * If false, the UI hides the button instead of crashing on prompt.
 */
export function isGoogleConfigured(): boolean {
  const extra: any = Constants.expoConfig?.extra || {};
  return Boolean(
    extra.googleIosClientId
      || extra.googleAndroidClientId
      || extra.googleWebClientId
      || process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
      || process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
      || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  );
}

function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

// Re-export so screens can wire prompt result directly.
export type { AuthSession };
