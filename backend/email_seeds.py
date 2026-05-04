"""Default email template content, seeded on first run."""

_IMG_BASE = "https://www.endura.eco/animals"

def _animal_img(name):
    slug = name.replace(" ", "%20")
    return f'<div style="text-align:center;margin-bottom:20px"><img src="{_IMG_BASE}/{slug}.png" alt="{name}" style="width:140px;height:140px;border-radius:50%;object-fit:cover;border:4px solid #fff;box-shadow:0 4px 16px rgba(0,0,0,.1)" /></div>'


DEFAULT_EMAIL_TEMPLATES = [
    {
        "template_key": "welcome",
        "name": "Welcome Email",
        "subject": "Welcome to Endura! 🌿🥚",
        "trigger_day": None,
        "inactive_days": None,
        "body_html": f"""<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:28px">Welcome to Endura!</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {{name}}, you're officially part of the flock.</p>
    {_animal_img("panda")}
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
        <a href="https://apps.apple.com/app/endura-study-timer/id6759482612" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:600">Open Endura</a>
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
        "body_html": f"""<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">3 Days In!</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {{name}}, here's your progress so far.</p>
    {_animal_img("red panda")}
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">You've studied for <strong>{{total_minutes}} minutes</strong> and hatched <strong>{{animals_count}} animals</strong>.</p>
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">🔥 Current streak: <strong>{{streak}} days</strong></p>
        <p style="color:#333;font-size:14px;line-height:1.7;margin:0"><strong>Tip:</strong> Add friends to compete on the leaderboard and stay motivated!</p>
    </div>
    <div style="text-align:center"><a href="https://apps.apple.com/app/endura-study-timer/id6759482612" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:12px 28px;border-radius:12px;font-size:14px;font-weight:600">Open Endura</a></div>
    <p style="color:#999;font-size:11px;text-align:center;margin:16px 0 0">Study smarter. Save wildlife. 🌍</p>
</div>""",
    },
    {
        "template_key": "day_7",
        "name": "Day 7 — Week 1 Recap",
        "subject": "Your Week 1 Recap 🌿",
        "trigger_day": 7,
        "inactive_days": None,
        "body_html": f"""<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">Week 1 Complete!</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {{name}}, what a first week.</p>
    {_animal_img("koala")}
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#333;font-size:15px">📚 Total study time</td><td style="padding:8px 0;color:#4A7C59;font-size:15px;font-weight:700;text-align:right">{{total_minutes}} min</td></tr>
            <tr><td style="padding:8px 0;color:#333;font-size:15px">🐾 Animals hatched</td><td style="padding:8px 0;color:#4A7C59;font-size:15px;font-weight:700;text-align:right">{{animals_count}}</td></tr>
            <tr><td style="padding:8px 0;color:#333;font-size:15px">🔥 Longest streak</td><td style="padding:8px 0;color:#4A7C59;font-size:15px;font-weight:700;text-align:right">{{longest_streak}} days</td></tr>
            <tr><td style="padding:8px 0;color:#333;font-size:15px">📝 Total sessions</td><td style="padding:8px 0;color:#4A7C59;font-size:15px;font-weight:700;text-align:right">{{sessions}}</td></tr>
        </table>
    </div>
    <p style="color:#555;font-size:14px;text-align:center;margin:0 0 16px">Every session helps protect endangered wildlife. Keep it going!</p>
    <div style="text-align:center"><a href="https://apps.apple.com/app/endura-study-timer/id6759482612" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:12px 28px;border-radius:12px;font-size:14px;font-weight:600">Open Endura</a></div>
    <p style="color:#999;font-size:11px;text-align:center;margin:16px 0 0">Study smarter. Save wildlife. 🌍</p>
</div>""",
    },
    {
        "template_key": "day_14",
        "name": "Day 14 — Two Week Milestone",
        "subject": "2 Weeks of Endura! 🎉",
        "trigger_day": 14,
        "inactive_days": None,
        "body_html": f"""<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">2 Weeks Strong!</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {{name}}, you're building a real habit.</p>
    {_animal_img("grizzly bear")}
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">In 14 days, you've studied for <strong>{{total_minutes}} minutes</strong>, hatched <strong>{{animals_count}} animals</strong>, and built a streak of <strong>{{longest_streak}} days</strong>.</p>
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
        "body_html": f"""<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">1 Month!</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {{name}}, you're officially an Endura regular.</p>
    {_animal_img("mountain gorilla")}
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#333;font-size:15px">📚 Total study time</td><td style="padding:8px 0;color:#4A7C59;font-size:15px;font-weight:700;text-align:right">{{total_minutes}} min</td></tr>
            <tr><td style="padding:8px 0;color:#333;font-size:15px">🐾 Animals hatched</td><td style="padding:8px 0;color:#4A7C59;font-size:15px;font-weight:700;text-align:right">{{animals_count}}</td></tr>
            <tr><td style="padding:8px 0;color:#333;font-size:15px">🏆 Badges earned</td><td style="padding:8px 0;color:#4A7C59;font-size:15px;font-weight:700;text-align:right">{{badges}}</td></tr>
            <tr><td style="padding:8px 0;color:#333;font-size:15px">🔥 Best streak</td><td style="padding:8px 0;color:#4A7C59;font-size:15px;font-weight:700;text-align:right">{{longest_streak}} days</td></tr>
            <tr><td style="padding:8px 0;color:#333;font-size:15px">📝 Total sessions</td><td style="padding:8px 0;color:#4A7C59;font-size:15px;font-weight:700;text-align:right">{{sessions}}</td></tr>
        </table>
    </div>
    <p style="color:#555;font-size:14px;text-align:center;margin:0 0 16px">Enjoying Endura? A quick review on the App Store helps other students find us ⭐</p>
    <div style="text-align:center"><a href="https://apps.apple.com/app/endura-study-timer/id6759482612?action=write-review" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:12px 28px;border-radius:12px;font-size:14px;font-weight:600">Leave a Review</a></div>
    <p style="color:#999;font-size:11px;text-align:center;margin:16px 0 0">Study smarter. Save wildlife. 🌍</p>
</div>""",
    },
    {
        "template_key": "reengagement",
        "name": "Re-engagement — Beginner (1 session)",
        "subject": "Your first animal is waiting, {name}! 🥚",
        "trigger_day": None,
        "inactive_days": 2,
        "min_sessions": 1,
        "max_sessions": 2,
        "min_streak": None,
        "max_streak": 1,
        "body_html": f"""<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">Don't stop now!</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">You tried Endura — now let's make it a habit.</p>
    {_animal_img("axolotl")}
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">You've already studied for <strong>{{total_minutes}} minutes</strong> — that's a great start! Students who study for a second day are <strong>3x more likely</strong> to build a lasting habit.</p>
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0">Even a quick 15-minute session will earn eco-credits and get you closer to hatching your next animal. Your egg is almost ready! 🥚</p>
    </div>
    <div style="text-align:center"><a href="https://apps.apple.com/app/endura-study-timer/id6759482612" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:12px 28px;border-radius:12px;font-size:14px;font-weight:600">Start a Quick Session</a></div>
    <p style="color:#999;font-size:11px;text-align:center;margin:16px 0 0">Study smarter. Save wildlife. 🌍</p>
</div>""",
    },
    {
        "template_key": "reengagement_intermediate",
        "name": "Re-engagement — Intermediate (3+ sessions)",
        "subject": "Your {streak}-day streak is fading, {name}! 🔥",
        "trigger_day": None,
        "inactive_days": 3,
        "min_sessions": 3,
        "max_sessions": None,
        "min_streak": 2,
        "max_streak": 4,
        "body_html": f"""<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">Your streak is slipping!</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {{name}}, you were building real momentum.</p>
    {_animal_img("polar bear")}
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">You've completed <strong>{{sessions}} study sessions</strong> and built a streak of <strong>{{longest_streak}} days</strong>. That's impressive — don't let it go!</p>
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0">Your <strong>{{animals_count}} animals</strong> are waiting in your sanctuary. One session today keeps the streak alive and earns you more eco-credits.</p>
    </div>
    <div style="text-align:center"><a href="https://apps.apple.com/app/endura-study-timer/id6759482612" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:12px 28px;border-radius:12px;font-size:14px;font-weight:600">Keep Your Streak Going</a></div>
    <p style="color:#999;font-size:11px;text-align:center;margin:16px 0 0">Study smarter. Save wildlife. 🌍</p>
</div>""",
    },
    {
        "template_key": "reengagement_power",
        "name": "Re-engagement — Power User (4+ sessions, 5+ streak)",
        "subject": "We miss you, {name}! Your sanctuary needs you 🌿",
        "trigger_day": None,
        "inactive_days": 4,
        "min_sessions": 4,
        "max_sessions": None,
        "min_streak": 5,
        "max_streak": None,
        "body_html": f"""<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">Your sanctuary misses you!</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {{name}}, it's been a while since your last session.</p>
    {_animal_img("mountain gorilla")}
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">You've built an incredible record: <strong>{{total_minutes}} minutes</strong> studied, <strong>{{animals_count}} animals</strong> hatched, and a best streak of <strong>{{longest_streak}} days</strong>.</p>
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">Your friends on Endura are still competing — jump back in and reclaim your spot on the leaderboard!</p>
        <p style="color:#333;font-size:14px;line-height:1.7;margin:0"><strong>New since you left:</strong> Study tips, more animals to discover, and group challenges. Come see what's new.</p>
    </div>
    <div style="text-align:center"><a href="https://apps.apple.com/app/endura-study-timer/id6759482612" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:12px 28px;border-radius:12px;font-size:14px;font-weight:600">Return to Your Sanctuary</a></div>
    <p style="color:#999;font-size:11px;text-align:center;margin:16px 0 0">Study smarter. Save wildlife. 🌍</p>
</div>""",
    },
    {
        "template_key": "reengagement_b2",
        "name": "Re-engagement — Beginner drop 2",
        "subject": "Still here? Your egg misses you, {name} 🥚",
        "trigger_day": None,
        "inactive_days": 5,
        "min_sessions": 1,
        "max_sessions": 2,
        "min_streak": None,
        "max_streak": 1,
        "body_html": f"""<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">New species are waiting</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {{name}}, it's been almost a week since we saw you.</p>
    {_animal_img("red panda")}
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">Every study session unlocks more endangered animals to hatch — from red pandas to sea turtles. You've already started — don't leave your sanctuary empty.</p>
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0">Open Endura for just <strong>15 minutes</strong> today and you'll earn eco-credits toward your next hatch.</p>
    </div>
    <div style="text-align:center"><a href="https://apps.apple.com/app/endura-study-timer/id6759482612" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:12px 28px;border-radius:12px;font-size:14px;font-weight:600">Open Endura</a></div>
    <p style="color:#999;font-size:11px;text-align:center;margin:16px 0 0">Study smarter. Save wildlife. 🌍</p>
</div>""",
    },
    {
        "template_key": "reengagement_b3",
        "name": "Re-engagement — Beginner drop 3",
        "subject": "One last nudge — your wildlife needs you, {name}",
        "trigger_day": None,
        "inactive_days": 7,
        "min_sessions": 1,
        "max_sessions": 2,
        "min_streak": None,
        "max_streak": 1,
        "body_html": f"""<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">Thousands of students are studying today</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {{name}}, you're not alone — Endura is buzzing with study sessions right now.</p>
    {_animal_img("koala")}
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">This is our final gentle reminder. When you're ready, your timer, your animals, and your progress will be right where you left them.</p>
        <p style="color:#333;font-size:14px;line-height:1.7;margin:0">Tap below — even a short session helps real conservation. We'd love to have you back.</p>
    </div>
    <div style="text-align:center"><a href="https://apps.apple.com/app/endura-study-timer/id6759482612" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:12px 28px;border-radius:12px;font-size:14px;font-weight:600">Come Back Today</a></div>
    <p style="color:#999;font-size:11px;text-align:center;margin:16px 0 0">Study smarter. Save wildlife. 🌍</p>
</div>""",
    },
    {
        "template_key": "reengagement_i2",
        "name": "Re-engagement — Intermediate drop 2",
        "subject": "Your friends are still on the leaderboard, {name}",
        "trigger_day": None,
        "inactive_days": 6,
        "min_sessions": 3,
        "max_sessions": None,
        "min_streak": 2,
        "max_streak": 4,
        "body_html": f"""<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">Don't let them pass you!</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {{name}}, your study group and friends are still racking up minutes.</p>
    {_animal_img("amur leopard")}
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">You've proven you can stick with it — <strong>{{sessions}} sessions</strong> and a <strong>{{longest_streak}}-day</strong> best streak. A single session today puts you back in the game.</p>
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0">Check the leaderboard — friendly competition is one of the best motivators to study.</p>
    </div>
    <div style="text-align:center"><a href="https://apps.apple.com/app/endura-study-timer/id6759482612" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:12px 28px;border-radius:12px;font-size:14px;font-weight:600">Jump Back In</a></div>
    <p style="color:#999;font-size:11px;text-align:center;margin:16px 0 0">Study smarter. Save wildlife. 🌍</p>
</div>""",
    },
    {
        "template_key": "reengagement_i3",
        "name": "Re-engagement — Intermediate drop 3",
        "subject": "Last call — your streak record is worth saving, {name}",
        "trigger_day": None,
        "inactive_days": 9,
        "min_sessions": 3,
        "max_sessions": None,
        "min_streak": 2,
        "max_streak": 4,
        "body_html": f"""<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">You worked hard for that streak</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {{name}}, we won't keep emailing forever — but we didn't want you to lose what you built.</p>
    {_animal_img("grizzly bear")}
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">Students who return after a break often beat their old records. Your <strong>{{animals_count}} animals</strong> and <strong>{{total_minutes}} minutes</strong> of study time are still yours.</p>
        <p style="color:#333;font-size:14px;line-height:1.7;margin:0">One session — that's all it takes to feel like yourself again.</p>
    </div>
    <div style="text-align:center"><a href="https://apps.apple.com/app/endura-study-timer/id6759482612" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:12px 28px;border-radius:12px;font-size:14px;font-weight:600">Start One Session</a></div>
    <p style="color:#999;font-size:11px;text-align:center;margin:16px 0 0">Study smarter. Save wildlife. 🌍</p>
</div>""",
    },
    {
        "template_key": "reengagement_p2",
        "name": "Re-engagement — Power user drop 2",
        "subject": "The sanctuary is quiet without you, {name}",
        "trigger_day": None,
        "inactive_days": 7,
        "min_sessions": 4,
        "max_sessions": None,
        "min_streak": 5,
        "max_streak": None,
        "body_html": f"""<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">You're a core part of the flock</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {{name}}, power users like you inspire others.</p>
    {_animal_img("blue whale")}
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">New study tips, seasonal challenges, and more species have landed since you last opened the app. Your <strong>{{longest_streak}}-day</strong> personal best is waiting to be extended.</p>
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0">Your groups and friends haven't forgotten you — open Endura and say hello.</p>
    </div>
    <div style="text-align:center"><a href="https://apps.apple.com/app/endura-study-timer/id6759482612" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:12px 28px;border-radius:12px;font-size:14px;font-weight:600">Explore What's New</a></div>
    <p style="color:#999;font-size:11px;text-align:center;margin:16px 0 0">Study smarter. Save wildlife. 🌍</p>
</div>""",
    },
    {
        "template_key": "reengagement_p3",
        "name": "Re-engagement — Power user drop 3",
        "subject": "We'll be here — whenever you're ready, {name}",
        "trigger_day": None,
        "inactive_days": 10,
        "min_sessions": 4,
        "max_sessions": None,
        "min_streak": 5,
        "max_streak": None,
        "body_html": f"""<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">This is our last re-engagement email</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {{name}}, we respect your inbox.</p>
    {_animal_img("panda")}
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">You've done amazing things in Endura — <strong>{{total_minutes}} minutes</strong> studied and <strong>{{animals_count}} animals</strong> hatched. If life got busy, that's okay.</p>
        <p style="color:#333;font-size:14px;line-height:1.7;margin:0">Whenever you're ready, open the app: your sanctuary, badges, and friends will be waiting. No pressure — just wildlife that misses you a little.</p>
    </div>
    <div style="text-align:center"><a href="https://apps.apple.com/app/endura-study-timer/id6759482612" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:12px 28px;border-radius:12px;font-size:14px;font-weight:600">Open Endura</a></div>
    <p style="color:#999;font-size:11px;text-align:center;margin:16px 0 0">Study smarter. Save wildlife. 🌍</p>
</div>""",
    },
    {
        "template_key": "campaign_verify_email",
        "name": "Campaign — Verify Your Email",
        "subject": "One step left to start saving wildlife! ✉️",
        "trigger_day": None,
        "inactive_days": None,
        "body_html": f"""<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">You're almost there!</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {{name}}, you signed up for Endura but haven't verified your email yet.</p>
    {_animal_img("axolotl")}
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">
            Verifying takes 10 seconds — just open the app, check for the code in your inbox, and enter it.
        </p>
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0">
            Once verified, every minute you study will hatch endangered animals and contribute to real conservation. Your first egg is waiting! 🥚
        </p>
    </div>
    <div style="text-align:center;margin-bottom:20px">
        <a href="https://apps.apple.com/app/endura-study-timer/id6759482612" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:600">Open Endura & Verify</a>
    </div>
    <p style="color:#999;font-size:12px;text-align:center;margin:0">
        Study smarter. Save wildlife. 🌍<br>
        <a href="https://instagram.com/endura.eco" style="color:#6B9B7A;text-decoration:none">@endura.eco</a>
    </p>
</div>""",
    },
    {
        "template_key": "campaign_start_timer",
        "name": "Campaign — Start Your First Timer",
        "subject": "Your first egg is ready to hatch! 🥚",
        "trigger_day": None,
        "inactive_days": None,
        "body_html": f"""<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">Set up your first timer!</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {{name}}, you're all set — just one study session away from hatching your first animal.</p>
    {_animal_img("otter")}
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 16px">Here's how easy it is:</p>
        <table style="width:100%;border-collapse:collapse">
            <tr>
                <td style="padding:8px 12px;vertical-align:top;font-size:20px">1️⃣</td>
                <td style="padding:8px 0;color:#333;font-size:14px;line-height:1.6">
                    Open Endura and tap <strong>Start Timer</strong>
                </td>
            </tr>
            <tr>
                <td style="padding:8px 12px;vertical-align:top;font-size:20px">2️⃣</td>
                <td style="padding:8px 0;color:#333;font-size:14px;line-height:1.6">
                    Pick a subject and choose your duration (even 15 min works!)
                </td>
            </tr>
            <tr>
                <td style="padding:8px 12px;vertical-align:top;font-size:20px">3️⃣</td>
                <td style="padding:8px 0;color:#333;font-size:14px;line-height:1.6">
                    Study, earn eco-credits, and watch your egg hatch into a real endangered species
                </td>
            </tr>
        </table>
    </div>
    <div style="text-align:center;margin-bottom:20px">
        <a href="https://apps.apple.com/app/endura-study-timer/id6759482612" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:600">Start Your First Timer</a>
    </div>
    <p style="color:#999;font-size:12px;text-align:center;margin:0">
        Study smarter. Save wildlife. 🌍<br>
        <a href="https://instagram.com/endura.eco" style="color:#6B9B7A;text-decoration:none">@endura.eco</a>
    </p>
</div>""",
    },
    {
        "template_key": "campaign_second_timer",
        "name": "Campaign — Come Back for Session 2",
        "subject": "Your animal is growing — keep it going! 🐾",
        "trigger_day": None,
        "inactive_days": None,
        "body_html": f"""<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">Great first session!</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {{name}}, you've made a real start — now let's build the habit.</p>
    {_animal_img("chinchilla")}
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">
            You've studied for <strong>{{total_minutes}} minutes</strong> so far. Students who complete a second session within 48 hours are <strong>3x more likely</strong> to build a lasting study habit.
        </p>
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0">
            Your sanctuary has room for more animals — start another timer and see what hatches next! 🥚
        </p>
    </div>
    <div style="text-align:center;margin-bottom:20px">
        <a href="https://apps.apple.com/app/endura-study-timer/id6759482612" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:600">Start Another Session</a>
    </div>
    <p style="color:#999;font-size:12px;text-align:center;margin:0">
        Study smarter. Save wildlife. 🌍<br>
        <a href="https://instagram.com/endura.eco" style="color:#6B9B7A;text-decoration:none">@endura.eco</a>
    </p>
</div>""",
    },
    {
        "template_key": "campaign_invite_friends",
        "name": "Campaign — Invite Friends & Form Groups",
        "subject": "Study together, save more wildlife! 👥🌍",
        "trigger_day": None,
        "inactive_days": None,
        "body_html": f"""<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">You're on a roll!</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {{name}}, you've completed {{sessions}} study sessions — that's amazing.</p>
    {_animal_img("langur monkey")}
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">
            Studies show students who study with friends are <strong>more focused and consistent</strong>.
            Invite your classmates to Endura — compete on leaderboards, form study groups, and save wildlife together!
        </p>
        <p style="color:#333;font-size:14px;line-height:1.7;margin:0 0 4px"><strong>Share these links with friends:</strong></p>
        <table style="width:100%;border-collapse:collapse;margin-top:8px">
            <tr>
                <td style="padding:8px 0">
                    <a href="https://apps.apple.com/app/endura-study-timer/id6759482612" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600"> iPhone / iPad</a>
                </td>
                <td style="padding:8px 0">
                    <a href="https://play.google.com/apps/testing/com.endura.study" style="display:inline-block;background:#34A853;color:#fff;text-decoration:none;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600"> Android (Beta)</a>
                </td>
            </tr>
        </table>
    </div>
    <div style="background:#fff;border-radius:16px;padding:20px;margin-bottom:20px">
        <p style="color:#333;font-size:14px;line-height:1.7;margin:0"><strong>Tip:</strong> Create a study group in the app — tap <em>Groups</em> in the bottom bar, hit <em>Create Group</em>, and invite your friends by username. You'll see each other's progress in real time!</p>
    </div>
    <div style="text-align:center;margin-bottom:20px">
        <a href="https://apps.apple.com/app/endura-study-timer/id6759482612" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:600">Open Endura</a>
    </div>
    <p style="color:#999;font-size:12px;text-align:center;margin:0">
        Study smarter. Save wildlife. 🌍<br>
        <a href="https://instagram.com/endura.eco" style="color:#6B9B7A;text-decoration:none">@endura.eco</a>
    </p>
</div>""",
    },
    {
        "template_key": "campaign_verify_email_2",
        "name": "Campaign — Verify Email (reminder 2)",
        "subject": "Still waiting to verify — your egg can't hatch yet! 🥚",
        "trigger_day": None,
        "inactive_days": None,
        "body_html": f"""<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">Quick reminder</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {{name}}, we're holding your spot — verify your email so you can start hatching real wildlife.</p>
    {_animal_img("sea turtle")}
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">Open Endura, enter the code from your inbox, and you're in. It takes less than a minute.</p>
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0">Every verified student helps us grow the flock protecting endangered species. 🌿</p>
    </div>
    <div style="text-align:center;margin-bottom:20px">
        <a href="https://apps.apple.com/app/endura-study-timer/id6759482612" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:600">Open Endura & Verify</a>
    </div>
    <p style="color:#999;font-size:12px;text-align:center;margin:0">Study smarter. Save wildlife. 🌍</p>
</div>""",
    },
    {
        "template_key": "campaign_verify_email_3",
        "name": "Campaign — Verify Email (reminder 3)",
        "subject": "Last nudge: verify to unlock Endura ✉️🐾",
        "trigger_day": None,
        "inactive_days": None,
        "body_html": f"""<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">We'd love to have you</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {{name}}, this is our last verify reminder — after that we'll leave your inbox in peace.</p>
    {_animal_img("fennec fox")}
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">Verify once, then study anytime: your sanctuary, streaks, and conservation impact all start there.</p>
        <p style="color:#333;font-size:14px;line-height:1.7;margin:0">If you didn't mean to sign up, you can ignore this — no hard feelings.</p>
    </div>
    <div style="text-align:center;margin-bottom:20px">
        <a href="https://apps.apple.com/app/endura-study-timer/id6759482612" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:600">Verify in the app</a>
    </div>
    <p style="color:#999;font-size:12px;text-align:center;margin:0">Study smarter. Save wildlife. 🌍</p>
</div>""",
    },
    {
        "template_key": "campaign_start_timer_2",
        "name": "Campaign — Start Timer (reminder 2)",
        "subject": "15 minutes is enough to hatch your first animal 🥚",
        "trigger_day": None,
        "inactive_days": None,
        "body_html": f"""<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">Start small</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {{name}}, you don't need a long block — even a short timer counts toward your first hatch.</p>
    {_animal_img("hedgehog")}
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">Pick any subject, tap Start, and let the egg do the rest. Your first endangered animal is one session away.</p>
        <p style="color:#333;font-size:14px;line-height:1.7;margin:0">You've got this — the flock is rooting for you. 🌿</p>
    </div>
    <div style="text-align:center;margin-bottom:20px">
        <a href="https://apps.apple.com/app/endura-study-timer/id6759482612" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:600">Open Endura</a>
    </div>
    <p style="color:#999;font-size:12px;text-align:center;margin:0">Study smarter. Save wildlife. 🌍</p>
</div>""",
    },
    {
        "template_key": "campaign_start_timer_3",
        "name": "Campaign — Start Timer (reminder 3)",
        "subject": "Your first timer is still waiting 🌿",
        "trigger_day": None,
        "inactive_days": None,
        "body_html": f"""<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">Whenever you're ready</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {{name}}, Endura works best when you try one real session — then the habit builds naturally.</p>
    {_animal_img("beaver")}
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">This is our last nudge on getting started. Open the app, start any timer length, and watch conservation credits roll in as you focus.</p>
        <p style="color:#333;font-size:14px;line-height:1.7;margin:0">We're here when you are — no pressure, just wildlife that could use your study time.</p>
    </div>
    <div style="text-align:center;margin-bottom:20px">
        <a href="https://apps.apple.com/app/endura-study-timer/id6759482612" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:600">Start a timer</a>
    </div>
    <p style="color:#999;font-size:12px;text-align:center;margin:0">Study smarter. Save wildlife. 🌍</p>
</div>""",
    },
    {
        "template_key": "campaign_second_timer_2",
        "name": "Campaign — Session 2 (reminder 2)",
        "subject": "Session #2 locks in the habit — you've got this 🔁",
        "trigger_day": None,
        "inactive_days": None,
        "body_html": f"""<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">One more session</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {{name}}, learners who book a second study block soon after the first stick with it far longer.</p>
    {_animal_img("snow leopard")}
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">You've already studied <strong>{{total_minutes}} minutes</strong>. Stack another session and grow your sanctuary — new species unlock as you go.</p>
        <p style="color:#333;font-size:14px;line-height:1.7;margin:0">Same flow as last time: pick a duration, focus, hatch. 🥚</p>
    </div>
    <div style="text-align:center;margin-bottom:20px">
        <a href="https://apps.apple.com/app/endura-study-timer/id6759482612" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:600">Start session 2</a>
    </div>
    <p style="color:#999;font-size:12px;text-align:center;margin:0">Study smarter. Save wildlife. 🌍</p>
</div>""",
    },
    {
        "template_key": "campaign_second_timer_3",
        "name": "Campaign — Session 2 (reminder 3)",
        "subject": "Don't leave it at one session — your animal wants round 2 🐾",
        "trigger_day": None,
        "inactive_days": None,
        "body_html": f"""<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">Finish the one-two</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {{name}}, one great session is a win — two close together turns it into momentum.</p>
    {_animal_img("arctic fox")}
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">This is our last prompt on session two. Whenever you're ready, open Endura and run another timer — your eco-credits and sanctuary keep growing.</p>
        <p style="color:#333;font-size:14px;line-height:1.7;margin:0">Small repeats beat perfect plans. 🌿</p>
    </div>
    <div style="text-align:center;margin-bottom:20px">
        <a href="https://apps.apple.com/app/endura-study-timer/id6759482612" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:600">Open Endura</a>
    </div>
    <p style="color:#999;font-size:12px;text-align:center;margin:0">Study smarter. Save wildlife. 🌍</p>
</div>""",
    },
    {
        "template_key": "campaign_invite_friends_2",
        "name": "Campaign — Invite Friends (reminder 2)",
        "subject": "Studying alone works — studying together wins 👥",
        "trigger_day": None,
        "inactive_days": None,
        "body_html": f"""<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">Bring a friend</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {{name}}, you've logged <strong>{{sessions}} sessions</strong> — you're exactly the person friends trust for study tips.</p>
    {_animal_img("zebra")}
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">Share Endura with one classmate: leaderboards and groups make focus contagious, and you both rack up conservation impact.</p>
        <p style="color:#333;font-size:14px;line-height:1.7;margin:0">iOS App Store and Android beta links are one tap away in the app — forward whichever fits your crew.</p>
    </div>
    <div style="text-align:center;margin-bottom:20px">
        <a href="https://apps.apple.com/app/endura-study-timer/id6759482612" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:600">Open Endura</a>
    </div>
    <p style="color:#999;font-size:12px;text-align:center;margin:0">Study smarter. Save wildlife. 🌍</p>
</div>""",
    },
    {
        "template_key": "campaign_invite_friends_3",
        "name": "Campaign — Invite Friends (reminder 3)",
        "subject": "Create a study group — save wildlife as a team 🌍",
        "trigger_day": None,
        "inactive_days": None,
        "body_html": f"""<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">Groups multiply the good</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {{name}}, you're on a roll with <strong>{{sessions}} sessions</strong> — a private group keeps everyone accountable.</p>
    {_animal_img("african elephant")}
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">In Endura: tap <em>Groups</em>, create a group, invite by username, and cheer each other's study streaks in real time.</p>
        <p style="color:#333;font-size:14px;line-height:1.7;margin:0">Last invite on this series from us — your inbox stays quiet until the next big Endura moment.</p>
    </div>
    <div style="text-align:center;margin-bottom:20px">
        <a href="https://apps.apple.com/app/endura-study-timer/id6759482612" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:600">Open Endura</a>
    </div>
    <p style="color:#999;font-size:12px;text-align:center;margin:0">Study smarter. Save wildlife. 🌍</p>
</div>""",
    },
    {
        "template_key": "update_app",
        "name": "Update Available — Drive App Update",
        # Variables this template renders:
        #   {name}            — display name (falls back to "there")
        #   {current_version} — version the user is on (or "an older build")
        #   {latest_version}  — newest store binary (e.g. 1.0.3)
        # The platform-aware store CTA is rendered inline below: we surface
        # both App Store and Play Store buttons because we don't always know
        # which platform a user is on (no push token = no `push_platform`).
        "subject": "A new version of Endura is ready for you, {name} 🌿",
        "trigger_day": None,
        "inactive_days": None,
        "body_html": f"""<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:26px">A fresher Endura is waiting</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {{name}}, there's a new build of Endura on the store — and you'll feel the difference.</p>
    {_animal_img("snow leopard")}
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 16px">
            You're on <strong>v{{current_version}}</strong>. The latest version is <strong>v{{latest_version}}</strong>.
            Updating takes about 30 seconds and gets you:
        </p>
        <table style="width:100%;border-collapse:collapse">
            <tr>
                <td style="padding:8px 12px;vertical-align:top;font-size:20px">🐾</td>
                <td style="padding:8px 0;color:#333;font-size:14px;line-height:1.6">
                    <strong>Glitch-proof egg hatching</strong> — if a timer finishes while the app is closed, your egg waits for you instead of disappearing.
                </td>
            </tr>
            <tr>
                <td style="padding:8px 12px;vertical-align:top;font-size:20px">🔔</td>
                <td style="padding:8px 0;color:#333;font-size:14px;line-height:1.6">
                    <strong>Timer-done notifications</strong> — get a ping the moment a study session ends, even with Endura in the background.
                </td>
            </tr>
            <tr>
                <td style="padding:8px 12px;vertical-align:top;font-size:20px">🏆</td>
                <td style="padding:8px 0;color:#333;font-size:14px;line-height:1.6">
                    <strong>Friends leaderboard, fixed</strong> — your friends and your own rank now show up in the correct order, every time.
                </td>
            </tr>
            <tr>
                <td style="padding:8px 12px;vertical-align:top;font-size:20px">💬</td>
                <td style="padding:8px 0;color:#333;font-size:14px;line-height:1.6">
                    <strong>One-tap feedback</strong> — a chat icon on Home lets you send bugs, ideas, or love (with screenshots) straight to the team.
                </td>
            </tr>
        </table>
    </div>
    <div style="background:#fff;border-radius:16px;padding:18px 22px;margin-bottom:20px">
        <p style="color:#333;font-size:14px;line-height:1.6;margin:0 0 10px"><strong>Why update?</strong> Older builds don't get the egg-hatch fix or the new notifications, and we can't help debug issues on out-of-date versions. The studying you've already done stays — your sanctuary, streak and badges all carry across.</p>
    </div>
    <div style="text-align:center;margin-bottom:8px">
        <a href="https://apps.apple.com/app/endura-study-timer/id6759482612"
           style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 24px;border-radius:12px;font-size:14px;font-weight:600;margin:4px">
             Update on App Store
        </a>
        <a href="https://play.google.com/store/apps/details?id=com.endura.study"
           style="display:inline-block;background:#34A853;color:#fff;text-decoration:none;padding:12px 24px;border-radius:12px;font-size:14px;font-weight:600;margin:4px">
             Update on Play Store
        </a>
    </div>
    <p style="color:#999;font-size:11px;line-height:1.6;text-align:center;margin:14px 0 0">
        On iOS: open the App Store, tap your profile photo, scroll to <em>Available Updates</em>, hit <strong>Update</strong> next to Endura.<br>
        On Android: open the Play Store, search <strong>Endura</strong>, tap <strong>Update</strong>.
    </p>
    <p style="color:#999;font-size:12px;text-align:center;margin:16px 0 0">
        Study smarter. Save wildlife. 🌍<br>
        <a href="https://instagram.com/endura.eco" style="color:#6B9B7A;text-decoration:none">@endura.eco</a>
    </p>
</div>""",
    },
    {
        # Sent when the server-side reaper auto-credits a session that the
        # client never finalised AND the user has no valid Expo push token
        # (so we can't reach them via push). Mirrors push_session_recovered
        # in tone — short, celebratory, with a single CTA back into the app.
        "template_key": "session_recovered",
        "name": "Session recovered (email fallback)",
        "subject": "We saved your {minutes}-minute study session, {name} 🌳",
        "trigger_day": None,
        "inactive_days": None,
        "body_html": f"""<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:24px">Your study session was saved</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Hey {{name}}, it looks like Endura closed before you finished your timer — but we kept your progress.</p>
    {_animal_img("red panda")}
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px">
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">
            We finalised your <strong>{{minutes}}-minute {{subject}}</strong> session for you and credited the eco-coins to your sanctuary.
        </p>
        <p style="color:#333;font-size:15px;line-height:1.7;margin:0">
            Open Endura to hatch the animal you were working toward — your egg is ready. 🥚
        </p>
    </div>
    <div style="text-align:center;margin-bottom:20px">
        <a href="https://apps.apple.com/app/endura-study-timer/id6759482612" style="display:inline-block;background:#4A7C59;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:600">Open Endura & Hatch</a>
    </div>
    <p style="color:#999;font-size:11px;line-height:1.6;text-align:center;margin:0 0 4px">
        Tip: enable push notifications in Endura to get this alert instantly next time.
    </p>
    <p style="color:#999;font-size:12px;text-align:center;margin:0">
        Study smarter. Save wildlife. 🌍<br>
        <a href="https://instagram.com/endura.eco" style="color:#6B9B7A;text-decoration:none">@endura.eco</a>
    </p>
</div>""",
    },
    {
        "template_key": "android_invite",
        "name": "Android Beta Invite",
        "subject": "You're in! Endura is ready on Android 🎉",
        "trigger_day": None,
        "inactive_days": None,
        "body_html": f"""<div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#E7EFEA;border-radius:20px">
    <h1 style="color:#4A7C59;margin:0 0 4px;font-size:28px">You're in!</h1>
    <p style="color:#6B9B7A;margin:0 0 24px;font-size:15px">Endura is now available for you on Android.</p>
    {_animal_img("sunda island tiger")}
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
