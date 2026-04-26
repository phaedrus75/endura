# Endura — Test Strategy & Test Plan

> **Status:** DRAFT — awaiting review and approval before implementation.
> **Last updated:** April 2026
> **Companion docs:** `ARCHITECTURE-v2.md`, `docs/build-roadmap.md`

---

## Part 1 — Test Strategy

### 1.1 Goals

The testing framework exists to answer one question before every build ships:
**"Does Endura still work the way it's supposed to?"**

More specifically, it must:

1. Catch regressions in the core game loop (sessions → coins → eggs → animals) before they reach TestFlight.
2. Guard the auth boundary — unauthenticated users must never access protected data.
3. Verify the social contract — friends, leaderboards, and groups work correctly.
4. Protect the financial flows — donations record correctly, donation leaderboard is accurate.
5. Confirm push notifications are wired, dispatched, and deduped correctly.
6. Run fast enough that you'll actually run them — the full suite should complete in under 3 minutes locally.

### 1.2 Philosophy

- **Regression-first.** We're not trying to prove correctness from first principles; we're pinning the known-good behaviour so we can break things with confidence.
- **Backend-heavy.** The backend contains all the business logic (badge rules, streak math, coin calculations). That's where the tests should be densest.
- **E2E for the seams.** Full journey tests (auth → onboarding → session → hatch) catch integration failures that unit tests miss.
- **No mocking the database.** Tests run against a real SQLite database (in-memory for speed) so we test real SQL, not mock behaviour.
- **Pre-push gate.** A single `./scripts/test.sh` script runs everything and blocks the push if it fails.

### 1.3 What We're Testing (Scope)

| Layer | What | Tool |
|---|---|---|
| Backend — unit | Badge logic, streak calculations, coin math, content filter | pytest |
| Backend — API | Every critical endpoint via FastAPI `TestClient` | pytest + httpx |
| Backend — integration | Full flows: auth → session → hatch, friends → leaderboard | pytest |
| Frontend — services | `api.ts` request shaping, error handling, auth header injection | Jest |
| Frontend — components | Key screens: `AuthScreen`, `TimerScreen`, `HomeScreen` render + interaction | Jest + RNTL |
| E2E (optional phase 2) | Full app on simulator: sign-up → session → hatch → friend | Maestro |

### 1.4 What We're NOT Testing

| Excluded | Reason |
|---|---|
| Third-party services (Resend, PostHog, Every.org, Expo Push) | Mocked at the boundary; we test that we call them correctly, not that they work |
| Admin dashboard (static HTML) | Covered by manual smoke test; pure data display, no business logic |
| App Store / TestFlight submission | Not automatable |
| Visual / pixel-perfect UI fidelity | Out of scope; manual review suffices |
| Railway infra, Docker, networking | Infrastructure concern, not application logic |

### 1.5 Test Levels

#### Level 1 — Unit Tests (`tests/unit/`)
Small, fast, zero I/O. Test one function or class at a time.

- Badge rules in `crud.check_badges()` — every badge condition individually
- Streak increment / reset / preservation logic
- Coin calculation (`duration_minutes → coins_earned`)
- Egg progress calculation
- Content filter (profanity rules)
- JWT encode/decode in `auth.py`
- Pydantic schema validation edge cases (blank usernames, negative durations, etc.)

#### Level 2 — API Integration Tests (`tests/api/`)
Spin up a FastAPI `TestClient` backed by an in-memory SQLite database. Test each endpoint group end-to-end through HTTP.

- Auth endpoints (register, login, verify, refresh)
- Session endpoints (POST /sessions, GET /sessions)
- Animal / egg endpoints (GET /animals, GET /eggs)
- Social endpoints (friends, groups, feed, leaderboard)
- Tips endpoints (view, like, save, unsave)
- Push notification endpoints (token register/delete, prefs)
- Feedback endpoints (submit, list, upvote)
- Admin endpoints (with and without correct `X-Admin-Key`)
- Webhook endpoints (Every.org donation)
- Stats endpoint (coins, streak, time, badges)

#### Level 3 — Flow Tests (`tests/flows/`)
Multi-step scenarios that exercise several endpoints working together. These are the regression tests that matter most.

See Part 2 for the full list.

#### Level 4 — Frontend Service Tests (`frontend/__tests__/`)
Jest tests for the TypeScript services layer. No React Native renderer needed.

- `api.ts` — verifies request shaping, JWT header attachment, error propagation
- `pushNotifications.ts` — token registration sequence
- Auth token persistence (mocked `expo-secure-store`)

