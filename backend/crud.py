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

def create_study_session(db: Session, user_id: int, duration_minutes: int, task_id: int = None, animal_name: str = None, subject: str = None) -> tuple[models.StudySession, Optional[models.Animal]]:
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
        subject=subject,
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
    friend = db.query(models.User).filter(models.User.username == friend_username).first()
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


def get_pending_requests(db: Session, user_id: int) -> List[dict]:
    pending = db.query(models.Friendship).filter(
        models.Friendship.friend_id == user_id,
        models.Friendship.status == "pending"
    ).all()
    results = []
    for f in pending:
        sender = db.query(models.User).filter(models.User.id == f.user_id).first()
        if sender:
            results.append({
                "id": f.id,
                "user_id": sender.id,
                "username": sender.username,
                "email": sender.email,
            })
    return results


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
        models.StudySession.subject,
        func.sum(models.StudySession.duration_minutes)
    ).filter(
        models.StudySession.user_id == user_id,
        models.StudySession.subject != None
    ).group_by(models.StudySession.subject).all()
    
    study_minutes_by_subject = {row[0]: row[1] for row in subject_query if row[0]}
    
    return {
        "total_coins": user.total_coins,
        "current_coins": user.current_coins,
        "total_study_minutes": user.total_study_minutes,
        "total_sessions": user.total_sessions,
        "current_streak": user.current_streak,
        "longest_streak": user.longest_streak,
        "animals_hatched": animals_count,
        "tasks_completed": tasks_completed,
        "weekly_study_minutes": weekly_daily,
        "monthly_study_minutes": monthly_weekly,
        "study_minutes_by_subject": study_minutes_by_subject
    }


# ============ Study Pact CRUD ============

def create_pact(db: Session, creator_id: int, buddy_username: str, daily_minutes: int, duration_days: int, wager_amount: int) -> tuple:
    buddy = db.query(models.User).filter(models.User.username == buddy_username).first()
    if not buddy:
        return None, "User not found"
    if buddy.id == creator_id:
        return None, "Cannot create a pact with yourself"
    friendship = db.query(models.Friendship).filter(
        models.Friendship.status == "accepted",
        ((models.Friendship.user_id == creator_id) & (models.Friendship.friend_id == buddy.id)) |
        ((models.Friendship.user_id == buddy.id) & (models.Friendship.friend_id == creator_id))
    ).first()
    if not friendship:
        return None, "You must be friends first"
    if wager_amount > 0:
        creator = db.query(models.User).filter(models.User.id == creator_id).first()
        if creator.current_coins < wager_amount:
            return None, "Not enough eco-credits for wager"

    pact = models.StudyPact(
        creator_id=creator_id, buddy_id=buddy.id,
        daily_minutes=daily_minutes, duration_days=duration_days,
        wager_amount=wager_amount, status="pending"
    )
    db.add(pact)
    db.commit()
    db.refresh(pact)
    _create_event(db, creator_id, "pact_created",
                  f"started a study pact with {buddy.username or buddy.email.split('@')[0]}")
    return pact, None


def accept_pact(db: Session, user_id: int, pact_id: int) -> tuple:
    pact = db.query(models.StudyPact).filter(
        models.StudyPact.id == pact_id,
        models.StudyPact.buddy_id == user_id,
        models.StudyPact.status == "pending"
    ).first()
    if not pact:
        return None, "Pact not found or already accepted"
    if pact.wager_amount > 0:
        buddy = db.query(models.User).filter(models.User.id == user_id).first()
        creator = db.query(models.User).filter(models.User.id == pact.creator_id).first()
        if buddy.current_coins < pact.wager_amount:
            return None, "Not enough eco-credits for wager"
        buddy.current_coins -= pact.wager_amount
        creator.current_coins -= pact.wager_amount

    pact.status = "active"
    pact.start_date = datetime.utcnow()
    pact.end_date = datetime.utcnow() + timedelta(days=pact.duration_days)
    db.commit()
    return pact, None


