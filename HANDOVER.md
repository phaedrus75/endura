# Endura — Project Handover & Session State

> Last updated: 7 March 2026
> Backend API version: 1.0.45
> iOS build number: 5

---

## 1. What is Endura?

A gamified study app for iOS (React Native / Expo) where students earn eco-credits by studying, hatch endangered animals, build a virtual sanctuary, and donate to real conservation charities. The core loop: **Study → Earn coins → Hatch animals → Learn about conservation → Donate**.

---

## 2. Mono-repo Structure

```
endura-v-2/
├── frontend/          # React Native (Expo) mobile app
├── backend/           # FastAPI Python backend
├── admin/             # Single-page admin dashboard (index.html)
├── website/           # Next.js 16 + Tailwind marketing site (endura.eco)
├── images/            # Misc project images
├── requirements.txt   # Python deps (used by Railway)
├── railway.toml       # Railway deploy config
├── Procfile           # Heroku-style process file
├── runtime.txt        # Python version
├── .gitignore
└── *.md               # Documentation files
```

---

## 3. Accounts & Credentials

### GitHub
- **Repo**: `https://github.com/phaedrus75/endura.git`
- **Auth**: `gh` CLI authenticated as `phaedrus75` (switch with `gh auth switch --user phaedrus75`)
- **Important**: The `gh` CLI has TWO accounts (`aseemmunshi` and `phaedrus75`). Always verify active account with `gh auth status`. Git pushes use `gh auth git-credential` as the credential helper.

### Expo / EAS
- **Owner**: `phaedrus75`
- **Project ID**: `5fd638be-4053-4859-b3f4-b4b333d42c66`
- **Bundle ID**: `com.endura.study`
- **Apple Team**: `45WAZFV76R` (Aseem Munshi, Individual)
- **Apple ID for submissions**: `munshiaseem@yahoo.com`
- **TestFlight build command**: `cd frontend && eas build --platform ios --profile production --non-interactive`

### Railway (Backend Hosting)
- **URL**: `https://web-production-34028.up.railway.app`
- **Deploy**: Auto-deploys on push to `main` (watches the `backend/` directory)
- **Start command**: `python -m uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Database**: PostgreSQL on Railway (connection string in Railway env vars)

### Railway Environment Variables (set via Railway dashboard)
- `DATABASE_URL` — PostgreSQL connection string
- `SECRET_KEY` — JWT signing key (was updated from hardcoded to env var)
- `ADMIN_API_KEY` — Admin dashboard auth key (default fallback: `endura-admin-2024`)
- `STRIPE_SECRET_KEY` — Stripe API key (optional, for payment intents)

### Vercel (Website)
- **Account**: `phaedrus75` (login with `npx vercel login`)
- **Project**: `website` under `phaedrus75s-projects`
- **Domain**: `www.endura.eco` / `endura.eco`
- **Deploy**: `cd website && npx vercel --prod --yes`
- **Important**: There's also an `aseemmunshi` Vercel account — do NOT use it. The domain is linked to the `phaedrus75` account.

### Every.org (Donations)
- **API Key**: `pk_live_8913a39d0db6790bf98977221209232b` (label: "endura")
- **Webhook URL**: `https://web-production-34028.up.railway.app/webhook/every-org`
- **Fundraising link**: Uses Every.org prefilled donate URLs with `partnerDonationId` for user tracking

### PostHog (Product Analytics)
- **SDK Key** (frontend): `phc_qlSNrffxYPTSRAxQy0gC7q7h4DmhMiScXYwriCiTOtr`
- **Personal API Key** (admin dashboard): Stored in browser localStorage as `phPersonalKey`. Needs scopes: `project:read`, `query:read`, `insight:read`, `person:read`.

---

## 4. Tech Stack

### Frontend (React Native / Expo)
- **Expo SDK**: 54
- **React Native**: 0.81.5
- **Navigation**: `@react-navigation/native` v7 + bottom tab navigator
- **UI**: `expo-linear-gradient`, `lottie-react-native`, custom components
- **State**: React hooks (`useState`, `useEffect`, `useCallback`, `useFocusEffect`)
- **Auth context**: `frontend/contexts/AuthContext.tsx` — JWT auth, profile pic, user state
- **API layer**: `frontend/services/api.ts` — all backend calls
- **Analytics**: `posthog-react-native` — wrapped in `PostHogProvider` in `App.tsx`
- **Storage**: `AsyncStorage` — all keys are user-scoped (e.g., `user_profile_picture_{userId}`)
- **Assets**: `frontend/assets/animals/` (local PNGs), `frontend/assets/shop/` (accessories/decorations PNGs)

### Backend (FastAPI / Python)
- **Framework**: FastAPI
- **ORM**: SQLAlchemy 2.0
- **Database**: PostgreSQL (Railway)
- **Auth**: JWT via `python-jose`, passwords via `passlib` + `bcrypt`
- **Rate limiting**: `slowapi`
- **File**: `backend/main.py` (single file, ~1700 lines — all endpoints)
- **Models**: `backend/models.py` — User, Task, StudySession, Animal, UserAnimal, Egg, StudyTip, TipView, UserBadge, Friendship, StudyPact, PactDay, StudyGroup, GroupMember, GroupMessage, ActivityEvent, FeedReaction, Donation, ShopItem

