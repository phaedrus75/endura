# Endura Hatching System - Updated Implementation

## Overview

The hatching system rewards users for completing study sessions by hatching endangered animals into their collection. **Every completed study timer hatches one animal.**

---

## 1. Points/Coins System

### How Coins Are Earned
```
Base Rate: 1 coin per minute studied
Bonuses:
  - 25+ minute session: +5 coins
  - 50+ minute session: +10 coins

Examples:
  - 5 min session  → 5 coins
  - 25 min session → 30 coins (25 + 5 bonus)
  - 60 min session → 75 coins (60 + 5 + 10 bonus)
```

### Purpose
Coins are tracked for gamification/stats but **not required** for hatching animals.

---

## 2. Animals (21 total - Synced Frontend & Backend)

| ID | Name | Emoji | Rarity | Conservation Status |
|----|------|-------|--------|---------------------|
| 1 | Sunda Island Tiger | 🐅 | Legendary | Critically Endangered |
| 2 | Javan Rhino | 🦏 | Legendary | Critically Endangered |
| 3 | Amur Leopard | 🐆 | Legendary | Critically Endangered |
| 4 | Mountain Gorilla | 🦍 | Legendary | Endangered |
| 5 | Tapanuli Orangutan | 🦧 | Legendary | Critically Endangered |
| 6 | Polar Bear | 🐻‍❄️ | Epic | Vulnerable |
| 7 | African Forest Elephant | 🐘 | Epic | Critically Endangered |
| 8 | Hawksbill Turtle | 🐢 | Epic | Critically Endangered |
| 9 | Calamian Deer | 🦌 | Epic | Endangered |
| 10 | Axolotl | 🦎 | Epic | Critically Endangered |
| 11 | Red Wolf | 🐺 | Rare | Critically Endangered |
| 12 | Monarch Butterfly | 🦋 | Rare | Endangered |
| 13 | Red Panda | 🐼 | Rare | Endangered |
| 14 | Panda | 🐼 | Rare | Vulnerable |
| 15 | Mexican Bobcat | 🐱 | Rare | Endangered |
| 16 | Chinchilla | 🐭 | Common | Endangered |
| 17 | Otter | 🦦 | Common | Endangered |
| 18 | Koala | 🐨 | Common | Vulnerable |
| 19 | Langur Monkey | 🐒 | Common | Critically Endangered |
| 20 | Pacific Pocket Mouse | 🐁 | Common | Endangered |
| 21 | Wallaby | 🦘 | Common | Near Threatened |

---

## 3. Hatching Flow

### How It Works
1. User selects timer duration (5-60 min)
2. User clicks "Start Studying"
3. **Egg selection modal** shows 21 eggs in a 3x7 grid
4. User selects the **next available egg** (sequential unlock)
5. Timer runs
6. On completion:
   - Session saved to database
   - Selected animal added to user's collection
   - Celebration modal with confetti
   - Animal appears in "Recent Hatches" and "Collection"

### Sequential Unlock
- Eggs are unlocked in order (1 → 21)
- User must hatch egg #1 before #2 becomes available
- Previously hatched eggs show the animal emoji
- Next available egg is highlighted
- Future eggs show locked 🔒

---

## 4. Data Storage

### Backend (PostgreSQL)
- `animals` table: Master list of 21 animals
- `user_animals` table: Which animals each user has hatched
- `study_sessions` table: Session history

### Frontend (AsyncStorage)
- `unlockedAnimals`: Array of hatched animal IDs (for UI state)

---

## 5. API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /sessions` | Complete session + hatch animal |
| `GET /my-animals` | Get user's hatched animals |
| `GET /animals` | Get all 21 animals |

### Session Request
```json
{
  "duration_minutes": 25,
  "task_id": null,
  "animal_name": "Sunda Island Tiger"
}
```

### Session Response
```json
{
  "session": {
    "id": 1,
    "duration_minutes": 25,
    "coins_earned": 30
  },
  "hatched_animal": {
    "id": 1,
    "name": "Sunda Island Tiger",
    "species": "Panthera tigris sondaica",
    "rarity": "legendary",
    "conservation_status": "Critically Endangered"
  }
}
```

---

## 6. Files

### Backend
- `models.py` - Animal model (no coins_to_hatch)
- `main.py` - Seed 21 animals on startup
- `crud.py` - create_study_session() handles hatching
- `schemas.py` - API response schemas

### Frontend
- `TimerScreen.tsx` - ENDANGERED_ANIMALS list, egg selection
- `HomeScreen.tsx` - Recent hatches display
- `CollectionScreen.tsx` - Full collection grid
- `services/api.ts` - API types and calls
