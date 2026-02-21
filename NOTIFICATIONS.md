# Endura Notification & Alert System

Everything you need to customise the in-app toasts, push notifications, and study reminders.

---

## In-App Toast Notifications

These are the animated banners that slide in from the top (or bottom) of the screen. Edit the values below and tell me what to change.

### Notification Types & Styling

| Type | Gradient Start | Gradient End | Default Emoji | Used For |
|------|---------------|-------------|---------------|----------|
| `success` | `#E7EFEA` | `#D4E8DE` | ✅ | Task completed, session saved |
| `info` | `#E8EFF5` | `#D1E3F0` | 💡 | General tips, reminders |
| `warning` | `#FFF5E6` | `#FFE8C2` | ⚠️ | Streak at risk, egg in danger |
| `celebration` | `#E7EFEA` | `#C2DDD0` | 🎉 | Hatching, milestones |
| `friend` | `#E8EFF5` | `#D4E8DE` | 👋 | Friend request, friend activity |
| `badge` | `#E7EFEA` | `#D4E8DE` | 🏅 | Badge earned |
| `donation` | `#E7EFEA` | `#C2DDD0` | 💚 | Donation confirmed |

### Text Styling

| Element | Font Size | Font Weight | Colour |
|---------|-----------|-------------|--------|
| Title | 15 | 700 (bold) | `#2F4A3E` (Deep Pine) |
| Message | 13 | 500 (medium) | `#5E7F6E` (Forest Calm) |
| Emoji | 28 | — | — |
| Dismiss ✕ | 16 | 600 | `#7C8F86` (Stone Fog) |

### Animation & Behaviour

| Setting | Current Value | Description |
|---------|--------------|-------------|
| Default duration | 3500ms | How long the toast stays visible |
| Celebration duration | 4500ms | Longer for celebrations |
| Badge duration | 4000ms | Slightly longer for badges |
| Friend duration | 4000ms | Slightly longer for friend alerts |
| Donation duration | 5000ms | Longest — lets user read stats |
| Default position | `top` | Slides from top of screen |
| Max visible | 3 | Queue limit before oldest is removed |
| Spring friction | 8 | Higher = less bounce |
| Spring tension | 60 | Higher = snappier |
| Fade-out duration | 250ms | Exit animation speed |
| Corner radius | 16 | Rounded corners |
| Shadow opacity | 0.15 | Drop shadow intensity |

### Card Layout

| Setting | Current Value |
|---------|--------------|
| Horizontal padding | 16 |
| Vertical padding | 14 |
| Gap (emoji ↔ text) | 12 |
| Left/right margin | 16 |

---

## Pre-Built Alert Messages

These are the convenience methods available from `useNotifications()`. Edit the titles/messages here and I'll update the code.

### Badge Earned
- **Title:** `Badge Earned!`
- **Message:** `{emoji} {badgeName}` (dynamic)
- **Duration:** 4000ms

### Donation Thank You
- **Title:** `Thank you for donating!`
- **Message:** `Your ${amount} helps protect endangered species`
- **Duration:** 5000ms

### Friend Notification
- **Title:** (dynamic — passed by caller)
- **Message:** (dynamic — passed by caller)
- **Duration:** 4000ms

---

## Push Notifications (System-Level)

These appear in the device notification centre even when the app is closed.

### Handler Settings

| Setting | Current Value | Options |
|---------|--------------|---------|
| Show alert | `true` | Show notification when app is open |
| Play sound | `true` | Play notification sound |
| Set badge | `true` | Update app icon badge count |
| Show banner | `true` | Show banner on lock screen |
| Show in list | `true` | Show in notification centre |

### Android Channel

| Setting | Current Value |
|---------|--------------|
| Channel name | `Default` |
| Importance | `MAX` |
| Vibration pattern | `[0, 250, 250, 250]` |
| LED colour | `#5E7F6E` |

### Study Reminder Messages

These rotate randomly for the daily study reminder:

| # | Title | Body |
|---|-------|------|
| 1 | `Time to study!` | `Your egg is waiting to hatch. Start a session now!` |
| 2 | `Don't break your streak!` | `A quick study session keeps your streak alive.` |
| 3 | `Your animals miss you!` | `Come back and hatch a new friend today.` |

**Want to add more?** Just list them here and I'll add them.

---

## How to Customise

Mark up this file with your changes — for example:

```
### Notification Types & Styling
| `success` | `#E7EFEA` | `#D4E8DE` | ✅ |  -->  CHANGE to 🌿, gradient to #F0FFF0 → #D0F0D0
| `warning` | `#FFF5E6` | `#FFE8C2` | ⚠️ |  -->  CHANGE emoji to 🔥
```

```
### Animation & Behaviour
| Default duration | 3500ms |  -->  CHANGE to 4000ms
| Max visible | 3 |  -->  CHANGE to 2
```

```
### Study Reminder Messages
ADD: | 4 | `Keep going!` | `Every minute of study brings you closer to a new animal.` |
```

Or just tell me in chat what you'd like to change and I'll handle it.
