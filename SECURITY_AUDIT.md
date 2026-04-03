# Endura Security Audit Report

**Date:** March 30, 2026
**Scope:** Full-stack application (FastAPI backend, React Native/Expo frontend, Next.js website, admin dashboard)
**Purpose:** Pre-App Store deployment security review

---

## Executive Summary

A comprehensive security audit was performed across the entire Endura codebase. The audit identified **5 critical**, **15 high**, **~20 medium**, and **~15 low** severity issues spanning authentication, authorization, input validation, secrets management, and frontend security.

The most urgent findings include exploitable endpoints that allow coin inflation, unauthorized push notification broadcasting, unverified donation webhooks, and secrets committed to documentation files. These must be resolved before App Store submission.

---

## Methodology

- Static analysis of all backend Python files (FastAPI, SQLAlchemy, Pydantic)
- Static analysis of all frontend TypeScript/React Native files
- Review of website Next.js code and admin dashboard HTML/JS
- Review of deployment configuration (Railway, Vercel, Expo EAS)
- Review of documentation files for leaked secrets
- Review of `.gitignore` for completeness

---

## CRITICAL Findings

### C1. Shop Spend Endpoint Allows Negative Amounts

**Severity:** CRITICAL
**File:** `backend/main.py` ~line 1238; `backend/schemas.py`
**Description:** The `/shop/spend` endpoint accepts a negative `amount` value. Since the backend computes `user.current_coins -= req.amount`, a negative amount *increases* the user's coin balance, enabling unlimited coin inflation.
**Impact:** Complete bypass of the in-app economy. Any user can grant themselves unlimited coins.
**Recommendation:** Add `Field(..., ge=1)` constraint to `SpendRequest.amount` in the Pydantic schema and validate server-side.

### C2. Unauthenticated Push Notification Broadcast

**Severity:** CRITICAL
**File:** `backend/main.py` ~line 1797
**Description:** The `POST /notifications/send` endpoint allows any authenticated user to send push notifications with arbitrary `title` and `body` to any list of `user_ids`. There is no admin role check or friendship verification.
**Impact:** Enables spam, phishing, and harassment via push notifications to any user in the system.
**Recommendation:** Restrict to admin-only access via `X-Admin-Key` header check, or remove the endpoint entirely.

### C3. Unverified Donation Webhook

**Severity:** CRITICAL
**File:** `backend/main.py` ~line 1516
**Description:** The `POST /webhook/every-org` endpoint performs no HMAC/signature verification. Anyone who knows the endpoint URL can POST fabricated donation data, creating fake `Donation` rows and linking them to arbitrary users via the `partnerDonationId` pattern (`endura-u{user_id}-...`).
**Impact:** Donation totals can be inflated. Fake donations can be attributed to any user. Community stats are untrustworthy.
**Recommendation:** Implement webhook signature verification using Every.org's shared secret.

### C4. Group Chat Insecure Direct Object Reference (IDOR)

**Severity:** CRITICAL
**File:** `backend/crud.py` ~line 858
**Description:** The `get_group_messages` function retrieves messages for a given `group_id` without verifying that the requesting user is a member of that group. Any authenticated user can enumerate group IDs and read all private group chat messages.
**Impact:** Complete breach of group chat privacy.
**Recommendation:** Add a membership check before returning messages: verify `current_user.id` is in the group's member list.

### C5. Production Secrets in Documentation Files

**Severity:** CRITICAL
**Files:** `HANDOVER.md` ~lines 50-75; `ARCHITECTURE.md` ~lines 303-305
**Description:** Documentation files committed to the repository contain:
- Live Railway API base URL
- Stripe live publishable key (`pk_live_...`)
- PostHog project key (`phc_qlSNr...`)
- Every.org webhook URL and token
- Default admin API key fallback (`endura-admin-2024`)
- Vercel account and project context

**Impact:** Anyone with repository access has a complete map of production infrastructure and multiple credentials for targeted abuse.
**Recommendation:** Remove all secrets from markdown files immediately. Move to a private vault (1Password, etc.). Rotate any keys that have been committed to git history.

---

## HIGH Findings

### H1. Default Admin API Key in Source Code

**Severity:** HIGH
**File:** `backend/main.py` ~line 1836
**Description:** `ADMIN_API_KEY` defaults to `"endura-admin-2024"` if the environment variable is not set. This hardcoded default is also documented in `HANDOVER.md`.
**Impact:** If the environment variable is ever unset in production, all admin endpoints are accessible with a publicly known key.
**Recommendation:** Remove the default fallback. Raise a startup error if `ADMIN_API_KEY` is not set.

### H2. Long-Lived JWT Tokens with No Revocation

