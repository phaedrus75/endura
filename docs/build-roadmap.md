# Endura — Build Roadmap

> **Editable working doc.** Tick, cut, reorder, add notes. We build from this once you've signed off on Build 16's scope.
> Last updated: 19 April 2026 (after build 15 shipped to TestFlight)

---

## Where we are now

- **Latest TestFlight:** v1.0.2 build 15 (shipped 18 April)
- **Latest on `main`:** identical to build 15 for the frontend (no unshipped frontend commits)
- **Headline metric to move:** the activation cliff — 56% drop from email-verified → first timer started
- **Strategic doc:** `docs/onboarding-friction-analysis.md`
- **Lifecycle reference:** `docs/onboarding-lifecycle.md`

### What build 15 delivered

- [x] Standardised country picker (searchable, no more free-text fragmentation)
- [x] PostHog instrumentation of the entire onboarding flow (9 new events)
- [x] Server-side onboarding timestamps (`username_set_at`, `onboarding_completed_at`) for funnel measurement

Build 15 was **measurement, not friction reduction.** Build 16 is where we actually move the cliff.

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

### Track A — Push notification infrastructure

- [ ] Server-side push sender using Expo Push API (`User.push_token` already stored)
- [ ] APScheduler job runner (already in use — extend it)
- [ ] Per-user time-zone-aware scheduling (use `User.study_reminder_hour/minute` if set, else default 8 PM local)
- [ ] Respect `User.notification_enabled`
- [ ] Track sent / opened via PostHog

### Track B — Tier 1a onboarding lifecycle pushes

From `docs/onboarding-lifecycle.md` Phase 1:

- [ ] Day 1 evening — "Your egg is waiting! 🥚"
- [ ] Day 2 — "You're one session away from hatching your first animal!" (skip if studied)
- [ ] Day 3 — "Study is better with friends!"
- [ ] Day 5 — "[X]-day streak! Don't break it 🔥"

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

---

## Decision needed

Before I start implementing Build 16:

1. **Build 16 scope locked?** Track A + Track B as written above, or trim?
2. **Build 17 — bundle Tier 1a + Recap pushes, or split?**
3. **Open questions above** — answer or punt?
4. **Anything missing or out of priority order?**

Edit this doc, then say "go" and I'll start with Build 16 Track A.
