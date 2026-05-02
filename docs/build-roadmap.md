# Endura — Build Roadmap

> **Editable working doc.** Tick, cut, reorder, add notes.  
> **Last updated:** 2 May 2026 — added post-launch (build 25) shipped list + queued **Build 26** scope (auth friction reduction + timer-loss fixes).

---

## Where we are now

| Channel | Version | Build / code | Notes |
|--------|---------|----------------|-------|
| **iOS (TestFlight / App Store pipeline)** | **1.0.3** | **25** (deployed; users still on this) | Canonical build number lives in **App Store Connect** when using EAS `appVersionSource: "remote"` + `autoIncrement`. |
| **Repo `frontend/app.json`** | 1.0.3 | `ios.buildNumber` **24** | May trail ASC by one between submits; bump before a build if you rely on local display only. |
| **Android** | 1.0.3 | `versionCode` **10** | Not every release cycle ships Android; Play track may differ. |
| **Backend (Railway)** | rolling | post-25 | Auto-deploys from `main`. Several user-invisible improvements landed since the build-25 cut — see *Shipped after build 25* below. |
| **Admin dashboard / website (Vercel)** | rolling | post-25 | Auto-deploys from `main`. New panels landed without an app build. |

**EAS / release hygiene (current):**

- `eas.json`: production iOS `autoIncrement: true`, `cli.appVersionSource: "remote"` (aligns versions with App Store Connect).
- Submit profile targets ASC app `6759482612`.

**Reference docs**

