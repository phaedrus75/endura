"""Default push notification templates, seeded on first run.

Lifecycle templates (`trigger_day` set) are sent by the daily cron at the
specified day-since-signup. Re-engagement templates (`inactive_days` set) fire
when a user has been quiet for that many days. Campaigns and ad-hoc sends
reference templates by key from the admin dashboard.

Body strings are kept short (<150 chars to be safe across iOS/Android) and
include {placeholder} variables that PushTemplate rendering replaces. Available
variables: {name} {streak} {longest_streak} {sessions} {animals_count}
{badges} {total_minutes}
"""

DEFAULT_PUSH_TEMPLATES = [
    # ── Lifecycle: nudge the user across the activation funnel ──
    {
        "template_key": "push_day1_welcome",
        "name": "Day 1 — Welcome nudge",
        "title": "Welcome to Endura, {name}! 🌿",
        "body": "Set your first 25-min timer and watch a real animal hatch. Tap to start.",
        "category": "campaign",
        "deep_link": "Timer",
        "trigger_day": 1,
    },
    {
        "template_key": "push_day2_first_timer",
        "name": "Day 2 — Start a timer",
        "title": "Your egg is waiting 🥚",
        "body": "A single 25-min session is all it takes to hatch your first animal. Let's go.",
        "category": "campaign",
        "deep_link": "Timer",
        "trigger_day": 2,
    },
    {
        "template_key": "push_day3_streak",
        "name": "Day 3 — Build the streak",
        "title": "Day 3 — keep the streak alive 🔥",
        "body": "Study just 25 minutes today to start a 3-day streak and unlock a badge.",
        "category": "campaign",
        "deep_link": "Timer",
        "trigger_day": 3,
    },
    {
        "template_key": "push_day7_friends",
        "name": "Day 7 — Add friends",
        "title": "Study buddies = streaks 👯",
        "body": "Endura is more fun with friends. Add one and compete on the leaderboard.",
        "category": "campaign",
        "deep_link": "Friends",
        "trigger_day": 7,
    },
    {
        "template_key": "push_day14_donate",
        "name": "Day 14 — Donate to wildlife",
        "title": "You've studied {total_minutes} mins — convert it 💚",
        "body": "Turn your effort into real wildlife protection. $1 funds 30 mins of conservation.",
        "category": "campaign",
        "deep_link": "TakeAction",
        "trigger_day": 14,
    },

    # ── Re-engagement: only fires when the user has been quiet ──
    {
        "template_key": "push_reengage_3d",
        "name": "Re-engagement — 3 days quiet",
        "title": "Your streak is at risk ⚠️",
        "body": "{streak}-day streak still alive. A quick session today keeps it going.",
        "category": "reminder",
        "deep_link": "Timer",
        "inactive_days": 3,
    },
    {
        "template_key": "push_reengage_7d",
        "name": "Re-engagement — 7 days quiet",
        "title": "Your animals miss you 🐼",
        "body": "It's been a week. Come back and hatch something new — your eco-credits are waiting.",
        "category": "reminder",
        "deep_link": "Sanctuary",
        "inactive_days": 7,
    },

    # ── Event-driven: triggered inline by main.py ──
    {
        "template_key": "push_badge_earned",
        "name": "Badge earned",
        "title": "Badge earned! 🏅",
        "body": "{name}, you just unlocked {badge_name}. Tap to see your collection.",
        "category": "badge",
        "deep_link": "Profile",
    },
    {
        "template_key": "push_friend_request",
        "name": "Friend request received",
        "title": "{from_name} wants to be friends 👋",
        "body": "Tap to accept and start studying together.",
        "category": "friend",
        "deep_link": "Friends",
    },
    {
        "template_key": "push_friend_accepted",
        "name": "Friend accepted",
        "title": "{from_name} accepted your friend request 🎉",
        "body": "You're now friends on Endura. Send them a tip or join a study group.",
        "category": "friend",
        "deep_link": "Friends",
    },
    {
        "template_key": "push_friend_reacted",
        "name": "Friend reacted to activity",
        "title": "{from_name} reacted {emoji}",
        "body": "{from_name} {message} \"{event_description}\"",
        "category": "friend",
        "deep_link": "Social",
    },
    {
        "template_key": "push_donation_thank_you",
        "name": "Donation thank-you",
        "title": "Thanks for donating! 💚",
        "body": "Your ${amount} just funded real wildlife conservation through WWF.",
        "category": "system",
        "deep_link": "TakeAction",
    },

    # ── Daily reminder: rotated by the cron ──
    {
        "template_key": "push_daily_reminder_a",
        "name": "Daily reminder — variant A",
        "title": "Time to study 📚",
        "body": "Your {streak}-day streak is one session away. Tap to start.",
        "category": "reminder",
        "deep_link": "Timer",
    },
    {
        "template_key": "push_daily_reminder_b",
        "name": "Daily reminder — variant B",
        "title": "Don't break the streak 🔥",
        "body": "A 25-minute session is all it takes today. Your animals are waiting.",
        "category": "reminder",
        "deep_link": "Timer",
    },

    # ── Local (device-scheduled) notifications ──
    # These are scheduled directly by the mobile app via expo-notifications and
    # never go through Expo Push API. The device pings POST /push/local-fired
    # when they actually deliver, so they show up in admin metrics. We seed the
    # template so it appears in the dashboard's template list and can be edited
    # without redeploying the app.
    {
        "template_key": "push_timer_done",
        "name": "Timer complete (local)",
        "title": "Your timer is done! Tap to hatch egg 🥚",
        "body": "{minutes} minutes of focus complete — open Endura to hatch your animal.",
        "category": "local",
        "deep_link": "Timer",
    },

    # ── Session recovered by server-side reaper ──
    # Sent when a study session was started but never finalised by the client
    # (app force-killed mid-timer, device offline, user closed before tapping
    # Complete) and the reaper auto-credited it. Reactivation hook: the user
    # might have thought their session was lost — this push tells them it was
    # saved and brings them back to hatch the animal. Category="reminder" so
    # users who turned off study-reminder pushes are respected. The push
    # service skips users without a valid token; backend will email-fall-back
    # in that case via _notify_session_recovered.
    {
        "template_key": "push_session_recovered",
        "name": "Session recovered (server)",
        "title": "Your study session was saved 🌳",
        "body": "{minutes} min of {subject} — open Endura to hatch your animal.",
        "category": "reminder",
        "deep_link": "Timer",
    },

    # ── Support: admin reply to in-app feedback (deep_link set per-send) ──
    {
        "template_key": "support_reply",
        "name": "Support team replied to feedback",
        "title": "The Endura team replied",
        "body": "{preview}",
        "category": "system",
        "deep_link": None,
    },
]
