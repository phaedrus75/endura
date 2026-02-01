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


class StudySessionResponse(BaseModel):
    id: int
    task_id: Optional[int]
    duration_minutes: int
    coins_earned: int
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
    coins_to_hatch: int

    class Config:
        from_attributes = True


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
    friend_email: str


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
    weekly_study_minutes: int