#### Level 5 — Component Tests (`frontend/__tests__/`)
Jest + React Native Testing Library. Fast render tests for screens with complex state.

- `AuthScreen` — login/register toggle, validation, loading state
- `TimerScreen` — start/pause/end, time display, subject picker
- `HomeScreen` — renders egg progress, stats, to-do list
- `OnboardingScreen` — slide navigation, required field validation

#### Level 6 — E2E Tests (Phase 2, Maestro)
Full-app flows on a simulator. **Not in scope for the initial build — added in a follow-up build once unit + API tests are stable.** Documented here for planning.

---

### 1.6 Tools & Frameworks

| Tool | Purpose | Where |
|---|---|---|
| **pytest** | Backend test runner | `backend/` |
| **pytest-asyncio** | Async endpoint support | `backend/` |
| **httpx** | HTTP client for FastAPI `TestClient` | `backend/` |
| **SQLite (in-memory)** | Test database (swapped in via `DATABASE_URL=sqlite:///:memory:`) | `backend/` |
| **factory_boy** | Test fixture factories (create users, sessions etc. in one line) | `backend/tests/` |
| **freezegun** | Freeze `datetime.now()` for streak/cron tests | `backend/tests/` |
| **pytest-cov** | Coverage reporting | `backend/` |
| **Jest** | Frontend test runner | `frontend/` |
| **@testing-library/react-native** | Component rendering + interaction | `frontend/` |
| **jest-expo** | Expo-compatible Jest preset | `frontend/` |
| **Maestro** | E2E simulator flows (Phase 2) | `tests/e2e/` |

---

### 1.7 Test Environment

**Backend tests** override `DATABASE_URL` with `sqlite:///:memory:` and set dummy values for all external service keys (`RESEND_API_KEY=test`, `SECRET_KEY=testsecret`, etc.). No real network calls are made — Resend, PostHog, and Expo Push are patched with `unittest.mock`.

**Frontend tests** run in Node via Jest with jsdom. `expo-secure-store`, `expo-notifications`, and `@react-native-async-storage/async-storage` are auto-mocked.

**No shared state.** Every test creates its own DB tables (SQLAlchemy `create_all`) and tears them down after. Tests can run in any order.

---

### 1.8 Coverage Targets

These are minimums, not goals. Beat them.

| Layer | Minimum coverage |
|---|---|
| `backend/crud.py` | 90% |
| `backend/auth.py` | 95% |
| `backend/main.py` (endpoint handlers) | 80% |
| `backend/services/push.py` | 85% |
| `frontend/services/api.ts` | 75% |
| `frontend/screens/` (component tests) | 60% |

---

### 1.9 Pre-Push Gate

A script at `scripts/test.sh` runs the full suite. **No push to `main` or `TestFlight` trigger until it passes.**

```
scripts/test.sh
├── cd backend && pytest tests/ --tb=short -q         (~60 sec)
├── cd frontend && npx jest --passWithNoTests -q      (~60 sec)
└── Print summary: PASS / FAIL + coverage report
```

This script is documented in `README.md` with setup instructions (venv activation, env vars, etc.).

---

## Part 2 — Test Plan

> The test plan lists every individual test case we intend to build, grouped by area.
> **Status column:** `planned` = not yet written, `draft` = written but not reviewed, `approved` = in suite.

---

### 2.1 Authentication & Security

| ID | Test name | What it verifies | Level |
|---|---|---|---|
| AUTH-01 | Register with valid email + password | Returns 200, creates user row, issues JWT | API |
| AUTH-02 | Register with duplicate email | Returns 400 with clear error | API |
| AUTH-03 | Register with invalid email format | Returns 422 (Pydantic validation) | API |
| AUTH-04 | Register with password under 8 chars | Returns 422 | API |
| AUTH-05 | Login with correct credentials | Returns JWT + user profile | API |
| AUTH-06 | Login with wrong password | Returns 401 | API |
| AUTH-07 | Login with non-existent email | Returns 401 (not 404, to prevent user enumeration) | API |
| AUTH-08 | JWT is valid and decodable | Decoded payload contains correct `sub` (user_id) and non-expired `exp` | Unit |
| AUTH-09 | Expired JWT rejected | Endpoint returns 401 when token is past `exp` | API |
| AUTH-10 | Tampered JWT rejected | Returns 401 on signature mismatch | API |
| AUTH-11 | Protected endpoint with no token | Returns 401 | API |
| AUTH-12 | Admin endpoint with valid `X-Admin-Key` | Returns 200 | API |
| AUTH-13 | Admin endpoint with wrong `X-Admin-Key` | Returns 403 | API |
| AUTH-14 | Admin endpoint with no key | Returns 403 | API |
| AUTH-15 | User A cannot access User B's private data | Correct 403/404 on cross-user resource requests | API |
| AUTH-16 | Password is hashed in DB (never stored plain) | `users.password_hash` never equals raw password | Unit |
| AUTH-17 | Rate limiting on login endpoint | 6th login attempt within window returns 429 | API |

