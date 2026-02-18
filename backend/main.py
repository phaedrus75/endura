from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import List, Optional
import models
import schemas
import crud
from database import engine, get_db, Base, SQLALCHEMY_DATABASE_URL
from auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES
)
import os

# Create tables (with error handling for Railway)
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"Warning: Could not create tables on startup: {e}")

app = FastAPI(title="Endura API", description="Gamified Study App Backend")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint (no database required)
@app.get("/")
def health_check():
    # Check the actual DATABASE_URL at runtime
    db_url = os.getenv("DATABASE_URL", "")
    db_type = "postgresql" if "postgres" in db_url.lower() else "sqlite"
    has_db_url = bool(db_url)
    
    # Debug: find any env vars with DATABASE or POSTGRES in name
    db_related_vars = [k for k in os.environ.keys() if "DATABASE" in k.upper() or "POSTGRES" in k.upper()]
    
    return {
        "status": "healthy", 
        "app": "Endura API", 
        "version": "1.0.5",
        "database": db_type,
        "database_configured": has_db_url,
        "db_url_preview": db_url[:30] + "..." if len(db_url) > 30 else db_url if db_url else "not set",
        "db_env_vars_found": db_related_vars,
    }

@app.get("/health")
def health():
    return {"status": "ok"}


# ============ Startup: Seed Animals ============