**Severity:** HIGH
**File:** `backend/auth.py` ~line 22
**Description:** Access tokens expire after 7 days (`ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7`). There is no refresh token rotation and no server-side revocation mechanism.
**Impact:** A stolen token remains valid for up to 7 days. Logout and password changes do not invalidate existing tokens.
**Recommendation:** Reduce TTL to 24 hours. Implement refresh token rotation or a server-side token blocklist.

### H3. Password Reset Bypasses Registration Policy

**Severity:** HIGH
**File:** `backend/main.py` ~line 649
**Description:** The password reset flow accepts passwords with only 6+ characters, while registration enforces 8+ characters with at least one digit and one letter.
**Impact:** Users can weaken their password through the reset flow, undermining the registration policy.
**Recommendation:** Apply identical validation rules to both registration and password reset.

### H4. Overly Permissive CORS Configuration

**Severity:** HIGH
**File:** `backend/main.py` ~line 91
**Description:** CORS is configured with `allow_origins=["*"]` combined with `allow_credentials=True`. This pairing is invalid per the CORS specification and is overly permissive.
**Impact:** Misconfigured CORS can allow unauthorized cross-origin requests with credentials.
**Recommendation:** Replace `*` with explicit allowed origins (production Railway URL, localhost for development).

### H5. Public Upload Access Without Authentication

**Severity:** HIGH
**File:** `backend/main.py` ~line 2287
**Description:** `GET /uploads/{upload_id}` serves uploaded files (profile pictures, etc.) without any authentication or ownership check. Upload IDs are sequential integers, making them easily guessable.
**Impact:** All uploaded profile pictures and admin uploads are effectively public to anyone who can reach the API.
**Recommendation:** Require authentication, use UUID-based upload IDs, or implement signed URLs with expiry.

### H6. Debug Verification Codes in API Responses

**Severity:** HIGH
**Files:** `backend/main.py` ~line 407; `frontend/screens/AuthScreen.tsx` ~line 199
**Description:** When email sending fails, the actual 6-digit verification code is returned in the API response as `_debug_code`. The frontend auto-fills this code, completely bypassing email verification.
**Impact:** If the email service is down or misconfigured in production, email verification is entirely bypassed.
**Recommendation:** Remove `_debug_code` from all responses. Gate behind a `DEBUG=true` environment variable that is never set in production.

### H7. Webhook Token Hardcoded in Frontend

**Severity:** HIGH
**File:** `frontend/screens/TakeActionScreen.tsx` ~line 25
**Description:** `EVERY_ORG_WEBHOOK_TOKEN = '9f29c612e6f8'` is embedded in the client application binary and passed in donation URLs.
**Impact:** The token is extractable from the app binary by anyone. If the backend relies on this token for webhook verification, it is ineffective.
**Recommendation:** Move to a backend-mediated donation flow where the frontend never handles the token.

### H8. Admin Dashboard Cross-Site Scripting (XSS) Gaps

**Severity:** HIGH
**File:** `website/public/dashboard-e9x2k/index.html` ~lines 746, 907, 1324
**Description:** Several dynamic values are interpolated into HTML without escaping:
- Upload URLs inserted into `<img src>` attributes after upload
- User `profile_pic_url` values inserted unescaped into image tags
- Shop item `rarity` and `emoji` values inserted raw into HTML cards

The dashboard has an `esc()` helper function but it is not applied consistently.
**Impact:** A compromised API response or malicious data could execute arbitrary JavaScript in the admin context.
**Recommendation:** Apply `esc()` to all dynamic values inserted into HTML.

### H9. Admin Credentials Stored in localStorage

**Severity:** HIGH
**File:** `website/public/dashboard-e9x2k/index.html` ~line 681
**Description:** `adminApiUrl`, `adminApiKey`, and `phPersonalKey` are stored in `localStorage`, which persists across sessions and is accessible to any JavaScript running on the same origin.
**Impact:** Any XSS vulnerability (see H8) could exfiltrate admin credentials. Keys persist on shared machines.
**Recommendation:** Use `sessionStorage` at minimum. Add a visible logout button. Consider httpOnly cookie-based auth.

### H10. Incomplete `.gitignore`

**Severity:** HIGH
**File:** `.gitignore`
**Description:** Only `backend/.env` is listed. The following are unprotected: `website/.env`, `website/.env.local`, `frontend/.env`, root `.env`.
**Impact:** Environment files containing secrets could be accidentally committed.
**Recommendation:** Add `*.env`, `*.env.local`, `*.env.*` glob patterns.

### H11. PII Sent to Analytics

**Severity:** HIGH
**File:** `frontend/App.tsx` ~line 132
**Description:** The `identifyUser` call sends the user's `email` to PostHog analytics alongside their user ID.
**Impact:** User email addresses are stored in a third-party analytics platform, creating privacy/GDPR compliance risk.
**Recommendation:** Remove `email` from the PostHog identify call. Send only non-PII attributes.

