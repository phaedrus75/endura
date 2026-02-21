# Endura — Architecture Overview

## What is Endura?

Endura is a gamified study app that rewards students with endangered animal collectibles for completing study sessions. It combines productivity tools (timer, tasks, streaks) with conservation awareness (WWF donations, endangered species education) and social features (friends, leaderboards, study groups).

---

## Project Structure

```
endura-v-2/
├── backend/          # FastAPI Python backend (Railway)
├── frontend/         # React Native / Expo mobile app
├── website/          # Next.js marketing website (Vercel)
├── admin/            # Admin dashboard (HTML)
└── docs              # SECURITY.md, BADGE_SYSTEM.md, etc.
```

---

## How It All Works Together

```
┌──────────────┐      HTTPS/JSON       ┌──────────────────┐
│  Mobile App  │ ◄──────────────────►   │  FastAPI Backend  │
│  (Expo/RN)   │                        │  (Railway)        │
└──────────────┘                        └────────┬─────────┘
       │                                         │
       │ PostHog events                          │ SQLAlchemy ORM
       ▼                                         ▼
┌──────────────┐                        ┌──────────────────┐
│   PostHog    │                        │   PostgreSQL     │
│  (Analytics) │                        │   (Railway)      │
└──────────────┘                        └──────────────────┘
                                                 │
                                          Every.org webhook
                                                 │
                                        ┌──────────────────┐
                                        │  Every.org (WWF) │
                                        │  Donation API    │
                                        └──────────────────┘
```

---

## Backend (FastAPI)

### Tech Stack
- **Framework**: FastAPI (Python 3)
- **Database**: PostgreSQL (Railway) / SQLite (dev)
- **ORM**: SQLAlchemy 2.0
- **Auth**: JWT tokens (python-jose) + bcrypt password hashing
- **Hosting**: Railway (`https://web-production-34028.up.railway.app`)

### Key Files

| File | Purpose |
|------|---------|
| `main.py` | All API endpoints, migrations, startup logic |
| `models.py` | SQLAlchemy ORM models (18 tables) |
| `schemas.py` | Pydantic request/response validation |
| `crud.py` | Database queries, badge logic, leaderboard |
| `auth.py` | JWT creation/verification, password hashing |
| `database.py` | DB connection, pooling, SSL config |

### Database Models (18 Tables)

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `users` | User accounts, stats, streaks | Has many: tasks, sessions, animals, badges |
| `tasks` | To-do items | Belongs to user |
| `study_sessions` | Completed study sessions | Belongs to user, optional task |
| `animals` | Master list of 30 endangered species | Referenced by user_animals, eggs |
| `user_animals` | Animals a user has hatched | Belongs to user + animal |
| `eggs` | Current egg being incubated (1 per user) | Belongs to user, linked to next animal |
| `study_tips` | Community study tips (100+ seeded) | Optional user author |
| `tip_views` | Tip interactions (view/like/dislike) | Belongs to user + tip |
| `user_badges` | Earned badges | Belongs to user |
| `friendships` | Friend connections (pending/accepted) | User ↔ User |
| `study_pacts` | 1-on-1 study commitments with wagers | Creator ↔ Buddy |
| `pact_days` | Daily progress within a pact | Belongs to pact + user |
| `study_groups` | Group study rooms | Has many: members, messages |
| `group_members` | Group membership (admin/member) | Belongs to group + user |
| `group_messages` | Group chat messages | Belongs to group + user |
| `activity_events` | Social feed events | Belongs to user, has reactions |
| `feed_reactions` | Reactions on feed events | Belongs to event + user |
| `donations` | Every.org donation records | Belongs to user (linked via partner_donation_id) |

### API Endpoints (40+)

**Authentication** (rate-limited)
- `POST /auth/register` — Create account (5 req/min)
- `POST /auth/login` — Login, returns JWT (10 req/min)
- `GET /auth/me` — Get current user profile
- `POST /user/username` — Set display username

**Tasks**
- `POST /tasks` — Create to-do item
- `GET /tasks` — List tasks (with optional completed filter)
- `PUT /tasks/{id}` — Update task
- `DELETE /tasks/{id}` — Delete task

**Study Sessions**
- `POST /sessions` — Complete a study session (triggers coin earning, streak update, badge checks, possible egg hatch)
- `GET /sessions` — Session history

