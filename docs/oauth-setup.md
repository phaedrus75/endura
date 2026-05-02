# Sign in with Apple + Google — full setup guide

This is the step-by-step to take Endura's OAuth from "code is shipped, not
configured" (the 1.0.4 / build 27 state that crashes `AuthScreen`) to
"working end-to-end on TestFlight".

## What's already done in the code (don't redo)

- **Backend verifiers** — `backend/oauth_verify.py` does RS256 + JWKS
  verification of Apple and Google ID tokens.
- **Backend endpoints** — `POST /auth/apple` and `POST /auth/google` in
  `backend/main.py`. Both accept the IdP token, verify it, resolve or
  create the user via `oauth_merge.py` (matching by **verified email**),
  and issue our own JWT.
- **Database** — `users.apple_id_sub` and `users.google_id_sub`
  (Alembic `x1y2z3a45b26`, plus partial unique indexes from the
  startup safety-net in `main.py`).
- **Frontend client** — `frontend/services/oauthLogin.ts`
  (`signInWithApple`, `useGoogleAuth`, `submitGoogleIdToken`,
  `isAppleSignInAvailable`, `isGoogleConfigured`) and the buttons in
  `frontend/screens/AuthScreen.tsx`.
- **iOS Info.plist** — `usesAppleSignIn: true` and the
  `expo-apple-authentication` plugin are already in `frontend/app.json`.
- **Backend tests** — `backend/tests/api/test_oauth_endpoints.py` and
  `backend/tests/test_oauth_merge.py` are green (251/251 backend tests
  pass).

## What's missing (the work in this doc)

| # | Where | What |
|---|-------|------|
| 1 | Apple Developer Portal | Enable Sign in with Apple capability on App ID `com.endura.study` |
| 2 | EAS / provisioning | Regenerate the iOS provisioning profile so it picks up the new entitlement |
| 3 | Railway env | Set `APPLE_AUDIENCES=com.endura.study` (optional — defaults to this) |
| 4 | Google Cloud Console | Create a project, configure OAuth consent screen, create iOS + Android + Web client IDs |
| 5 | `frontend/app.json` | Add `extra.googleIosClientId`, `googleAndroidClientId`, `googleWebClientId` and the iOS reversed-client URL scheme |
| 6 | Railway env | Set `GOOGLE_AUDIENCES` to a comma-separated list of all three Google client IDs |
| 7 | Frontend hardening | Gate the OAuth buttons behind `isGoogleConfigured()` so a missing config never crashes `AuthScreen` again |
| 8 | EAS build | Build & submit 1.0.5 (build 28) with all of the above in place |
| 9 | Smoke test | Sign in with each provider on a real device; confirm a 2nd sign-in returns the same user |

---

# Part A — Sign in with Apple (~15 min)

