# Endura — How It All Works (v2)

> **Who this is for:** anyone who wants to understand how Endura is built, even if you've only written a bit of code.
> **How to read it:** the first half (The Big Picture) uses plain English. The second half (Deep Dive) has the technical details if you want to go further.
> **Companion doc:** `ARCHITECTURE.md` is the original snapshot from launch — kept for history. This file is the up-to-date version.
> Last refreshed: April 2026, after the Build 15 TestFlight.

---

# Part 1 — The Big Picture

## What is Endura?

Endura is a mobile app that turns studying into a game where the reward is helping endangered animals. You start a timer, you study, and when you finish, you earn "eco-credits" (in-game coins). Those credits fill up an egg. When the egg is full, it hatches into a random endangered animal — a panda, a snow leopard, a sea turtle — which joins your personal sanctuary. You can also donate real money through the app, which goes to WWF via a partner called Every.org. There's a social side too: friends, study groups, leaderboards, and a feed where you can cheer each other on.

So if you boil it down, Endura is three things stacked:

1. A **productivity tool** (timer, to-do list, streaks)
2. A **collectible game** (hatch animals, earn badges, decorate your sanctuary)
3. A **social + purpose layer** (friends, donations, leaderboards)

That combination is the whole point: we want the act of studying to feel rewarding *right now* (game loop) and meaningful *in the long run* (conservation).

## The three things that make Endura work

If you imagine Endura as a restaurant, here are the three buildings it needs:

### 1. The mobile app — the dining room
This is what users see. It runs on your iPhone or Android phone. It's what you tap, swipe, and scroll. It has screens like Home, Timer, Sanctuary, Progress, and Friends. It's written in **React Native**, which is a way to build mobile apps using the same language (JavaScript) as websites.

### 2. The backend — the kitchen
This is the server. You never see it directly, but it's doing all the real work behind the scenes: remembering your account, saving your study sessions, picking which animal your egg hatches into, telling your friends what you did. It's written in **Python** using a framework called **FastAPI**. It's hosted on a service called **Railway**.

### 3. The marketing website — the storefront
This is `endura.eco`. It's the page you land on if someone links you to the app. It describes what Endura does, shows some app screenshots, and has a "Download" button. It's written in **Next.js** (React for websites) and hosted on **Vercel**.

There's also a fourth piece tucked inside the website: the **admin dashboard**. It lives at a hidden URL and only we can log in. It's where we look at user counts, charts, feedback, and run maintenance tasks like cleaning up messy country data.

## Follow one tap: what happens when a user finishes a study session?

Let's trace exactly what happens when a user hits "End Session" after studying for 25 minutes:

```
1. User taps "End Session" in the mobile app (TimerScreen)
          │
          ▼
2. The app sends a small JSON package over the internet to the backend:
   POST /sessions  { duration_minutes: 25, subject_id: 3 }
          │
          ▼
3. The backend checks who's asking (JWT token in the request proves identity)
          │
          ▼
4. The backend writes a row into the PostgreSQL database:
   study_sessions { user_id: 249, duration: 25, subject: "Math", ended_at: ... }
          │
          ▼
5. The backend then does FOUR things in a row:
     a) Adds eco-credits to the user's egg
     b) Updates their study streak (did they study yesterday?)
     c) Checks if they unlocked any new badges
     d) If the egg is full, hatches a random animal into their collection
          │
          ▼
6. The backend returns a JSON response summarising what happened:
   { minutes: 25, coins_earned: 15, streak: 7, new_badges: ["first_week"], egg_full: true }
          │
          ▼
7. The mobile app reads that response and shows the user the good news
   (toast notification, confetti, badge unlock screen, etc.)
          │
          ▼
8. In parallel, the app tells PostHog (our analytics tool):
   "User 249 finished a 25-minute session"
```

That's the full cycle. One tap, roughly 300 milliseconds on a good connection, and 4–6 things happen across 3 different computers.

