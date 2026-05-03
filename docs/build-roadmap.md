# Endura — Build Roadmap

> **Editable working doc.** Tick, cut, reorder, add notes.  
> **Last updated:** 3 May 2026 — **Build 28 (1.0.5) cut as timer-fixes-only.** Sign in with Apple + Google **deferred** out of this release after build 27 (1.0.4) crashed `AuthScreen` on TestFlight (no Google client IDs configured → `useIdTokenAuthRequest` threw on render). OAuth UI re-introduction tracked under "Deferred — needs configuration" below; full setup playbook in `docs/oauth-setup.md`.

---

## Where we are now

| Channel | Version | Build / code | Notes |
|--------|---------|----------------|-------|
| **iOS (TestFlight / App Store pipeline)** | **1.0.3** | **25** (deployed; users still on this) — **1.0.5 / build 28 queued** | Canonical build number lives in **App Store Connect** when using EAS `appVersionSource: "remote"` + `autoIncrement`. **1.0.4 / build 27 was cut and uploaded but never promoted** — TestFlight crashed `AuthScreen` (see top-of-file note). |
| **Repo `frontend/app.json`** | 1.0.5 | `ios.buildNumber` **26** (placeholder; EAS sets canonical) | Bump before a build if you rely on local display only. |
| **Android** | 1.0.5 | `versionCode` **13** | Not every release cycle ships Android; Play track may differ. Bumped from 12 in the v1→v2 migration patch. |
| **Backend (Railway)** | rolling | post-25 | Auto-deploys from `main`. Several user-invisible improvements landed since the build-25 cut — see *Shipped after build 25* below. |
| **Admin dashboard / website (Vercel)** | rolling | post-25 | Auto-deploys from `main`. New panels landed without an app build. |

**EAS / release hygiene (current):**

- `eas.json`: production iOS `autoIncrement: true`, `cli.appVersionSource: "remote"` (aligns versions with App Store Connect).
- Submit profile targets ASC app `6759482612`.

**Reference docs**

- `docs/push-notifications.md` — push architecture, admin, local timer notification.
- `docs/release-notes/v1.0.3.md` — user-facing TestFlight notes for the big 1.0.3 drop (build ~21 era).
- `docs/release-notes/v1.0.5.md` — current cut: timer/session reaper fixes only.
- `docs/onboarding-friction-analysis.md`, `docs/onboarding-lifecycle.md` — strategy.
- `docs/research.md` — research surveys / consent.
- `docs/oauth-setup.md` — **full step-by-step** to configure Apple Developer + Google Cloud + Railway env + frontend `app.json` so Sign in with Apple / Google can be re-enabled in a future build.
- `backend/oauth_verify.py`, `backend/oauth_merge.py` — server-side ID-token verification + merge-by-email logic for Sign in with Apple / Google (already shipped; just needs the UI + provider config to go live).
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

- [x] **Sign in with Apple + Sign in with Google — backend** — server-side ID-token verification (JWKS), POST `/auth/apple` and `/auth/google` endpoints, OAuth → existing-account merge by verified email (`backend/oauth_verify.py`, `backend/oauth_merge.py`, Alembic `x1y2z3a45b26_add_oauth_provider_subs`). **Live on Railway, fully tested (251/251 backend tests green).**
- [~] **Sign in with Apple + Google — UI** — wired in `AuthScreen.tsx` between 28 Apr–2 May, then **removed from 1.0.5 (build 28)** after build 27 (1.0.4) crashed on first render: `Google.useIdTokenAuthRequest({ iosClientId: undefined, ... })` throws when no client IDs are configured. Re-enable per `docs/oauth-setup.md` once provider configuration is complete. Tracked under **Deferred — OAuth UI re-enable** below.
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
- [x] **App Store rank tracking → Apple iTunes RSS** (replaces AppFigures). Free, public, no-auth (`itunes.apple.com/{country}/rss/topfreeapplications/limit=200/genre={id}/json`). New `backend/services/apple_rss.py` module with full unit-test coverage; cron at 04:00 + 16:00 UTC snapshots Education (6017) + Productivity (6007) top-free across ~80 countries; delta computed from yesterday's stored row. `app_ranks` table + dashboard UI unchanged. Dropped `APPFIGURES_PAT` / `APPFIGURES_APPSTORE_ID` / `APPFIGURES_PRODUCT_ID` env vars and the AppFigures backfill script. Optional `APPLE_APP_ID` env override (default `6759482612`).

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

