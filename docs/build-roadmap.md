# Endura — Build Roadmap

> **Editable working doc.** Tick, cut, reorder, add notes.
> Last updated: 27 April 2026 (build 21 — onboarding rework + timer resilience)

---

## Where we are now

- **App Store:** v1.0.2 build 15
- **TestFlight:** v1.0.2 build 19 (live, push notifications working)
- **Active build:** **20 — reactions push + `/feed/reactions/new` optimisation** (about to upload)
- **Strategic doc:** `docs/onboarding-friction-analysis.md`
- **Lifecycle reference:** `docs/onboarding-lifecycle.md`
- **Push reference:** `docs/push-notifications.md`

### What build 15 delivered

- [x] Standardised country picker (searchable, no more free-text fragmentation)
- [x] PostHog instrumentation of the entire onboarding flow (9 new events)
- [x] Server-side onboarding timestamps (`username_set_at`, `onboarding_completed_at`) for funnel measurement

Build 15 was **measurement, not friction reduction.** Build 16 is where we actually move the cliff.

---

## Build 21 — Onboarding rework + timer resilience (in progress)

**Theme:** "Show the value before asking for the email; never let a finished study session vanish."

### Onboarding (shipped to chat)

- [x] New `WalkthroughScreen` shows the 6 feature slides *before* email + verification (was the other way around)
- [x] `Avatar` component: profile picture defaults to the user's first initial on a deterministically-coloured background; sign-up photo step is now optional and editable from the profile screen later
- [x] "Sign out" escape hatch on the onboarding profile + subjects screens (previously, a user who landed in onboarding had no way out without creating an account)

### Timer / egg flow (this PR)

Bug report: *"if a user forgets to open the app right after the egg is ready to hatch, the next time they open the app their egg disappears and they can never tap to hatch — it deletes as a timer, study session, eco-credit, animal hatched, etc."*

Root cause: timer state lived only in component `useState`. When iOS / Android killed the JS context (force-close, low memory, OS swap-out), a finished session that hadn't yet been celebrated was lost — and a session in flight could disappear mid-timer.

- [x] **Persist active timer** to AsyncStorage on start (`{startedAt, durationSec, animalId, subjectId, notificationId}`). On TimerScreen mount we either resume the in-progress timer or, if it already expired, post the session to `/sessions` and surface the hatch celebration the user missed.
- [x] **Persist pending hatch** after `handleTimerComplete` saves the session. If the user kills the app before tapping through the egg, the celebration re-appears on next launch — server data is never double-recorded.
- [x] **Local "timer done" notification.** When the timer starts we schedule a `Notifications.scheduleNotificationAsync` for `durationSec` later: *"Your timer is done! Tap to hatch egg 🥚"* — fires even if the app is force-closed. Tapping it deep-links to `Timer`, where the recovery effect immediately pops the egg.
- [x] Notification is cancelled when the user finishes (or abandons) the timer in-app, so they never get a redundant ping.
- [x] Persisted state is cleared on egg-abandon (the user explicitly chose to lose progress) and on celebration close (the user has now seen their reward).
- [x] Recovery is offline-tolerant: if `/sessions` save fails, we keep `timer:active` and retry on the next launch — better one duplicate session than silently dropping the user's work.

---

## Build 20 — Reactions push + traffic cleanup (target ship 26 Apr 2026)

**Theme:** "Stop hammering the backend with reaction polls; deliver them as real pushes instead."

Sentry showed `/feed/reactions/new` taking ~10.8K hits/day from a 10-second poll
running in every authed app, while actual `react` calls were tiny. Fixed end-to-end.

### Backend (already shipped at commit `12d8f36`)

- [x] New `push_friend_reacted` template seeded into `push_templates`
- [x] `react_to_event` fires `_safe_send_push("push_friend_reacted", owner, ...)` on every reaction, with a 30-min throttle per (sender, event) so swapping emoji doesn't spam the recipient
- [x] `/feed/reactions/new` short-circuits when the user has no accepted friends (no one *can* react)
- [x] `/feed/reactions/new` bounds the `ActivityEvent` lookup to last 30 days (was unbounded `.all()`)

### Frontend (this build)

