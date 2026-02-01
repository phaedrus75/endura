from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timedelta
from typing import List, Optional
import models
import random


# ============ User CRUD ============

def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.email == email).first()


def create_user(db: Session, email: str, hashed_password: str) -> models.User:
    user = models.User(email=email, hashed_password=hashed_password)
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Create initial egg for user
    create_egg_for_user(db, user.id)
    
    return user


def update_username(db: Session, user_id: int, username: str) -> models.User:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user:
        user.username = username
        db.commit()
        db.refresh(user)
    return user


# ============ Task CRUD ============

def create_task(db: Session, user_id: int, title: str, description: str = None,
                estimated_minutes: int = 25, due_date: datetime = None, priority: int = 0) -> models.Task:
    task = models.Task(
        user_id=user_id,
        title=title,
        description=description,
        estimated_minutes=estimated_minutes,
        due_date=due_date,
        priority=priority
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def get_user_tasks(db: Session, user_id: int, include_completed: bool = False) -> List[models.Task]:
    query = db.query(models.Task).filter(models.Task.user_id == user_id)
    if not include_completed:
        query = query.filter(models.Task.is_completed == False)
    return query.order_by(models.Task.priority.desc(), models.Task.created_at.desc()).all()


def update_task(db: Session, task_id: int, user_id: int, **kwargs) -> Optional[models.Task]:
    task = db.query(models.Task).filter(
        models.Task.id == task_id,
        models.Task.user_id == user_id
    ).first()
    
    if task:
        for key, value in kwargs.items():
            if value is not None and hasattr(task, key):
                setattr(task, key, value)
        
        if kwargs.get('is_completed') == True and task.completed_at is None:
            task.completed_at = datetime.utcnow()
        
        db.commit()
        db.refresh(task)
    return task


def delete_task(db: Session, task_id: int, user_id: int) -> bool:
    task = db.query(models.Task).filter(
        models.Task.id == task_id,
        models.Task.user_id == user_id
    ).first()
    if task:
        db.delete(task)
        db.commit()
        return True
    return False


# ============ Study Session CRUD ============

def create_study_session(db: Session, user_id: int, duration_minutes: int, task_id: int = None) -> models.StudySession:
    # Calculate coins earned (1 coin per minute, bonus for longer sessions)
    coins = duration_minutes
    if duration_minutes >= 25:
        coins += 5  # Pomodoro bonus
    if duration_minutes >= 50:
        coins += 10  # Extra bonus for hour sessions
    
    session = models.StudySession(
        user_id=user_id,
        task_id=task_id,
        duration_minutes=duration_minutes,
        coins_earned=coins,
        completed_at=datetime.utcnow()
    )
    db.add(session)
    
    # Update user stats
    user = db.query(models.User).filter(models.User.id == user_id).first()
    user.total_coins += coins
    user.current_coins += coins
    user.total_study_minutes += duration_minutes
    user.total_sessions += 1
    
    # Update streak
    today = datetime.utcnow().date()
    if user.last_study_date:
        last_date = user.last_study_date.date()
        if last_date == today - timedelta(days=1):
            user.current_streak += 1
        elif last_date != today:
            user.current_streak = 1
    else:
        user.current_streak = 1
    
    user.last_study_date = datetime.utcnow()
    if user.current_streak > user.longest_streak:
        user.longest_streak = user.current_streak
    
    # Add coins to current egg
    egg = db.query(models.Egg).filter(models.Egg.user_id == user_id).first()
    if egg:
        egg.coins_deposited += coins
    
    db.commit()
    db.refresh(session)
    return session


def get_user_sessions(db: Session, user_id: int, limit: int = 50) -> List[models.StudySession]:
    return db.query(models.StudySession).filter(
        models.StudySession.user_id == user_id
    ).order_by(models.StudySession.completed_at.desc()).limit(limit).all()


# ============ Animal CRUD ============

def get_all_animals(db: Session) -> List[models.Animal]:
    return db.query(models.Animal).all()


def get_user_animals(db: Session, user_id: int) -> List[models.UserAnimal]:
    return db.query(models.UserAnimal).filter(
        models.UserAnimal.user_id == user_id
    ).order_by(models.UserAnimal.hatched_at.desc()).all()


def name_animal(db: Session, user_animal_id: int, user_id: int, nickname: str) -> Optional[models.UserAnimal]:
    animal = db.query(models.UserAnimal).filter(
        models.UserAnimal.id == user_animal_id,
        models.UserAnimal.user_id == user_id
    ).first()
    if animal:
        animal.nickname = nickname
        db.commit()
        db.refresh(animal)
    return animal


# ============ Egg CRUD ============

def create_egg_for_user(db: Session, user_id: int) -> models.Egg:
    # Calculate required coins based on animals hatched
    animals_count = db.query(models.UserAnimal).filter(
        models.UserAnimal.user_id == user_id
    ).count()
    
    # Progressive cost: starts at 100, increases by 25 for each animal hatched
    base_cost = 100
    cost = base_cost + (animals_count * 25)
    
    # Pick a random animal for this egg
    animals = db.query(models.Animal).all()
    animal_id = random.choice(animals).id if animals else None
    
    egg = models.Egg(
        user_id=user_id,
        coins_required=cost,
        animal_id=animal_id
    )
    db.add(egg)
    db.commit()
    db.refresh(egg)
    return egg


def get_user_egg(db: Session, user_id: int) -> Optional[models.Egg]:
    return db.query(models.Egg).filter(models.Egg.user_id == user_id).first()


def hatch_egg(db: Session, user_id: int) -> tuple[bool, Optional[models.Animal], str]:
    egg = db.query(models.Egg).filter(models.Egg.user_id == user_id).first()
    if not egg:
        return False, None, "No egg found"
    
    if egg.coins_deposited < egg.coins_required:
        return False, None, f"Need {egg.coins_required - egg.coins_deposited} more coins"
    
    # Get the animal
    animal = db.query(models.Animal).filter(models.Animal.id == egg.animal_id).first()
    if not animal:
        return False, None, "No animal available"
    
    # Create user animal
    user_animal = models.UserAnimal(
        user_id=user_id,
        animal_id=animal.id
    )
    db.add(user_animal)
    
    # Deduct coins from user
    user = db.query(models.User).filter(models.User.id == user_id).first()
    user.current_coins -= egg.coins_required
    
    # Delete old egg and create new one
    db.delete(egg)
    db.commit()
    
    # Create new egg
    create_egg_for_user(db, user_id)
    
    return True, animal, f"Congratulations! You hatched a {animal.name}!"


# ============ Study Tips CRUD ============

def get_study_tips(db: Session, user_id: int, limit: int = 10) -> List[models.StudyTip]:
    # Get tips the user hasn't viewed yet
    viewed_ids = db.query(models.TipView.tip_id).filter(
        models.TipView.user_id == user_id
    ).subquery()
    
    tips = db.query(models.StudyTip).filter(
        ~models.StudyTip.id.in_(viewed_ids)
    ).order_by(func.random()).limit(limit).all()
    
    # If not enough unviewed tips, get random tips
    if len(tips) < limit:
        tips = db.query(models.StudyTip).order_by(func.random()).limit(limit).all()
    
    return tips


def mark_tip_viewed(db: Session, user_id: int, tip_id: int, liked: bool = False):
    existing = db.query(models.TipView).filter(
        models.TipView.user_id == user_id,
        models.TipView.tip_id == tip_id
    ).first()
    
    if existing:
        if liked and not existing.liked:
            existing.liked = True
            tip = db.query(models.StudyTip).filter(models.StudyTip.id == tip_id).first()
            if tip:
                tip.likes_count += 1
    else:
        view = models.TipView(user_id=user_id, tip_id=tip_id, liked=liked)
        db.add(view)
        if liked:
            tip = db.query(models.StudyTip).filter(models.StudyTip.id == tip_id).first()
            if tip:
                tip.likes_count += 1
    
    db.commit()


def create_study_tip(db: Session, user_id: int, content: str, category: str = "general") -> models.StudyTip:
    tip = models.StudyTip(user_id=user_id, content=content, category=category)
    db.add(tip)
    db.commit()
    db.refresh(tip)
    return tip


# ============ Social CRUD ============

def send_friend_request(db: Session, user_id: int, friend_email: str) -> tuple[bool, str]:
    friend = db.query(models.User).filter(models.User.email == friend_email).first()
    if not friend:
        return False, "User not found"
    
    if friend.id == user_id:
        return False, "Cannot add yourself as friend"
    
    # Check if already friends or pending
    existing = db.query(models.Friendship).filter(
        ((models.Friendship.user_id == user_id) & (models.Friendship.friend_id == friend.id)) |
        ((models.Friendship.user_id == friend.id) & (models.Friendship.friend_id == user_id))
    ).first()
    
    if existing:
        return False, "Friend request already exists"
    
    friendship = models.Friendship(user_id=user_id, friend_id=friend.id)
    db.add(friendship)
    db.commit()
    return True, "Friend request sent"


def accept_friend_request(db: Session, user_id: int, request_id: int) -> bool:
    friendship = db.query(models.Friendship).filter(
        models.Friendship.id == request_id,
        models.Friendship.friend_id == user_id,
        models.Friendship.status == "pending"
    ).first()
    
    if friendship:
        friendship.status = "accepted"
        db.commit()
        return True
    return False


def get_friends(db: Session, user_id: int) -> List[models.User]:
    # Get accepted friendships where user is either side
    friendships = db.query(models.Friendship).filter(
        models.Friendship.status == "accepted",
        ((models.Friendship.user_id == user_id) | (models.Friendship.friend_id == user_id))
    ).all()
    
    friend_ids = []
    for f in friendships:
        if f.user_id == user_id:
            friend_ids.append(f.friend_id)
        else:
            friend_ids.append(f.user_id)
    
    return db.query(models.User).filter(models.User.id.in_(friend_ids)).all()


def get_leaderboard(db: Session, user_id: int, limit: int = 20) -> List[dict]:
    # Get friends
    friends = get_friends(db, user_id)
    friend_ids = [f.id for f in friends] + [user_id]
    
    users = db.query(models.User).filter(
        models.User.id.in_(friend_ids)
    ).order_by(models.User.total_study_minutes.desc()).limit(limit).all()
    
    leaderboard = []
    for rank, user in enumerate(users, 1):
        animals_count = db.query(models.UserAnimal).filter(
            models.UserAnimal.user_id == user.id
        ).count()
        
        leaderboard.append({
            "rank": rank,
            "user_id": user.id,
            "username": user.username or user.email.split("@")[0],
            "total_study_minutes": user.total_study_minutes,
            "current_streak": user.current_streak,
            "animals_count": animals_count
        })
    
    return leaderboard


# ============ Stats CRUD ============

def get_user_stats(db: Session, user_id: int) -> dict:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    
    animals_count = db.query(models.UserAnimal).filter(
        models.UserAnimal.user_id == user_id
    ).count()
    
    tasks_completed = db.query(models.Task).filter(
        models.Task.user_id == user_id,
        models.Task.is_completed == True
    ).count()
    
    # Weekly study minutes
    week_ago = datetime.utcnow() - timedelta(days=7)
    weekly_minutes = db.query(func.sum(models.StudySession.duration_minutes)).filter(
        models.StudySession.user_id == user_id,
        models.StudySession.completed_at >= week_ago
    ).scalar() or 0
    
    return {
        "total_coins": user.total_coins,
        "current_coins": user.current_coins,
        "total_study_minutes": user.total_study_minutes,
        "total_sessions": user.total_sessions,
        "current_streak": user.current_streak,
        "longest_streak": user.longest_streak,
        "animals_hatched": animals_count,
        "tasks_completed": tasks_completed,
        "weekly_study_minutes": weekly_minutes
    }
