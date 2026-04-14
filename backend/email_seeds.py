"""Default email template content, seeded on first run."""

DEFAULT_EMAIL_TEMPLATES = [
    {
        "template_key": "welcome",
        "name": "Welcome Email",
        "subject": "Welcome to Endura! 🌿🥚",
        "trigger_day": None,
        "inactive_days": None,
        "body_html": """<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:28px">Welcome to Endura!</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {name}, you're officially part of the flock.</p>
    <div style="background:#fff;border-radius:16px;padding:28px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 16px">
            Every minute you study hatches a real endangered animal — from Snow Leopards to Giant Pandas.
            Here's how to get started:
        </p>
        <table style="width:100%;border-collapse:collapse">
            <tr>
                <td style="padding:10px 12px;vertical-align:top;font-size:22px">🥚</td>
                <td style="padding:10px 0;color:#333;font-size:14px;line-height:1.6">
                    <strong>Set your first timer</strong> — pick a subject, choose your duration, and start studying.
                </td>
            </tr>
            <tr>
                <td style="padding:10px 12px;vertical-align:top;font-size:22px">🐾</td>
                <td style="padding:10px 0;color:#333;font-size:14px;line-height:1.6">
                    <strong>Hatch your first animal</strong> — earn eco-credits as you study and watch your egg hatch into a real endangered species.
                </td>
            </tr>
            <tr>
                <td style="padding:10px 12px;vertical-align:top;font-size:22px">👥</td>
                <td style="padding:10px 0;color:#333;font-size:14px;line-height:1.6">
                    <strong>Add your friends</strong> — compete on leaderboards, create study groups, and motivate each other.
                </td>
            </tr>
            <tr>
                <td style="padding:10px 12px;vertical-align:top;font-size:22px">🔥</td>
                <td style="padding:10px 0;color:#333;font-size:14px;line-height:1.6">
                    <strong>Build your streak</strong> — study every day to grow your streak and unlock badges.
                </td>
            </tr>
        </table>
    </div>
    <div style="text-align:center;margin-bottom:20px">
        <a href="https://endura.eco" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:600">Open Endura</a>
    </div>
    <p style="color:#999;font-size:12px;text-align:center;margin:0">
        Study smarter. Save wildlife. 🌍<br>
        <a href="https://instagram.com/endura.eco" style="color:#6B9B7A;text-decoration:none">Follow us on Instagram</a>
    </p>
</div>""",
    },
    {
        "template_key": "day_3",
        "name": "Day 3 — First Check-in",
        "subject": "Your First 3 Days on Endura 🐾",
        "trigger_day": 3,
        "inactive_days": None,
        "body_html": """<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">3 Days In!</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {name}, here's your progress so far.</p>
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">You've studied for <strong>{total_minutes} minutes</strong> and hatched <strong>{animals_count} animals</strong>.</p>
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">🔥 Current streak: <strong>{streak} days</strong></p>
        <p style="color:#333;font-size:14px;line-height:1.7;margin:0"><strong>Tip:</strong> Add friends to compete on the leaderboard and stay motivated!</p>
    </div>
    <div style="text-align:center"><a href="https://endura.eco" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:12px 28px;border-radius:12px;font-size:14px;font-weight:600">Open Endura</a></div>
    <p style="color:#999;font-size:11px;text-align:center;margin:16px 0 0">Study smarter. Save wildlife. 🌍</p>
</div>""",
    },
    {
        "template_key": "day_7",
        "name": "Day 7 — Week 1 Recap",
        "subject": "Your Week 1 Recap 🌿",
        "trigger_day": 7,
        "inactive_days": None,
        "body_html": """<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">Week 1 Complete!</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {name}, what a first week.</p>
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#333;font-size:15px">📚 Total study time</td><td style="padding:8px 0;color:#4A7C59;font-size:15px;font-weight:700;text-align:right">{total_minutes} min</td></tr>
            <tr><td style="padding:8px 0;color:#333;font-size:15px">🐾 Animals hatched</td><td style="padding:8px 0;color:#4A7C59;font-size:15px;font-weight:700;text-align:right">{animals_count}</td></tr>
            <tr><td style="padding:8px 0;color:#333;font-size:15px">🔥 Longest streak</td><td style="padding:8px 0;color:#4A7C59;font-size:15px;font-weight:700;text-align:right">{longest_streak} days</td></tr>
            <tr><td style="padding:8px 0;color:#333;font-size:15px">📝 Total sessions</td><td style="padding:8px 0;color:#4A7C59;font-size:15px;font-weight:700;text-align:right">{sessions}</td></tr>
        </table>
    </div>
    <p style="color:#555;font-size:14px;text-align:center;margin:0 0 16px">Every session helps protect endangered wildlife. Keep it going!</p>
    <div style="text-align:center"><a href="https://endura.eco" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:12px 28px;border-radius:12px;font-size:14px;font-weight:600">Open Endura</a></div>
    <p style="color:#999;font-size:11px;text-align:center;margin:16px 0 0">Study smarter. Save wildlife. 🌍</p>
</div>""",
    },
    {
        "template_key": "day_14",
        "name": "Day 14 — Two Week Milestone",
        "subject": "2 Weeks of Endura! 🎉",
        "trigger_day": 14,
        "inactive_days": None,
        "body_html": """<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">2 Weeks Strong!</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {name}, you're building a real habit.</p>
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">In 14 days, you've studied for <strong>{total_minutes} minutes</strong>, hatched <strong>{animals_count} animals</strong>, and built a streak of <strong>{longest_streak} days</strong>.</p>
        <p style="color:#333;font-size:14px;line-height:1.7;margin:0">Know someone who'd love Endura? Share the app with a friend — studying together makes it even better!</p>
    </div>
    <div style="text-align:center"><a href="https://apps.apple.com/app/endura-study-timer/id6759482612" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:12px 28px;border-radius:12px;font-size:14px;font-weight:600">Share Endura</a></div>
    <p style="color:#999;font-size:11px;text-align:center;margin:16px 0 0">Study smarter. Save wildlife. 🌍</p>
</div>""",
    },
    {
        "template_key": "day_30",
        "name": "Day 30 — Month Milestone",
        "subject": "Your First Month with Endura 🌟",
        "trigger_day": 30,
        "inactive_days": None,
        "body_html": """<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">1 Month!</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {name}, you're officially an Endura regular.</p>
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#333;font-size:15px">📚 Total study time</td><td style="padding:8px 0;color:#4A7C59;font-size:15px;font-weight:700;text-align:right">{total_minutes} min</td></tr>
            <tr><td style="padding:8px 0;color:#333;font-size:15px">🐾 Animals hatched</td><td style="padding:8px 0;color:#4A7C59;font-size:15px;font-weight:700;text-align:right">{animals_count}</td></tr>
            <tr><td style="padding:8px 0;color:#333;font-size:15px">🏆 Badges earned</td><td style="padding:8px 0;color:#4A7C59;font-size:15px;font-weight:700;text-align:right">{badges}</td></tr>
            <tr><td style="padding:8px 0;color:#333;font-size:15px">🔥 Best streak</td><td style="padding:8px 0;color:#4A7C59;font-size:15px;font-weight:700;text-align:right">{longest_streak} days</td></tr>
            <tr><td style="padding:8px 0;color:#333;font-size:15px">📝 Total sessions</td><td style="padding:8px 0;color:#4A7C59;font-size:15px;font-weight:700;text-align:right">{sessions}</td></tr>
        </table>
    </div>
    <p style="color:#555;font-size:14px;text-align:center;margin:0 0 16px">Enjoying Endura? A quick review on the App Store helps other students find us ⭐</p>
    <div style="text-align:center"><a href="https://apps.apple.com/app/endura-study-timer/id6759482612?action=write-review" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:12px 28px;border-radius:12px;font-size:14px;font-weight:600">Leave a Review</a></div>
    <p style="color:#999;font-size:11px;text-align:center;margin:16px 0 0">Study smarter. Save wildlife. 🌍</p>
</div>""",
    },
    {
        "template_key": "reengagement",
        "name": "Re-engagement (Inactive Users)",
        "subject": "Your animals miss you, {name}! 🐾",
        "trigger_day": None,
        "inactive_days": 5,
        "body_html": """<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">We miss you!</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">It's been a few days since your last session.</p>
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">Your sanctuary is waiting and there are still more species left to discover.</p>
        <p style="color:#333;font-size:14px;line-height:1.7;margin:0">Even a quick 15-minute session earns eco-credits and keeps your progress going. Your {streak}-day streak is at risk!</p>
    </div>
    <div style="text-align:center"><a href="https://endura.eco" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:12px 28px;border-radius:12px;font-size:14px;font-weight:600">Start a Quick Session</a></div>
    <p style="color:#999;font-size:11px;text-align:center;margin:16px 0 0">Study smarter. Save wildlife. 🌍</p>
</div>""",
    },
    {
        "template_key": "android_invite",
        "name": "Android Beta Invite",
        "subject": "You're in! Endura is ready on Android 🎉",
        "trigger_day": None,
        "inactive_days": None,
        "body_html": """<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:28px">You're in!</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Endura is now available for you on Android.</p>
    <div style="background:#fff;border-radius:16px;padding:28px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 16px">
            Thanks for signing up for the Android beta! You can now download Endura and start
            turning your study sessions into real wildlife conservation.
        </p>
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 8px">
            <strong>To get started:</strong>
        </p>
        <ol style="color:#333;font-size:14px;line-height:2;margin:0 0 16px;padding-left:20px">
            <li>Click the link below to join the beta</li>
            <li>Accept the invitation on Google Play</li>
            <li>Download Endura from the Play Store</li>
            <li>Create your account and start studying!</li>
        </ol>
    </div>
    <div style="text-align:center;margin-bottom:20px">
        <a href="https://play.google.com/apps/testing/com.endura.study"
           style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:600">
            Join the Android Beta
        </a>
    </div>
    <p style="color:#999;font-size:12px;text-align:center;margin:0">
        Study smarter. Save wildlife. 🌍<br>
        <a href="https://endura.eco" style="color:#6B9B7A;text-decoration:none">endura.eco</a> ·
        <a href="https://instagram.com/endura.eco" style="color:#6B9B7A;text-decoration:none">@endura.eco</a>
    </p>
</div>""",
    },
]
