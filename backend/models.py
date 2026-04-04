from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text, LargeBinary, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from uuid import uuid4
from database import Base


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    username = Column(String, unique=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Coin and streak tracking
    total_coins = Column(Integer, default=0)
    current_coins = Column(Integer, default=0)  # Coins available for hatching
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    last_study_date = Column(DateTime, nullable=True)
    
    # Total study stats
    total_study_minutes = Column(Integer, default=0)
    total_sessions = Column(Integer, default=0)
    
    # Password reset
    reset_token = Column(String, nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)

    # JWT invalidation on password change
    token_version = Column(Integer, default=0, nullable=False, server_default="0")

    # Email verification
    email_verified = Column(Boolean, default=False)
    verification_code = Column(String, nullable=True)
    verification_code_expires = Column(DateTime, nullable=True)
    verification_attempts = Column(Integer, default=0)

    # Password reset brute-force protection
    reset_attempts = Column(Integer, default=0)

    # Profile picture URL (stored in uploads table)
    profile_pic_url = Column(String, nullable=True)

    # Profile info
    school = Column(String, nullable=True)
    city = Column(String, nullable=True)
    country = Column(String, nullable=True)

    # Push notification token
    push_token = Column(String, nullable=True)
    notification_enabled = Column(Boolean, default=True)
    study_reminder_hour = Column(Integer, nullable=True)
    study_reminder_minute = Column(Integer, nullable=True)
    
    # Relationships
    tasks = relationship("Task", back_populates="user")
    study_sessions = relationship("StudySession", back_populates="user")
    animals = relationship("UserAnimal", foreign_keys="UserAnimal.user_id", back_populates="user")
    badges = relationship("UserBadge", back_populates="user")
    friendships = relationship("Friendship", foreign_keys="Friendship.user_id", back_populates="user")


class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    estimated_minutes = Column(Integer, default=25)
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    due_date = Column(DateTime, nullable=True)
    priority = Column(Integer, default=0)  # 0=low, 1=medium, 2=high
    
    user = relationship("User", back_populates="tasks")


class StudySession(Base):
    __tablename__ = "study_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    duration_minutes = Column(Integer, nullable=False)
    coins_earned = Column(Integer, nullable=False)
    subject = Column(String, nullable=True)  # Subject/category for tracking
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    user = relationship("User", back_populates="study_sessions")
    task = relationship("Task")


class Animal(Base):
    """Master list of all available animals"""
    __tablename__ = "animals"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)  # e.g., "Giant Panda"
    species = Column(String, nullable=False)  # e.g., "Ailuropoda melanoleuca"
    rarity = Column(String, default="common")  # common, rare, epic, legendary
    conservation_status = Column(String, nullable=True)  # e.g., "Vulnerable"
    description = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)


class UserAnimal(Base):
    """Animals that users have hatched"""
    __tablename__ = "user_animals"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    animal_id = Column(Integer, ForeignKey("animals.id"))
    nickname = Column(String, nullable=True)
    hatched_at = Column(DateTime, default=datetime.utcnow)
    shared_with_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    shared_egg_id = Column(Integer, ForeignKey("shared_eggs.id"), nullable=True)
    
    user = relationship("User", foreign_keys=[user_id], back_populates="animals")
    animal = relationship("Animal")
    shared_with = relationship("User", foreign_keys=[shared_with_user_id])


