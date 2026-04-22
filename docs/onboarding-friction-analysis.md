# Onboarding Friction Analysis and Feature Prioritization

_Created: April 2026 — for later review_

## Context

Analysis based on the user funnel snapshot of 153 non-archived users showing a 56% drop from email verification to first timer started (the "activation cliff"). This doc captures the strategic discussion on where to focus next and concrete options for reducing onboarding friction.

---

## Funnel Analysis — What the Data Tells Us

### Raw Numbers (153 non-archived users)

- Signed Up: 153 (100%)
- Verified Email: 124 (81%) — 19% drop
- Started Timer: 54 (35.3%) — **56% drop (the biggest cliff)**
- Completed Timer: 54 (35.3%) — 0% drop
- Completed 3+ Timers: 27 (17.6%) — 50% drop
- Hatched Animal: 54 (35.3%)
- Earned Badge: 54 (35.3%)
- Earned 3+ Badges: 47 (30.7%)
- Added Friend: 29 (19%)
- Added 3+ Friends: 13 (8.5%)
- Joined Group: 17 (11.1%)
- Bought from Shop: 17 (11.1%)

### Key Insights

**1. The Activation Cliff: Verified Email to Started Timer (124 to 54 = 56% loss)**
70 users verified email but never started a single timer. This is the single biggest problem. Getting users to the product is harder than retaining them.

**2. Once activated, users stick remarkably well**
Everyone who starts a timer completes it (54 = 54). Hatching and badges track perfectly at 54. The core loop works — the problem is getting users INTO it.

**3. The 3+ retention cliff is moderate but healthy**
50% of active users came back for 3+ timers. Badges at 87% (too easy to earn?).

**4. Social features have low adoption**
Only 54% of active users added a friend. Groups at 31%.

**5. Shop has niche but real engagement**
31% of active users bought something.

---

## Agreed Priorities

Focus on:
- **Tier 1a** — Push notifications (not yet implemented; schema exists)
- **Tier 1b** — First-session nudge (in-app)
- **Tier 1c** — Reduce onboarding friction (this doc)

Deferred:
- Tier 2 — Deepen retention (study reminders, streak protection, friend suggestion visibility)
- Tier 3 — Sanctuary visits, animal gifting, collaborative hatching, trade market, profile showcase

---

## Current Onboarding Flow

Code: `frontend/screens/OnboardingScreen.tsx`

```
Auth (sign up + verify) 
  -> Slide 1 of 6 
  -> Slide 2 
  -> Slide 3 
  -> Slide 4 
  -> Slide 5 
  -> Slide 6 
  -> Profile setup (photo + username + school + country)
  -> Subject picker (search/add subjects)
  -> Home screen
```

Users can tap Skip on the walkthrough to jump straight to Profile Setup. Required field to "complete" onboarding is just `username` — the rest fails silently (errors swallowed with `catch {}` in `handleComplete`).

---

## Baseline Data — What We Can Measure Today

**The hard truth: we have no step-by-step analytics on onboarding right now.**

### What IS tracked
- PostHog: `app_opened` fires for all authenticated users (including mid-onboarding)
- PostHog: `identify` fires on every app open
- Backend: `users.created_at`, `email_verified`, `username` (nullable), `profile_pic_url`, `school`, `country`, `user_subjects.added_at`
- Product events (timer, tips, hatch, badges, shop, etc.) tracked via `Analytics.*` helpers in `frontend/services/analytics.ts`