The **iOS-only native flow** is the simple path and the only one we ship
right now. (A web/Android Apple flow would need an Apple Service ID
and a private key, which we explicitly don't need.)

## A1. Enable the capability in Apple Developer Portal

1. Go to <https://developer.apple.com/account>.
2. **Certificates, Identifiers & Profiles → Identifiers**.
3. Find your App ID: `com.endura.study` (it'll show as `XF Studio`'s
   "Endura" or whatever you named it). Click into it.
4. Scroll the Capabilities list → tick **Sign in with Apple**.
5. Click **Save** (top right). Apple will warn that you'll need to
   regenerate any provisioning profiles using this App ID — that's
   fine, EAS will do it for you in step A2.

> **Note:** if Endura uses an "Apple ID for Bundle Identifier Selection"
> as its grouping, leave the default ("Enable as a primary App ID").
> We don't need a Group of related App IDs.

## A2. Force EAS to regenerate the iOS provisioning profile

The next `eas build` call needs to pick up the new entitlement. Easiest
way is to delete the existing profile so EAS regenerates it:

```bash
cd frontend
eas credentials              # interactive
# → iOS → production → Provisioning Profile → Remove
```

…or non-interactively, just kick a build and say "yes" when EAS asks
"Generate a new Provisioning Profile?":

```bash
eas build --profile production --platform ios --auto-submit
```

EAS will fetch the App ID from Apple, see the new Sign-in-with-Apple
entitlement, and bake it into the profile.

## A3. Backend env (optional)

`APPLE_AUDIENCES` defaults to `com.endura.study` if unset, so this only
matters if you ever change the bundle id. If you want to be explicit:

```
APPLE_AUDIENCES=com.endura.study
```

Set it in Railway → Variables on the backend service.

## A4. Smoke test (after the build is on TestFlight)

- Open Endura on a real iPhone signed into iCloud.
- Tap "Sign in with Apple".
- Choose "Share My Email" or "Hide My Email".
- The Apple sheet appears, you authenticate with Face ID, the sheet
  dismisses, and you land on the Onboarding screen.
- Sign out, tap "Sign in with Apple" again, choose the same Apple ID →
  you should land back on **your existing account** (same username,
  same coins, same animals). This proves the merge logic works.

> If the sheet shows briefly and then errors with `1000 / unknown`,
> the entitlement isn't on the build — that's an A1/A2 problem.
>
> If the sheet succeeds but the backend POST returns 401, check
> `APPLE_AUDIENCES` matches your bundle id exactly. Sentry will have
> the precise rejection reason from `oauth_verify.py`.

---

# Part B — Sign in with Google (~30–45 min)

This needs three OAuth client IDs (iOS, Android, Web) because
`expo-auth-session/providers/google` brokers them per-platform.

## B1. Create / pick a Google Cloud project

1. Go to <https://console.cloud.google.com>.
2. Project picker (top bar) → **New Project** → name it `Endura`
   → **Create**. Or pick an existing one if you already have one.
3. Make sure that project is selected in the picker before continuing.

## B2. OAuth consent screen

1. Sidebar → **APIs & Services → OAuth consent screen**.
2. **User type**: External → **Create**.
3. App information:
   - App name: `Endura`
   - User support email: `team@endura.eco` (or whatever you use)
   - App logo: optional but recommended (use the same icon as the
     iOS app) — this is what users see on the consent screen
   - App domain: `https://endura.eco`
   - Developer contact email: your email
4. **Scopes** screen → click **Add or Remove Scopes** → tick
   `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `openid`.
   These are the minimum we need; Google maps them to the standard
   `email`, `name`, `picture`, `sub` claims that `oauth_verify.py`
   already understands.
5. **Test users** screen → add your own Google account. While the app
   is "in testing" only listed test users can sign in. **You'll need
   to publish before TestFlight beta testers can use it.**
6. **Summary** → **Back to Dashboard**.

> When you're ready for non-allowlist beta testers, come back here and
> click **Publish App** → **Confirm**. For pure ID-token sign-in (no
> sensitive scopes), you do **not** need Google's full app verification
> review — it goes live immediately.

## B3. Create OAuth Client IDs

Sidebar → **APIs & Services → Credentials** → **+ Create Credentials**
→ **OAuth client ID**. Repeat this three times.

### B3.a iOS client

- Application type: **iOS**
- Name: `Endura iOS`
- Bundle ID: `com.endura.study`
- App Store ID: `6759482612` (optional)
- Team ID: optional (find it in Apple Developer → Membership)
- **Create**.

After creation, click into it and copy:
- **Client ID** (looks like `xxxxx-yyyyy.apps.googleusercontent.com`)
- **iOS URL scheme** (this is the *reversed* client ID,
  `com.googleusercontent.apps.xxxxx-yyyyy`). You'll need this for the
  iOS URL types in `app.json` (step B4).

### B3.b Android client

- Application type: **Android**
- Name: `Endura Android`
- Package name: `com.endura.study`
- **SHA-1 certificate fingerprint** — Android needs this. EAS holds
  the upload key, get the SHA-1 with:
  ```bash
  cd frontend
  eas credentials
  # → Android → production → Keystore → "View key"
  # Copy the SHA-1 fingerprint shown
  ```
  Paste that SHA-1 into the Google form.
- **Create**, copy the Client ID.

> If/when you submit to Play Store and Google App Signing kicks in,
> you'll need to add the **Play App Signing SHA-1** as well (Play
> Console → Setup → App Integrity → App Signing → "App signing key
> certificate"). Add it as a second Android OAuth client (same package,
> different SHA-1) or as an additional fingerprint on the same client.

### B3.c Web client

- Application type: **Web application**
- Name: `Endura Web` (this is the "primary" client even though we don't
  have a web sign-in surface — `expo-auth-session/providers/google`
  needs it as the audience claim).
- Authorized redirect URIs: leave empty.
- **Create**, copy the Client ID.

## B4. Add the client IDs to the app

Edit `frontend/app.json` → `expo.extra` (do **not** put these in env
vars — they need to ship inside the JS bundle):

```json
{
  "expo": {
    "extra": {
      "eas": { "projectId": "5fd638be-4053-4859-b3f4-b4b333d42c66" },
      "sentryDsn": "...existing...",
      "googleIosClientId":     "xxxxx-yyyyy.apps.googleusercontent.com",
      "googleAndroidClientId": "aaaaa-bbbbb.apps.googleusercontent.com",
      "googleWebClientId":     "ccccc-ddddd.apps.googleusercontent.com"
    }
  }
}
```

Then add the iOS reversed-client URL scheme so iOS can hand control
back to the app after the Google sheet dismisses. In
`frontend/app.json` → `expo.ios`:

```json
"ios": {
  "supportsTablet": true,
  "bundleIdentifier": "com.endura.study",
  "buildNumber": "26",
  "usesAppleSignIn": true,
  "infoPlist": {
    "ITSAppUsesNonExemptEncryption": false,
    "NSCameraUsageDescription": "...existing...",
    "NSPhotoLibraryUsageDescription": "...existing...",
    "UIBackgroundModes": ["remote-notification"],
    "CFBundleURLTypes": [
      {
        "CFBundleURLSchemes": [
          "com.googleusercontent.apps.xxxxx-yyyyy"
        ]
      }
    ]
  }
}
```

(Replace `xxxxx-yyyyy` with the actual reversed iOS client ID from
step B3.a.)

## B5. Backend env

Set `GOOGLE_AUDIENCES` on Railway → Variables on the backend service.
**All three client IDs**, comma-separated, no spaces:

```
GOOGLE_AUDIENCES=xxxxx.apps.googleusercontent.com,aaaaa.apps.googleusercontent.com,ccccc.apps.googleusercontent.com
```

This is critical — `verify_google_id_token()` rejects with HTTP 401 if
the `aud` in the incoming ID token isn't in this list. The audience
that ends up in the token depends on which platform initiated the sign-
in (iOS client ID for iOS, Android client ID for Android, web client
ID in the rare web case). We allow all three.

Restart the Railway service so it picks up the new env var.

---

# Part C — Frontend hardening so partial-config doesn't crash

Even with all of A and B done, the call site in `AuthScreen.tsx` still
calls the `useGoogleAuth()` hook unconditionally on mount. If anything
goes wrong with config in the future (env var dropped, client ID typo,
…) we don't want a crash — we want a graceful "Google sign-in not
available". Same for SIWA on devices that don't support it.

Two small edits in `frontend/screens/AuthScreen.tsx`:

### C1. Don't invoke the Google hook when not configured

```tsx
// Before:
const googleConfigured = isGoogleConfigured();
const [, googleResponse, googlePrompt] = useGoogleAuth();

// After:
const googleConfigured = isGoogleConfigured();
const googleAuthTuple = googleConfigured
  ? useGoogleAuth()
  : ([null, null, null] as const);
const [, googleResponse, googlePrompt] = googleAuthTuple;
```

> **Hooks rule reminder:** React requires hooks to be called in the
> *same order* on every render. `isGoogleConfigured()` reads from
> `Constants.expoConfig?.extra` which doesn't change between renders
> in the same install, so the conditional call is stable across the
> lifetime of the component. (For belt-and-braces safety, add an
> `if (!googleConfigured) return null;` before any UI that wires up
> `googlePrompt`.)

### C2. Hide the buttons until each provider is ready

The Apple button already correctly checks `appleAvailable` (set by the
`isAppleSignInAvailable()` effect). Make the Google button similarly
guarded:

```tsx
{googleConfigured && googlePrompt && (
  <TouchableOpacity onPress={() => onGoogleTap()} ...>...</TouchableOpacity>
)}
```

Result: in 1.0.5 build 28, if Google config is missing for any reason
the button just doesn't appear and the screen renders fine. If Apple
isn't available (e.g. iPad without an Apple ID, or Android), same
deal.

---

# Part D — Build & ship 1.0.5 / build 28

Once A1–A2, B1–B5, and C are all done:

```bash
cd frontend
# Bump version (the 1.0.4 → 1.0.5 bump is mandatory because 1.0.4 was
# already accepted by App Store Connect with the buggy build 27).
# Edit app.json: expo.version "1.0.4" → "1.0.5"; android.versionCode 11 → 12

eas build --profile production --platform ios --auto-submit
eas build --profile production --platform android --auto-submit
```

EAS will auto-increment iOS `buildNumber` (since `appVersionSource:
"remote"` per `eas.json`).

---

# Part E — Smoke test on TestFlight

| Step | What to do | Expected |
|------|------------|----------|
| 1 | Fresh-install the new TestFlight build on iPhone | App boots, shows walkthrough → AuthScreen with Apple + Google buttons |
| 2 | Tap **Continue with Apple** → Face ID / Touch ID | Lands on Onboarding screen |
| 3 | Complete onboarding | Lands on Home tab, no crash |
| 4 | Sign out from Profile | Back to AuthScreen |
| 5 | Tap **Continue with Apple** again | Lands directly on Home tab (existing user, no onboarding) |
| 6 | Sign out, tap **Continue with Google**, pick a Google account | Lands on Onboarding (or Home if email matched the Apple account from step 2 — the merge logic in `oauth_merge.py` will attach `google_id_sub` to the same user row) |
| 7 | Repeat 6 — second Google sign-in | Same user, no double account |
| 8 | Open the admin dashboard → Users → search by your email | Should see the row with both `apple_id_sub` AND `google_id_sub` populated if you used the same Google email as your Apple verified email |

---

# Troubleshooting cheat-sheet

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `AuthScreen` still crashes on mount | Google client IDs missing AND we didn't apply Part C | Apply C1 + C2, rebuild |
| Apple sheet flashes & dismisses with "code 1000" | Sign-in-with-Apple capability not on the build's provisioning profile | Re-run A2 |
| Apple sheet succeeds, backend returns 401 "audience mismatch" | `APPLE_AUDIENCES` doesn't match bundle id | Check Railway env |
| Google sheet succeeds, backend returns 401 "audience mismatch" | `GOOGLE_AUDIENCES` is missing the client ID that signed the token | Add the missing ID, restart Railway |
| Google sheet errors with `redirect_uri_mismatch` | iOS reversed-client URL scheme wrong / not in `app.json` | Re-check B4 |
| Google sheet works for you but not for beta testers | OAuth consent screen still in "Testing" mode | Publish the app in OAuth consent screen |
| Backend logs `503 GOOGLE_AUDIENCES not configured` | Env var not set on Railway | Set it, restart service |
| Two separate user rows for the same human after Apple-then-Google | One of the providers reported `email_verified=false`, blocking the merge | Check Sentry for the rejection; Apple's "Hide My Email" tokens still report `email_verified=true` so this shouldn't happen normally |