---

### 2.2 Core Game Loop — Sessions, Coins, Eggs

| ID | Test name | What it verifies | Level |
|---|---|---|---|
| GAME-01 | POST /sessions — 25 min session | Returns `coins_earned`, `streak`, `new_badges`; session row in DB | API |
| GAME-02 | Coin math — correct coins for duration | 1 coin per minute; 25 min → 25 coins (adjust if formula differs) | Unit |
| GAME-03 | Egg progress increments after session | `eggs.progress` increases by `coins_earned` | API |
| GAME-04 | Egg hatches when full (progress ≥ capacity) | Response includes `hatched_animal`; new `user_animals` row created | Flow |
| GAME-05 | Hatched animal is a valid species | `animals.id` exists in the master list | Flow |
| GAME-06 | Egg resets after hatch | New egg created with `progress=0` | Flow |
| GAME-07 | Session with duration = 0 rejected | Returns 422 | API |
| GAME-08 | Session with negative duration rejected | Returns 422 | API |
| GAME-09 | Session with unknown `subject_id` rejected | Returns 422 or 400 | API |
| GAME-10 | GET /animals returns correct collection | Animals list matches `user_animals` rows | API |
| GAME-11 | GET /eggs returns current egg state | Returns `progress`, `capacity`, `animal_id` of pending hatch | API |

---

### 2.3 Streak Logic

| ID | Test name | What it verifies | Level |
|---|---|---|---|
| STREAK-01 | First session — streak becomes 1 | `users.streak = 1` after first-ever session | Unit |
| STREAK-02 | Session on consecutive day — streak increments | Study day N and day N+1 → streak +1 | Unit |
| STREAK-03 | Session on same day (second session) — streak unchanged | Double session on same day doesn't double-count | Unit |
| STREAK-04 | Miss a day — streak resets to 1 | Gap of >24h since last session → streak = 1 | Unit |
| STREAK-05 | Miss exactly 1 day boundary (timezone edge) | Session at 23:59 and next at 00:01 next day counts | Unit |
| STREAK-06 | Streak reflected correctly in GET /stats | `streak` field in stats response matches DB | API |

---

### 2.4 Badge System

| ID | Test name | What it verifies | Level |
|---|---|---|---|
| BADGE-01 | "First session" badge awarded on first session | `user_badges` contains `first_session` | Flow |
| BADGE-02 | "7-day streak" badge awarded on 7th consecutive day | Badge fires exactly on streak = 7, not before | Unit |
| BADGE-03 | "Early bird" badge for session before 7am | Badge awarded when `session_hour < 7` | Unit |
| BADGE-04 | Duplicate badge NOT awarded twice | Second qualifying event doesn't create second `user_badges` row | Unit |
| BADGE-05 | Badge coins bonus credited | If badge carries coin reward, `users.coins` increases | Unit |
| BADGE-06 | Badge included in POST /sessions response | `new_badges` list non-empty when badge qualifies | API |
| BADGE-07 | GET /badges returns all earned + locked | All 50+ badges returned; `earned: true/false` per badge | API |
| BADGE-08 | "First 100 users" badge — only fires for user_id ≤ 100 | User 101 does not receive badge | Unit |

---

### 2.5 Social — Friends, Groups, Feed, Leaderboard

