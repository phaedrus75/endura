# Endura — 30-Day Onboarding Lifecycle Program

## Overview
A structured program to guide new users from signup to becoming engaged, retained users. Combines in-app nudges with email touchpoints.

---

## Week 1: First Steps (Days 1–7)

### Day 0 — Welcome
- **Email**: Welcome email (automated on email verification)
  - Intro to Endura, 4 quick-start steps, link to app
- **In-app**: Onboarding screens already guide through first timer setup

### Day 1 — First Study Nudge
- **Push notification** (evening): "Your egg is waiting! 🥚 Set a 20-minute timer and start hatching."
- **Goal**: Get the user to complete their first study session

### Day 2 — First Hatch Celebration
- **Push notification** (if they haven't studied): "You're one session away from hatching your first animal! 🐾"
- **If they studied**: "Nice work! Keep the momentum — study again today to start a streak 🔥"

### Day 3 — Social Hook
- **Push notification**: "Study is better with friends! Add a friend and see who studies more 👥"
- **Email**: "Your First 3 Days on Endura" — recap their progress, encourage adding friends
  - Include: minutes studied, animals hatched (if any), streak status

### Day 5 — Streak Builder
- **Push notification**: "You have a [X]-day streak! Don't break it — even 15 minutes counts 🔥"

### Day 7 — Week 1 Recap
- **Email**: "Your Week 1 Recap 🌿"
  - Total minutes studied, animals hatched, streak, eco-credits earned
  - "You've already helped protect [X] endangered species"
  - CTA: "Keep going — your sanctuary is growing!"

---

## Week 2: Deepening Engagement (Days 8–14)

### Day 8 — Explore Features
- **Push notification**: "Have you visited your sanctuary yet? See all your animals in their habitat 🏡"

### Day 10 — Group Challenge
- **Push notification**: "Create a study group and challenge your friends to a weekly goal! 📚"

### Day 12 — Tips Discovery
- **Push notification**: "Need study inspiration? Check out our Study Tips from top students ✨"

### Day 14 — Two Week Milestone
- **Email**: "2 Weeks of Endura! 🎉"
  - Progress summary, badges earned, comparison to community averages
  - Highlight: "Students using Endura study X% more consistently"
  - Share prompt: "Know someone who'd love Endura? Share the app!"

---

## Week 3: Habit Formation (Days 15–21)

### Day 15 — Reminder Setup
- **Push notification**: "Set a daily study reminder so you never miss a session ⏰"
  - Deep link to reminder settings

### Day 17 — Collection Progress
- **Push notification**: "You've hatched [X] of 30+ species! Can you collect them all? 🦁"

### Day 19 — Leaderboard Push
- **Push notification**: "You're ranked #[X] among your friends! One more session to move up 📊"

### Day 21 — 3 Week Milestone
- **Email**: "3 Weeks Strong! 💪"
  - Study consistency chart, total impact, rarest animal hatched
  - CTA: "You're building a real habit — keep it going!"

---

## Week 4: Retention & Advocacy (Days 22–30)

### Day 22 — Shop Discovery
- **Push notification**: "You have [X] eco-credits! Browse the shop and decorate your sanctuary 🛍️"

### Day 25 — Impact Reminder
- **Push notification**: "Your studying has contributed to protecting [X] species. Every session matters 🌍"

### Day 28 — Review Request
- **Push notification**: "Enjoying Endura? A review on the App Store helps other students find us ⭐"
  - Only show if user has 7+ sessions and 3+ day streak

### Day 30 — Month Milestone
- **Email**: "Your First Month with Endura 🌟"
  - Full month stats: total minutes, sessions, animals, streak record, badges
  - Personalised impact statement
  - "You're officially an Endura regular!"
  - CTA: Share on social media

---

## Ongoing (Post Day 30)

### Weekly
- **Push notification** (Mondays): Weekly study goal reminder
- **Push notification** (Fridays): Week summary teaser

### Monthly
- **Email**: Monthly recap with stats, new features, community highlights

### Re-engagement (Inactive 3+ days)
- **Push notification**: "We miss you! Your [X]-day streak is at risk 😢 A quick 15-min session saves it"
- **Push notification** (7 days inactive): "Your animals miss you! Come back and keep your sanctuary growing 🐾"

---

## Implementation Priority

### Phase 1 (Now — before school assembly)
- [x] Welcome email on signup ✅
- [ ] Push notifications for Day 1, 2, 3, 5 (use existing push token infrastructure)

### Phase 2 (This week)
- [ ] Day 7 recap email
- [ ] Day 14 milestone email
- [ ] Re-engagement notifications

### Phase 3 (Next 2 weeks)
- [ ] Day 21, 30 emails
- [ ] Weekly/monthly recurring emails
- [ ] App Store review prompt (Day 28)

---

## Email Sending Infrastructure
- **Provider**: Resend (already integrated)
- **From**: Configured via `RESEND_FROM` env var
- **Trigger**: Backend cron job or event-based (on verify, on session complete, etc.)

## Push Notification Infrastructure
- **Token**: Stored in `User.push_token`
- **Enabled**: `User.notification_enabled`
- **Reminder**: `User.study_reminder_hour` / `User.study_reminder_minute`
- **Implementation**: Expo Push Notifications API