@app.on_event("startup")
def seed_animals():
    try:
        db = next(get_db())
        
        # Check existing animals
        try:
            existing_count = db.query(models.Animal).count()
        except Exception as e:
            print(f"[STARTUP] Database error checking animals: {e}")
            # Tables might not exist yet - create them
            models.Base.metadata.create_all(bind=engine)
            existing_count = 0
        
        # Skip if we already have 21 animals
        if existing_count >= 21:
            print(f"[STARTUP] Already have {existing_count} animals, skipping seed")
            return
        
        print(f"[STARTUP] Found {existing_count} animals, seeding new list")
        
        # Clear and reseed (migration to new list)
        if existing_count > 0:
            try:
                db.query(models.UserAnimal).delete()
                db.query(models.Animal).delete()
                db.commit()
                print("[STARTUP] Cleared old animals")
            except Exception as e:
                print(f"[STARTUP] Error clearing: {e}")
                db.rollback()
        
        # 21 Endangered animals to seed (in unlock order)
        animals = [
            {"name": "Sunda Island Tiger", "species": "Panthera tigris sondaica", "rarity": "legendary", "conservation_status": "Critically Endangered", "description": "The smallest tiger subspecies, found only in Sumatra"},
            {"name": "Javan Rhino", "species": "Rhinoceros sondaicus", "rarity": "legendary", "conservation_status": "Critically Endangered", "description": "One of the rarest large mammals on Earth"},
            {"name": "Amur Leopard", "species": "Panthera pardus orientalis", "rarity": "legendary", "conservation_status": "Critically Endangered", "description": "Rarest big cat on Earth with fewer than 100 left"},
            {"name": "Mountain Gorilla", "species": "Gorilla beringei beringei", "rarity": "legendary", "conservation_status": "Endangered", "description": "Gentle giant of the African mountains"},
            {"name": "Tapanuli Orangutan", "species": "Pongo tapanuliensis", "rarity": "legendary", "conservation_status": "Critically Endangered", "description": "The rarest great ape species discovered in 2017"},
            {"name": "Polar Bear", "species": "Ursus maritimus", "rarity": "epic", "conservation_status": "Vulnerable", "description": "Arctic ice explorer threatened by climate change"},
            {"name": "African Forest Elephant", "species": "Loxodonta cyclotis", "rarity": "epic", "conservation_status": "Critically Endangered", "description": "Smaller forest-dwelling elephant of Central Africa"},
            {"name": "Hawksbill Turtle", "species": "Eretmochelys imbricata", "rarity": "epic", "conservation_status": "Critically Endangered", "description": "Beautiful sea turtle with a distinctive beak"},
            {"name": "Calamian Deer", "species": "Axis calamianensis", "rarity": "epic", "conservation_status": "Endangered", "description": "Endemic deer of the Calamian Islands in the Philippines"},
            {"name": "Axolotl", "species": "Ambystoma mexicanum", "rarity": "epic", "conservation_status": "Critically Endangered", "description": "Smiling water monster that never grows up"},
            {"name": "Red Wolf", "species": "Canis rufus", "rarity": "rare", "conservation_status": "Critically Endangered", "description": "America's most endangered wolf species"},
            {"name": "Monarch Butterfly", "species": "Danaus plexippus", "rarity": "rare", "conservation_status": "Endangered", "description": "Famous for its incredible migration journey"},
            {"name": "Red Panda", "species": "Ailurus fulgens", "rarity": "rare", "conservation_status": "Endangered", "description": "Fluffy forest dweller from the Himalayas"},
            {"name": "Panda", "species": "Ailuropoda melanoleuca", "rarity": "rare", "conservation_status": "Vulnerable", "description": "Bamboo-munching gentle giant of China"},
            {"name": "Mexican Bobcat", "species": "Lynx rufus escuinapae", "rarity": "rare", "conservation_status": "Endangered", "description": "Elusive wild cat of Mexican forests"},
            {"name": "Chinchilla", "species": "Chinchilla lanigera", "rarity": "common", "conservation_status": "Endangered", "description": "Soft-furred rodent from the Andes mountains"},
            {"name": "Otter", "species": "Lontra felina", "rarity": "common", "conservation_status": "Endangered", "description": "Playful marine otter of South America"},
            {"name": "Koala", "species": "Phascolarctos cinereus", "rarity": "common", "conservation_status": "Vulnerable", "description": "Eucalyptus-loving tree hugger of Australia"},
            {"name": "Langur Monkey", "species": "Trachypithecus poliocephalus", "rarity": "common", "conservation_status": "Critically Endangered", "description": "Golden-headed langur of Vietnam"},
            {"name": "Pacific Pocket Mouse", "species": "Chaetodipus fallax fallax", "rarity": "common", "conservation_status": "Endangered", "description": "Tiny mouse once thought extinct"},
            {"name": "Wallaby", "species": "Petrogale lateralis", "rarity": "common", "conservation_status": "Near Threatened", "description": "Small kangaroo relative from Australia"},
        ]
        
        for animal_data in animals:
            animal = models.Animal(**animal_data)
            db.add(animal)
        
        # Seed some study tips
        tips = [
            {"content": "Use the Pomodoro Technique: 25 minutes of focus, 5 minute break.", "category": "focus"},
            {"content": "Teach what you learn to someone else.", "category": "memorization"},
            {"content": "Study in different locations for stronger memories.", "category": "memorization"},
            {"content": "Take handwritten notes for better retention.", "category": "focus"},
            {"content": "Exercise before studying boosts brain function.", "category": "motivation"},
            {"content": "Use spaced repetition: 1 day, 3 days, 1 week, 2 weeks.", "category": "memorization"},
            {"content": "Sleep is when your brain consolidates memories.", "category": "general"},
            {"content": "Start with the hardest task when energy is highest.", "category": "focus"},
            {"content": "Create a dedicated study space.", "category": "focus"},
            {"content": "Use active recall instead of re-reading.", "category": "memorization"},
        ]
        
        for tip_data in tips:
            tip = models.StudyTip(**tip_data)
            db.add(tip)
        
        db.commit()
        print("Successfully seeded animals and tips!")
    except Exception as e:
        print(f"Warning: Could not seed database on startup: {e}")


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

@app.post("/sessions", response_model=schemas.StudySessionWithHatchResponse)
def complete_study_session(
    session: schemas.StudySessionCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    print(f"[DEBUG] Session create: duration={session.duration_minutes}, animal_name={session.animal_name}")
    study_session, hatched_animal = crud.create_study_session(
        db, 
        current_user.id, 
        session.duration_minutes, 
        session.task_id,
        session.animal_name
    )
    print(f"[DEBUG] Hatched animal: {hatched_animal.name if hatched_animal else 'None'}")
    return {
        "session": study_session,
        "hatched_animal": hatched_animal
    }


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
