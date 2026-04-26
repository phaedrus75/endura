# Push Notifications

End-to-end documentation for Endura's push notification stack. Shipped in build 19 (26 April 2026).

---

## TL;DR

- **Provider:** Expo Push API (handles APNs + FCM under the hood)
- **Frontend:** `expo-notifications` + `expo-device`, registered automatically once a user is authenticated and has a username
- **Backend:** `services/push.py` — single sender, batch broadcast, DB logging
- **Storage:** `users.push_token` for the token, `push_templates` for editable copy, `push_logs` for delivery tracking
- **Admin:** `/dashboard-e9x2k/` → **Push** tab (test send, broadcast, opt-in funnel, recent log)
- **Lifecycle cron:** daily at 10:00 UTC, dedup'd via `push_logs`

---

## Architecture

```
┌─────────────┐   getExpoPushTokenAsync   ┌─────────────────────┐
│   Mobile    │ ────────────────────────► │  Expo push service  │
│ (Endura.app)│                           └─────────────────────┘
│             │
│ permission  │   PUT /users/me/push-token  ┌──────────────────┐
│   prompt    │ ────────────────────────►  │  FastAPI backend │
└─────────────┘                            │ users.push_token │
                                           └──────────────────┘
                                                    │
                  ┌─────────────────────────────────┤
                  ▼                                 ▼
         services/push.py                  push_logs (delivery)
                  │
                  ▼
       https://exp.host/--/api/v2/push/send
                  │
                  ▼
       APNs / FCM → user's device
```

### Tables

- **`users`** — adds `push_token`, `push_token_updated_at`, `push_platform`, plus four per-category boolean prefs: `notif_badges_enabled`, `notif_friends_enabled`, `notif_reminders_enabled`, `notif_marketing_enabled`. Master switch is `notification_enabled`.
- **`push_templates`** — editable copy keyed by `template_key`. Lifecycle templates have `trigger_day` set; re-engagement templates have `inactive_days`; event templates have neither.
- **`push_logs`** — every send is a row, with `status` (`sent` | `failed` | `dropped`), `error_code`, and `expo_ticket_id`. Used for dedup, metrics, debugging.

### Categories

| Category | Pref column gating it | Examples |
|----------|-----------------------|----------|
| `badge` | `notif_badges_enabled` | Badge earned |
| `friend` | `notif_friends_enabled` | Friend request, friend accepted |
| `reminder` | `notif_reminders_enabled` | Daily study reminder, re-engagement |
| `campaign` | `notif_marketing_enabled` | Day-1/2/3/7/14 onboarding nudges, broadcasts |
| `marketing` | `notif_marketing_enabled` | Ad-hoc broadcasts |
| `system` | (always sends) | Donation thank-you, account/security |

`system` is the only category that bypasses the user's category preference. It still respects the master `notification_enabled` switch and a missing/dead token.

---

## Sending a push from backend code

```python
from services import push as push_service

# 1) Direct
push_service.send_to_user(
    db, user,
    title="Hey!", body="Tap to open the timer",
    category="reminder",
    deep_link="Timer",
)

# 2) Via template (preferred — copy is editable in admin)
push_service.send_template_to_user(
    db, user, "push_badge_earned",
    variables={"name": user.username, "badge_name": "Hour of Power"},
)

# 3) Inline event hook helper (defined in main.py)
_safe_send_push("push_friend_request", recipient, db,
                extra_vars={"from_name": current_user.username})
```

All sends are best-effort. Network failures, missing tokens, and pref opt-outs never raise — they're just logged into `push_logs`.

### Lifecycle cron

`_cron_lifecycle_pushes` runs daily at 10:00 UTC. For each user with a token:

1. Pick the lowest unsent `trigger_day` template where `days_since_signup >= trigger_day` — send one per run.
2. If the user has been quiet for ≥ `inactive_days` days, send the matching re-engagement template — one per run.

Dedup is via `push_logs.template_key`: a user only ever gets a given template once.

Manual trigger for testing: `POST /admin/push/lifecycle-run` (admin key required).

---

## Frontend integration

### Registration flow (`services/pushNotifications.ts`)