### Build 28 (1.0.5) — Timer-loss fixes only (shipping now)

**Theme:** "Never silently lose a study session." OAuth UI deferred — see lane below.

**Track A — Timer disappearance fix (shipped in this cut)**

- [x] **Fix 1** — `Analytics.sessionAbandoned(elapsedMinutes)` from the *Abandon Egg* path so PostHog stops seeing `session_started` with no terminal event.
- [x] **Fix 2** — `AppState` listener reacts only to a true `'background'` transition, not iOS's incidental `'inactive'`. Removes the spurious "💀 YOUR EGG WILL DIE" alert that was leading to accidental "Abandon Egg" taps.
- [x] **Fix 3** — `Sentry.addBreadcrumb({category: 'timer'})` at start / complete / fallback / retry / recover / abandon, plus `Sentry.captureException` on save failures.
- [x] **Fix 4 (client)** — `confirmSubjectAndStart` calls `sessionsAPI.startSession()` on press of *Start*, persists `sessionId` in `ActiveTimerState`. `handleTimerComplete` and the recovery effect prefer `sessionsAPI.completeSessionById(...)`, falling back to legacy `completeSession` when the start row is missing / 404 / 409 / 410. The *⚠️ Sessions started but not completed* dashboard panel will start populating once users update.

**Track B — Audit gaps closed (post-Fix-1–4, identified in 2 May session)**

- [x] **Gap 1** — Recovery path now fires `Analytics.sessionCompleted` and `Analytics.eggHatched` so PostHog accurately credits sessions finalised after a JS-context kill.
- [x] **Gap 2** — Server-side reaper (`crud.reap_stale_sessions`, APScheduler every 15 min, `POST /admin/sessions/reap-stale` for manual catch-up). Auto-credits sessions for users who never reopen the app at all. Marked with new `study_sessions.auto_completed_at` column (Alembic `y2z3a4b56c27`).
- [x] **Gap 3** — Recovery on save-failure no longer drops the session: `pendingHatch` is *not* persisted on a failed save, so the recovery effect retries `completeSessionById` on next launch with `active` state intact.
- [x] **Gap 4** — `Analytics.sessionStarted` now fires *after* `persistActiveTimer` succeeds, eliminating false-positive started-but-never-completed funnel rows when the app is killed in the millisecond gap between Start press and state being durable.
- [x] 18 new backend tests in `tests/api/test_sessions.py` + `tests/api/test_session_failure_modes.py`. **251/251 backend + 13/13 frontend tests green.**

**Track C — OAuth UI rollback (this cut)**

- [x] Removed Apple + Google buttons, hooks, effects, and handlers from `AuthScreen.tsx`. Backend, DB, `oauthLogin.ts`, and `expo-apple-authentication` plugin/config left intact for trivial re-enable later.
- [x] Skipped 1.0.4 → 1.0.5 (since 1.0.4 was already accepted by App Store Connect for build 27).

**Track D — Onboarding A/B → ship the winner (this cut)**

- [x] **v2 promoted to default in App.tsx.** May 1–3 A/B test data: v2 (walkthrough before auth) hit 31.5% 72-h activation vs old App Store flow's 16.6% (+90% relative, p<0.005) and v1's 20.0%. v1 vs old was not significant (p≈0.40). Hardcoded `variant = 'v2'` in `App.tsx`'s assignment effect.
- [x] **Stored-variant migration.** First TestFlight install of 1.0.5 surfaced a regression: stored `'v1'` from earlier builds was sticking through `expo-secure-store` (iOS-Keychain-backed → survives app deletion) and skipping the new walkthrough. The original "stick whatever is stored" rule was correct DURING the live A/B test (cohort integrity) but became wrong the moment we picked a winner. Patch: only stored `'v2'` sticks; stored `'v1'` overwrites to `'v2'` and reports `source: 'promoted_from_v1'` in analytics so we can size the migrated cohort. Android `versionCode` bumped 12 → 13 for the rebuild; iOS `buildNumber` auto-increments via EAS.
- [x] **Telemetry fix shipped alongside.** `app_version` / `app_build` now captured from `X-App-Version` / `X-App-Build` request headers on every authenticated call (previously only on push registration → ~97% of users had NULL `app_version`). Backend hook lives in `auth.get_current_user`. Means the next "drive update" email cohort actually has the right population.
- [x] **Admin dashboard cohort fix shipped.** `product_tests.cohort_started_at` (Alembic `z3a4b5c67d28`) lets admins set the experiment ship date so the funnel cohort excludes pre-experiment users tagged on app upgrade. Set `cohort_started_at = 2026-05-01` on the existing onboarding A/B test row via the dashboard date picker once Railway is green; numbers will then match the clean SQL waterfall.

