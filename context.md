# Endura - Gamified Study App

Help me build a mobile app - with the following
a react native front end 
a python backend 
a sql database

Build it in a way that also guides me to learn python and react.

Then help me find a platform that is easy to deploy. 

---

## Current Status: MVP Complete ✅

### What's Built

**Backend (FastAPI + SQLAlchemy)**
- Authentication with JWT tokens
- User management with streaks, coins, stats
- Task CRUD operations
- Study session tracking with coin rewards
- Egg hatching system with 20 endangered animals
- Study tips feed with likes
- Social features (friends, leaderboard)
- SQLite database (can switch to PostgreSQL for production)

**Frontend (React Native + Expo)**
- 5 main screens: Home, Timer, Collection, Tips, Profile
- Onboarding flow with username setup
- Auth screen (login/register)
- Confetti celebrations for hatching

**Game Mechanics**
- 1 coin/min studying + bonuses for longer sessions
- Eggs start at 100 coins, +25 per animal hatched
- 4 rarity tiers: Common, Rare, Epic, Legendary

### How to Run

**Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd frontend
npx expo start --lan
```

**API URL:** Currently set to `http://192.168.86.136:8000` in `frontend/services/api.ts`
(Update this IP if your network changes)

---

# User Stories

As a user

I want to plan my study week by creating a to-do list plan

I want to have a gamified study timer that gives me digital coins after I've competed the timer, which help contribute to hatching an egg, thus helping me be motivated to finish my study tasks

I want to have an engagement mechanic that motivates me to study - by unlocking endangered animals so I can build a collection

I want to contribute to the environment more specifically spend the digital coins i gain from studying to donating to endangered animal conservation

I want to have a social / friend connections so we can see each other's progress and motivate each other - leaderboard, following, comments, likes

I want to improve quality of my studying - through tips and recommendations from others, like a scrolling tiktok feed but with educational content

the core mechanic is that i set up a task for me to complete, and start a customisable timer for that task. once the timer is complete, the app gives me a certain amount of digital coins. These digital coins contribute to me being able to hatch an egg with an endangered animal inside - at first only a small amount of coins are needed to hatch the egg, but as i continue to hatch more eggs, more coins are required for each hatch. The home page should have an egg and a progress circle with the amount of coins needed to hatch the next egg so i can immediately see how much more studying i need to do to hatch the next egg. underneath this, still in the home page there should be my to-do list, etc. 

## Functionality - TODO

- [x] Add onboarding screens
- [x] Add streaks
- [ ] Let users name their animals *(UI exists, needs testing)*
- [x] ability to collect multiple of the same animals
- [x] Add up to 50 animals *(20 added, can expand)*
- [x] The scrolling study tips feed refreshes, so it doesn't show you study tips you've already viewed
- [x] A way for users to submit study tips / way to build the study tips feed so it has much more content
- [x] A social side to the app, where you can add friends and compete with their study hours

## Next Steps
- Test on physical device via Expo Go
- Add more animals (currently 20, goal is 50)
- Add push notifications for streak reminders
- Deploy backend to Railway/Render
- Build for iOS/Android with EAS
