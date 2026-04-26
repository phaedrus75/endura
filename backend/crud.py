from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_
from datetime import datetime, timedelta
from typing import List, Optional
import models
import random


def get_effective_streak(user: models.User) -> int:
    """Return the real-time streak, accounting for missed days since last study."""
    if not user.last_study_date or not user.current_streak:
        return 0
    today = datetime.utcnow().date()
    last_date = user.last_study_date.date()
    if last_date == today or last_date == today - timedelta(days=1):
        return user.current_streak
    return 0


# ============ User CRUD ============

def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.email == email).first()


def create_user(db: Session, email: str, hashed_password: str) -> models.User:
    user = models.User(email=email, hashed_password=hashed_password)
    db.add(user)
    db.commit()
    db.refresh(user)
    
    create_egg_for_user(db, user.id)
    
    return user


def _assign_default_subjects(db: Session, user_id: int):
    """Give a new user the four starter subjects."""
    starter = ["math", "science", "english", "history"]
    subjects = db.query(models.Subject).filter(models.Subject.name.in_(starter)).all()
    for s in subjects:
        existing = db.query(models.UserSubject).filter(
            models.UserSubject.user_id == user_id,
            models.UserSubject.subject_id == s.id,
        ).first()
        if not existing:
            db.add(models.UserSubject(user_id=user_id, subject_id=s.id))
    db.commit()


def update_username(db: Session, user_id: int, username: str) -> models.User:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user:
        user.username = username
        if user.username_set_at is None:
            user.username_set_at = datetime.utcnow()
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

def create_study_session(db: Session, user_id: int, duration_minutes: int, task_id: int = None, animal_name: str = None, subject_id: int = None) -> tuple:
    user = db.query(models.User).filter(models.User.id == user_id).first()

    coins = duration_minutes
    if duration_minutes >= 25:
        coins += 5
    if duration_minutes >= 50:
        coins += 10
    multiplier = getattr(user, "eco_credits_multiplier", None) or 1.0
    if multiplier > 1.0:
        coins = int(coins * multiplier)
    
    session = models.StudySession(
        user_id=user_id,
        task_id=task_id,
        duration_minutes=duration_minutes,
        coins_earned=coins,
        subject_id=subject_id,
        completed_at=datetime.utcnow()
    )
    db.add(session)
    
    # Update user stats
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
    
    # AUTO-HATCH: Hatch the specific animal selected by the user
    hatched_animal = None
    if animal_name:
        # Find or create the animal in the database
        animal = db.query(models.Animal).filter(models.Animal.name == animal_name).first()
        if not animal:
            # Create the animal if it doesn't exist
            animal = models.Animal(
                name=animal_name,
                species=f"{animal_name} species",
                rarity="common",
                conservation_status="Endangered",
                description=f"A beautiful {animal_name}"
            )
            db.add(animal)
            db.flush()  # Get the ID
        
        user_animal = models.UserAnimal(
            user_id=user_id,
            animal_id=animal.id
        )
        db.add(user_animal)
        
        hatched_animal = animal
    
    db.commit()
    db.refresh(session)
    return session, hatched_animal


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
        species = db.query(models.Animal).filter(models.Animal.id == animal.animal_id).first()
        if species:
            event = db.query(models.ActivityEvent).filter(
                models.ActivityEvent.user_id == user_id,
                models.ActivityEvent.event_type == "animal_hatched",
                models.ActivityEvent.description.contains(species.name),
            ).order_by(models.ActivityEvent.created_at.desc()).first()
            if event:
                event.description = f"just hatched a {species.name} called {nickname}!"
                db.commit()
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
    if limit >= 50:
        return db.query(models.StudyTip).order_by(models.StudyTip.id).all()

    viewed_ids = db.query(models.TipView.tip_id).filter(
        models.TipView.user_id == user_id
    ).subquery()
    
    tips = db.query(models.StudyTip).filter(
        ~models.StudyTip.id.in_(viewed_ids)
    ).order_by(func.random()).limit(limit).all()
    
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

def send_friend_request(db: Session, user_id: int, friend_username: str) -> tuple[bool, str]:
    from sqlalchemy.exc import IntegrityError
    friend = db.query(models.User).filter(models.User.username == friend_username).first()
    if not friend or getattr(friend, "is_archived", False):
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
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return False, "Friend request already exists"
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


def get_pending_requests(db: Session, user_id: int) -> List[dict]:
    pending = db.query(models.Friendship).filter(
        models.Friendship.friend_id == user_id,
        models.Friendship.status == "pending"
    ).all()
    results = []
    for f in pending:
        sender = db.query(models.User).filter(models.User.id == f.user_id).first()
        if sender and not getattr(sender, "is_archived", False):
            results.append({
                "id": f.id,
                "user_id": sender.id,
                "username": sender.username,
                "profile_pic_url": sender.profile_pic_url,
            })
    return results


def get_friends(db: Session, user_id: int):
    friendships = db.query(models.Friendship).filter(
        models.Friendship.status == "accepted",
        ((models.Friendship.user_id == user_id) | (models.Friendship.friend_id == user_id))
    ).all()
    
    results = []
    for f in friendships:
        friend_id = f.friend_id if f.user_id == user_id else f.user_id
        friend = db.query(models.User).filter(models.User.id == friend_id).first()
        if friend and not getattr(friend, "is_archived", False):
            results.append({"user": friend, "friends_since": f.created_at})
    return results


def remove_friend(db: Session, user_id: int, friend_id: int) -> bool:
    friendship = db.query(models.Friendship).filter(
        models.Friendship.status == "accepted",
        (
            ((models.Friendship.user_id == user_id) & (models.Friendship.friend_id == friend_id)) |
            ((models.Friendship.user_id == friend_id) & (models.Friendship.friend_id == user_id))
        )
    ).first()
    if not friendship:
        return False
    db.delete(friendship)
    db.commit()
    return True