1. `App.tsx` → after auth + onboarding (`user.username` is set), call `registerForPushNotifications()`.
2. The function:
   - Skips on simulators (`Device.isDevice === false`) — they can't get a real token.
   - Asks for OS permission (`Notifications.requestPermissionsAsync`).
   - Fetches the Expo push token (`getExpoPushTokenAsync({ projectId })`).
   - POSTs it to `PUT /users/me/push-token`.

This delays the OS permission prompt until the user has signed up + finished onboarding, which gives a much higher grant rate than asking on first launch.

### Tap → deep link

`setupNotificationListeners()` (called once in `App.tsx`) attaches:

- `addNotificationReceivedListener` — fires when the app is foregrounded.
- `addNotificationResponseReceivedListener` — fires on tap (any app state). Reads `data.deep_link` and calls `navigationRef.navigate(deepLink)`.

Supported deep-link routes are MainStack screens: `Timer`, `Sanctuary`, `Friends`, `Profile`, `Tips`, `Shop`, `TakeAction`.

### User-facing settings

The mobile app reads/writes prefs via `pushAPI.getPrefs()` / `pushAPI.updatePrefs(...)`. There's no settings UI yet — wire one up next time we touch `ProfileScreen` (single switch for master + four toggles for categories).

---

## Admin operations

Open `/dashboard-e9x2k/` → **🔔 Push** tab.

| Card | Purpose |
|------|---------|
| **Opt-in funnel** | % of users who have a token, master-on count, iOS vs Android split |
| **30-day metrics** | Sent / failed / dropped per category over the last 30 days |
| **Test push** | One-off send to a user_id you specify; bypasses prefs (uses `category=system`) |
| **Broadcast** | Send to a cohort. Cohorts: `all_with_token`, `active_7d`, `inactive_7d`, plus the four email-campaign cohorts |
| **Lifecycle pushes** | Run-now button for `_cron_lifecycle_pushes` (idempotent) |
| **Templates** | Edit title/body of any seeded template inline |
| **Recent sends** | Latest 50 rows from `push_logs` |

---

## iOS APNs setup (one-time)

Expo needs your APNs key to deliver to iOS devices. Run once per Apple Developer account:

```bash
cd /Users/munshi/Downloads/endura-v-2/frontend
eas credentials
# → Select iOS → Production → Push Notifications → Set up
# Follow the prompt to upload the APNs auth key (.p8) from
# Apple Developer → Certificates, Identifiers & Profiles → Keys.
```

The key only needs to be uploaded once; Expo stores it server-side.

To verify: after the next iOS build, send a test push from the admin dashboard. `push_logs.status='sent'` and an `expo_ticket_id` is populated within ~1s.

---

## Operational guardrails

- **Dead-token cleanup.** When Expo returns `DeviceNotRegistered`, `services/push.py` clears `users.push_token` automatically so we don't keep retrying.
- **Batch size.** Expo accepts up to 100 messages per `/push/send` request. `broadcast_to_users` chunks automatically.
- **Receipt verification.** Currently *not* polling `/push/getReceipts` — `push_logs.status='sent'` means "Expo accepted the ticket", not "the device displayed it". Add a receipts cron only if delivery analytics become essential.
- **Rate limiting.** `/users/me/push-token` is limited to 30/min per IP. The Expo push API itself has generous limits (no documented per-app cap below ~6,000/sec).
- **Fail-safe logging.** `_log` rolls back on its own exceptions so a logging failure never kills the parent transaction (e.g. badge-award commit).

---

## Where to extend

- **Open-tracking via PostHog.** Hook `Analytics.pushOpened(category, template_key)` into `addNotificationResponseReceivedListener`.
- **Time-zone-aware reminders.** Use `User.study_reminder_hour/minute` (already on the model) once we ask users to set it during onboarding.
- **Receipts cron.** Implement a 30-min job that calls `/push/getReceipts` for tickets sent in the last hour and updates `push_logs.status` to `delivered` or `failed`.
- **A/B testing.** Two `push_daily_reminder_*` variants are seeded but not yet rotated. Add a per-user hash-bucket to choose which one to send.
- **Quiet hours.** Don't send between 22:00 and 08:00 *local time*. Requires storing a coarse timezone on the user.