## What's actually stored in the database?

The database is where we remember everything. It's called **PostgreSQL** and it's organised into "tables" — think of each one as a spreadsheet. We have **31 tables** right now. Here are the most important ones grouped by purpose:

**The user and what they're doing**
- `users` — accounts: email, name, password hash, streak, coins, country, school
- `study_sessions` — every completed timer session
- `tasks` — to-do items
- `user_subjects` + `subjects` — what subjects they're studying

**The game loop**
- `animals` — the master list of 30 endangered species
- `user_animals` — which animals each user has hatched
- `eggs` — the one egg each user is currently incubating
- `shared_eggs` — eggs shared between two friends for collaborative hatching
- `user_badges` — which badges each user has earned (out of 50+)
- `shop_items` + `user_purchases` + `user_item_assignments` — sanctuary decorations

**Social**
- `friendships` — pending and accepted friend connections
- `study_groups` + `group_members` + `group_messages` — group rooms and chat
- `activity_events` + `feed_reactions` — the feed where you see friends' activity and react

**Content + community**
- `study_tips` + `tip_views` — community-contributed study tips, plus views/likes/saves
- `content_reports` + `user_blocks` — moderation (flagging and blocking)
- `user_feedback` + `feedback_upvotes` — bug reports and feature requests from users

**Conservation + donations**
- `donations` — real donations made through Every.org

**Communications + ops**
- `email_templates` + `email_logs` — the onboarding email sequence
- `android_beta_signups` — waitlist from the website
- `uploads` — profile pictures etc.
- `schools` — autocomplete list of universities/colleges
- `app_ranks` — daily snapshot of our App Store chart position (for tracking growth)

## The life of a new user

Here's what happens when someone downloads Endura and signs up:

```
Open app for first time
       │
       ▼
Tap "Sign up" → enter email + password → verification email sent via Resend
       │
       ▼
Confirm email → land on Onboarding (pick a username, country, school)
       │
       ▼
See a 6-slide walkthrough explaining timer / animals / friends
       │
       ▼
Arrive on Home screen with an empty egg and a "Start studying" prompt
       │
       ▼
Backend triggers "onboarding_started" event to PostHog + schedules Day 1 email
       │
       ▼
(If they complete a session) → coins earned → badge check fires → feed event posted
       │
       ▼
Friends discovery: they can search for usernames or browse leaderboards
       │
       ▼
Every day they study, cron jobs in the backend keep streaks, emails, and stats in sync
```

The whole flow is instrumented with PostHog events so we can see exactly where users drop off — the biggest "cliff" right now is the moment between verifying their email and starting their first timer. That's what Build 16 is about.

## How we deploy new code

When we save new code and push it to GitHub:

```
    git push (from my laptop)
         │
         ▼
      GitHub
     /   │   \
    /    │    \
   ▼     ▼     ▼
Railway Vercel  EAS
(backend) (site) (mobile, manual trigger)
   │      │        │
   ▼      ▼        ▼
 Live    Live    TestFlight → App Store
 API    Website
```

- **Backend** → Railway auto-builds a Docker image and swaps it in (~2 minutes).
- **Website + admin dashboard** → Vercel auto-deploys (~1 minute).
- **Mobile app** → We have to manually trigger a new build with `eas build`, then submit it to Apple/Google. It takes hours to days depending on review queues.

## The third-party services we rely on

Endura doesn't build everything from scratch. Here's what we rent from other companies and why:

| Service | What it does | Why not build it ourselves |
|---|---|---|
| **Railway** | Hosts the backend + PostgreSQL | We'd need to manage servers, backups, scaling |
| **Vercel** | Hosts the marketing site + admin dashboard | Free tier, instant deploys, CDN |
| **Expo (EAS)** | Builds the mobile app | Apple/Google build toolchains are nightmarish |
| **Resend** | Sends transactional emails (verification, onboarding) | Hitting Gmail/Apple inboxes reliably is a specialty |
| **PostHog** | Product analytics (events, funnels, heatmaps) | Same reason — specialty tool |
| **Every.org** | Processes donations to WWF | Avoids PCI compliance, handles tax receipts |
| **AppFigures** | Reports our App Store chart position | Official Apple/Google APIs are clunky |
| **Stripe** (via Every.org) | Processes payment cards | PCI compliance; we never see card numbers |