def get_friend_suggestions(db: Session, user_id: int, limit: int = 10) -> List[dict]:
    """Return users from the same school who aren't already friends or pending."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user or not user.school:
        return []

    all_friendships = db.query(models.Friendship).filter(
        (models.Friendship.user_id == user_id) | (models.Friendship.friend_id == user_id)
    ).all()
    exclude_ids = {user_id}
    for f in all_friendships:
        exclude_ids.add(f.user_id)
        exclude_ids.add(f.friend_id)

    suggestions = db.query(models.User).filter(
        models.User.school == user.school,
        models.User.id.notin_(exclude_ids),
        models.User.username.isnot(None),
        or_(models.User.is_archived == False, models.User.is_archived == None),
    ).order_by(models.User.total_study_minutes.desc()).limit(limit).all()

    return [
        {
            "id": s.id,
            "username": s.username,
            "total_study_minutes": s.total_study_minutes or 0,
            "current_streak": get_effective_streak(s),
            "profile_pic_url": s.profile_pic_url,
            "school": s.school,
        }
        for s in suggestions
    ]


def remove_group_member(db: Session, admin_user_id: int, group_id: int, target_user_id: int) -> tuple[bool, str]:
    group = db.query(models.StudyGroup).filter(models.StudyGroup.id == group_id).first()
    if not group:
        return False, "Group not found"
    if group.creator_id != admin_user_id:
        return False, "Only the group admin can remove members"
    if target_user_id == admin_user_id:
        return False, "You cannot remove yourself"
    member = db.query(models.GroupMember).filter(
        models.GroupMember.group_id == group_id,
        models.GroupMember.user_id == target_user_id,
    ).first()
    if not member:
        return False, "User is not a member of this group"
    db.delete(member)
    db.commit()
    return True, "Member removed"


def _week_start() -> datetime:
    now = datetime.utcnow()
    return datetime(now.year, now.month, now.day) - timedelta(days=now.weekday())


def _weekly_minutes_map(db: Session, user_ids: List[int] | None = None):
    """Return {user_id: total_minutes_this_week}."""
    start = _week_start()
    q = db.query(
        models.StudySession.user_id,
        func.coalesce(func.sum(models.StudySession.duration_minutes), 0),
    ).filter(models.StudySession.started_at >= start)
    if user_ids is not None:
        q = q.filter(models.StudySession.user_id.in_(user_ids))
    rows = q.group_by(models.StudySession.user_id).all()
    return {uid: int(mins) for uid, mins in rows}


def get_global_leaderboard(db: Session, period: str = "all_time") -> List[dict]:
    if period == "week":
        weekly = _weekly_minutes_map(db)
        user_ids = list(weekly.keys())
        if not user_ids:
            return []
        users_by_id = {
            u.id: u
            for u in db.query(models.User).filter(
                models.User.id.in_(user_ids),
                or_(models.User.is_archived == False, models.User.is_archived == None),
            ).all()
        }
        sorted_ids = sorted(user_ids, key=lambda uid: weekly.get(uid, 0), reverse=True)[:100]
        leaderboard = []
        for rank, uid in enumerate(sorted_ids, 1):
            u = users_by_id.get(uid)
            if not u:
                continue
            leaderboard.append({
                "rank": rank,
                "user_id": u.id,
                "username": u.username or f"User {u.id}",
                "total_study_minutes": weekly.get(uid, 0),
                "current_streak": get_effective_streak(u),
                "animals_count": 0,
                "total_donated": 0,
                "profile_pic_url": u.profile_pic_url,
            })
        return leaderboard

    users = db.query(models.User).filter(
        or_(models.User.is_archived == False, models.User.is_archived == None),
    ).order_by(
        models.User.total_study_minutes.desc()
    ).limit(100).all()

    leaderboard = []
    for rank, u in enumerate(users, 1):
        leaderboard.append({
            "rank": rank,
            "user_id": u.id,
            "username": u.username or f"User {u.id}",
            "total_study_minutes": u.total_study_minutes,
            "current_streak": get_effective_streak(u),
            "animals_count": 0,
            "total_donated": 0,
            "profile_pic_url": u.profile_pic_url,
        })
    return leaderboard


def get_school_leaderboard(db: Session, current_user, period: str = "all_time") -> List[dict]:
    if not current_user.school:
        return []
    school_lower = current_user.school.strip().lower()
    users = db.query(models.User).filter(
        models.User.school.isnot(None),
        func.lower(func.trim(models.User.school)) == school_lower,
        or_(models.User.is_archived == False, models.User.is_archived == None),
    ).limit(100).all()

    if period == "week":
        user_ids = [u.id for u in users]
        weekly = _weekly_minutes_map(db, user_ids)
        users_with_mins = [(u, weekly.get(u.id, 0)) for u in users]
        users_with_mins.sort(key=lambda x: x[1], reverse=True)
        leaderboard = []
        for rank, (u, mins) in enumerate(users_with_mins, 1):
            leaderboard.append({
                "rank": rank,
                "user_id": u.id,
                "username": u.username or f"User {u.id}",
                "total_study_minutes": mins,
                "current_streak": get_effective_streak(u),
                "animals_count": 0,
                "total_donated": 0,
                "profile_pic_url": u.profile_pic_url,
            })
        return leaderboard

    users_sorted = sorted(users, key=lambda u: u.total_study_minutes, reverse=True)
    leaderboard = []
    for rank, u in enumerate(users_sorted, 1):
        leaderboard.append({
            "rank": rank,
            "user_id": u.id,
            "username": u.username or f"User {u.id}",
            "total_study_minutes": u.total_study_minutes,
            "current_streak": get_effective_streak(u),
            "animals_count": 0,
            "total_donated": 0,
            "profile_pic_url": u.profile_pic_url,
        })
    return leaderboard


def get_leaderboard(db: Session, user_id: int, limit: int = 20, period: str = "all_time") -> List[dict]:
    friends = get_friends(db, user_id)
    friend_ids = [entry["user"].id for entry in friends] + [user_id]

    users = db.query(models.User).filter(
        models.User.id.in_(friend_ids),
        or_(models.User.is_archived == False, models.User.is_archived == None),
    ).limit(limit).all()

    if period == "week":
        weekly = _weekly_minutes_map(db, friend_ids)
        users_with_mins = [(u, weekly.get(u.id, 0)) for u in users]
        users_with_mins.sort(key=lambda x: x[1], reverse=True)
    else:
        users_with_mins = [(u, u.total_study_minutes) for u in users]
        users_with_mins.sort(key=lambda x: x[1], reverse=True)

    leaderboard = []
    for rank, (user, mins) in enumerate(users_with_mins, 1):
        animals_count = db.query(models.UserAnimal).filter(
            models.UserAnimal.user_id == user.id
        ).count()

        total_donated = db.query(
            func.coalesce(func.sum(models.Donation.amount), 0)
        ).filter(models.Donation.user_id == user.id).scalar()

        leaderboard.append({
            "rank": rank,
            "user_id": user.id,
            "username": user.username or f"User {user.id}",
            "total_study_minutes": mins,
            "current_streak": get_effective_streak(user),
            "animals_count": animals_count,
            "total_donated": float(total_donated),
            "profile_pic_url": user.profile_pic_url,
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
    
    # Weekly study minutes - daily breakdown [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
    today = datetime.utcnow().date()
    current_weekday = today.weekday()  # 0=Monday
    monday = today - timedelta(days=current_weekday)
    
    weekly_daily = [0] * 7
    week_sessions = db.query(models.StudySession).filter(
        models.StudySession.user_id == user_id,
        models.StudySession.completed_at >= datetime.combine(monday, datetime.min.time())
    ).all()
    for session in week_sessions:
        if session.completed_at:
            day_idx = session.completed_at.weekday()
            if 0 <= day_idx < 7:
                weekly_daily[day_idx] += session.duration_minutes
    
    weekly_minutes = sum(weekly_daily)

    # Monthly study minutes - weekly breakdown for last 4 weeks [Week 1, Week 2, Week 3, This Week]
    monthly_weekly = [0] * 4
    four_weeks_ago = monday - timedelta(days=21)
    four_weeks_ago_dt = datetime.combine(four_weeks_ago, datetime.min.time())
    month_sessions = db.query(models.StudySession).filter(
        models.StudySession.user_id == user_id,
        models.StudySession.completed_at != None,
        models.StudySession.completed_at >= four_weeks_ago_dt
    ).all()
    for session in month_sessions:
        if session.completed_at and session.duration_minutes:
            session_date = session.completed_at.date() if hasattr(session.completed_at, 'date') else session.completed_at
            days_since_start = (session_date - four_weeks_ago).days
            week_idx = min(max(days_since_start // 7, 0), 3)
            monthly_weekly[week_idx] += session.duration_minutes

    # Study minutes by subject
    subject_query = db.query(
        models.Subject.display_name,
        func.sum(models.StudySession.duration_minutes)
    ).join(
        models.Subject, models.StudySession.subject_id == models.Subject.id
    ).filter(
        models.StudySession.user_id == user_id,
        models.StudySession.subject_id != None
    ).group_by(models.Subject.id, models.Subject.display_name).all()
    
    study_minutes_by_subject = {row[0]: int(row[1]) for row in subject_query if row[0]}
    
    return {
        "total_coins": user.total_coins,
        "current_coins": user.current_coins,
        "total_study_minutes": user.total_study_minutes,
        "total_sessions": user.total_sessions,
        "current_streak": get_effective_streak(user),
        "longest_streak": user.longest_streak,
        "animals_hatched": animals_count,
        "tasks_completed": tasks_completed,
        "weekly_study_minutes": weekly_daily,
        "monthly_study_minutes": monthly_weekly,
        "study_minutes_by_subject": study_minutes_by_subject
    }


# ============ Study Group CRUD ============

def create_group(db: Session, creator_id: int, name: str, goal_minutes: int, goal_deadline, subject_id: int = None) -> models.StudyGroup:
    group = models.StudyGroup(
        name=name, creator_id=creator_id,
        goal_minutes=goal_minutes, goal_deadline=goal_deadline,
        subject_id=subject_id
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    db.add(models.GroupMember(group_id=group.id, user_id=creator_id, role="admin"))
    db.commit()
    creator = db.query(models.User).filter(models.User.id == creator_id).first()
    _create_event(db, creator_id, "group_created", f"created study group \"{name}\"")
    return group


def join_group(db: Session, user_id: int, group_id: int) -> tuple:
    from sqlalchemy.exc import IntegrityError
    group = db.query(models.StudyGroup).filter(models.StudyGroup.id == group_id).with_for_update().first()
    if not group:
        return None, "Group not found"
    existing = db.query(models.GroupMember).filter(
        models.GroupMember.group_id == group_id,
        models.GroupMember.user_id == user_id
    ).first()
    if existing:
        return None, "Already a member"
    member_count = db.query(models.GroupMember).filter(models.GroupMember.group_id == group_id).count()
    if member_count >= 10:
        return None, "Group is full (max 10)"
    db.add(models.GroupMember(group_id=group_id, user_id=user_id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return None, "Already a member"
    return group, None


def leave_group(db: Session, user_id: int, group_id: int) -> bool:
    member = db.query(models.GroupMember).filter(
        models.GroupMember.group_id == group_id,
        models.GroupMember.user_id == user_id
    ).first()
    if not member:
        return False
    db.delete(member)
    db.commit()
    return True


def get_user_groups(db: Session, user_id: int) -> List[dict]:
    memberships = db.query(models.GroupMember).filter(models.GroupMember.user_id == user_id).all()
    results = []
    for m in memberships:
        group = db.query(models.StudyGroup).filter(models.StudyGroup.id == m.group_id).first()
        if not group:
            continue
        members_raw = db.query(models.GroupMember).filter(models.GroupMember.group_id == group.id).all()
        member_ids = [mb.user_id for mb in members_raw]

        total = 0
        member_list = []
        for mb in members_raw:
            u = db.query(models.User).filter(models.User.id == mb.user_id).first()
            mins = _group_member_minutes(db, mb.user_id, group)
            total += mins
            member_list.append({
                "user_id": mb.user_id,
                "username": u.username if u else None,
                "role": mb.role,
                "minutes_contributed": mins,
                "profile_pic_url": u.profile_pic_url if u else None,
            })

        subject_display = None
        if group.subject_id:
            subj = db.query(models.Subject).filter(models.Subject.id == group.subject_id).first()
            subject_display = subj.display_name if subj else None

        results.append({
            "id": group.id, "name": group.name, "creator_id": group.creator_id,
            "goal_minutes": group.goal_minutes, "goal_deadline": group.goal_deadline,
            "subject": subject_display,
            "subject_id": group.subject_id,
            "created_at": group.created_at, "members": member_list,
            "total_minutes": total, "goal_met": total >= group.goal_minutes
        })
    return results


def _group_member_minutes(db: Session, user_id: int, group) -> int:
    since = group.created_at
    q = db.query(func.sum(models.StudySession.duration_minutes)).filter(
        models.StudySession.user_id == user_id,
        models.StudySession.completed_at >= since
    )
    if group.subject_id:
        q = q.filter(models.StudySession.subject_id == group.subject_id)
    return q.scalar() or 0


def send_group_message(db: Session, user_id: int, group_id: int, content: str) -> Optional[dict]:
    member = db.query(models.GroupMember).filter(
        models.GroupMember.group_id == group_id,
        models.GroupMember.user_id == user_id
    ).first()
    if not member:
        return None
    msg = models.GroupMessage(group_id=group_id, user_id=user_id, content=content)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    u = db.query(models.User).filter(models.User.id == user_id).first()
    return {"id": msg.id, "user_id": user_id, "username": u.username if u else None,
            "content": msg.content, "created_at": msg.created_at,
            "profile_pic_url": u.profile_pic_url if u else None}


def get_group_messages(db: Session, group_id: int, user_id: int, limit: int = 50) -> List[dict]:
    member = db.query(models.GroupMember).filter(
        models.GroupMember.group_id == group_id,
        models.GroupMember.user_id == user_id
    ).first()
    if not member:
        return None
    msgs = db.query(models.GroupMessage).filter(
        models.GroupMessage.group_id == group_id
    ).order_by(models.GroupMessage.created_at.desc()).limit(limit).all()
    results = []
    for m in msgs:
        u = db.query(models.User).filter(models.User.id == m.user_id).first()
        results.append({
            "id": m.id, "user_id": m.user_id,
            "username": u.username if u else None,
            "content": m.content, "created_at": m.created_at,
            "profile_pic_url": u.profile_pic_url if u else None,
        })
    return list(reversed(results))


# ============ Activity Feed CRUD ============

def _create_event(db: Session, user_id: int, event_type: str, description: str, extra_data: str = None):
    db.add(models.ActivityEvent(
        user_id=user_id, event_type=event_type,
        description=description, extra_data=extra_data
    ))
    db.commit()


def create_session_event(db: Session, user_id: int, minutes: int, animal_name: str = None):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    name = user.username if user else "Someone"
    _create_event(db, user_id, "session_complete", f"completed a {minutes}-minute study session")
    if animal_name:
        _create_event(db, user_id, "animal_hatched", f"just hatched a {animal_name}!")
    if user and user.current_streak and user.current_streak % 7 == 0 and user.current_streak > 0:
        _create_event(db, user_id, "streak_milestone", f"is on a {user.current_streak}-day streak!")


def get_friend_feed(db: Session, user_id: int, limit: int = 30) -> List[dict]:
    friends = get_friends(db, user_id)
    friend_ids = [entry["user"].id for entry in friends]
    if not friend_ids:
        return []

    # Exclude blocked users
    blocked_ids = [b.blocked_id for b in db.query(models.UserBlock).filter(
        models.UserBlock.blocker_id == user_id
    ).all()]
    visible_ids = [fid for fid in friend_ids if fid not in blocked_ids]
    if not visible_ids:
        return []

    events = db.query(models.ActivityEvent).filter(
        models.ActivityEvent.user_id.in_(visible_ids)
    ).order_by(models.ActivityEvent.created_at.desc()).limit(limit).all()

    if not events:
        return []

    # Batch-fetch all users and reactions in two queries (eliminates N+1).
    event_user_ids = list({e.user_id for e in events})
    event_ids = [e.id for e in events]

    users_by_id = {
        u.id: u
        for u in db.query(models.User).filter(models.User.id.in_(event_user_ids)).all()
    }
    reactions_by_event: dict[int, list] = {e.id: [] for e in events}
    for r in db.query(models.FeedReaction).filter(
        models.FeedReaction.event_id.in_(event_ids)
    ).all():
        reactions_by_event[r.event_id].append({"user_id": r.user_id, "reaction": r.reaction})

    results = []
    for e in events:
        u = users_by_id.get(e.user_id)
        results.append({
            "id": e.id, "user_id": e.user_id,
            "username": u.username if u else None,
            "event_type": e.event_type, "description": e.description,
            "created_at": e.created_at,
            "reactions": reactions_by_event[e.id],
        })
    return results


def add_reaction(db: Session, user_id: int, event_id: int, reaction: str) -> bool:
    event = db.query(models.ActivityEvent).filter(models.ActivityEvent.id == event_id).first()
    if not event:
        return False
    if event.user_id != user_id:
        friendship = db.query(models.Friendship).filter(
            models.Friendship.status == "accepted",
            (
                ((models.Friendship.user_id == user_id) & (models.Friendship.friend_id == event.user_id)) |
                ((models.Friendship.user_id == event.user_id) & (models.Friendship.friend_id == user_id))
            )
        ).first()
        if not friendship:
            return False
    existing = db.query(models.FeedReaction).filter(
        models.FeedReaction.event_id == event_id,
        models.FeedReaction.user_id == user_id
    ).first()
    if existing:
        existing.reaction = reaction
    else:
        db.add(models.FeedReaction(event_id=event_id, user_id=user_id, reaction=reaction))
    db.commit()
    return True


# ============ Badge System ============

BADGE_DEFINITIONS = [
    # Getting Started
    {"id": "first_steps", "name": "First Steps", "icon": "👣", "description": "Every journey begins with a single session.", "category": "getting_started", "tier": "bronze"},
    {"id": "finding_rhythm", "name": "Finding Your Rhythm", "icon": "🎵", "description": "You're getting the hang of this.", "category": "getting_started", "tier": "bronze"},
    {"id": "double_digits", "name": "Double Digits", "icon": "🔟", "description": "Ten down, thousands to go.", "category": "getting_started", "tier": "bronze"},
    {"id": "halfway_hero", "name": "Halfway Hero", "icon": "🏅", "description": "Quarter century of focus.", "category": "getting_started", "tier": "silver"},
    {"id": "session_centurion", "name": "Session Centurion", "icon": "💯", "description": "Triple digits. Absolute legend.", "category": "getting_started", "tier": "gold"},
    {"id": "dedicated_learner", "name": "Dedicated Learner", "icon": "📖", "description": "Two hundred sessions of pure commitment.", "category": "getting_started", "tier": "diamond"},
    # Streaks
    {"id": "on_fire", "name": "On Fire", "icon": "🔥", "description": "Three days strong — keep the flame alive.", "category": "streaks", "tier": "bronze"},
    {"id": "momentum_builder", "name": "Momentum Builder", "icon": "⚡", "description": "Five days. The momentum is real.", "category": "streaks", "tier": "bronze"},
    {"id": "week_warrior", "name": "Week Warrior", "icon": "🗓️", "description": "A full week without missing a beat.", "category": "streaks", "tier": "silver"},
    {"id": "fortnight_force", "name": "Fortnight Force", "icon": "🛡️", "description": "Two weeks of pure consistency.", "category": "streaks", "tier": "silver"},
    {"id": "monthly_machine", "name": "Monthly Machine", "icon": "⚙️", "description": "Habits are forged in this fire.", "category": "streaks", "tier": "gold"},
    {"id": "iron_will", "name": "Iron Will", "icon": "🪨", "description": "Two months. Nothing can stop you.", "category": "streaks", "tier": "gold"},
    {"id": "unbreakable", "name": "Unbreakable", "icon": "💎", "description": "Only the most dedicated reach this level.", "category": "streaks", "tier": "diamond"},
    {"id": "ten_day_titan", "name": "Ten-Day Titan", "icon": "🔱", "description": "Double digits. You mean business.", "category": "streaks", "tier": "silver"},
    {"id": "quarter_century", "name": "Quarter Century", "icon": "🏔️", "description": "Twenty-five days of relentless focus.", "category": "streaks", "tier": "gold"},
    # Study Time
    {"id": "hour_of_power", "name": "Hour of Power", "icon": "⏱️", "description": "A full hour of deep focus.", "category": "study_time", "tier": "silver"},
    {"id": "endurance_mode", "name": "Endurance Mode", "icon": "🏋️", "description": "Two hours. Absolute beast.", "category": "study_time", "tier": "gold"},
    {"id": "marathon_mind", "name": "Marathon Mind", "icon": "🏃", "description": "That's a full work day of learning.", "category": "study_time", "tier": "silver"},
    {"id": "study_veteran", "name": "Study Veteran", "icon": "🎖️", "description": "More focused than most.", "category": "study_time", "tier": "gold"},
    {"id": "thousand_minute_club", "name": "Thousand-Minute Club", "icon": "🏛️", "description": "Welcome to an elite club.", "category": "study_time", "tier": "gold"},
    {"id": "time_lord", "name": "Time Lord", "icon": "⏳", "description": "Triple-digit dedication.", "category": "study_time", "tier": "diamond"},
    # Time of Day
    {"id": "early_bird", "name": "Early Bird", "icon": "🐦", "description": "The early bird hatches the egg.", "category": "habits", "tier": "silver"},
    {"id": "dawn_patrol", "name": "Dawn Patrol", "icon": "🌅", "description": "Sunrise scholar.", "category": "habits", "tier": "gold"},
    {"id": "night_owl", "name": "Night Owl", "icon": "🦉", "description": "Burning the midnight oil.", "category": "habits", "tier": "silver"},
    {"id": "moonlight_scholar", "name": "Moonlight Scholar", "icon": "🌙", "description": "The night is your classroom.", "category": "habits", "tier": "gold"},
    {"id": "weekend_scholar", "name": "Weekend Scholar", "icon": "📚", "description": "No days off.", "category": "habits", "tier": "silver"},
    {"id": "lunch_break_learner", "name": "Lunch Break Learner", "icon": "🥪", "description": "Studying through lunch — committed.", "category": "habits", "tier": "bronze"},
    {"id": "comeback_kid", "name": "Comeback Kid", "icon": "🔄", "description": "You came back. That's what matters.", "category": "habits", "tier": "silver"},
    {"id": "golden_hour", "name": "Golden Hour", "icon": "🌇", "description": "Sunset study sessions hit different.", "category": "habits", "tier": "bronze"},
    {"id": "all_nighter", "name": "All-Nighter", "icon": "🌃", "description": "Burning both ends of the candle.", "category": "habits", "tier": "gold"},
    # Animals
    {"id": "first_friend", "name": "First Friend", "icon": "🐣", "description": "Welcome to the sanctuary!", "category": "animals", "tier": "bronze"},
    {"id": "growing_family", "name": "Growing Family", "icon": "🌱", "description": "Your sanctuary is coming to life.", "category": "animals", "tier": "silver"},
    {"id": "collectors_pride", "name": "Collector's Pride", "icon": "🏆", "description": "Quantity AND quality.", "category": "animals", "tier": "gold"},
    {"id": "speed_hatcher", "name": "Speed Hatcher", "icon": "⚡", "description": "Three sessions, three hatches, one day.", "category": "animals", "tier": "gold"},
    {"id": "full_sanctuary", "name": "Full Sanctuary", "icon": "🌍", "description": "Every endangered species — saved by studying.", "category": "animals", "tier": "diamond"},
    {"id": "favourite_friend", "name": "Favourite Friend", "icon": "❤️", "description": "Clearly you have a favourite.", "category": "animals", "tier": "silver"},
    {"id": "naming_ceremony", "name": "Naming Ceremony", "icon": "✏️", "description": "Each one is special to you.", "category": "animals", "tier": "bronze"},
    {"id": "rare_finder", "name": "Rare Finder", "icon": "🔮", "description": "A rare specimen joins the sanctuary.", "category": "animals", "tier": "silver"},
    {"id": "legendary_keeper", "name": "Legendary Keeper", "icon": "🐉", "description": "Legends live in your sanctuary.", "category": "animals", "tier": "gold"},
    # Eco-Credits
    {"id": "saver", "name": "Saver", "icon": "🍀", "description": "Saving up for something special?", "category": "eco_credits", "tier": "silver"},
    {"id": "big_spender", "name": "Big Spender", "icon": "💸", "description": "Treating the sanctuary right.", "category": "eco_credits", "tier": "gold"},
    {"id": "window_shopper", "name": "Window Shopper", "icon": "👀", "description": "Just browsing... for now.", "category": "eco_credits", "tier": "bronze"},
    {"id": "eco_mogul", "name": "Eco Mogul", "icon": "🤑", "description": "A true eco-credit tycoon.", "category": "eco_credits", "tier": "diamond"},
    {"id": "impulse_buyer", "name": "Impulse Buyer", "icon": "🛒", "description": "Couldn't resist.", "category": "eco_credits", "tier": "silver"},
    {"id": "first_purchase", "name": "First Purchase", "icon": "🎉", "description": "Your first shop purchase — exciting!", "category": "eco_credits", "tier": "bronze"},
    # Subjects
    {"id": "subject_explorer", "name": "Subject Explorer", "icon": "🧭", "description": "A well-rounded learner.", "category": "subjects", "tier": "silver"},
    {"id": "renaissance_student", "name": "Renaissance Student", "icon": "🎨", "description": "Curious about everything.", "category": "subjects", "tier": "gold"},
    {"id": "deep_diver", "name": "Deep Diver", "icon": "🤿", "description": "Mastery takes dedication.", "category": "subjects", "tier": "gold"},
    {"id": "subject_champion", "name": "Subject Champion", "icon": "👑", "description": "You own this subject now.", "category": "subjects", "tier": "diamond"},
    {"id": "balanced_brain", "name": "Balanced Brain", "icon": "⚖️", "description": "Keeping all the plates spinning.", "category": "subjects", "tier": "silver"},
    {"id": "polymath", "name": "Polymath", "icon": "🧠", "description": "Knowledge knows no boundaries.", "category": "subjects", "tier": "diamond"},
    # Sanctuary
    {"id": "interior_designer", "name": "Interior Designer", "icon": "🎨", "description": "Making it feel like home.", "category": "sanctuary", "tier": "silver"},
    {"id": "decorator_deluxe", "name": "Decorator Deluxe", "icon": "✨", "description": "The sanctuary looks incredible.", "category": "sanctuary", "tier": "gold"},
    {"id": "accessory_addict", "name": "Accessory Addict", "icon": "👒", "description": "Fashion-forward sanctuary.", "category": "sanctuary", "tier": "gold"},
    {"id": "curator", "name": "Curator", "icon": "🖼️", "description": "A little bit of everything.", "category": "sanctuary", "tier": "silver"},
    {"id": "green_thumb", "name": "Green Thumb", "icon": "🌿", "description": "Your sanctuary is flourishing.", "category": "sanctuary", "tier": "bronze"},
    {"id": "sanctuary_master", "name": "Sanctuary Master", "icon": "🏰", "description": "A paradise of your own making.", "category": "sanctuary", "tier": "diamond"},
    # Social
    {"id": "social_butterfly", "name": "Social Butterfly", "icon": "🦋", "description": "Popular AND productive.", "category": "social", "tier": "gold"},
    {"id": "top_of_the_class", "name": "Top of the Class", "icon": "🥇", "description": "This week's champion.", "category": "social", "tier": "diamond"},
    {"id": "generous_spirit", "name": "Generous Spirit", "icon": "🎁", "description": "Sharing is caring.", "category": "social", "tier": "gold"},
    {"id": "study_squad", "name": "Study Squad", "icon": "👥", "description": "Stronger together.", "category": "social", "tier": "gold"},
    {"id": "first_friend_social", "name": "First Friend", "icon": "🤝", "description": "Every friendship starts somewhere.", "category": "social", "tier": "bronze"},
    {"id": "team_player", "name": "Team Player", "icon": "🏅", "description": "Contributing to the group goal.", "category": "social", "tier": "silver"},
    # Special
    {"id": "founding_member", "name": "Founding Member", "icon": "⭐", "description": "One of the first 100 Endura members. 1.25x eco-credits forever.", "category": "special", "tier": "diamond"},
]

BADGE_MAP = {b["id"]: b for b in BADGE_DEFINITIONS}

BADGE_REQUIREMENTS = {
    "first_steps": "Complete your first study session",
    "finding_rhythm": "Complete 8 study sessions",
    "double_digits": "Complete 20 study sessions",
    "halfway_hero": "Complete 40 study sessions",
    "session_centurion": "Complete 100 study sessions",
    "on_fire": "Reach a 3-day study streak",
    "momentum_builder": "Reach a 5-day study streak",
    "week_warrior": "Reach a 7-day study streak",
    "fortnight_force": "Reach a 21-day study streak",
    "monthly_machine": "Reach a 45-day study streak",
    "iron_will": "Reach a 90-day study streak",
    "unbreakable": "Reach a 150-day study streak",
    "hour_of_power": "Complete a single 60-minute study session",
    "endurance_mode": "Complete a single 120-minute study session",
    "marathon_mind": "Study for 600 total minutes (10 hours)",
    "study_veteran": "Study for 3,000 total minutes (50 hours)",
    "thousand_minute_club": "Study for 1,500 total minutes (25 hours)",
    "time_lord": "Study for 6,000 total minutes (100 hours)",
    "early_bird": "Complete a study session before 7 AM",
    "dawn_patrol": "Complete 5 study sessions before 8 AM",
    "night_owl": "Complete a study session after 11 PM",
    "moonlight_scholar": "Complete 5 study sessions after 10 PM",
    "weekend_scholar": "Study on both Saturday and Sunday in the same week",
    "lunch_break_learner": "Complete a study session between 12\u20131 PM",
    "comeback_kid": "Return to study after a 7+ day break",
    "first_friend": "Hatch your first animal",
    "growing_family": "Hatch 8 different animal species",
    "collectors_pride": "Hatch 25 animals total",
    "speed_hatcher": "Hatch 3 animals in a single day",
    "full_sanctuary": "Collect all 30 unique animal species",
    "favourite_friend": "Hatch the same animal species 5 times",
    "naming_ceremony": "Give nicknames to 5 of your animals",
    "saver": "Have 500 eco-credits saved up",
    "big_spender": "Spend 1,000 eco-credits total",
    "window_shopper": "Visit the shop",
    "eco_mogul": "Earn 5,000 eco-credits total",
    "impulse_buyer": "Buy an item from the shop",
    "subject_explorer": "Study 3 different subjects",
    "renaissance_student": "Study 6 different subjects",
    "deep_diver": "Study one subject for 600+ minutes (10 hours)",
    "subject_champion": "Study one subject for 1,500+ minutes (25 hours)",
    "balanced_brain": "Study 3+ different subjects in the same week",
    "interior_designer": "Place a decoration in your sanctuary",
    "decorator_deluxe": "Place 5 decorations in your sanctuary",
    "accessory_addict": "Buy 5 accessories from the shop",
    "curator": "Own items from 3+ different shop categories",
    "social_butterfly": "Add 10 friends",
    "top_of_the_class": "Reach #1 on the weekly leaderboard",
    "generous_spirit": "Share a study tip with a friend",
    "study_squad": "Join or create a study group",
    "dedicated_learner": "Complete 200 study sessions",
    "ten_day_titan": "Reach a 10-day study streak",
    "quarter_century": "Reach a 25-day study streak",
    "golden_hour": "Complete a study session between 5\u20137 PM",
    "all_nighter": "Complete a study session between 2\u20135 AM",
    "rare_finder": "Hatch a rare animal",
    "legendary_keeper": "Hatch a legendary animal",
    "first_purchase": "Buy your first item from the shop",
    "polymath": "Study 10 different subjects",
    "green_thumb": "Place your first decoration",
    "sanctuary_master": "Place 10+ items in your sanctuary",
    "first_friend_social": "Add your first friend",
    "team_player": "Contribute 60+ minutes to a group goal",
    "founding_member": "Be among the first 100 verified Endura users",
}


def get_user_badges(db: Session, user_id: int) -> List[dict]:
    earned = db.query(models.UserBadge).filter(models.UserBadge.user_id == user_id).all()
    earned_map = {ub.badge_id: ub.earned_at for ub in earned}

    result = []
    for b in BADGE_DEFINITIONS:
        entry = {**b, "earned": b["id"] in earned_map,
                 "requirement": BADGE_REQUIREMENTS.get(b["id"], "")}
        if entry["earned"]:
            entry["earned_at"] = earned_map[b["id"]].isoformat()
        result.append(entry)
    return result


def _award(db: Session, user_id: int, badge_id: str, already: set) -> Optional[str]:
    if badge_id in already:
        return None
    db.add(models.UserBadge(user_id=user_id, badge_id=badge_id))
    already.add(badge_id)
    return badge_id


def check_badges(db: Session, user_id: int, session_hour: int = None, session_minutes: int = None) -> List[str]:
    """Check all badge conditions and award any newly earned. Returns list of newly awarded badge_ids."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return []

    earned = db.query(models.UserBadge).filter(models.UserBadge.user_id == user_id).all()
    already = {ub.badge_id for ub in earned}
    new_badges: List[str] = []

    def award(bid):
        r = _award(db, user_id, bid, already)
        if r:
            new_badges.append(r)

    MAX_BADGES_PER_CHECK = 2

    ts = user.total_sessions or 0
    tm = user.total_study_minutes or 0
    cs = user.current_streak or 0
    ls = user.longest_streak or 0
    best_streak = max(cs, ls)
    tc = user.total_coins or 0
    cc = user.current_coins or 0

    def capped_award(bid):
        if len(new_badges) >= MAX_BADGES_PER_CHECK:
            return
        award(bid)

    # Getting Started
    if ts >= 1: capped_award("first_steps")
    if ts >= 8: capped_award("finding_rhythm")
    if ts >= 20: capped_award("double_digits")
    if ts >= 40: capped_award("halfway_hero")
    if ts >= 100: capped_award("session_centurion")
    if ts >= 200: capped_award("dedicated_learner")

    # Streaks
    if best_streak >= 3: capped_award("on_fire")
    if best_streak >= 5: capped_award("momentum_builder")
    if best_streak >= 7: capped_award("week_warrior")
    if best_streak >= 21: capped_award("fortnight_force")
    if best_streak >= 45: capped_award("monthly_machine")
    if best_streak >= 90: capped_award("iron_will")
    if best_streak >= 10: capped_award("ten_day_titan")
    if best_streak >= 25: capped_award("quarter_century")
    if best_streak >= 150: capped_award("unbreakable")

    # Study Time (session length)
    if session_minutes is not None:
        if session_minutes >= 60: capped_award("hour_of_power")
        if session_minutes >= 120: capped_award("endurance_mode")
    # Study Time (cumulative)
    if tm >= 600: capped_award("marathon_mind")
    if tm >= 1500: capped_award("thousand_minute_club")
    if tm >= 3000: capped_award("study_veteran")
    if tm >= 6000: capped_award("time_lord")

    # Time of Day
    if session_hour is not None:
        if session_hour < 7: capped_award("early_bird")
        if session_hour >= 23 or session_hour < 4: capped_award("night_owl")
        if 12 <= session_hour < 13: capped_award("lunch_break_learner")
        if 17 <= session_hour < 19: capped_award("golden_hour")
        if 2 <= session_hour < 5: capped_award("all_nighter")

    # Early bird / night owl multi-session
    early_count = db.query(models.StudySession).filter(
        models.StudySession.user_id == user_id
    ).all()
    early_sessions = sum(1 for s in early_count if s.completed_at and s.completed_at.hour < 8)
    night_sessions = sum(1 for s in early_count if s.completed_at and s.completed_at.hour >= 22)
    if early_sessions >= 5: capped_award("dawn_patrol")
    if night_sessions >= 5: capped_award("moonlight_scholar")

    # Weekend scholar
    today = datetime.utcnow().date()
    current_weekday = today.weekday()
    monday = today - timedelta(days=current_weekday)
    week_sessions = db.query(models.StudySession).filter(
        models.StudySession.user_id == user_id,
        models.StudySession.completed_at >= datetime.combine(monday, datetime.min.time())
    ).all()
    week_days = {s.completed_at.weekday() for s in week_sessions if s.completed_at}
    if 5 in week_days and 6 in week_days: capped_award("weekend_scholar")

    # Comeback kid
    if user.last_study_date and "comeback_kid" not in already:
        all_sessions = db.query(models.StudySession).filter(
            models.StudySession.user_id == user_id
        ).order_by(models.StudySession.completed_at.desc()).limit(2).all()
        if len(all_sessions) >= 2 and all_sessions[0].completed_at and all_sessions[1].completed_at:
            gap = (all_sessions[0].completed_at - all_sessions[1].completed_at).days
            if gap >= 7: capped_award("comeback_kid")

    # Animals
    total_animals = db.query(models.UserAnimal).filter(models.UserAnimal.user_id == user_id).count()
    unique_animals = db.query(models.UserAnimal.animal_id).filter(
        models.UserAnimal.user_id == user_id
    ).distinct().count()
    if total_animals >= 1: capped_award("first_friend")
    if unique_animals >= 8: capped_award("growing_family")
    if total_animals >= 25: capped_award("collectors_pride")
    if unique_animals >= 30: capped_award("full_sanctuary")

    # Favourite friend (same animal 5 times)
    dupes = db.query(func.count(models.UserAnimal.id)).filter(
        models.UserAnimal.user_id == user_id
    ).group_by(models.UserAnimal.animal_id).all()
    if any(c[0] >= 5 for c in dupes): capped_award("favourite_friend")

    # Speed hatcher (3 in one day)
    today_start = datetime.combine(today, datetime.min.time())
    today_hatches = db.query(models.UserAnimal).filter(
        models.UserAnimal.user_id == user_id,
        models.UserAnimal.hatched_at >= today_start
    ).count()
    if today_hatches >= 3: capped_award("speed_hatcher")

    # Rare/legendary animal badges
    user_animal_rarities = db.query(models.Animal.rarity).join(
        models.UserAnimal, models.UserAnimal.animal_id == models.Animal.id
    ).filter(models.UserAnimal.user_id == user_id).all()
    rarity_set = {r[0] for r in user_animal_rarities if r[0]}
    if "rare" in rarity_set or "epic" in rarity_set: capped_award("rare_finder")
    if "legendary" in rarity_set: capped_award("legendary_keeper")

    # Naming ceremony
    named = db.query(models.UserAnimal).filter(
        models.UserAnimal.user_id == user_id,
        models.UserAnimal.nickname != None
    ).count()
    if named >= 5: capped_award("naming_ceremony")

    # Eco-Credits
    if cc >= 500: capped_award("saver")
    if tc >= 5000: capped_award("eco_mogul")
    spent = tc - cc
    if spent >= 1000: capped_award("big_spender")

    # Subjects
    subject_query = db.query(
        models.StudySession.subject_id,
        func.sum(models.StudySession.duration_minutes)
    ).filter(
        models.StudySession.user_id == user_id,
        models.StudySession.subject_id != None
    ).group_by(models.StudySession.subject_id).all()

    distinct_subjects = len(subject_query)
    if distinct_subjects >= 3: capped_award("subject_explorer")
    if distinct_subjects >= 6: capped_award("renaissance_student")

    max_subject_mins = max((s[1] for s in subject_query if s[1]), default=0)
    if max_subject_mins >= 600: capped_award("deep_diver")
    if max_subject_mins >= 1500: capped_award("subject_champion")

    # Balanced brain: 3+ subjects in current week
    week_subjects = db.query(models.StudySession.subject_id).filter(
        models.StudySession.user_id == user_id,
        models.StudySession.completed_at >= datetime.combine(monday, datetime.min.time()),
        models.StudySession.subject_id != None
    ).distinct().count()
    if week_subjects >= 3: capped_award("balanced_brain")
    if distinct_subjects >= 10: capped_award("polymath")

    # Eco-credits: first purchase
    spent = tc - cc
    if spent > 0: capped_award("first_purchase")

    # Friends count
    friend_count = db.query(models.Friendship).filter(
        models.Friendship.status == "accepted",
        ((models.Friendship.user_id == user_id) | (models.Friendship.friend_id == user_id))
    ).count()
    if friend_count >= 1: capped_award("first_friend_social")
    if friend_count >= 10: capped_award("social_butterfly")

    # Team player: contributed 60+ mins to any group
    user_groups = db.query(models.GroupMember).filter(models.GroupMember.user_id == user_id).all()
    for gm in user_groups:
        group = db.query(models.StudyGroup).filter(models.StudyGroup.id == gm.group_id).first()
        if group:
            mins_in_group = _group_member_minutes(db, user_id, group)
            if mins_in_group >= 60:
                capped_award("team_player")
                break

    # Founding Member — first 100 users who complete at least 2 study sessions.
    # (Previous rule was "first 100 verified by created_at" but many users who
    # qualified never got the badge because check_badges wasn't triggered on
    # verify. New rule is engagement-based: you earn it by actually using the
    # app. Existing founders are grandfathered — the `not in already` guard
    # means we never revoke.)
    if "founding_member" not in already:
        FOUNDING_MEMBER_LIMIT = 100
        current_count = db.query(func.count(models.UserBadge.id)).filter(
            models.UserBadge.badge_id == "founding_member"
        ).scalar() or 0
        if current_count < FOUNDING_MEMBER_LIMIT:
            sessions_completed = db.query(func.count(models.StudySession.id)).filter(
                models.StudySession.user_id == user_id,
                models.StudySession.completed_at.isnot(None),
            ).scalar() or 0
            if sessions_completed >= 2:
                awarded = _award(db, user_id, "founding_member", already)
                if awarded:
                    new_badges.append(awarded)
                    user.current_coins = (user.current_coins or 0) + 500
                    user.total_coins = (user.total_coins or 0) + 500
                    user.eco_credits_multiplier = 1.25

    if new_badges:
        db.commit()

    return new_badges