**Egg & Animals**
- `GET /egg` — Current egg progress (coins deposited vs required)
- `POST /egg/hatch` — Hatch egg → receive random endangered animal
- `GET /animals` — All 30 animal species
- `GET /my-animals` — User's collection
- `PUT /my-animals/{id}/name` — Nickname an animal

**Study Tips**
- `GET /tips` — Tips feed (community + seeded)
- `POST /tips` — Create a tip
- `POST /tips/{id}/vote` — Upvote/downvote
- `POST /tips/send` — Send tip to a friend

**Social**
- `POST /friends/request` — Send friend request
- `POST /friends/accept/{id}` — Accept request
- `GET /friends` — Friends list
- `GET /friends/pending` — Pending requests
- `GET /leaderboard` — Study leaderboard (friends + you)

**Study Pacts & Groups**
- `POST /pacts` — Create 1-on-1 study pact with coin wager
- `POST /groups` — Create study group
- `POST /groups/{id}/join` — Join group
- `GET /groups/{id}/messages` — Group chat

**Activity Feed**
- `GET /feed` — Friends' activity (sessions, hatches, badges)
- `POST /feed/{id}/react` — React to activity (nice, fire, heart, etc.)
- `GET /feed/reactions/new` — Unread reactions

**Donations**
- `POST /webhook/every-org` — Every.org webhook (records donations, links to user)
- `GET /donations/community-stats` — Public: total raised, donor count, recent donations
- `GET /donations/user/{id}` — Personal donation history (authenticated)
- `GET /donations/leaderboard` — Conservation Champions ranking

**Stats & Badges**
- `GET /stats` — Full user statistics (study time, streaks, coins, weekly breakdown by subject)
- `GET /badges` — All 50+ badges with earned status
- `POST /badges/check` — Check for newly earned badges

**Push Notifications**
- `POST /users/{id}/push-token` — Register device token
- `PUT /users/{id}/notification-prefs` — Update preferences
- `POST /notifications/send` — Send push notification

### Security Measures
- JWT with environment-variable secret (no hardcoded fallback)
- 7-day token expiry
- bcrypt password hashing
- Rate limiting on auth endpoints (slowapi)
- Input validation (Pydantic: password strength, field bounds)
- Parameterized SQL queries
- SSL-enforced PostgreSQL connections
- Connection pooling (10 + 20 overflow)
- Sanitized error messages (no stack traces in production)
- No debug/admin endpoints in production
- Push token endpoints protected with ownership checks

### Migrations
Column migrations are handled inline at startup in `main.py`. Each migration checks `information_schema.columns` for existence before running `ALTER TABLE`. This approach avoids Alembic complexity for a small schema.

---

## Frontend (React Native / Expo)

### Tech Stack
- **Framework**: React Native 0.81 + Expo SDK 54
- **Navigation**: React Navigation 7 (bottom tabs + stack)
- **State**: React Context (Auth, Notifications)
- **Auth Storage**: expo-secure-store (JWT tokens)
- **Analytics**: PostHog React Native SDK
- **Animations**: Lottie, React Native Animated API

### Navigation Structure

```
Root Stack
├── AuthScreen (login/register)
├── OnboardingScreen (set username)
└── Main Stack
    ├── Bottom Tabs
    │   ├── 🏠 Home      → HomeScreen
    │   ├── ⏱ Timer      → TimerScreen
    │   ├── 🥚 Sanctuary → CollectionScreen
    │   ├── 🏆 Progress  → ProgressScreen
    │   └── 👥 Friends   → SocialScreen
    └── Modal Screens
        ├── Profile
        ├── Tips
        ├── Shop
        └── TakeAction
```

### Screens

| Screen | Purpose |
|--------|---------|
| `HomeScreen` | Dashboard: egg progress, to-do list, recent hatches, stat pills (streak, animals, badges, study time — each tappable with detail modals) |
| `TimerScreen` | Study timer (5–60 min), subject selection, session completion → coins + animal hatch chance |
| `CollectionScreen` | My Sanctuary (animal habitat preview), Take Action CTA, Conservation Champions, animal grid, detail modals with naming |
| `ProgressScreen` | Stats overview, badge collection, weekly bar charts, subject breakdown |
| `SocialScreen` | 3-tab layout: Buddies (pacts), Groups (chat), Feed (activity + reactions) |
| `TipsScreen` | Swipeable card feed of study tips, vote/share functionality |
| `TakeActionScreen` | Donation flow: amount selector, Every.org integration, personal + community stats, endangered species stories |
| `ProfileScreen` | User info, donation impact card, study leaderboard, Conservation Champions leaderboard, friends list, logout |
| `ShopScreen` | Spend eco-credits on sanctuary decorations |
| `AuthScreen` | Email/password login and registration |
| `OnboardingScreen` | First-time username setup |