def get_user_pacts(db: Session, user_id: int) -> List[dict]:
    pacts = db.query(models.StudyPact).filter(
        (models.StudyPact.creator_id == user_id) | (models.StudyPact.buddy_id == user_id)
    ).order_by(models.StudyPact.created_at.desc()).all()

    results = []
    for p in pacts:
        creator = db.query(models.User).filter(models.User.id == p.creator_id).first()
        buddy = db.query(models.User).filter(models.User.id == p.buddy_id).first()
        creator_days = db.query(models.PactDay).filter(
            models.PactDay.pact_id == p.id, models.PactDay.user_id == p.creator_id
        ).all()
        buddy_days = db.query(models.PactDay).filter(
            models.PactDay.pact_id == p.id, models.PactDay.user_id == p.buddy_id
        ).all()
        results.append({
            "id": p.id,
            "creator_username": creator.username if creator else None,
            "buddy_username": buddy.username if buddy else None,
            "creator_id": p.creator_id, "buddy_id": p.buddy_id,
            "daily_minutes": p.daily_minutes, "duration_days": p.duration_days,
            "wager_amount": p.wager_amount, "status": p.status,
            "start_date": p.start_date, "end_date": p.end_date,
            "created_at": p.created_at,
            "creator_progress": [{"date": d.date.isoformat(), "minutes_studied": d.minutes_studied, "completed": d.completed} for d in creator_days],
            "buddy_progress": [{"date": d.date.isoformat(), "minutes_studied": d.minutes_studied, "completed": d.completed} for d in buddy_days],
        })
    return results


def record_pact_progress(db: Session, user_id: int, session_minutes: int):
    """Called after a study session to update any active pacts."""
    today = datetime.utcnow().date()
    active_pacts = db.query(models.StudyPact).filter(
        models.StudyPact.status == "active",
        (models.StudyPact.creator_id == user_id) | (models.StudyPact.buddy_id == user_id)
    ).all()
    for pact in active_pacts:
        existing = db.query(models.PactDay).filter(
            models.PactDay.pact_id == pact.id,
            models.PactDay.user_id == user_id,
            func.date(models.PactDay.date) == today
        ).first()
        if existing:
            existing.minutes_studied += session_minutes
            if existing.minutes_studied >= pact.daily_minutes:
                existing.completed = True
        else:
            completed = session_minutes >= pact.daily_minutes
            db.add(models.PactDay(
                pact_id=pact.id, user_id=user_id,
                date=datetime.utcnow(), minutes_studied=session_minutes,
                completed=completed
            ))
        if pact.end_date and datetime.utcnow() >= pact.end_date:
            _finalize_pact(db, pact)
    db.commit()


def _finalize_pact(db: Session, pact):
    creator_completed = db.query(models.PactDay).filter(
        models.PactDay.pact_id == pact.id, models.PactDay.user_id == pact.creator_id,
        models.PactDay.completed == True
    ).count()
    buddy_completed = db.query(models.PactDay).filter(
        models.PactDay.pact_id == pact.id, models.PactDay.user_id == pact.buddy_id,
        models.PactDay.completed == True
    ).count()
    total_pot = pact.wager_amount * 2
    bonus = max(pact.wager_amount // 2, 10)
    creator = db.query(models.User).filter(models.User.id == pact.creator_id).first()
    buddy = db.query(models.User).filter(models.User.id == pact.buddy_id).first()

    c_done = creator_completed >= pact.duration_days
    b_done = buddy_completed >= pact.duration_days

    if c_done and b_done:
        creator.current_coins += pact.wager_amount + bonus
        creator.total_coins += bonus
        buddy.current_coins += pact.wager_amount + bonus
        buddy.total_coins += bonus
        pact.status = "completed"
    elif c_done and not b_done:
        creator.current_coins += total_pot + bonus
        creator.total_coins += pact.wager_amount + bonus
        pact.status = "completed"
    elif b_done and not c_done:
        buddy.current_coins += total_pot + bonus
        buddy.total_coins += pact.wager_amount + bonus
        pact.status = "completed"
    else:
        pact.status = "failed"


# ============ Study Group CRUD ============

def create_group(db: Session, creator_id: int, name: str, goal_minutes: int, goal_deadline) -> models.StudyGroup:
    group = models.StudyGroup(
        name=name, creator_id=creator_id,
        goal_minutes=goal_minutes, goal_deadline=goal_deadline
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
    group = db.query(models.StudyGroup).filter(models.StudyGroup.id == group_id).first()
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
    db.commit()
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
                "minutes_contributed": mins
            })

        results.append({
            "id": group.id, "name": group.name, "creator_id": group.creator_id,
            "goal_minutes": group.goal_minutes, "goal_deadline": group.goal_deadline,
            "created_at": group.created_at, "members": member_list,
            "total_minutes": total, "goal_met": total >= group.goal_minutes
        })
    return results


def _group_member_minutes(db: Session, user_id: int, group) -> int:
    since = group.created_at
    mins = db.query(func.sum(models.StudySession.duration_minutes)).filter(
        models.StudySession.user_id == user_id,
        models.StudySession.completed_at >= since
    ).scalar()
    return mins or 0


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
            "content": msg.content, "created_at": msg.created_at}


