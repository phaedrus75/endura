from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
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

# Migrate: add columns that create_all won't add to existing tables
_migrations = [
    ("study_sessions", "subject", "ALTER TABLE study_sessions ADD COLUMN subject VARCHAR"),
    ("feed_reactions", "seen", "ALTER TABLE feed_reactions ADD COLUMN seen BOOLEAN DEFAULT FALSE"),
    ("study_tips", "animal_name", "ALTER TABLE study_tips ADD COLUMN animal_name VARCHAR"),
    ("study_tips", "dislikes_count", "ALTER TABLE study_tips ADD COLUMN dislikes_count INTEGER DEFAULT 0"),
    ("tip_views", "disliked", "ALTER TABLE tip_views ADD COLUMN disliked BOOLEAN DEFAULT FALSE"),
]
try:
    with engine.connect() as conn:
        for table, col, sql in _migrations:
            result = conn.execute(text(
                f"SELECT column_name FROM information_schema.columns "
                f"WHERE table_name='{table}' AND column_name='{col}'"
            ))
            if result.fetchone() is None:
                conn.execute(text(sql))
                conn.commit()
                print(f"Migration: added {table}.{col}")
            else:
                print(f"Migration: {table}.{col} already exists")
except Exception as e:
    print(f"Warning: migration check failed: {e}")

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
        "version": "1.0.22",
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
    """Seed animals on startup - with robust error handling"""
    print("[STARTUP] Beginning seed_animals...")
    try:
        db = next(get_db())
        print("[STARTUP] Got database connection")
        
        # Count existing animals
        existing_count = db.query(models.Animal).count()
        print(f"[STARTUP] Found {existing_count} animals in database")
        
        # 30 Endangered animals to seed (in unlock order)
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
            {"name": "Avahi", "species": "Avahi laniger", "rarity": "rare", "conservation_status": "Vulnerable", "description": "Woolly lemur of Madagascar's rainforests, active at night"},
            {"name": "Blue Whale", "species": "Balaenoptera musculus", "rarity": "legendary", "conservation_status": "Endangered", "description": "The largest animal ever to have lived on Earth"},
            {"name": "Gray Bat", "species": "Myotis grisescens", "rarity": "common", "conservation_status": "Vulnerable", "description": "Cave-dwelling bat of the southeastern United States"},
            {"name": "Grey Parrot", "species": "Psittacus erithacus", "rarity": "rare", "conservation_status": "Endangered", "description": "Highly intelligent parrot known for remarkable speech ability"},
            {"name": "Grizzly Bear", "species": "Ursus arctos horribilis", "rarity": "epic", "conservation_status": "Threatened", "description": "Powerful North American bear and icon of the wilderness"},
            {"name": "Mountain Zebra", "species": "Equus zebra", "rarity": "rare", "conservation_status": "Vulnerable", "description": "Striped equine of southern Africa's mountain slopes"},
            {"name": "Pangolin", "species": "Manis javanica", "rarity": "epic", "conservation_status": "Critically Endangered", "description": "The world's most trafficked mammal, covered in protective scales"},
            {"name": "Seal", "species": "Monachus monachus", "rarity": "epic", "conservation_status": "Endangered", "description": "Mediterranean monk seal, one of the rarest marine mammals"},
            {"name": "Wombat", "species": "Lasiorhinus krefftii", "rarity": "rare", "conservation_status": "Critically Endangered", "description": "Burrowing marsupial of northern Australia, extremely rare"},
        ]
        
        # Clean up: remove duplicates and any animals not in the canonical list
        canonical_names = [a["name"] for a in animals]
        all_db_animals = db.query(models.Animal).all()
        seen_names = set()
        removed = 0
        for animal in all_db_animals:
            if animal.name not in canonical_names or animal.name in seen_names:
                db.delete(animal)
                removed += 1
            else:
                seen_names.add(animal.name)
        if removed > 0:
            print(f"[STARTUP] Removed {removed} duplicate/extra animals")

        added = 0
        for animal_data in animals:
            exists = db.query(models.Animal).filter(models.Animal.name == animal_data["name"]).first()
            if not exists:
                db.add(models.Animal(**animal_data))
                added += 1
        print(f"[STARTUP] Added {added} new animals")
        
        # 30 animals cycled: each animal appears ~3-4 times, never adjacent
        animals_cycle = [
            "Sunda Island Tiger", "Koala", "Grey Parrot", "Blue Whale", "Red Panda",
            "Wallaby", "Amur Leopard", "Pangolin", "Otter", "Mountain Gorilla",
            "Hawksbill Turtle", "Gray Bat", "Monarch Butterfly", "Seal", "Chinchilla",
            "Polar Bear", "Javan Rhino", "Calamian Deer", "Tapanuli Orangutan", "Red Wolf",
            "Pacific Pocket Mouse", "Avahi", "Mexican Bobcat", "Grizzly Bear", "Langur Monkey",
            "African Forest Elephant", "Panda", "Mountain Zebra", "Axolotl", "Wombat",
        ]
        tip_texts = [
            ("Study something simple first. Small wins spark confidence, and confidence fuels focus for what comes next.", "motivation"),
            ("After learning a concept, explain it out loud in the simplest way possible, as if you\u2019re teaching a child. If it feels complicated to explain, you haven\u2019t fully mastered it yet.", "memorization"),
            ("Struggling to memorise something? Turn it into a ridiculous acronym or mnemonic. The sillier it is, the stickier it becomes.", "memorization"),
            ("Review your notes or flashcards right before sleep. Your brain consolidates information overnight, just don\u2019t sacrifice your sleep or fall into a midnight spiral.", "memorization"),
            ("If you\u2019re too tired to study, move your body first. A short workout or walk boosts blood flow, sharpens thinking, and resets your energy.", "motivation"),
            ("Try studying while standing. It increases alertness, reduces fatigue, and cuts down sedentary time, just keep your posture aligned.", "focus"),
            ("Add nature into your study routine. Rain sounds, birds, fresh air, or outdoor breaks stimulate creativity and calm your nervous system.", "general"),
            ("Record your notes as voice memos and replay them while doing everyday tasks. Passive listening reinforces memory in unexpected moments.", "memorization"),
            ("Take 10\u201320 minute power naps between study blocks. Short naps recharge focus and help cement what you just learned.", "general"),
            ("If motivation is low, commit to just five minutes. Momentum often carries you further than willpower ever could.", "motivation"),
            ("Study with your future in mind. Visualise your goals \u2014 grades, university, career \u2014 and create a moodboard if it helps. Purpose sustains discipline.", "motivation"),
            ("Experiment with different formats: videos, podcasts, quizzes, interactive tools. Discover how your brain learns best \u2014 then optimise around it.", "general"),
            ("When using flashcards, sort them into easy, medium, and hard piles. Prioritise the hard ones first and move cards up as you improve.", "memorization"),
            ("Practice interleaving. Mix topics and question types instead of mastering one block at a time. It trains your brain for real exam conditions.", "focus"),
            ("To expand vocabulary, build mind maps. Add synonyms, antonyms, and example sentences \u2014 visual connections deepen understanding.", "memorization"),
            ("Surround yourself with focus. Libraries, quiet caf\u00e9s, or study groups raise your productivity ceiling. Environment shapes behaviour more than motivation does.", "focus"),
            ("Study something easy first. Confidence triggers dopamine, and dopamine boosts focus for harder tasks afterwards.", "motivation"),
            ("When revising a concept, doodle it, even if you\u2019re bad at drawing. The visual reinforcement cements it into your brain.", "memorization"),
            ("Try \u201creverse outlining\u201d: after reading a chapter, write a mini outline from memory. Compare it to the actual one: it reveals what your brain kept and what slipped away.", "memorization"),
            ("Assign each subject a unique scent (like citrus for biology, vanilla for English). Smell cues can trigger memory recall when you smell them again during tests.", "memorization"),
            ("If you can\u2019t focus, record a time-lapse of yourself studying. The feeling of pretending someone\u2019s watching improves accountability whilst helping you stay off your phone.", "focus"),
            ("End every study session by writing one sentence: \u201cFuture me should start here.\u201d It gives future you an instant starting point.", "focus"),
            ("Rephrase complex definitions into memes, tweets, or text messages you\u2019d send to a friend. Humour = memory glue.", "memorization"),
            ("Whisper your notes aloud instead of reading silently. Verbalising improves comprehension by activating auditory memory.", "memorization"),
            ("Create a \u201cstudy trigger\u201d ritual: same candle, same pen, same song. Your brain will associate it with focus mode.", "focus"),
            ("Write your weakest topic on a sticky note and put it on your wall. Seeing it daily reminds your brain to file it deeper.", "memorization"),
            ("Use post-it notes to \u201cmap\u201d your progress on a wall \u2014 when you complete a topic, remove the note. Watching the wall empty is addictive.", "motivation"),
            ("Recreate test conditions once a week \u2014 no phone, no notes, timer on. It trains your stress response for real exams.", "focus"),
            ("Keep a \u201cmistake log.\u201d Write down questions you got wrong and what tricked you. You\u2019ll start to see your thought patterns.", "memorization"),
            ("End each week by rewriting the hardest concept of that week in one paragraph \u2014 it\u2019s the ultimate test of understanding.", "memorization"),
            ("Set a recurring calendar event called \u201cPretend Deadline.\u201d Trick your brain into urgency before the real one hits.", "motivation"),
            ("Use Google Docs voice typing to speak your notes. Talking activates different memory networks than writing.", "memorization"),
            ("Listen to instrumental tracks from video games \u2014 they\u2019re designed for focus and flow.", "focus"),
            ("Record \u201cbrain dump\u201d voice memos \u2014 talk through everything you remember without notes. Re-listen later to find gaps.", "memorization"),
            ("Write equations or definitions on your mirror with a whiteboard marker. Review while brushing your teeth.", "memorization"),
            ("Use your phone wallpaper to display a concept you\u2019re trying to memorize that week.", "memorization"),
            ("Try studying with lo-fi music at 60\u201370 BPM \u2014 it synchronizes with your resting heart rate for calm alertness.", "focus"),
            ("Schedule your hardest subjects right after meals. Glucose = better brain fuel.", "general"),
            ("Set a specific \u201cquit time.\u201d It gives your study sessions boundaries, avoiding burnout.", "focus"),
            ("Keep a \u201cQuestions I Want to Ask\u201d list \u2014 not just what you don\u2019t know, but what you\u2019re curious about. Curiosity = long-term learning.", "motivation"),
            ("End with gratitude: write one sentence about what you\u2019re proud of today. You\u2019ll associate studying with positivity.", "motivation"),
            ("When memorizing, exaggerate emotion \u2014 whisper, laugh, gesture. Emotion makes information memorable.", "memorization"),
            ("Caffeine works best after breakfast, not before. Drinking it on an empty stomach spikes cortisol, not focus.", "general"),
            ("\u201cRecall before review\u201d: try remembering everything you can before opening your notes. This strengthens neural retrieval pathways.", "memorization"),
            ("Your prefrontal cortex tires out after about 45 minutes. Schedule deep work in sprints, not marathons.", "focus"),
            ("Review material within 24 hours, then again 3 days later, then a week later. It\u2019s called the \u201cEbbinghaus saving curve.\u201d", "memorization"),
            ("Write instead of type when learning new content. Handwriting engages motor memory, which encodes information more deeply.", "memorization"),
            ("When you feel mentally stuck, move your eyes side-to-side for 30 seconds. It activates both brain hemispheres and resets focus.", "focus"),
            ("Keep your study room around 21\u00b0C (70\u00b0F). Too hot or too cold drains cognitive performance.", "general"),
            ("Use background noise between 40\u201370 decibels \u2014 coffee shop hums are perfect for creative thinking.", "focus"),
            ("Write in the margins \u2014 spacing helps the hippocampus chunk info into digestible bits.", "memorization"),
            ("The brain loves questions more than answers. Rewrite your notes as \u201cwhy\u201d and \u201chow\u201d questions to activate curiosity networks.", "memorization"),
            ("The smell of rosemary and peppermint has been shown to slightly improve alertness and recall. Diffuse it while studying.", "general"),
            ("Hydration matters. Even 1% dehydration reduces concentration and working memory.", "general"),
            ("Chewing crunchy food boosts blood flow to the brain by activating jaw muscles. Snack smart.", "general"),
            ("Use light strategically. Natural light increases serotonin; warm lamps increase comfort but can make you drowsy.", "general"),
            ("Smiling (even fake) releases dopamine \u2014 a micro-hack to lift focus mood.", "motivation"),
            ("Alternate between visual, auditory, and kinesthetic tasks. This cross-wiring strengthens long-term storage.", "memorization"),
            ("Don\u2019t scroll between study sets \u2014 the dopamine spikes from social media flatten focus for 20+ minutes afterwards.", "focus"),
            ("Meditation before studying improves sustained attention by literally thickening your prefrontal cortex over time.", "focus"),
            ("Space out flashcard sessions across days, not hours \u2014 your synapses need recovery time to strengthen.", "memorization"),
            ("Every 20 minutes, look 20 feet away for 20 seconds. Protect your eyes, protect your focus.", "general"),
            ("Swap pens halfway through a session. Micro-change refreshes attention.", "focus"),
            ("Stand on one leg while recalling definitions. Balance increases cognitive engagement.", "memorization"),
            ("Read difficult passages dramatically, like you\u2019re narrating a documentary. Emotion amplifies memory.", "memorization"),
            ("After finishing a topic, close your eyes and replay it mentally. Visual rehearsal strengthens neural maps.", "memorization"),
            ("Study facing a blank wall. Fewer visuals = fewer distractions.", "focus"),
            ("Create a tiny reward ritual after finishing a section. Completion becomes addictive.", "motivation"),
            ("Write formulas on scrap paper repeatedly until the page feels automatic. Muscle memory matters.", "memorization"),
            ("Switch between sitting on a chair and the floor. Posture shifts reset energy.", "general"),
            ("Limit yourself to one highlighter colour. Over-highlighting dilutes focus.", "focus"),
            ("Write what you learned before checking if it\u2019s correct. Confidence grows through retrieval.", "memorization"),
            ("End sessions by predicting one exam question. Anticipation deepens mastery.", "memorization"),
            ("Keep a \u201cmicro-goal\u201d list for days when motivation is low. Tiny wins count.", "motivation"),
            ("Switch to pen and paper when stuck digitally. Analog clears cognitive fog.", "focus"),
            ("Read notes in a different accent. Novelty boosts attention.", "memorization"),
            ("Write summaries without using the textbook\u2019s vocabulary. Translation proves comprehension.", "memorization"),
            ("Alternate between reading and writing every 10 minutes. Avoid passive absorption.", "focus"),
            ("Start sessions with your weakest subject once a week. Courage compounds.", "motivation"),
            ("Rewrite definitions in your own slang. Personal language sticks.", "memorization"),
            ("Write memory triggers in the margins. Tiny cues unlock big recall.", "memorization"),
            ("Begin studying at the same time daily. Routine reduces resistance.", "focus"),
            ("If your exam is in the morning, in the days leading up to it, study the content at the same exact time. Routine matters.", "focus"),
            ("Study with a straight spine. Posture influences alertness.", "general"),
            ("Study with intentional breathing: inhale 4, exhale 6. Calm equals clarity.", "focus"),
            ("Rewrite notes vertically instead of horizontally. Layout novelty refreshes thinking.", "memorization"),
            ("Tap your pen lightly while recalling facts. Rhythm can anchor memory.", "memorization"),
            ("Turn diagrams into stories. Narrative sticks better than labels.", "memorization"),
            ("Keep a visible \u201cdistraction list.\u201d Write distractions down instead of acting on them.", "focus"),
            ("Make your study space slightly cooler than comfortable. Alertness increases.", "general"),
            ("Avoid multitasking entirely. Single-tasking maximises depth.", "focus"),
            ("Make your own practice test before searching online. Creation deepens mastery.", "memorization"),
            ("Use bold headings to create mental anchors. Structure guides memory.", "memorization"),
            ("Use tactile tools like index cards over screens. Touch enhances encoding.", "memorization"),
            ("Rewrite tricky points three different ways. Multiple angles deepen mastery.", "memorization"),
            ("Study slightly earlier than you think you need to. Time cushion reduces stress.", "motivation"),
            ("Revisit old notes monthly. Long-term memory needs rehearsal.", "memorization"),
            ("Set a 3-minute \u201cconfusion sprint.\u201d Tackle the part you\u2019ve been avoiding immediately.", "motivation"),
            ("Explain a concept using only analogies. If you can compare it, you understand it.", "memorization"),
            ("Create a \u201ctopic ladder\u201d \u2014 list subtopics from easiest to hardest and climb upward.", "focus"),
        ]
        tips = [
            {"content": text, "category": cat, "animal_name": animals_cycle[i % 30]}
            for i, (text, cat) in enumerate(tip_texts)
        ]

        existing_tips = db.query(models.StudyTip).count()
        if existing_tips > 0:
            db.query(models.StudyTip).delete()
            print(f"[STARTUP] Cleared {existing_tips} old tips")

        for tip_data in tips:
            db.add(models.StudyTip(**tip_data))
        
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
    import traceback
    try:
        task_id = session.task_id
        if task_id is not None:
            task_exists = db.query(models.Task).filter(
                models.Task.id == task_id,
                models.Task.user_id == current_user.id
            ).first()
            if not task_exists:
                task_id = None

        study_session, hatched_animal = crud.create_study_session(
            db,
            current_user.id,
            session.duration_minutes,
            task_id,
            session.animal_name,
            session.subject
        )
        session_hour = None
        if study_session.completed_at:
            session_hour = study_session.completed_at.hour
        new_badges = crud.check_badges(
            db, current_user.id,
            session_hour=session_hour,
            session_minutes=session.duration_minutes
        )
        try:
            crud.create_session_event(db, current_user.id, session.duration_minutes,
                                      hatched_animal.name if hatched_animal else None)
            crud.record_pact_progress(db, current_user.id, session.duration_minutes)
        except Exception:
            pass
        return {
            "session": study_session,
            "hatched_animal": hatched_animal,
            "new_badges": [crud.BADGE_MAP[bid] for bid in new_badges if bid in crud.BADGE_MAP]
        }
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Session create failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


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
    tip_views = db.query(models.TipView).filter(
        models.TipView.user_id == current_user.id
    ).all()
    liked_ids = {v.tip_id for v in tip_views if v.liked}
    disliked_ids = {v.tip_id for v in tip_views if getattr(v, 'disliked', False)}

    result = []
    for tip in tips:
        tip_dict = {
            "id": tip.id,
            "content": tip.content,
            "category": tip.category,
            "animal_name": getattr(tip, 'animal_name', None),
            "likes_count": tip.likes_count,
            "dislikes_count": getattr(tip, 'dislikes_count', 0),
            "created_at": tip.created_at,
            "user_liked": tip.id in liked_ids,
            "user_disliked": tip.id in disliked_ids,
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


@app.post("/tips/{tip_id}/vote")
def vote_tip(
    tip_id: int,
    vote: str = "up",
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tip = db.query(models.StudyTip).filter(models.StudyTip.id == tip_id).first()
    if not tip:
        raise HTTPException(status_code=404, detail="Tip not found")

    view = db.query(models.TipView).filter(
        models.TipView.user_id == current_user.id,
        models.TipView.tip_id == tip_id,
    ).first()

    if not view:
        view = models.TipView(user_id=current_user.id, tip_id=tip_id)
        db.add(view)

    if vote == "up":
        if view.liked:
            view.liked = False
            tip.likes_count = max(0, tip.likes_count - 1)
        else:
            if getattr(view, 'disliked', False):
                view.disliked = False
                tip.dislikes_count = max(0, (tip.dislikes_count or 0) - 1)
            view.liked = True
            tip.likes_count = (tip.likes_count or 0) + 1
    elif vote == "down":
        if getattr(view, 'disliked', False):
            view.disliked = False
            tip.dislikes_count = max(0, (tip.dislikes_count or 0) - 1)
        else:
            if view.liked:
                view.liked = False
                tip.likes_count = max(0, tip.likes_count - 1)
            view.disliked = True
            tip.dislikes_count = (tip.dislikes_count or 0) + 1

    db.commit()
    return {
        "likes_count": tip.likes_count,
        "dislikes_count": tip.dislikes_count or 0,
        "user_liked": view.liked,
        "user_disliked": getattr(view, 'disliked', False),
    }


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
    success, message = crud.send_friend_request(db, current_user.id, request.friend_username)
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


@app.get("/friends/pending")
def get_pending_requests(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_pending_requests(db, current_user.id)


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


@app.get("/users/all")
def get_all_users(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Dev/test helper: list every user except the caller."""
    users = db.query(models.User).filter(models.User.id != current_user.id).all()
    results = []
    for u in users:
        animals_count = db.query(models.UserAnimal).filter(models.UserAnimal.user_id == u.id).count()
        results.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "total_study_minutes": u.total_study_minutes,
            "current_streak": u.current_streak,
            "animals_count": animals_count,
        })
    return results


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


# ============ Shop / Spend Coins ============

class SpendRequest(BaseModel):
    amount: int

@app.post("/shop/spend")
def spend_coins(
    req: SpendRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if user.current_coins < req.amount:
        raise HTTPException(status_code=400, detail="Not enough eco-credits")
    user.current_coins -= req.amount
    db.commit()
    db.refresh(user)
    return {"current_coins": user.current_coins, "spent": req.amount}


# ============ Badge Endpoints ============

@app.get("/badges", response_model=List[schemas.BadgeResponse])
def get_badges(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_user_badges(db, current_user.id)

@app.post("/badges/check")
def check_badges(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    new_badges = crud.check_badges(db, current_user.id)
    return {
        "new_badges": [crud.BADGE_MAP[bid] for bid in new_badges if bid in crud.BADGE_MAP]
    }


# ============ Study Pact Endpoints ============

@app.post("/pacts")
def create_pact(
    data: schemas.PactCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pact, error = crud.create_pact(db, current_user.id, data.buddy_username,
                                    data.daily_minutes, data.duration_days, data.wager_amount)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {"id": pact.id, "status": pact.status}

@app.post("/pacts/{pact_id}/accept")
def accept_pact(
    pact_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pact, error = crud.accept_pact(db, current_user.id, pact_id)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {"id": pact.id, "status": pact.status}

@app.get("/pacts", response_model=List[schemas.PactResponse])
def get_pacts(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_user_pacts(db, current_user.id)


# ============ Study Group Endpoints ============

@app.post("/groups")
def create_group(
    data: schemas.GroupCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    group = crud.create_group(db, current_user.id, data.name, data.goal_minutes, data.goal_deadline)
    return {"id": group.id, "name": group.name}

@app.post("/groups/{group_id}/join")
def join_group(
    group_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    group, error = crud.join_group(db, current_user.id, group_id)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {"message": "Joined group"}

@app.post("/groups/{group_id}/leave")
def leave_group(
    group_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not crud.leave_group(db, current_user.id, group_id):
        raise HTTPException(status_code=404, detail="Not a member")
    return {"message": "Left group"}

@app.get("/groups", response_model=List[schemas.GroupResponse])
def get_groups(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_user_groups(db, current_user.id)

@app.post("/groups/{group_id}/messages", response_model=schemas.GroupMessageResponse)
def send_group_message(
    group_id: int,
    data: schemas.GroupMessageCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    result = crud.send_group_message(db, current_user.id, group_id, data.content)
    if not result:
        raise HTTPException(status_code=403, detail="Not a member of this group")
    return result

@app.get("/groups/{group_id}/messages", response_model=List[schemas.GroupMessageResponse])
def get_group_messages(
    group_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_group_messages(db, group_id)

@app.post("/groups/{group_id}/invite")
def invite_to_group(
    group_id: int,
    data: schemas.GroupInvite,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    member = db.query(models.GroupMember).filter(
        models.GroupMember.group_id == group_id,
        models.GroupMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="You are not a member of this group")
    target = None
    if data.user_id:
        target = db.query(models.User).filter(models.User.id == data.user_id).first()
    elif data.username:
        target = db.query(models.User).filter(models.User.username == data.username).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    group, error = crud.join_group(db, target.id, group_id)
    if error:
        raise HTTPException(status_code=400, detail=error)
    display_name = target.username or target.email.split('@')[0] if target.email else "User"
    return {"message": f"{display_name} has been added to the group"}


# ============ Activity Feed Endpoints ============

@app.get("/feed", response_model=List[schemas.ActivityEventResponse])
def get_feed(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_friend_feed(db, current_user.id)

@app.get("/feed/reactions/new")
def get_new_reactions(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    my_events = db.query(models.ActivityEvent).filter(
        models.ActivityEvent.user_id == current_user.id
    ).all()
    event_ids = [e.id for e in my_events]
    if not event_ids:
        return []
    unseen = db.query(models.FeedReaction).filter(
        models.FeedReaction.event_id.in_(event_ids),
        models.FeedReaction.user_id != current_user.id,
        models.FeedReaction.seen == False
    ).all()
    results = []
    for r in unseen:
        sender = db.query(models.User).filter(models.User.id == r.user_id).first()
        event = next((e for e in my_events if e.id == r.event_id), None)
        results.append({
            "id": r.id,
            "sender_username": sender.username if sender else "Someone",
            "reaction": r.reaction,
            "event_description": event.description if event else "",
            "created_at": r.created_at.isoformat() if r.created_at else "",
        })
        r.seen = True
    db.commit()
    return results

@app.post("/feed/{event_id}/react")
def react_to_event(
    event_id: int,
    data: schemas.ReactionCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not crud.add_reaction(db, current_user.id, event_id, data.reaction):
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Reaction added"}


# ============ Health Check ============

@app.get("/health")
def health_check():
    return {"status": "healthy", "app": "Endura"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
