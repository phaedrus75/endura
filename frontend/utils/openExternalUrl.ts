import { Alert, Linking } from 'react-native';

import { isBenignNetworkError, captureError } from '../services/monitoring';

/**
 * Open an external URL with a graceful fallback when the OS has no handler
 * registered (no Mail.app, Safari restricted by parental controls, etc.).
 *
 * Why this exists: Sentry kept catching unhandled promise rejections from
 * raw `Linking.openURL(...)` calls — every "Contact Support" tap on a
 * device with no email client became a logged error AND silently failed
 * for the user (button "did nothing"). Same for Terms/Privacy on devices
 * with restricted browsers. This helper:
 *   1. Pre-checks with canOpenURL so we know upfront if the URL is openable.
 *   2. Wraps openURL in try/catch (Linking can throw even after a positive
 *      canOpenURL — it's a separate native call).
 *   3. Falls back to an Alert showing the URL or email so the user can
 *      copy it manually instead of seeing nothing.
 *
 * The fallback Alert text is auto-derived from the URL scheme:
 *   - mailto:  → "Email us at <addr>"
 *   - http(s): → "Visit <url> in your browser"
 *   - tel:     → "Call <number>"
 *   - other    → generic "Open <url>"
 *
 * Callers can override with `fallbackTitle` / `fallbackMessage` for more
 * specific copy (e.g. "Contact Support" vs "Open Terms of Use").
 *
 * Returns true when openURL succeeded, false when the fallback Alert was
 * shown. Never throws.
 */
export async function openExternalUrl(
  url: string,
  opts?: {
    fallbackTitle?: string;
    fallbackMessage?: string;
  },
): Promise<boolean> {
  let supported = false;
  try {
    supported = await Linking.canOpenURL(url);
  } catch {
    supported = false;
  }
  if (supported) {
    try {
      await Linking.openURL(url);
      return true;
    } catch (err) {
      // Don't pollute Sentry with the user's "no handler" condition (we
      // catch it cleanly below), but DO log unexpected throws so we can
      // diagnose patterns (e.g. malformed URLs).
      if (!isBenignNetworkError(err)) {
        captureError(err, { url });
      }
    }
  }
  showUnopenableFallback(url, opts);
  return false;
}

function showUnopenableFallback(
  url: string,
  opts?: { fallbackTitle?: string; fallbackMessage?: string },
): void {
  const title = opts?.fallbackTitle ?? defaultTitle(url);
  const message = opts?.fallbackMessage ?? defaultMessage(url);
  Alert.alert(title, message, [{ text: 'OK' }]);
}

function defaultTitle(url: string): string {
  if (url.startsWith('mailto:')) return 'Contact us by email';
  if (url.startsWith('tel:')) return 'Phone';
  return 'Open in browser';
}

function defaultMessage(url: string): string {
  if (url.startsWith('mailto:')) {
    const addr = url.replace(/^mailto:/i, '').split('?')[0];
    return `Email us at ${addr} — long-press to copy.`;
  }
  if (url.startsWith('tel:')) {
    const number = url.replace(/^tel:/i, '');
    return `Call ${number}.`;
  }
  if (/^https?:/i.test(url)) {
    return `Couldn't open your browser. Visit ${url} directly — long-press to copy.`;
  }
  return `Couldn't open ${url}.`;
}