def get_group_messages(db: Session, group_id: int, limit: int = 50) -> List[dict]:
    msgs = db.query(models.GroupMessage).filter(
        models.GroupMessage.group_id == group_id
    ).order_by(models.GroupMessage.created_at.desc()).limit(limit).all()
    results = []
    for m in msgs:
        u = db.query(models.User).filter(models.User.id == m.user_id).first()
        results.append({
            "id": m.id, "user_id": m.user_id,
            "username": u.username if u else None,
            "content": m.content, "created_at": m.created_at
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
    friend_ids = [f.id for f in friends]
    if not friend_ids:
        return []

    events = db.query(models.ActivityEvent).filter(
        models.ActivityEvent.user_id.in_(friend_ids)
    ).order_by(models.ActivityEvent.created_at.desc()).limit(limit).all()

    results = []
    for e in events:
        u = db.query(models.User).filter(models.User.id == e.user_id).first()
        reactions = db.query(models.FeedReaction).filter(models.FeedReaction.event_id == e.id).all()
        reaction_list = [{"user_id": r.user_id, "reaction": r.reaction} for r in reactions]
        results.append({
            "id": e.id, "user_id": e.user_id,
            "username": u.username if u else None,
            "event_type": e.event_type, "description": e.description,
            "created_at": e.created_at, "reactions": reaction_list
        })
    return results


def add_reaction(db: Session, user_id: int, event_id: int, reaction: str) -> bool:
    event = db.query(models.ActivityEvent).filter(models.ActivityEvent.id == event_id).first()
    if not event:
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
    # Streaks
    {"id": "on_fire", "name": "On Fire", "icon": "🔥", "description": "Three days strong — keep the flame alive.", "category": "streaks", "tier": "bronze"},
    {"id": "momentum_builder", "name": "Momentum Builder", "icon": "⚡", "description": "Five days. The momentum is real.", "category": "streaks", "tier": "bronze"},
    {"id": "week_warrior", "name": "Week Warrior", "icon": "🗓️", "description": "A full week without missing a beat.", "category": "streaks", "tier": "silver"},
    {"id": "fortnight_force", "name": "Fortnight Force", "icon": "🛡️", "description": "Two weeks of pure consistency.", "category": "streaks", "tier": "silver"},
    {"id": "monthly_machine", "name": "Monthly Machine", "icon": "⚙️", "description": "Habits are forged in this fire.", "category": "streaks", "tier": "gold"},
    {"id": "iron_will", "name": "Iron Will", "icon": "🪨", "description": "Two months. Nothing can stop you.", "category": "streaks", "tier": "gold"},
    {"id": "unbreakable", "name": "Unbreakable", "icon": "💎", "description": "Only the most dedicated reach this level.", "category": "streaks", "tier": "diamond"},
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
    # Animals
    {"id": "first_friend", "name": "First Friend", "icon": "🐣", "description": "Welcome to the sanctuary!", "category": "animals", "tier": "bronze"},
    {"id": "growing_family", "name": "Growing Family", "icon": "🌱", "description": "Your sanctuary is coming to life.", "category": "animals", "tier": "silver"},
    {"id": "collectors_pride", "name": "Collector's Pride", "icon": "🏆", "description": "Quantity AND quality.", "category": "animals", "tier": "gold"},
    {"id": "speed_hatcher", "name": "Speed Hatcher", "icon": "⚡", "description": "Three sessions, three hatches, one day.", "category": "animals", "tier": "gold"},
    {"id": "full_sanctuary", "name": "Full Sanctuary", "icon": "🌍", "description": "Every endangered species — saved by studying.", "category": "animals", "tier": "diamond"},
    {"id": "favourite_friend", "name": "Favourite Friend", "icon": "❤️", "description": "Clearly you have a favourite.", "category": "animals", "tier": "silver"},
    {"id": "naming_ceremony", "name": "Naming Ceremony", "icon": "✏️", "description": "Each one is special to you.", "category": "animals", "tier": "bronze"},
    # Eco-Credits
    {"id": "saver", "name": "Saver", "icon": "🍀", "description": "Saving up for something special?", "category": "eco_credits", "tier": "silver"},
    {"id": "big_spender", "name": "Big Spender", "icon": "💸", "description": "Treating the sanctuary right.", "category": "eco_credits", "tier": "gold"},
    {"id": "window_shopper", "name": "Window Shopper", "icon": "👀", "description": "Just browsing... for now.", "category": "eco_credits", "tier": "bronze"},
    {"id": "eco_mogul", "name": "Eco Mogul", "icon": "🤑", "description": "A true eco-credit tycoon.", "category": "eco_credits", "tier": "diamond"},
    {"id": "impulse_buyer", "name": "Impulse Buyer", "icon": "🛒", "description": "Couldn't resist.", "category": "eco_credits", "tier": "silver"},
    # Subjects
    {"id": "subject_explorer", "name": "Subject Explorer", "icon": "🧭", "description": "A well-rounded learner.", "category": "subjects", "tier": "silver"},
    {"id": "renaissance_student", "name": "Renaissance Student", "icon": "🎨", "description": "Curious about everything.", "category": "subjects", "tier": "gold"},
    {"id": "deep_diver", "name": "Deep Diver", "icon": "🤿", "description": "Mastery takes dedication.", "category": "subjects", "tier": "gold"},
    {"id": "subject_champion", "name": "Subject Champion", "icon": "👑", "description": "You own this subject now.", "category": "subjects", "tier": "diamond"},
    {"id": "balanced_brain", "name": "Balanced Brain", "icon": "⚖️", "description": "Keeping all the plates spinning.", "category": "subjects", "tier": "silver"},
    # Sanctuary
    {"id": "interior_designer", "name": "Interior Designer", "icon": "🎨", "description": "Making it feel like home.", "category": "sanctuary", "tier": "silver"},
    {"id": "decorator_deluxe", "name": "Decorator Deluxe", "icon": "✨", "description": "The sanctuary looks incredible.", "category": "sanctuary", "tier": "gold"},
    {"id": "accessory_addict", "name": "Accessory Addict", "icon": "👒", "description": "Fashion-forward sanctuary.", "category": "sanctuary", "tier": "gold"},
    {"id": "curator", "name": "Curator", "icon": "🖼️", "description": "A little bit of everything.", "category": "sanctuary", "tier": "silver"},
    # Social
    {"id": "social_butterfly", "name": "Social Butterfly", "icon": "🦋", "description": "Popular AND productive.", "category": "social", "tier": "gold"},
    {"id": "top_of_the_class", "name": "Top of the Class", "icon": "🥇", "description": "This week's champion.", "category": "social", "tier": "diamond"},
    {"id": "generous_spirit", "name": "Generous Spirit", "icon": "🎁", "description": "Sharing is caring.", "category": "social", "tier": "gold"},
    {"id": "study_squad", "name": "Study Squad", "icon": "👥", "description": "Stronger together.", "category": "social", "tier": "gold"},
]

BADGE_MAP = {b["id"]: b for b in BADGE_DEFINITIONS}


def get_user_badges(db: Session, user_id: int) -> List[dict]:
    earned = db.query(models.UserBadge).filter(models.UserBadge.user_id == user_id).all()
    earned_map = {ub.badge_id: ub.earned_at for ub in earned}

    result = []
    for b in BADGE_DEFINITIONS:
        entry = {**b, "earned": b["id"] in earned_map}
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

    # Streaks
    if best_streak >= 3: capped_award("on_fire")
    if best_streak >= 5: capped_award("momentum_builder")
    if best_streak >= 7: capped_award("week_warrior")
    if best_streak >= 21: capped_award("fortnight_force")
    if best_streak >= 45: capped_award("monthly_machine")
    if best_streak >= 90: capped_award("iron_will")
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
        models.StudySession.subject,
        func.sum(models.StudySession.duration_minutes)
    ).filter(
        models.StudySession.user_id == user_id,
        models.StudySession.subject != None
    ).group_by(models.StudySession.subject).all()

    distinct_subjects = len([s for s in subject_query if s[0]])
    if distinct_subjects >= 3: capped_award("subject_explorer")
    if distinct_subjects >= 6: capped_award("renaissance_student")

    max_subject_mins = max((s[1] for s in subject_query if s[1]), default=0)
    if max_subject_mins >= 600: capped_award("deep_diver")
    if max_subject_mins >= 1500: capped_award("subject_champion")

    # Balanced brain: 3+ subjects in current week
    week_subjects = db.query(models.StudySession.subject).filter(
        models.StudySession.user_id == user_id,
        models.StudySession.completed_at >= datetime.combine(monday, datetime.min.time()),
        models.StudySession.subject != None
    ).distinct().count()
    if week_subjects >= 3: capped_award("balanced_brain")

    # Friends count
    friend_count = db.query(models.Friendship).filter(
        models.Friendship.status == "accepted",
        ((models.Friendship.user_id == user_id) | (models.Friendship.friend_id == user_id))
    ).count()
    if friend_count >= 10: capped_award("social_butterfly")

    if new_badges:
        db.commit()

    return new_badges
