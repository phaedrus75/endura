/**
 * Pure (React-Native-free) device-layout derivation.
 *
 * Lives in its own file so unit tests can import the breakpoint logic
 * without pulling in `react-native` — our jest config remaps that to
 * `react-native-web` which doesn't ship some hooks (`useWindowDimensions`)
 * under the path the resolver expects.
 *
 * Rationale for the heuristic:
 *   - We deliberately avoid `Platform.isPad` / `expo-device`. The
 *     short-side breakpoint is more portable (works for Android tablets,
 *     Stage Manager / Slide Over windows where the iPad runs but the
 *     app's window is phone-sized, etc.) and treats the *available
 *     drawing surface* as the truth — which is what layouts actually
 *     care about.
 *   - 600pt short side ≈ smallest standard iPad mini portrait width;
 *     anything below should look phone-like (large iPhones in landscape
 *     stay phone-class because their short side is ~430pt).
 *   - 720pt content max width is a comfortable single-column reading
 *     width that still leaves room for two-column variants on landscape
 *     iPads in later phases.
 */
export interface DeviceLayout {
  width: number;
  height: number;
  isTablet: boolean;
  isLandscape: boolean;
  contentMaxWidth: number;
  horizontalGutter: number;
}

export const TABLET_SHORT_SIDE = 600;
export const TABLET_CONTENT_MAX_WIDTH = 720;

export function deriveDeviceLayout(width: number, height: number): DeviceLayout {
  const shortSide = Math.min(width, height);
  const isTablet = shortSide >= TABLET_SHORT_SIDE;
  const isLandscape = width > height;
  return {
    width,
    height,
    isTablet,
    isLandscape,
    // On phone we let the screen fill (max width = current width). On
    // tablet we cap it so cards/forms/buttons stay legible.
    contentMaxWidth: isTablet ? TABLET_CONTENT_MAX_WIDTH : width,
    // Gutter scales modestly past the breakpoint with a 16pt floor (so
    // small tablets still get visible inset) and a 40pt cap (so large
    // landscape iPads don't push content uncomfortably far from the
    // safe-area edge).
    horizontalGutter: isTablet
      ? Math.min(40, Math.max(16, (width - TABLET_CONTENT_MAX_WIDTH) / 2))
      : 0,
  };
}
