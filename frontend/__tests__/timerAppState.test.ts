/**
 * Regression tests for the study-timer AppState handler.
 *
 * The headline test is `lock-screen path catches up on resume`, which
 * exercises the exact iOS sequence active → inactive → background → active
 * that build 32 / 1.0.5 silently broke. A few users reported "the timer
 * stops working when I put the phone away" — turned out the prior code
 * only stamped `backgroundTimestamp` when prevState === 'active', so the
 * lock-screen path (which goes via 'inactive') never recorded the stamp
 * and the catch-up branch did nothing on resume.
 */
import {
  handleAppStateChange,
  type AppStateTimerCtx,
  type AppStateTimerActions,
} from '../utils/timerAppState';

type Ref<T> = { current: T };

function ref<T>(initial: T): Ref<T> {
  return { current: initial };
}

interface Harness {
  ctx: AppStateTimerCtx;
  actions: AppStateTimerActions;
  setTimeLeftMock: jest.Mock;
  onCompleteMock: jest.Mock;
  onWarnMock: jest.Mock;
  fixedNow: { value: number };
  /** Apply a sequence of AppState transitions, each separated by `gapMs`. */
  step(state: string, gapMs?: number): void;
}

function makeHarness(opts: {
  isRunning: boolean;
  isPaused?: boolean;
  timeLeftSec: number;
  startNowMs?: number;
}): Harness {
  const fixedNow = { value: opts.startNowMs ?? 1_700_000_000_000 };
  const ctx: AppStateTimerCtx = {
    isRunning: ref(opts.isRunning),
    isPaused: ref(opts.isPaused ?? false),
    backgroundTimestamp: ref<number | null>(null),
    warnOnReturn: ref(false),
    timeLeft: ref(opts.timeLeftSec),
  };
  const setTimeLeftMock = jest.fn((n: number) => {
    ctx.timeLeft.current = n;
  });
  const onCompleteMock = jest.fn();
  const onWarnMock = jest.fn();
  const actions: AppStateTimerActions = {
    setTimeLeft: setTimeLeftMock,
    onComplete: onCompleteMock,
    onWarn: onWarnMock,
    now: () => fixedNow.value,
  };
  return {
    ctx,
    actions,
    setTimeLeftMock,
    onCompleteMock,
    onWarnMock,
    fixedNow,
    step(state: string, gapMs = 0) {
      fixedNow.value += gapMs;
      handleAppStateChange(state, ctx, actions);
    },
  };
}

describe('handleAppStateChange — lock-screen path (the build-32 regression)', () => {
  test('active → inactive → background → active catches up the visible countdown', () => {
    const h = makeHarness({ isRunning: true, timeLeftSec: 25 * 60 });

    // User locks the phone with the side button. iOS goes via 'inactive'.
    h.step('inactive', 100);   // brief inactive flicker
    h.step('background', 200); // settles in background

    // backgroundTimestamp must be stamped (this is the regression — the
    // prior code only stamped on `prev === 'active'` so the inactive
    // intermediary made the stamp silently skipped).
    expect(h.ctx.backgroundTimestamp.current).not.toBeNull();
    expect(h.ctx.warnOnReturn.current).toBe(true);

    // Phone in pocket for 12 minutes
    h.fixedNow.value += 12 * 60 * 1000;

    // User comes back. iOS lock-screen-unlock often goes background →
    // inactive → active; the catch-up branch must fire on the final
    // 'active' even though prev state is 'inactive', not 'background'.
    h.step('inactive', 50);
    h.step('active', 50);

    // Visible countdown should drop from 25:00 by ~12 minutes
    expect(h.setTimeLeftMock).toHaveBeenCalledTimes(1);
    const newTimeLeft = h.setTimeLeftMock.mock.calls[0][0];
    expect(newTimeLeft).toBeGreaterThanOrEqual(13 * 60 - 1); // 25 - 12 ≈ 13
    expect(newTimeLeft).toBeLessThanOrEqual(13 * 60 + 1);

    // Stamp cleared, warning fired, completion not (still time left)
    expect(h.ctx.backgroundTimestamp.current).toBeNull();
    expect(h.onWarnMock).toHaveBeenCalledTimes(1);
    expect(h.onCompleteMock).not.toHaveBeenCalled();
  });

  test('direct active → background → active also catches up (force-quit prevention)', () => {
    const h = makeHarness({ isRunning: true, timeLeftSec: 25 * 60 });
    h.step('background', 100);

    expect(h.ctx.backgroundTimestamp.current).not.toBeNull();

    h.fixedNow.value += 5 * 60 * 1000; // 5 minutes away
    h.step('active', 50);

    expect(h.setTimeLeftMock).toHaveBeenCalledTimes(1);
    const newTimeLeft = h.setTimeLeftMock.mock.calls[0][0];
    expect(newTimeLeft).toBeGreaterThanOrEqual(20 * 60 - 1);
    expect(newTimeLeft).toBeLessThanOrEqual(20 * 60 + 1);
  });
});

