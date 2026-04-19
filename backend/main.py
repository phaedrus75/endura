from fastapi import FastAPI, Depends, HTTPException, status, Request, Header, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import text, func, or_
from datetime import timedelta, datetime
from typing import List, Optional
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from fastapi.responses import JSONResponse, Response
import models
import schemas
import crud
from database import engine, get_db, Base, SQLALCHEMY_DATABASE_URL
from auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES
)
import os
import html
import json as _json
import logging
from content_filter import contains_profanity

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)

# Schema migrations are handled by Alembic (run `alembic upgrade head` before starting).
# For local dev without Alembic, create_all bootstraps a fresh SQLite DB from models.
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"Warning: Could not create tables on startup: {e}")
else:
    from sqlalchemy import inspect as sa_inspect
    try:
        _insp = sa_inspect(engine)
        for _tbl in ["android_beta_signups", "email_templates", "email_logs"]:
            if not _insp.has_table(_tbl):
                Base.metadata.tables[_tbl].create(bind=engine)
                print(f"Created missing table: {_tbl}")
        _user_cols = [c["name"] for c in _insp.get_columns("users")]
        if "eco_credits_multiplier" not in _user_cols:
            with engine.connect() as _conn:
                _conn.execute(text("ALTER TABLE users ADD COLUMN eco_credits_multiplier FLOAT DEFAULT 1.0"))
                _conn.commit()
            print("Added eco_credits_multiplier column to users")
        if "is_archived" not in _user_cols:
            with engine.connect() as _conn:
                _conn.execute(text("ALTER TABLE users ADD COLUMN is_archived BOOLEAN DEFAULT FALSE"))
                _conn.commit()
            print("Added is_archived column to users")
    except Exception as e:
        print(f"Warning: Could not check/create tables: {e}")

# Seed default subjects, admin users, and email templates on startup
try:
    from database import SessionLocal
    _seed_db = SessionLocal()
    crud.seed_default_subjects(_seed_db)
    for _uid in [1, 2]:
        _u = _seed_db.query(models.User).filter(models.User.id == _uid).first()
        if _u and not _u.is_admin:
            _u.is_admin = True
            _seed_db.commit()
    from email_seeds import DEFAULT_EMAIL_TEMPLATES
    for _tmpl in DEFAULT_EMAIL_TEMPLATES:
        existing = _seed_db.query(models.EmailTemplate).filter(
            models.EmailTemplate.template_key == _tmpl["template_key"]
        ).first()
        if not existing:
            _seed_db.add(models.EmailTemplate(**_tmpl))
    _seed_db.commit()
    _old_cta = 'href="https://endura.eco"'
    _new_cta = 'href="https://apps.apple.com/app/endura-study-timer/id6759482612"'
    for _et in _seed_db.query(models.EmailTemplate).all():
        if _old_cta in (_et.body_html or ""):
            _et.body_html = _et.body_html.replace(_old_cta, _new_cta)
    _seed_db.commit()
    _seed_db.close()
except Exception as e:
    print(f"Warning: Could not seed startup data: {e}")

app = FastAPI(title="Endura API", description="Gamified Study App Backend")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


def _cron_run_onboarding_emails():
    """Background job: send onboarding lifecycle emails daily."""
    from database import SessionLocal
    _db = SessionLocal()
    try:
        resend_key = os.getenv("RESEND_API_KEY")
        if not resend_key:
            logger.warning("Cron: RESEND_API_KEY not set, skipping onboarding emails")
            return
        now = datetime.utcnow()
        sent = {"day3": 0, "day7": 0, "day14": 0, "day30": 0, "reengagement": 0}

        milestone_templates = _db.query(models.EmailTemplate).filter(
            models.EmailTemplate.is_active == True,
            models.EmailTemplate.trigger_day.isnot(None),
        ).all()
        reengagement_tmpl = _db.query(models.EmailTemplate).filter(
            models.EmailTemplate.template_key == "reengagement",
            models.EmailTemplate.is_active == True,
        ).first()
        if not milestone_templates and not reengagement_tmpl:
            return

        milestones = sorted(
            [(t.trigger_day, t.template_key) for t in milestone_templates],
            key=lambda x: x[0],
        )
        inactive_threshold = reengagement_tmpl.inactive_days if reengagement_tmpl else 5

        users = _db.query(models.User).filter(
            models.User.email_verified == True,
            or_(models.User.is_archived == False, models.User.is_archived == None),
        ).all()
        for user in users:
            if not user.created_at or not user.email:
                continue
            days_since_signup = (now - user.created_at).days
            last_active_days = (now - user.last_study_date).days if user.last_study_date else None
            name = user.username or "there"
            animals_count = _db.query(func.count(models.UserAnimal.id)).filter(models.UserAnimal.user_id == user.id).scalar() or 0
            badges_count = _db.query(func.count(models.UserBadge.id)).filter(models.UserBadge.user_id == user.id).scalar() or 0
            variables = {
                "name": name, "total_minutes": str(user.total_study_minutes or 0),
                "animals_count": str(animals_count), "streak": str(user.current_streak or 0),
                "longest_streak": str(user.longest_streak or 0), "sessions": str(user.total_sessions or 0),
                "badges": str(badges_count),
            }
            sent_keys = {el.template_key for el in _db.query(models.EmailLog.template_key).filter(
                models.EmailLog.user_id == user.id
            ).all()}
            try:
                for trigger_day, tkey in milestones:
                    if days_since_signup >= trigger_day and tkey not in sent_keys:
                        if _send_template_email(tkey, user.email, variables, _db):
                            label = f"day{trigger_day}"
                            if label in sent:
                                sent[label] += 1
                            sent_keys.add(tkey)
                            break  # one milestone email per user per run
                if (reengagement_tmpl and "reengagement" not in sent_keys
                        and last_active_days is not None
                        and last_active_days >= inactive_threshold
                        and days_since_signup > 3):
                    if _send_template_email("reengagement", user.email, variables, _db):
                        sent["reengagement"] += 1
            except Exception as e:
                logger.error(f"Cron: Failed to send onboarding email to {user.email}: {e}")
        logger.info(f"Cron: Onboarding emails sent: {sent}, users checked: {len(users)}")
    except Exception as e:
        logger.error(f"Cron: Error running onboarding emails: {e}", exc_info=True)
    finally:
        _db.close()


@app.on_event("startup")
def start_scheduler():
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        scheduler = BackgroundScheduler()
        scheduler.add_job(_cron_run_onboarding_emails, "cron", hour=8, minute=0, id="onboarding_emails")
        scheduler.start()
        print("✅ Scheduler started: onboarding emails daily at 08:00 UTC")
    except Exception as e:
        print(f"❌ Failed to start scheduler: {e}")

_allowed_origins = [
    "https://web-production-34028.up.railway.app",
    "https://endura.eco",
    "https://www.endura.eco",
]
if os.getenv("CORS_ORIGINS"):
    _allowed_origins += [o.strip() for o in os.getenv("CORS_ORIGINS").split(",") if o.strip()]
if not os.getenv("RAILWAY_ENVIRONMENT"):
    _allowed_origins += ["http://localhost:3000", "http://localhost:3002", "http://localhost:8000", "http://localhost:8081"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Admin-Key"],
)

@app.get("/")
def health_check():
    return {
        "status": "healthy",
        "app": "Endura API",
        "version": "1.0.52",
    }

@app.get("/health")
def health():
    return {"status": "ok"}


# ── Resend Webhook (open/click tracking) ─────────────────────────

@app.post("/webhooks/resend")
def resend_webhook(data: dict, db: Session = Depends(get_db)):
    """Receive Resend webhook events for email delivery, open, and click tracking."""
    event_type = data.get("type", "")
    event_data = data.get("data", {})
    email_id = event_data.get("email_id")
    if not email_id:
        return {"ok": True}

    log = db.query(models.EmailLog).filter(models.EmailLog.resend_message_id == email_id).first()
    if not log:
        return {"ok": True}

    now = datetime.utcnow()
    if event_type == "email.delivered":
        log.delivered = True
    elif event_type == "email.opened":
        log.opened = True
        if not log.opened_at:
            log.opened_at = now
    elif event_type == "email.clicked":
        log.clicked = True
        if not log.clicked_at:
            log.clicked_at = now
    db.commit()
    return {"ok": True}


# ============ Startup: Seed Animals ============

