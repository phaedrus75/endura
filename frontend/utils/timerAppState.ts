/**
 * Pure transition logic for the study-timer AppState handler.
 *
 * Lives outside TimerScreen.tsx so it can be unit-tested without rendering
 * the (very large) screen + stubbing every Expo native module.
 *
 * The contract this enforces:
 *   - On *any* transition into 'background' (whether direct or via
 *     'inactive'), record `backgroundTimestamp` and arm a warning.
 *   - On *any* transition into 'active' *while a backgroundTimestamp is
 *     set*, catch the visible countdown up by the elapsed wall-clock time
 *     and either complete the session or re-show the warning if needed.
 *   - On 'active' → 'inactive' → 'active' bounces (Notification Center
 *     pull, app-switcher peek, system permission prompts, incoming-call
 *     banner, etc.) we do nothing — those never touch 'background', so
 *     `backgroundTimestamp` stays null and the catch-up branch is skipped.
 *
 * The earlier (build 26 / 1.0.5) version of this code required the
 * *previous* state to literally be 'active' before recording the
 * timestamp. On iOS the lock-screen path is active → inactive → background
 * (the side button takes you through 'inactive' first), so by the time
 * 'background' fired, the previous state was 'inactive' and the strict
 * check failed. `backgroundTimestamp` was never set; on resume the
 * countdown stayed frozen at the value it had when the user locked the
 * phone. Reported by users as "the timer stops working when I put the
 * phone away to study". Fixed in build 33 / 1.0.5.
 */

export type AppStateName = 'active' | 'background' | 'inactive' | 'unknown' | string;

export interface AppStateTimerCtx {
  isRunning: { current: boolean };
  isPaused: { current: boolean };
  backgroundTimestamp: { current: number | null };
  warnOnReturn: { current: boolean };
  timeLeft: { current: number };
}

export interface AppStateTimerActions {
  setTimeLeft: (next: number) => void;
  onComplete: () => void;
  onWarn: () => void;
  now: () => number;
}

export function handleAppStateChange(
  nextAppState: AppStateName,
  ctx: AppStateTimerCtx,
  actions: AppStateTimerActions,
): void {
  // Entry: any → 'background' while a timer is running. Stamp wall clock so
  // we can catch up on resume regardless of how many incidental events the
  // OS fires before/after this one.
  if (ctx.isRunning.current && nextAppState === 'background') {
    if (!ctx.backgroundTimestamp.current) {
      ctx.backgroundTimestamp.current = actions.now();
    }
    if (!ctx.isPaused.current) {
      ctx.warnOnReturn.current = true;
    }
  }

  // Exit: any → 'active' but only if we previously stamped a background.
  // Gating on the stamp (rather than checking the previous state name)
  // keeps the lock-screen-unlock path correct — iOS often goes
  // background → inactive → active, so checking `prev === 'background'`
  // would silently miss the unlock and leave the countdown frozen.
  if (
    ctx.isRunning.current &&
    nextAppState === 'active' &&
    ctx.backgroundTimestamp.current
  ) {
    const elapsedSeconds = Math.floor(
      (actions.now() - ctx.backgroundTimestamp.current) / 1000,
    );
    ctx.backgroundTimestamp.current = null;
    const newTimeLeft = Math.max(0, ctx.timeLeft.current - elapsedSeconds);
    actions.setTimeLeft(newTimeLeft);
    if (newTimeLeft <= 0) {
      ctx.warnOnReturn.current = false;
      actions.onComplete();
    } else if (ctx.warnOnReturn.current) {
      ctx.warnOnReturn.current = false;
      actions.onWarn();
    }
  }
}
