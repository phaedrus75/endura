# Badge System – 50 Badges for Endura

Badges are earned automatically when milestones or trends are hit. They appear on the user's profile and collection page. Each badge has a name, icon idea, condition, and flavour text.

---

## Getting Started

| # | Badge | Icon | Condition | Description |
|---|---|---|---|---|
| 1 | First Steps | 👣 | Complete your first study session | "Every journey begins with a single session." |
| 2 | Finding Your Rhythm | 🎵 | Complete 5 sessions | "You're getting the hang of this." |
| 3 | Double Digits | 🔟 | Complete 10 sessions | "Ten down, thousands to go." |
| 4 | Halfway Hero | 🏅 | Complete 25 sessions | "Quarter century of focus." |
| 5 | Session Centurion | 💯 | Complete 100 sessions | "Triple digits. Absolute legend." |

## Streaks & Consistency

| # | Badge | Icon | Condition | Description |
|---|---|---|---|---|
| 6 | On Fire | 🔥 | 3-day streak | "Three days strong — keep the flame alive." |
| 7 | Momentum Builder | ⚡ | 5-day streak | "Five days. The momentum is real." |
| 8 | Week Warrior | 🗓️ | 7-day streak | "A full week without missing a beat." |
| 9 | Fortnight Force | 🛡️ | 14-day streak | "Two weeks of pure consistency." |
| 10 | Monthly Machine | ⚙️ | 30-day streak | "Habits are forged in this fire." |
| 11 | Iron Will | 🪨 | 60-day streak | "Two months. Nothing can stop you." |
| 12 | Unbreakable | 💎 | 100-day streak | "Only the most dedicated reach this level." |

## Study Time

| # | Badge | Icon | Condition | Description |
|---|---|---|---|---|
| 13 | Hour of Power | ⏱️ | Complete a 60-minute session | "A full hour of deep focus." |
| 14 | Endurance Mode | 🏋️ | Complete a 120-minute session | "Two hours. Absolute beast." |
| 15 | Marathon Mind | 🏃 | Accumulate 10 hours total study | "That's a full work day of learning." |
| 16 | Study Veteran | 🎖️ | Accumulate 50 hours total study | "More focused than most." |
| 17 | Thousand-Minute Club | 🏛️ | Accumulate 1,000 minutes total | "Welcome to an elite club." |
| 18 | Time Lord | ⏳ | Accumulate 100 hours total study | "Triple-digit dedication." |

## Time of Day & Habits

| # | Badge | Icon | Condition | Description |
|---|---|---|---|---|
| 19 | Early Bird | 🐦 | Complete a session before 7am | "The early bird hatches the egg." |
| 20 | Dawn Patrol | 🌅 | Complete 5 sessions before 8am | "Sunrise scholar." |
| 21 | Night Owl | 🦉 | Complete a session after 11pm | "Burning the midnight oil." |
| 22 | Moonlight Scholar | 🌙 | Complete 5 sessions after 10pm | "The night is your classroom." |
| 23 | Weekend Scholar | 📚 | Study on both Saturday and Sunday in one week | "No days off." |
| 24 | Lunch Break Learner | 🥪 | Complete a session between 12pm and 1pm | "Studying through lunch — committed." |
| 25 | Generational Comeback | 🔄 | Study after a 7+ day gap | "You came back. That's what matters." |

## Animals & Hatching

| # | Badge | Icon | Condition | Description |
|---|---|---|---|---|
| 26 | First Friend | 🐣 | Hatch your first animal | "Welcome to the sanctuary!" |
| 27 | Growing Family | 🌱 | Hatch 5 unique species | "Your sanctuary is coming to life." |
| 28 | Collector's Pride | 🏆 | Hatch 25 total animals (including duplicates) | "Quantity AND quality." |
| 29 | Speed Hatcher | ⚡ | Hatch 3 animals in one day | "Three sessions, three hatches, one day." |
| 30 | Full Sanctuary | 🌍 | Hatch all 21 unique species | "Every endangered species — saved by studying." |
| 31 | Favourite Friend | ❤️ | Hatch the same animal 5 times | "Clearly you have a favourite." |
| 32 | Naming Ceremony | ✏️ | Nickname 5 different animals | "Each one is special to you." |

## Eco-Credits & Shopping

| # | Badge | Icon | Condition | Description |
|---|---|---|---|---|
| 33 | Saver | 🍀 | Accumulate 500 current eco-credits at once | "Saving up for something special?" |
| 34 | Big Spender | 💸 | Spend 1,000 eco-credits total in the shop | "Treating the sanctuary right." |
| 35 | Window Shopper | 👀 | Visit the shop 10 times | "Just browsing... for now." |
| 36 | Eco Mogul | 🤑 | Earn 5,000 eco-credits lifetime | "A true eco-credit tycoon." |
| 37 | Impulse Buyer | 🛒 | Purchase 3 items in a single day | "Couldn't resist." |

## Subject Mastery

| # | Badge | Icon | Condition | Description |
|---|---|---|---|---|
| 38 | Subject Explorer | 🧭 | Study 3 different subjects | "A well-rounded learner." |
| 39 | Renaissance Student | 🎨 | Study 5 different subjects | "Curious about everything." |
| 40 | Deep Diver | 🤿 | Study 10+ hours in a single subject | "Mastery takes dedication." |
| 41 | Subject Champion | 👑 | Study 25+ hours in a single subject | "You own this subject now." |
| 42 | Balanced Brain | ⚖️ | Study 3+ subjects in a single week | "Keeping all the plates spinning." |

## Sanctuary Customisation

| # | Badge | Icon | Condition | Description |
|---|---|---|---|---|
| 43 | Interior Designer | 🎨 | Place 5 items in your sanctuary | "Making it feel like home." |
| 44 | Decorator Deluxe | ✨ | Purchase 10 shop items | "The sanctuary looks incredible." |
| 45 | Accessory Addict | 👒 | Place accessories on 5 different animals | "Fashion-forward sanctuary." |
| 46 | Curator | 🖼️ | Own at least 1 item from every shop category | "A little bit of everything." |

## Social (future)

| # | Badge | Icon | Condition | Description |
|---|---|---|---|---|
| 47 | Social Butterfly | 🦋 | Add 10 friends | "Popular AND productive." |
| 48 | Top of the Class | 🥇 | Reach #1 on the weekly leaderboard | "This week's champion." |
| 49 | Generous Spirit | 🎁 | Gift an animal to a friend | "Sharing is caring." |
| 50 | Study Squad | 👥 | Complete a group study challenge | "Stronger together." |

---

## Implementation Notes

- **Storage**: `user_badges` table — `user_id`, `badge_id`, `earned_at`
- **Trigger checks**: Run after each session completion, on login (for streak/time-of-day), and on purchase
- **Display**: Badge grid on profile, toast notification when earned, badge count on profile button
- **Rarity tiers**: Bronze (easy, #1–#5), Silver (moderate, #6–#18), Gold (hard, #19–#42), Diamond (exceptional, #43–#50)
