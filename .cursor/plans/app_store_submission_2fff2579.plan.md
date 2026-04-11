---
name: App Store Submission
overview: Step-by-step guide to submit Endura (Expo/EAS) to the Apple App Store, covering prerequisites, build, App Store Connect setup, submission, and review.
todos:
  - id: bump-build
    content: Bump buildNumber in app.json if build 7 was already uploaded
    status: completed
  - id: age-rating
    content: Complete age rating questionnaire (4+)
    status: completed
  - id: eas-build
    content: Run eas build --platform ios --profile production
    status: completed
  - id: privacy-policy
    content: Create and host a privacy policy page (required by App Store)
    status: completed
  - id: screenshots
    content: Capture App Store screenshots for 6.7", 6.5", and 5.5" device sizes
    status: pending
  - id: demo-account
    content: "Demo account created: appreview@endura.eco / EnduraReview2026!"
    status: completed
  - id: app-store-connect
    content: Fill in App Store Connect listing using promo text and description below
    status: pending
  - id: eas-submit
    content: Run eas submit --platform ios --latest to upload build
    status: pending
  - id: submit-review
    content: Select build in App Store Connect and submit for review
    status: pending
isProject: false
---

# App Store Submission Plan for Endura

Your project is already well-configured for submission: EAS is set up with a `production` profile (`distribution: "store"`), bundle ID `com.endura.study`, build number `7`, and Apple ID `munshiaseem@yahoo.com`. Here is the step-by-step process.

---

## Prerequisites (one-time, if not already done)

- **Apple Developer Program** -- You must be enrolled ($99/year). Verify at [developer.apple.com/account](https://developer.apple.com/account). Without this, you cannot submit.
- **EAS CLI** -- Make sure you have the latest: `npm install -g eas-cli`
- **Expo account logged in** -- Run `eas whoami` to verify you're logged in as `phaedrus75`

---

## Step 1: Pre-submission code checklist

Before building, verify these items:

- **Version & build number** -- Currently `version: "1.0.0"` and `buildNumber: "7"` in [frontend/app.json](frontend/app.json). Each new submission to App Store Connect must have a **unique build number**. If build 7 was already uploaded, bump it to `"8"`.
- **Test timer OFF** -- The timer now defaults to minutes (correct). Your admin `use_test_timer` toggle is off by default. Good to go.
- **Privacy manifest** -- `ITSAppUsesNonExemptEncryption: false` is already set. This avoids the export compliance questionnaire.
- **No debug/dev code** -- The old `TEST_MODE = true` has been removed. Verify no console.log spam or dev-only screens are visible to regular users.

---

## Step 2: Build the production IPA

Run the EAS production build from the `frontend` directory:

```bash
cd frontend
eas build --platform ios --profile production
```

- EAS will handle code signing (provisioning profile + distribution certificate) automatically.
- If prompted for Apple credentials, enter the Apple ID `munshiaseem@yahoo.com` and your Apple Developer password or app-specific password.
- The build takes ~10-20 minutes. You'll get a URL to download the `.ipa` or view it on `expo.dev`.

---

## Step 3: Set up the app in App Store Connect

Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com) and create a new app (if not already created):

- **Platform**: iOS
- **Name**: Endura (or "Endura - Study & Save Species" for discoverability)
- **Primary language**: English
- **Bundle ID**: `com.endura.study` (must match app.json)
- **SKU**: Any unique string, e.g. `endura-study-001`

---

## Step 4: Fill in App Store listing metadata

In App Store Connect, under "App Information" and "Version Information":

### Required fields