## How we see what users are doing

Two different tools, used for different reasons:

**PostHog** (event-based — "did user 249 tap the timer?")
- Every screen view, button tap, and important action gets sent as a PostHog event.
- We use it to see funnels (100 users start onboarding, 44 complete it, 22 start a timer, …) and spot friction.
- The data is pulled live into our admin dashboard via a secure server-side proxy.

**Our own database** (state-based — "how many sessions has user 249 completed?")
- The backend is the source of truth for things we *need* to be right: streaks, coins, donations.
- The admin dashboard reads from the database for all the "official" numbers.

These two sources sometimes disagree for good reasons — e.g., PostHog might say a user opened the app 10 times today, while the database only shows 1 study session. That's how we spot the difference between "active" and "productive" users.

## Security and privacy in one paragraph

Passwords are hashed with **bcrypt** before being stored — we literally cannot see a user's password. Login gives back a **JWT token** that lives on the user's device in encrypted storage (`expo-secure-store`). All traffic between the app and backend is HTTPS. Admin endpoints are gated by an API key we keep in a Railway environment variable. We don't store credit card info — Every.org + Stripe handle that. The backend strips stack traces from error messages before sending them back, so users never see "server is broken" details. The database has automated daily backups via Railway Pro. More detail is in `SECURITY.md` and `docs/backup-strategy.md`.

---

# Part 2 — Deep Dive

Everything below gets more technical. Read the sections that interest you.

## Backend (FastAPI) in detail

### The file layout

```
backend/
├── main.py           # All 100+ API endpoints, scheduler, startup logic
├── models.py         # 31 SQLAlchemy ORM classes (the database schema)
├── schemas.py        # Pydantic request/response shapes (validation)
├── crud.py           # Database query helpers, badge logic, leaderboards
├── auth.py           # JWT encode/decode, password hashing, get_current_user
├── database.py       # SQLAlchemy engine + session factory
├── content_filter.py # Profanity filter for user-generated content
├── alembic/          # Database migration history (13 versioned files)
├── scripts/          # One-off maintenance scripts (backfills, rebuilds)
│   ├── backfill_tip_views.py     # Hydrate tip_views from PostHog history
│   ├── backfill_tip_saves.py     # Hydrate tip_saves when Phase 1 launched
│   └── backfill_app_ranks.py     # Import historical AppFigures data
└── requirements.txt  # Python dependencies
```

### The endpoint surface

There are currently **125 routes** on the live backend, split roughly:

- ~84 **public** routes (auth, sessions, animals, tips, friends, donations, etc.)
- ~41 **admin** routes (dashboard data, cleanup, triage, email management, etc.)

Public routes are called by the mobile app. Admin routes are called only by the admin dashboard and are protected by the `X-Admin-Key` header.

### Scheduled jobs (APScheduler)

The backend runs an in-process scheduler that wakes up daily:

| Time (UTC) | Job | What it does |
|---|---|---|
| 04:00 | `_cron_sync_app_ranks` | Pulls yesterday + today's App Store chart position from AppFigures, upserts into `app_ranks` |
| 08:00 | `_cron_run_onboarding_emails` | Loops over users at key milestones (email verified, day 1 inactive, etc.) and sends the right template via Resend |

Both run in the same process as the API (via `BackgroundScheduler`), which is fine at our scale. If we grew, we'd move to a separate worker service.

### Database migrations

Originally we did inline `ALTER TABLE` checks at startup (the "SQLAlchemy inline migration" pattern described in the old architecture doc). We migrated to **Alembic** because:

- It gives us a linear, auditable history of every schema change
- Every deploy can be reverted safely (`alembic downgrade -1`)
- Multiple devs working on the same DB can resolve migration conflicts with a merge

To run migrations: `alembic upgrade head` inside the Railway container (via `railway ssh`). The startup logic still has a few defensive `ALTER TABLE IF NOT EXISTS`-style checks for rare columns that predate Alembic, but anything new goes through Alembic.

### Authentication flow

1. User registers → password hashed with bcrypt (cost factor 12) → stored in `users.password_hash`
2. User logs in → backend verifies password → issues a JWT signed with `SECRET_KEY` (from env var)
3. JWT payload: `{ sub: user_id, exp: 7 days from now }`
4. Mobile app stores the JWT in `expo-secure-store` (iOS Keychain / Android Keystore)
5. Every subsequent request includes `Authorization: Bearer <jwt>` header
6. `get_current_user()` dependency decodes and validates on every protected endpoint

There's also `get_optional_user()` which doesn't raise if no token is present — used by endpoints like `/tips` that have both public and logged-in behaviour.

### PostHog proxy (security-sensitive)

The admin dashboard used to hold the PostHog personal API key in browser `localStorage`. We moved it server-side:

- `POSTHOG_PERSONAL_API_KEY` lives in Railway env vars only
- The admin dashboard calls `POST /admin/posthog/query` with a HogQL query
- The backend attaches the API key and forwards to PostHog's `/api/projects/:id/query/`
- The response streams back to the dashboard

This means the key never touches a user's browser, and rotating it is a one-line Railway env var change.

### The cleanup endpoints (data quality)

Free-text fields in the `users` table (country, school) get messy fast. We have two cleanup endpoints that run on-demand:

**`POST /admin/cleanup-countries`**
- Applies a static `COUNTRY_CLEANUP_MAP` (typos, abbreviations, local-language spellings → canonical name)
- Treats anything not in the ISO-canonical `VALID_COUNTRY_NAMES` set as "suspect"
- Pulls live `$geoip_country_name` from PostHog (authoritative — it comes from the MaxMind GeoIP DB the user's device surfaced)
- For every user: either overwrites suspect values with PostHog data, or clears them to NULL if we have nothing
- Returns a detailed breakdown (map_changes, backfilled_blanks, overwritten_junk, cleared_unverifiable)

**`POST /admin/schools/cleanup`**
- Same country normalisation for the `schools.country` column
- Groups schools by `(normalized_name, country)` and merges duplicates
- Picks the canonical row by "most complete metadata" (city + region filled beats bare name)
- Renames any `users.school` string references to the canonical name
- Supports `dry_run=true` to preview before committing

Both are exposed as buttons in the admin dashboard with confirmation + preview flows.

## Frontend (React Native) in detail

### Navigation tree

```
Root Stack
├── AuthScreen                      (unauthenticated)
├── OnboardingScreen                (first-time setup)
└── Main Stack
    ├── Bottom Tabs
    │   ├── Home        → HomeScreen
    │   ├── Timer       → TimerScreen          (custom pulsing tab button)
    │   ├── Sanctuary   → CollectionScreen
    │   ├── Progress    → ProgressScreen
    │   └── Friends     → SocialScreen
    └── Modal Screens
        ├── TipsScreen
        ├── TakeActionScreen
        ├── ProfileScreen
        ├── ShopScreen
        └── BadgesScreen           (new since v1)
```

### Screens at a glance

| Screen | What a user sees | Notes |
|---|---|---|
| `HomeScreen` | Egg progress ring, to-do list, recent hatches, stat pills (streak/animals/badges/time) | Stat pills are tappable → open detail modals |
| `TimerScreen` | 5–60 min timer, subject picker, start/pause/end | Session completion triggers the backend `/sessions` flow |
| `CollectionScreen` | Sanctuary habitat preview, animal grid, Take Action CTA, Conservation Champions | Detail modals show species info + let users nickname animals |
| `ProgressScreen` | Stats overview, badge collection, bar charts by weekday, subject breakdown | Pulls from `/stats` |
| `SocialScreen` | Tabbed: Friends list, Leaderboard, Groups (with chat), Feed | Feed reactions use `/feed/{id}/react` |
| `TipsScreen` | Swipeable Tinder-style card feed | Views/likes/saves tracked both in DB and PostHog |
| `TakeActionScreen` | Donation flow, endangered species stories, community stats | Links out to Every.org for the actual checkout |
| `ProfileScreen` | Profile header, donation impact, friends, logout | Also shows nested leaderboards |
| `ShopScreen` | Spend eco-credits on decorations | Purchases land in `user_purchases` |
| `BadgesScreen` | Full 50+ badge grid, earned vs locked | New since v1 — dedicated screen for badge collection |
| `OnboardingScreen` | 6-slide walkthrough + username/country/school setup | Deeply instrumented in PostHog (9 events) |

### Services

| File | Role |
|---|---|
| `services/api.ts` | Typed API client. Handles JWT, attaches headers, exposes every endpoint as a typed function. |
| `services/analytics.ts` | PostHog wrapper. `Analytics.track('session_completed', { minutes })` etc. Includes screen-view auto-tracking. |
| `services/pushNotifications.ts` | Expo push token registration, local notification helpers, permission prompts. |

### Contexts

| Context | Role |
|---|---|
| `AuthContext` | User state + login/register/logout. Persists JWT in `expo-secure-store` and profile pic in `AsyncStorage`. Provides `refreshUser()`. |
| `NotificationContext` | In-app toast queue. `success()`, `celebration()`, `badgeEarned()`, `info()`, `warning()`. Drives the animated `InAppNotification` component. |

### Theme

Defined in `theme/colors.ts`. Ocean-sage palette:

- Primary: `#5F8C87` (Ocean Sage)
- Background: `#E7EFEA` (Mist Sage)
- Animal rarity: green (common) → blue (rare) → purple (epic) → gold (legendary)
- Typography: DM Sans, loaded via `@expo-google-fonts/dm-sans` at app boot

## Admin dashboard in detail

Lives at `website/public/dashboard-e9x2k/index.html` (served as a static file by the Next.js site). It's a single HTML file with vanilla JS + Chart.js — no build step, ~5,000 lines.

**Why single HTML:** it's internal-only, deploys with the website, and has zero dependency on the mobile app's release cycle. Easy to iterate on.

**Pages:**

- **Overview** — headline KPIs, 7 time-series charts, funnel, Daily/Weekly toggle
- **Users** — sortable table with filters, detail modal, verified/friends/groups/country columns, Cleanup Countries + Cleanup Schools buttons
- **Activity** — recent signups, study sessions, donations (live feed)
- **Subjects Audit** — dedupe view for user-created subjects (read-only Phase 1)
- **Geography** — country + school distributions with maps
- **Feedback** — triage UI for user bug reports + feature requests (KPIs, filters, detail modal with status/priority)
- **Tips** — tip library with engagement metrics
- **Email Templates** — edit + preview the transactional email sequence
- **Charts** — App Store rankings timeline (from AppFigures)
- **Founding Members** — audit the first-100 program

**Auth:** the dashboard calls the backend with an `X-Admin-Key` header. The key is entered once on login and kept in the page's JS closure — **not** in `localStorage` anymore.

## Website (Next.js) in detail

**Stack:** Next.js 16 (App Router) + Tailwind 4 + Framer Motion + Leaflet (for the schools map).

**Pages:**
- `/` — the main landing page, composed from section components
- `/dashboard-e9x2k/` — the static admin dashboard file
- `/privacy`, `/terms`, `/charity` — legal + mission pages

**Components that assemble the landing page:**
- `Hero`, `Features`, `AppGallery` (7 phone mockups), `HowItWorks`, `Mission`, `Founder`, `Navbar`, `Footer`

**Deployed on:** Vercel at `endura.eco`.

## Data flow examples

### "Donate" flow (externally-initiated, harder than it looks)

1. User taps "Donate" on `TakeActionScreen`, picks amount
2. App opens browser to Every.org checkout, passing `partner_donation_id=endura-u{user_id}-{timestamp}`
3. User completes checkout on Every.org (Stripe under the hood)
4. Every.org fires `POST /webhook/every-org` on our backend
5. Backend parses the `partner_donation_id`, extracts the user_id, inserts a row into `donations`
6. Next time the user opens the app, `/stats` returns the updated personal donation total
7. The Conservation Champions leaderboard (`/donations/leaderboard`) now includes their donation

This pattern (encoding user identity in an external partner's reference field) lets us attribute donations without setting up OAuth with Every.org.

### "Badge unlocked" flow (internal, subtle)

1. User completes a study session → `POST /sessions` hits the backend
2. Backend writes the session row, bumps coins and streak
3. Before responding, backend calls `crud.check_badges(user_id, session_hour, session_minutes)`
4. `check_badges` runs ~30 rules (e.g., "completed 7 days in a row", "studied before 7am", "one of first 100 verified users")
5. Any newly qualifying badges are inserted into `user_badges`, coins may be awarded, activity events posted
6. The response payload includes `new_badges: ["early_bird"]`
7. Mobile app sees the new badge list, shows the celebratory unlock modal

## Third-party integrations in detail

### Every.org (donations)

- Webhook endpoint: `POST /webhook/every-org`
- Secret: `EVERY_ORG_WEBHOOK_TOKEN` validates signature
- We record: amount, currency, charge ID, `partner_donation_id` (our user mapping key), donor email
- 94% of the donation passes through to WWF (Every.org's standard cut); the rest covers payment processing
- Tax receipts are issued by Every.org, not us — huge legal burden avoided

### PostHog (analytics)

- Project API key (write-only, safe on mobile): hardcoded in `services/analytics.ts`
- Personal API key (read, sensitive): lives only in Railway env vars (`POSTHOG_PERSONAL_API_KEY`)
- Events: `signup_started`, `email_verified`, `username_set`, `onboarding_completed`, `timer_started`, `session_completed`, `tip_viewed`, `donation_initiated`, etc. (~40 event types)
- Admin dashboard pulls via backend proxy (`POST /admin/posthog/query`) so the admin doesn't touch the personal key

### Resend (transactional email)

- API key: `RESEND_API_KEY` (Railway env)
- Templates stored in DB (`email_templates`) so we can edit them via the admin dashboard without redeploying
- Every send writes to `email_logs` (delivered / opened / clicked, tracked via Resend's `POST /webhooks/resend` endpoint we expose)
- Onboarding sequence: welcome, day 1 (if no session), day 3 "friends matter", day 5 "streak!"

### AppFigures (App Store rankings)

- Personal Access Token: `APPFIGURES_PAT`
- Daily cron at 04:00 UTC pulls yesterday + today's chart positions for our 12 category/country slots
- Stored in `app_ranks` table (one row per `(date, country, category, subtype, device)` tuple)
- Admin dashboard charts show rankings over time

## Infrastructure + environment variables

### Railway (backend + database)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (auto-injected by Railway) |
| `SECRET_KEY` | JWT signing key |
| `ADMIN_API_KEY` | Gate on admin routes (`X-Admin-Key` header check) |
| `POSTHOG_PERSONAL_API_KEY` | For HogQL queries from admin dashboard |
| `RESEND_API_KEY` | Transactional email |
| `APPFIGURES_PAT` | App Store rankings |
| `EVERY_ORG_WEBHOOK_TOKEN` | Validates donation webhook signatures |

### Mobile app (`frontend/`)

- API URL, PostHog project key, Every.org partner ID — hardcoded in source (all safe for client-side)
- Nothing sensitive lives on device beyond the user's own JWT

### Database backups

- **Layer 1:** Railway Pro native backups — enabled, daily PITR with 7-day retention
- **Layer 2 + 3 (offsite encrypted):** deferred until ~1,000 users; full plan in `docs/backup-strategy.md`

## Key design decisions (updated)

1. **Alembic over inline migrations** — made the switch once the schema got past ~20 tables. Linear history beats ad-hoc checks.
2. **Single `main.py`** — still in place. 5,700 lines now, but easier to grep and ship than splitting into routers for a small team.
3. **PostHog backend proxy** — moved the personal API key server-side after it kept vanishing from browser localStorage. Security win + UX win.
4. **Every.org over direct Stripe** — still a great call. Avoids PCI, handles 501(c)(3) paperwork, gives us `partner_donation_id` attribution.
5. **Free-text country field + live PostHog GeoIP cleanup** — users fill in what they want; PostHog's MaxMind data is the source of truth for normalisation.
6. **Admin dashboard as static HTML** — deploys with the website, no build step, iteration speed is great.
7. **Alembic + APScheduler + Resend** — three boring choices that Just Work and let us focus on product.

## What's new since the v1 architecture doc

### New database tables (13 added — from 18 → 31)
- `subjects`, `user_subjects` — harmonised subject list + user custom subjects
- `shared_eggs` — collaborative hatching between friends
- `shop_items`, `user_purchases`, `user_item_assignments` — shop + decoration system
- `uploads` — profile picture + other uploads
- `content_reports`, `user_blocks` — moderation layer
- `android_beta_signups` — website waitlist
- `email_templates`, `email_logs` — DB-backed email sequence
- `schools` — seeded school list for autocomplete
- `app_ranks` — daily App Store chart snapshots
- `user_feedback`, `feedback_upvotes` — bug reports + feature requests + public upvoting

### New capabilities
- **Alembic migrations** (replacing inline checks)
- **APScheduler cron jobs** (onboarding emails, app_ranks sync)
- **Resend integration** (transactional email + open/click tracking webhook)
- **AppFigures integration** (daily App Store rankings)
- **PostHog backend proxy** (personal API key never touches the browser)
- **Admin dashboard** (single-file HTML, 9 pages, ~5,000 lines of JS)
- **Content filter** for user-generated content
- **Country + school data cleanup** using PostHog GeoIP as source of truth
- **Feedback system** (user submissions + admin triage + public voting for features)
- **Tip saves + views backfill** scripts for hydrating historical PostHog events

### New frontend pieces
- `BadgesScreen` — dedicated badge collection
- Onboarding instrumentation (9 PostHog events for funnel measurement)
- Standardised country picker (no more free-text fragmentation)

### Infrastructure changes
- Switched from GitHub user `aseemmunshi` → `phaedrus75` for deploys
- Enabled Railway Pro backups (Layer 1)
- Documented backup strategy for future layers (`docs/backup-strategy.md`)

---

## Where to read more

- `SECURITY.md` — every security control in detail
- `docs/backup-strategy.md` — what we do (and don't) for DB backups
- `docs/build-roadmap.md` — what's being built next
- `docs/onboarding-friction-analysis.md` — why Build 16 exists
- `docs/onboarding-lifecycle.md` — the email + push sequence
- `BADGE_SYSTEM.md` — the 50+ badges and their rules
- `CHARITY_SETUP.md` — how the Every.org integration was set up

If you're new and want to start reading the code, open these in order:
1. `backend/models.py` — the data model tells the product story
2. `backend/main.py` — scroll top-to-bottom, endpoints are grouped
3. `frontend/App.tsx` — the navigation tree
4. `frontend/screens/HomeScreen.tsx` — a typical screen
5. `frontend/services/api.ts` — the contract between mobile and backend

Anything else, ask.
