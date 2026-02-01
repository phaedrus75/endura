# Endura 🥚

A gamified study app that motivates you to study by hatching endangered animals! Study more, earn coins, hatch eggs, and build your collection of endangered animals.

## Features

- **🥚 Egg Hatching System**: Your study coins automatically contribute to hatching eggs. Each egg reveals a unique endangered animal!
- **⏱️ Study Timer**: Set customizable study timers (5-60 minutes). Longer sessions earn more coins with bonus rewards.
- **📋 Task Management**: Create and track your study tasks. Complete tasks alongside your study sessions.
- **🦁 Animal Collection**: Collect 20+ endangered animals with different rarities (Common, Rare, Epic, Legendary).
- **💡 Study Tips Feed**: Swipeable feed of study tips. Like and share your own tips with the community.
- **🏆 Social Features**: Add friends, compete on leaderboards, and motivate each other.
- **🔥 Streak Tracking**: Maintain daily study streaks for bonus motivation.

## Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - Database ORM
- **SQLite/PostgreSQL** - Database
- **JWT** - Authentication

### Frontend
- **React Native** - Cross-platform mobile framework
- **Expo** - Development platform
- **React Navigation** - Navigation library

## Getting Started

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start Expo
npx expo start --tunnel
```

### Testing the App

1. Start the backend server first
2. Start the Expo development server
3. Scan the QR code with Expo Go app on your phone
4. Create an account and start studying!

## Game Mechanics

### Coin System
- 1 coin per minute of studying
- +5 bonus coins for 25+ minute sessions (Pomodoro)
- +10 bonus coins for 50+ minute sessions

### Egg Hatching
- First egg requires 100 coins
- Each subsequent egg costs +25 more coins
- Animals have different rarities affecting their appearance rate

### Animal Rarities
- **Common** (100 coins base): Red Panda, Sea Turtle, Penguin, Koala, Flamingo
- **Rare** (150 coins base): Giant Panda, Snow Leopard, Orangutan, Elephant, Polar Bear
- **Epic** (200 coins base): Tiger, Gorilla, Blue Whale, Cheetah, Rhinoceros
- **Legendary** (300 coins base): Amur Leopard, Vaquita, Sumatran Rhino, Kakapo, Axolotl

## API Endpoints

### Authentication
- `POST /auth/register` - Create account
- `POST /auth/login` - Login
- `GET /auth/me` - Get current user

### Tasks
- `GET /tasks` - Get user tasks
- `POST /tasks` - Create task
- `PUT /tasks/{id}` - Update task
- `DELETE /tasks/{id}` - Delete task

### Study Sessions
- `POST /sessions` - Complete study session
- `GET /sessions` - Get session history

### Animals & Eggs
- `GET /egg` - Get current egg progress
- `POST /egg/hatch` - Hatch the egg
- `GET /animals` - Get all animals
- `GET /my-animals` - Get user's animals

### Social
- `POST /friends/request` - Send friend request
- `GET /friends` - Get friends list
- `GET /leaderboard` - Get friend leaderboard

## Deployment

The app is ready for deployment on:
- **Backend**: Railway, Render, Heroku
- **Frontend**: Expo EAS Build for iOS and Android

## Contributing

This is an educational project. Feel free to fork and build upon it!

## License

MIT License