| ID | Test name | What it verifies | Level |
|---|---|---|---|
| SOCIAL-01 | Send friend request | `friendships` row created with `status=pending` | API |
| SOCIAL-02 | Accept friend request | Row updates to `status=accepted` | API |
| SOCIAL-03 | Reject friend request | Row deleted or `status=rejected` | API |
| SOCIAL-04 | Cannot send duplicate friend request | Second request returns 409 or 400 | API |
| SOCIAL-05 | Cannot befriend yourself | Returns 400 | API |
| SOCIAL-06 | GET /friends returns only accepted friends | Pending requests not included in friends list | API |
| SOCIAL-07 | Friend request sends push notification | Push service called with `push_friend_request` template (mocked) | Flow |
| SOCIAL-08 | Friend accept sends push notification | Push service called with `push_friend_accepted` template (mocked) | Flow |
| SOCIAL-09 | Create study group | `study_groups` row created, creator added as member | API |
| SOCIAL-10 | Post group message | `group_messages` row created, visible to members | API |
| SOCIAL-11 | Non-member cannot read group messages | Returns 403 | API |
| SOCIAL-12 | Activity feed shows friend's session | After friend completes session, it appears in user's `/feed` | Flow |
| SOCIAL-13 | React to feed item | `feed_reactions` row created | API |
| SOCIAL-14 | Leaderboard ordered by study minutes | Top user has highest `total_minutes` | API |
| SOCIAL-15 | Leaderboard scoped to friends (not global) | Only accepted friends appear in friends leaderboard | API |
| SOCIAL-16 | Block user — blocked user disappears from feed | Blocked user's activity no longer visible | API |

---

### 2.6 Study Tips

| ID | Test name | What it verifies | Level |
|---|---|---|---|
| TIPS-01 | GET /tips returns paginated list | Returns correct page size and `next` cursor | API |
| TIPS-02 | POST /tips/{id}/view records view | `tip_views` row created; view_count increments | API |
| TIPS-03 | POST /tips/{id}/like records like | like_count increments | API |
| TIPS-04 | POST /tips/{id}/save records save | `saved=true` on tip_views row | API |
| TIPS-05 | POST /tips/{id}/unsave removes save | `saved=false` | API |
| TIPS-06 | GET /tips response includes `saved_tip_ids` for auth user | Saved IDs hydrated correctly | API |
| TIPS-07 | Double-view doesn't create duplicate row | Second view on same tip updates existing row | API |
| TIPS-08 | Unauthenticated user can view tips | GET /tips without token returns 200 | API |

---

### 2.7 Donations

| ID | Test name | What it verifies | Level |
|---|---|---|---|
| DON-01 | Every.org webhook creates donation row | Valid webhook payload → `donations` row with correct `user_id` and `amount` | API |
| DON-02 | Webhook with invalid token rejected | Wrong `EVERY_ORG_WEBHOOK_TOKEN` → 403 | API |
| DON-03 | `partner_donation_id` user extraction | `endura-u249-1234567` correctly extracts `user_id=249` | Unit |
| DON-04 | Donation thank-you push sent | `push_donation_thank_you` template dispatched (mocked) | Flow |
| DON-05 | Donation leaderboard orders by total amount | Top donor has highest cumulative `amount` | API |
| DON-06 | GET /stats reflects updated donation total | `total_donated` in stats response matches DB | API |

---

### 2.8 Push Notifications

| ID | Test name | What it verifies | Level |
|---|---|---|---|
| PUSH-01 | PUT /users/me/push-token registers token | `users.push_token` and `push_platform` updated | API |
| PUSH-02 | DELETE /users/me/push-token clears token | `users.push_token = NULL` | API |
| PUSH-03 | GET /users/me/notification-prefs returns all 5 fields | All pref booleans returned | API |
| PUSH-04 | PUT /users/me/notification-prefs updates correctly | Updated prefs persisted | API |
| PUSH-05 | `send_to_user` — skips if no push_token | No Expo API call when token is NULL (mocked) | Unit |
| PUSH-06 | `send_to_user` — skips if `notification_enabled=False` | Master switch respected | Unit |
| PUSH-07 | `send_to_user` — skips if category pref is False | E.g. `notif_badges_enabled=False` suppresses badge push | Unit |
| PUSH-08 | Dead token (`DeviceNotRegistered`) clears token | After Expo returns error, `users.push_token = NULL` | Unit |
| PUSH-09 | `send_template_to_user` renders variables | `{name}` in template body replaced with actual user name | Unit |
| PUSH-10 | Lifecycle cron deduplication — same template only fires once per user | Second run of cron doesn't resend day-1 push | Flow |
| PUSH-11 | Lifecycle cron respects registration date — Day 1 only for users registered yesterday | User registered today doesn't get day-1 push yet | Flow |
| PUSH-12 | Broadcast respects Expo's 100-message batch cap | 250 users → 3 batches sent (mocked Expo client) | Unit |
| PUSH-13 | Badge earned fires push | After session that awards badge, push service called (mocked) | Flow |

---

### 2.9 User Profile & Stats

