from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import List, Optional
import models
import schemas
import crud
from database import engine, get_db, Base
from auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES
)

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Endura API", description="Gamified Study App Backend")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ Startup: Seed Animals ============

@app.on_event("startup")
def seed_animals():
    db = next(get_db())
    
    # Check if animals already exist
    if db.query(models.Animal).count() > 0:
        return
    
    # Endangered animals to seed
    animals = [
        # Common (100 coins)
        {"name": "Red Panda", "species": "Ailurus fulgens", "rarity": "common", "conservation_status": "Endangered", "coins_to_hatch": 100, "description": "A fluffy forest dweller from the Himalayas"},
        {"name": "Sea Turtle", "species": "Chelonia mydas", "rarity": "common", "conservation_status": "Endangered", "coins_to_hatch": 100, "description": "Ancient ocean navigator"},
        {"name": "Penguin", "species": "Spheniscus demersus", "rarity": "common", "conservation_status": "Endangered", "coins_to_hatch": 100, "description": "Tuxedo-wearing swimmer"},
        {"name": "Koala", "species": "Phascolarctos cinereus", "rarity": "common", "conservation_status": "Vulnerable", "coins_to_hatch": 100, "description": "Eucalyptus-loving tree hugger"},
        {"name": "Flamingo", "species": "Phoenicopterus roseus", "rarity": "common", "conservation_status": "Least Concern", "coins_to_hatch": 100, "description": "Pink and fabulous"},
        
        # Rare (150 coins)
        {"name": "Giant Panda", "species": "Ailuropoda melanoleuca", "rarity": "rare", "conservation_status": "Vulnerable", "coins_to_hatch": 150, "description": "Bamboo-munching gentle giant"},
        {"name": "Snow Leopard", "species": "Panthera uncia", "rarity": "rare", "conservation_status": "Vulnerable", "coins_to_hatch": 150, "description": "Ghost of the mountains"},
        {"name": "Orangutan", "species": "Pongo pygmaeus", "rarity": "rare", "conservation_status": "Critically Endangered", "coins_to_hatch": 150, "description": "Wise forest dweller"},
        {"name": "Elephant", "species": "Loxodonta africana", "rarity": "rare", "conservation_status": "Endangered", "coins_to_hatch": 150, "description": "Gentle giant with perfect memory"},
        {"name": "Polar Bear", "species": "Ursus maritimus", "rarity": "rare", "conservation_status": "Vulnerable", "coins_to_hatch": 150, "description": "Arctic ice explorer"},
        
        # Epic (200 coins)
        {"name": "Tiger", "species": "Panthera tigris", "rarity": "epic", "conservation_status": "Endangered", "coins_to_hatch": 200, "description": "Majestic striped hunter"},
        {"name": "Gorilla", "species": "Gorilla beringei", "rarity": "epic", "conservation_status": "Critically Endangered", "coins_to_hatch": 200, "description": "Powerful and gentle"},
        {"name": "Blue Whale", "species": "Balaenoptera musculus", "rarity": "epic", "conservation_status": "Endangered", "coins_to_hatch": 200, "description": "Largest creature on Earth"},
        {"name": "Cheetah", "species": "Acinonyx jubatus", "rarity": "epic", "conservation_status": "Vulnerable", "coins_to_hatch": 200, "description": "Fastest land animal"},
        {"name": "Rhinoceros", "species": "Diceros bicornis", "rarity": "epic", "conservation_status": "Critically Endangered", "coins_to_hatch": 200, "description": "Armored unicorn of Africa"},
        
        # Legendary (300 coins)
        {"name": "Amur Leopard", "species": "Panthera pardus orientalis", "rarity": "legendary", "conservation_status": "Critically Endangered", "coins_to_hatch": 300, "description": "Rarest big cat on Earth"},
        {"name": "Vaquita", "species": "Phocoena sinus", "rarity": "legendary", "conservation_status": "Critically Endangered", "coins_to_hatch": 300, "description": "World's rarest marine mammal"},
        {"name": "Sumatran Rhino", "species": "Dicerorhinus sumatrensis", "rarity": "legendary", "conservation_status": "Critically Endangered", "coins_to_hatch": 300, "description": "Ancient hairy rhinoceros"},
        {"name": "Kakapo", "species": "Strigops habroptilus", "rarity": "legendary", "conservation_status": "Critically Endangered", "coins_to_hatch": 300, "description": "World's only flightless parrot"},
        {"name": "Axolotl", "species": "Ambystoma mexicanum", "rarity": "legendary", "conservation_status": "Critically Endangered", "coins_to_hatch": 300, "description": "Smiling water monster"},
    ]
    
    for animal_data in animals:
        animal = models.Animal(**animal_data)
        db.add(animal)
    
    # Seed some study tips
    tips = [
        {"content": "Use the Pomodoro Technique: 25 minutes of focus, 5 minute break. Your brain needs rest to consolidate learning!", "category": "focus"},
        {"content": "Teach what you learn to someone else. If you can explain it simply, you truly understand it.", "category": "memorization"},
        {"content": "Study in different locations. Your brain creates stronger memories when associated with varied environments.", "category": "memorization"},
        {"content": "Take handwritten notes. Writing activates different brain regions than typing, improving retention.", "category": "focus"},
        {"content": "Exercise before studying. Just 20 minutes of movement boosts brain function and memory.", "category": "motivation"},
        {"content": "Use spaced repetition. Review material at increasing intervals: 1 day, 3 days, 1 week, 2 weeks.", "category": "memorization"},
        {"content": "Sleep is when your brain consolidates memories. Never sacrifice sleep for extra study time.", "category": "general"},
        {"content": "Start with the hardest task when your energy is highest. Save easier tasks for when you're tired.", "category": "focus"},
        {"content": "Create a dedicated study space. Your brain will associate it with focus and learning.", "category": "focus"},
        {"content": "Use active recall instead of re-reading. Quiz yourself to strengthen memory pathways.", "category": "memorization"},
        {"content": "Stay hydrated! Even mild dehydration can impair concentration and memory.", "category": "general"},
        {"content": "Break large tasks into smaller, manageable chunks. Progress feels more achievable.", "category": "motivation"},
        {"content": "Use music without lyrics for studying. Classical or lo-fi beats work great for focus.", "category": "focus"},
        {"content": "Review your notes within 24 hours of taking them. This dramatically improves retention.", "category": "memorization"},
        {"content": "Celebrate small wins! Acknowledging progress keeps you motivated for the long haul.", "category": "motivation"},
    ]
    
    for tip_data in tips:
        tip = models.StudyTip(**tip_data)
        db.add(tip)
    
    db.commit()