@app.on_event("startup")
def seed_check():
    """Quick check: only seed if data is missing"""
    try:
        db = next(get_db())
        animal_count = db.query(models.Animal).count()
        tip_count = db.query(models.StudyTip).count()
        print(f"[STARTUP] Animals: {animal_count}, Tips: {tip_count}")

        # Populate image_url for animals that have hosted images (runs every startup)
        IMAGE_BASE = "https://www.endura.eco/animals"
        AVAILABLE_IMAGES = {
            "african forest elephant", "amur leopard", "avahi", "axolotl",
            "blue whale", "calamian deer", "chinchilla", "gray bat",
            "grey parrot", "grizzly bear", "hawksbill turtle", "javan rhino",
            "koala", "langur monkey", "mexican bobcat", "monarch butterfly",
            "mountain gorilla", "mountain zebra", "otter",
            "pacific pocket mouse", "panda", "pangolin", "polar bear",
            "red panda", "red wolf", "seal", "sunda island tiger",
            "tapanuli orangutan", "wallaby", "wombat",
        }
        img_updated = 0
        for animal in db.query(models.Animal).filter(models.Animal.image_url.is_(None)).all():
            slug = animal.name.lower()
            if slug in AVAILABLE_IMAGES:
                animal.image_url = f"{IMAGE_BASE}/{slug.replace(' ', '%20')}.png"
                img_updated += 1
        if img_updated:
            db.commit()
            print(f"[STARTUP] Set image_url for {img_updated} animals")

        # Seed shop items if table is empty
        shop_count = db.query(models.ShopItem).count()
        if shop_count == 0:
            print("[STARTUP] Seeding shop items...")
            _shop_seed = [
                {"item_key": "acc_tophat", "name": "Top Hat", "emoji": "🎩", "image_key": "tophat", "description": "A dapper top hat for your most distinguished animal", "price": 40, "category": "accessories", "rarity": "common"},
                {"item_key": "acc_sunnies", "name": "Sunnies", "emoji": "🕶️", "image_key": "sunnies", "description": "Cool shades for the coolest creatures", "price": 35, "category": "accessories", "rarity": "common"},
                {"item_key": "acc_crown", "name": "Crown", "emoji": "👑", "image_key": "crown", "description": "A royal crown fit for the king of the sanctuary", "price": 80, "category": "accessories", "rarity": "epic"},
                {"item_key": "acc_gradcap", "name": "Graduation Cap", "emoji": "🎓", "image_key": "gradcap", "description": "Celebrate your study achievements in style", "price": 60, "category": "accessories", "rarity": "rare"},
                {"item_key": "acc_eyemask", "name": "Eye Mask", "emoji": "😴", "image_key": "eyemask", "description": "For animals that deserve a cozy rest after your study session", "price": 45, "category": "accessories", "rarity": "common"},
                {"item_key": "acc_partyhat", "name": "Party Hat", "emoji": "🥳", "image_key": "partyhat", "description": "A festive party hat for celebration time", "price": 50, "category": "accessories", "rarity": "rare"},
                {"item_key": "acc_halo", "name": "Halo", "emoji": "😇", "image_key": "halo", "description": "A golden halo for your most angelic animal", "price": 90, "category": "accessories", "rarity": "epic"},
                {"item_key": "acc_bow", "name": "Bow Tie", "emoji": "🎀", "image_key": "bow", "description": "A classy white bow tie for formal occasions", "price": 55, "category": "accessories", "rarity": "rare"},
                {"item_key": "dec_daisy", "name": "Daisy Patch", "emoji": "🌼", "image_key": "daisy", "description": "A cheerful bunch of daisies to brighten my sanctuary", "price": 30, "category": "decorations", "rarity": "common"},
                {"item_key": "dec_mushroom", "name": "Mushroom", "emoji": "🍄", "image_key": "mushroom", "description": "A whimsical fairy-tale mushroom", "price": 40, "category": "decorations", "rarity": "common"},
                {"item_key": "dec_tree", "name": "Tree", "emoji": "🌳", "image_key": "tree", "description": "A shady tree for animals to rest under", "price": 55, "category": "decorations", "rarity": "rare"},
                {"item_key": "dec_tulips", "name": "Tulips", "emoji": "🌷", "image_key": "tulips", "description": "A vibrant cluster of colourful tulips", "price": 50, "category": "decorations", "rarity": "rare"},
                {"item_key": "dec_stones", "name": "Zen Stones", "emoji": "🪨", "image_key": "stones", "description": "A calming stack of smooth zen stones", "price": 45, "category": "decorations", "rarity": "common"},
                {"item_key": "dec_bamboo", "name": "Bamboo", "emoji": "🎋", "image_key": "bamboo", "description": "Tall green bamboo stalks swaying gently", "price": 65, "category": "decorations", "rarity": "rare"},
            ]
            for s in _shop_seed:
                db.add(models.ShopItem(**s))
            db.commit()
            print(f"[STARTUP] Seeded {len(_shop_seed)} shop items")
        else:
            print(f"[STARTUP] Shop items: {shop_count}")

        if animal_count >= 30 and tip_count >= 160:
            print("[STARTUP] Database already seeded, skipping")
            return
        print("[STARTUP] Seeding missing data...")

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
            # ── 60 new tips ──
            ("Write one \u201canchor sentence\u201d per topic. Something your brain can grab onto later.", "memorization"),
            ("When something feels obvious, test yourself anyway. That\u2019s where mistakes hide.", "memorization"),
            ("If a concept feels abstract, force it into a real-life example.", "memorization"),
            ("Start with a question, not content. Curiosity pulls you in stronger than discipline.", "focus"),
            ("Sit in a slightly uncomfortable chair. Comfort invites distraction.", "focus"),
            ("Rename your study folder something dramatic: \u201cMission: 7s Only.\u201d", "motivation"),
            ("Change your handwriting style mid-session to refresh attention.", "focus"),
            ("Study facing sunlight in the morning \u2014 natural light boosts cognition.", "general"),
            ("Keep a \u201cconfusion first\u201d rule: always start with what you don\u2019t get.", "focus"),
            ("Change your study location every 2\u20133 days. Novelty prevents stagnation.", "general"),
            ("Keep a \u2018wrong answer log\u2019 and return to it every so often. Patterns in your mistakes are more useful than the mistakes themselves.", "memorization"),
            ("Rewrite one concept using only diagrams.", "memorization"),
            ("Use your non-dominant hand briefly \u2014 it wakes up your brain.", "focus"),
            ("Keep your desk slightly minimal \u2014 clarity outside = clarity inside.", "focus"),
            ("Start with a blank page and rebuild knowledge from memory.", "memorization"),
            ("Study with your back straight \u2014 posture affects cognition.", "general"),
            ("Read your notes backwards \u2014 starting from the conclusion forces your brain to reconstruct the logic differently.", "memorization"),
            ("Assign each subject a different font when typing notes. Visual distinction helps compartmentalise memory.", "memorization"),
            ("Study in a foreign accent for five minutes. It sounds absurd but the novelty triggers attention.", "focus"),
            ("Annotate your notes with symbols you invent \u2014 a lightning bolt for \u201cthis will be on the exam,\u201d a spiral for \u201cI don\u2019t fully get this yet.\u201d", "memorization"),
            ("Write out every formula you know from memory each morning. The ones you fumble are the day\u2019s priority.", "memorization"),
            ("Read your notes immediately after exercise, while your heart rate is still slightly elevated. Neurologically optimal.", "general"),
            ("After memorising something, do a star jump. The physical jolt tags the memory with a physical marker.", "memorization"),
            ("Create a \u201cbefore\u201d and \u201cafter\u201d page \u2014 what you thought about a topic before studying it vs. what you know now.", "memorization"),
            ("Assign a numerical value to each topic\u2019s difficulty (1\u201310) and keep a running score. Gamify the hardness.", "motivation"),
            ("Find one real-world product, story, or event that perfectly illustrates each concept. Reality = relevance = memory.", "memorization"),
            ("Keep a \u201ctranslation log\u201d \u2014 every time you rephrase a textbook definition in your own words, log the original and your version.", "memorization"),
            ("When you finish a practice question, spend as long analysing your answer as you did writing it. The debrief is where learning happens.", "memorization"),
            ("Read the mark scheme before you revise a topic. Knowing what\u2019s being rewarded restructures how you absorb the material.", "general"),
            ("When revising an essay subject, practise writing introductions only \u2014 ten in a row, on different questions. The opening argument is the hardest thing to get right under pressure.", "memorization"),
            ("Read primary sources \u2014 original texts, original data, original speeches \u2014 even briefly. Examiners reward engagement with the actual material, not just summaries of it.", "general"),
            ("Practise writing conclusions first. If you can\u2019t state your argument\u2019s endpoint clearly, you don\u2019t know your argument yet.", "memorization"),
            ("Track which types of questions you consistently avoid in practice. Avoidance patterns are the most honest signal of where your gaps actually are.", "general"),
            ("After completing a past paper, rank every question by how confident you felt, not by whether you got it right. Calibration \u2014 knowing what you know \u2014 is its own skill.", "general"),
            ("Identify the one concept in each subject that, if you misunderstood it, would contaminate your answers across multiple questions. Master that one first.", "focus"),
            ("When a topic feels solid, increase the difficulty of the retrieval condition \u2014 less time, fewer notes, higher stakes simulation. Comfort is the enemy of exam readiness.", "memorization"),
            ("Study in blocks anchored by a clear objective, not a time target. \u201cUnderstand the causes of WWI\u201d is a better session goal than \u201crevise for two hours.\u201d", "focus"),
            ("After finishing a topic, write the follow-up question a good examiner would ask. The ability to anticipate depth is the ability to demonstrate it.", "memorization"),
            ("When you can\u2019t understand something, find the last point at which you did understand it. The breakdown is always at a specific junction \u2014 find it.", "general"),
            ("Separate what you know from what you\u2019ve seen. Recognition is not recall. If you need the notes in front of you to explain something, you don\u2019t know it yet.", "memorization"),
            ("Plan your exam answer before you write a single sentence. Three minutes of planning typically produces a stronger response than three minutes of additional writing.", "general"),
            ("For subjects that require argument, practise writing the strongest possible case for a position you disagree with. Opposing positions you can\u2019t argue are positions you don\u2019t understand.", "memorization"),
            ("Study a topic to the point where you can generate your own examples \u2014 not reproduce the textbook ones. Original examples signal genuine understanding.", "memorization"),
            ("Build a \u201cquestion ladder\u201d per topic: easy retrieval at the bottom, analysis and evaluation at the top. Know which rung you\u2019re on.", "focus"),
            ("When revising definitions, practise producing them under time pressure. Recognition is not the same as fluent production.", "memorization"),
            ("Schedule one session per week to revisit material from three weeks ago. The forgetting curve is real; the spacing effect is the antidote.", "memorization"),
            ("When you get something right, ask yourself whether you got it right for the right reasons. Correct answers built on shaky reasoning will fail under different phrasing.", "memorization"),
            ("When you\u2019re fatigued, switch to retrieval rather than input \u2014 test yourself on old material instead of reading new material. Tired brains retain less; retrieval works even tired.", "focus"),
            ("Read one piece of academic commentary on each major topic in your humanities subjects. The vocabulary of scholarly debate is what elevates exam writing.", "general"),
            ("For every major topic, know one example that\u2019s specific, one that\u2019s recent, and one that\u2019s unexpected. Range of evidence is what distinguishes excellent answers.", "memorization"),
            ("Learn the history of at least one idea per subject \u2014 who developed it, why, what it replaced. Context gives concepts sticking power.", "memorization"),
            ("Study your strongest subject just before your weakest. The residual confidence from competence carries into harder material.", "motivation"),
            ("For every formula or rule, practise deriving it \u2014 not just applying it. Derivation proves you understand the logic, not just the output.", "memorization"),
            ("Build the habit of citing the source of your examples: who said it, when, in what context. Precision in attribution elevates analytical writing.", "general"),
            ("Keep a running log of every teacher or examiner comment you\u2019ve received. Patterns in feedback are patterns in your thinking.", "general"),
            ("Read your subject\u2019s most recent grade boundaries. The distance between mark bands tells you how precisely the examiner thinks the material can be graded.", "general"),
            ("Find the three most common errors in student answers for each topic \u2014 most exam board reports publish them. Avoiding known errors is a low-effort, high-return strategy.", "general"),
            ("After getting a question right, generate two variants of that question with different conditions. The ability to anticipate variation is the ability to generalise your knowledge.", "memorization"),
            ("Prioritise understanding over coverage. A partial syllabus understood deeply will outperform a full syllabus known superficially on most well-constructed exam papers.", "general"),
            ("The night before an exam, revise nothing new. Review your key terms, your argument structures, your worked examples. Your job the night before is to trust what you\u2019ve built.", "general"),
        ]
        tips = [
            {"content": text, "category": cat, "animal_name": animals_cycle[i % 30]}
            for i, (text, cat) in enumerate(tip_texts)
        ]

        existing_tips = db.query(models.StudyTip).count()
        if existing_tips >= 160:
            print(f"[STARTUP] Found {existing_tips} tips already seeded, skipping re-seed")
        else:
            print(f"[STARTUP] Found {existing_tips} tips, seeding {len(tip_texts)} new ones")
            try:
                db.execute(text("DELETE FROM tip_views"))
                db.execute(text("DELETE FROM study_tips"))
                db.commit()
                print(f"[STARTUP] Cleared old tips via raw SQL")
            except Exception as del_err:
                print(f"[STARTUP] Raw delete failed: {del_err}, trying TRUNCATE CASCADE")
                db.rollback()
                try:
                    db.execute(text("TRUNCATE TABLE tip_views, study_tips RESTART IDENTITY CASCADE"))
                    db.commit()
                    print("[STARTUP] Truncated tips tables with CASCADE")
                except Exception as trunc_err:
                    print(f"[STARTUP] TRUNCATE also failed: {trunc_err}")
                    db.rollback()

            for tip_data in tips:
                db.add(models.StudyTip(**tip_data))

            db.commit()
            final_count = db.query(models.StudyTip).count()
            sample = db.query(models.StudyTip).first()
            print(f"[STARTUP] Seeded {final_count} tips. Sample animal: {getattr(sample, 'animal_name', 'N/A')}")
    except Exception as e:
        import traceback
        print(f"Warning: Could not seed database on startup: {e}")
        traceback.print_exc()


# ============ Auth Endpoints ============

@app.post("/auth/register")
@limiter.limit("5/minute")
def register(request: Request, user: schemas.UserCreate, db: Session = Depends(get_db)):
    import secrets
    db_user = crud.get_user_by_email(db, user.email)
    if db_user:
        if db_user.username or db_user.email_verified:
            return {"message": "Verification code sent", "needs_verification": True}
        # Truly unverified user re-registering: resend code
        code = f"{secrets.randbelow(1000000):06d}"
        db_user.verification_code = code
        db_user.verification_code_expires = datetime.utcnow() + timedelta(minutes=15)
        db_user.hashed_password = get_password_hash(user.password)
        db.commit()
        sent = _send_verification_email(db_user.email, code)
        resp: dict = {"message": "Verification code sent", "needs_verification": True}
        if not sent:
            logger.warning(f"Failed to send verification email to {db_user.email}")
        return resp

    hashed_password = get_password_hash(user.password)
    new_user = crud.create_user(db, user.email, hashed_password)

    code = f"{secrets.randbelow(1000000):06d}"
    new_user.verification_code = code
    new_user.verification_code_expires = datetime.utcnow() + timedelta(minutes=15)
    new_user.email_verified = False
    db.commit()

    sent = _send_verification_email(new_user.email, code)
    resp: dict = {"message": "Verification code sent", "needs_verification": True}
    if not sent:
        logger.warning(f"Failed to send verification email to {new_user.email}")
    return resp


class VerifyEmailRequest(BaseModel):
    email: str
    code: str = Field(..., min_length=6, max_length=6)