- `docs/push-notifications.md` — push architecture, admin, local timer notification.
- `docs/release-notes/v1.0.3.md` — user-facing TestFlight notes for the big 1.0.3 drop (build ~21 era).
- `docs/onboarding-friction-analysis.md`, `docs/onboarding-lifecycle.md` — strategy.
- `docs/research.md` — research surveys / consent.
- `backend/oauth_verify.py`, `backend/oauth_merge.py` — server-side ID-token verification + merge-by-email logic for Sign in with Apple / Google.
- `scaffolding/` — drop-in starter pack for new apps (FastAPI + Expo + Vercel admin shell, mirroring Endura's architecture). Untracked artifact.

---

## Shipped — what is done (summary)

Everything below is **live in repo and/or production** unless marked *verify only*.

### Push & notifications (Build 19 + follow-ups)

- [x] Expo push: token registration, prefs, templates, `PushLog`, admin **Push** tab, broadcast / test send, template editor.
- [x] Event-driven pushes: badge, friend request/accept, donation thank-you; lifecycle cron (10:00 UTC); re-engage 3d / 7d; Tier-1a day templates.
- [x] `push_friend_reacted` + throttling; `/feed/reactions/new` bounded + short-circuits; poll interval relaxed on client (push-first).
- [x] Local **timer done** notification + persistence so hatch is not lost; delivery/open reporting path for admin visibility (`POST /push/local-fired` etc. per release notes).

### Onboarding & activation (Build 21+)

- [x] Walkthrough **before** email; optional profile photo + initials `Avatar`; sign-out escape on onboarding screens.
- [x] Onboarding copy / flow tweaks (e.g. exit confirmation without spoiling hatch animal).
- [x] **Onboarding A/B (v1 vs v2):** device assigns variant, `App.tsx` syncs to `users.onboarding_ab_variant` after login; admin **Product tests** funnel includes cohort → username → complete → **first timer session** (and related steps) when `feature_key` matches onboarding A/B pattern.

### Timer, egg & home

- [x] Timer + pending hatch persisted (AsyncStorage); recovery on relaunch; offline-tolerant session save retry.
- [x] Home egg tappable → Timer; tap-to-hatch flow hardened after background/kill.

### Friends & social

- [x] Friends leaderboard: correct ordering / truncation / NULL-safe server path; UI fallback for self row.
- [x] Friend activity / feed polish (e.g. subtitle copy for reactions where implemented).

### Feedback & quality

- [x] In-app **feedback** from Home (modal): categories, message, optional screenshots, metadata (app version, OS, device, screen); `POST /feedback` + attachment upload pipeline; admin triage with thumbnails.
- [x] Feedback UI refinements (e.g. chip layout, category labelling) as shipped in recent builds.

### Sanctuary / collection

- [x] Sanctuary modal reliability: loading, imagery resolution (bundle + `image_url`), layering / touch handling as per current `CollectionScreen` implementation.

### Admin & dashboard

- [x] Push tab, feedback tab, product tests expansion with **funnel** visualisation for onboarding A/B tests.
- [x] Geography and other existing admin surfaces (unchanged list in older sections — still accurate).

### Research (backend + app)

- [x] Research surveys: API + `ResearchSurveyModal` on Home when `next` survey returned (see `ResearchSurveyModal`, `HomeScreen`, `api.ts` research types). Migrations in repo for survey tables where applied.

### Infrastructure & safety nets

- [x] Deep `/health` + DB check; Sentry backend + mobile (DSN in config).
- [x] Railway Pro backups (Layer 1).
- [x] **`GET /public/client-config`** — optional **mandatory store-update gate** (env `MOBILE_MIN_*`). **Not enabled in prod** (no env set → no block). See **Mobile ops** in backlog.

### EAS / Apple submission fixes

- [x] iOS duplicate-build submit issues addressed via **autoIncrement** + **remote** app version source.
- [x] Android `versionCode` stepped as needed when Play builds ship.

---

## Shipped after the build 25 launch (28 Apr → 2 May 2026)

These changes are live on Railway / Vercel **without** needing an app build, *unless* explicitly noted "needs app build to take effect". The TestFlight / App Store binary in users' hands is still build 25 — anything client-side queues for the next cut (see **Build 26** below).

### Auth — friction reduction

- [x] **Sign in with Apple + Sign in with Google** — server-side ID-token verification (JWKS), POST `/auth/apple` and `/auth/google` endpoints, OAuth → existing-account merge by verified email (`backend/oauth_verify.py`, `backend/oauth_merge.py`, Alembic `x1y2z3a45b26_add_oauth_provider_subs`). **Backend ready; needs app build to expose the buttons.**
- [x] Per-user app version tracking + `update_app` email pipeline driven from PostHog `$app_version`; admin Users tab shows outdated cohort and one-click backfill.

### Admin dashboard / analytics

- [x] **Cohort-scoped user funnel** — pills for All / Signup month / Signup week / App version, with sub-pills generated from the new `/admin/funnel/segments` endpoint.
- [x] **PostHog onboarding funnel** — 8-step nested-reach waterfall over the last 120 days (assigned → auth viewed → started → walkthrough → profile → subjects → completed).
- [x] First-timer-session step in the product-test funnel (onboarding A/B view).
- [x] Onboarding funnel cohort + PostHog URL fix.
- [x] **PostHog query proxy resilience** — HogQL "max execution time" responses (sometimes 4xx, sometimes 504) now treated as soft timeouts: returned to client as `timeout: true` and logged as `WARNING`, no longer paged via Sentry. Recent-events query bounded to last 7 days to keep ClickHouse happy.
- [x] **⚠️ Sessions started but not completed panel** (Overview page) — surfaces silent timer-loss bugs from the new server-side handshake (see Build 26). Empty until users update.

### Marketing site

- [x] Per-school visibility tier drives the marquee rows on `endura.eco` (top-tier schools surfaced first).

### Reliability / ops

- [x] **Sentry mobile bootstrap ping** — one-time `captureMessage` per install so the Issues panel isn't stuck on "waiting for first event" right after a fresh install.
- [x] Resend webhook handler retries on transient DB / DNS failures.
- [x] Email campaign throttle to **5 rps** (Resend limit) so admin broadcast does not 429.

### Reference docs / scaffolding

- [x] `docs/research.md` — research surveys / consent reference (added 30 Apr).
- [x] **`scaffolding/`** — drop-in starter pack mirroring Endura's architecture (FastAPI + Expo + Vercel admin shell + reference docs + Alembic + tests). Untracked in git until you opt in; live in working tree only.

### Timer-loss bug — backend + dashboard portion (this commit)

> User-reported **silent timer disappearance** on `user_id=2`: a 25-min timer ran in background, app reopened, timer gone with no notification or session row. PostHog had `session_started` with no completion or abandon event.

- [x] **Backend handshake**: `POST /sessions/start` (creates a row with `completed_at=NULL`) + `POST /sessions/{id}/complete` (finalises by id with same coins/streak/hatch/badge logic). Legacy `POST /sessions` preserved for older clients.
- [x] **Admin endpoint**: `GET /admin/sessions/incomplete?hours=...` lists rows still `completed_at=NULL`, flags `is_stale` when `started_at + duration_minutes < now`.
- [x] **Dashboard panel**: pills (incomplete / stale / window) + table (user · duration · subject · started · elapsed · status), wired into Overview load.
- [x] Backend regression tests (9 new in `tests/api/test_sessions.py`, 242 / 242 green) + frontend api tests (13 / 13 green) + `apiFetch` now attaches `err.status` so callers can branch on 404 / 409 / 410.
- [ ] **Client portion (queued for Build 26)** — see below.

---

## Verify in production (*not* code todos)

Quick checks when you have time — does not block roadmap.

- [ ] **Push reaction path:** Dashboard → Comms → Push → filter `push_friend_reacted`; two TestFlight accounts react → push + deep link to Social within a few seconds.
- [ ] **Sentry / traffic:** `/feed/reactions/new` volume stays in the expected low band after push-first shipping.
- [ ] **APNs / credentials:** If anything regresses, re-run `eas credentials` / docs in `docs/push-notifications.md` § iOS.

---

## Remaining — product backlog (not shipped)

### Build 26 — Auth friction + timer-loss fixes (next iOS cut)

**Theme:** "Two-tap sign-up + never silently lose a study session." All backend + admin work for these landed in **Shipped after the build 25 launch** above; this build is purely the app-side switches that flip them on for users.

**Track A — Auth (Sign in with Apple / Google)**

- [ ] Wire `expo-apple-authentication` + `expo-auth-session` (Google) into the Auth screen; primary CTA = Apple, secondary = Google, fallback = email/password.
- [ ] Frontend calls `POST /auth/apple` / `/auth/google` with the platform-issued ID token and stores the returned JWT.
- [ ] Smoke test the email-merge path: existing email-account user signs in via Apple → backend merges via verified email and bumps `apple_id_sub`.

**Track B — Timer disappearance fix (4 fixes; all branches done in repo, awaiting build)**

- [ ] **Fix 1** — `Analytics.sessionAbandoned(elapsedMinutes)` from the *Abandon Egg* path in `showExitWarning` so PostHog stops seeing `session_started` with no terminal event.
- [ ] **Fix 2** — `AppState` listener reacts only to a true `'background'` transition, not iOS's incidental `'inactive'` (Notification Center swipe, app-switcher peek, system permission prompt, incoming-call banner). Removes the spurious "💀 YOUR EGG WILL DIE" alert that was leading to accidental "Abandon Egg" taps.
- [ ] **Fix 3** — `Sentry.addBreadcrumb({category: 'timer'})` at start / complete / fallback / retry / recover / abandon, plus `Sentry.captureException` on save failures. Gives us a full breadcrumb trail next time anyone reports a vanished timer.
- [ ] **Fix 4 (client)** — `confirmSubjectAndStart` calls `sessionsAPI.startSession()` on press of *Start*, persists `sessionId` in `ActiveTimerState`. `handleTimerComplete` and the recovery effect prefer `sessionsAPI.completeSessionById(...)`, falling back to legacy `completeSession` when the start row is missing / 404 / 409 / 410. Once shipped, the *⚠️ Sessions started but not completed* dashboard panel starts populating.

**Build commands** (per `.cursor/rules/eas-builds.mdc`, the user runs these — I do not):

```bash
cd /Users/munshi/Downloads/endura-v-2/frontend
npx eas-cli build --platform ios --profile production
# When verified on TestFlight, then submit:
npx eas-cli submit --platform ios --latest
```

**Pre-build checklist**

- [ ] Bump `frontend/app.json` `ios.buildNumber` if relying on local display only (EAS `autoIncrement` will set the canonical number in ASC).
- [ ] Confirm `.env` / `expo.extra.sentryDsn` populated so the new breadcrumbs land in Sentry.
- [ ] Smoke `expo-apple-authentication` capabilities still valid (re-run `eas credentials` if anything regressed).

**Release-notes draft** — *bullet points to expand later*

- "Sign in with Apple / Google" (one-tap signup; merges with existing email accounts).
- "Your timer can no longer silently disappear" — covers fixes 1–4 in user terms.

---

### Build 16 — proposed scope (still open)

**Theme:** Faster first session + durable tip saves + recap v1 + remaining feedback roadmap.

**Track A — Onboarding friction** (from `docs/onboarding-friction-analysis.md`)

- [ ] Trim walkthrough 6 → 3 slides; defer optional profile fields; auto-route to Timer after onboarding with escape hatch.

**Track B — Tip saves (DB-backed)**

- [ ] Migration on `tip_views`, API save/unsave/sync, admin metrics, mobile hydration + one-time AsyncStorage migration.

**Track C — Week in Review (Recap Phase 1, in-app only)**

- [ ] `GET /stats/recap`, `RecapScreen`, Home entry, PostHog events. No push trigger yet.

**Track D — Feedback (phases beyond what shipped)**

- [x] Phase 0 backend + admin + in-app modal with attachments (**done** — see shipped summary).
- [ ] Dedicated `FeedbackScreen` / extra entry points (Profile-only vs everywhere) — **optional** if modal is enough.
- [ ] Ack / status emails (Resend/Postmark) — optional.
- [ ] Public `/roadmap` voting page — optional.

**Track E — AppFigures reviews**

- [ ] Deferred: pull reviews, admin surfacing, 1★ triage.

#### Build 16 — Track C recap cards (design detail; all unchecked)

Backend: `GET /stats/recap?period=week|month&offset=0` — aggregations in as few round-trips as practical.

Frontend cards (week ~5, month ~7):

- [ ] Card 1 — Hero: minutes + streak  
- [ ] Card 2 — Best day + mini chart  
- [ ] Card 3 — Top subject breakdown  
- [ ] Card 4 — Animals hatched in period  
- [ ] Card 5 — Friend ranking for period  
- [ ] Card 6 — Conservation / donations period + lifetime  
- [ ] Card 7 — Month: vs previous period %  
- [ ] Card 8 — Month: rarest hatch framing  

UI: `RecapScreen` (pager), Home **Your Week** entry, PostHog `recap_*` events.

Open questions: week start Monday vs Sunday; when to show for low-minutes users; Sunday vs Monday surfacing.

#### Build 16 — Track B tip saves (deploy order reminder)

1. [ ] Migration + API + admin metrics  
2. [ ] Backfill script from PostHog `tip_saved` (if still desired)  
3. [ ] Dashboard first, then mobile write-through + one-time AsyncStorage migration (`tipSavesMigratedAt`)

### Build 17 — recap + push (partially overtaken by 19)

**Already in Build 19**

- [x] Push infra + Tier-1a templates (see shipped).

**Still open**

- [ ] **Track C — Recap Phase 2 (push):** Monday week recap push, month recap push, suppress low-activity cohorts.
- [ ] PostHog **`Analytics.pushOpened()`** from notification listeners.
- [ ] **Per-user timezone** for lifecycle cron (uses `study_reminder_hour/minute` later).
- [ ] In-app **notification category toggles** UI on Profile.
- [ ] Quiet hours; receipt verification cron — lower priority.

### Build 18+ — deferred / candidate backlog

Not committed. Revisit after Build 16 data + recap decisions.

**Recap Phase 3 — shareability**

- [ ] View-shot + share; or server-rendered cards; campaign hooks.

**Tier 2 — retention**

- [ ] In-app study reminder UI (schema exists).
- [ ] Streak freeze; friend suggestions surfaced; lifecycle **emails** (Phase 2+ in onboarding-lifecycle doc).
- [ ] *(Push re-engage at 3d is already in templates — use email/push matrix to avoid duplicating work.)*

**Tier 3 — social depth** (`SOCIAL_FEATURES.md`)

- [ ] Sanctuary visits, gifting, collaborative hatching UI, trade market, public profiles.

**Subjects Phase 2**

- [ ] Merge tooling / synonym map — only if audit says worth it.

**Other**

- [ ] Badge difficulty rebalance.
- [ ] App Store rating prompt (Day 28, sessions + streak heuristic).

**Mobile ops — mandatory store update (deferred; not for now in prod)**

- [ ] Leave `MOBILE_MIN_IOS_*` / `MOBILE_MIN_ANDROID_*` **unset** until we intentionally sunset a binary.
- [ ] Wired: `/public/client-config` + `ForceUpdateScreen` + launch gate in `App.tsx` (fails open offline; skipped in `__DEV__` / Expo Go).
- [ ] **Before first use:** ship a new store build that satisfies the new minimum, then raise env.

**Infrastructure — scale triggers**

- [ ] Layer 2+3 offsite backups (`docs/backup-strategy.md`) — at ~1k users, paid subs, or incident.
- [ ] Monitoring Phase 2 — PostHog alerts, weekly digest, log aggregation (`docs/monitoring-strategy.md`).

---

## Historical detail (by build) — archive

Use this for archaeology; **status = shipped** for all blocks below.

### Build 25 (and 22–24) — incremental **v1.0.3** pipeline

Small **iOS** builds through **25**: bugfixes, copy/UI, admin funnel / A/B reporting, research survey surfacing, EAS **autoIncrement** + **remote** `appVersionSource`, collection/sanctuary hardening, duplicate-submit avoidance. No single mega-feature — keep using **release notes** per cut when you need a paper trail.

### Build 21 — Onboarding rework + timer resilience (**shipped**)

**Theme:** "Show the value before asking for the email; never let a finished study session vanish."

- [x] Walkthrough before auth; Avatar defaults; onboarding escape hatches.
- [x] Timer + pending hatch persistence; local timer-done notification; recovery + offline retry behaviour (see shipped summary).

### Build 20 — Reactions push + traffic cleanup (**shipped**)

- [x] `push_friend_reacted`, reaction throttle, `/feed/reactions/new` optimisations, client poll relaxed.

### Build 19 — Full push notifications (**shipped 26 Apr 2026**)

- [x] Full stack: `services/push.py`, models, migrations, seeds, endpoints, admin Push tab, frontend `pushNotifications.ts`, post-auth registration.

---

## Planning questions (when you next scope a sprint)

1. **Build 16:** Still want Tracks A + B + C together, or split (e.g. recap only)?
2. **Recap push:** Bundle with timezone work or ship UTC-only first?
3. **Android:** Next Play release versionCode plan vs iOS parity?
4. **Research surveys:** Rollout policy and admin reporting — document in `docs/research.md`?

---

## Appendix — v1.0.3 user-facing highlights (from release notes)

See **`docs/release-notes/v1.0.3.md`** for full text. Short list:

- In-app feedback (Home), attachments, triage metadata.
- Friends leaderboard correctness.
- Glitch-proof hatch + timer-done notification + Home egg → Timer.
- Onboarding: optional photo, spoiler-free exit copy, group leave clarity.

---

*End of roadmap doc.*
