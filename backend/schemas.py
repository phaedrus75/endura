from pydantic import BaseModel, EmailStr, field_validator, Field
from typing import Optional, List
from datetime import datetime


# ============ Auth Schemas ============

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator('password')
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one number')
        if not any(c.isalpha() for c in v):
            raise ValueError('Password must contain at least one letter')
        return v


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
    profile_pic_url: Optional[str] = None
    school: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None

    class Config:
        from_attributes = True


class UpdateProfileRequest(BaseModel):
    school: Optional[str] = Field(None, max_length=200)
    city: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)


class SchoolSearchResult(BaseModel):
    name: str
    city: Optional[str] = None
    region: Optional[str] = None
    country: str


class Token(BaseModel):
    access_token: str
    token_type: str


# ============ Task Schemas ============

class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    estimated_minutes: int = Field(25, ge=1, le=480)
    due_date: Optional[datetime] = None
    priority: int = Field(0, ge=0, le=2)


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
    duration_minutes: int = Field(..., ge=1, le=480)
    animal_name: Optional[str] = Field(None, max_length=100)
    subject: Optional[str] = Field(None, max_length=100)


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
    requirement: Optional[str] = None

class SharedHatchResult(BaseModel):
    animal_name: str
    partner_name: str

class StudySessionWithHatchResponse(BaseModel):
    session: StudySessionResponse
    hatched_animal: Optional[AnimalResponse] = None
    new_badges: Optional[List[BadgeInfo]] = None
    shared_hatch: Optional[SharedHatchResult] = None


class UserAnimalResponse(BaseModel):
    id: int
    animal: AnimalResponse
    nickname: Optional[str]
    hatched_at: datetime
    shared_with_username: Optional[str] = None

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


# ============ Shared Egg Schemas ============

class SharedEggInvite(BaseModel):
    friend_id: int
    animal_name: str = Field(..., min_length=1, max_length=100)
    duration_minutes: int = 60

class SharedEggUserInfo(BaseModel):
    id: int
    username: Optional[str]
    profile_pic_url: Optional[str] = None

class SharedEggResponse(BaseModel):
    id: int
    creator: SharedEggUserInfo
    partner: SharedEggUserInfo
    animal_name: str
    status: str
    creator_minutes: int
    partner_minutes: int
    minutes_required: int
    progress_percent: float
    created_at: datetime


# ============ Study Tips Schemas ============

class StudyTipCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    category: str = Field("general", max_length=50)


class StudyTipResponse(BaseModel):
    id: int
    content: str
    category: str
    animal_name: Optional[str] = None
    likes_count: int
    dislikes_count: int = 0
    created_at: datetime
    user_liked: bool = False
    user_disliked: bool = False

    class Config:
        from_attributes = True


# ============ Social Schemas ============

class FriendRequest(BaseModel):
    friend_username: str


class FriendResponse(BaseModel):
    id: int
    username: Optional[str]
    total_study_minutes: int
    current_streak: int
    animals_count: int
    profile_pic_url: Optional[str] = None
    friends_since: Optional[str] = None

    class Config:
        from_attributes = True


class FriendProfileResponse(BaseModel):
    id: int
    username: Optional[str]
    total_study_minutes: int
    current_streak: int
    longest_streak: int
    total_sessions: int
    animals_count: int
    profile_pic_url: Optional[str] = None
    friends_since: Optional[str] = None
    member_since: Optional[str] = None
    total_coins: int = 0
    school: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None

    class Config:
        from_attributes = True


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: int
    username: Optional[str]
    total_study_minutes: int
    current_streak: int
    animals_count: int
    total_donated: float = 0.0
    profile_pic_url: Optional[str] = None


# ============ Study Group Schemas ============

class GroupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    goal_minutes: int = Field(500, ge=1, le=100000)
    goal_deadline: Optional[datetime] = None

class GroupMemberResponse(BaseModel):
    user_id: int
    username: Optional[str]
    role: str
    minutes_contributed: int = 0
    profile_pic_url: Optional[str] = None

class GroupMessageResponse(BaseModel):
    id: int
    user_id: int
    username: Optional[str]
    content: str
    created_at: datetime
    profile_pic_url: Optional[str] = None

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
    content: str = Field(..., min_length=1, max_length=5000)

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
    reaction: str = Field(..., max_length=20)


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
    monthly_study_minutes: list
    study_minutes_by_subject: dict  # {subject: minutes}