@app.post("/auth/verify-email")
@limiter.limit("10/minute")
def verify_email(request: Request, body: VerifyEmailRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == body.email).first()
    if not user or not user.verification_code:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")

    if (user.verification_attempts or 0) >= 5:
        raise HTTPException(status_code=429, detail="Too many attempts. Please request a new code.")

    if user.verification_code != body.code:
        user.verification_attempts = (user.verification_attempts or 0) + 1
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid verification code")

    if user.verification_code_expires and user.verification_code_expires < datetime.utcnow():
        user.verification_code = None
        user.verification_code_expires = None
        db.commit()
        raise HTTPException(status_code=400, detail="Code has expired. Please request a new one.")

    user.email_verified = True
    user.verification_code = None
    user.verification_code_expires = None
    user.verification_attempts = 0
    db.commit()

    import threading
    _email, _uname = user.email, user.username
    threading.Thread(target=_send_welcome_email_delayed, args=(_email, _uname), daemon=True).start()

    access_token = create_access_token(
        data={"sub": user.email, "tv": user.token_version or 0},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer"}


class ResendVerificationRequest(BaseModel):
    email: str

@app.post("/auth/resend-verification")
@limiter.limit("3/minute")
def resend_verification(request: Request, body: ResendVerificationRequest, db: Session = Depends(get_db)):
    import secrets
    user = db.query(models.User).filter(models.User.email == body.email).first()
    if not user or user.email_verified:
        return {"message": "If that email exists and needs verification, a code has been sent."}

    code = f"{secrets.randbelow(1000000):06d}"
    user.verification_code = code
    user.verification_code_expires = datetime.utcnow() + timedelta(minutes=15)
    user.verification_attempts = 0
    db.commit()

    sent = _send_verification_email(user.email, code)
    resp: dict = {"message": "Verification code sent"}
    if not sent:
        logger.warning(f"Failed to send verification email to {user.email}")
    return resp


def _send_verification_email(email: str, code: str) -> bool:
    resend_key = os.getenv("RESEND_API_KEY")
    resend_from = os.getenv("RESEND_FROM", "Endura <onboarding@resend.dev>")
    logger.info(f"Sending verification to {email}, RESEND_API_KEY set: {bool(resend_key)}, from: {resend_from}")

    if resend_key:
        try:
            import resend
            resend.api_key = resend_key
            result = resend.Emails.send({
                "from": resend_from,
                "to": [email],
                "subject": "Endura — Verify Your Email",
                "html": f"""
                <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:32px;background:#E7EFEA;border-radius:16px">
                    <h2 style="color:#5F8C87;margin:0 0 8px">Endura</h2>
                    <p style="color:#555;margin:0 0 24px">Email Verification</p>
                    <div style="background:#fff;border-radius:12px;padding:24px;text-align:center;margin-bottom:20px">
                        <p style="color:#888;margin:0 0 8px;font-size:14px">Your verification code is</p>
                        <p style="font-size:36px;font-weight:700;letter-spacing:8px;color:#5F8C87;margin:0">{code}</p>
                    </div>
                    <p style="color:#999;font-size:12px;margin:0;text-align:center">This code expires in 15 minutes.</p>
                </div>
                """,
            })
            logger.info(f"Verification email sent to {email} via Resend, result: {result}")
            return True
        except Exception as e:
            logger.error(f"Failed to send verification email to {email}: {e}", exc_info=True)
            return False
    else:
        logger.warning("RESEND_API_KEY not set — verification email could not be sent")
        return False


def _render_template(template, variables: dict) -> tuple[str, str]:
    """Apply variable substitution to a template's subject and body_html."""
    subject = template.subject
    body = template.body_html
    for key, val in variables.items():
        subject = subject.replace("{" + key + "}", str(val))
        body = body.replace("{" + key + "}", str(val))
    return subject, body


def _send_template_email(template_key: str, to_email: str, variables: dict, db: Session) -> bool:
    """Send an email using a DB-stored template. Returns False if template is inactive or missing."""
    resend_key = os.getenv("RESEND_API_KEY")
    resend_from = os.getenv("RESEND_FROM", "Endura <onboarding@resend.dev>")
    if not resend_key:
        return False
    tmpl = db.query(models.EmailTemplate).filter(
        models.EmailTemplate.template_key == template_key
    ).first()
    if not tmpl or not tmpl.is_active:
        return False
    subject, body = _render_template(tmpl, variables)
    try:
        import resend
        resend.api_key = resend_key
        result = resend.Emails.send({
            "from": resend_from, "to": [to_email], "subject": subject, "html": body,
        })
        resend_id = result.get("id") if isinstance(result, dict) else getattr(result, "id", None)
        user = db.query(models.User).filter(models.User.email == to_email).first()
        log = models.EmailLog(
            user_id=user.id if user else None,
            email=to_email,
            template_key=template_key,
            subject=subject,
            resend_message_id=resend_id,
        )
        db.add(log)
        db.commit()
        logger.info(f"Template '{template_key}' email sent to {to_email} (resend_id={resend_id})")
        return True
    except Exception as e:
        logger.error(f"Failed to send '{template_key}' email to {to_email}: {e}")
        return False


def _send_welcome_email(email: str, username: str | None, db: Session | None = None) -> bool:
    variables = {"name": username or "there"}
    if db:
        return _send_template_email("welcome", email, variables, db)
    from database import SessionLocal
    _db = SessionLocal()
    try:
        return _send_template_email("welcome", email, variables, _db)
    finally:
        _db.close()


def _send_welcome_email_delayed(email: str, username: str | None, delay_seconds: int = 600) -> None:
    """Wait before sending the welcome email so the user can finish account setup."""
    import time
    time.sleep(delay_seconds)
    _send_welcome_email(email, username)


@app.post("/auth/login", response_model=schemas.Token)
@limiter.limit("10/minute")
def login(request: Request, user: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, user.email)
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not db_user.email_verified:
        raise HTTPException(status_code=403, detail="Please verify your email before logging in")
    if getattr(db_user, "is_archived", False):
        raise HTTPException(status_code=403, detail="This account has been deactivated. Please contact support.")

    access_token = create_access_token(
        data={"sub": db_user.email, "tv": db_user.token_version or 0},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/auth/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@app.post("/auth/logout")
def logout(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.token_version = (current_user.token_version or 0) + 1
    db.commit()
    return {"message": "Logged out"}


@app.put("/auth/settings")
def update_user_settings(
    data: dict,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if "use_test_timer" in data:
        if not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Admin only")
        current_user.use_test_timer = bool(data["use_test_timer"])
    db.commit()
    db.refresh(current_user)
    return current_user


_IMAGE_MAGIC = {
    b'\xff\xd8\xff': "image/jpeg",
    b'\x89PNG': "image/png",
    b'GIF87a': "image/gif",
    b'GIF89a': "image/gif",
    b'RIFF': "image/webp",
}

def _valid_image_magic(data: bytes) -> bool:
    for magic in _IMAGE_MAGIC:
        if data[:len(magic)] == magic:
            return True
    return False


@app.post("/auth/profile-pic")
async def upload_profile_pic(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if file.content_type not in {"image/png", "image/jpeg", "image/webp", "image/gif"}:
        raise HTTPException(400, "Only PNG, JPEG, WebP, or GIF images are allowed")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 5 MB)")
    if not _valid_image_magic(data):
        raise HTTPException(400, "File does not appear to be a valid image")
    upload = models.Upload(
        filename=file.filename or "profile.jpg",
        content_type=file.content_type,
        data=data,
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)
    base = os.getenv("API_BASE_URL", "https://web-production-34028.up.railway.app")
    pic_url = f"{base}/uploads/{upload.public_id}"
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    user.profile_pic_url = pic_url
    db.commit()
    return {"profile_pic_url": pic_url}


@app.delete("/auth/profile-pic")
def delete_profile_pic(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    user.profile_pic_url = None
    db.commit()
    return {"message": "Profile picture removed"}


@app.delete("/auth/account")
def delete_account(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.id

    db.query(models.FeedReaction).filter(models.FeedReaction.user_id == user_id).delete()
    db.query(models.ActivityEvent).filter(models.ActivityEvent.user_id == user_id).delete()

    owned_groups = db.query(models.StudyGroup).filter(models.StudyGroup.creator_id == user_id).all()
    for group in owned_groups:
        db.query(models.GroupMessage).filter(models.GroupMessage.group_id == group.id).delete()
        db.query(models.GroupMember).filter(models.GroupMember.group_id == group.id).delete()
        db.delete(group)

    db.query(models.GroupMessage).filter(models.GroupMessage.user_id == user_id).delete()
    db.query(models.GroupMember).filter(models.GroupMember.user_id == user_id).delete()
    db.query(models.Donation).filter(models.Donation.user_id == user_id).delete()
    db.query(models.TipView).filter(models.TipView.user_id == user_id).delete()
    db.query(models.UserBadge).filter(models.UserBadge.user_id == user_id).delete()
    db.query(models.UserAnimal).filter(models.UserAnimal.user_id == user_id).delete()
    db.query(models.StudySession).filter(models.StudySession.user_id == user_id).delete()
    db.query(models.Task).filter(models.Task.user_id == user_id).delete()
    db.query(models.Friendship).filter(
        (models.Friendship.user_id == user_id) | (models.Friendship.friend_id == user_id)
    ).delete(synchronize_session=False)
    db.query(models.Egg).filter(models.Egg.user_id == user_id).delete()
    db.query(models.StudyTip).filter(models.StudyTip.user_id == user_id).delete()
    db.query(models.User).filter(models.User.id == user_id).delete()
    db.commit()
    return {"message": "Account deleted successfully"}


# ============ Forgot / Reset Password ============

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str


@app.post("/auth/forgot-password")
@limiter.limit("5/minute")
def forgot_password(request: Request, body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    import secrets
    user = db.query(models.User).filter(models.User.email == body.email).first()
    if not user:
        return {"message": "If that email exists, a reset code has been sent."}

    code = f"{secrets.randbelow(1000000):06d}"
    user.reset_token = code
    user.reset_token_expires = datetime.utcnow() + timedelta(minutes=15)
    user.reset_attempts = 0
    db.commit()

    resend_key = os.getenv("RESEND_API_KEY")
    resend_from = os.getenv("RESEND_FROM", "Endura <onboarding@resend.dev>")
    logger.info(f"RESEND_API_KEY present: {bool(resend_key)}, length: {len(resend_key) if resend_key else 0}")

    if resend_key:
        try:
            import resend
            resend.api_key = resend_key

            resend.Emails.send({
                "from": resend_from,
                "to": [body.email],
                "subject": "Endura — Password Reset Code",
                "html": f"""
                <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:32px;background:#f0f2f0;border-radius:16px">
                    <h2 style="color:#4A7C59;margin:0 0 8px">Endura</h2>
                    <p style="color:#555;margin:0 0 24px">Password Reset</p>
                    <div style="background:#fff;border-radius:12px;padding:24px;text-align:center;margin-bottom:20px">
                        <p style="color:#888;margin:0 0 8px;font-size:14px">Your reset code is</p>
                        <p style="font-size:36px;font-weight:700;letter-spacing:8px;color:#4A7C59;margin:0">{code}</p>
                    </div>
                    <p style="color:#999;font-size:12px;margin:0;text-align:center">This code expires in 15 minutes.</p>
                </div>
                """,
            })
            logger.info(f"Reset code sent to {body.email} via Resend")
        except Exception as e:
            logger.error(f"Failed to send reset email via Resend: {e}")
    else:
        logger.warning("RESEND_API_KEY not set — reset email could not be sent")

    return {"message": "If that email exists, a reset code has been sent."}


@app.post("/auth/reset-password")
@limiter.limit("10/minute")
def reset_password(request: Request, body: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == body.email).first()
    if not user or not user.reset_token:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")

    if (user.reset_attempts or 0) >= 5:
        raise HTTPException(status_code=429, detail="Too many attempts. Please request a new code.")

    if user.reset_token != body.code:
        user.reset_attempts = (user.reset_attempts or 0) + 1
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")

    if user.reset_token_expires and user.reset_token_expires < datetime.utcnow():
        user.reset_token = None
        user.reset_token_expires = None
        db.commit()
        raise HTTPException(status_code=400, detail="Reset code has expired. Please request a new one.")

    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not any(c.isdigit() for c in body.new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number")
    if not any(c.isalpha() for c in body.new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least one letter")

    user.hashed_password = get_password_hash(body.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    user.reset_attempts = 0
    user.token_version = (user.token_version or 0) + 1
    db.commit()

    access_token = create_access_token(
        data={"sub": user.email, "tv": user.token_version},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"message": "Password reset successful", "access_token": access_token, "token_type": "bearer"}


@app.post("/user/username")
def set_username(
    username: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    username = username.strip()
    if not username or len(username) < 2:
        raise HTTPException(status_code=400, detail="Username must be at least 2 characters")
    if len(username) > 30:
        raise HTTPException(status_code=400, detail="Username must be 30 characters or fewer")
    if contains_profanity(username):
        raise HTTPException(status_code=400, detail="Username contains inappropriate language. Please choose a different name.")

    existing = db.query(models.User).filter(
        models.User.username == username,
        models.User.id != current_user.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    crud.update_username(db, current_user.id, username)
    return {"message": "Username updated"}


@app.post("/user/onboarding/complete")
def complete_onboarding(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark onboarding as complete (idempotent). Sets onboarding_completed_at
    only on the first successful call per user so we can measure true funnel
    drop-off from the DB."""
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if user and user.onboarding_completed_at is None:
        user.onboarding_completed_at = datetime.utcnow()
        db.commit()
    return {"ok": True, "onboarding_completed_at": user.onboarding_completed_at.isoformat() if user and user.onboarding_completed_at else None}


@app.put("/user/profile")
def update_profile(
    profile: schemas.UpdateProfileRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if profile.school is not None:
        user.school = profile.school.strip() if profile.school.strip() else None
    if profile.city is not None:
        user.city = profile.city.strip() if profile.city.strip() else None
    if profile.country is not None:
        user.country = profile.country.strip() if profile.country.strip() else None
    db.commit()
    db.refresh(user)
    return {"message": "Profile updated"}


@app.get("/schools/search", response_model=List[schemas.SchoolSearchResult])
def search_schools(
    q: str = "",
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not q or len(q) < 2:
        return []
    query = f"%{q}%"
    results = db.query(models.School).filter(
        models.School.name.ilike(query)
    ).order_by(models.School.name).limit(20).all()
    return [
        {"name": s.name, "city": s.city, "region": s.region, "country": s.country}
        for s in results
    ]


ADMIN_API_KEY = os.getenv("ADMIN_API_KEY")
if not ADMIN_API_KEY:
    if os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("DATABASE_URL", "").startswith("postgresql"):
        raise RuntimeError("ADMIN_API_KEY environment variable is required in production")
    ADMIN_API_KEY = "dev-only-admin-key"
    logger.warning("Using insecure dev ADMIN_API_KEY — set ADMIN_API_KEY env var for production")

def verify_admin(x_admin_key: str = Header(...)):
    if x_admin_key != ADMIN_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid admin key")


def _seed_schools_from_json(db, filepath, country_override, errors):
    """Load schools from a bundled JSON file. Returns count of schools added."""
    import json as json_lib
    count = 0
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json_lib.load(f)
        batch = []
        for s in data:
            batch.append(models.School(
                name=s["name"],
                city=s.get("city"),
                region=s.get("region"),
                country=country_override or s.get("country", ""),
            ))
            if len(batch) >= 2000:
                db.bulk_save_objects(batch)
                db.commit()
                count += len(batch)
                batch = []
        if batch:
            db.bulk_save_objects(batch)
            db.commit()
            count += len(batch)
    except Exception as e:
        errors.append(f"{os.path.basename(filepath)}: {str(e)}")
    return count


@app.post("/schools/seed")
def seed_schools(
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    """Seed schools from bundled UK/India/Sri Lanka data + Hipo university API."""
    existing = db.query(models.School).first()
    if existing:
        return {"message": "Schools already seeded", "count": db.query(models.School).count()}

    import json as json_lib, urllib.request
    count = 0
    errors = []
    breakdown = {}

    bundled = [
        ("uk_schools.json", "United Kingdom"),
        ("india_schools.json", None),
        ("srilanka_schools.json", None),
    ]
    for filename, country_override in bundled:
        filepath = os.path.join(os.path.dirname(__file__), filename)
        if os.path.exists(filepath):
            n = _seed_schools_from_json(db, filepath, country_override, errors)
            breakdown[filename.replace("_schools.json", "").replace(".json", "")] = n
            count += n

    # Global universities from Hipo
    try:
        url = "https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        response = urllib.request.urlopen(req, timeout=60)
        data = json_lib.loads(response.read().decode("utf-8"))
        batch = []
        for uni in data:
            name = uni.get("name", "").strip()
            if not name:
                continue
            batch.append(models.School(
                name=name, city=None, region=uni.get("state-province") or None,
                country=uni.get("country", "").strip(),
            ))
            if len(batch) >= 1000:
                db.bulk_save_objects(batch)
                db.commit()
                count += len(batch)
                batch = []
        if batch:
            db.bulk_save_objects(batch)
            db.commit()
            count += len(batch)
        breakdown["hipo_universities"] = count - sum(v for k, v in breakdown.items())
    except Exception as e:
        errors.append(f"Unis: {str(e)}")

    return {
        "message": f"Seeded {count} schools",
        "breakdown": breakdown,
        "errors": errors if errors else None,
    }


@app.post("/schools/seed-additional")
def seed_additional_schools(
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    """Add India and Sri Lanka schools if not already present. Safe to run on existing DB."""
    import json as json_lib
    errors = []
    added = {}

    for filename, country in [("india_schools.json", "India"), ("srilanka_schools.json", "Sri Lanka")]:
        filepath = os.path.join(os.path.dirname(__file__), filename)
        if not os.path.exists(filepath):
            errors.append(f"{filename} not found")
            continue

        existing = db.query(models.School).filter(models.School.country == country).count()
        if filename == "india_schools.json" and existing > 1000:
            added[country] = f"skipped ({existing} already exist)"
            continue
        if filename == "srilanka_schools.json" and existing > 100:
            added[country] = f"skipped ({existing} already exist)"
            continue

        n = _seed_schools_from_json(db, filepath, None, errors)
        added[country] = n

    return {"added": added, "errors": errors if errors else None}


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
@limiter.limit("12/hour")
def complete_study_session(
    request: Request,
    session: schemas.StudySessionCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    import traceback
    try:
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        daily_minutes = db.query(func.coalesce(func.sum(models.StudySession.duration_minutes), 0)).filter(
            models.StudySession.user_id == current_user.id,
            models.StudySession.completed_at >= today_start,
        ).scalar()
        if daily_minutes + session.duration_minutes > 720:
            raise HTTPException(status_code=400, detail="Daily study cap of 12 hours reached")

        if session.animal_name:
            valid_animal = db.query(models.Animal).filter(models.Animal.name == session.animal_name).first()
            if not valid_animal:
                session.animal_name = None

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
            session.subject_id
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
        except Exception:
            pass
        session_dict = {
            "id": study_session.id,
            "task_id": study_session.task_id,
            "duration_minutes": study_session.duration_minutes,
            "coins_earned": study_session.coins_earned,
            "subject": study_session.subject.display_name if study_session.subject else None,
            "subject_id": study_session.subject_id,
            "started_at": study_session.started_at,
            "completed_at": study_session.completed_at,
        }
        return {
            "session": session_dict,
            "hatched_animal": hatched_animal,
            "new_badges": [crud.BADGE_MAP[bid] for bid in new_badges if bid in crud.BADGE_MAP],
        }
    except Exception as e:
        db.rollback()
        import logging
        logging.getLogger(__name__).error(f"Session create failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create session")


@app.get("/sessions", response_model=List[schemas.StudySessionResponse])
def get_sessions(
    limit: int = Query(default=50, ge=1, le=200),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sessions = crud.get_user_sessions(db, current_user.id, limit)
    return [
        {
            "id": s.id, "task_id": s.task_id,
            "duration_minutes": s.duration_minutes, "coins_earned": s.coins_earned,
            "subject": s.subject.display_name if s.subject else None,
            "subject_id": s.subject_id,
            "started_at": s.started_at, "completed_at": s.completed_at,
        }
        for s in sessions
    ]


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
    animals = crud.get_user_animals(db, current_user.id)
    result = []
    for ua in animals:
        data = {
            "id": ua.id,
            "animal": ua.animal,
            "nickname": ua.nickname,
            "hatched_at": ua.hatched_at,
        }
        result.append(data)
    return result


@app.put("/my-animals/{animal_id}/name")
def name_animal(
    animal_id: int,
    nickname: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if contains_profanity(nickname):
        raise HTTPException(status_code=400, detail="Nickname contains inappropriate language. Please choose a different name.")
    animal = crud.name_animal(db, animal_id, current_user.id, nickname)
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")
    return {"message": "Animal named successfully"}


# ============ Study Tips Endpoints ============

@app.get("/tips", response_model=List[schemas.StudyTipResponse])
def get_tips(
    limit: int = Query(default=10, ge=1, le=100),
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
    content = html.escape(tip.content)
    category = html.escape(tip.category)
    return crud.create_study_tip(db, current_user.id, content, category)


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


@app.get("/friends/suggestions")
def get_friend_suggestions(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_friend_suggestions(db, current_user.id)


@app.get("/friends", response_model=List[schemas.FriendResponse])
def get_friends(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    friends_data = crud.get_friends(db, current_user.id)
    result = []
    for entry in friends_data:
        friend = entry["user"]
        animals_count = db.query(models.UserAnimal).filter(
            models.UserAnimal.user_id == friend.id
        ).count()
        result.append({
            "id": friend.id,
            "username": friend.username,
            "total_study_minutes": friend.total_study_minutes,
            "current_streak": crud.get_effective_streak(friend),
            "animals_count": animals_count,
            "profile_pic_url": friend.profile_pic_url,
            "friends_since": entry["friends_since"].isoformat() if entry["friends_since"] else None,
        })
    return result



@app.get("/friends/{friend_id}/profile", response_model=schemas.FriendProfileResponse)
def get_friend_profile(
    friend_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    friendship = db.query(models.Friendship).filter(
        models.Friendship.status == "accepted",
        (
            ((models.Friendship.user_id == current_user.id) & (models.Friendship.friend_id == friend_id)) |
            ((models.Friendship.user_id == friend_id) & (models.Friendship.friend_id == current_user.id))
        )
    ).first()
    if not friendship:
        raise HTTPException(status_code=404, detail="Friend not found")
    friend = db.query(models.User).filter(models.User.id == friend_id).first()
    if not friend:
        raise HTTPException(status_code=404, detail="User not found")
    animals_count = db.query(models.UserAnimal).filter(models.UserAnimal.user_id == friend.id).count()
    friend_subject_objs = crud.get_user_subjects(db, friend.id)
    friend_subjects = [s.display_name for s in friend_subject_objs]
    return {
        "id": friend.id,
        "username": friend.username,
        "total_study_minutes": friend.total_study_minutes,
        "current_streak": crud.get_effective_streak(friend),
        "longest_streak": friend.longest_streak,
        "total_sessions": friend.total_sessions,
        "animals_count": animals_count,
        "profile_pic_url": friend.profile_pic_url,
        "friends_since": friendship.created_at.isoformat() if friendship.created_at else None,
        "member_since": friend.created_at.isoformat() if friend.created_at else None,
        "total_coins": friend.total_coins,
        "school": friend.school,
        "city": friend.city,
        "country": friend.country,
        "subjects": friend_subjects,
    }


@app.get("/friends/{friend_id}/subjects")
def get_friend_subjects(
    friend_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    friendship = db.query(models.Friendship).filter(
        models.Friendship.status == "accepted",
        (
            ((models.Friendship.user_id == current_user.id) & (models.Friendship.friend_id == friend_id)) |
            ((models.Friendship.user_id == friend_id) & (models.Friendship.friend_id == current_user.id))
        )
    ).first()
    if not friendship:
        raise HTTPException(status_code=404, detail="Friend not found")
    friend_subject_objs = crud.get_user_subjects(db, friend_id)
    return {"subjects": [s.display_name for s in friend_subject_objs]}


@app.delete("/friends/{friend_id}")
def remove_friend(
    friend_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not crud.remove_friend(db, current_user.id, friend_id):
        raise HTTPException(status_code=404, detail="Friendship not found")
    return {"message": "Friend removed"}


@app.delete("/groups/{group_id}/members/{user_id}")
def remove_group_member(
    group_id: int,
    user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    success, message = crud.remove_group_member(db, current_user.id, group_id, user_id)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"message": message}


@app.get("/leaderboard", response_model=List[schemas.LeaderboardEntry])
def get_leaderboard(
    period: str = "all_time",
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        return crud.get_leaderboard(db, current_user.id, period=period)
    except Exception as e:
        logger.error(f"Leaderboard error for user {current_user.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load leaderboard")


@app.get("/leaderboard/global", response_model=List[schemas.LeaderboardEntry])
def get_global_leaderboard(
    period: str = "all_time",
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_global_leaderboard(db, period=period)


@app.get("/leaderboard/school", response_model=List[schemas.LeaderboardEntry])
def get_school_leaderboard(
    period: str = "all_time",
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_school_leaderboard(db, current_user, period=period)


# ============ Stats Endpoints ============

@app.get("/stats", response_model=schemas.UserStats)
def get_stats(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_user_stats(db, current_user.id)


# ============ Shop / Spend Coins ============

class SpendRequest(BaseModel):
    amount: int = Field(..., ge=1, le=100000)

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


# ============ User Purchases & Assignments ============

@app.get("/shop/purchases")
def get_purchases(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rows = db.query(models.UserPurchase).filter(
        models.UserPurchase.user_id == current_user.id
    ).all()
    return {row.item_key: row.quantity for row in rows}


class PurchaseRequest(BaseModel):
    item_key: str
    quantity: int = 1

@app.post("/shop/purchases")
def record_purchase(
    req: PurchaseRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    existing = db.query(models.UserPurchase).filter(
        models.UserPurchase.user_id == current_user.id,
        models.UserPurchase.item_key == req.item_key,
    ).first()
    if existing:
        existing.quantity += req.quantity
    else:
        db.add(models.UserPurchase(
            user_id=current_user.id,
            item_key=req.item_key,
            quantity=req.quantity,
        ))
    db.commit()
    return {"item_key": req.item_key, "quantity": existing.quantity if existing else req.quantity}


@app.get("/shop/assignments")
def get_assignments(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rows = db.query(models.UserItemAssignment).filter(
        models.UserItemAssignment.user_id == current_user.id
    ).all()
    return [{"itemId": r.item_id, "x": r.x, "y": r.y, "page": r.page} for r in rows]


class AssignmentItem(BaseModel):
    itemId: str
    x: float
    y: float
    page: int = 0

class SaveAssignmentsRequest(BaseModel):
    assignments: List[AssignmentItem]

@app.put("/shop/assignments")
def save_assignments(
    req: SaveAssignmentsRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(models.UserItemAssignment).filter(
        models.UserItemAssignment.user_id == current_user.id
    ).delete()
    for a in req.assignments:
        db.add(models.UserItemAssignment(
            user_id=current_user.id,
            item_id=a.itemId,
            x=a.x,
            y=a.y,
            page=a.page,
        ))
    db.commit()
    return {"saved": len(req.assignments)}


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


# ============ Subject Endpoints ============

@app.get("/subjects", response_model=List[schemas.SubjectResponse])
def list_subjects(db: Session = Depends(get_db)):
    """Return all standard (default) subjects."""
    return crud.get_all_subjects(db)


@app.get("/subjects/search", response_model=List[schemas.SubjectResponse])
def search_subjects(
    q: str = "",
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Search standard subjects by name for autocomplete."""
    if not q or len(q) < 1:
        return []
    return crud.search_subjects(db, q)


@app.get("/subjects/me", response_model=List[schemas.SubjectResponse])
def my_subjects(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return crud.get_user_subjects(db, current_user.id)


@app.post("/subjects/me")
def add_subject_to_me(
    data: dict,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    subject_id = data.get("subject_id")
    if not subject_id or not isinstance(subject_id, int):
        raise HTTPException(status_code=400, detail="subject_id required")
    ok = crud.add_user_subject(db, current_user.id, subject_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Subject not found")
    return {"message": "Subject added"}


@app.delete("/subjects/me/{subject_id}")
def remove_subject_from_me(
    subject_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ok = crud.remove_user_subject(db, current_user.id, subject_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Subject not found in your list")
    return {"message": "Subject removed"}


@app.post("/subjects", response_model=schemas.SubjectResponse)
def create_subject(
    data: schemas.SubjectCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = crud.create_custom_subject(db, current_user.id, data.display_name)
    if not sub:
        raise HTTPException(status_code=400, detail="Invalid subject name")
    return sub


@app.get("/subjects/shared", response_model=List[schemas.SubjectResponse])
def shared_subjects(
    user_ids: str = Query(..., description="Comma-separated user IDs"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        ids = [int(x.strip()) for x in user_ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_ids format")
    if not ids:
        raise HTTPException(status_code=400, detail="At least one user_id required")
    return crud.get_shared_subjects(db, ids)


# ============ Study Group Endpoints ============

@app.post("/groups")
def create_group(
    data: schemas.GroupCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if contains_profanity(data.name):
        raise HTTPException(status_code=400, detail="Group name contains inappropriate language. Please choose a different name.")
    group = crud.create_group(db, current_user.id, data.name, data.goal_minutes, data.goal_deadline, data.subject_id)
    return {"id": group.id, "name": group.name}

@app.put("/groups/{group_id}")
def update_group(
    group_id: int,
    data: dict,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    group = db.query(models.StudyGroup).filter(models.StudyGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    member = db.query(models.GroupMember).filter(
        models.GroupMember.group_id == group_id,
        models.GroupMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this group")
    if "name" in data and data["name"]:
        name = str(data["name"]).strip()[:100]
        if name:
            if contains_profanity(name):
                raise HTTPException(status_code=400, detail="Group name contains inappropriate language.")
            group.name = name
    if "subject_id" in data:
        sid = data["subject_id"]
        group.subject_id = int(sid) if sid else None
    if "goal_minutes" in data:
        goal = data["goal_minutes"]
        if isinstance(goal, int) and goal >= 1:
            group.goal_minutes = goal
    db.commit()
    subj_name = None
    if group.subject_id:
        subj_obj = db.query(models.Subject).filter(models.Subject.id == group.subject_id).first()
        subj_name = subj_obj.display_name if subj_obj else None
    return {"message": "Group updated", "name": group.name, "subject": subj_name, "subject_id": group.subject_id, "goal_minutes": group.goal_minutes}

@app.put("/groups/{group_id}/goal")
def update_group_goal(
    group_id: int,
    data: dict,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    group = db.query(models.StudyGroup).filter(models.StudyGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    member = db.query(models.GroupMember).filter(
        models.GroupMember.group_id == group_id,
        models.GroupMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this group")
    goal = data.get("goal_minutes")
    if not goal or not isinstance(goal, int) or goal < 1:
        raise HTTPException(status_code=400, detail="Invalid goal")
    group.goal_minutes = goal
    db.commit()
    return {"message": "Goal updated", "goal_minutes": goal}

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
    content = html.escape(data.content)
    if contains_profanity(content):
        raise HTTPException(status_code=400, detail="Your message contains inappropriate language. Please rephrase.")
    result = crud.send_group_message(db, current_user.id, group_id, content)
    if not result:
        raise HTTPException(status_code=403, detail="Not a member of this group")
    return result

@app.get("/groups/{group_id}/messages", response_model=List[schemas.GroupMessageResponse])
def get_group_messages(
    group_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    result = crud.get_group_messages(db, group_id, current_user.id)
    if result is None:
        raise HTTPException(status_code=403, detail="Not a member of this group")
    return result

@app.post("/groups/{group_id}/invite")
def invite_to_group(
    group_id: int,
    data: schemas.GroupInvite,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    group = db.query(models.StudyGroup).filter(models.StudyGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the group admin can invite members")
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
    try:
        return crud.get_friend_feed(db, current_user.id)
    except Exception as e:
        logger.error(f"Feed error for user {current_user.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load feed")

@app.get("/feed/reactions/new")
def get_new_reactions(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        my_events = db.query(models.ActivityEvent).filter(
            models.ActivityEvent.user_id == current_user.id
        ).all()
        event_ids = [e.id for e in my_events]
        if not event_ids:
            return []
        unseen = db.query(models.FeedReaction).filter(
            models.FeedReaction.event_id.in_(event_ids),
            models.FeedReaction.user_id != current_user.id,
            (models.FeedReaction.seen == False) | (models.FeedReaction.seen == None)
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
        try:
            db.commit()
        except Exception:
            db.rollback()
        return results
    except Exception as e:
        logger.error(f"Error fetching new reactions for user {current_user.id}: {e}")
        return []

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


@app.post("/tips/send")
def send_tip_to_friend(
    data: dict,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    friend_id = data.get("friend_id")
    tip_content = data.get("tip_content", "")
    animal_name = data.get("animal_name", "")

    if not friend_id or not tip_content:
        raise HTTPException(status_code=400, detail="friend_id and tip_content required")

    friend = db.query(models.User).filter(models.User.id == friend_id).first()
    if not friend:
        raise HTTPException(status_code=404, detail="Friend not found")

    friendship = db.query(models.Friendship).filter(
        models.Friendship.status == "accepted",
        (
            ((models.Friendship.user_id == current_user.id) & (models.Friendship.friend_id == friend_id)) |
            ((models.Friendship.user_id == friend_id) & (models.Friendship.friend_id == current_user.id))
        )
    ).first()
    if not friendship:
        raise HTTPException(status_code=403, detail="You can only send tips to friends")

    event = models.ActivityEvent(
        user_id=current_user.id,
        event_type="tip_shared",
        description=f'shared a study tip with you from {animal_name}: "{tip_content}"',
        extra_data=_json.dumps({"recipient_id": friend_id, "animal_name": animal_name}),
    )
    db.add(event)
    db.commit()
    return {"message": f"Tip sent to {friend.username}"}


# ============ Content Reporting & User Blocking ============

class ReportContentRequest(BaseModel):
    reported_user_id: int
    content_type: str  # group_message, activity_event, username, profile_pic
    content_id: Optional[int] = None
    reason: str  # inappropriate, spam, harassment, other
    details: Optional[str] = None

@app.post("/report")
def report_content(
    req: ReportContentRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if req.reported_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot report yourself")
    report = models.ContentReport(
        reporter_id=current_user.id,
        reported_user_id=req.reported_user_id,
        content_type=req.content_type,
        content_id=req.content_id,
        reason=req.reason,
        details=req.details[:500] if req.details else None,
    )
    db.add(report)
    db.commit()
    return {"message": "Report submitted. Our team will review it shortly."}


@app.post("/block/{user_id}")
def block_user(
    user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    existing = db.query(models.UserBlock).filter(
        models.UserBlock.blocker_id == current_user.id,
        models.UserBlock.blocked_id == user_id,
    ).first()
    if existing:
        return {"message": "User already blocked"}
    block = models.UserBlock(blocker_id=current_user.id, blocked_id=user_id)
    db.add(block)
    # Auto-report for admin visibility
    report = models.ContentReport(
        reporter_id=current_user.id,
        reported_user_id=user_id,
        content_type="user_blocked",
        reason="blocked",
        details="User was blocked — content hidden from blocker's feed.",
    )
    db.add(report)
    # Remove friendship if exists
    db.query(models.Friendship).filter(
        ((models.Friendship.user_id == current_user.id) & (models.Friendship.friend_id == user_id)) |
        ((models.Friendship.user_id == user_id) & (models.Friendship.friend_id == current_user.id))
    ).delete()
    db.commit()
    return {"message": "User blocked. Their content will no longer appear in your feed."}


@app.delete("/block/{user_id}")
def unblock_user(
    user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    deleted = db.query(models.UserBlock).filter(
        models.UserBlock.blocker_id == current_user.id,
        models.UserBlock.blocked_id == user_id,
    ).delete()
    db.commit()
    if deleted:
        return {"message": "User unblocked"}
    return {"message": "User was not blocked"}


@app.get("/blocked-users")
def get_blocked_users(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    blocks = db.query(models.UserBlock).filter(
        models.UserBlock.blocker_id == current_user.id
    ).all()
    blocked_ids = [b.blocked_id for b in blocks]
    if not blocked_ids:
        return []
    users = db.query(models.User).filter(models.User.id.in_(blocked_ids)).all()
    return [{"id": u.id, "username": u.username, "email": u.email} for u in users]


# ============ Every.org Donation Webhook ============

_last_webhook_payloads = []
WEBHOOK_SECRET = os.getenv("EVERY_ORG_WEBHOOK_SECRET", "")

@app.post("/webhook/every-org")
async def every_org_webhook(
    request: dict,
    db: Session = Depends(get_db),
    x_webhook_secret: Optional[str] = Header(None),
):
    """Receive donation notifications from Every.org and store them."""
    if WEBHOOK_SECRET:
        incoming = x_webhook_secret or request.get("webhookSecret") or ""
        if incoming != WEBHOOK_SECRET:
            logger.warning(f"Webhook rejected: invalid secret")
            raise HTTPException(status_code=403, detail="Invalid webhook secret")
    try:

        charge_id = (
            request.get("chargeId")
            or request.get("charge_id")
            or request.get("id")
            or f"unknown-{len(_last_webhook_payloads)}"
        )
        amount = float(
            request.get("amount")
            or request.get("donationAmount")
            or request.get("data", {}).get("amount")
            or 0
        )
        net_amount_raw = (
            request.get("netAmount")
            or request.get("net_amount")
            or request.get("data", {}).get("netAmount")
        )
        net_amount = float(net_amount_raw) if net_amount_raw else None
        currency = request.get("currency") or request.get("data", {}).get("currency") or "USD"
        frequency = request.get("frequency") or request.get("data", {}).get("frequency") or "One-time"
        donor_first = (
            request.get("firstName")
            or request.get("first_name")
            or request.get("data", {}).get("firstName")
            or request.get("donor", {}).get("firstName")
        )
        donor_last = (
            request.get("lastName")
            or request.get("last_name")
            or request.get("data", {}).get("lastName")
            or request.get("donor", {}).get("lastName")
        )
        donor_email = (
            request.get("email")
            or request.get("data", {}).get("email")
            or request.get("donor", {}).get("email")
        )
        nonprofit = request.get("toNonprofit") or request.get("nonprofit") or request.get("data", {}).get("toNonprofit") or {}
        nonprofit_name = nonprofit.get("name", "WWF") if isinstance(nonprofit, dict) else "WWF"
        donation_date = request.get("donationDate") or request.get("donation_date") or request.get("data", {}).get("donationDate") or ""
        partner_id = request.get("partnerDonationId") or request.get("partner_donation_id") or ""

        linked_user_id = None
        if partner_id and partner_id.startswith("endura-u"):
            try:
                linked_user_id = int(partner_id.split("-u")[1].split("-")[0])
            except (ValueError, IndexError):
                pass

        existing = db.query(models.Donation).filter(
            models.Donation.charge_id == charge_id
        ).first()

        if not existing:
            donation = models.Donation(
                charge_id=charge_id,
                user_id=linked_user_id,
                amount=amount,
                net_amount=net_amount,
                currency=currency,
                frequency=frequency,
                donor_first_name=donor_first,
                donor_last_name=donor_last,
                donor_email=donor_email,
                nonprofit_name=nonprofit_name,
                donation_date=donation_date,
                partner_donation_id=partner_id,
            )
            db.add(donation)
            db.commit()
            logger.info(f"Donation stored: ${amount} {currency} | user_id={linked_user_id}")
        else:
            logger.info(f"Duplicate donation skipped: {charge_id}")

        return {"status": "received", "chargeId": charge_id}
    except Exception as e:
        logger.error(f"Webhook error: {e}", exc_info=True)
        return {"status": "error", "detail": "Webhook processing failed"}



@app.get("/donations/check/{partner_id}")
def check_donation(partner_id: str, db: Session = Depends(get_db)):
    donation = db.query(models.Donation).filter(
        models.Donation.partner_donation_id == partner_id
    ).first()
    if donation:
        return {"confirmed": True, "amount": donation.amount, "nonprofit": donation.nonprofit_name}
    return {"confirmed": False}


@app.get("/donations/community-stats")
def get_community_donation_stats(db: Session = Depends(get_db)):
    """Public endpoint: community donation totals for the Take Action screen."""
    from sqlalchemy import func
    from datetime import datetime, timedelta

    total_raised = db.query(func.coalesce(func.sum(models.Donation.amount), 0)).scalar()
    total_donors = db.query(models.Donation).distinct(models.Donation.donor_email).count()
    total_donations = db.query(models.Donation).count()

    month_ago = datetime.utcnow() - timedelta(days=30)
    this_month = db.query(
        func.coalesce(func.sum(models.Donation.amount), 0)
    ).filter(models.Donation.created_at >= month_ago).scalar()

    this_month_count = db.query(models.Donation).filter(
        models.Donation.created_at >= month_ago
    ).count()

    recent = db.query(models.Donation).order_by(
        models.Donation.created_at.desc()
    ).limit(5).all()

    recent_list = []
    for d in recent:
        name = d.donor_first_name or "Anonymous"
        recent_list.append({
            "name": name,
            "amount": d.amount,
            "currency": d.currency,
            "date": d.created_at.isoformat() if d.created_at else "",
        })

    return {
        "total_raised": float(total_raised),
        "total_donors": total_donors,
        "total_donations": total_donations,
        "this_month_raised": float(this_month),
        "this_month_count": this_month_count,
        "recent_donations": recent_list,
    }


@app.get("/donations/user/{user_id}")
def get_user_donation_stats(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Per-user donation stats."""
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    from sqlalchemy import func

    user_total = db.query(func.coalesce(func.sum(models.Donation.amount), 0)).filter(
        models.Donation.user_id == user_id
    ).scalar()

    user_count = db.query(models.Donation).filter(
        models.Donation.user_id == user_id
    ).count()

    user_donations = db.query(models.Donation).filter(
        models.Donation.user_id == user_id
    ).order_by(models.Donation.created_at.desc()).limit(10).all()

    history = []
    for d in user_donations:
        history.append({
            "amount": d.amount,
            "currency": d.currency,
            "nonprofit": d.nonprofit_name,
            "date": d.created_at.isoformat() if d.created_at else "",
        })

    return {
        "total_donated": float(user_total),
        "donation_count": user_count,
        "history": history,
    }


@app.get("/donations/leaderboard")
def get_donation_leaderboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Donation leaderboard: all users who have donated, ranked by total."""
    from sqlalchemy import func

    results = (
        db.query(
            models.Donation.user_id,
            func.sum(models.Donation.amount).label("total"),
            func.count(models.Donation.id).label("count"),
        )
        .filter(models.Donation.user_id.isnot(None), models.Donation.amount > 0)
        .group_by(models.Donation.user_id)
        .order_by(func.sum(models.Donation.amount).desc())
        .limit(50)
        .all()
    )

    leaderboard = []
    for rank, row in enumerate(results, 1):
        user = db.query(models.User).filter(models.User.id == row.user_id).first()
        if not user or getattr(user, "is_archived", False):
            continue
        leaderboard.append({
            "rank": rank,
            "user_id": user.id,
            "username": user.username or f"User {user.id}",
            "total_donated": float(row.total),
            "donation_count": int(row.count),
            "is_current_user": user.id == current_user.id,
        })

    return leaderboard


# ============ Admin Dashboard API ============

@app.get("/admin/overview")
def admin_overview(db: Session = Depends(get_db), _=Depends(verify_admin)):
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    total_users = db.query(func.count(models.User.id)).scalar() or 0
    archived_users = db.query(func.count(models.User.id)).filter(
        models.User.is_archived == True
    ).scalar() or 0
    active_7d = db.query(func.count(models.User.id)).filter(
        models.User.last_study_date >= week_ago
    ).scalar() or 0
    signups_7d = db.query(func.count(models.User.id)).filter(
        models.User.created_at >= week_ago
    ).scalar() or 0
    signups_30d = db.query(func.count(models.User.id)).filter(
        models.User.created_at >= month_ago
    ).scalar() or 0
    total_sessions = db.query(func.count(models.StudySession.id)).scalar() or 0
    total_minutes = db.query(func.coalesce(func.sum(models.StudySession.duration_minutes), 0)).scalar()
    total_animals_hatched = db.query(func.count(models.UserAnimal.id)).scalar() or 0

    donation_row = db.query(
        func.coalesce(func.sum(models.Donation.amount), 0),
        func.count(models.Donation.id),
    ).first()
    total_donated = float(donation_row[0])
    total_donation_count = donation_row[1]

    archived_ids = [u.id for u in db.query(models.User.id).filter(models.User.is_archived == True).all()]
    if archived_ids:
        real_sessions = db.query(func.count(models.StudySession.id)).filter(
            models.StudySession.user_id.notin_(archived_ids)
        ).scalar() or 0
        real_minutes = db.query(func.coalesce(func.sum(models.StudySession.duration_minutes), 0)).filter(
            models.StudySession.user_id.notin_(archived_ids)
        ).scalar()
        real_animals = db.query(func.count(models.UserAnimal.id)).filter(
            models.UserAnimal.user_id.notin_(archived_ids)
        ).scalar() or 0
        real_donation_row = db.query(
            func.coalesce(func.sum(models.Donation.amount), 0),
            func.count(models.Donation.id),
        ).filter(models.Donation.user_id.notin_(archived_ids)).first()
        real_donated = float(real_donation_row[0])
        real_donation_count = real_donation_row[1]
    else:
        real_sessions = total_sessions
        real_minutes = total_minutes
        real_animals = total_animals_hatched
        real_donated = total_donated
        real_donation_count = total_donation_count

    # User funnel (excluding archived users)
    real_users = total_users - archived_users
    funnel_user_filter = models.User.is_archived == False
    verified_users = db.query(func.count(models.User.id)).filter(
        funnel_user_filter, models.User.email_verified == True
    ).scalar() or 0
    if archived_ids:
        started_timer = db.query(func.count(func.distinct(models.StudySession.user_id))).filter(
            models.StudySession.user_id.notin_(archived_ids)
        ).scalar() or 0
        completed_timer = db.query(func.count(func.distinct(models.StudySession.user_id))).filter(
            models.StudySession.duration_minutes > 0,
            models.StudySession.user_id.notin_(archived_ids),
        ).scalar() or 0
        hatched_animal = db.query(func.count(func.distinct(models.UserAnimal.user_id))).filter(
            models.UserAnimal.user_id.notin_(archived_ids)
        ).scalar() or 0
        earned_badge = db.query(func.count(func.distinct(models.UserBadge.user_id))).filter(
            models.UserBadge.user_id.notin_(archived_ids)
        ).scalar() or 0
        added_friend = db.query(func.count(func.distinct(models.Friendship.user_id))).filter(
            models.Friendship.status == "accepted",
            models.Friendship.user_id.notin_(archived_ids),
        ).scalar() or 0
        joined_group = db.query(func.count(func.distinct(models.GroupMember.user_id))).filter(
            models.GroupMember.user_id.notin_(archived_ids)
        ).scalar() or 0
        bought_shop = db.query(func.count(func.distinct(models.UserPurchase.user_id))).filter(
            models.UserPurchase.user_id.notin_(archived_ids)
        ).scalar() or 0
        completed_3_timers = db.query(models.StudySession.user_id).filter(
            models.StudySession.duration_minutes > 0,
            models.StudySession.user_id.notin_(archived_ids),
        ).group_by(models.StudySession.user_id).having(func.count(models.StudySession.id) >= 3).count()
        earned_3_badges = db.query(models.UserBadge.user_id).filter(
            models.UserBadge.user_id.notin_(archived_ids)
        ).group_by(models.UserBadge.user_id).having(func.count(models.UserBadge.id) >= 3).count()
        added_3_friends = db.query(models.Friendship.user_id).filter(
            models.Friendship.status == "accepted",
            models.Friendship.user_id.notin_(archived_ids),
        ).group_by(models.Friendship.user_id).having(func.count(models.Friendship.id) >= 3).count()
    else:
        started_timer = db.query(func.count(func.distinct(models.StudySession.user_id))).scalar() or 0
        completed_timer = db.query(func.count(func.distinct(models.StudySession.user_id))).filter(
            models.StudySession.duration_minutes > 0
        ).scalar() or 0
        hatched_animal = db.query(func.count(func.distinct(models.UserAnimal.user_id))).scalar() or 0
        earned_badge = db.query(func.count(func.distinct(models.UserBadge.user_id))).scalar() or 0
        added_friend = db.query(func.count(func.distinct(models.Friendship.user_id))).filter(
            models.Friendship.status == "accepted"
        ).scalar() or 0
        joined_group = db.query(func.count(func.distinct(models.GroupMember.user_id))).scalar() or 0
        bought_shop = db.query(func.count(func.distinct(models.UserPurchase.user_id))).scalar() or 0
        completed_3_timers = db.query(models.StudySession.user_id).filter(
            models.StudySession.duration_minutes > 0
        ).group_by(models.StudySession.user_id).having(func.count(models.StudySession.id) >= 3).count()
        earned_3_badges = db.query(models.UserBadge.user_id).group_by(
            models.UserBadge.user_id
        ).having(func.count(models.UserBadge.id) >= 3).count()
        added_3_friends = db.query(models.Friendship.user_id).filter(
            models.Friendship.status == "accepted"
        ).group_by(models.Friendship.user_id).having(func.count(models.Friendship.id) >= 3).count()

    # Daily charts starting from April 1
    apr1 = datetime(now.year, 4, 1)
    num_days = (now - apr1).days + 1

    daily_signups = []
    daily_active = []
    daily_sessions = []
    for i in range(num_days):
        day = apr1 + timedelta(days=i)
        start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=1)
        date_str = start.strftime("%Y-%m-%d")

        signups = db.query(func.count(models.User.id)).filter(
            models.User.created_at >= start,
            models.User.created_at < end,
        ).scalar() or 0
        daily_signups.append({"date": date_str, "count": signups})

        dau = db.query(func.count(func.distinct(models.StudySession.user_id))).filter(
            models.StudySession.started_at >= start,
            models.StudySession.started_at < end,
        ).scalar() or 0
        daily_active.append({"date": date_str, "count": dau})

        sessions = db.query(func.count(models.StudySession.id)).filter(
            models.StudySession.started_at >= start,
            models.StudySession.started_at < end,
        ).scalar() or 0
        mins = db.query(func.coalesce(func.sum(models.StudySession.duration_minutes), 0)).filter(
            models.StudySession.started_at >= start,
            models.StudySession.started_at < end,
        ).scalar()
        daily_sessions.append({"date": date_str, "sessions": sessions, "minutes": int(mins)})

    return {
        "total_users": total_users,
        "archived_users": archived_users,
        "real_users": total_users - archived_users,
        "active_users_7d": active_7d,
        "signups_7d": signups_7d,
        "signups_30d": signups_30d,
        "total_sessions": total_sessions,
        "total_study_minutes": int(total_minutes),
        "total_animals_hatched": total_animals_hatched,
        "total_donated": total_donated,
        "total_donation_count": total_donation_count,
        "real_sessions": real_sessions,
        "real_study_minutes": int(real_minutes),
        "real_animals_hatched": real_animals,
        "real_donated": real_donated,
        "real_donation_count": real_donation_count,
        "daily_signups": daily_signups,
        "daily_active": daily_active,
        "daily_sessions": daily_sessions,
        "funnel": {
            "signed_up": real_users,
            "verified_email": verified_users,
            "started_timer": started_timer,
            "completed_timer": completed_timer,
            "completed_3_timers": completed_3_timers,
            "hatched_animal": hatched_animal,
            "earned_badge": earned_badge,
            "added_friend": added_friend,
            "added_3_friends": added_3_friends,
            "joined_group": joined_group,
            "bought_shop": bought_shop,
            "earned_3_badges": earned_3_badges,
        },
    }


@app.get("/public/geography")
def public_geography(db: Session = Depends(get_db)):
    """Public-facing geography summary for the website."""
    country_rows = (
        db.query(models.User.country, func.count(models.User.id))
        .filter(models.User.country.isnot(None), models.User.country != "")
        .group_by(models.User.country)
        .order_by(func.count(models.User.id).desc())
        .all()
    )
    school_rows = (
        db.query(models.User.school, models.User.city, models.User.country)
        .filter(models.User.school.isnot(None), models.User.school != "")
        .distinct()
        .all()
    )
    return {
        "total_countries": len(country_rows),
        "total_schools": len(school_rows),
        "countries": [{"country": r[0], "users": r[1]} for r in country_rows],
        "schools": [{"school": r[0], "city": r[1], "country": r[2]} for r in school_rows],
    }


@app.get("/admin/geography")
def admin_geography(db: Session = Depends(get_db), _=Depends(verify_admin)):
    country_rows = (
        db.query(models.User.country, func.count(models.User.id))
        .filter(models.User.country.isnot(None), models.User.country != "")
        .group_by(models.User.country)
        .order_by(func.count(models.User.id).desc())
        .all()
    )
    countries = [{"country": r[0], "users": r[1]} for r in country_rows]

    school_rows = (
        db.query(
            models.User.school,
            models.User.city,
            models.User.country,
            func.count(models.User.id),
        )
        .filter(models.User.school.isnot(None), models.User.school != "")
        .group_by(models.User.school, models.User.city, models.User.country)
        .order_by(func.count(models.User.id).desc())
        .all()
    )
    schools = [
        {"school": r[0], "city": r[1], "country": r[2], "users": r[3]}
        for r in school_rows
    ]

    total_countries = len(countries)
    total_schools = len(schools)

    return {
        "total_countries": total_countries,
        "total_schools": total_schools,
        "countries": countries,
        "schools": schools,
    }


@app.get("/admin/users")
def admin_users(
    search: Optional[str] = None,
    sort: str = "created_at",
    order: str = "desc",
    limit: int = 1000,
    offset: int = 0,
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    q = db.query(models.User)
    if search:
        pattern = f"%{search}%"
        q = q.filter(
            (models.User.username.ilike(pattern)) | (models.User.email.ilike(pattern))
        )

    ALLOWED_SORT_COLS = {"created_at", "username", "total_study_minutes", "current_streak", "last_study_date"}
    sort_col = getattr(models.User, sort, models.User.created_at) if sort in ALLOWED_SORT_COLS else models.User.created_at
    q = q.order_by(sort_col.desc() if order == "desc" else sort_col.asc())
    total = q.count()
    users = q.offset(offset).limit(limit).all()

    result = []
    for u in users:
        animal_count = db.query(func.count(models.UserAnimal.id)).filter(
            models.UserAnimal.user_id == u.id
        ).scalar() or 0
        donated = db.query(func.coalesce(func.sum(models.Donation.amount), 0)).filter(
            models.Donation.user_id == u.id
        ).scalar()
        result.append({
            "id": u.id,
            "email": u.email,
            "username": u.username,
            "school": u.school,
            "city": u.city,
            "country": u.country,
            "total_study_minutes": u.total_study_minutes or 0,
            "total_sessions": u.total_sessions or 0,
            "current_streak": crud.get_effective_streak(u),
            "longest_streak": u.longest_streak or 0,
            "current_coins": u.current_coins or 0,
            "total_coins": u.total_coins or 0,
            "animals_hatched": animal_count,
            "total_donated": float(donated),
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "last_study_date": u.last_study_date.isoformat() if u.last_study_date else None,
            "is_archived": getattr(u, "is_archived", False) or False,
        })

    return {"total": total, "users": result}


@app.put("/admin/users/{user_id}")
async def admin_update_user(
    user_id: int,
    username: Optional[str] = Form(None),
    total_study_minutes: Optional[int] = Form(None),
    profile_pic: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if username is not None:
        username = username.strip()
        if len(username) < 2 or len(username) > 30:
            raise HTTPException(400, "Username must be 2-30 characters")
        existing = db.query(models.User).filter(
            models.User.username == username, models.User.id != user_id
        ).first()
        if existing:
            raise HTTPException(400, "Username already taken")
        user.username = username

    if total_study_minutes is not None:
        if total_study_minutes < 0:
            raise HTTPException(400, "Study minutes cannot be negative")
        user.total_study_minutes = total_study_minutes

    if profile_pic is not None:
        if profile_pic.content_type not in {"image/png", "image/jpeg", "image/webp", "image/gif"}:
            raise HTTPException(400, "Only PNG, JPEG, WebP, or GIF images allowed")
        data = await profile_pic.read()
        if len(data) > 5 * 1024 * 1024:
            raise HTTPException(400, "File too large (max 5 MB)")
        upload = models.Upload(
            filename=profile_pic.filename or "profile.jpg",
            content_type=profile_pic.content_type,
            data=data,
        )
        db.add(upload)
        db.commit()
        db.refresh(upload)
        base = os.getenv("API_BASE_URL", "https://web-production-34028.up.railway.app")
        user.profile_pic_url = f"{base}/uploads/{upload.public_id}"

    db.commit()
    db.refresh(user)
    return {
        "id": user.id,
        "username": user.username,
        "profile_pic_url": user.profile_pic_url,
        "message": "User updated",
    }


@app.delete("/admin/users/{user_id}")
def admin_archive_user(user_id: int, db: Session = Depends(get_db), _=Depends(verify_admin)):
    """Soft-delete: archives the user so they can't log in, but data is preserved."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_admin:
        raise HTTPException(status_code=400, detail="Cannot archive admin users")
    user.is_archived = True
    user.token_version = (user.token_version or 0) + 1
    db.commit()
    return {"archived": True, "user_id": user_id}


@app.post("/admin/users/{user_id}/reactivate")
def admin_reactivate_user(user_id: int, db: Session = Depends(get_db), _=Depends(verify_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_archived = False
    db.commit()
    return {"reactivated": True, "user_id": user_id}


@app.get("/admin/users/{user_id}")
def admin_user_detail(user_id: int, db: Session = Depends(get_db), _=Depends(verify_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    animals = db.query(models.UserAnimal).filter(models.UserAnimal.user_id == user_id).all()
    animal_list = []
    for ua in animals:
        a = db.query(models.Animal).filter(models.Animal.id == ua.animal_id).first()
        animal_list.append({
            "name": a.name if a else "Unknown",
            "species": a.species if a else "",
            "nickname": ua.nickname,
            "hatched_at": ua.hatched_at.isoformat() if ua.hatched_at else None,
        })

    badges = db.query(models.UserBadge).filter(models.UserBadge.user_id == user_id).all()
    badge_list = [{"badge_id": b.badge_id, "earned_at": b.earned_at.isoformat() if b.earned_at else None} for b in badges]

    sessions = db.query(models.StudySession).filter(
        models.StudySession.user_id == user_id
    ).order_by(models.StudySession.started_at.desc()).limit(20).all()
    session_list = [{
        "id": s.id,
        "duration_minutes": s.duration_minutes,
        "coins_earned": s.coins_earned,
        "subject": s.subject.display_name if s.subject else None,
        "subject_id": s.subject_id,
        "started_at": s.started_at.isoformat() if s.started_at else None,
    } for s in sessions]

    donations = db.query(models.Donation).filter(models.Donation.user_id == user_id).all()
    donation_list = [{
        "amount": d.amount,
        "currency": d.currency,
        "donation_date": d.donation_date,
        "nonprofit_name": d.nonprofit_name,
    } for d in donations]

    email_logs = db.query(models.EmailLog).filter(
        models.EmailLog.user_id == user_id
    ).order_by(models.EmailLog.sent_at.desc()).all()
    email_log_list = [{
        "template_key": el.template_key,
        "subject": el.subject,
        "sent_at": el.sent_at.isoformat() if el.sent_at else None,
        "delivered": el.delivered,
        "opened": el.opened,
        "opened_at": el.opened_at.isoformat() if el.opened_at else None,
        "clicked": el.clicked,
        "clicked_at": el.clicked_at.isoformat() if el.clicked_at else None,
    } for el in email_logs]

    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "profile_pic_url": user.profile_pic_url,
        "school": user.school,
        "city": user.city,
        "country": user.country,
        "total_study_minutes": user.total_study_minutes or 0,
        "total_sessions": user.total_sessions or 0,
        "current_streak": crud.get_effective_streak(user),
        "longest_streak": user.longest_streak or 0,
        "current_coins": user.current_coins or 0,
        "total_coins": user.total_coins or 0,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_study_date": user.last_study_date.isoformat() if user.last_study_date else None,
        "animals": animal_list,
        "badges": badge_list,
        "recent_sessions": session_list,
        "donations": donation_list,
        "email_logs": email_log_list,
        "is_archived": getattr(user, "is_archived", False) or False,
    }


@app.get("/admin/donations")
def admin_donations(
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    total = db.query(func.count(models.Donation.id)).scalar() or 0
    donations = db.query(models.Donation).order_by(
        models.Donation.created_at.desc()
    ).offset(offset).limit(limit).all()

    result = []
    for d in donations:
        username = None
        if d.user_id:
            u = db.query(models.User).filter(models.User.id == d.user_id).first()
            username = u.username or u.email if u else None
        result.append({
            "id": d.id,
            "amount": d.amount,
            "net_amount": d.net_amount,
            "currency": d.currency,
            "frequency": d.frequency,
            "donor_first_name": d.donor_first_name,
            "donor_last_name": d.donor_last_name,
            "donor_email": d.donor_email,
            "nonprofit_name": d.nonprofit_name,
            "donation_date": d.donation_date,
            "linked_user": username,
            "user_id": d.user_id,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        })

    agg = db.query(
        func.coalesce(func.sum(models.Donation.amount), 0),
        func.count(models.Donation.id),
        func.count(func.distinct(models.Donation.user_id)),
    ).first()

    return {
        "total": total,
        "total_raised": float(agg[0]),
        "total_count": agg[1],
        "unique_donors": agg[2],
        "donations": result,
    }


@app.get("/admin/sessions")
def admin_sessions(
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    total = db.query(func.count(models.StudySession.id)).scalar() or 0
    sessions = db.query(models.StudySession).order_by(
        models.StudySession.started_at.desc()
    ).offset(offset).limit(limit).all()

    result = []
    for s in sessions:
        u = db.query(models.User).filter(models.User.id == s.user_id).first()
        result.append({
            "id": s.id,
            "user_id": s.user_id,
            "username": (u.username or u.email) if u else None,
            "duration_minutes": s.duration_minutes,
            "coins_earned": s.coins_earned,
            "subject": s.subject.display_name if s.subject else None,
            "subject_id": s.subject_id,
            "started_at": s.started_at.isoformat() if s.started_at else None,
        })

    return {"total": total, "sessions": result}


@app.get("/admin/activity")
def admin_activity(
    limit: int = 50,
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    events = db.query(models.ActivityEvent).order_by(
        models.ActivityEvent.created_at.desc()
    ).limit(limit).all()

    result = []
    for e in events:
        u = db.query(models.User).filter(models.User.id == e.user_id).first()
        result.append({
            "id": e.id,
            "user_id": e.user_id,
            "username": (u.username or u.email) if u else None,
            "event_type": e.event_type,
            "description": e.description,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        })

    return {"events": result}


class AnimalCreate(BaseModel):
    name: str
    species: Optional[str] = None
    rarity: str = "common"
    conservation_status: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None


class AnimalUpdate(BaseModel):
    name: Optional[str] = None
    species: Optional[str] = None
    rarity: Optional[str] = None
    conservation_status: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None


@app.post("/admin/animals")
def admin_create_animal(body: AnimalCreate, db: Session = Depends(get_db), _=Depends(verify_admin)):
    existing = db.query(models.Animal).filter(models.Animal.name == body.name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Animal '{body.name}' already exists")
    animal = models.Animal(
        name=body.name,
        species=body.species or body.name,
        rarity=body.rarity,
        conservation_status=body.conservation_status,
        description=body.description,
        image_url=body.image_url,
    )
    db.add(animal)
    db.commit()
    db.refresh(animal)
    return {
        "id": animal.id,
        "name": animal.name,
        "species": animal.species,
        "rarity": animal.rarity,
        "conservation_status": animal.conservation_status,
        "description": animal.description,
        "image_url": animal.image_url,
    }


@app.put("/admin/animals/{animal_id}")
def admin_update_animal(
    animal_id: int,
    body: AnimalUpdate,
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    animal = db.query(models.Animal).filter(models.Animal.id == animal_id).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")

    updates = body.dict(exclude_unset=True)
    for field, value in updates.items():
        setattr(animal, field, value)
    db.commit()
    db.refresh(animal)
    return {
        "id": animal.id,
        "name": animal.name,
        "species": animal.species,
        "rarity": animal.rarity,
        "conservation_status": animal.conservation_status,
        "description": animal.description,
        "image_url": animal.image_url,
    }


@app.delete("/admin/animals/{animal_id}")
def admin_delete_animal(animal_id: int, db: Session = Depends(get_db), _=Depends(verify_admin)):
    animal = db.query(models.Animal).filter(models.Animal.id == animal_id).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")
    db.delete(animal)
    db.commit()
    return {"deleted": True, "id": animal_id}


# ============ Image Uploads ============

ALLOWED_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

@app.post("/admin/upload")
async def admin_upload_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"File type {file.content_type} not allowed")
    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(400, "File too large (max 5 MB)")
    upload = models.Upload(
        filename=file.filename or "image.png",
        content_type=file.content_type,
        data=data,
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)
    base = os.getenv("API_BASE_URL", "https://web-production-34028.up.railway.app")
    return {"id": upload.id, "url": f"{base}/uploads/{upload.public_id}"}


@app.get("/uploads/{identifier}")
def serve_upload(identifier: str, db: Session = Depends(get_db)):
    upload = db.query(models.Upload).filter(models.Upload.public_id == identifier).first()
    if not upload:
        try:
            upload = db.query(models.Upload).filter(models.Upload.id == int(identifier)).first()
        except (ValueError, TypeError):
            pass
    if not upload:
        raise HTTPException(404, "Not found")
    return Response(
        content=upload.data,
        media_type=upload.content_type,
        headers={"Cache-Control": "public, max-age=31536000"},
    )


@app.get("/admin/tips")
def admin_tips(
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    total = db.query(func.count(models.StudyTip.id)).scalar() or 0
    tips = db.query(models.StudyTip).order_by(
        models.StudyTip.id.desc()
    ).offset(offset).limit(limit).all()
    result = []
    for t in tips:
        username = None
        if t.user_id:
            u = db.query(models.User).filter(models.User.id == t.user_id).first()
            username = (u.username or u.email) if u else None
        result.append({
            "id": t.id,
            "content": t.content,
            "category": t.category,
            "animal_name": t.animal_name,
            "likes_count": t.likes_count or 0,
            "dislikes_count": t.dislikes_count or 0,
            "author": username,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        })
    return {"total": total, "tips": result}


class TipCreate(BaseModel):
    content: str
    category: str = "general"
    animal_name: Optional[str] = None


class TipUpdate(BaseModel):
    content: Optional[str] = None
    category: Optional[str] = None
    animal_name: Optional[str] = None


@app.post("/admin/tips")
def admin_create_tip(body: TipCreate, db: Session = Depends(get_db), _=Depends(verify_admin)):
    tip = models.StudyTip(
        content=html.escape(body.content),
        category=html.escape(body.category),
        animal_name=html.escape(body.animal_name) if body.animal_name else None,
    )
    db.add(tip)
    db.commit()
    db.refresh(tip)
    return {
        "id": tip.id,
        "content": tip.content,
        "category": tip.category,
        "animal_name": tip.animal_name,
        "likes_count": tip.likes_count or 0,
        "dislikes_count": tip.dislikes_count or 0,
        "author": None,
        "created_at": tip.created_at.isoformat() if tip.created_at else None,
    }


@app.put("/admin/tips/{tip_id}")
def admin_update_tip(tip_id: int, body: TipUpdate, db: Session = Depends(get_db), _=Depends(verify_admin)):
    tip = db.query(models.StudyTip).filter(models.StudyTip.id == tip_id).first()
    if not tip:
        raise HTTPException(status_code=404, detail="Tip not found")
    updates = body.dict(exclude_unset=True)
    for field, value in updates.items():
        setattr(tip, field, value)
    db.commit()
    db.refresh(tip)
    return {"id": tip.id, "content": tip.content, "category": tip.category, "animal_name": tip.animal_name}


@app.delete("/admin/tips/{tip_id}")
def admin_delete_tip(tip_id: int, db: Session = Depends(get_db), _=Depends(verify_admin)):
    tip = db.query(models.StudyTip).filter(models.StudyTip.id == tip_id).first()
    if not tip:
        raise HTTPException(status_code=404, detail="Tip not found")
    db.delete(tip)
    db.commit()
    return {"deleted": True, "id": tip_id}


# ============ Admin Shop Item CRUD ============

@app.get("/admin/shop")
def admin_shop_items(db: Session = Depends(get_db), _=Depends(verify_admin)):
    items = db.query(models.ShopItem).order_by(models.ShopItem.category, models.ShopItem.id).all()
    return {"items": [{
        "id": i.id,
        "item_key": i.item_key,
        "name": i.name,
        "emoji": i.emoji,
        "image_key": i.image_key,
        "description": i.description,
        "price": i.price,
        "category": i.category,
        "rarity": i.rarity,
        "is_active": i.is_active,
    } for i in items]}


class ShopItemCreate(BaseModel):
    item_key: str
    name: str
    emoji: Optional[str] = None
    image_key: Optional[str] = None
    description: Optional[str] = None
    price: int = 0
    category: str = "accessories"
    rarity: str = "common"
    is_active: bool = True


class ShopItemUpdate(BaseModel):
    name: Optional[str] = None
    emoji: Optional[str] = None
    image_key: Optional[str] = None
    description: Optional[str] = None
    price: Optional[int] = None
    category: Optional[str] = None
    rarity: Optional[str] = None
    is_active: Optional[bool] = None


@app.post("/admin/shop")
def admin_create_shop_item(body: ShopItemCreate, db: Session = Depends(get_db), _=Depends(verify_admin)):
    existing = db.query(models.ShopItem).filter(models.ShopItem.item_key == body.item_key).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Item key '{body.item_key}' already exists")
    item = models.ShopItem(**body.dict())
    db.add(item)
    db.commit()
    db.refresh(item)
    return {
        "id": item.id, "item_key": item.item_key, "name": item.name,
        "emoji": item.emoji, "image_key": item.image_key,
        "description": item.description, "price": item.price,
        "category": item.category, "rarity": item.rarity, "is_active": item.is_active,
    }


@app.put("/admin/shop/{item_id}")
def admin_update_shop_item(item_id: int, body: ShopItemUpdate, db: Session = Depends(get_db), _=Depends(verify_admin)):
    item = db.query(models.ShopItem).filter(models.ShopItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Shop item not found")
    for field, value in body.dict(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return {
        "id": item.id, "item_key": item.item_key, "name": item.name,
        "emoji": item.emoji, "image_key": item.image_key,
        "description": item.description, "price": item.price,
        "category": item.category, "rarity": item.rarity, "is_active": item.is_active,
    }


@app.delete("/admin/shop/{item_id}")
def admin_delete_shop_item(item_id: int, db: Session = Depends(get_db), _=Depends(verify_admin)):
    item = db.query(models.ShopItem).filter(models.ShopItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Shop item not found")
    db.delete(item)
    db.commit()
    return {"deleted": True, "id": item_id}


# ── Founding Members Admin ────────────────────────────────────────

@app.get("/admin/founding-members")
def admin_founding_members(db: Session = Depends(get_db), _=Depends(verify_admin)):
    members = db.query(models.UserBadge).filter(models.UserBadge.badge_id == "founding_member").all()
    result = []
    for ub in members:
        user = db.query(models.User).filter(models.User.id == ub.user_id).first()
        if user:
            result.append({
                "id": user.id, "email": user.email, "username": user.username,
                "multiplier": user.eco_credits_multiplier,
                "earned_at": ub.earned_at.isoformat() if ub.earned_at else None,
            })
    total_eligible = db.query(func.count(models.User.id)).filter(models.User.email_verified == True).scalar() or 0
    return {"founding_members": result, "count": len(result), "total_verified_users": total_eligible}


@app.post("/admin/founding-members/grant/{user_id}")
def admin_grant_founding(user_id: int, db: Session = Depends(get_db), _=Depends(verify_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    existing = db.query(models.UserBadge).filter(
        models.UserBadge.user_id == user_id, models.UserBadge.badge_id == "founding_member"
    ).first()
    if existing:
        return {"message": "Already a founding member", "user_id": user_id}
    db.add(models.UserBadge(user_id=user_id, badge_id="founding_member"))
    user.current_coins = (user.current_coins or 0) + 500
    user.total_coins = (user.total_coins or 0) + 500
    user.eco_credits_multiplier = 1.25
    db.commit()
    return {"message": "Founding member granted", "user_id": user_id, "bonus_credits": 500, "multiplier": 1.25}


# ── Email Templates Admin ─────────────────────────────────────────

@app.get("/admin/email-templates")
def admin_get_email_templates(db: Session = Depends(get_db), _=Depends(verify_admin)):
    templates = db.query(models.EmailTemplate).order_by(models.EmailTemplate.id).all()
    result = []
    for t in templates:
        sent = db.query(func.count(models.EmailLog.id)).filter(models.EmailLog.template_key == t.template_key).scalar() or 0
        opened = db.query(func.count(models.EmailLog.id)).filter(models.EmailLog.template_key == t.template_key, models.EmailLog.opened == True).scalar() or 0
        clicked = db.query(func.count(models.EmailLog.id)).filter(models.EmailLog.template_key == t.template_key, models.EmailLog.clicked == True).scalar() or 0
        result.append({
            "id": t.id, "template_key": t.template_key, "name": t.name,
            "subject": t.subject, "body_html": t.body_html,
            "trigger_day": t.trigger_day, "inactive_days": t.inactive_days,
            "is_active": t.is_active,
            "updated_at": t.updated_at.isoformat() if t.updated_at else None,
            "stats": {"sent": sent, "opened": opened, "clicked": clicked,
                      "open_rate": round(opened / sent * 100, 1) if sent else 0,
                      "click_rate": round(clicked / sent * 100, 1) if sent else 0},
        })
    return result


@app.put("/admin/email-templates/{template_key}")
def admin_update_email_template(template_key: str, data: dict, db: Session = Depends(get_db), _=Depends(verify_admin)):
    tmpl = db.query(models.EmailTemplate).filter(models.EmailTemplate.template_key == template_key).first()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    for field in ["subject", "body_html", "name"]:
        if field in data and data[field] is not None:
            setattr(tmpl, field, data[field])
    if "trigger_day" in data:
        tmpl.trigger_day = data["trigger_day"]
    if "inactive_days" in data:
        tmpl.inactive_days = data["inactive_days"]
    if "is_active" in data:
        tmpl.is_active = bool(data["is_active"])
    tmpl.updated_at = datetime.utcnow()
    db.commit()
    return {"template_key": tmpl.template_key, "updated": True}


@app.post("/admin/email-templates/{template_key}/preview")
def admin_preview_email_template(template_key: str, db: Session = Depends(get_db), _=Depends(verify_admin)):
    tmpl = db.query(models.EmailTemplate).filter(models.EmailTemplate.template_key == template_key).first()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    sample = {"name": "Alex", "total_minutes": "247", "animals_count": "5", "streak": "8",
              "longest_streak": "12", "sessions": "18", "badges": "3"}
    rendered_subject = tmpl.subject
    rendered_html = tmpl.body_html
    for key, val in sample.items():
        rendered_subject = rendered_subject.replace("{" + key + "}", val)
        rendered_html = rendered_html.replace("{" + key + "}", val)
    return {"subject": rendered_subject, "body_html": rendered_html}


# ── Email Campaigns ───────────────────────────────────────────────

CAMPAIGN_COHORTS = {
    "verify_email": {
        "label": "Signed up but not verified",
        "template_key": "campaign_verify_email",
    },
    "start_timer": {
        "label": "Verified but never started a timer",
        "template_key": "campaign_start_timer",
    },
    "second_timer": {
        "label": "Only 1 session (encourage session 2)",
        "template_key": "campaign_second_timer",
    },
    "invite_friends": {
        "label": "2+ sessions — invite friends & groups",
        "template_key": "campaign_invite_friends",
    },
}


@app.get("/admin/campaign-cohorts")
def admin_campaign_cohorts(db: Session = Depends(get_db), _=Depends(verify_admin)):
    """Return the 4 campaign cohorts with user counts and lists."""
    archived_filter = or_(models.User.is_archived == False, models.User.is_archived == None)
    cohorts = {}

    # 1) Signed up but email NOT verified
    unverified = db.query(models.User).filter(
        archived_filter,
        models.User.email_verified == False,
        models.User.email.isnot(None),
        models.User.email != "",
    ).all()
    cohorts["verify_email"] = {
        **CAMPAIGN_COHORTS["verify_email"],
        "count": len(unverified),
        "users": [{"id": u.id, "email": u.email, "username": u.username, "created_at": u.created_at.isoformat() if u.created_at else None} for u in unverified],
    }

    # 2) Verified but 0 study sessions
    verified_ids = [u.id for u in db.query(models.User.id).filter(
        archived_filter, models.User.email_verified == True,
        models.User.email.isnot(None), models.User.email != "",
    ).all()]
    if verified_ids:
        users_with_sessions = {r[0] for r in db.query(models.StudySession.user_id).filter(
            models.StudySession.user_id.in_(verified_ids)
        ).distinct().all()}
    else:
        users_with_sessions = set()
    no_timer_ids = [uid for uid in verified_ids if uid not in users_with_sessions]
    no_timer_users = db.query(models.User).filter(models.User.id.in_(no_timer_ids)).all() if no_timer_ids else []
    cohorts["start_timer"] = {
        **CAMPAIGN_COHORTS["start_timer"],
        "count": len(no_timer_users),
        "users": [{"id": u.id, "email": u.email, "username": u.username} for u in no_timer_users],
    }

    # 3) Exactly 1 session
    session_counts = dict(
        db.query(models.StudySession.user_id, func.count(models.StudySession.id))
        .filter(models.StudySession.user_id.in_(verified_ids))
        .group_by(models.StudySession.user_id).all()
    ) if verified_ids else {}
    one_session_ids = [uid for uid, cnt in session_counts.items() if cnt == 1]
    one_session_users = db.query(models.User).filter(models.User.id.in_(one_session_ids)).all() if one_session_ids else []
    cohorts["second_timer"] = {
        **CAMPAIGN_COHORTS["second_timer"],
        "count": len(one_session_users),
        "users": [{"id": u.id, "email": u.email, "username": u.username, "sessions": 1} for u in one_session_users],
    }

    # 4) 2+ sessions
    multi_session_ids = [uid for uid, cnt in session_counts.items() if cnt >= 2]
    multi_session_users = db.query(models.User).filter(models.User.id.in_(multi_session_ids)).all() if multi_session_ids else []
    cohorts["invite_friends"] = {
        **CAMPAIGN_COHORTS["invite_friends"],
        "count": len(multi_session_users),
        "users": [{"id": u.id, "email": u.email, "username": u.username, "sessions": session_counts.get(u.id, 0)} for u in multi_session_users],
    }

    return cohorts


@app.post("/admin/campaign-send/{cohort_key}")
def admin_campaign_send(cohort_key: str, db: Session = Depends(get_db), _=Depends(verify_admin)):
    """Send a campaign email to all users in a cohort. Skips users already sent this template."""
    if cohort_key not in CAMPAIGN_COHORTS:
        raise HTTPException(status_code=400, detail=f"Unknown cohort: {cohort_key}")

    resend_key = os.getenv("RESEND_API_KEY")
    if not resend_key:
        raise HTTPException(status_code=500, detail="RESEND_API_KEY not configured")

    template_key = CAMPAIGN_COHORTS[cohort_key]["template_key"]
    cohorts = admin_campaign_cohorts.__wrapped__(db=db, _=None) if hasattr(admin_campaign_cohorts, '__wrapped__') else None

    # Re-fetch cohort to get users
    archived_filter = or_(models.User.is_archived == False, models.User.is_archived == None)
    if cohort_key == "verify_email":
        users = db.query(models.User).filter(
            archived_filter, models.User.email_verified == False,
            models.User.email.isnot(None), models.User.email != "",
        ).all()
    elif cohort_key == "start_timer":
        verified_ids = [u.id for u in db.query(models.User.id).filter(
            archived_filter, models.User.email_verified == True,
            models.User.email.isnot(None), models.User.email != "",
        ).all()]
        with_sessions = {r[0] for r in db.query(models.StudySession.user_id).filter(
            models.StudySession.user_id.in_(verified_ids)
        ).distinct().all()} if verified_ids else set()
        no_timer_ids = [uid for uid in verified_ids if uid not in with_sessions]
        users = db.query(models.User).filter(models.User.id.in_(no_timer_ids)).all() if no_timer_ids else []
    elif cohort_key == "second_timer":
        verified_ids = [u.id for u in db.query(models.User.id).filter(
            archived_filter, models.User.email_verified == True,
            models.User.email.isnot(None), models.User.email != "",
        ).all()]
        counts = dict(
            db.query(models.StudySession.user_id, func.count(models.StudySession.id))
            .filter(models.StudySession.user_id.in_(verified_ids))
            .group_by(models.StudySession.user_id).all()
        ) if verified_ids else {}
        one_ids = [uid for uid, c in counts.items() if c == 1]
        users = db.query(models.User).filter(models.User.id.in_(one_ids)).all() if one_ids else []
    elif cohort_key == "invite_friends":
        verified_ids = [u.id for u in db.query(models.User.id).filter(
            archived_filter, models.User.email_verified == True,
            models.User.email.isnot(None), models.User.email != "",
        ).all()]
        counts = dict(
            db.query(models.StudySession.user_id, func.count(models.StudySession.id))
            .filter(models.StudySession.user_id.in_(verified_ids))
            .group_by(models.StudySession.user_id).all()
        ) if verified_ids else {}
        multi_ids = [uid for uid, c in counts.items() if c >= 2]
        users = db.query(models.User).filter(models.User.id.in_(multi_ids)).all() if multi_ids else []
    else:
        users = []

    already_sent = {r[0] for r in db.query(models.EmailLog.user_id).filter(
        models.EmailLog.template_key == template_key
    ).all()}

    sent_count = 0
    skipped = 0
    failed = 0
    for user in users:
        if not user.email:
            continue
        if user.id in already_sent:
            skipped += 1
            continue
        name = user.username or "there"
        animals_count = db.query(func.count(models.UserAnimal.id)).filter(models.UserAnimal.user_id == user.id).scalar() or 0
        badges_count = db.query(func.count(models.UserBadge.id)).filter(models.UserBadge.user_id == user.id).scalar() or 0
        variables = {
            "name": name,
            "total_minutes": str(user.total_study_minutes or 0),
            "animals_count": str(animals_count),
            "streak": str(user.current_streak or 0),
            "longest_streak": str(user.longest_streak or 0),
            "sessions": str(user.total_sessions or 0),
            "badges": str(badges_count),
        }
        if _send_template_email(template_key, user.email, variables, db):
            sent_count += 1
        else:
            failed += 1

    return {
        "cohort": cohort_key,
        "template": template_key,
        "total_in_cohort": len(users),
        "sent": sent_count,
        "skipped_already_sent": skipped,
        "failed": failed,
    }


# ── Android Beta Signups ──────────────────────────────────────────

@app.post("/android-beta")
def android_beta_signup(data: dict, db: Session = Depends(get_db)):
    email = (data.get("email") or "").strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email required")
    existing = db.query(models.AndroidBetaSignup).filter(models.AndroidBetaSignup.email == email).first()
    if existing:
        return {"status": "already_registered"}
    signup = models.AndroidBetaSignup(email=email)
    db.add(signup)
    db.commit()
    return {"status": "registered"}


@app.get("/admin/android-beta")
def admin_get_android_beta(db: Session = Depends(get_db), _=Depends(verify_admin)):
    signups = db.query(models.AndroidBetaSignup).order_by(models.AndroidBetaSignup.created_at.desc()).all()
    return [{
        "id": s.id, "email": s.email,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "invited": s.invited,
        "invited_at": s.invited_at.isoformat() if s.invited_at else None,
    } for s in signups]


@app.put("/admin/android-beta/{signup_id}/invite")
def admin_mark_invited(signup_id: int, db: Session = Depends(get_db), _=Depends(verify_admin)):
    signup = db.query(models.AndroidBetaSignup).filter(models.AndroidBetaSignup.id == signup_id).first()
    if not signup:
        raise HTTPException(status_code=404, detail="Signup not found")
    signup.invited = True
    signup.invited_at = datetime.utcnow()
    db.commit()
    _send_android_invite_email(signup.email, db)
    return {"id": signup.id, "invited": True}


def _send_android_invite_email(email: str, db: Session | None = None) -> bool:
    variables = {"name": "there"}
    if db:
        return _send_template_email("android_invite", email, variables, db)
    from database import SessionLocal
    _db = SessionLocal()
    try:
        return _send_template_email("android_invite", email, variables, _db)
    finally:
        _db.close()


# ── Onboarding Lifecycle Emails ───────────────────────────────────

@app.post("/admin/onboarding-emails")
def run_onboarding_emails(db: Session = Depends(get_db), _=Depends(verify_admin)):
    """Trigger onboarding emails for users at key milestones. Run daily via cron."""
    resend_key = os.getenv("RESEND_API_KEY")
    if not resend_key:
        return {"error": "RESEND_API_KEY not set"}

    now = datetime.utcnow()
    sent = {"day3": 0, "day7": 0, "day14": 0, "day30": 0, "reengagement": 0}

    milestone_templates = db.query(models.EmailTemplate).filter(
        models.EmailTemplate.is_active == True,
        models.EmailTemplate.trigger_day.isnot(None),
    ).all()
    reengagement_tmpl = db.query(models.EmailTemplate).filter(
        models.EmailTemplate.template_key == "reengagement",
        models.EmailTemplate.is_active == True,
    ).first()

    if not milestone_templates and not reengagement_tmpl:
        return {"sent": sent, "total_users_checked": 0, "note": "No active templates"}

    milestones = sorted(
        [(t.trigger_day, t.template_key) for t in milestone_templates],
        key=lambda x: x[0],
    )
    inactive_threshold = reengagement_tmpl.inactive_days if reengagement_tmpl else 5

    users = db.query(models.User).filter(
        models.User.email_verified == True,
        or_(models.User.is_archived == False, models.User.is_archived == None),
    ).all()

    for user in users:
        if not user.created_at or not user.email:
            continue
        days_since_signup = (now - user.created_at).days
        last_active_days = (now - user.last_study_date).days if user.last_study_date else None
        name = user.username or "there"
        animals_count = db.query(func.count(models.UserAnimal.id)).filter(
            models.UserAnimal.user_id == user.id
        ).scalar() or 0
        badges_count = db.query(func.count(models.UserBadge.id)).filter(
            models.UserBadge.user_id == user.id
        ).scalar() or 0

        variables = {
            "name": name,
            "total_minutes": str(user.total_study_minutes or 0),
            "animals_count": str(animals_count),
            "streak": str(user.current_streak or 0),
            "longest_streak": str(user.longest_streak or 0),
            "sessions": str(user.total_sessions or 0),
            "badges": str(badges_count),
        }

        sent_keys = {el.template_key for el in db.query(models.EmailLog.template_key).filter(
            models.EmailLog.user_id == user.id
        ).all()}

        try:
            for trigger_day, tkey in milestones:
                if days_since_signup >= trigger_day and tkey not in sent_keys:
                    if _send_template_email(tkey, user.email, variables, db):
                        label = f"day{trigger_day}"
                        if label in sent:
                            sent[label] += 1
                        sent_keys.add(tkey)
                        break  # one milestone email per user per run

            if (reengagement_tmpl and "reengagement" not in sent_keys
                    and last_active_days is not None
                    and last_active_days >= inactive_threshold
                    and days_since_signup > 3):
                if _send_template_email("reengagement", user.email, variables, db):
                    sent["reengagement"] += 1

        except Exception as e:
            logger.error(f"Failed to send onboarding email to {user.email}: {e}")

    return {"sent": sent, "total_users_checked": len(users)}


# Public endpoint so the app can fetch shop items dynamically
@app.get("/shop/items")
def get_shop_items(db: Session = Depends(get_db)):
    items = db.query(models.ShopItem).filter(models.ShopItem.is_active == True).order_by(models.ShopItem.category, models.ShopItem.id).all()
    return [{
        "id": i.item_key,
        "name": i.name,
        "emoji": i.emoji,
        "imageKey": i.image_key,
        "description": i.description,
        "price": i.price,
        "category": i.category,
        "rarity": i.rarity,
    } for i in items]


# ── Country Data Cleanup ─────────────────────────────────────────

COUNTRY_CLEANUP_MAP = {
    "uk": "United Kingdom",
    "UK": "United Kingdom",
    "india": "India",
    "egypt": "Egypt",
    "argentina": "Argentina",
    "armenia": "Armenia",
    "norway": "Norway",
    "italia": "Italy",
    "Srilanka": "Sri Lanka",
    "Sri lanka": "Sri Lanka",
    "sri Lanka": "Sri Lanka",
    "Phillipines": "Philippines",
    "Algria": "Algeria",
    "Aljeria": "Algeria",
    "españa": "Spain",
    "España": "Spain",
    "Việt Nam": "Vietnam",
    "Viet Nam": "Vietnam",
    "viet nam": "Vietnam",
    "Türkiye": "Turkey",
    "türkiye": "Turkey",
    "Казак": "Kazakhstan",
    "UAE": "United Arab Emirates",
    "Kz": "Kazakhstan",
    "Baku": "Azerbaijan",
    "Guayaquil": "Ecuador",
    "Kurdistan": "Iraq",
    "Kalimantan utara": "Indonesia",
    "ub": "Mongolia",
    "Korea, Republic of": "South Korea",
    "Korea": "South Korea",
    "\U0001f1ee\U0001f1f6": "Iraq",
}

COUNTRY_JUNK_VALUES = {"Haha", "blublublu", "cute"}

# PostHog GeoIP backfill: DB user_id → country (for users with blank country)
POSTHOG_GEOIP_BACKFILL = {
    1: "United Kingdom", 2: "United Kingdom", 3: "United Kingdom",
    4: "United Kingdom", 5: "United Kingdom", 6: "United Kingdom",
    7: "United Kingdom", 8: "United States", 9: "United Kingdom",
    14: "United Kingdom", 15: "United Kingdom", 16: "United Kingdom",
    17: "United Kingdom", 18: "United Kingdom", 19: "United Kingdom",
    20: "United Kingdom", 22: "United Kingdom", 23: "Norway",
    24: "Botswana", 25: "Uganda", 26: "Norway", 27: "Uganda",
    28: "Uganda", 29: "United Kingdom", 31: "Mongolia",
    32: "Netherlands", 33: "United Kingdom", 34: "United Kingdom",
    35: "United Kingdom", 37: "United Kingdom", 38: "United Kingdom",
    40: "United Kingdom", 41: "United Kingdom", 42: "United Kingdom",
    43: "United Kingdom", 44: "United Kingdom", 45: "United Kingdom",
    47: "United Kingdom", 48: "United Kingdom", 49: "United Kingdom",
    50: "United Kingdom", 51: "Ireland", 52: "Ireland",
    53: "Belgium", 54: "United Kingdom", 55: "United Kingdom",
    56: "United Kingdom", 58: "Netherlands", 59: "United Kingdom",
    60: "United Kingdom", 62: "United Kingdom", 64: "United Kingdom",
    65: "United Kingdom", 66: "United Kingdom", 67: "Turkey",
    68: "Azerbaijan", 69: "United Kingdom", 70: "Mongolia",
    71: "United Kingdom", 72: "United Kingdom", 73: "Ecuador",
    74: "United Arab Emirates", 75: "Italy", 77: "Mongolia",
    78: "Turkey", 80: "United Kingdom", 81: "Iraq", 82: "Turkey",
    83: "Algeria", 84: "Sri Lanka", 85: "Colombia", 86: "Germany",
    88: "India", 89: "Mongolia", 90: "India", 91: "India",
    92: "India", 93: "France", 94: "Jordan", 95: "Kazakhstan",
    96: "United Kingdom", 98: "United Kingdom", 99: "Algeria",
    100: "Pakistan", 101: "South Korea", 102: "Algeria",
    103: "Algeria", 104: "Sri Lanka", 105: "Oman",
    106: "Israel", 107: "Egypt", 109: "Argentina",
    110: "Argentina", 111: "Mexico", 112: "Nepal",
    115: "Indonesia", 116: "Honduras", 118: "India", 119: "India",
    120: "Kazakhstan", 121: "Sri Lanka", 122: "Philippines",
    123: "United Kingdom", 124: "India", 125: "Indonesia",
    126: "Greece", 127: "India", 128: "Sri Lanka",
    130: "United Kingdom", 132: "Iraq", 134: "Kazakhstan",
    136: "Turkey", 137: "Philippines", 138: "Algeria",
    139: "United Kingdom", 140: "Spain", 141: "Chile",
    142: "Kyrgyzstan", 143: "Mongolia", 144: "Sri Lanka",
    145: "Vietnam", 146: "Vietnam", 147: "Sri Lanka",
    148: "Armenia", 151: "Azerbaijan", 153: "Mongolia",
    154: "Nepal", 155: "Cambodia", 157: "Malaysia",
    158: "Germany", 159: "Sri Lanka", 162: "India",
    163: "India", 164: "Spain", 165: "Spain", 166: "Greece",
    167: "Spain", 168: "India", 169: "Sri Lanka",
    173: "Spain", 174: "Argentina", 175: "Panama",
    177: "Philippines", 178: "Chile", 179: "Nepal",
    180: "India", 181: "Sri Lanka", 182: "Vietnam",
    183: "Pakistan", 184: "Vietnam", 185: "Vietnam",
    186: "Vietnam", 187: "Indonesia", 188: "India", 189: "Armenia",
}


@app.post("/admin/cleanup-countries")
def admin_cleanup_countries(db: Session = Depends(get_db), _=Depends(verify_admin)):
    """Normalize messy country values and backfill blanks from PostHog GeoIP. Safe to run repeatedly."""
    updated = {}

    for old_val, new_val in COUNTRY_CLEANUP_MAP.items():
        count = db.query(models.User).filter(models.User.country == old_val).update(
            {models.User.country: new_val}, synchronize_session="fetch"
        )
        if count:
            updated[f"{old_val} → {new_val}"] = count

    for junk in COUNTRY_JUNK_VALUES:
        count = db.query(models.User).filter(models.User.country == junk).update(
            {models.User.country: None}, synchronize_session="fetch"
        )
        if count:
            updated[f"{junk} → NULL"] = count

    # Backfill blank countries from PostHog GeoIP data (matched by DB user_id)
    backfilled = 0
    blank_users = db.query(models.User).filter(
        (models.User.country.is_(None)) | (models.User.country == "")
    ).all()
    for user in blank_users:
        geo_country = POSTHOG_GEOIP_BACKFILL.get(user.id)
        if geo_country:
            user.country = geo_country
            backfilled += 1
            updated[f"backfill: {user.username or user.id} → {geo_country}"] = 1

    db.commit()

    country_rows = (
        db.query(models.User.country, func.count(models.User.id))
        .filter(models.User.country.isnot(None), models.User.country != "")
        .group_by(models.User.country)
        .order_by(func.count(models.User.id).desc())
        .all()
    )

    return {
        "changes": updated,
        "total_users_updated": sum(v for k, v in updated.items() if not k.startswith("backfill")),
        "total_backfilled": backfilled,
        "current_countries": [{"country": r[0], "users": r[1]} for r in country_rows],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