### Website (Next.js)
- **Framework**: Next.js 16.1.6 (App Router)
- **Styling**: Tailwind CSS 4
- **Animations**: Framer Motion
- **Content**: Single landing page at `website/src/app/page.tsx`
- **Animal images hosted at**: `https://www.endura.eco/animals/{name}.png`

### Admin Dashboard
- **Tech**: Single HTML file (`admin/index.html`) with vanilla JS + Chart.js
- **Run locally**: `cd admin && python3 -m http.server 3002`
- **Auth**: Uses `X-Admin-Key` header against backend's `ADMIN_API_KEY`
- **Features**: Overview KPIs, Users (search + detail), Donations, Content (Animals/Tips/Shop with full CRUD), Activity Feed, PostHog Analytics

---

## 5. App Screens

| Screen | File | Purpose |
|--------|------|---------|
| Auth | `AuthScreen.tsx` | Login/Register |
| Onboarding | `OnboardingScreen.tsx` | 6-step intro (Lottie + body text, no highlight pills) |
| Home | `HomeScreen.tsx` | Lottie animation, recent hatches, to-do list, chips (streak, hours, animals) |
| Timer | `TimerScreen.tsx` | Study timer, egg progress, animal hatching |
| Collection | `CollectionScreen.tsx` | "My Sanctuary" — animal grid, shop item assignments, Take Action, donation leaderboard |
| Shop | `ShopScreen.tsx` | Buy accessories/decorations with eco-credits |
| Tips | `TipsScreen.tsx` | Swipeable study tips feed with like/dislike/share |
| Social | `SocialScreen.tsx` | Friends tab, buddies (leaderboard), groups |
| Progress | `ProgressScreen.tsx` | Weekly + monthly stats charts |
| Profile | `ProfileScreen.tsx` | User profile, donation stats, notification prefs |
| Badges | `BadgesScreen.tsx` | Badge collection (3 per row, scrollable) |
| Take Action | `TakeActionScreen.tsx` | Donation flow via Every.org, community total, recent donations |

---

## 6. Key Design Decisions

### Security — User-Scoped AsyncStorage
All `AsyncStorage` keys are scoped per user ID to prevent data leaking between accounts on the same device:
- `user_profile_picture_{userId}`
- `endura_purchased_items_{userId}`
- `endura_item_assignments_{userId}`
- `unlockedAnimals_{userId}`
- `customSubjects_{userId}`
- `savedTipIds_{userId}`
- `seenTipIds_{userId}`

### Animal Images
- 30 canonical animals with PNGs hosted at `endura.eco/animals/`
- Backend populates `image_url` on startup for animals with matching hosted images
- Frontend has `nameFallbacks` in `frontend/assets/animals/index.ts` to map legacy DB names (e.g., "Gorilla" → "Mountain Gorilla")

### Donation Flow
- Uses Every.org prefilled donate links (not direct API)
- Default donation amount: $0 (user picks their own)
- `partnerDonationId` format: `endura-u{userId}-{timestamp}` for user tracking
- Thank-you popup only shown after webhook confirmation (polls `GET /donations/check/{partnerId}` for up to 30 seconds)
- Webhook endpoint: `POST /webhook/every-org`

### Database Seeding
- `seed_check()` runs on startup
- Only seeds if `animal_count < 30` or `tip_count < 100`
- Shop items seed if `shop_items` table is empty (14 items)
- Image URLs are populated on every startup for animals missing them
- **No automatic dedup/cleanup** — user explicitly decided against this. Manual management via admin dashboard.

### Onboarding
- 6 screens with single `body` text (no highlight pills — user found them cluttered)
- Uses Lottie on first screen, emojis on others
- Gradient backgrounds, "soothing and wholesome" design

---

## 7. Database State (as of last check)

- **Animals**: ~27 in DB (should be 30). 8 missing: Avahi, Gray Bat, Grey Parrot, Grizzly Bear, Mountain Zebra, Pangolin, Seal, Wombat. 5 duplicates exist: Red Panda, Koala, Polar Bear, Amur Leopard, Axolotl. **Needs manual cleanup via admin dashboard.**
- **Study Tips**: 100 seeded tips, each linked to an animal
- **Shop Items**: 14 items (8 accessories, 6 decorations) — seeded from backend
- **Users**: Multiple test accounts including `aseem.munshi@gmail.com` (popsie) and `aseem.munshi+2@gmail.com` (wolf)

---

## 8. Environment Setup on New Machine

### Prerequisites
- Node.js 18+ and npm
- Python 3.11+
- Git
- Xcode (for iOS builds)

### Step 1: Clone & Install

