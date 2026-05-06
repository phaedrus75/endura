import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { deriveDeviceLayout, type DeviceLayout } from './deviceLayout';

/**
 * Single source of truth for tablet vs phone layout decisions.
 *
 * This is the React-Native-bound wrapper around the pure
 * `deriveDeviceLayout` helper in `./deviceLayout`. Keeping the
 * derivation pure lets us unit-test the breakpoint logic without
 * needing the jest-expo/web resolver to find react-native hooks.
 *
 * Usage:
 *   const { isTablet, contentMaxWidth, horizontalGutter } = useDeviceLayout();
 *   <View style={{ width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' }}>
 *     ...
 *   </View>
 *
 * `useWindowDimensions` updates on rotation and on Slide Over / Stage
 * Manager window resize, so callers automatically re-render when the
 * effective surface changes — no manual orientation listener required.
 */
export type { DeviceLayout } from './deviceLayout';

export function useDeviceLayout(): DeviceLayout {
  const { width, height } = useWindowDimensions();
  return useMemo<DeviceLayout>(
    () => deriveDeviceLayout(width, height),
    [width, height],
  );
}