# ============ Subject CRUD ============

def seed_default_subjects(db: Session):
    """Insert standard subjects if they don't exist yet."""
    for name, display_name in models.DEFAULT_SUBJECT_SEEDS:
        existing = db.query(models.Subject).filter(models.Subject.name == name).first()
        if not existing:
            db.add(models.Subject(name=name, display_name=display_name, is_default=True))
    db.commit()


def get_all_subjects(db: Session) -> List[models.Subject]:
    return db.query(models.Subject).filter(models.Subject.is_default == True).order_by(models.Subject.display_name).all()


def get_user_subjects(db: Session, user_id: int) -> List[models.Subject]:
    return (
        db.query(models.Subject)
        .join(models.UserSubject, models.UserSubject.subject_id == models.Subject.id)
        .filter(models.UserSubject.user_id == user_id, models.UserSubject.is_active == True)
        .order_by(models.Subject.display_name)
        .all()
    )


def add_user_subject(db: Session, user_id: int, subject_id: int) -> bool:
    from sqlalchemy.exc import IntegrityError
    existing = db.query(models.UserSubject).filter(
        models.UserSubject.user_id == user_id,
        models.UserSubject.subject_id == subject_id,
    ).first()
    if existing:
        if not existing.is_active:
            existing.is_active = True
            db.commit()
        return True
    sub = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not sub:
        return False
    db.add(models.UserSubject(user_id=user_id, subject_id=subject_id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()  # concurrent add for same (user, subject) — idempotent, treat as success
    return True


def remove_user_subject(db: Session, user_id: int, subject_id: int) -> bool:
    row = db.query(models.UserSubject).filter(
        models.UserSubject.user_id == user_id,
        models.UserSubject.subject_id == subject_id,
    ).first()
    if not row:
        return False
    row.is_active = False
    db.commit()
    return True


def create_custom_subject(db: Session, user_id: int, display_name: str) -> Optional[models.Subject]:
    from sqlalchemy.exc import IntegrityError
    name = display_name.strip().lower()
    if not name:
        return None
    existing = db.query(models.Subject).filter(models.Subject.name == name).first()
    if existing:
        add_user_subject(db, user_id, existing.id)
        return existing
    sub = models.Subject(
        name=name, display_name=display_name.strip(),
        is_default=False, created_by_user_id=user_id,
    )
    db.add(sub)
    try:
        db.commit()
    except IntegrityError:
        # Two concurrent requests raced to create the same subject.
        # Roll back and re-fetch the row the winning request just inserted.
        db.rollback()
        sub = db.query(models.Subject).filter(models.Subject.name == name).first()
        if not sub:
            return None  # should not happen, but guard anyway
    else:
        db.refresh(sub)
    add_user_subject(db, user_id, sub.id)
    return sub


def search_subjects(db: Session, query: str, limit: int = 20) -> List[models.Subject]:
    """Search all standard subjects by display_name (ilike)."""
    if not query or len(query) < 1:
        return []
    pattern = f"%{query}%"
    return (
        db.query(models.Subject)
        .filter(
            models.Subject.is_default == True,
            models.Subject.display_name.ilike(pattern),
        )
        .order_by(models.Subject.display_name)
        .limit(limit)
        .all()
    )


def get_shared_subjects(db: Session, user_ids: List[int]) -> List[models.Subject]:
    """Return subjects that ALL given users have active."""
    if not user_ids:
        return []
    from sqlalchemy import and_
    n = len(user_ids)
    subject_ids = (
        db.query(models.UserSubject.subject_id)
        .filter(
            models.UserSubject.user_id.in_(user_ids),
            models.UserSubject.is_active == True,
        )
        .group_by(models.UserSubject.subject_id)
        .having(func.count(models.UserSubject.user_id.distinct()) == n)
        .all()
    )
    ids = [r[0] for r in subject_ids]
    if not ids:
        return []
    return db.query(models.Subject).filter(models.Subject.id.in_(ids)).order_by(models.Subject.display_name).all()