**Deferred to a future build (when we run a v3 test):**

- [ ] **Wire `promote-winner` button to actually deploy the variant.** Today it's a decision-log only — the button updates DB fields but doesn't touch the running app (we still need a build to switch defaults). Plan: add `assignment_default_variant` column to `product_tests`, set on promote-winner. Add public `GET /experiments/onboarding-ab/assignment` endpoint (60s server cache). App.tsx fetches at cold-launch, falls back to local default if fetch fails. Net effect: future "v3 wins" → one button click → live within ~2 min, no build. ~45 min of work; not blocking 1.0.5.

**Build commands** (per `.cursor/rules/eas-builds.mdc`, the user runs these — I do not):

```bash
cd /Users/munshi/Downloads/endura-v-2/frontend
npx eas-cli build --platform ios --profile production --auto-submit
npx eas-cli build --platform android --profile production --auto-submit
```

**Pre-build checklist**

- [x] `expo.version` bumped to `1.0.5`.
- [x] `android.versionCode` bumped to `12`.
- [x] iOS `buildNumber` will be auto-incremented by EAS (`appVersionSource: "remote"`).
- [x] Sentry DSN intact.
- [x] No new native modules in this cut → no provisioning regen needed.

**Release-notes draft** — see `docs/release-notes/v1.0.5.md` for the full text.

---

### Deferred — OAuth UI re-enable (future build, no fixed slot)

**What's left to do** (per `docs/oauth-setup.md`):

- [ ] **Apple Developer Portal** — tick "Sign in with Apple" capability on App ID `com.endura.study`; regenerate iOS provisioning profile via `eas credentials` (or just kick a new build and let EAS regenerate).
- [ ] **Google Cloud Console** — new project (or existing) → OAuth consent screen → 3 OAuth client IDs (iOS + Android with EAS upload-key SHA-1 + Web).
- [ ] **`frontend/app.json`** — add `extra.googleIosClientId`, `googleAndroidClientId`, `googleWebClientId`, plus `ios.infoPlist.CFBundleURLTypes` with the reversed iOS client ID.
- [ ] **Railway env (backend)** — `APPLE_AUDIENCES=com.endura.study` (optional; default), `GOOGLE_AUDIENCES=<3 client IDs comma-separated>` (required — verifier returns 503 without it).
- [ ] **`AuthScreen.tsx`** — re-add the imports / hook / effects / buttons that were removed in Build 28. Diff is preserved in commit history; the unused styles (`appleButton`, `oauthSpinner`, `googleButton`, `googleButtonText`, `dividerRow`, `dividerLine`, `dividerLabel`) were left in `StyleSheet.create` precisely to make this trivial.
- [ ] **Smoke test on TestFlight** — Apple sign-in (new + repeat sign-in returns same user), Google sign-in (new + repeat), email-merge path (Apple + same-email Google → both subs attached to one user row).

**Why deferred:** Build 27 (1.0.4) shipped with the OAuth UI but no provider config and crashed on `AuthScreen` mount. The fix is to do the provider config end-to-end *before* re-introducing the UI, not to ship UI that depends on infra that isn't there yet.

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

**Track E — App Store reviews**

- [ ] Deferred: pull reviews, admin surfacing, 1★ triage. (Apple's iTunes RSS gives top-rated/most-recent reviews on a per-country basis — same free no-auth endpoint family we use for rankings; can layer on later.)

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