| ID | Test name | What it verifies | Level |
|---|---|---|---|
| STATS-01 | GET /stats returns all expected fields | `streak`, `coins`, `total_minutes`, `animals_count`, `badges_count`, `total_donated` present | API |
| STATS-02 | Stats reflect sessions correctly | `total_minutes` matches sum of `study_sessions.duration_minutes` | Flow |
| STATS-03 | PATCH /users/me updates username | Username updated; returned in GET /users/me | API |
| STATS-04 | Username with profanity rejected | Content filter returns 400 | API |
| STATS-05 | Duplicate username rejected | Returns 409 | API |
| STATS-06 | GET /users/me returns correct profile | All profile fields present | API |
| STATS-07 | Profile picture upload | PUT /users/me/avatar stores URL, visible in GET /users/me | API |

---

### 2.10 Content Moderation

| ID | Test name | What it verifies | Level |
|---|---|---|---|
| MOD-01 | POST /reports — user reports content | `content_reports` row created | API |
| MOD-02 | POST /blocks/{user_id} — blocks user | `user_blocks` row created | API |
| MOD-03 | Blocked user not visible in friends search | GET /users/search omits blocked users | API |
| MOD-04 | Content filter catches profanity | `content_filter.is_clean()` returns False on test string | Unit |
| MOD-05 | Content filter passes clean content | Returns True on normal text | Unit |

---

### 2.11 Scheduled Jobs (Cron)

| ID | Test name | What it verifies | Level |
|---|---|---|---|
| CRON-01 | Email cron — day-1 email sent to eligible users | Users with `email_verified_at` set yesterday and no session get day-1 email (mocked Resend) | Unit |
| CRON-02 | Email cron — dedup (already sent template not resent) | `email_logs` check prevents double-send | Unit |
| CRON-03 | Push cron — lifecycle sends fire for correct cohort | Right users targeted per day offset from registration | Unit |
| CRON-04 | Push cron — re-engagement for 3-day quiet users | Users with last session >3 days ago targeted | Unit |
| CRON-05 | App ranks cron — upserts correctly | Duplicate `(date, country, category)` row updated, not duplicated | Unit |

---

### 2.12 Admin Endpoints

| ID | Test name | What it verifies | Level |
|---|---|---|---|
| ADMIN-01 | GET /admin/overview — returns KPIs | All expected fields present and numeric | API |
| ADMIN-02 | GET /admin/users — returns paginated list | `users`, `total`, `page` fields present | API |
| ADMIN-03 | GET /admin/feedback — filters by status | Only `status=new` items returned when filtered | API |
| ADMIN-04 | PATCH /admin/feedback/{id} — updates status | Status change persisted | API |
| ADMIN-05 | POST /admin/cleanup-countries dry_run | Returns changes without mutating DB | API |
| ADMIN-06 | POST /admin/schools/cleanup dry_run | Returns merge candidates without mutating DB | API |
| ADMIN-07 | Admin endpoints without key → 403 | All admin routes reject missing key | API |
| ADMIN-08 | GET /admin/push-templates returns all templates | All seeded templates returned | API |
| ADMIN-09 | PATCH /admin/push-templates/{id} updates copy | Template body change persisted | API |

---

### 2.13 Frontend — API Service (`api.ts`)

| ID | Test name | What it verifies | Level |
|---|---|---|---|
| FE-API-01 | `login()` attaches no auth header | Public call goes without Bearer token | Service |
| FE-API-02 | `getSessions()` attaches JWT header | Bearer token from SecureStore added to request | Service |
| FE-API-03 | 401 response triggers logout | Auth error clears stored token | Service |
| FE-API-04 | Network error returns typed error object | `ApiError` type surfaced, not raw exception | Service |
| FE-API-05 | `postSession()` sends correct payload shape | `{ duration_minutes, subject_id }` matches API contract | Service |
| FE-API-06 | `registerPushToken()` sends platform field | `{ token, platform }` sent correctly | Service |

---

### 2.14 Frontend — Components

| ID | Test name | What it verifies | Level |
|---|---|---|---|
| FE-COMP-01 | `AuthScreen` renders login form by default | Email, password fields and "Sign In" button visible | Component |
| FE-COMP-02 | `AuthScreen` toggles to register | "Create Account" button switches to registration form | Component |
| FE-COMP-03 | `AuthScreen` shows error on failed login | Error message rendered after API mock returns 401 | Component |
| FE-COMP-04 | `AuthScreen` loading state during API call | Button disabled + spinner visible while request in-flight | Component |
| FE-COMP-05 | `TimerScreen` starts timer on press | Timer display changes from "25:00" after start tap | Component |
| FE-COMP-06 | `TimerScreen` validates minimum duration | Minimum duration enforced before start | Component |
| FE-COMP-07 | `HomeScreen` renders egg progress ring | Progress ring component present with correct props | Component |
| FE-COMP-08 | `HomeScreen` renders stats pills | Streak, animals, badges, time pills all visible | Component |
| FE-COMP-09 | `OnboardingScreen` blocks advance without username | Next button disabled on slide requiring username | Component |
| FE-COMP-10 | `OnboardingScreen` progresses through all slides | Can swipe/next through all slides to completion | Component |