- **App Name**: Endura
- **Subtitle** (30 chars): "Study Smarter. Save Species."
- **Category**: Education (Primary), Lifestyle (Secondary)
- **Keywords** (100 chars, comma-separated): `study,focus,timer,conservation,endangered,animals,gamified,education,wildlife,pomodoro`
- **Support URL**: Your website URL (e.g. [https://endura.eco](https://endura.eco))
- **Privacy Policy URL**: Required -- you must have one hosted. If you don't have one yet, create a simple one covering data collection (email, study data) and host it on your website.

### Promotional Text (170 chars, can be updated without a new app version)

```
Turn your study sessions into real conservation impact. Hatch endangered animals, compete with friends, and donate to WWF — all by staying focused.
```

### Description (copy this into App Store Connect)

```
Endura is the study app that turns your focus time into real-world conservation impact. Set a timer, stay focused, and earn eco-credits to hatch virtual endangered animals — then donate to WWF to help protect them in real life.

GAMIFIED STUDY TIMER
Choose your subject, set a timer, and focus. Our distraction-free timer keeps you motivated with gentle reminders — leave early and your egg might not make it. Complete sessions to earn eco-credits and grow your collection.

HATCH 30+ ENDANGERED ANIMALS
Every completed study session brings you closer to hatching a new animal. Tap to crack the egg and discover real endangered species — from Amur Leopards to Pangolins. Nickname them, learn about their conservation status, and build your sanctuary.

SUBJECTS & TASK MANAGEMENT
Search from 130+ subjects across IB, A-Level, GCSE, AP, CBSE, and more — or create your own. Organise your study with to-dos, due dates, and subject tracking so you always know what to focus on next.

STUDY WITH FRIENDS
Add friends, create study groups, set shared goals by subject, and compete on weekly and all-time leaderboards. See who's studying the most and keep each other accountable.

EARN BADGES & TRACK PROGRESS
Unlock 50+ badges as you build your study streak. Track your weekly and monthly study hours with detailed charts broken down by subject.

PROTECT REAL WILDLIFE
Your study hours power real change. Donate directly to WWF conservation projects from inside the app — no middlemen, no detours. 100% of donations go to protecting habitats and endangered species worldwide.

Built by a 16-year-old IB student who believes her generation can turn the tide for endangered species. Endura is youth-led, free to use, and designed to make every study session count.

Study smarter. Save species.
```

### What's New (Version 1.0.0)

```
Welcome to Endura! Study with a gamified timer, hatch 30+ endangered animals, compete with friends, and donate to WWF — all from one app.
```

### Screenshots (required)

You need screenshots for at least these device sizes:

- **6.7" display** (iPhone 15 Pro Max / 14 Pro Max) -- required
- **6.5" display** (iPhone 11 Pro Max) -- required
- **5.5" display** (iPhone 8 Plus) -- required if supporting older devices

Take 3-6 screenshots per size showing: Home screen with egg, Timer running, Collection screen, Study groups, Progress stats. You can use the iOS Simulator or a real device, then optionally frame them with a tool like [screenshots.pro](https://screenshots.pro) or Figma.

### App icon

Your 1024x1024 icon (the "e" hatching from egg) will be automatically extracted from the build. No separate upload needed with EAS.

---

## Step 5: Age rating questionnaire

In App Store Connect, fill in the age rating questionnaire. For Endura:

- No violence, no mature content, no gambling, no horror
- This should result in a **4+** age rating

---

## Step 6: App Review information

- **Contact info**: Your name, email, phone number
- **Demo account** (critical): Create a test account Apple reviewers can log into. Provide the email and password. Make sure this account has some data (completed sessions, subjects, etc.) so reviewers can see the app working.
- **Notes for reviewer**: Briefly explain the app -- e.g., "Endura is a gamified study timer that rewards focus with virtual endangered animals. Users set a timer, study, and earn coins to hatch animals. The app also supports study groups and progress tracking."

---

## Step 7: Submit the build

You have two options:

### Option A: EAS Submit (recommended, from terminal)

```bash
cd frontend
eas submit --platform ios --latest
```

This uploads your latest production build to App Store Connect automatically. You'll be prompted for your Apple credentials and may need an **app-specific password** (generate at [appleid.apple.com](https://appleid.apple.com) under Security > App-Specific Passwords).

### Option B: Manual via Transporter

- Download **Transporter** from the Mac App Store
- Drag your `.ipa` file (downloaded from the EAS build dashboard) into Transporter
- Click "Deliver"

After the build is uploaded, it takes ~15-30 minutes to process in App Store Connect.

---

## Step 8: Select build and submit for review

1. Go to App Store Connect > Your App > iOS version
2. Under "Build", click the "+" and select the processed build
3. Review all metadata one more time
4. Click **"Add for Review"** then **"Submit to App Review"**

---

## Step 9: Wait for review

- **Typical review time**: 24-48 hours (can be faster or up to a week for first submissions)
- You'll get email notifications about status changes
- If **rejected**, Apple provides specific feedback. Common first-submission rejections:
  - Missing privacy policy
  - Incomplete metadata / broken links
  - App crashes or obvious bugs
  - Insufficient app functionality (unlikely for Endura)
  - Demo account doesn't work

---

## Quick reference: Terminal commands summary

```bash
# 1. Bump build number in app.json if needed
# 2. Build
cd frontend
eas build --platform ios --profile production

# 3. Submit (after build completes)
eas submit --platform ios --latest
```

---

## Things you likely need to prepare outside of code


| Item                                   | Status                          |
| -------------------------------------- | ------------------------------- |
| Apple Developer Program enrollment     | Verify active                   |
| Privacy Policy URL                     | Need to create/host if not done |
| App Store screenshots (3 device sizes) | Need to capture                 |
| Demo account for Apple reviewer        | Need to create                  |
| App description text                   | Draft from website content      |


