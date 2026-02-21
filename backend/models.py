from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
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
    
    # Push notification token
    push_token = Column(String, nullable=True)
    notification_enabled = Column(Boolean, default=True)
    study_reminder_hour = Column(Integer, nullable=True)
    study_reminder_minute = Column(Integer, nullable=True)
    
    # Relationships
    tasks = relationship("Task", back_populates="user")
    study_sessions = relationship("StudySession", back_populates="user")
    animals = relationship("UserAnimal", back_populates="user")
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
    nickname = Column(String, nullable=True)  # User-given name
    hatched_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="animals")
    animal = relationship("Animal")


class Egg(Base):
    """Current egg being incubated by user"""
    __tablename__ = "eggs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    coins_deposited = Column(Integer, default=0)
    coins_required = Column(Integer, default=100)
    animal_id = Column(Integer, ForeignKey("animals.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


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
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    friend_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String, default="pending")  # pending, accepted
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", foreign_keys=[user_id], back_populates="friendships")
    friend = relationship("User", foreign_keys=[friend_id])


class StudyPact(Base):
    """Study buddy pact between two users"""
    __tablename__ = "study_pacts"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"))
    buddy_id = Column(Integer, ForeignKey("users.id"))
    daily_minutes = Column(Integer, nullable=False)
    duration_days = Column(Integer, nullable=False)
    wager_amount = Column(Integer, default=0)
    status = Column(String, default="pending")  # pending, active, completed, failed
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    creator = relationship("User", foreign_keys=[creator_id])
    buddy = relationship("User", foreign_keys=[buddy_id])


class PactDay(Base):
    """Daily progress for a study pact"""
    __tablename__ = "pact_days"

    id = Column(Integer, primary_key=True, index=True)
    pact_id = Column(Integer, ForeignKey("study_pacts.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(DateTime, nullable=False)
    minutes_studied = Column(Integer, default=0)
    completed = Column(Boolean, default=False)

    pact = relationship("StudyPact")


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