```bash
git clone https://github.com/phaedrus75/endura.git endura-v-2
cd endura-v-2

# Frontend
cd frontend
npm install
cd ..

# Website
cd website
npm install
cd ..

# Backend (for local dev)
cd backend
pip install -r ../requirements.txt
cd ..
```

### Step 2: Authenticate CLI Tools

```bash
# GitHub
gh auth login  # Login as phaedrus75
gh auth switch --user phaedrus75  # If multiple accounts

# Expo / EAS
npm install -g eas-cli
eas login  # Login as phaedrus75

# Vercel
npx vercel login  # Login as phaedrus75 (NOT aseemmunshi)
```

### Step 3: Link Vercel Project

```bash
cd website
npx vercel --prod --yes  # Will auto-link to phaedrus75s-projects/website
```

### Step 4: Run Locally

```bash
# Frontend (Expo)
cd frontend
npx expo start --clear

# Admin Dashboard
cd admin
python3 -m http.server 3002
# Open http://localhost:3002

# Backend (if needed locally — usually just use Railway)
cd backend
DATABASE_URL="..." SECRET_KEY="..." uvicorn main:app --reload --port 8000
```

---

## 9. Common Commands

```bash
# Push code (auto-deploys backend to Railway)
git add . && git commit -m "message" && git push origin main

# TestFlight build
cd frontend && eas build --platform ios --profile production --non-interactive

# Deploy website
cd website && npx vercel --prod --yes

# Check backend health
curl https://web-production-34028.up.railway.app/

# Run admin dashboard
cd admin && python3 -m http.server 3002
```

---

## 10. Pending / Known Issues

### Must Fix
- [ ] **Animal DB cleanup**: 8 missing + 5 duplicate animals. Add/remove manually via admin dashboard (`http://localhost:3002` → Content → Animals).
- [ ] **Badges modal scroll**: User reported scrolling "doesn't work" — needs investigation.

### UI Polish (Requested but may need iteration)
- [ ] Move bottom tab bar up (user said it's too low)
- [ ] Remove light green border above tab bar
- [ ] Monthly progress charts not populating with data
- [ ] Friends section: change "all users" to "friends", kill study pact, move leaderboard to buddies tab
- [ ] Groups tab: show member profile pictures, fix button formatting, make challenge/leaderboard/streak real modals
- [ ] Chip colors on home screen (greeny-white gradients, user went through many iterations)

### Features Discussed but Not Fully Implemented
- [ ] App screenshots in onboarding (user asked about it, needs 5 screenshots)
- [ ] Website app screenshots gallery
- [ ] Profile photo not showing on friend screen

---

## 11. API Endpoints Summary

### Public
- `GET /` — Health check + version
- `GET /animals` — All animals
- `GET /shop/items` — Active shop items
- `GET /donations/community-stats` — Community donation totals
- `GET /donations/check/{partner_id}` — Check if donation confirmed
- `POST /webhook/every-org` — Every.org donation webhook

### Auth Required
- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- `POST /user/username`
- CRUD: `/tasks`, `/sessions`, `/egg`, `/egg/hatch`
- `/my-animals`, `/my-animals/{id}/name`
- `/tips`, `/tips/{id}/view`, `/tips/{id}/vote`
- `/friends/*`, `/leaderboard`, `/stats`
- `/shop/spend`, `/badges`, `/badges/check`
- `/pacts/*`, `/groups/*`
- `/feed`, `/feed/{id}/react`, `/feed/reactions/new`
- `/tips/send`
- `/donations/user/{id}`, `/donations/leaderboard`
- `/users/{id}/push-token`, `/users/{id}/notification-prefs`

### Admin (requires `X-Admin-Key` header)
- `GET /admin/overview` — KPIs
- `GET/POST /admin/users`, `GET /admin/users/{id}`
- `GET /admin/donations`, `GET /admin/sessions`, `GET /admin/activity`
- `GET/POST /admin/animals`, `PUT/DELETE /admin/animals/{id}`
- `GET/POST /admin/tips`, `PUT/DELETE /admin/tips/{id}`
- `GET/POST /admin/shop`, `PUT/DELETE /admin/shop/{id}`

---

## 12. File Quick Reference

| What | Where |
|------|-------|
| All API endpoints | `backend/main.py` |
| Database models | `backend/models.py` |
| Auth (JWT) | `backend/auth.py` |
| CRUD helpers | `backend/crud.py` |
| DB connection | `backend/database.py` |
| Pydantic schemas | `backend/schemas.py` |
| Frontend API calls | `frontend/services/api.ts` |
| Auth context | `frontend/contexts/AuthContext.tsx` |
| App entry + navigation | `frontend/App.tsx` |
| Animal image mapping | `frontend/assets/animals/index.ts` |
| Shop image mapping | `frontend/assets/shop/index.ts` |
| Notification framework | `frontend/components/InAppNotification.tsx` |
| Theme/colors | `frontend/theme/colors.ts` |
| Admin dashboard | `admin/index.html` |
| Website landing page | `website/src/app/page.tsx` |
| Hosted animal images | `website/public/animals/` |