class Egg(Base):
    """Current egg being incubated by user"""
    __tablename__ = "eggs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    coins_deposited = Column(Integer, default=0)
    coins_required = Column(Integer, default=100)
    animal_id = Column(Integer, ForeignKey("animals.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SharedEgg(Base):
    """Shared egg for co-hatching between two friends"""
    __tablename__ = "shared_eggs"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"))
    partner_id = Column(Integer, ForeignKey("users.id"))
    animal_name = Column(String, nullable=False)
    status = Column(String, default="pending")  # pending, active, hatched, declined
    creator_minutes = Column(Integer, default=0)
    partner_minutes = Column(Integer, default=0)
    minutes_required = Column(Integer, default=60)
    created_at = Column(DateTime, default=datetime.utcnow)
    hatched_at = Column(DateTime, nullable=True)

    creator = relationship("User", foreign_keys=[creator_id])
    partner = relationship("User", foreign_keys=[partner_id])


class StudyTip(Base):
    """Study tips for the scrolling feed"""
    __tablename__ = "study_tips"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    content = Column(Text, nullable=False)
    category = Column(String, default="general")
    animal_name = Column(String, nullable=True)
    likes_count = Column(Integer, default=0)
    dislikes_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class TipView(Base):
    """Track which tips a user has viewed"""
    __tablename__ = "tip_views"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    tip_id = Column(Integer, ForeignKey("study_tips.id"))
    viewed_at = Column(DateTime, default=datetime.utcnow)
    liked = Column(Boolean, default=False)
    disliked = Column(Boolean, default=False)


class UserBadge(Base):
    """Badges earned by users"""
    __tablename__ = "user_badges"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    badge_id = Column(String, nullable=False)
    earned_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="badges")


class Friendship(Base):
    """Friend connections between users"""
    __tablename__ = "friendships"
    __table_args__ = (
        UniqueConstraint("user_id", "friend_id", name="uq_friendship"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    friend_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String, default="pending")  # pending, accepted
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", foreign_keys=[user_id], back_populates="friendships")
    friend = relationship("User", foreign_keys=[friend_id])


class StudyGroup(Base):
    """Study group with shared goals"""
    __tablename__ = "study_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    creator_id = Column(Integer, ForeignKey("users.id"))
    goal_minutes = Column(Integer, default=500)
    goal_deadline = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    creator = relationship("User", foreign_keys=[creator_id])
    members = relationship("GroupMember", back_populates="group")
    messages = relationship("GroupMessage", back_populates="group", order_by="GroupMessage.created_at.desc()")


class GroupMember(Base):
    """Membership in a study group"""
    __tablename__ = "group_members"
    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="uq_group_member"),
    )

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("study_groups.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    role = Column(String, default="member")  # admin, member
    joined_at = Column(DateTime, default=datetime.utcnow)

    group = relationship("StudyGroup", back_populates="members")
    user = relationship("User")


class GroupMessage(Base):
    """Chat message in a study group"""
    __tablename__ = "group_messages"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("study_groups.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    group = relationship("StudyGroup", back_populates="messages")
    user = relationship("User")


class ActivityEvent(Base):
    """Activity feed events visible to friends"""
    __tablename__ = "activity_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    event_type = Column(String, nullable=False)  # session_complete, animal_hatched, streak_milestone, badge_earned, pact_created, group_goal_met
    description = Column(Text, nullable=False)
    extra_data = Column(String, nullable=True)  # JSON string for metadata
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    reactions = relationship("FeedReaction", back_populates="event")


class FeedReaction(Base):
    """Quick reaction on an activity feed event"""
    __tablename__ = "feed_reactions"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("activity_events.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    reaction = Column(String, nullable=False)  # "nice", "keep_going", "fire", "wow", "heart"
    created_at = Column(DateTime, default=datetime.utcnow)
    seen = Column(Boolean, default=False)

    event = relationship("ActivityEvent", back_populates="reactions")
    user = relationship("User")


class ShopItem(Base):
    """Shop items (accessories & decorations) manageable via admin"""
    __tablename__ = "shop_items"

    id = Column(Integer, primary_key=True, index=True)
    item_key = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    emoji = Column(String, nullable=True)
    image_key = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    price = Column(Integer, default=0)
    category = Column(String, default="accessories")
    rarity = Column(String, default="common")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Upload(Base):
    """Uploaded images stored in DB"""
    __tablename__ = "uploads"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String, unique=True, index=True, default=lambda: str(uuid4()))
    filename = Column(String, nullable=False)
    content_type = Column(String, nullable=False)
    data = Column(LargeBinary, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Donation(Base):
    """Donations received via Every.org webhook"""
    __tablename__ = "donations"

    id = Column(Integer, primary_key=True, index=True)
    charge_id = Column(String, unique=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    amount = Column(Float, nullable=False)
    net_amount = Column(Float, nullable=True)
    currency = Column(String, default="USD")
    frequency = Column(String, default="One-time")
    donor_first_name = Column(String, nullable=True)
    donor_last_name = Column(String, nullable=True)
    donor_email = Column(String, nullable=True)
    nonprofit_name = Column(String, default="WWF")
    donation_date = Column(String, nullable=True)
    partner_donation_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class School(Base):
    __tablename__ = "schools"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    city = Column(String, nullable=True)
    region = Column(String, nullable=True)
    country = Column(String, nullable=False, index=True)