# ============ Auth Endpoints ============

@app.post("/auth/register", response_model=schemas.Token)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user.password)
    new_user = crud.create_user(db, user.email, hashed_password)
    
    access_token = create_access_token(
        data={"sub": new_user.email},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/auth/login", response_model=schemas.Token)
def login(user: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, user.email)
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(
        data={"sub": db_user.email},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/auth/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@app.post("/user/username")
def set_username(
    username: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if username is taken
    existing = db.query(models.User).filter(
        models.User.username == username,
        models.User.id != current_user.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    crud.update_username(db, current_user.id, username)
    return {"message": "Username updated"}


# ============ Task Endpoints ============

@app.post("/tasks", response_model=schemas.TaskResponse)
def create_task(
    task: schemas.TaskCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.create_task(
        db, current_user.id, task.title, task.description,
        task.estimated_minutes, task.due_date, task.priority
    )


@app.get("/tasks", response_model=List[schemas.TaskResponse])
def get_tasks(
    include_completed: bool = False,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_user_tasks(db, current_user.id, include_completed)


@app.put("/tasks/{task_id}", response_model=schemas.TaskResponse)
def update_task(
    task_id: int,
    task: schemas.TaskUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    updated = crud.update_task(db, task_id, current_user.id, **task.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Task not found")
    return updated


@app.delete("/tasks/{task_id}")
def delete_task(
    task_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not crud.delete_task(db, task_id, current_user.id):
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted"}


# ============ Study Session Endpoints ============

@app.post("/sessions", response_model=schemas.StudySessionResponse)
def complete_study_session(
    session: schemas.StudySessionCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.create_study_session(db, current_user.id, session.duration_minutes, session.task_id)


@app.get("/sessions", response_model=List[schemas.StudySessionResponse])
def get_sessions(
    limit: int = 50,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_user_sessions(db, current_user.id, limit)


# ============ Egg & Animal Endpoints ============

@app.get("/egg", response_model=schemas.EggResponse)
def get_egg(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    egg = crud.get_user_egg(db, current_user.id)
    if not egg:
        egg = crud.create_egg_for_user(db, current_user.id)
    
    progress = (egg.coins_deposited / egg.coins_required) * 100 if egg.coins_required > 0 else 0
    
    # Get animal hint based on rarity
    animal = db.query(models.Animal).filter(models.Animal.id == egg.animal_id).first()
    hint = f"A {animal.rarity} animal awaits..." if animal else None
    
    return {
        "coins_deposited": egg.coins_deposited,
        "coins_required": egg.coins_required,
        "progress_percent": min(progress, 100),
        "animal_hint": hint
    }


@app.post("/egg/hatch", response_model=schemas.HatchResult)
def hatch_egg(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    success, animal, message = crud.hatch_egg(db, current_user.id)
    return {
        "success": success,
        "animal": animal,
        "message": message
    }


@app.get("/animals", response_model=List[schemas.AnimalResponse])
def get_all_animals(db: Session = Depends(get_db)):
    return crud.get_all_animals(db)


@app.get("/my-animals", response_model=List[schemas.UserAnimalResponse])
def get_my_animals(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_user_animals(db, current_user.id)


@app.put("/my-animals/{animal_id}/name")
def name_animal(
    animal_id: int,
    nickname: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    animal = crud.name_animal(db, animal_id, current_user.id, nickname)
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")
    return {"message": "Animal named successfully"}


# ============ Study Tips Endpoints ============

@app.get("/tips", response_model=List[schemas.StudyTipResponse])
def get_tips(
    limit: int = 10,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tips = crud.get_study_tips(db, current_user.id, limit)
    # Add user_liked flag
    tip_views = db.query(models.TipView).filter(
        models.TipView.user_id == current_user.id
    ).all()
    liked_ids = {v.tip_id for v in tip_views if v.liked}
    
    result = []
    for tip in tips:
        tip_dict = {
            "id": tip.id,
            "content": tip.content,
            "category": tip.category,
            "likes_count": tip.likes_count,
            "created_at": tip.created_at,
            "user_liked": tip.id in liked_ids
        }
        result.append(tip_dict)
    return result


@app.post("/tips/{tip_id}/view")
def mark_tip_viewed(
    tip_id: int,
    liked: bool = False,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    crud.mark_tip_viewed(db, current_user.id, tip_id, liked)
    return {"message": "Tip marked as viewed"}


@app.post("/tips", response_model=schemas.StudyTipResponse)
def create_tip(
    tip: schemas.StudyTipCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.create_study_tip(db, current_user.id, tip.content, tip.category)


# ============ Social Endpoints ============

@app.post("/friends/request")
def send_friend_request(
    request: schemas.FriendRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    success, message = crud.send_friend_request(db, current_user.id, request.friend_email)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"message": message}


@app.post("/friends/accept/{request_id}")
def accept_friend(
    request_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not crud.accept_friend_request(db, current_user.id, request_id):
        raise HTTPException(status_code=404, detail="Friend request not found")
    return {"message": "Friend request accepted"}


@app.get("/friends", response_model=List[schemas.FriendResponse])
def get_friends(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    friends = crud.get_friends(db, current_user.id)
    result = []
    for friend in friends:
        animals_count = db.query(models.UserAnimal).filter(
            models.UserAnimal.user_id == friend.id
        ).count()
        result.append({
            "id": friend.id,
            "username": friend.username,
            "email": friend.email,
            "total_study_minutes": friend.total_study_minutes,
            "current_streak": friend.current_streak,
            "animals_count": animals_count
        })
    return result


@app.get("/leaderboard", response_model=List[schemas.LeaderboardEntry])
def get_leaderboard(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_leaderboard(db, current_user.id)


# ============ Stats Endpoints ============

@app.get("/stats", response_model=schemas.UserStats)
def get_stats(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_user_stats(db, current_user.id)


# ============ Health Check ============

@app.get("/health")
def health_check():
    return {"status": "healthy", "app": "Endura"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