- [x] `ReactionOverlay.POLL_INTERVAL` 10s → 5 min — push is now the primary delivery channel; the poll is just a safety net for users without push permission

### Expected traffic profile after build 20 ships

| Channel | Before | After backend deploy | After build 20 |
|---|---|---|---|
| `/feed/reactions/new` | ~10.8K/day | ~2–3K/day | <500/day |
| `push_friend_reacted` | 0 | live, throttled | live, throttled |

### Validation after TestFlight install

- [ ] Open `/dashboard-e9x2k/` → Comms → Push → filter `template_key=push_friend_reacted`
- [ ] React from one TestFlight account to another's session → confirm push lands within ~5s and deep-links to Social
- [ ] In Sentry, watch `/feed/reactions/new` request volume drop by an order of magnitude over the next 24h

---

## Build 19 — Full push notifications (shipped 26 Apr 2026)

**Theme:** "Get users back into a study session at the right moment, without spamming them."

This is the largest stand-alone build since launch — it touches frontend, backend, admin, and the data model. Full reference doc: `docs/push-notifications.md`.

### Frontend

- [x] Install `expo-notifications` + `expo-device`, add the plugin to `app.json`
- [x] iOS `UIBackgroundModes: ["remote-notification"]`, Android `useNextNotificationsApi: true`, default notification icon/colour
- [x] `services/pushNotifications.ts` — permission, Expo token fetch, register with backend
- [x] Wire registration into `App.tsx` — fires *after* auth + username set, not on first launch (better grant rate)
- [x] Foreground handler + tapped handler with deep-link routing via `navigationRef`
- [x] `AuthContext.logout()` clears the push token server-side (best-effort, non-blocking)

### Backend