### What is NOT tracked
- No event when the user views each walkthrough slide
- No event when the user skips the walkthrough
- No event when profile save succeeds or fails (errors silently swallowed)
- No event when subject picker is shown, used, or skipped
- No `onboarding_completed` event or timestamp
- No step timestamps (can't distinguish "dropped during walkthrough" from "dropped on profile form")

### The Coarse Baseline We CAN Compute Today

From the DB we can approximate a 4-step completion funnel:
1. Signed up (153)
2. Verified email (124)
3. Has `username` set (proxy for "finished profile step")
4. Has `school` AND `country` filled
5. Has a `profile_pic_url`
6. Has ≥1 subject in `user_subjects`
7. Started a timer (54)

This tells us **what users completed**, not **where they dropped off**. A user with no `username` could have dropped on slide 1 or slide 6 — we can't tell.

---

## Proposal: Instrument Onboarding Before Changing It

Roughly 1 hour of work, no schema changes needed, gives real baseline data within 48 hours.

Add these PostHog events in `frontend/screens/OnboardingScreen.tsx`:

- `onboarding_started` — when screen mounts
- `onboarding_slide_viewed` with `{ slide_number, slide_name }` — on each slide change
- `onboarding_walkthrough_skipped` — when user taps Skip
- `onboarding_walkthrough_completed` — when they reach slide 6 and hit Next
- `onboarding_profile_submitted` with `{ has_photo, has_school, has_country }` — when Start My Journey is tapped
- `onboarding_profile_save_failed` with `{ error }` — surface silent failures
- `onboarding_subjects_saved` with `{ count }`
- `onboarding_subjects_skipped`
- `onboarding_completed` — when user first lands on Home with a username

Optional but valuable:
- Add `username_set_at` (DateTime) column on User
- Add `onboarding_completed_at` (DateTime) column on User

With this, within 24-48 hours we can build a true funnel on the admin dashboard.

---

## Friction Reduction Options

Four concrete options, ranked by effort vs impact.

### Option A — Minimal (Easiest, Lowest Risk)

**Trim the walkthrough from 6 slides to 3.**

- Slide 1: Focus timer + hatch animals (combines current slides 1, 2, 3)
- Slide 2: Track progress + earn badges (combines slides 4, 5)
- Slide 3: Friends + leaderboards (slide 6)

- **Effort:** 30 min, UI-only in `OnboardingScreen.tsx`
- **Impact:** Modest
- **Risk:** Very low

### Option B — Defer Optional Fields (Medium)

**Make photo, school, country optional during onboarding. Only require username.**

- Profile step asks only for username (+ optional photo with "skip for now")
- After first session completion, show a single prompt: "Tell us where you study" (school + country)
- Keep subject picker optional as today

- **Effort:** 2-3 hours — UI changes + new post-first-session prompt component
- **Impact:** High. Photo + school autocomplete + country picker are 3 separate friction points.
- **Risk:** Low. Lose some day-1 profile completeness, gain activation. Profile data collected later when users are more invested.

### Option C — Skip to Timer (Aggressive)

**After onboarding completes, auto-navigate to Timer screen (not Home) with a pre-configured "Start your first session" prompt.**

- Home screen is informational; Timer screen is where value happens
- Pre-select a 25-minute session and pre-select "General Study" subject
- User just has to tap Start — first session completes in 25 minutes with zero friction

- **Effort:** 1-2 hours — navigation change + timer screen tweak
- **Impact:** Very high on activation. Directly attacks the 56% drop.
- **Risk:** Medium. Some users may feel pushed. Mitigate with a "Not now, take me home" link.

### Option D — Full Redesign (Highest Effort, Highest Potential)

**Collapse walkthrough + profile + first session into a single guided flow.**

- Slide 1: "What's your name?" (username, 1 field, big CTA)
- Slide 2: "Your first study session starts now" (25-min timer auto-starts)
- Slide 3: Confetti + first animal hatched + "Welcome to Endura"
- Profile completion, school, subjects all handled via contextual prompts later

- **Effort:** 1-2 days — major restructuring
- **Impact:** Could dramatically close the activation cliff. Every verified user leaves with a completed session and a hatched animal.
- **Risk:** Higher — bigger change, more to QA

---

## Recommendation

**Do A + B + C together.** They stack. A 3-slide walkthrough with only username required, auto-routing to timer, is roughly the same effort as doing any one of them separately but captures most of the value of D without the rewrite risk.

Alongside this, ship the onboarding analytics so the next iteration is data-informed.

---

## Open Questions to Resolve Before Shipping

1. **Scope:** A only? A+B+C combined? Full D redesign?
2. **Analytics timing:** Add tracking first (48hr baseline) then ship changes? Or ship tracking + friction fixes in the same release?
3. **School/country trade-off:** OK with making school/country optional given schools-map and school leaderboards need this data? (Fewer users provide it upfront, but more users survive to provide it later.)
4. **Badge difficulty:** 87% of active users earn 3+ badges — should thresholds be harder to make badges more meaningful?

---

## Related Documents

- `docs/onboarding-lifecycle.md` — 30-day push/email lifecycle program (mostly not yet implemented)
- `SOCIAL_FEATURES.md` — Tier 3 social feature ideas
- `docs/launch-gtm-plan.md`, `docs/weekly-gtm-plan.md` — GTM context