### H12. Unauthenticated Payment Intent Creation

**Severity:** HIGH
**File:** `backend/main.py` ~line 1494
**Description:** The `/create-payment-intent` endpoint has no authentication requirement. Anyone can create Stripe PaymentIntents.
**Impact:** API abuse, Stripe dashboard noise, potential billing confusion.
**Recommendation:** Add `Depends(get_current_user)` to require authentication.

### H13. Unauthenticated School Seed Endpoint

**Severity:** HIGH
**File:** `backend/main.py` ~line 723
**Description:** `POST /schools/seed` triggers heavy database and network operations with no authentication.
**Impact:** Denial-of-service via repeated invocations. First caller controls seed data.
**Recommendation:** Protect with admin key or remove after initial seeding.

### H14. No Friendship Check on Reactions

**Severity:** HIGH
**File:** `backend/crud.py` ~line 918
**Description:** `add_reaction` only verifies the event exists, not that the reactor is a friend of the event owner. Any authenticated user can react to any event.
**Impact:** Spam and unwanted interactions from non-friends.
**Recommendation:** Verify friendship before allowing reactions.

### H15. Basic Auth Password Parsing Bug

**Severity:** HIGH
**File:** `website/middleware.ts` ~line 20
**Description:** `atob(base64).split(':')` splits into only two parts. Passwords containing `:` are truncated.
**Impact:** Admins with `:` in their password cannot authenticate.
**Recommendation:** Use `indexOf(':')` to split on the first colon only, per RFC 7617.

---

## MEDIUM Findings

### M1. Rate Limiting May Not Be Active

**File:** `backend/main.py` ~line 82
**Description:** `Limiter` and `RateLimitExceeded` handler exist, but `SlowAPIMiddleware` may not be registered. Rate limits on login, signup, and password reset may not be enforced.
**Recommendation:** Verify middleware registration. Add integration tests for rate limiting.

### M2. Pydantic Validation Gaps

**File:** `backend/schemas.py`
**Description:** Several schemas lack proper constraints:
- `StudyTipCreate.content`: no `max_length` (large payload DoS)
- `GroupCreate.name`: unbounded
- `GroupMessageCreate.content`: unbounded
- `PactCreate.daily_minutes`, `duration_days`, `wager_amount`: no min/max validation
- `ReactionCreate.reaction`: unbounded string

**Recommendation:** Add `Field(max_length=...)` and `Field(ge=, le=)` constraints to all user-facing input schemas.

### M3. Login Does Not Require Verified Email

**File:** `backend/main.py` ~line 518
**Description:** Users can obtain a JWT before completing email verification.
**Recommendation:** Policy decision -- consider requiring verification before issuing tokens.

### M4. Internal Error Details Leaked to Clients

**Files:** `backend/main.py` ~lines 1202, 1402, 1508
**Description:** `HTTPException(status_code=500, detail=str(e))` exposes Python exception text in API responses.
**Recommendation:** Return generic error messages. Log the full exception server-side.

### M5. Email Enumeration on Registration

**File:** `backend/main.py` ~line 396
**Description:** Returns "Email already registered" enabling account enumeration.
**Recommendation:** Return a generic message like "If this email is valid, a verification code has been sent."

### M6. No Content Security Policy on Admin Dashboard

**File:** `website/public/dashboard-e9x2k/index.html`
**Description:** No CSP headers. All inline scripts and external CDN scripts run unrestricted.
**Recommendation:** Add a Content-Security-Policy header via meta tag or middleware.

### M7. CDN Script Without Subresource Integrity

**File:** `website/public/dashboard-e9x2k/index.html` ~line 302
**Description:** Chart.js loaded from jsdelivr CDN without `integrity` or `crossorigin` attributes.
**Recommendation:** Add SRI hash and `crossorigin="anonymous"`.

### M8. Duplicate Admin Dashboard Files

**Files:** `admin/index.html` and `website/public/dashboard-e9x2k/index.html`
**Description:** Two copies of the same admin SPA maintained separately. Security fixes applied to one may not reach the other.
**Recommendation:** Consolidate to a single source of truth.

### M9. Console.log Statements in Production

**Files:** Multiple frontend files (AuthContext.tsx, HomeScreen.tsx, TimerScreen.tsx, pushNotifications.ts)
**Description:** `console.log` and `console.error` calls are not gated behind `__DEV__`. Error objects may expose sensitive details in production logs.
**Recommendation:** Guard all logging with `if (__DEV__)` or use a logging library that respects build modes.

### M10. Profile Picture MIME Type Not Validated Server-Side

**File:** `backend/main.py` ~line 543
**Description:** Content type is derived from the client-provided filename extension only. No magic-byte validation is performed on the actual file contents.
**Recommendation:** Validate file content against expected image magic bytes (JPEG, PNG, GIF, WebP).