describe('handleAppStateChange — incidental events (must NOT fire warning)', () => {
  test('active → inactive → active (Notification Center / call banner) is a no-op', () => {
    const h = makeHarness({ isRunning: true, timeLeftSec: 25 * 60 });

    h.step('inactive', 100);
    h.fixedNow.value += 3_000;
    h.step('active', 100);

    // No timestamp ever set, no warning, no completion, no time decrement
    expect(h.ctx.backgroundTimestamp.current).toBeNull();
    expect(h.ctx.warnOnReturn.current).toBe(false);
    expect(h.setTimeLeftMock).not.toHaveBeenCalled();
    expect(h.onWarnMock).not.toHaveBeenCalled();
    expect(h.onCompleteMock).not.toHaveBeenCalled();
  });

  test('repeated inactive bounces stay no-op', () => {
    const h = makeHarness({ isRunning: true, timeLeftSec: 25 * 60 });

    for (let i = 0; i < 5; i++) {
      h.step('inactive', 50);
      h.step('active', 50);
    }

    expect(h.ctx.backgroundTimestamp.current).toBeNull();
    expect(h.setTimeLeftMock).not.toHaveBeenCalled();
    expect(h.onWarnMock).not.toHaveBeenCalled();
  });
});

describe('handleAppStateChange — completion while backgrounded', () => {
  test('timer that would have ended while backgrounded fires onComplete and not onWarn', () => {
    const h = makeHarness({ isRunning: true, timeLeftSec: 60 }); // only 1 min left
    h.step('background', 100);
    h.fixedNow.value += 5 * 60 * 1000; // away for 5 minutes
    h.step('active', 50);

    expect(h.setTimeLeftMock).toHaveBeenCalledWith(0);
    expect(h.onCompleteMock).toHaveBeenCalledTimes(1);
    expect(h.onWarnMock).not.toHaveBeenCalled();
    // warnOnReturn must have been disarmed (otherwise the death alert
    // would fire on top of the completion modal).
    expect(h.ctx.warnOnReturn.current).toBe(false);
  });
});

describe('handleAppStateChange — paused timer', () => {
  test('backgrounding while paused does not arm the death warning', () => {
    const h = makeHarness({ isRunning: true, isPaused: true, timeLeftSec: 25 * 60 });
    h.step('background', 100);

    // Stamp still recorded (so we can no-op the catch-up correctly), but
    // warnOnReturn must NOT be armed because the user explicitly paused.
    expect(h.ctx.backgroundTimestamp.current).not.toBeNull();
    expect(h.ctx.warnOnReturn.current).toBe(false);

    h.fixedNow.value += 60 * 1000;
    h.step('active', 50);

    expect(h.onWarnMock).not.toHaveBeenCalled();
  });
});

describe('handleAppStateChange — not running', () => {
  test('AppState changes while no timer is running are completely ignored', () => {
    const h = makeHarness({ isRunning: false, timeLeftSec: 25 * 60 });
    h.step('background', 100);
    h.fixedNow.value += 60 * 1000;
    h.step('active', 50);

    expect(h.ctx.backgroundTimestamp.current).toBeNull();
    expect(h.setTimeLeftMock).not.toHaveBeenCalled();
    expect(h.onCompleteMock).not.toHaveBeenCalled();
    expect(h.onWarnMock).not.toHaveBeenCalled();
  });
});

describe('handleAppStateChange — repeated background events', () => {
  test('a second background transition before resume does NOT reset the stamp', () => {
    const h = makeHarness({ isRunning: true, timeLeftSec: 25 * 60 });
    h.step('background', 100);
    const firstStamp = h.ctx.backgroundTimestamp.current;

    h.fixedNow.value += 30_000; // 30s in background
    // Some OS event flickers us through inactive → background again
    h.step('inactive', 10);
    h.step('background', 10);

    expect(h.ctx.backgroundTimestamp.current).toBe(firstStamp);

    h.fixedNow.value += 30_000; // another 30s
    h.step('active', 10);

    // Total of ~60s should have been deducted (not just the last 30s)
    expect(h.setTimeLeftMock).toHaveBeenCalledTimes(1);
    const newTimeLeft = h.setTimeLeftMock.mock.calls[0][0];
    expect(newTimeLeft).toBeGreaterThanOrEqual(25 * 60 - 61);
    expect(newTimeLeft).toBeLessThanOrEqual(25 * 60 - 59);
  });
});
