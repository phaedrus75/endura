/**
 * Permission helpers that handle iOS's "permanently denied" trap.
 *
 * Background: once the user denies Photos / Camera access for an app,
 * `requestMediaLibraryPermissionsAsync()` no longer re-prompts — it
 * silently returns `{ granted: false, canAskAgain: false }`. Naive
 * callers then show a generic "Permission needed" alert that's a dead
 * end: the user has no idea they have to open Settings to fix it.
 *
 * These helpers detect that state and surface a one-tap "Open Settings"
 * action so users don't get stuck.
 */
import { Alert, Linking, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

type PermissionKind = 'media' | 'camera';

const KIND_LABEL: Record<PermissionKind, string> = {
  media: 'photo library',
  camera: 'camera',
};

const SETTINGS_LABEL = Platform.OS === 'ios' ? 'Settings' : 'app settings';

async function requestRaw(kind: PermissionKind) {
  return kind === 'media'
    ? ImagePicker.requestMediaLibraryPermissionsAsync()
    : ImagePicker.requestCameraPermissionsAsync();
}

/**
 * Ask for permission, and if denied, walk the user toward fixing it.
 *
 * Returns `true` only if the permission is currently granted (including
 * iOS 14+ "limited" library access, which the picker handles fine).
 *
 * If iOS has stored a permanent denial, an alert with an "Open Settings"
 * button is shown; tapping it deep-links to the app's privacy page.
 */
export async function ensurePermission(kind: PermissionKind): Promise<boolean> {
  const result = await requestRaw(kind);
  if (result.granted) return true;

  const label = KIND_LABEL[kind];

  // iOS returns canAskAgain: false once the user has explicitly denied
  // (or "Don't Allow"-ed at the system prompt). After that point, the
  // OS will never re-show the prompt — only Settings can flip it back.
  if (result.canAskAgain === false) {
    Alert.alert(
      `${label[0].toUpperCase()}${label.slice(1)} access is off`,
      `Endura can't open the ${label} because access is currently denied. ` +
        `You can turn it back on in ${SETTINGS_LABEL} \u2192 Endura \u2192 ${
          kind === 'media' ? 'Photos' : 'Camera'
        }.`,
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            Linking.openSettings().catch(() => {
              // If openSettings somehow fails (e.g. exotic device), fall
              // back to a generic privacy URL on iOS.
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:').catch(() => {});
              }
            });
          },
        },
      ]
    );
    return false;
  }

  // First-time-style denial (canAskAgain === true). The system prompt
  // *was* shown; the user picked "Don't Allow". Be brief and respectful
  // — they made a deliberate choice and may not want a Settings push.
  Alert.alert(
    'Permission needed',
    `Please allow ${label} access to continue.`
  );
  return false;
}