### Services

| Service | Purpose |
|---------|---------|
| `api.ts` | Centralized API client with JWT auth (SecureStore), all typed endpoints, request/response interfaces |
| `analytics.ts` | PostHog setup, screen tracking, event tracking (session_completed, todo_created, donation_made, etc.) |
| `pushNotifications.ts` | Expo push token registration, permission handling, local notification helpers |

### Contexts

| Context | Purpose |
|---------|---------|
| `AuthContext` | User authentication state, login/register/logout, profile picture (AsyncStorage), user refresh |
| `NotificationContext` | In-app toast notification queue — `success()`, `celebration()`, `badgeEarned()`, `info()`, `warning()` |

### Components

| Component | Purpose |
|-----------|---------|
| `InAppNotification` | Animated toast component (slide-in from top, auto-dismiss, multiple visual types) |

### Theme
Nature-inspired color palette in `theme/colors.ts`:
- Primary: `#5F8C87` (Ocean Sage)
- Background: `#E7EFEA` (Mist Sage)
- Animal rarity colors: Common (green) → Rare (blue) → Epic (purple) → Legendary (gold)

---

## Website (Next.js)

### Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS 4
- **Animations**: Framer Motion
- **Hosting**: Vercel
- **Domain**: endura.eco

### Pages & Components

| Component | Purpose |
|-----------|---------|
| `page.tsx` | Main landing page (assembles all sections) |
| `Navbar` | Navigation with section links |
| `Hero` | Hero banner |
| `Features` | Feature showcase |
| `AppGallery` | Interactive app screenshots carousel (7 phone mockups) |
| `HowItWorks` | Step-by-step explanation |
| `Founder` | Founder story |
| `Mission` | Mission statement |
| `Footer` | Footer links |

---

## Infrastructure

### Deployment Pipeline

```
Code Push (GitHub)
     │
     ├──► Railway (auto-deploy backend on main push)
     │    └── PostgreSQL database (managed)
     │
     ├──► Vercel (auto-deploy website)
     │    └── endura.eco domain
     │
     └──► EAS Build (manual trigger)
          └── TestFlight → App Store
```

### Environment Variables

**Backend (Railway):**
| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | JWT signing key (required in production) |
| `STRIPE_SECRET_KEY` | Stripe API key |

**Frontend (hardcoded):**
| Variable | Value |
|----------|-------|
| API URL | `https://web-production-34028.up.railway.app` |
| PostHog Key | `phc_qlSNr...` |
| PostHog Host | `https://us.i.posthog.com` |
| Every.org Webhook Token | `9f29c612e6f8` |

---

## Core User Flows

### 1. Study → Earn → Hatch
```
Start Timer → Complete Session → Earn Eco-Credits (coins)
→ Credits deposited into Egg → Egg full → Hatch endangered animal
→ Animal joins Sanctuary collection → Badges may unlock
```

### 2. Donate → Track → Compete
```
Tap "Take Action" → Select amount → Every.org (WWF)
→ Webhook records donation → Linked to user account
→ Personal stats update → Conservation Champions leaderboard
```

### 3. Social Loop
```
Add Friend → See their activity → React with emoji
→ Study Pacts (1v1 commitments with coin wagers)
→ Study Groups (shared goals + group chat)
→ Leaderboard competition (study time, streaks, donations)
```

### 4. Badge Progression
50+ badges across 9 categories:
- Getting Started, Streaks, Study Time, Habits
- Animals, Eco-Credits, Subjects, Sanctuary, Social

---

## Key Design Decisions

1. **SQLAlchemy inline migrations** over Alembic — simpler for a small team, column-existence checks at startup
2. **Every.org for donations** over direct Stripe — no PCI compliance burden, tax receipts handled by Every.org, 94% pass-through to WWF
3. **expo-secure-store for JWT** over AsyncStorage — encrypted on-device storage
4. **PostHog over Mixpanel/Amplitude** — open-source friendly, React Native SDK, autocapture
5. **Single `main.py`** over split routers — faster iteration for a small codebase, all endpoints visible in one file
6. **partner_donation_id encoding** (`endura-u{userId}-{timestamp}`) — links Every.org webhooks back to app users without requiring Every.org account integration
