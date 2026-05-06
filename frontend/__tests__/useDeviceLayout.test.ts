/**
 * Regression tests for the device-layout breakpoint logic that powers
 * our iPad foundation work (build 38 batch).
 *
 * We exercise the pure `deriveDeviceLayout` helper rather than the hook
 * itself — jest can't easily render react-native hooks under the
 * jest-expo/web preset (it remaps `react-native` to `react-native-web`
 * which doesn't carry our test fixtures). The hook is a thin
 * `useMemo(() => deriveDeviceLayout(...))` wrapper, so testing the
 * derivation directly covers all behaviour we care about.
 *
 * Edge cases here matter: a regression would either (a) cause iPad mini
 * portrait to fall back to phone layouts, or (b) cause large iPhone Pro
 * Max landscape to *incorrectly* opt into tablet layouts (the long side
 * is ~932pt but the short side is ~430pt, well below the breakpoint).
 */
import { deriveDeviceLayout } from '../utils/deviceLayout';

describe('deriveDeviceLayout', () => {
  describe('phone-class devices', () => {
    test('iPhone 14 portrait — phone layout', () => {
      const layout = deriveDeviceLayout(390, 844);
      expect(layout.isTablet).toBe(false);
      expect(layout.isLandscape).toBe(false);
      expect(layout.contentMaxWidth).toBe(390);
      expect(layout.horizontalGutter).toBe(0);
    });

    test('iPhone 14 Pro Max landscape stays phone-class', () => {
      // Long side 932 > 600 breakpoint, but the SHORT side (430) is
      // what constrains layout. A regression that uses long-side or
      // raw width would flip giant phones into tablet layouts on rotate.
      const layout = deriveDeviceLayout(932, 430);
      expect(layout.isTablet).toBe(false);
      expect(layout.isLandscape).toBe(true);
      expect(layout.horizontalGutter).toBe(0);
    });
  });

  describe('tablet-class devices', () => {
    test('iPad mini portrait (768x1024) — tablet layout', () => {
      const layout = deriveDeviceLayout(768, 1024);
      expect(layout.isTablet).toBe(true);
      expect(layout.isLandscape).toBe(false);
      expect(layout.contentMaxWidth).toBe(720);
      expect(layout.horizontalGutter).toBeGreaterThan(0);
    });

    test('iPad Pro 12.9 landscape (1366x1024) — caps content + caps gutter', () => {
      const layout = deriveDeviceLayout(1366, 1024);
      expect(layout.isTablet).toBe(true);
      expect(layout.isLandscape).toBe(true);
      expect(layout.contentMaxWidth).toBe(720);
      // Gutter is clamped to 40 so we never push content too far from
      // the safe-area edge even on a 1366pt-wide canvas.
      expect(layout.horizontalGutter).toBe(40);
    });

    test('breakpoint exactly at 600 — counts as tablet', () => {
      // The rule is `>=`, so a 600pt short side opts into tablet layout.
      const layout = deriveDeviceLayout(800, 600);
      expect(layout.isTablet).toBe(true);
    });

    test('breakpoint at 599 — falls back to phone', () => {
      const layout = deriveDeviceLayout(800, 599);
      expect(layout.isTablet).toBe(false);
    });

    test('horizontal gutter has a 16pt floor on small tablets', () => {
      // iPad mini portrait: (768 - 720) / 2 = 24, well above the floor.
      // But for windows just above the 600 breakpoint the natural
      // value would dip below 16 and look indistinguishable from phone
      // layout. The Math.max(16, …) floor protects against that.
      const layout = deriveDeviceLayout(720, 600); // (720 - 720) / 2 = 0
      expect(layout.horizontalGutter).toBeGreaterThanOrEqual(16);
    });
  });
});