---

### 2.15 End-to-End Flows (Critical Regression Suite)

These are the tests we care most about. Each covers a full user journey through the real API.

| ID | Flow name | Steps | Pass criteria |
|---|---|---|---|
| FLOW-01 | **Full onboarding → first session → hatch** | Register → set username/country → POST session (large enough to fill egg) → verify hatch | `user_animals` row created; correct response shape |
| FLOW-02 | **Streak build and break** | Register → POST session today (streak=1) → POST session tomorrow (streak=2) → skip day → POST session day after (streak=1) | Streak integers correct at each step |
| FLOW-03 | **Friend social loop** | User A and B register → A requests B → B accepts → A posts session → B sees in feed → B reacts | All rows created; push mocks called |
| FLOW-04 | **Badge ladder** | Register → POST sessions until "7-day streak" criteria met (using `freezegun`) → verify badge in response and DB | Badge awarded exactly once on day 7 |
| FLOW-05 | **Donation attribution** | Register → simulate Every.org webhook with correct `partner_donation_id` → GET /stats shows donation total | `donations` row with correct user_id; stats updated |
| FLOW-06 | **Push opt-out respected** | Register with token → set `notif_badges_enabled=False` → earn badge → verify push NOT sent | Push mock not called for badge event |
| FLOW-07 | **Admin triage flow** | Submit feedback → admin lists (with key) → admin updates status → feedback reflects new status | Status persisted; unauthenticated admin request rejected |
| FLOW-08 | **Session with study group** | Create group → add member → both members post sessions → leaderboard shows group scores | Group leaderboard reflects sessions |

---

## Part 3 — Pre-Push Checklist

Before every build (backend deploy or TestFlight trigger), run through this list:

### Automated (must pass)
```
./scripts/test.sh
```
- [ ] All backend pytest tests pass
- [ ] Frontend Jest tests pass
- [ ] Coverage meets minimums (see §1.8)

### Manual smoke tests (5 minutes, on TestFlight device)

- [ ] **Auth** — Can sign up with a new email, receive verification, and log in
- [ ] **Timer** — Can start, pause, and end a 1-minute session (use dev test timer)
- [ ] **Egg progress** — Coins and egg progress update after session
- [ ] **Push** — Receive at least one push notification (use admin "Send test to user")
- [ ] **Friends** — Can search for a test user and send a friend request
- [ ] **App does not crash** on cold launch, navigation through all 5 tab screens

---

## Part 4 — Implementation Roadmap

> Once you review and approve this document, here is the suggested build order.

| Phase | Work | Effort |
|---|---|---|
| **Phase 1** | Backend test harness setup (pytest config, SQLite override, factory fixtures, mock patches) | 2–3 hrs |
| **Phase 2** | AUTH + GAME + STREAK + BADGE unit and API tests (the core — ~50 test cases) | 3–4 hrs |
| **Phase 3** | SOCIAL + TIPS + DONATIONS + PUSH API and flow tests (~40 test cases) | 3–4 hrs |
| **Phase 4** | ADMIN + CRON + STATS tests (~25 test cases) | 2 hrs |
| **Phase 5** | Frontend Jest setup + API service tests + component tests (~20 test cases) | 2–3 hrs |
| **Phase 6** | `scripts/test.sh` pre-push gate + CI integration + README | 1 hr |
| **Phase 7** | E2E Maestro flows (optional, post-approval) | 4–6 hrs |

**Total estimated effort (Phases 1–6):** ~14–17 hrs
**Expected test count at completion:** ~135 automated tests + 6 manual smoke checks

---

## Approval

- [ ] Test strategy approved
- [ ] Test plan scope approved (add/remove test cases as needed above)
- [ ] Coverage targets accepted
- [ ] Tool choices accepted (pytest, jest-expo, Maestro for E2E)
- [ ] Pre-push gate script agreed
- [ ] Implementation phase order agreed
- [ ] **Go → build the test harness and write the tests**
