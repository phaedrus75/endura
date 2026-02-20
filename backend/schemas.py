from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


# ============ Auth Schemas ============

class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    username: Optional[str] = None
    total_coins: int
    current_coins: int
    current_streak: int
    longest_streak: int
    total_study_minutes: int
    total_sessions: int
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


# ============ Task Schemas ============

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    estimated_minutes: int = 25
    due_date: Optional[datetime] = None
    priority: int = 0


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    estimated_minutes: Optional[int] = None
    is_completed: Optional[bool] = None
    due_date: Optional[datetime] = None
    priority: Optional[int] = None


class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    estimated_minutes: int
    is_completed: bool
    completed_at: Optional[datetime]
    created_at: datetime
    due_date: Optional[datetime]
    priority: int

    class Config:
        from_attributes = True


# ============ Study Session Schemas ============

class StudySessionCreate(BaseModel):
    task_id: Optional[int] = None
    duration_minutes: int
    animal_name: Optional[str] = None  # Name of the animal to hatch
    subject: Optional[str] = None  # Subject/category for tracking


class StudySessionResponse(BaseModel):
    id: int
    task_id: Optional[int]
    duration_minutes: int
    coins_earned: int
    subject: Optional[str]
    started_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


# ============ Animal Schemas ============

class AnimalResponse(BaseModel):
    id: int
    name: str
    species: str
    rarity: str
    conservation_status: Optional[str]
    description: Optional[str]
    image_url: Optional[str]

    class Config:
        from_attributes = True


class BadgeInfo(BaseModel):
    id: str
    name: str
    icon: str
    description: str
    category: str
    tier: str

class BadgeResponse(BaseModel):
    id: str
    name: str
    icon: str
    description: str
    category: str
    tier: str
    earned: bool
    earned_at: Optional[str] = None

class StudySessionWithHatchResponse(BaseModel):
    session: StudySessionResponse
    hatched_animal: Optional[AnimalResponse] = None
    new_badges: Optional[List[BadgeInfo]] = None


class UserAnimalResponse(BaseModel):
    id: int
    animal: AnimalResponse
    nickname: Optional[str]
    hatched_at: datetime

    class Config:
        from_attributes = True


# ============ Egg Schemas ============

class EggResponse(BaseModel):
    coins_deposited: int
    coins_required: int
    progress_percent: float
    animal_hint: Optional[str] = None

    class Config:
        from_attributes = True


class HatchResult(BaseModel):
    success: bool
    animal: Optional[AnimalResponse] = None
    message: str


# ============ Study Tips Schemas ============

class StudyTipCreate(BaseModel):
    content: str
    category: str = "general"


class StudyTipResponse(BaseModel):
    id: int
    content: str
    category: str
    likes_count: int
    created_at: datetime
    user_liked: bool = False

    class Config:
        from_attributes = True


# ============ Social Schemas ============

class FriendRequest(BaseModel):
    friend_username: str


class FriendResponse(BaseModel):
    id: int
    username: Optional[str]
    email: str
    total_study_minutes: int
    current_streak: int
    animals_count: int

    class Config:
        from_attributes = True


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: int
    username: Optional[str]
    total_study_minutes: int
    current_streak: int
    animals_count: int


# ============ Study Pact Schemas ============

class PactCreate(BaseModel):
    buddy_username: str
    daily_minutes: int = 30
    duration_days: int = 7
    wager_amount: int = 0

class PactDayResponse(BaseModel):
    date: str
    minutes_studied: int
    completed: bool

class PactResponse(BaseModel):
    id: int
    creator_username: Optional[str]
    buddy_username: Optional[str]
    creator_id: int
    buddy_id: int
    daily_minutes: int
    duration_days: int
    wager_amount: int
    status: str
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    created_at: datetime
    creator_progress: List[PactDayResponse] = []
    buddy_progress: List[PactDayResponse] = []


# ============ Study Group Schemas ============

class GroupCreate(BaseModel):
    name: str
    goal_minutes: int = 500
    goal_deadline: Optional[datetime] = None

class GroupMemberResponse(BaseModel):
    user_id: int
    username: Optional[str]
    role: str
    minutes_contributed: int = 0

class GroupMessageResponse(BaseModel):
    id: int
    user_id: int
    username: Optional[str]
    content: str
    created_at: datetime

class GroupResponse(BaseModel):
    id: int
    name: str
    creator_id: int
    goal_minutes: int
    goal_deadline: Optional[datetime]
    created_at: datetime
    members: List[GroupMemberResponse] = []
    total_minutes: int = 0
    goal_met: bool = False

class GroupMessageCreate(BaseModel):
    content: str

class GroupInvite(BaseModel):
    username: Optional[str] = None
    user_id: Optional[int] = None


# ============ Activity Feed Schemas ============

class ActivityEventResponse(BaseModel):
    id: int
    user_id: int
    username: Optional[str]
    event_type: str
    description: str
    created_at: datetime
    reactions: List[dict] = []

class ReactionCreate(BaseModel):
    reaction: str


# ============ Stats Schemas ============

class UserStats(BaseModel):
    total_coins: int
    current_coins: int
    total_study_minutes: int
    total_sessions: int
    current_streak: int
    longest_streak: int
    animals_hatched: int
    tasks_completed: int
    weekly_study_minutes: list
    study_minutes_by_subject: dict  # {subject: minutes}