### M11. Weak Verification Codes

**File:** `backend/main.py` ~line 401
**Description:** 6-digit numeric codes have only ~1 million possible values.
**Recommendation:** Consider longer alphanumeric codes or cryptographically random tokens with short expiry.

### M12. API Fetch Follows Redirects

**File:** `frontend/services/api.ts` ~line 276
**Description:** `redirect: 'follow'` could send auth tokens to a different host if the API or DNS were compromised.
**Recommendation:** Change to `redirect: 'error'` or `redirect: 'manual'`.

### M13. Inconsistent API Call Patterns in Frontend

**Files:** OnboardingScreen.tsx ~line 195, TakeActionScreen.tsx ~line 127, CollectionScreen.tsx ~line 457, pushNotifications.ts ~line 67
**Description:** Several calls bypass the centralized `apiFetch` function, missing shared error handling, 401 interception, and security headers.
**Recommendation:** Route all API calls through `apiFetch`.

### M14. Admin Auto-Login Without Key Re-Validation

**File:** `website/public/dashboard-e9x2k/index.html` ~line 690
**Description:** On page load, if `adminApiUrl` and `adminApiKey` exist in localStorage, the UI shows "Connected" without verifying the key is still valid.
**Recommendation:** Make a test API call on auto-login to verify the key is still active.

### M15. No Logout Button in Admin Dashboard

**File:** `website/public/dashboard-e9x2k/index.html`
**Description:** The `logout()` function exists but is not exposed in the UI. Admin keys persist indefinitely on shared machines.
**Recommendation:** Add a visible logout button.

---

## LOW Findings

| ID | Description | File |
|----|-------------|------|
| L1 | Stripe dependency unpinned in requirements.txt | `backend/requirements.txt` |
| L2 | Health/root endpoints public (expected) | `backend/main.py` |
| L3 | Expo project ID in app.json (non-secret) | `frontend/app.json` |
| L4 | Apple ID email in EAS config | `frontend/eas.json` |
| L5 | Shop purchase state mirrored in AsyncStorage | `frontend/screens/ShopScreen.tsx` |
| L6 | Unused `@stripe/stripe-react-native` dependency | `frontend/package.json` |
| L7 | Admin path `/dashboard-e9x2k` is security-by-obscurity | `website/next.config.ts` |
| L8 | Pending friend requests expose email | `backend/crud.py` ~line 349 |
| L9 | Friend suggestions expose email | `backend/crud.py` ~line 417 |
| L10 | Profile picture URLs stored in AsyncStorage (not SecureStore) | `frontend/contexts/AuthContext.tsx` |
| L11 | `passlib` in requirements.txt but unused (auth uses `bcrypt` directly) | `backend/requirements.txt` |
| L12 | Recent donor names and amounts exposed in community stats | `backend/main.py` ~line 1639 |
| L13 | Admin standalone server uses `CORS *` | `admin/serve.py` ~line 19 |
| L14 | JWT dev fallback key for SQLite mode | `backend/auth.py` ~line 15 |
| L15 | `Upload.data` as LargeBinary in DB (size DoS risk) | `backend/models.py` ~line 306 |

---

## Positive Findings

The following security practices are already in place:

- **Password hashing**: bcrypt with salt is used correctly
- **Token storage**: Auth tokens use `SecureStore` (hardware-backed on iOS), not AsyncStorage
- **HTTPS enforced**: All API URLs use `https://`
- **ORM usage**: Database queries use SQLAlchemy ORM bindings, preventing SQL injection
- **401 handling**: Frontend `apiFetch` clears tokens and logs out on 401 responses
- **No deep link attack surface**: No custom URL schemes or intent filters configured
- **Image rendering safe**: React Native `Image` component does not execute HTML/JS
- **Static SQL only**: Raw SQL in migrations uses static strings with no user input
- **Pydantic validation on auth**: `UserCreate` schema has proper email and password validation

---

## Recommendations Priority Matrix

| Priority | Action | Effort |
|----------|--------|--------|
| Immediate | Remove secrets from docs, rotate exposed keys | Low |
| Immediate | Fix `/shop/spend` negative amount exploit | Low |
| Immediate | Restrict `/notifications/send` to admin | Low |
| Before launch | Fix group chat IDOR | Low |
| Before launch | Verify webhook signatures | Medium |
| Before launch | Harden auth (JWT TTL, password reset, CORS) | Medium |
| Before launch | Fix admin dashboard XSS gaps | Medium |
| Before launch | Remove `_debug_code` from production | Low |
| Post-launch | Add rate limiting verification | Medium |
| Post-launch | Add Pydantic constraints to all schemas | Medium |
| Post-launch | Implement certificate pinning | High |
| Post-launch | Move admin auth to httpOnly cookies | High |

---

*Report prepared as part of the Endura v2 App Store deployment preparation.*
