import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { API_URL } from './api';

export interface ClientConfigPayload {
  ios: { min_version: string | null; min_build: number | null };
  android: { min_version: string | null; min_version_code: number | null };
  update_message: string | null;
  ios_store_url: string;
  android_store_url: string;
}

function semverTuple(v: string): [number, number, number] {
  const head = v.trim().split(/[^0-9.]+/)[0] || '0';
  const parts = head.split('.').map((p) => parseInt(p, 10));
  const a = Number.isFinite(parts[0]) ? parts[0] : 0;
  const b = Number.isFinite(parts[1]) ? parts[1] : 0;
  const c = Number.isFinite(parts[2]) ? parts[2] : 0;
  return [a, b, c];
}

/** -1 if a < b, 0 if equal, 1 if a > b */
export function compareSemver(a: string, b: string): number {
  const [a1, a2, a3] = semverTuple(a);
  const [b1, b2, b3] = semverTuple(b);
  if (a1 !== b1) return a1 < b1 ? -1 : 1;
  if (a2 !== b2) return a2 < b2 ? -1 : 1;
  if (a3 !== b3) return a3 < b3 ? -1 : 1;
  return 0;
}

function parseBuild(s: string | null): number {
  if (!s) return 0;
  const n = parseInt(String(s).trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * True when this install is below the minimum required store binary for the
 * current OS. Server omits min_* until you set env vars on the backend.
 */
export function shouldForceStoreUpdate(cfg: ClientConfigPayload): boolean {
  if (Platform.OS === 'web') return false;

  const appVersion =
    Constants.expoConfig?.version || Application.nativeApplicationVersion || '0.0.0';
  const nativeBuild = Application.nativeBuildVersion;

  if (Platform.OS === 'ios') {
    const minV = cfg.ios.min_version;
    if (!minV) return false;
    if (compareSemver(appVersion, minV) < 0) return true;
    const minB = cfg.ios.min_build;
    if (minB != null && compareSemver(appVersion, minV) === 0 && parseBuild(nativeBuild) < minB) {
      return true;
    }
    return false;
  }

  if (Platform.OS === 'android') {
    const minV = cfg.android.min_version;
    if (!minV) return false;
    if (compareSemver(appVersion, minV) < 0) return true;
    const minCode = cfg.android.min_version_code;
    if (
      minCode != null &&
      compareSemver(appVersion, minV) === 0 &&
      parseBuild(nativeBuild) < minCode
    ) {
      return true;
    }
    return false;
  }

  return false;
}

export function storeUrlForPlatform(cfg: ClientConfigPayload): string {
  return Platform.OS === 'android' ? cfg.android_store_url : cfg.ios_store_url;
}

const FETCH_MS = 8000;

export async function fetchClientConfig(): Promise<ClientConfigPayload> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    const res = await fetch(`${API_URL}/public/client-config`, {
      method: 'GET',
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`client-config ${res.status}`);
    }
    return (await res.json()) as ClientConfigPayload;
  } finally {
    clearTimeout(t);
  }
}
