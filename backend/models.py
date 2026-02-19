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
    
    # Relationships
    tasks = relationship("Task", back_populates="user")
    study_sessions = relationship("StudySession", back_populates="user")
    animals = relationship("UserAnimal", back_populates="user")
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
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Null for system tips
    content = Column(Text, nullable=False)
    category = Column(String, default="general")  # focus, memorization, motivation, etc.
    likes_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class TipView(Base):
    """Track which tips a user has viewed"""
    __tablename__ = "tip_views"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    tip_id = Column(Integer, ForeignKey("study_tips.id"))
    viewed_at = Column(DateTime, default=datetime.utcnow)
    liked = Column(Boolean, default=False)


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