- [x] `services/push.py` — single `send_to_user`, batched `broadcast_to_users` (Expo's 100-message cap), template-based `send_template_to_user`
- [x] Auto-clear dead tokens on `DeviceNotRegistered`
- [x] `models.py`: extra columns on `users` (`push_token_updated_at`, `push_platform`, four per-category prefs); new `PushTemplate` and `PushLog` tables
- [x] Alembic migration `m7i8j9k01l12_add_push_notifications.py`
- [x] `push_seeds.py` — default templates for the Tier-1a onboarding sequence + event-driven pushes
- [x] Endpoints: `PUT/DELETE /users/me/push-token`, `GET/PUT /users/me/notification-prefs`
- [x] Event hooks fire pushes:
  - Badge earned (after `/sessions` POST)
  - Friend request received (after `/friends/request`)
  - Friend request accepted (after `/friends/accept/{id}`)
  - Donation received (after `/webhook/every-org` resolves to a user)
- [x] Daily lifecycle cron `_cron_lifecycle_pushes` at 10:00 UTC, dedup'd via `push_logs.template_key`

### Admin dashboard

- [x] New **🔔 Push** tab at `/dashboard-e9x2k/`
- [x] Opt-in funnel KPIs (token coverage, master-on, iOS/Android split)
- [x] 30-day metrics by category (sent / failed / dropped)
- [x] Recent send log
- [x] Send-test-to-user form (bypasses prefs)
- [x] Broadcast-to-cohort form (reuses email cohorts + push-only ones)
- [x] Manual lifecycle-run button
- [x] Inline editor for every `PushTemplate` (admin can change copy without deploy)

### Tier-1a onboarding lifecycle pushes (seeded as templates)

- [x] Day 1 — `push_day1_welcome` → Timer
- [x] Day 2 — `push_day2_first_timer` → Timer
- [x] Day 3 — `push_day3_streak` → Timer
- [x] Day 7 — `push_day7_friends` → Friends
- [x] Day 14 — `push_day14_donate` → TakeAction
- [x] Re-engage 3-day quiet — `push_reengage_3d`
- [x] Re-engage 7-day quiet — `push_reengage_7d`
- [x] Event-driven: `push_badge_earned`, `push_friend_request`, `push_friend_accepted`, `push_donation_thank_you`

### Outstanding (before tagging build 19)

- [ ] Run `eas credentials` once to upload the APNs key (instructions in `docs/push-notifications.md` § iOS APNs setup)
- [ ] Bump `ios.buildNumber` → 19 / `android.versionCode` → 7 (already done in `app.json`); commit + `eas build` for both platforms
- [ ] After first internal install: send a self-test from the **🔔 Push** admin tab, confirm `push_logs.status='sent'` and that the tap deep-links into Timer

### Deferred (explicit non-goals for this build)

- [ ] PostHog open-tracking (`Analytics.pushOpened()` in `setupNotificationListeners`) — needs ~30 min, do next build
- [ ] Per-user time-zone-aware scheduling — model field exists (`study_reminder_hour/minute`); cron currently fires at 10:00 UTC for everyone
- [ ] Receipt verification cron (`/push/getReceipts`) — only useful if we start optimising delivery rate
- [ ] In-app settings UI for the four category toggles — wire it next time `ProfileScreen` is touched
- [ ] Quiet-hours logic (no sends 22:00–08:00 local) — depends on a stored timezone

---

## Build 16 — proposed scope

**Theme:** "Get users to first session faster + give existing users something new to come back for."

**Estimated effort:** ~1.5 days focused work

### Track A — Onboarding friction reduction (the activation cliff)

Plan from `docs/onboarding-friction-analysis.md` Options A+B+C combined:

- [ ] **A. Trim walkthrough from 6 → 3 slides** (`OnboardingScreen.tsx`)
  - Slide 1: Focus timer + hatch animals (combine current 1, 2, 3)
  - Slide 2: Track progress + earn badges (combine current 4, 5)
  - Slide 3: Friends + leaderboards (current 6)
  - Effort: 30 min, UI only
- [ ] **B. Defer optional profile fields** — only `username` required at signup
  - Photo, school, country become optional with "Add later"
  - After first session completes, single in-app prompt: "Tell us where you study"
  - Effort: 2–3 hrs (UI changes + new post-first-session prompt component)
- [ ] **C. Auto-route to Timer (not Home) after onboarding completes**
  - Pre-select 25 min + "General Study" subject
  - "Not now, take me home" escape link
  - Effort: 1–2 hrs (navigation + Timer screen tweak)

Open questions:
- [ ] OK with Option D (full single-flow redesign) being deferred indefinitely?
- [ ] OK losing day-1 school/country completeness in exchange for activation? (Schools-map data slows down a bit; we make it up later via the post-session prompt.)

### Track B — Tip saves: DB-backed + admin surfacing

Saves are currently AsyncStorage-only (lost on reinstall / device switch). Move to DB so they survive devices, can power the recap, and show up in admin.

Backend (Phase 1):
- [ ] Alembic migration: add `saved` (Boolean, default False) and `saved_at` (DateTime, nullable) to `tip_views`
- [ ] Update `models.TipView`
- [ ] `GET /tips` response gains `saved_tip_ids: number[]` for hydration
- [ ] `POST /tips/{id}/save` and `POST /tips/{id}/unsave` (idempotent)
- [ ] `POST /tips/sync-saves` `{tip_ids: number[]}` for one-shot AsyncStorage→DB migration on first launch
- [ ] `/admin/overview` gains `total_tip_saves`, `tip_saves_7d`, `daily_tip_saves`
- [ ] `/admin/tips` gains per-tip `view_count`, `save_count`, `like_count`

Backfill (Phase 2):
- [ ] `backend/scripts/backfill_tip_saves.py` — query PostHog all-time `tip_saved` events, map distinct_id→user_id, populate `TipView.saved` + `saved_at`. Idempotent.

Mobile app (Phase 3, this build):
- [ ] `TipsScreen.toggleSave` POSTs to backend (write-through; AsyncStorage stays as offline cache)
- [ ] On `load()`, hydrate `savedIds` from `/tips` response's `saved_tip_ids` (DB is source of truth)
- [ ] One-time AsyncStorage→DB sync on first launch after update (track `tipSavesMigratedAt` flag)

Admin dashboard (Phase 4):
- [ ] Overview: new "Tips Saved" KPI card with 7d delta
- [ ] Overview: Tips Engagement chart switches to DB saves (drop redundant PostHog `tip_saved` overlay; keep `tip_viewed` overlay as sanity check)
- [ ] Content > Tips: per-tip table gains Views, Saves, Likes, Save Rate, Like Rate columns; sortable; "low engagement" filter

Deploy order: Phase 1 → Phase 2 backfill → Phase 4 (dashboard live with historical data) → Phase 3 (app build 16). Dashboard surfaces correct data even before users update the app.

### Track C — Week in Review (Recap Phase 1, in-app only)

Spotify Wrapped style, 5–6 swipeable story cards. **No push trigger yet, no social share yet** — just the screen and entry point.

Backend:
- [ ] New endpoint: `GET /stats/recap?period=week|month&offset=0`
  - `offset=0` = current period; `offset=1` = previous (lets us show "last week" too)
  - Returns per-card payload (see card list below)
- [ ] All aggregations computed in one DB round-trip where possible

Frontend cards (5 for Week, 7 for Month):
- [ ] **Card 1 — Hero**: Total minutes studied this week + streak (have data: `weekly_study_minutes`)
- [ ] **Card 2 — Best day**: "Tuesday was your strongest day — 84 min" + daily bar chart (have data)
- [ ] **Card 3 — Top subject**: "60% of your time on Mathematics" + subject breakdown (have data: `study_minutes_by_subject`)
- [ ] **Card 4 — Animals hatched**: list of animals hatched this period with reveal animation; IUCN status flag (need: filter `UserAnimal.hatched_at` by period)
- [ ] **Card 5 — Friend ranking**: "You ranked #2 of 5 friends this week" (need: per-friend minutes aggregate)
- [ ] **Card 6 — Conservation impact**: "$X.XX donated this period" + lifetime cumulative (need: aggregate `Donation.amount` attributable to user this period)
- [ ] **Card 7 — Comparison (month only)**: "+22% vs March"
- [ ] **Card 8 — Rarest hatch (month only)**: "Your rarest find — only X% of users have one" (need: animal rarity ranking globally)

UI:
- [ ] New `RecapScreen.tsx` — full-screen swipeable card stack (`PagerView` or horizontal `FlatList`)
- [ ] Visual language: forest green, animal art, big numbers; reuse existing components where possible
- [ ] Entry point on Home: "✨ Your Week" pill with green dot indicator if not yet viewed
- [ ] Track open events via PostHog: `recap_opened`, `recap_card_viewed`, `recap_completed`

Open questions:
- [ ] Week starts Monday or Sunday? (UK/IB students = Monday makes more sense)
- [ ] Show recap on Sunday evening or Monday morning? (Wrapped does Monday energy)
- [ ] What happens for users with <30 min that week — show recap with "small week, big future" framing, or skip?

### Track D — User Feedback System (bugs + feature requests)

End-to-end loop so users can report bugs, request features, ask questions, and we can triage in admin and ship the right things.

**Phase 0 — Backend + admin (✅ shipping with this commit):**
- [x] DB: `user_feedback` table (anonymous-friendly, captures type/title/message + auto metadata: app_version, OS, device, screen_context, screenshot_url) and `feedback_upvotes` table
- [x] `POST /feedback` — public endpoint, auth optional (anonymous submissions allowed)
- [x] `GET /feedback/feature-requests` — public list of feature requests, sortable by upvotes/newest, returns whether current user upvoted
- [x] `POST /feedback/{id}/upvote` and `DELETE /feedback/{id}/upvote` — auth required, one vote per user
- [x] Admin: `GET /admin/feedback` (filters: status/type/search, KPIs counts), `PATCH /admin/feedback/{id}` (status/priority/notes/internal_link), `DELETE /admin/feedback/{id}`
- [x] Admin dashboard: new "💬 Feedback" tab with KPIs (New 7d / Open / Bugs / Feature Requests), filterable table, click-to-triage modal with status workflow (new → triaged → in_progress → done/wontfix/duplicate), priority, internal Linear/GitHub link, admin notes

**Phase 1 — Mobile in-app form (Build 16):**
- [ ] `FeedbackScreen.tsx` — type picker (Bug / Feature / Question / Praise), title (optional for bugs), message, optional email for anonymous users
- [ ] Auto-attach metadata client-side: `expo-application` for app version, `Platform.OS`/`Platform.Version`, `expo-device` for model, current route name as `screen_context`
- [ ] Entry points: Profile/Settings → "Send feedback" link; long-press anywhere on About screen → "Report a problem" shortcut
- [ ] Success toast: "Thanks! We've received your feedback." with feedback id for reference

**Phase 2 — Screenshot attachments (Build 16):**
- [ ] `expo-media-library` + `expo-image-picker` to attach screenshot when filing a bug
- [ ] Upload to Supabase Storage (or S3 via existing infra) → store URL on feedback row

**Phase 3 — Email loop (Build 16, optional):**
- [ ] On submit: send acknowledgment email if email provided ("we got it, here's your reference number")
- [ ] On status change to `done`: send "this is shipped in build XX" email
- [ ] Use Postmark or Resend; add `EMAIL_PROVIDER_KEY` env var

**Phase 5 — Public feature voting (Build 16):**
- [ ] `/roadmap` public web page reads from `GET /feedback/feature-requests` — shows top-voted features, status, ability to upvote (auth required to vote, viewable to all)
- [ ] In-app "💡 Roadmap" link from Profile → opens same view in WebView, deep-link to upvote
- [ ] Admin can mark a feature `in_progress` → it shows up as "🔨 We're building this!" on the public roadmap, building anticipation

Open questions:
- [ ] Where does the "Send feedback" entry point live? Profile only, or also a floating button on key screens (Timer, Tips)?
- [ ] How aggressive to be on email collection for anonymous submissions — required to follow up, or strictly optional?
- [ ] Do we want PostHog `feedback_submitted` event with type for funnel tracking?

### Track E — AppFigures Reviews integration (deferred, post Build 16)

- [ ] Pull App Store reviews via AppFigures Reviews API daily, store in DB
- [ ] Surface in admin: filter by rating (1★ first), country, date; auto-flag 1–2★ reviews for response
- [ ] Optional: cross-reference 1★ reviews with feedback table by date/country to find systemic bugs

---

## Build 17 — proposed scope

**Theme:** "Bring users back via lifecycle pushes — leverage shared infra for both activation nudges and weekly recap delivery."

**Why bundled:** the push notification infrastructure (Expo Push API + APScheduler cron) is the same for both Tier 1a lifecycle nudges and Weekly Recap pushes. Build once, use twice.

**Estimated effort:** ~1 day if both ship together

### Track A — Push notification infrastructure ✅ **shipped in build 19 (26/04/26)**

- [x] Server-side push sender using Expo Push API (`backend/services/push.py`)
- [x] APScheduler job runner — `_cron_lifecycle_pushes` runs daily at 10:00 UTC
- [x] Respect `User.notification_enabled` (master) + 4 per-category prefs (badges/friends/reminders/marketing)
- [x] Token registration endpoint `PUT /users/me/push-token` + auto-clear on `DeviceNotRegistered`
- [x] `PushLog` table for delivery tracking, dedup, admin visibility
- [x] `PushTemplate` table for editable lifecycle/event copy (admin can change without deploy)
- [x] Frontend service `services/pushNotifications.ts` — permission flow, token fetch, deep-link routing on tap
- [x] Admin "Push" tab — opt-in funnel, send-test, broadcast to cohorts, recent log, edit templates
- [ ] Per-user time-zone-aware scheduling — **deferred** (use `User.study_reminder_hour/minute` later; right now lifecycle cron uses 10:00 UTC for everyone, which lands well across UTC-3 to UTC+9)
- [ ] Track opens via PostHog — **deferred** (Expo's notification responses fire client-side; wire `Analytics.pushOpened()` from `setupNotificationListeners` in a follow-up)

### Track B — Tier 1a onboarding lifecycle pushes ✅ **seeded as templates in build 19**

Default `PushTemplate` entries (admin can edit copy):

- [x] Day 1 — `push_day1_welcome` "Welcome to Endura, {name}! 🌿" → Timer
- [x] Day 2 — `push_day2_first_timer` "Your egg is waiting 🥚" → Timer
- [x] Day 3 — `push_day3_streak` "Day 3 — keep the streak alive 🔥" → Timer
- [x] Day 7 — `push_day7_friends` "Study buddies = streaks 👯" → Friends
- [x] Day 14 — `push_day14_donate` "You've studied {total_minutes} mins — convert it 💚" → TakeAction
- [x] Re-engage 3d quiet — `push_reengage_3d` (only if streak alive)
- [x] Re-engage 7d quiet — `push_reengage_7d` "Your animals miss you 🐼"
- [x] Event-driven: `push_badge_earned`, `push_friend_request`, `push_friend_accepted`, `push_donation_thank_you`

### Track C — Recap Phase 2 (push delivery)

- [ ] Monday 8 AM local cron: "Your week in review is ready 🌿" → deep-link to `RecapScreen`
- [ ] 1st of month 8 AM local cron: "Your month in review is ready 🌍"
- [ ] Suppress for users who studied <15 min that period (avoid empty recap)

Open questions:
- [ ] All 3 tracks in build 17, or split push lifecycle (Tier 1a) and Recap pushes into separate builds?
- [ ] Need to add APNs cert / Expo push credentials check before estimate is real — confirm Expo project is configured

---

## Build 18+ — deferred / candidate backlog

Not committed. Things to revisit once Build 16 + 17 ship and we have data.

### Recap Phase 3 — shareability (only if engagement justifies it)

- [ ] **Client-side share**: `react-native-view-shot` to capture card → `expo-sharing` to share. Lower quality, lower effort.
- [ ] **Server-side image render**: Pillow / Puppeteer to generate pixel-perfect cards server-side. Higher quality, higher effort. Required for "Share to Story" with no app context.
- [ ] **Hatch Your Exams campaign integration** — recap shows "you completed the challenge" badge, prompts share

### Tier 2 — deepen retention

- [ ] In-app study reminder UI (already have schema fields, no UI to set)
- [ ] Streak protection (1 freeze per week?)
- [ ] Friend suggestion visibility (we compute suggestions in backend; not surfaced)
- [ ] Day 7 / Day 14 / Day 21 / Day 30 lifecycle emails (`docs/onboarding-lifecycle.md` Phase 2+)
- [ ] Re-engagement push at 3 days inactive

### Tier 3 — social depth (`SOCIAL_FEATURES.md`)

- [ ] Sanctuary visits — view a friend's sanctuary
- [ ] Animal gifting between friends
- [ ] Collaborative hatching (already have `SharedEgg` model)
- [ ] Animal trade market
- [ ] Public profile showcase

### Subjects (Phase 2 of harmonisation)

- [ ] Look at the subjects audit (now live in admin) and decide if merge tooling is worth building
- [ ] If yes: `POST /admin/subjects/merge` endpoint + button in admin
- [ ] Optional: server-side synonym map in `create_custom_subject` to prevent future duplicates

### Other backlog

- [ ] Badge difficulty rebalance — 87% of active users earn 3+ badges (too easy?)
- [ ] App Store rating prompt (Day 28 trigger if 7+ sessions and 3+ day streak)

### Infrastructure — revisit at 1,000 users

- [x] **Layer 1: Railway Pro backups** — enabled (daily PITR, 7-day retention)
- [ ] **Layer 2 + 3: offsite encrypted backups** — deferred. Full plan in `docs/backup-strategy.md`. Triggers: 1,000+ users, paid subscriptions launch, or any data-loss scare. Work already scoped (~7 hrs build + quarterly restore drills).

### Monitoring & alerting

- [x] **Phase 1** (22/04/26): deep `/health` with DB check, Sentry SDK in backend (FastAPI auto-instrument, tagged with env + git SHA), Sentry SDK in Expo app (crash + JS errors, user identification, `Sentry.wrap`). Awaits Sentry DSNs + BetterStack uptime monitor sign-up (~15 min one-time setup).
- [ ] **Phase 2** — PostHog funnel alerts, Monday-morning weekly digest, durable log aggregation. Deferred until 1,000 users or a P2 incident slips through for 24h+. Full plan in `docs/monitoring-strategy.md`.

---

## Decision needed

Before I start implementing Build 16:

1. **Build 16 scope locked?** Track A + Track B as written above, or trim?
2. **Build 17 — bundle Tier 1a + Recap pushes, or split?**
3. **Open questions above** — answer or punt?
4. **Anything missing or out of priority order?**

Edit this doc, then say "go" and I'll start with Build 16 Track A.
