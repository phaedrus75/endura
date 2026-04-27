from fastapi import FastAPI, Depends, HTTPException, status, Request, Header, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import text, func, or_
from datetime import timedelta, datetime, date
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
    get_current_user, get_optional_user, ACCESS_TOKEN_EXPIRE_MINUTES
)
from services import push as push_service
import os
import re
import html
import json as _json
import logging
import httpx
from content_filter import contains_profanity

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)


# ── Sentry error tracking ────────────────────────────────────────
# Initialised here (before `app = FastAPI(...)`) so the Starlette/FastAPI
# integration can auto-instrument every route. Set SENTRY_DSN in Railway
# env vars to enable. No-op if the env var is missing (safe for local dev).
_SENTRY_DSN = os.getenv("SENTRY_DSN", "").strip()
if _SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.logging import LoggingIntegration
        sentry_sdk.init(
            dsn=_SENTRY_DSN,
            environment=os.getenv("RAILWAY_ENVIRONMENT") or "local",
            release=os.getenv("RAILWAY_GIT_COMMIT_SHA") or os.getenv("SENTRY_RELEASE") or None,
            send_default_pii=False,  # do NOT ship email/IP to Sentry by default
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.05")),
            profiles_sample_rate=0.0,
            integrations=[
                LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
            ],
            ignore_errors=[
                "RateLimitExceeded",
            ],
        )
        print(f"✅ Sentry initialised (env={os.getenv('RAILWAY_ENVIRONMENT') or 'local'})")
    except Exception as e:
        print(f"⚠️ Sentry init failed (continuing without): {e}")
else:
    print("ℹ️ SENTRY_DSN not set — error tracking disabled")

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
        for _tbl in ["android_beta_signups", "email_templates", "email_logs",
                     "push_templates", "push_logs", "test_runs"]:
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
        # Push notification metadata + per-category prefs (Alembic also handles
        # this; this block is a safety net for envs that haven't run migrations).
        _push_cols = {
            "push_token_updated_at": "TIMESTAMP NULL",
            "push_platform": "VARCHAR(10) NULL",
            "notif_badges_enabled": "BOOLEAN NOT NULL DEFAULT TRUE",
            "notif_friends_enabled": "BOOLEAN NOT NULL DEFAULT TRUE",
            "notif_reminders_enabled": "BOOLEAN NOT NULL DEFAULT TRUE",
            "notif_marketing_enabled": "BOOLEAN NOT NULL DEFAULT TRUE",
        }
        for _col, _ddl in _push_cols.items():
            if _col not in _user_cols:
                with engine.connect() as _conn:
                    _conn.execute(text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {_col} {_ddl}"))
                    _conn.commit()
                print(f"Added {_col} column to users")
        if _insp.has_table("email_templates"):
            _et_cols = [c["name"] for c in _insp.get_columns("email_templates")]
            for _col, _ddl in {"min_sessions": "INTEGER NULL", "max_sessions": "INTEGER NULL", "min_streak": "INTEGER NULL", "max_streak": "INTEGER NULL"}.items():
                if _col not in _et_cols:
                    with engine.connect() as _conn:
                        _conn.execute(text(f"ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS {_col} {_ddl}"))
                        _conn.commit()
                    print(f"Added {_col} column to email_templates")
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
        elif "endura.eco/animals" not in (existing.body_html or ""):
            existing.body_html = _tmpl["body_html"]
            existing.subject = _tmpl["subject"]
    # Keep re-engagement drip thresholds in sync with seeds (does not overwrite body/subject)
    for _tmpl in DEFAULT_EMAIL_TEMPLATES:
        if not str(_tmpl.get("template_key", "")).startswith("reengagement"):
            continue
        ex = _seed_db.query(models.EmailTemplate).filter(
            models.EmailTemplate.template_key == _tmpl["template_key"]
        ).first()
        if ex:
            ex.name = _tmpl["name"]
            ex.inactive_days = _tmpl.get("inactive_days")
            ex.min_sessions = _tmpl.get("min_sessions")
            ex.max_sessions = _tmpl.get("max_sessions")
            ex.min_streak = _tmpl.get("min_streak")
            ex.max_streak = _tmpl.get("max_streak")
    _seed_db.commit()
    # Push notification templates — only insert missing keys so admin edits
    # made via the dashboard are never overwritten on restart.
    try:
        from push_seeds import DEFAULT_PUSH_TEMPLATES
        for _ptmpl in DEFAULT_PUSH_TEMPLATES:
            existing = _seed_db.query(models.PushTemplate).filter(
                models.PushTemplate.template_key == _ptmpl["template_key"]
            ).first()
            if not existing:
                _seed_db.add(models.PushTemplate(**_ptmpl))
        _seed_db.commit()
    except Exception as _e:
        print(f"Warning: Could not seed push templates: {_e}")
    _seed_db.close()
except Exception as e:
    print(f"Warning: Could not seed startup data: {e}")

app = FastAPI(title="Endura API", description="Gamified Study App Backend")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


def _match_reengagement(templates, user, last_active_days, sent_keys):
    """Pick the best re-engagement template for a user based on session/streak filters."""
    user_sessions = user.total_sessions or 0
    user_streak = user.longest_streak or 0
    best = None
    for t in templates:
        if t.template_key in sent_keys:
            continue
        if last_active_days < (t.inactive_days or 5):
            continue
        if t.min_sessions is not None and user_sessions < t.min_sessions:
            continue
        if t.max_sessions is not None and user_sessions > t.max_sessions:
            continue
        if t.min_streak is not None and user_streak < t.min_streak:
            continue
        if t.max_streak is not None and user_streak > t.max_streak:
            continue
        # Pick the next unsent drop: lowest inactive_days among all matching tiers
        if best is None or (t.inactive_days or 0) < (best.inactive_days or 0):
            best = t
    return best


def _cron_run_onboarding_emails():
    """Background job: send onboarding lifecycle emails daily."""
    import time
    from database import SessionLocal
    import resend.exceptions as _resend_exc
    _db = SessionLocal()
    try:
        resend_key = os.getenv("RESEND_API_KEY")
        if not resend_key:
            logger.warning("Cron: RESEND_API_KEY not set, skipping onboarding emails")
            return

        # Safety ceiling — prevents a bug from burning through your monthly quota
        # in one runaway cron. On paid plans set DAILY_EMAIL_CAP to a high value
        # or leave unset (defaults to 10 000, well above any realistic daily send).
        daily_cap = int(os.getenv("DAILY_EMAIL_CAP", "10000"))

        # Throttle: Resend allows 5 req/s. We send at ~3/s (0.35s gap) to stay
        # well clear of the per-second limit even under jitter.
        send_interval = float(os.getenv("EMAIL_SEND_INTERVAL", "0.35"))

        now = datetime.utcnow()
        sent = {"day3": 0, "day7": 0, "day14": 0, "day30": 0, "reengagement": 0}
        total_sent = 0

        milestone_templates = _db.query(models.EmailTemplate).filter(
            models.EmailTemplate.is_active == True,
            models.EmailTemplate.trigger_day.isnot(None),
        ).all()
        reengagement_templates = _db.query(models.EmailTemplate).filter(
            models.EmailTemplate.is_active == True,
            models.EmailTemplate.inactive_days.isnot(None),
        ).order_by(models.EmailTemplate.id).all()
        if not milestone_templates and not reengagement_templates:
            return

        milestones = sorted(
            [(t.trigger_day, t.template_key) for t in milestone_templates],
            key=lambda x: x[0],
        )

        users = _db.query(models.User).filter(
            models.User.email_verified == True,
            or_(models.User.is_archived == False, models.User.is_archived == None),
        ).all()
        for user in users:
            if total_sent >= daily_cap:
                logger.warning(
                    f"Cron: daily email cap ({daily_cap}) reached after {total_sent} sends "
                    f"— stopping early ({len(users) - users.index(user)} users skipped)."
                )
                break

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
                            total_sent += 1
                            sent_keys.add(tkey)
                            time.sleep(send_interval)
                            break
                if (reengagement_templates and last_active_days is not None and days_since_signup > 3):
                    matched = _match_reengagement(reengagement_templates, user, last_active_days, sent_keys)
                    if matched:
                        if _send_template_email(matched.template_key, user.email, variables, _db):
                            sent["reengagement"] += 1
                            total_sent += 1
                            time.sleep(send_interval)
            except _resend_exc.RateLimitError:
                # Resend daily quota exhausted — stop the whole batch immediately.
                # Log as warning (not error) so Sentry isn't spammed.
                logger.warning(
                    f"Cron: Resend RateLimitError after {total_sent} sends today. "
                    "Stopping batch. Consider raising DAILY_EMAIL_CAP or upgrading Resend plan."
                )
                break
            except Exception as e:
                logger.error(f"Cron: Failed to send onboarding email to {user.email}: {e}")
        logger.info(f"Cron: Onboarding emails sent: {sent} (total={total_sent}), users checked: {len(users)}")
    except Exception as e:
        logger.error(f"Cron: Error running onboarding emails: {e}", exc_info=True)
    finally:
        _db.close()


def _cron_sync_app_ranks():
    """Twice daily — fetches recent ranks from AppFigures and upserts.

    Records the result in _appfigures_state so /admin/appfigures-debug can
    show the user when the cron last ran and what it did.
    """
    started_at = datetime.utcnow()
    _appfigures_state["last_cron_started_at"] = started_at.isoformat()
    if not os.environ.get("APPFIGURES_PAT", "").strip():
        msg = "APPFIGURES_PAT not set, skipping"
        logger.info(f"Cron app_ranks: {msg}")
        _appfigures_state["last_cron_finished_at"] = datetime.utcnow().isoformat()
        _appfigures_state["last_cron_result"] = {"status": "skipped", "reason": msg}
        return
    from database import SessionLocal
    _db = SessionLocal()
    try:
        today = datetime.utcnow().date()
        result = _sync_app_ranks(today - timedelta(days=2), today, _db)
        logger.info(f"Cron app_ranks: {result}")
        _appfigures_state["last_cron_finished_at"] = datetime.utcnow().isoformat()
        _appfigures_state["last_cron_result"] = {"status": "ok", **(result if isinstance(result, dict) else {"raw": str(result)})}
    except Exception as e:
        logger.error(f"Cron app_ranks: failed: {e}", exc_info=True)
        _appfigures_state["last_cron_finished_at"] = datetime.utcnow().isoformat()
        _appfigures_state["last_cron_result"] = {"status": "error", "error": str(e)}
    finally:
        _db.close()


@app.on_event("startup")
def start_scheduler():
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        # Defaults applied to every job:
        #   misfire_grace_time=3600 → if the container was restarting at the
        #     scheduled minute (Railway redeploy etc.), the job still fires as
        #     soon as APScheduler is back online, up to 1h late.
        #   coalesce=True           → if multiple runs were missed (e.g. long
        #     downtime), collapse them into a single run on recovery.
        scheduler = BackgroundScheduler(
            job_defaults={"misfire_grace_time": 3600, "coalesce": True},
        )
        scheduler.add_job(_cron_run_onboarding_emails, "cron", hour=8, minute=0, id="onboarding_emails")
        # AppFigures sync runs twice daily (04:00 + 16:00 UTC).
        # AppFigures publishes daily snapshots end-of-day, but the second run
        # catches any late updates or recovers if the morning run was missed
        # (e.g. Railway deploy at the wrong minute).
        scheduler.add_job(_cron_sync_app_ranks, "cron", hour=4, minute=0, id="sync_app_ranks_am")
        scheduler.add_job(_cron_sync_app_ranks, "cron", hour=16, minute=0, id="sync_app_ranks_pm")
        # Lifecycle push notifications run a couple hours after the email cron
        # so users on both channels don't get hit with two notifications at the
        # exact same minute. Push at 10:00 UTC = early morning in LATAM, lunchtime
        # in Europe, evening in Asia — covers the bulk of the user base.
        scheduler.add_job(_cron_lifecycle_pushes, "cron", hour=10, minute=0, id="lifecycle_pushes")
        scheduler.start()
        print("✅ Scheduler started: onboarding emails 08:00 UTC, lifecycle pushes 10:00 UTC, app_ranks sync 04:00 + 16:00 UTC (misfire_grace=1h)")
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

API_VERSION = "1.0.52"
_STARTUP_TS = datetime.utcnow()


@app.get("/")
def health_check():
    return {
        "status": "healthy",
        "app": "Endura API",
        "version": API_VERSION,
    }


@app.get("/health")
def health(db: Session = Depends(get_db)):
    """
    Deep health check used by uptime monitors (BetterStack / UptimeRobot).

    Returns 200 only if the process is up AND the DB is reachable.
    Uptime monitors should alert when this endpoint is non-200 for 2+
    consecutive checks. Shape is intentionally small (<1KB) to keep the
    monitor's bandwidth cost low.
    """
    db_ok = False
    db_latency_ms: Optional[int] = None
    db_error: Optional[str] = None
    try:
        t0 = datetime.utcnow()
        db.execute(text("SELECT 1"))
        db_latency_ms = int((datetime.utcnow() - t0).total_seconds() * 1000)
        db_ok = True
    except Exception as e:
        db_error = str(e)[:200]

    uptime_seconds = int((datetime.utcnow() - _STARTUP_TS).total_seconds())
    status_ok = db_ok
    payload = {
        "status": "ok" if status_ok else "degraded",
        "version": API_VERSION,
        "uptime_seconds": uptime_seconds,
        "db": {
            "ok": db_ok,
            "latency_ms": db_latency_ms,
            "error": db_error,
        },
        "env": os.getenv("RAILWAY_ENVIRONMENT") or "local",
    }
    if not status_ok:
        return JSONResponse(status_code=503, content=payload)
    return payload


# ── Resend Webhook (open/click tracking) ─────────────────────────

@app.post("/webhooks/resend")
async def resend_webhook(request: Request, db: Session = Depends(get_db)):
    """Receive Resend webhook events for email delivery, open, click, bounce, and complaint tracking.

    Resend signs every webhook payload using Svix. When RESEND_WEBHOOK_SECRET is
    set, the signature is verified and any tampered/replayed payload returns 400.
    In development (no secret set) verification is skipped so local testing works.
    """
    webhook_secret = os.getenv("RESEND_WEBHOOK_SECRET", "")
    body = await request.body()

    if webhook_secret:
        try:
            from svix.webhooks import Webhook, WebhookVerificationError
            wh = Webhook(webhook_secret)
            wh.verify(body, dict(request.headers))
        except Exception as exc:
            logger.warning(f"Resend webhook signature verification failed: {exc}")
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        data = _json.loads(body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    event_type = data.get("type", "")
    event_data = data.get("data", {})
    email_id = event_data.get("email_id")

    logger.info(f"Resend webhook: type={event_type} email_id={email_id}")

    if not email_id:
        return {"ok": True}

    log = db.query(models.EmailLog).filter(models.EmailLog.resend_message_id == email_id).first()

    now = datetime.utcnow()

    if event_type == "email.delivered":
        if log:
            log.delivered = True
    elif event_type == "email.opened":
        if log:
            log.opened = True
            if not log.opened_at:
                log.opened_at = now
    elif event_type == "email.clicked":
        if log:
            log.clicked = True
            if not log.clicked_at:
                log.clicked_at = now
    elif event_type in ("email.bounced", "email.complained"):
        # Mark the log row and suppress future sends to this address.
        if log:
            if event_type == "email.bounced":
                log.bounced = True
            else:
                log.complained = True
        # Suppress: clear the email from all users with this address so the
        # cron never tries to send to them again.
        to_addrs = event_data.get("to", [])
        if isinstance(to_addrs, str):
            to_addrs = [to_addrs]
        for addr in to_addrs:
            addr = addr.strip().lower()
            if addr:
                logger.warning(f"Resend {event_type}: suppressing {addr}")
                (db.query(models.User)
                   .filter(func.lower(models.User.email) == addr)
                   .update({"is_archived": True}, synchronize_session=False))

    if log:
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
        elif existing_tips > 0:
            print(f"[STARTUP] Found {existing_tips} tips (partial seed), adding missing ones only")
            existing_contents = {t.content for t in db.query(models.StudyTip.content).all()}
            added = 0
            for tip_data in tips:
                if tip_data["content"] not in existing_contents:
                    db.add(models.StudyTip(**tip_data))
                    added += 1
            db.commit()
            print(f"[STARTUP] Added {added} new tips (preserved existing tip_views)")
        else:
            print(f"[STARTUP] No tips found, seeding {len(tip_texts)} tips")
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
        _send_email_bg(_send_verification_email, db_user.email, code)
        return {"message": "Verification code sent", "needs_verification": True}

    hashed_password = get_password_hash(user.password)
    new_user = crud.create_user(db, user.email, hashed_password)

    code = f"{secrets.randbelow(1000000):06d}"
    new_user.verification_code = code
    new_user.verification_code_expires = datetime.utcnow() + timedelta(minutes=15)
    new_user.email_verified = False
    db.commit()

    _send_email_bg(_send_verification_email, new_user.email, code)
    return {"message": "Verification code sent", "needs_verification": True}


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

    _send_email_bg(_send_verification_email, user.email, code)
    return {"message": "Verification code sent"}


def _send_email_bg(fn, *args, **kwargs) -> None:
    """Fire an email-sending function in a daemon thread.

    The user record is always committed before this is called, so the
    background send has no DB writes and is safe to run after the response
    is returned. If it fails, the error is logged and the user can request
    a resend — the endpoint is not held waiting on Resend's API.
    """
    import threading
    t = threading.Thread(target=fn, args=args, kwargs=kwargs, daemon=True)
    t.start()


def _send_verification_email(email: str, code: str) -> bool:
    resend_key = os.getenv("RESEND_API_KEY")
    resend_from = os.getenv("RESEND_FROM", "Endura <onboarding@resend.dev>")
    logger.info(f"Sending verification to {email}, RESEND_API_KEY set: {bool(resend_key)}, from: {resend_from}")

    if resend_key:
        try:
            import resend
            from resend.http_client_requests import RequestsClient
            resend.api_key = resend_key
            resend.default_http_client = RequestsClient(timeout=8)
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
    import time
    import resend.exceptions as _resend_exc
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
        # Retry up to 3 times on per-second rate limit with exponential backoff.
        for attempt in range(3):
            try:
                result = resend.Emails.send({
                    "from": resend_from, "to": [to_email], "subject": subject, "html": body,
                })
                break
            except _resend_exc.RateLimitError as rle:
                if attempt == 2:
                    raise  # exhausted retries — propagate so cron can abort
                wait = 1.0 * (attempt + 1)
                logger.warning(
                    f"Resend per-second rate limit hit for '{template_key}' → {to_email}. "
                    f"Retrying in {wait}s (attempt {attempt + 1}/3)"
                )
                time.sleep(wait)
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
    except _resend_exc.RateLimitError:
        # Re-raise so callers (the cron) can abort the whole batch cleanly.
        raise
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
def get_me(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Run badge check on every app open so newly-eligible badges (notably
    # Founding Member, which uses a ≥2 completed sessions rule) land without
    # waiting for the user to open the Badges screen or complete another
    # session. Idempotent — returns early for badges already granted.
    try:
        crud.check_badges(db, current_user.id)
        db.refresh(current_user)
    except Exception as e:
        print(f"⚠️ check_badges in /auth/me failed for user {current_user.id}: {e}")
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
    """Hard-delete the user and every row that depends on them.

    Policy by table:
      - SET NULL: rows with value beyond the user (community catalog,
        moderation history, email audit log, sharing relationships).
      - HARD DELETE: anything user-owned or two-party content that
        can't survive without the user (their sessions, badges, blocks,
        co-hatched eggs, pacts, etc).

    Wrapped in try/except so any future missing FK surfaces as a clean
    500 with detail rather than a raw psycopg2 error in Sentry.
    """
    user_id = current_user.id
    try:
        # ── 1. SET NULL — preserve the row, drop the back-reference ──
        db.query(models.Subject).filter(
            models.Subject.created_by_user_id == user_id
        ).update({models.Subject.created_by_user_id: None}, synchronize_session=False)
        db.query(models.UserAnimal).filter(
            models.UserAnimal.shared_with_user_id == user_id
        ).update({models.UserAnimal.shared_with_user_id: None}, synchronize_session=False)
        db.query(models.ContentReport).filter(
            models.ContentReport.reporter_id == user_id
        ).update({models.ContentReport.reporter_id: None}, synchronize_session=False)
        db.query(models.ContentReport).filter(
            models.ContentReport.reported_user_id == user_id
        ).update({models.ContentReport.reported_user_id: None}, synchronize_session=False)
        db.query(models.EmailLog).filter(
            models.EmailLog.user_id == user_id
        ).update({models.EmailLog.user_id: None}, synchronize_session=False)

        # ── 2. Two-party content (delete entirely; FKs in both directions) ──
        db.query(models.SharedEgg).filter(
            (models.SharedEgg.creator_id == user_id) | (models.SharedEgg.partner_id == user_id)
        ).delete(synchronize_session=False)
        db.query(models.UserBlock).filter(
            (models.UserBlock.blocker_id == user_id) | (models.UserBlock.blocked_id == user_id)
        ).delete(synchronize_session=False)
        db.query(models.Friendship).filter(
            (models.Friendship.user_id == user_id) | (models.Friendship.friend_id == user_id)
        ).delete(synchronize_session=False)

        # ── 3. Orphan tables with no Python model (legacy pacts feature) ──
        db.execute(
            text("DELETE FROM pact_days WHERE user_id = :uid OR pact_id IN "
                 "(SELECT id FROM study_pacts WHERE creator_id = :uid OR buddy_id = :uid)"),
            {"uid": user_id},
        )
        db.execute(
            text("DELETE FROM study_pacts WHERE creator_id = :uid OR buddy_id = :uid"),
            {"uid": user_id},
        )

        # ── 4. Owned groups (cascade their messages + members first) ──
        owned_groups = db.query(models.StudyGroup).filter(
            models.StudyGroup.creator_id == user_id
        ).all()
        for group in owned_groups:
            db.query(models.GroupMessage).filter(models.GroupMessage.group_id == group.id).delete(synchronize_session=False)
            db.query(models.GroupMember).filter(models.GroupMember.group_id == group.id).delete(synchronize_session=False)
            db.delete(group)

        # ── 5. Hard-delete user-owned data ──
        db.query(models.GroupMessage).filter(models.GroupMessage.user_id == user_id).delete(synchronize_session=False)
        db.query(models.GroupMember).filter(models.GroupMember.user_id == user_id).delete(synchronize_session=False)
        db.query(models.FeedReaction).filter(models.FeedReaction.user_id == user_id).delete(synchronize_session=False)
        db.query(models.ActivityEvent).filter(models.ActivityEvent.user_id == user_id).delete(synchronize_session=False)
        db.query(models.Donation).filter(models.Donation.user_id == user_id).delete(synchronize_session=False)
        db.query(models.TipView).filter(models.TipView.user_id == user_id).delete(synchronize_session=False)
        db.query(models.UserBadge).filter(models.UserBadge.user_id == user_id).delete(synchronize_session=False)
        db.query(models.UserAnimal).filter(models.UserAnimal.user_id == user_id).delete(synchronize_session=False)
        db.query(models.StudySession).filter(models.StudySession.user_id == user_id).delete(synchronize_session=False)
        db.query(models.Task).filter(models.Task.user_id == user_id).delete(synchronize_session=False)
        db.query(models.Egg).filter(models.Egg.user_id == user_id).delete(synchronize_session=False)
        db.query(models.StudyTip).filter(models.StudyTip.user_id == user_id).delete(synchronize_session=False)
        db.query(models.UserSubject).filter(models.UserSubject.user_id == user_id).delete(synchronize_session=False)
        db.query(models.UserPurchase).filter(models.UserPurchase.user_id == user_id).delete(synchronize_session=False)
        db.query(models.UserItemAssignment).filter(models.UserItemAssignment.user_id == user_id).delete(synchronize_session=False)
        # feedback_upvotes auto-cascades; user_feedback auto-SET-NULLs (DB-level)

        # ── 6. The user themselves ──
        db.query(models.User).filter(models.User.id == user_id).delete(synchronize_session=False)
        db.commit()
        return {"message": "Account deleted successfully"}
    except Exception as e:
        db.rollback()
        print(f"❌ delete_account failed for user {user_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Account deletion failed: {type(e).__name__}. Support has been notified.",
        )


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

    _send_email_bg(_send_reset_email, body.email, code)
    return {"message": "If that email exists, a reset code has been sent."}


def _send_reset_email(email: str, code: str) -> bool:
    resend_key = os.getenv("RESEND_API_KEY")
    resend_from = os.getenv("RESEND_FROM", "Endura <onboarding@resend.dev>")
    logger.info(f"RESEND_API_KEY present: {bool(resend_key)}, length: {len(resend_key) if resend_key else 0}")
    if not resend_key:
        logger.warning("RESEND_API_KEY not set — reset email could not be sent")
        return False
    try:
        import resend
        from resend.http_client_requests import RequestsClient
        resend.api_key = resend_key
        resend.default_http_client = RequestsClient(timeout=8)
        resend.Emails.send({
            "from": resend_from,
            "to": [email],
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
        logger.info(f"Reset code sent to {email} via Resend")
        return True
    except Exception as e:
        logger.error(f"Failed to send reset email via Resend: {e}")
        return False


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
        # Push notify on badge earned (one push per session, even if multiple
        # badges earned simultaneously — pick the first to avoid spam).
        try:
            if new_badges:
                first_badge = new_badges[0]
                badge_def = crud.BADGE_MAP.get(first_badge) or {}
                _safe_send_push(
                    "push_badge_earned", current_user, db,
                    extra_vars={
                        "badge_name": badge_def.get("name", "a new badge"),
                        "badge_emoji": badge_def.get("emoji", "🏅"),
                    },
                )
        except Exception as _e:
            logger.error(f"Badge push hook failed: {_e}")
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
    saved_ids = {v.tip_id for v in tip_views if getattr(v, 'saved', False)}

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
            "user_saved": tip.id in saved_ids,
        }
        result.append(tip_dict)
    return result


@app.get("/tips/saved", response_model=List[schemas.StudyTipResponse])
def get_saved_tips(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """All tips this user has saved, regardless of whether they're in the current feed batch."""
    saved_views = db.query(models.TipView).filter(
        models.TipView.user_id == current_user.id,
        models.TipView.saved == True,
    ).order_by(models.TipView.saved_at.desc().nullslast()).all()
    if not saved_views:
        return []
    tip_ids = [v.tip_id for v in saved_views]
    tips = db.query(models.StudyTip).filter(models.StudyTip.id.in_(tip_ids)).all()
    by_id = {t.id: t for t in tips}
    liked_ids = {v.tip_id for v in saved_views if v.liked}
    disliked_ids = {v.tip_id for v in saved_views if getattr(v, 'disliked', False)}
    result = []
    for v in saved_views:
        tip = by_id.get(v.tip_id)
        if not tip:
            continue
        result.append({
            "id": tip.id,
            "content": tip.content,
            "category": tip.category,
            "animal_name": getattr(tip, 'animal_name', None),
            "likes_count": tip.likes_count,
            "dislikes_count": getattr(tip, 'dislikes_count', 0),
            "created_at": tip.created_at,
            "user_liked": tip.id in liked_ids,
            "user_disliked": tip.id in disliked_ids,
            "user_saved": True,
        })
    return result


@app.post("/tips/{tip_id}/save")
def save_tip(
    tip_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a tip as saved by the current user. Idempotent."""
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
    if not view.saved:
        view.saved = True
        view.saved_at = datetime.utcnow()
    db.commit()
    return {"saved": True, "tip_id": tip_id}


@app.post("/tips/{tip_id}/unsave")
def unsave_tip(
    tip_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Unmark a tip as saved by the current user. Idempotent."""
    view = db.query(models.TipView).filter(
        models.TipView.user_id == current_user.id,
        models.TipView.tip_id == tip_id,
    ).first()
    if view and view.saved:
        view.saved = False
        db.commit()
    return {"saved": False, "tip_id": tip_id}


class TipSyncSavesBody(BaseModel):
    tip_ids: List[int] = Field(default_factory=list, max_items=2000)


@app.post("/tips/sync-saves")
def sync_tip_saves(
    body: TipSyncSavesBody,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Bulk-mark a list of tips as saved by the current user. For one-shot AsyncStorage→DB
    migration on first launch after the saves-go-server-side update. Idempotent: already-saved
    rows are left alone; missing TipView rows are created with saved=True.
    """
    if not body.tip_ids:
        return {"created": 0, "updated": 0, "skipped": 0}

    valid_ids = {
        t.id for t in db.query(models.StudyTip.id).filter(
            models.StudyTip.id.in_(body.tip_ids)
        ).all()
    }
    requested = [tid for tid in body.tip_ids if tid in valid_ids]
    if not requested:
        return {"created": 0, "updated": 0, "skipped": len(body.tip_ids)}

    existing = db.query(models.TipView).filter(
        models.TipView.user_id == current_user.id,
        models.TipView.tip_id.in_(requested),
    ).all()
    existing_by_tip = {v.tip_id: v for v in existing}

    now = datetime.utcnow()
    created = updated = skipped = 0
    for tid in requested:
        view = existing_by_tip.get(tid)
        if view is None:
            db.add(models.TipView(
                user_id=current_user.id,
                tip_id=tid,
                saved=True,
                saved_at=now,
            ))
            created += 1
        elif not view.saved:
            view.saved = True
            view.saved_at = now
            updated += 1
        else:
            skipped += 1
    skipped += len(body.tip_ids) - len(requested)
    db.commit()
    return {"created": created, "updated": updated, "skipped": skipped}


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
    # Notify the recipient. Look up the friend by username (CRUD just resolved
    # them too; tiny extra query here keeps the hook decoupled from the CRUD
    # internals).
    try:
        recipient = db.query(models.User).filter(
            models.User.username == request.friend_username
        ).first()
        if recipient and recipient.id != current_user.id:
            _safe_send_push(
                "push_friend_request", recipient, db,
                extra_vars={"from_name": current_user.username or "Someone"},
            )
    except Exception as _e:
        logger.error(f"Friend request push hook failed: {_e}")
    return {"message": message}


@app.post("/friends/accept/{request_id}")
def accept_friend(
    request_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not crud.accept_friend_request(db, current_user.id, request_id):
        raise HTTPException(status_code=404, detail="Friend request not found")
    # Notify the original requester that their request was accepted.
    try:
        friendship = db.query(models.Friendship).filter(
            models.Friendship.id == request_id
        ).first()
        if friendship and friendship.user_id != current_user.id:
            requester = db.query(models.User).filter(
                models.User.id == friendship.user_id
            ).first()
            if requester:
                _safe_send_push(
                    "push_friend_accepted", requester, db,
                    extra_vars={"from_name": current_user.username or "Your friend"},
                )
    except Exception as _e:
        logger.error(f"Friend accept push hook failed: {_e}")
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
    from sqlalchemy.exc import IntegrityError

    # Deduplicate by item_id — last position for a given item wins.
    seen: dict = {}
    for a in req.assignments:
        seen[a.itemId] = a
    deduped = list(seen.values())

    try:
        db.query(models.UserItemAssignment).filter(
            models.UserItemAssignment.user_id == current_user.id
        ).delete()
        for a in deduped:
            db.add(models.UserItemAssignment(
                user_id=current_user.id,
                item_id=a.itemId,
                x=a.x,
                y=a.y,
                page=a.page,
            ))
        db.commit()
    except IntegrityError:
        db.rollback()
        # A concurrent save already wrote the same rows — re-read and overwrite.
        db.query(models.UserItemAssignment).filter(
            models.UserItemAssignment.user_id == current_user.id
        ).delete()
        for a in deduped:
            db.add(models.UserItemAssignment(
                user_id=current_user.id,
                item_id=a.itemId,
                x=a.x,
                y=a.y,
                page=a.page,
            ))
        db.commit()
    return {"saved": len(deduped)}


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
        # Hot endpoint: every authed app polls this on a timer. Optimised to
        # short-circuit aggressively so the 99% no-op case is one cheap query.
        # 1) No friends → nobody can react → bail out.
        has_friend = db.query(models.Friendship.id).filter(
            models.Friendship.status == "accepted",
            (models.Friendship.user_id == current_user.id)
            | (models.Friendship.friend_id == current_user.id),
        ).first()
        if not has_friend:
            return []
        # 2) Only consider events from the last 30 days. Reactions on older
        # activity are not surfaced as "new" overlays anyway.
        cutoff = datetime.utcnow() - timedelta(days=30)
        my_events = db.query(models.ActivityEvent).filter(
            models.ActivityEvent.user_id == current_user.id,
            models.ActivityEvent.created_at >= cutoff,
        ).all()
        event_ids = [e.id for e in my_events]
        if not event_ids:
            return []
        unseen = db.query(models.FeedReaction).filter(
            models.FeedReaction.event_id.in_(event_ids),
            models.FeedReaction.user_id != current_user.id,
            (models.FeedReaction.seen == False) | (models.FeedReaction.seen == None)
        ).all()
        if not unseen:
            return []

        # Batch-fetch all reaction senders in one query (eliminates N+1).
        sender_ids = list({r.user_id for r in unseen})
        senders_by_id = {
            u.id: u
            for u in db.query(models.User).filter(models.User.id.in_(sender_ids)).all()
        }
        events_by_id = {e.id: e for e in my_events}

        results = []
        for r in unseen:
            sender = senders_by_id.get(r.user_id)
            event = events_by_id.get(r.event_id)
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

    # Push the event owner so they don't have to poll. Best-effort, never blocks.
    # Throttle: at most one push per (event, sender) every 30 min so swapping the
    # emoji several times doesn't spam the recipient.
    try:
        event = db.query(models.ActivityEvent).filter(
            models.ActivityEvent.id == event_id
        ).first()
        if event and event.user_id != current_user.id:
            owner = db.query(models.User).filter(models.User.id == event.user_id).first()
            if owner and owner.push_token:
                cutoff = datetime.utcnow() - timedelta(minutes=30)
                recent = db.query(models.PushLog.id).filter(
                    models.PushLog.user_id == owner.id,
                    models.PushLog.template_key == "push_friend_reacted",
                    models.PushLog.sent_at >= cutoff,
                    # Same sender + same event encoded into the body.
                    models.PushLog.body.like(f"%{current_user.username or ''}%"),
                    models.PushLog.body.like(f"%{(event.description or '')[:40]}%"),
                ).first()
                if not recent:
                    emoji_map = {"nice": "👏", "fire": "🔥", "heart": "❤️"}
                    msg_map = {
                        "nice": "thinks you did great on",
                        "fire": "thinks you're on fire on",
                        "heart": "loved your",
                    }
                    _safe_send_push(
                        "push_friend_reacted", owner, db,
                        extra_vars={
                            "from_name": current_user.username or "A friend",
                            "emoji": emoji_map.get(data.reaction, "💫"),
                            "message": msg_map.get(data.reaction, "reacted to"),
                            "event_description": (event.description or "your activity")[:60],
                        },
                    )
    except Exception as _e:
        logger.error(f"Reaction push hook failed: {_e}")
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
            # Send a thank-you push if we attributed this donation to a user.
            # Category 'system' so it always lands (donations are too important
            # to silence behind marketing prefs).
            if linked_user_id:
                try:
                    user = db.query(models.User).filter(
                        models.User.id == linked_user_id
                    ).first()
                    _safe_send_push(
                        "push_donation_thank_you", user, db,
                        extra_vars={"amount": f"{amount:.0f}" if amount.is_integer() else f"{amount:.2f}"},
                    )
                except Exception as _e:
                    logger.error(f"Donation push hook failed: {_e}")
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

    # ---- Engagement totals (social + study artifacts + tips) ----
    def _exclude_archived(q, user_col):
        if archived_ids:
            return q.filter(user_col.notin_(archived_ids))
        return q

    total_friendships = _exclude_archived(
        db.query(func.count(models.Friendship.id)).filter(models.Friendship.status == "accepted"),
        models.Friendship.user_id,
    ).scalar() or 0
    friendships_7d = _exclude_archived(
        db.query(func.count(models.Friendship.id)).filter(
            models.Friendship.status == "accepted",
            models.Friendship.created_at >= week_ago,
        ),
        models.Friendship.user_id,
    ).scalar() or 0

    total_groups_created = _exclude_archived(
        db.query(func.count(models.StudyGroup.id)),
        models.StudyGroup.creator_id,
    ).scalar() or 0
    groups_created_7d = _exclude_archived(
        db.query(func.count(models.StudyGroup.id)).filter(models.StudyGroup.created_at >= week_ago),
        models.StudyGroup.creator_id,
    ).scalar() or 0

    total_feed_reactions = db.query(func.count(models.FeedReaction.id)).scalar() or 0
    feed_reactions_7d = db.query(func.count(models.FeedReaction.id)).filter(
        models.FeedReaction.created_at >= week_ago
    ).scalar() or 0

    total_user_subjects = _exclude_archived(
        db.query(func.count(models.UserSubject.id)),
        models.UserSubject.user_id,
    ).scalar() or 0
    user_subjects_7d = _exclude_archived(
        db.query(func.count(models.UserSubject.id)).filter(models.UserSubject.added_at >= week_ago),
        models.UserSubject.user_id,
    ).scalar() or 0

    total_tasks_created = _exclude_archived(
        db.query(func.count(models.Task.id)),
        models.Task.user_id,
    ).scalar() or 0
    tasks_created_7d = _exclude_archived(
        db.query(func.count(models.Task.id)).filter(models.Task.created_at >= week_ago),
        models.Task.user_id,
    ).scalar() or 0

    total_tip_views = _exclude_archived(
        db.query(func.count(models.TipView.id)),
        models.TipView.user_id,
    ).scalar() or 0
    tip_views_7d = _exclude_archived(
        db.query(func.count(models.TipView.id)).filter(models.TipView.viewed_at >= week_ago),
        models.TipView.user_id,
    ).scalar() or 0

    total_tip_likes = _exclude_archived(
        db.query(func.count(models.TipView.id)).filter(models.TipView.liked == True),
        models.TipView.user_id,
    ).scalar() or 0
    tip_likes_7d = _exclude_archived(
        db.query(func.count(models.TipView.id)).filter(
            models.TipView.liked == True,
            models.TipView.viewed_at >= week_ago,
        ),
        models.TipView.user_id,
    ).scalar() or 0

    total_tip_saves = _exclude_archived(
        db.query(func.count(models.TipView.id)).filter(models.TipView.saved == True),
        models.TipView.user_id,
    ).scalar() or 0
    tip_saves_7d = _exclude_archived(
        db.query(func.count(models.TipView.id)).filter(
            models.TipView.saved == True,
            models.TipView.saved_at >= week_ago,
        ),
        models.TipView.user_id,
    ).scalar() or 0

    # Daily charts starting from April 1
    apr1 = datetime(now.year, 4, 1)
    num_days = (now - apr1).days + 1
    date_keys = [(apr1 + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(num_days)]

    def _bucket(timestamps):
        counts = {k: 0 for k in date_keys}
        for ts in timestamps:
            if ts is None:
                continue
            k = ts.strftime("%Y-%m-%d")
            if k in counts:
                counts[k] += 1
        return counts

    def _series(counts):
        return [{"date": k, "count": counts[k]} for k in date_keys]

    def _fetch_dates(query, ts_col, user_col):
        q = _exclude_archived(query, user_col).filter(ts_col >= apr1)
        return [r[0] for r in q.all()]

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

    # Daily series for new engagement metrics (single batched query each, bucketed in Python)
    daily_friendships = _series(_bucket(_fetch_dates(
        db.query(models.Friendship.created_at).filter(models.Friendship.status == "accepted"),
        models.Friendship.created_at, models.Friendship.user_id,
    )))
    daily_groups_created = _series(_bucket(_fetch_dates(
        db.query(models.StudyGroup.created_at),
        models.StudyGroup.created_at, models.StudyGroup.creator_id,
    )))
    daily_user_subjects = _series(_bucket(_fetch_dates(
        db.query(models.UserSubject.added_at),
        models.UserSubject.added_at, models.UserSubject.user_id,
    )))
    daily_tasks_created = _series(_bucket(_fetch_dates(
        db.query(models.Task.created_at),
        models.Task.created_at, models.Task.user_id,
    )))
    daily_tip_views = _series(_bucket(_fetch_dates(
        db.query(models.TipView.viewed_at),
        models.TipView.viewed_at, models.TipView.user_id,
    )))
    daily_tip_likes = _series(_bucket(_fetch_dates(
        db.query(models.TipView.viewed_at).filter(models.TipView.liked == True),
        models.TipView.viewed_at, models.TipView.user_id,
    )))
    daily_tip_saves = _series(_bucket(_fetch_dates(
        db.query(models.TipView.saved_at).filter(models.TipView.saved == True),
        models.TipView.saved_at, models.TipView.user_id,
    )))

    daily_feed_reactions = _series(_bucket(_fetch_dates(
        db.query(models.FeedReaction.created_at),
        models.FeedReaction.created_at, models.FeedReaction.user_id,
    )))

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
        "total_friendships": total_friendships,
        "friendships_7d": friendships_7d,
        "total_groups_created": total_groups_created,
        "groups_created_7d": groups_created_7d,
        "total_feed_reactions": total_feed_reactions,
        "feed_reactions_7d": feed_reactions_7d,
        "total_user_subjects": total_user_subjects,
        "user_subjects_7d": user_subjects_7d,
        "total_tasks_created": total_tasks_created,
        "tasks_created_7d": tasks_created_7d,
        "total_tip_views": total_tip_views,
        "tip_views_7d": tip_views_7d,
        "total_tip_likes": total_tip_likes,
        "tip_likes_7d": tip_likes_7d,
        "total_tip_saves": total_tip_saves,
        "tip_saves_7d": tip_saves_7d,
        "daily_friendships": daily_friendships,
        "daily_groups_created": daily_groups_created,
        "daily_user_subjects": daily_user_subjects,
        "daily_tasks_created": daily_tasks_created,
        "daily_tip_views": daily_tip_views,
        "daily_tip_likes": daily_tip_likes,
        "daily_tip_saves": daily_tip_saves,
        "daily_feed_reactions": daily_feed_reactions,
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


@app.get("/admin/subjects/audit")
def admin_subjects_audit(db: Session = Depends(get_db), _=Depends(verify_admin)):
    """List every Subject row with usage counts and a closest-default suggestion.

    Phase 1 of subject harmonisation: visibility only — no data is mutated.
    Use this to spot duplicates ("Math" vs "Maths", "Bio" vs "Biology", typos).
    """
    import difflib

    subjects = db.query(models.Subject).all()

    # Per-subject usage counts (one query each, fine at current scale)
    user_counts = dict(
        db.query(models.UserSubject.subject_id, func.count(models.UserSubject.id))
        .group_by(models.UserSubject.subject_id)
        .all()
    )
    session_counts = dict(
        db.query(models.StudySession.subject_id, func.count(models.StudySession.id))
        .filter(models.StudySession.subject_id.isnot(None))
        .group_by(models.StudySession.subject_id)
        .all()
    )
    group_counts = dict(
        db.query(models.StudyGroup.subject_id, func.count(models.StudyGroup.id))
        .filter(models.StudyGroup.subject_id.isnot(None))
        .group_by(models.StudyGroup.subject_id)
        .all()
    )

    defaults = [s for s in subjects if s.is_default]
    default_by_name = {s.name: s for s in defaults}
    default_names = list(default_by_name.keys())

    rows = []
    for s in subjects:
        # Suggest closest default match for non-default subjects
        suggestion = None
        if not s.is_default and default_names:
            # Compare on normalised name (already lowercased in DB)
            matches = difflib.get_close_matches(s.name, default_names, n=1, cutoff=0.7)
            if matches:
                d = default_by_name[matches[0]]
                suggestion = {"id": d.id, "name": d.name, "display_name": d.display_name}

        rows.append({
            "id": s.id,
            "name": s.name,
            "display_name": s.display_name,
            "is_default": bool(s.is_default),
            "created_by_user_id": s.created_by_user_id,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "users_count": user_counts.get(s.id, 0),
            "sessions_count": session_counts.get(s.id, 0),
            "groups_count": group_counts.get(s.id, 0),
            "suggested_merge_into": suggestion,
        })

    customs = [r for r in rows if not r["is_default"]]
    return {
        "total_subjects": len(rows),
        "default_count": sum(1 for r in rows if r["is_default"]),
        "custom_count": len(customs),
        "custom_with_suggestion": sum(1 for r in customs if r["suggested_merge_into"]),
        "subjects": rows,
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
    user_ids = [u.id for u in users]

    # Bulk-aggregate per-user counts to avoid N+1 queries
    animals_map: dict[int, int] = {}
    donated_map: dict[int, float] = {}
    friends_map: dict[int, int] = {}
    groups_map: dict[int, int] = {}
    if user_ids:
        for uid, cnt in db.query(
            models.UserAnimal.user_id, func.count(models.UserAnimal.id)
        ).filter(models.UserAnimal.user_id.in_(user_ids)).group_by(models.UserAnimal.user_id).all():
            animals_map[uid] = cnt
        for uid, total_donated in db.query(
            models.Donation.user_id, func.coalesce(func.sum(models.Donation.amount), 0)
        ).filter(models.Donation.user_id.in_(user_ids)).group_by(models.Donation.user_id).all():
            donated_map[uid] = float(total_donated or 0)
        # Friend count: accepted friendships where this user is on either side
        accepted = models.Friendship.status == "accepted"
        for uid, cnt in db.query(
            models.Friendship.user_id, func.count(models.Friendship.id)
        ).filter(accepted, models.Friendship.user_id.in_(user_ids)).group_by(models.Friendship.user_id).all():
            friends_map[uid] = friends_map.get(uid, 0) + cnt
        for uid, cnt in db.query(
            models.Friendship.friend_id, func.count(models.Friendship.id)
        ).filter(accepted, models.Friendship.friend_id.in_(user_ids)).group_by(models.Friendship.friend_id).all():
            friends_map[uid] = friends_map.get(uid, 0) + cnt
        # Study group count: number of groups the user is a member of
        for uid, cnt in db.query(
            models.GroupMember.user_id, func.count(models.GroupMember.id)
        ).filter(models.GroupMember.user_id.in_(user_ids)).group_by(models.GroupMember.user_id).all():
            groups_map[uid] = cnt

    result = []
    for u in users:
        result.append({
            "id": u.id,
            "email": u.email,
            "email_verified": bool(getattr(u, "email_verified", False)),
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
            "animals_hatched": animals_map.get(u.id, 0),
            "friend_count": friends_map.get(u.id, 0),
            "group_count": groups_map.get(u.id, 0),
            "total_donated": donated_map.get(u.id, 0.0),
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


# ============ Admin App Store Rankings (via AppFigures) ============

_APPFIGURES_BASE = "https://api.appfigures.com/v2"
_appfigures_state: dict = {
    "product_id": None,
    "product_name": None,
    "product_icon": None,
    "rankings_payload": None,
    "rankings_fetched_at": None,
}
_APPFIGURES_CACHE_TTL_SECONDS = 3600  # 1h — AppFigures rankings update daily

# Largest set of countries that's still polite to query in one shot.
# Semicolon-separated per AppFigures spec.
_APPFIGURES_COUNTRIES = ";".join([
    "US", "GB", "CA", "AU", "NZ", "IE",
    "IN", "LK", "BD", "PK", "NP", "BT", "MV",
    "PH", "SG", "MY", "ID", "TH", "VN", "HK", "TW", "JP", "KR", "MO",
    "DE", "FR", "ES", "IT", "NL", "BE", "CH", "AT", "SE", "NO", "DK",
    "FI", "PL", "PT", "GR", "TR", "RU", "UA", "CZ", "HU", "RO",
    "ZA", "NG", "KE", "EG", "MA", "GH", "TZ", "UG", "RW", "ET",
    "BR", "MX", "AR", "CL", "CO", "PE", "UY", "EC", "VE", "GT", "CR", "PA", "DO",
    "AE", "SA", "IL", "QA", "KW", "BH", "OM", "JO", "LB",
    "MN", "KZ", "UZ", "KG", "TJ", "AZ", "GE", "AM",
])


def _appfigures_headers() -> dict:
    pat = os.environ.get("APPFIGURES_PAT", "").strip()
    if not pat:
        raise HTTPException(
            status_code=503,
            detail="APPFIGURES_PAT env var not configured on backend",
        )
    return {"Authorization": f"Bearer {pat}", "Accept": "application/json"}


def _appfigures_get(path: str, params: Optional[dict] = None):
    headers = _appfigures_headers()
    url = f"{_APPFIGURES_BASE}{path}"
    try:
        with httpx.Client(timeout=30.0) as client:
            r = client.get(url, headers=headers, params=params or {})
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"AppFigures network error: {e}")
    if r.status_code >= 400:
        body = (r.text or "").strip()[:300]
        raise HTTPException(
            status_code=502,
            detail=f"AppFigures {r.status_code} on {path}: {body or '(empty body)'}",
        )
    return r.json()


@app.get("/admin/appfigures-debug")
def admin_appfigures_debug(_=Depends(verify_admin)):
    """Diagnostics — calls AppFigures and reports what's failing without
    masking the response body. Safe to remove after rankings work."""
    out = {
        "pat_set": bool(os.environ.get("APPFIGURES_PAT", "").strip()),
        "pat_prefix": (os.environ.get("APPFIGURES_PAT", "") or "")[:6],
        "pat_length": len((os.environ.get("APPFIGURES_PAT", "") or "").strip()),
        "appstore_id_set": bool(os.environ.get("APPFIGURES_APPSTORE_ID", "").strip()),
        "appstore_id_value": os.environ.get("APPFIGURES_APPSTORE_ID", "").strip() or None,
        "product_id_set": bool(os.environ.get("APPFIGURES_PRODUCT_ID", "").strip()),
        # Cron health: when did the scheduled sync last run, and what happened?
        "cron": {
            "schedule_utc": ["04:00", "16:00"],
            "last_started_at": _appfigures_state.get("last_cron_started_at"),
            "last_finished_at": _appfigures_state.get("last_cron_finished_at"),
            "last_result": _appfigures_state.get("last_cron_result"),
            "last_on_demand_sync": (
                _appfigures_state["last_on_demand_sync"].isoformat()
                if isinstance(_appfigures_state.get("last_on_demand_sync"), datetime)
                else _appfigures_state.get("last_on_demand_sync")
            ),
        },
        "tests": [],
    }
    if not out["pat_set"]:
        out["error"] = "APPFIGURES_PAT not set"
        return out
    headers = {"Authorization": f"Bearer {os.environ['APPFIGURES_PAT'].strip()}", "Accept": "application/json"}
    test_paths = [
        "/products/mine",
        f"/products/apple/{os.environ.get('APPFIGURES_APPSTORE_ID', '').strip() or '6759482612'}",
        f"/products/search/@iTunesId={os.environ.get('APPFIGURES_APPSTORE_ID', '').strip() or '6759482612'}",
    ]
    for path in test_paths:
        try:
            with httpx.Client(timeout=15.0) as c:
                r = c.get(f"{_APPFIGURES_BASE}{path}", headers=headers)
            out["tests"].append({
                "path": path,
                "status": r.status_code,
                "body_preview": (r.text or "")[:400],
            })
        except Exception as e:
            out["tests"].append({"path": path, "error": str(e)})
    return out


def _resolve_appfigures_product():
    """Find the iOS product in the AppFigures account. Cached for the process lifetime.
    Resolution order:
      1. APPFIGURES_PRODUCT_ID env var (skip all lookups)
      2. APPFIGURES_APPSTORE_ID env var → resolve via /v2/products/apple/<id>
         (only needs public:read scope)
      3. /products/mine (needs account:read scope)
    """
    if _appfigures_state["product_id"]:
        return _appfigures_state["product_id"]

    override = os.environ.get("APPFIGURES_PRODUCT_ID", "").strip()
    if override:
        try:
            _appfigures_state["product_id"] = int(override)
        except ValueError:
            _appfigures_state["product_id"] = override
        _appfigures_state["product_name"] = "(set via APPFIGURES_PRODUCT_ID)"
        return _appfigures_state["product_id"]

    appstore_id = os.environ.get("APPFIGURES_APPSTORE_ID", "").strip()
    if appstore_id:
        try:
            p = _appfigures_get(f"/products/apple/{appstore_id}")
            if isinstance(p, dict) and p.get("id"):
                _appfigures_state["product_id"] = p["id"]
                _appfigures_state["product_name"] = p.get("name")
                _appfigures_state["product_icon"] = p.get("icon")
                return _appfigures_state["product_id"]
        except HTTPException as e:
            raise HTTPException(
                status_code=502,
                detail=(
                    f"Could not resolve App Store ID {appstore_id} via AppFigures "
                    f"({e.detail}). Verify the ID matches the iOS app in AppFigures."
                ),
            )

    try:
        data = _appfigures_get("/products/mine")
    except HTTPException as e:
        # Most likely a scope issue — re-raise with a more actionable message.
        raise HTTPException(
            status_code=502,
            detail=(
                f"Could not list AppFigures products ({e.detail}). "
                "Either grant the PAT 'account:read' scope, OR set "
                "APPFIGURES_PRODUCT_ID env var to the iOS product id directly."
            ),
        )
    # /products/mine returns either a list or a dict keyed by id, depending on account.
    items = data.values() if isinstance(data, dict) else data
    candidates = []
    for p in items:
        if not isinstance(p, dict):
            continue
        store = (p.get("store") or "").lower()
        store_id = (p.get("store_id") or "").lower()
        # iOS products on AppFigures use store names like "apple", "apple_ios", "ios", "ios_universal"
        if (("apple" in store and "mac" not in store) or "ios" in store
                or "apple" in store_id or "ios" in store_id):
            candidates.append(p)
    if not candidates:
        # Fall back to first product so we at least see something
        all_products = [p for p in items if isinstance(p, dict)]
        if all_products:
            candidates = [all_products[0]]
    if not candidates:
        raise HTTPException(status_code=404, detail="No products found in AppFigures account")
    p = candidates[0]
    _appfigures_state["product_id"] = p.get("id")
    _appfigures_state["product_name"] = p.get("name")
    _appfigures_state["product_icon"] = p.get("icon")
    return _appfigures_state["product_id"]


def _appfigures_fetch_ranks(start_date: date, end_date: date) -> tuple[dict, list[str]]:
    """Fetch raw ranks from AppFigures with country auto-pruning.
    Returns (raw_response, pruned_country_codes).
    Uses daily granularity (AppFigures end-of-day snapshots).
    """
    import re as _re
    product_id = _resolve_appfigures_product()
    countries = _APPFIGURES_COUNTRIES.split(";")
    pruned: list[str] = []
    raw = None
    for _ in range(25):
        try:
            raw = _appfigures_get(
                f"/ranks/{product_id}/daily/{start_date.isoformat()}/{end_date.isoformat()}",
                # filter=1000 captures the full chart (AppFigures max).
                params={"countries": ";".join(countries), "filter": 1000, "tz": "utc"},
            )
            break
        except HTTPException as e:
            m = _re.search(r"country (\w+) is not available", str(e.detail))
            if not m:
                raise
            bad = m.group(1).upper()
            if bad in countries:
                countries.remove(bad)
                pruned.append(bad)
            else:
                raise
    if raw is None:
        raise HTTPException(status_code=502, detail=f"Too many unsupported countries (pruned {pruned})")
    return raw, pruned


@app.post("/admin/app-rankings/manual-insert")
def admin_app_rankings_manual_insert(
    rank_date: str = Query(..., description="ISO date YYYY-MM-DD"),
    country: str = Query(..., description="ISO 3166-1 alpha-2"),
    category_name: str = Query(..., description="e.g. Productivity"),
    subtype: str = Query(..., description="free | paid | grossing"),
    position: int = Query(..., ge=1, le=2000),
    device: Optional[str] = Query("Handheld", description="Handheld | Tablet | Desktop"),
    note: Optional[str] = Query(None, description="Free-form note (not stored, just logged)"),
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    """Manually upsert a single rank row when AppFigures' daily granularity
    misses an intraday peak. Idempotent — re-running with same key updates
    in place."""
    try:
        slot_date = datetime.fromisoformat(rank_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="rank_date must be YYYY-MM-DD")
    country = country.upper()
    existing = (
        db.query(models.AppRank)
        .filter(
            models.AppRank.rank_date == slot_date,
            models.AppRank.country == country,
            models.AppRank.category_name == category_name,
            models.AppRank.subtype == subtype,
            models.AppRank.device == device,
        )
        .first()
    )
    if existing:
        existing.position = position
        existing.fetched_at = datetime.utcnow()
        action = "updated"
    else:
        db.add(models.AppRank(
            rank_date=slot_date,
            country=country,
            category_name=category_name,
            subtype=subtype,
            device=device,
            store="apple",
            position=position,
            delta=None,
            fetched_at=datetime.utcnow(),
        ))
        action = "inserted"
    db.commit()
    if note:
        logger.info(f"Manual rank insert ({action}): {country} {category_name} {subtype} #{position} on {rank_date} — {note}")
    return {
        "action": action,
        "rank_date": rank_date,
        "country": country,
        "category_name": category_name,
        "subtype": subtype,
        "device": device,
        "position": position,
    }


def _sync_app_ranks(start_date: date, end_date: date, db: Session) -> dict:
    """Fetch ranks from AppFigures for a date range and upsert into app_ranks.
    Idempotent: re-running for the same date range overwrites existing rows
    via the (rank_date, country, category_name, subtype, device) unique slot.
    """
    raw, pruned = _appfigures_fetch_ranks(start_date, end_date)
    dates_iso = raw.get("dates", []) or []
    parsed_dates: list[Optional[datetime]] = []
    for d in dates_iso:
        try:
            parsed_dates.append(datetime.fromisoformat(d.replace("Z", "")))
        except Exception:
            parsed_dates.append(None)

    inserted = updated = skipped = 0
    for series in raw.get("data", []) or []:
        country = series.get("country")
        cat = series.get("category") or {}
        category_name = cat.get("name")
        subtype = cat.get("subtype")
        device = cat.get("device")
        store = cat.get("store")
        if not (country and category_name and subtype):
            continue
        positions = series.get("positions") or []
        deltas = series.get("deltas") or []
        for i, pos in enumerate(positions):
            if pos is None:
                skipped += 1
                continue
            slot_date = parsed_dates[i] if i < len(parsed_dates) else None
            if slot_date is None:
                skipped += 1
                continue
            delta = deltas[i] if i < len(deltas) else None
            existing = (
                db.query(models.AppRank)
                .filter(
                    models.AppRank.rank_date == slot_date,
                    models.AppRank.country == country,
                    models.AppRank.category_name == category_name,
                    models.AppRank.subtype == subtype,
                    models.AppRank.device == device,
                )
                .first()
            )
            if existing:
                if existing.position != pos or existing.delta != delta:
                    existing.position = pos
                    existing.delta = delta
                    existing.fetched_at = datetime.utcnow()
                    updated += 1
                else:
                    skipped += 1
            else:
                db.add(models.AppRank(
                    rank_date=slot_date,
                    country=country,
                    category_name=category_name,
                    subtype=subtype,
                    device=device,
                    store=store,
                    position=pos,
                    delta=delta,
                    fetched_at=datetime.utcnow(),
                ))
                inserted += 1
    db.commit()
    return {
        "inserted": inserted,
        "updated": updated,
        "skipped": skipped,
        "pruned_countries": pruned,
        "window": {"start": start_date.isoformat(), "end": end_date.isoformat()},
    }


def _aggregate_ranks_from_db(rows: list[models.AppRank], window_days: int) -> dict:
    """Group rows by (country, category, subtype, device) and compute peak +
    current per slot. Returns the same shape as the old live endpoint."""
    by_slot: dict[tuple, list[models.AppRank]] = {}
    for r in rows:
        key = (r.country, r.category_name, r.subtype, r.device)
        by_slot.setdefault(key, []).append(r)

    out_rows = []
    for key, slot_rows in by_slot.items():
        slot_rows.sort(key=lambda x: x.rank_date)
        peak = min(slot_rows, key=lambda x: x.position)
        latest = slot_rows[-1]
        out_rows.append({
            "country": key[0],
            "category_name": key[1],
            "subtype": key[2],
            "device": key[3],
            "store": latest.store,
            "position": peak.position,
            "peak_date": peak.rank_date.isoformat() if peak.rank_date else None,
            "current_position": latest.position,
            "current_date": latest.rank_date.isoformat() if latest.rank_date else None,
            "delta": latest.delta,
            "as_of": (latest.rank_date or peak.rank_date).isoformat() if (latest.rank_date or peak.rank_date) else None,
            "samples": len(slot_rows),
        })
    out_rows.sort(key=lambda r: r["position"])
    countries_visible = sorted({r["country"] for r in out_rows})
    best = out_rows[0] if out_rows else None
    return {
        "rankings": out_rows,
        "country_count": len(countries_visible),
        "rank_count": len(out_rows),
        "best_rank": (
            {
                "country": best["country"],
                "category_name": best["category_name"],
                "subtype": best["subtype"],
                "position": best["position"],
                "peak_date": best.get("peak_date"),
            } if best else None
        ),
        "window_days": window_days,
    }


@app.get("/admin/app-rankings")
def admin_app_rankings(
    window_days: int = Query(default=7, ge=1, le=365, description="Lookback window in days"),
    sync: bool = Query(default=False, description="Sync today's data from AppFigures before reading"),
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    """App Store chart positions, served from app_ranks table.
    Daily cron syncs yesterday's data at 04:00 UTC. Pass sync=true to fetch
    today's snapshot on demand (rate-limited to once every 5 minutes)."""
    sync_result = None
    if sync:
        # Light rate limit: don't allow on-demand sync more than every 5 min
        now = datetime.utcnow()
        last = _appfigures_state.get("last_on_demand_sync")
        if last and (now - last).total_seconds() < 300:
            sync_result = {"skipped": "rate-limited", "last_sync_seconds_ago": int((now - last).total_seconds())}
        else:
            today = datetime.utcnow().date()
            sync_result = _sync_app_ranks(today - timedelta(days=1), today, db)
            _appfigures_state["last_on_demand_sync"] = now

    cutoff = datetime.utcnow() - timedelta(days=window_days)
    rows = db.query(models.AppRank).filter(models.AppRank.rank_date >= cutoff).all()
    payload = _aggregate_ranks_from_db(rows, window_days)

    # Find the most recent fetched_at across the rows for "data freshness"
    latest_fetch = max((r.fetched_at for r in rows), default=None)
    payload.update({
        "product_id": _appfigures_state.get("product_id"),
        "product_name": _appfigures_state.get("product_name"),
        "product_icon": _appfigures_state.get("product_icon"),
        "data_source": "database",
        "last_synced_at": latest_fetch.isoformat() if latest_fetch else None,
        "fetched_at": datetime.utcnow().isoformat(),
        "sync_result": sync_result,
    })
    return payload


@app.get("/admin/app-rankings/timeseries")
def admin_app_rankings_timeseries(
    country: str = Query(..., description="ISO 3166-1 alpha-2 (e.g. US, GB)"),
    category: str = Query(..., description="Category name as stored, e.g. 'Education'"),
    subtype: str = Query(..., description="free | paid | grossing"),
    device: Optional[str] = Query(None, description="iphone | ipad | universal"),
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    """Daily rank trajectory for a single (country × category × subtype × device) slot.
    Used by the dashboard's per-row trajectory chart.
    """
    cutoff = datetime.utcnow() - timedelta(days=days)
    q = db.query(models.AppRank).filter(
        models.AppRank.rank_date >= cutoff,
        models.AppRank.country == country.upper(),
        models.AppRank.category_name == category,
        models.AppRank.subtype == subtype,
    )
    if device:
        q = q.filter(models.AppRank.device == device)
    points = q.order_by(models.AppRank.rank_date.asc()).all()
    return {
        "country": country.upper(),
        "category_name": category,
        "subtype": subtype,
        "device": device,
        "days": days,
        "points": [
            {
                "date": p.rank_date.isoformat(),
                "position": p.position,
                "delta": p.delta,
            }
            for p in points
        ],
    }


# ============ User Feedback ============

@app.post("/feedback")
def submit_feedback(
    payload: schemas.FeedbackCreate,
    current_user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Submit user feedback. Auth optional — anonymous submissions allowed.
    Returns the created feedback id and a friendly message."""
    fb = models.UserFeedback(
        user_id=current_user.id if current_user else None,
        email=payload.email or (current_user.email if current_user else None),
        feedback_type=payload.feedback_type,
        title=payload.title.strip() if payload.title else None,
        message=payload.message.strip(),
        app_version=payload.app_version,
        os=payload.os,
        device_model=payload.device_model,
        screen_context=payload.screen_context,
        screenshot_url=payload.screenshot_url,
        status="new",
        priority="medium",
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)
    logger.info(
        f"Feedback received id={fb.id} type={fb.feedback_type} "
        f"user_id={fb.user_id} email={fb.email or '(anon)'}"
    )
    return {
        "id": fb.id,
        "message": "Thanks! We've received your feedback and will take a look.",
    }


@app.get("/feedback/feature-requests")
def list_public_feature_requests(
    sort: str = Query(default="upvotes", pattern="^(upvotes|newest)$"),
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    current_user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Public list of feature requests (for the in-app + web roadmap page).
    Returns whether the current user has upvoted each one."""
    q = db.query(models.UserFeedback).filter(
        models.UserFeedback.feedback_type == "feature",
        models.UserFeedback.status.notin_(["wontfix", "duplicate"]),
    )
    if status:
        q = q.filter(models.UserFeedback.status == status)
    if sort == "upvotes":
        q = q.order_by(models.UserFeedback.upvotes.desc(), models.UserFeedback.created_at.desc())
    else:
        q = q.order_by(models.UserFeedback.created_at.desc())
    items = q.limit(limit).all()

    user_upvoted_ids: set[int] = set()
    if current_user:
        upvotes = db.query(models.FeedbackUpvote.feedback_id).filter(
            models.FeedbackUpvote.user_id == current_user.id,
            models.FeedbackUpvote.feedback_id.in_([i.id for i in items]) if items else False,
        ).all()
        user_upvoted_ids = {u.feedback_id for u in upvotes}

    return [
        {
            "id": fb.id,
            "title": fb.title or (fb.message[:80] + "…" if len(fb.message) > 80 else fb.message),
            "message": fb.message,
            "status": fb.status,
            "upvotes": fb.upvotes,
            "user_upvoted": fb.id in user_upvoted_ids,
            "created_at": fb.created_at.isoformat(),
        }
        for fb in items
    ]


@app.post("/feedback/{feedback_id}/upvote")
def upvote_feature_request(
    feedback_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upvote a feature request. Auth required (one vote per user)."""
    fb = db.query(models.UserFeedback).filter(models.UserFeedback.id == feedback_id).first()
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found")
    if fb.feedback_type != "feature":
        raise HTTPException(status_code=400, detail="Can only upvote feature requests")
    existing = db.query(models.FeedbackUpvote).filter(
        models.FeedbackUpvote.feedback_id == feedback_id,
        models.FeedbackUpvote.user_id == current_user.id,
    ).first()
    if existing:
        return {"upvoted": True, "upvotes": fb.upvotes, "already_voted": True}
    db.add(models.FeedbackUpvote(feedback_id=feedback_id, user_id=current_user.id))
    fb.upvotes = (fb.upvotes or 0) + 1
    db.commit()
    return {"upvoted": True, "upvotes": fb.upvotes, "already_voted": False}


@app.delete("/feedback/{feedback_id}/upvote")
def remove_upvote(
    feedback_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    fb = db.query(models.UserFeedback).filter(models.UserFeedback.id == feedback_id).first()
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found")
    existing = db.query(models.FeedbackUpvote).filter(
        models.FeedbackUpvote.feedback_id == feedback_id,
        models.FeedbackUpvote.user_id == current_user.id,
    ).first()
    if not existing:
        return {"upvoted": False, "upvotes": fb.upvotes}
    db.delete(existing)
    fb.upvotes = max(0, (fb.upvotes or 0) - 1)
    db.commit()
    return {"upvoted": False, "upvotes": fb.upvotes}


# ----- Admin feedback endpoints -----

@app.get("/admin/feedback")
def admin_list_feedback(
    status: Optional[str] = Query(default=None),
    feedback_type: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None, description="Search title/message/email"),
    limit: int = Query(default=200, ge=1, le=1000),
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    """List feedback with filters for the admin dashboard."""
    query = db.query(models.UserFeedback)
    if status:
        query = query.filter(models.UserFeedback.status == status)
    if feedback_type:
        query = query.filter(models.UserFeedback.feedback_type == feedback_type)
    if q:
        like = f"%{q.lower()}%"
        query = query.filter(
            (func.lower(models.UserFeedback.title).like(like))
            | (func.lower(models.UserFeedback.message).like(like))
            | (func.lower(models.UserFeedback.email).like(like))
        )

    items = query.order_by(models.UserFeedback.created_at.desc()).limit(limit).all()

    user_ids = {fb.user_id for fb in items if fb.user_id}
    users_map = {}
    if user_ids:
        users = db.query(models.User).filter(models.User.id.in_(user_ids)).all()
        users_map = {u.id: u for u in users}

    # Aggregate counts for KPIs
    week_ago = datetime.utcnow() - timedelta(days=7)
    counts = {
        "total": db.query(func.count(models.UserFeedback.id)).scalar() or 0,
        "open": db.query(func.count(models.UserFeedback.id)).filter(
            models.UserFeedback.status.in_(["new", "triaged", "in_progress"])
        ).scalar() or 0,
        "new_7d": db.query(func.count(models.UserFeedback.id)).filter(
            models.UserFeedback.created_at >= week_ago
        ).scalar() or 0,
        "by_type": {
            row[0]: row[1]
            for row in db.query(models.UserFeedback.feedback_type, func.count(models.UserFeedback.id))
                          .group_by(models.UserFeedback.feedback_type).all()
        },
        "by_status": {
            row[0]: row[1]
            for row in db.query(models.UserFeedback.status, func.count(models.UserFeedback.id))
                          .group_by(models.UserFeedback.status).all()
        },
    }

    return {
        "counts": counts,
        "items": [
            {
                "id": fb.id,
                "feedback_type": fb.feedback_type,
                "title": fb.title,
                "message": fb.message,
                "status": fb.status,
                "priority": fb.priority,
                "upvotes": fb.upvotes,
                "email": fb.email,
                "user_id": fb.user_id,
                "username": users_map.get(fb.user_id).username if fb.user_id and users_map.get(fb.user_id) else None,
                "app_version": fb.app_version,
                "os": fb.os,
                "device_model": fb.device_model,
                "screen_context": fb.screen_context,
                "screenshot_url": fb.screenshot_url,
                "admin_notes": fb.admin_notes,
                "internal_link": fb.internal_link,
                "created_at": fb.created_at.isoformat(),
                "updated_at": fb.updated_at.isoformat(),
                "resolved_at": fb.resolved_at.isoformat() if fb.resolved_at else None,
            }
            for fb in items
        ],
    }


@app.patch("/admin/feedback/{feedback_id}")
def admin_update_feedback(
    feedback_id: int,
    payload: schemas.AdminFeedbackUpdate,
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    fb = db.query(models.UserFeedback).filter(models.UserFeedback.id == feedback_id).first()
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found")
    if payload.status is not None:
        fb.status = payload.status
        if payload.status in ("done", "wontfix", "duplicate") and not fb.resolved_at:
            fb.resolved_at = datetime.utcnow()
        elif payload.status not in ("done", "wontfix", "duplicate"):
            fb.resolved_at = None
    if payload.priority is not None:
        fb.priority = payload.priority
    if payload.admin_notes is not None:
        fb.admin_notes = payload.admin_notes
    if payload.internal_link is not None:
        fb.internal_link = payload.internal_link
    db.commit()
    db.refresh(fb)
    return {"ok": True, "id": fb.id, "status": fb.status, "priority": fb.priority}


@app.delete("/admin/feedback/{feedback_id}")
def admin_delete_feedback(
    feedback_id: int,
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    fb = db.query(models.UserFeedback).filter(models.UserFeedback.id == feedback_id).first()
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found")
    db.delete(fb)
    db.commit()
    return {"ok": True}


# ============ PostHog Proxy ============
# Personal API Key lives in env var POSTHOG_PERSONAL_API_KEY (Railway).
# Frontend never sees the key — it calls /admin/posthog/* which proxies to PostHog.

_POSTHOG_HOST = os.environ.get("POSTHOG_HOST", "https://us.posthog.com")
_posthog_state: dict = {"project_id": None, "project_name": None, "checked_at": None}


def _posthog_key() -> Optional[str]:
    return os.environ.get("POSTHOG_PERSONAL_API_KEY") or os.environ.get("POSTHOG_API_KEY")


async def _posthog_ensure_project() -> dict:
    """Lazily resolve + cache the first PostHog project id. Raises HTTPException on failure."""
    key = _posthog_key()
    if not key:
        raise HTTPException(
            status_code=503,
            detail="POSTHOG_PERSONAL_API_KEY not set in Railway. Add it in the backend service env vars and restart.",
        )
    if _posthog_state.get("project_id"):
        return _posthog_state
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(
            f"{_POSTHOG_HOST}/api/projects/",
            headers={"Authorization": f"Bearer {key}"},
        )
        if r.status_code == 401:
            raise HTTPException(status_code=401, detail="PostHog auth failed — key invalid or revoked")
        if r.status_code == 403:
            raise HTTPException(
                status_code=403,
                detail="PostHog 403: key missing required scopes (need project:read, query:read, insight:read, person:read)",
            )
        if r.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"PostHog /projects/ {r.status_code}: {r.text[:200]}")
        data = r.json()
        results = data.get("results") or []
        if not results:
            raise HTTPException(status_code=502, detail="PostHog returned no projects for this key")
        _posthog_state["project_id"] = results[0]["id"]
        _posthog_state["project_name"] = results[0].get("name")
        _posthog_state["checked_at"] = datetime.utcnow().isoformat()
    return _posthog_state


@app.get("/admin/posthog/status")
async def admin_posthog_status(_=Depends(verify_admin)):
    """Report whether the backend has a working PostHog key configured."""
    key = _posthog_key()
    if not key:
        return {"connected": False, "reason": "POSTHOG_PERSONAL_API_KEY not set in Railway env vars"}
    try:
        state = await _posthog_ensure_project()
        return {
            "connected": True,
            "project_id": state["project_id"],
            "project_name": state["project_name"],
            "host": _POSTHOG_HOST,
        }
    except HTTPException as e:
        return {"connected": False, "reason": e.detail}
    except Exception as e:
        return {"connected": False, "reason": f"Unexpected error: {e}"}


class PostHogQueryBody(BaseModel):
    query: str = Field(..., min_length=1, max_length=20000)


@app.post("/admin/posthog/query")
async def admin_posthog_query(
    body: PostHogQueryBody,
    _=Depends(verify_admin),
):
    """Proxy a HogQL query to PostHog. Key stays on the server."""
    state = await _posthog_ensure_project()
    key = _posthog_key()
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(
            f"{_POSTHOG_HOST}/api/projects/{state['project_id']}/query/",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"query": {"kind": "HogQLQuery", "query": body.query}},
        )
        if r.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"PostHog query {r.status_code}: {r.text[:400]}")
        return r.json()


@app.post("/admin/tips/backfill-views")
async def admin_backfill_tip_views(_=Depends(verify_admin), db: Session = Depends(get_db)):
    """One-click: hydrate TipView rows from PostHog `tip_viewed` events.
    Same logic as scripts/backfill_tip_views.py but callable from the admin dashboard.
    Idempotent — never double-inserts.
    """
    key = _posthog_key()
    if not key:
        raise HTTPException(status_code=503, detail="POSTHOG_PERSONAL_API_KEY not set in Railway")

    state = await _posthog_ensure_project()
    hogql = """
    SELECT
        distinct_id,
        toInt64OrNull(properties.tip_id) AS tip_id,
        minOrNull(timestamp) AS first_viewed
    FROM events
    WHERE event = 'tip_viewed'
      AND properties.tip_id IS NOT NULL
    GROUP BY distinct_id, tip_id
    HAVING tip_id IS NOT NULL
    ORDER BY first_viewed ASC
    """

    async with httpx.AsyncClient(timeout=180.0) as client:
        r = await client.post(
            f"{_POSTHOG_HOST}/api/projects/{state['project_id']}/query/",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"query": {"kind": "HogQLQuery", "query": hogql}},
        )
        if r.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"PostHog query {r.status_code}: {r.text[:300]}")
        rows = r.json().get("results") or []

    valid_user_ids = {u.id for u in db.query(models.User.id).all()}
    valid_tip_ids = {t.id for t in db.query(models.StudyTip.id).all()}

    skipped_anon = skipped_unknown_user = skipped_unknown_tip = 0
    normalised: dict[tuple[int, int], datetime] = {}
    for row in rows:
        distinct_id, tip_id_raw, ts_raw = row[0], row[1], row[2]
        if distinct_id in (None, "anon", "anonymous"):
            skipped_anon += 1
            continue
        try:
            user_id = int(distinct_id)
        except (TypeError, ValueError):
            skipped_anon += 1
            continue
        if user_id not in valid_user_ids:
            skipped_unknown_user += 1
            continue
        try:
            tip_id = int(tip_id_raw)
        except (TypeError, ValueError):
            skipped_unknown_tip += 1
            continue
        if tip_id not in valid_tip_ids:
            skipped_unknown_tip += 1
            continue
        # Parse timestamp
        if isinstance(ts_raw, datetime):
            ts = ts_raw.replace(tzinfo=None) if ts_raw.tzinfo else ts_raw
        else:
            s = str(ts_raw)
            if s.endswith("Z"):
                s = s[:-1]
            if "+" in s:
                s = s.split("+", 1)[0]
            try:
                ts = datetime.fromisoformat(s)
            except ValueError:
                ts = datetime.fromisoformat(s.split(".")[0])
        existing_ts = normalised.get((user_id, tip_id))
        if existing_ts is None or ts < existing_ts:
            normalised[(user_id, tip_id)] = ts

    if not normalised:
        return {
            "ok": True,
            "posthog_rows": len(rows),
            "created": 0,
            "skipped_existing": 0,
            "skipped_anon": skipped_anon,
            "skipped_unknown_user": skipped_unknown_user,
            "skipped_unknown_tip": skipped_unknown_tip,
        }

    affected_user_ids = {u for u, _ in normalised.keys()}
    existing_views = db.query(models.TipView).filter(
        models.TipView.user_id.in_(affected_user_ids)
    ).all()
    existing_pairs = {(v.user_id, v.tip_id) for v in existing_views}

    created = skipped_existing = 0
    for (user_id, tip_id), ts in normalised.items():
        if (user_id, tip_id) in existing_pairs:
            skipped_existing += 1
            continue
        db.add(models.TipView(
            user_id=user_id, tip_id=tip_id, viewed_at=ts,
            liked=False, disliked=False, saved=False,
        ))
        created += 1
    db.commit()

    return {
        "ok": True,
        "posthog_rows": len(rows),
        "created": created,
        "skipped_existing": skipped_existing,
        "skipped_anon": skipped_anon,
        "skipped_unknown_user": skipped_unknown_user,
        "skipped_unknown_tip": skipped_unknown_tip,
    }


@app.get("/admin/posthog/projects")
async def admin_posthog_projects(_=Depends(verify_admin)):
    """List projects the key has access to (for debugging)."""
    key = _posthog_key()
    if not key:
        raise HTTPException(status_code=503, detail="POSTHOG_PERSONAL_API_KEY not set")
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(
            f"{_POSTHOG_HOST}/api/projects/",
            headers={"Authorization": f"Bearer {key}"},
        )
        if r.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"PostHog {r.status_code}: {r.text[:200]}")
        return r.json()


@app.post("/admin/app-rankings/sync")
def admin_app_rankings_sync(
    days: int = Query(default=2, ge=1, le=90, description="How many days back to sync"),
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    """Manually trigger a sync from AppFigures into app_ranks.
    Use days=90 for a one-shot backfill if the script approach isn't convenient.
    """
    today = datetime.utcnow().date()
    return _sync_app_ranks(today - timedelta(days=days), today, db)


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
    if not tips:
        return {"total": total, "tips": []}

    tip_ids = [t.id for t in tips]
    archived_ids = [u.id for u in db.query(models.User.id).filter(models.User.is_archived == True).all()]

    def _engagement_query(filter_clause):
        q = db.query(
            models.TipView.tip_id,
            func.count(models.TipView.id).label("cnt"),
        ).filter(models.TipView.tip_id.in_(tip_ids))
        if filter_clause is not None:
            q = q.filter(filter_clause)
        if archived_ids:
            q = q.filter(models.TipView.user_id.notin_(archived_ids))
        return {row.tip_id: row.cnt for row in q.group_by(models.TipView.tip_id).all()}

    view_counts = _engagement_query(None)
    like_counts = _engagement_query(models.TipView.liked == True)
    save_counts = _engagement_query(models.TipView.saved == True)

    user_ids = {t.user_id for t in tips if t.user_id}
    users_by_id = {}
    if user_ids:
        users_by_id = {
            u.id: u for u in db.query(models.User).filter(models.User.id.in_(user_ids)).all()
        }

    result = []
    for t in tips:
        username = None
        if t.user_id:
            u = users_by_id.get(t.user_id)
            if u:
                username = u.username or u.email
        views = view_counts.get(t.id, 0)
        likes = like_counts.get(t.id, 0)
        saves = save_counts.get(t.id, 0)
        result.append({
            "id": t.id,
            "content": t.content,
            "category": t.category,
            "animal_name": t.animal_name,
            "likes_count": t.likes_count or 0,
            "dislikes_count": t.dislikes_count or 0,
            "view_count": views,
            "save_count": saves,
            "like_count": likes,
            "save_rate": round(saves / views, 4) if views else 0.0,
            "like_rate": round(likes / views, 4) if views else 0.0,
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
            "min_sessions": t.min_sessions, "max_sessions": t.max_sessions,
            "min_streak": t.min_streak, "max_streak": t.max_streak,
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
    for _fld in ("min_sessions", "max_sessions", "min_streak", "max_streak"):
        if _fld in data:
            setattr(tmpl, _fld, data[_fld])
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
        "drops": [
            {"template_key": "campaign_verify_email", "min_days_since_signup": 0},
            {"template_key": "campaign_verify_email_2", "min_days_since_signup": 3},
            {"template_key": "campaign_verify_email_3", "min_days_since_signup": 7},
        ],
    },
    "start_timer": {
        "label": "Verified but never started a timer",
        "template_key": "campaign_start_timer",
        "drops": [
            {"template_key": "campaign_start_timer", "min_days_since_signup": 0},
            {"template_key": "campaign_start_timer_2", "min_days_since_signup": 4},
            {"template_key": "campaign_start_timer_3", "min_days_since_signup": 8},
        ],
    },
    "second_timer": {
        "label": "Only 1 session (encourage session 2)",
        "template_key": "campaign_second_timer",
        "drops": [
            {"template_key": "campaign_second_timer", "min_days_since_signup": 0},
            {"template_key": "campaign_second_timer_2", "min_days_since_signup": 3},
            {"template_key": "campaign_second_timer_3", "min_days_since_signup": 7},
        ],
    },
    "invite_friends": {
        "label": "2+ sessions — invite friends & groups",
        "template_key": "campaign_invite_friends",
        "drops": [
            {"template_key": "campaign_invite_friends", "min_days_since_signup": 0},
            {"template_key": "campaign_invite_friends_2", "min_days_since_signup": 5},
            {"template_key": "campaign_invite_friends_3", "min_days_since_signup": 10},
        ],
    },
}


def _cohort_campaign_template_keys(info: dict) -> list[str]:
    return [d["template_key"] for d in info["drops"]]


def _campaign_pick_next_drop(user, drops: list, sent_keys: set, now: datetime) -> Optional[str]:
    """Next campaign template for this user: in-order drips, day gates, one send per run."""
    if not user.created_at:
        return None
    days = (now - user.created_at).days
    for idx, d in enumerate(drops):
        tk = d["template_key"]
        if tk in sent_keys:
            continue
        mind = int(d.get("min_days_since_signup", 0))
        if days < mind:
            return None
        for i in range(idx):
            if drops[i]["template_key"] not in sent_keys:
                return None
        return tk
    return None


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


@app.get("/admin/campaign-metrics")
def admin_campaign_metrics(db: Session = Depends(get_db), _=Depends(verify_admin)):
    """Return send/open/click/conversion metrics for each campaign (all drip templates per cohort)."""
    metrics = {}
    for cohort_key, info in CAMPAIGN_COHORTS.items():
        tkeys = _cohort_campaign_template_keys(info)
        logs = db.query(models.EmailLog).filter(models.EmailLog.template_key.in_(tkeys)).all()
        sent = len(logs)
        delivered = sum(1 for l in logs if l.delivered)
        opened = sum(1 for l in logs if l.opened)
        clicked = sum(1 for l in logs if l.clicked)

        converted = 0
        unique_recipients = list({l.user_id for l in logs if l.user_id})
        if unique_recipients:
            if cohort_key == "verify_email":
                converted = db.query(func.count(models.User.id)).filter(
                    models.User.id.in_(unique_recipients),
                    models.User.email_verified == True,
                ).scalar() or 0
            elif cohort_key == "start_timer":
                converted = db.query(func.count(func.distinct(models.StudySession.user_id))).filter(
                    models.StudySession.user_id.in_(unique_recipients),
                ).scalar() or 0
            elif cohort_key == "second_timer":
                converted = db.query(models.StudySession.user_id).filter(
                    models.StudySession.user_id.in_(unique_recipients),
                ).group_by(models.StudySession.user_id).having(
                    func.count(models.StudySession.id) >= 2
                ).count()
            elif cohort_key == "invite_friends":
                converted = db.query(func.count(func.distinct(models.Friendship.user_id))).filter(
                    models.Friendship.user_id.in_(unique_recipients),
                    models.Friendship.status == "accepted",
                ).scalar() or 0

        n_recipients = len(unique_recipients)
        metrics[cohort_key] = {
            "template_key": info["template_key"],
            "template_keys": tkeys,
            "label": info["label"],
            "sent": sent,
            "delivered": delivered,
            "opened": opened,
            "clicked": clicked,
            "converted": converted,
            "unique_recipients": n_recipients,
            "open_rate": round(opened / sent * 100, 1) if sent > 0 else 0,
            "click_rate": round(clicked / sent * 100, 1) if sent > 0 else 0,
            "conversion_rate": round(converted / n_recipients * 100, 1) if n_recipients > 0 else 0,
        }
    return metrics


@app.post("/admin/campaign-send/{cohort_key}")
def admin_campaign_send(cohort_key: str, db: Session = Depends(get_db), _=Depends(verify_admin)):
    """Send the next eligible campaign drip per user (day-gated, in order)."""
    if cohort_key not in CAMPAIGN_COHORTS:
        raise HTTPException(status_code=400, detail=f"Unknown cohort: {cohort_key}")

    resend_key = os.getenv("RESEND_API_KEY")
    if not resend_key:
        raise HTTPException(status_code=500, detail="RESEND_API_KEY not configured")

    cohort_info = CAMPAIGN_COHORTS[cohort_key]
    drops = cohort_info["drops"]
    all_keys = _cohort_campaign_template_keys(cohort_info)

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

    now = datetime.utcnow()
    sent_count = 0
    skipped = 0
    failed = 0
    sent_by_template: dict[str, int] = {}

    user_ids = [u.id for u in users if u.email]

    # Batch-fetch all sent template keys for the whole cohort in one query (eliminates N+1).
    from collections import defaultdict
    sent_keys_by_user: dict[int, set] = defaultdict(set)
    for row in db.query(models.EmailLog.user_id, models.EmailLog.template_key).filter(
        models.EmailLog.user_id.in_(user_ids),
        models.EmailLog.template_key.in_(all_keys),
    ).all():
        sent_keys_by_user[row[0]].add(row[1])

    # Batch-fetch animal/badge counts in two queries instead of 2N.
    animals_by_user = dict(
        db.query(models.UserAnimal.user_id, func.count(models.UserAnimal.id))
        .filter(models.UserAnimal.user_id.in_(user_ids))
        .group_by(models.UserAnimal.user_id).all()
    )
    badges_by_user = dict(
        db.query(models.UserBadge.user_id, func.count(models.UserBadge.id))
        .filter(models.UserBadge.user_id.in_(user_ids))
        .group_by(models.UserBadge.user_id).all()
    )

    for user in users:
        if not user.email:
            continue
        user_sent = sent_keys_by_user[user.id]
        template_key = _campaign_pick_next_drop(user, drops, user_sent, now)
        if not template_key:
            skipped += 1
            continue
        name = user.username or "there"
        variables = {
            "name": name,
            "total_minutes": str(user.total_study_minutes or 0),
            "animals_count": str(animals_by_user.get(user.id, 0)),
            "streak": str(user.current_streak or 0),
            "longest_streak": str(user.longest_streak or 0),
            "sessions": str(user.total_sessions or 0),
            "badges": str(badges_by_user.get(user.id, 0)),
        }
        if _send_template_email(template_key, user.email, variables, db):
            sent_count += 1
            sent_by_template[template_key] = sent_by_template.get(template_key, 0) + 1
        else:
            failed += 1

    return {
        "cohort": cohort_key,
        "drops": all_keys,
        "total_in_cohort": len(users),
        "sent": sent_count,
        "skipped_no_eligible_drop": skipped,
        "failed": failed,
        "sent_by_template": sent_by_template,
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
    import resend.exceptions as _resend_exc
    resend_key = os.getenv("RESEND_API_KEY")
    if not resend_key:
        return {"error": "RESEND_API_KEY not set"}

    daily_cap = int(os.getenv("DAILY_EMAIL_CAP", "10000"))
    now = datetime.utcnow()
    sent = {"day3": 0, "day7": 0, "day14": 0, "day30": 0, "reengagement": 0}
    total_sent = 0
    stopped_early: str | None = None

    milestone_templates = db.query(models.EmailTemplate).filter(
        models.EmailTemplate.is_active == True,
        models.EmailTemplate.trigger_day.isnot(None),
    ).all()
    reengagement_templates = db.query(models.EmailTemplate).filter(
        models.EmailTemplate.is_active == True,
        models.EmailTemplate.inactive_days.isnot(None),
    ).order_by(models.EmailTemplate.id).all()

    if not milestone_templates and not reengagement_templates:
        return {"sent": sent, "total_users_checked": 0, "note": "No active templates"}

    milestones = sorted(
        [(t.trigger_day, t.template_key) for t in milestone_templates],
        key=lambda x: x[0],
    )

    users = db.query(models.User).filter(
        models.User.email_verified == True,
        or_(models.User.is_archived == False, models.User.is_archived == None),
    ).all()

    for user in users:
        if total_sent >= daily_cap:
            stopped_early = f"daily_cap ({daily_cap}) reached"
            break

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
                        total_sent += 1
                        sent_keys.add(tkey)
                        break

            if reengagement_templates and last_active_days is not None and days_since_signup > 3:
                matched = _match_reengagement(reengagement_templates, user, last_active_days, sent_keys)
                if matched:
                    if _send_template_email(matched.template_key, user.email, variables, db):
                        sent["reengagement"] += 1
                        total_sent += 1

        except _resend_exc.RateLimitError:
            stopped_early = "Resend RateLimitError — daily quota exhausted"
            logger.warning(f"admin/onboarding-emails: {stopped_early} after {total_sent} sends")
            break
        except Exception as e:
            logger.error(f"Failed to send onboarding email to {user.email}: {e}")

    result: dict = {"sent": sent, "total_sent": total_sent, "total_users_checked": len(users)}
    if stopped_early:
        result["stopped_early"] = stopped_early
    return result


# ╔═════════════════════════════════════════════════════════════════╗
# ║                  PUSH NOTIFICATIONS                              ║
# ╠═════════════════════════════════════════════════════════════════╣
# ║ Token registration + per-category preferences (mobile-facing).   ║
# ║ Templated lifecycle pushes via daily cron.                       ║
# ║ Admin endpoints for ad-hoc test sends, broadcasts, and metrics.  ║
# ║ Event hooks fire from main.py inline (badge, friend, donation).  ║
# ╚═════════════════════════════════════════════════════════════════╝



def _push_variables_for_user(db: Session, user: models.User, extra: dict | None = None) -> dict:
    """Build the {placeholder} dict shared across all push templates."""
    animals_count = db.query(func.count(models.UserAnimal.id)).filter(
        models.UserAnimal.user_id == user.id
    ).scalar() or 0
    badges_count = db.query(func.count(models.UserBadge.id)).filter(
        models.UserBadge.user_id == user.id
    ).scalar() or 0
    return {
        "name": user.username or "there",
        "total_minutes": str(user.total_study_minutes or 0),
        "animals_count": str(animals_count),
        "streak": str(user.current_streak or 0),
        "longest_streak": str(user.longest_streak or 0),
        "sessions": str(user.total_sessions or 0),
        "badges": str(badges_count),
        **(extra or {}),
    }


def _safe_send_push(template_key: str, user: models.User, db: Session, extra_vars: dict | None = None) -> None:
    """Fire-and-forget helper for inline event hooks. Never raises."""
    if not user or not user.push_token:
        return
    try:
        push_service.send_template_to_user(
            db, user, template_key,
            _push_variables_for_user(db, user, extra_vars),
        )
    except Exception as e:
        logger.error(f"Inline push send failed (template={template_key}, user={user.id}): {e}")


# ── User-facing endpoints ────────────────────────────────────────

class PushTokenRegister(BaseModel):
    token: str = Field(..., min_length=10, max_length=200)
    platform: Optional[str] = Field(None, pattern="^(ios|android)$")


class NotificationPrefsUpdate(BaseModel):
    notification_enabled: Optional[bool] = None
    notif_badges_enabled: Optional[bool] = None
    notif_friends_enabled: Optional[bool] = None
    notif_reminders_enabled: Optional[bool] = None
    notif_marketing_enabled: Optional[bool] = None
    study_reminder_hour: Optional[int] = Field(None, ge=0, le=23)
    study_reminder_minute: Optional[int] = Field(None, ge=0, le=59)


@app.put("/users/me/push-token")
@limiter.limit("30/minute")
def register_push_token(
    request: Request,
    body: PushTokenRegister,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Register or update the Expo push token for the authenticated user.

    Called by the mobile app on every cold start (after permission has been
    granted) since Expo tokens can rotate. Idempotent — same token replaces
    the old timestamp without disturbing prefs.
    """
    token = body.token.strip()
    if not push_service.is_valid_expo_token(token):
        raise HTTPException(status_code=400, detail="Invalid Expo push token format")
    current_user.push_token = token
    current_user.push_token_updated_at = datetime.utcnow()
    if body.platform:
        current_user.push_platform = body.platform
    db.commit()
    return {
        "ok": True,
        "push_token_updated_at": current_user.push_token_updated_at.isoformat(),
        "platform": current_user.push_platform,
    }


@app.delete("/users/me/push-token")
def remove_push_token(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Clear the push token (e.g. user logged out or revoked permissions)."""
    current_user.push_token = None
    current_user.push_token_updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@app.get("/users/me/notification-prefs")
def get_notification_prefs(current_user: models.User = Depends(get_current_user)):
    return {
        "notification_enabled": bool(current_user.notification_enabled),
        "notif_badges_enabled": bool(getattr(current_user, "notif_badges_enabled", True)),
        "notif_friends_enabled": bool(getattr(current_user, "notif_friends_enabled", True)),
        "notif_reminders_enabled": bool(getattr(current_user, "notif_reminders_enabled", True)),
        "notif_marketing_enabled": bool(getattr(current_user, "notif_marketing_enabled", True)),
        "study_reminder_hour": current_user.study_reminder_hour,
        "study_reminder_minute": current_user.study_reminder_minute,
        "has_push_token": bool(current_user.push_token),
    }


@app.put("/users/me/notification-prefs")
def update_notification_prefs(
    body: NotificationPrefsUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    payload = body.model_dump(exclude_unset=True)
    for k, v in payload.items():
        setattr(current_user, k, v)
    db.commit()
    return get_notification_prefs(current_user=current_user)


# ── Admin endpoints ──────────────────────────────────────────────

class AdminPushTest(BaseModel):
    user_id: int
    title: str = Field(..., min_length=1, max_length=80)
    body: str = Field(..., min_length=1, max_length=220)
    deep_link: Optional[str] = Field(None, max_length=120)


class AdminPushBroadcast(BaseModel):
    cohort_key: str  # one of CAMPAIGN_COHORTS keys, OR "all_users", "all_with_token"
    title: str = Field(..., min_length=1, max_length=80)
    body: str = Field(..., min_length=1, max_length=220)
    category: str = Field("campaign", max_length=30)
    deep_link: Optional[str] = Field(None, max_length=120)
    template_key: Optional[str] = Field(None, max_length=80)


class AdminPushTemplateUpsert(BaseModel):
    template_key: str = Field(..., min_length=1, max_length=80)
    name: str = Field(..., min_length=1, max_length=120)
    title: str = Field(..., min_length=1, max_length=80)
    body: str = Field(..., min_length=1, max_length=220)
    category: str = Field("marketing", max_length=30)
    deep_link: Optional[str] = Field(None, max_length=120)
    trigger_day: Optional[int] = None
    inactive_days: Optional[int] = None
    is_active: bool = True


@app.get("/admin/push/opt-in-funnel")
def admin_push_opt_in_funnel(db: Session = Depends(get_db), _=Depends(verify_admin)):
    """How many users have given push permission, opted into each category."""
    archived_filter = or_(models.User.is_archived == False, models.User.is_archived == None)  # noqa: E712
    total = db.query(func.count(models.User.id)).filter(archived_filter).scalar() or 0
    with_token = db.query(func.count(models.User.id)).filter(
        archived_filter, models.User.push_token.isnot(None)
    ).scalar() or 0
    master_on = db.query(func.count(models.User.id)).filter(
        archived_filter, models.User.push_token.isnot(None),
        models.User.notification_enabled == True,  # noqa: E712
    ).scalar() or 0

    def _cat_count(col):
        return db.query(func.count(models.User.id)).filter(
            archived_filter, models.User.push_token.isnot(None),
            models.User.notification_enabled == True,  # noqa: E712
            col == True,  # noqa: E712
        ).scalar() or 0

    return {
        "total_users": total,
        "with_push_token": with_token,
        "master_on": master_on,
        "by_category": {
            "badges": _cat_count(models.User.notif_badges_enabled),
            "friends": _cat_count(models.User.notif_friends_enabled),
            "reminders": _cat_count(models.User.notif_reminders_enabled),
            "marketing": _cat_count(models.User.notif_marketing_enabled),
        },
        "ios_tokens": db.query(func.count(models.User.id)).filter(
            archived_filter, models.User.push_token.isnot(None),
            models.User.push_platform == "ios",
        ).scalar() or 0,
        "android_tokens": db.query(func.count(models.User.id)).filter(
            archived_filter, models.User.push_token.isnot(None),
            models.User.push_platform == "android",
        ).scalar() or 0,
    }


@app.get("/admin/betterstack-status")
def admin_betterstack_status(_=Depends(verify_admin)):
    """Fetch and parse the public BetterStack status page for status.endura.eco.

    Returns structured JSON so the admin dashboard can display live uptime data
    without redirecting away. Cached for 60 s on the server to avoid hammering
    the status page on every auto-refresh.
    """
    import re
    import time
    import threading

    # Simple in-process cache (60 s TTL) — no extra dependency needed.
    cache = getattr(admin_betterstack_status, "_cache", None)
    if cache and time.time() - cache["ts"] < 60:
        return cache["data"]

    STATUS_URL = "https://status.endura.eco/"
    try:
        import requests as _req
        resp = _req.get(STATUS_URL, timeout=8, headers={"User-Agent": "EnduraAdmin/1.0"})
        html = resp.text
    except Exception as e:
        return {"ok": False, "error": str(e), "source": STATUS_URL}

    def _find(pattern, default="—"):
        m = re.search(pattern, html, re.IGNORECASE | re.DOTALL)
        return m.group(1).strip() if m else default

    # Extract overall banner: "All services are online" / "Partial outage" / etc.
    overall = _find(r'<h1[^>]*>\s*(.*?)\s*</h1>', "Unknown")
    # Strip HTML tags from overall in case there are nested elements
    overall = re.sub(r"<[^>]+>", "", overall).strip() or "Unknown"

    # Extract per-service blocks — BetterStack renders each monitor as a row.
    # Pattern: service name followed by status word.
    services = []
    # Grab all "name ... Operational|Degraded|Outage|Maintenance" pairs
    service_blocks = re.findall(
        r'(?:Operational|Degraded Performance|Partial Outage|Major Outage|Under Maintenance)',
        html, re.IGNORECASE
    )
    # Simpler: scan for the known service name + its status
    for name_pat, status_pat in re.findall(
        r'(endura\.eco|endura api|backend|frontend)\b.*?'
        r'(Operational|Degraded Performance|Partial Outage|Major Outage|Under Maintenance)',
        html, re.IGNORECASE | re.DOTALL
    ):
        services.append({"name": name_pat, "status": status_pat})

    # If regex above yields nothing fall back to counting status words in HTML
    if not services:
        for word in ["Operational", "Degraded Performance", "Partial Outage", "Major Outage"]:
            if word.lower() in html.lower():
                services.append({"name": "endura.eco", "status": word})
                break

    # Uptime percentage — "100% uptime" or "99.9% uptime"
    uptime_pct = _find(r'(\d+(?:\.\d+)?%)\s*uptime')

    # Last-updated timestamp
    last_updated = _find(r'[Ll]ast updated[^:]*[:\s]+(.*?(?:\d{4}.*?)(?=\s*(?:<|\n|$)))')
    last_updated = re.sub(r"<[^>]+>", "", last_updated).strip()

    # 30-day status blocks — look for "Operational" / "Not monitored" day entries
    day_blocks = re.findall(
        r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})[^\n]*\n\s*(Operational|Not monitored|Degraded|Outage)',
        html, re.IGNORECASE
    )
    history = [
        {"date": f"{m} {d} {y}", "status": s}
        for m, d, y, s in day_blocks[-30:]
    ]

    is_ok = "online" in overall.lower() or any(
        s.get("status", "").lower() == "operational" for s in services
    )

    result = {
        "ok": is_ok,
        "overall": overall,
        "services": services if services else [{"name": "endura.eco", "status": "Operational" if is_ok else "Unknown"}],
        "uptime_pct": uptime_pct,
        "last_updated": last_updated,
        "history": history,
        "source": STATUS_URL,
        "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    admin_betterstack_status._cache = {"ts": time.time(), "data": result}
    return result


@app.get("/admin/push/metrics")
def admin_push_metrics(
    days: int = 30,
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    """Aggregate push send / failure / drop counts over the last N days."""
    cutoff = datetime.utcnow() - timedelta(days=max(1, min(days, 365)))
    rows = db.query(
        models.PushLog.category,
        models.PushLog.status,
        func.count(models.PushLog.id),
    ).filter(models.PushLog.sent_at >= cutoff).group_by(
        models.PushLog.category, models.PushLog.status
    ).all()

    by_category: dict[str, dict[str, int]] = {}
    totals = {"sent": 0, "failed": 0, "dropped": 0}
    for cat, status, count in rows:
        cat_key = cat or "uncategorised"
        by_category.setdefault(cat_key, {"sent": 0, "failed": 0, "dropped": 0})
        by_category[cat_key][status] = (by_category[cat_key].get(status) or 0) + count
        if status in totals:
            totals[status] += count

    recent = db.query(models.PushLog).order_by(
        models.PushLog.sent_at.desc()
    ).limit(50).all()
    recent_payload = [{
        "id": r.id,
        "user_id": r.user_id,
        "template_key": r.template_key,
        "category": r.category,
        "title": r.title,
        "body": r.body,
        "status": r.status,
        "error_code": r.error_code,
        "error_message": r.error_message,
        "sent_at": r.sent_at.isoformat() if r.sent_at else None,
    } for r in recent]
    return {
        "window_days": days,
        "totals": totals,
        "by_category": by_category,
        "recent": recent_payload,
    }


@app.get("/admin/push/templates")
def admin_push_list_templates(db: Session = Depends(get_db), _=Depends(verify_admin)):
    rows = db.query(models.PushTemplate).order_by(
        models.PushTemplate.category, models.PushTemplate.template_key
    ).all()
    return [{
        "id": t.id,
        "template_key": t.template_key,
        "name": t.name,
        "title": t.title,
        "body": t.body,
        "category": t.category,
        "deep_link": t.deep_link,
        "trigger_day": t.trigger_day,
        "inactive_days": t.inactive_days,
        "is_active": t.is_active,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    } for t in rows]


@app.put("/admin/push/templates/{template_key}")
def admin_push_upsert_template(
    template_key: str,
    body: AdminPushTemplateUpsert,
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    if body.template_key != template_key:
        raise HTTPException(status_code=400, detail="template_key in path and body must match")
    existing = db.query(models.PushTemplate).filter(
        models.PushTemplate.template_key == template_key
    ).first()
    if existing:
        for k, v in body.model_dump().items():
            setattr(existing, k, v)
    else:
        existing = models.PushTemplate(**body.model_dump())
        db.add(existing)
    db.commit()
    db.refresh(existing)
    return {"ok": True, "id": existing.id, "updated_at": existing.updated_at.isoformat()}


@app.post("/admin/push/test")
def admin_push_test(
    body: AdminPushTest,
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    """Send a one-off test push to a specific user (bypasses category prefs
    by setting category='system' so admin can verify delivery end-to-end).
    """
    user = db.query(models.User).filter(models.User.id == body.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.push_token:
        raise HTTPException(status_code=400, detail="User has no push token registered")
    result = push_service.send_to_user(
        db, user,
        title=body.title, body=body.body,
        category="system",  # always send for admin tests
        deep_link=body.deep_link,
        data={"admin_test": True},
    )
    return result


def _resolve_cohort_users(db: Session, cohort_key: str) -> list[models.User]:
    """Reuse the email campaign cohorts where possible. Adds a few push-only ones."""
    archived_filter = or_(models.User.is_archived == False, models.User.is_archived == None)  # noqa: E712
    has_token = models.User.push_token.isnot(None)

    if cohort_key == "all_users":
        return db.query(models.User).filter(archived_filter).all()
    if cohort_key == "all_with_token":
        return db.query(models.User).filter(archived_filter, has_token).all()
    if cohort_key == "active_7d":
        cutoff = datetime.utcnow() - timedelta(days=7)
        return db.query(models.User).filter(
            archived_filter, has_token,
            models.User.last_study_date.isnot(None),
            models.User.last_study_date >= cutoff,
        ).all()
    if cohort_key == "inactive_7d":
        cutoff = datetime.utcnow() - timedelta(days=7)
        return db.query(models.User).filter(
            archived_filter, has_token,
            or_(models.User.last_study_date.is_(None), models.User.last_study_date < cutoff),
        ).all()

    if cohort_key not in CAMPAIGN_COHORTS:
        raise HTTPException(status_code=400, detail=f"Unknown cohort: {cohort_key}")

    if cohort_key == "verify_email":
        return db.query(models.User).filter(
            archived_filter, has_token,
            models.User.email_verified == False,  # noqa: E712
        ).all()
    if cohort_key == "start_timer":
        verified_ids = [u.id for u in db.query(models.User.id).filter(
            archived_filter, has_token, models.User.email_verified == True,  # noqa: E712
        ).all()]
        with_sessions = {r[0] for r in db.query(models.StudySession.user_id).filter(
            models.StudySession.user_id.in_(verified_ids)
        ).distinct().all()} if verified_ids else set()
        ids = [uid for uid in verified_ids if uid not in with_sessions]
        return db.query(models.User).filter(models.User.id.in_(ids)).all() if ids else []
    if cohort_key == "second_timer":
        verified_ids = [u.id for u in db.query(models.User.id).filter(
            archived_filter, has_token, models.User.email_verified == True,  # noqa: E712
        ).all()]
        counts = dict(
            db.query(models.StudySession.user_id, func.count(models.StudySession.id))
            .filter(models.StudySession.user_id.in_(verified_ids))
            .group_by(models.StudySession.user_id).all()
        ) if verified_ids else {}
        ids = [uid for uid, c in counts.items() if c == 1]
        return db.query(models.User).filter(models.User.id.in_(ids)).all() if ids else []
    if cohort_key == "invite_friends":
        verified_ids = [u.id for u in db.query(models.User.id).filter(
            archived_filter, has_token, models.User.email_verified == True,  # noqa: E712
        ).all()]
        counts = dict(
            db.query(models.StudySession.user_id, func.count(models.StudySession.id))
            .filter(models.StudySession.user_id.in_(verified_ids))
            .group_by(models.StudySession.user_id).all()
        ) if verified_ids else {}
        ids = [uid for uid, c in counts.items() if c >= 2]
        return db.query(models.User).filter(models.User.id.in_(ids)).all() if ids else []
    return []


@app.post("/admin/push/broadcast")
def admin_push_broadcast(
    body: AdminPushBroadcast,
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    """Broadcast an ad-hoc push to a cohort. Honours per-category prefs.

    Cohort keys:
      - all_users, all_with_token, active_7d, inactive_7d
      - verify_email, start_timer, second_timer, invite_friends (mirrors emails)
    """
    users = _resolve_cohort_users(db, body.cohort_key)
    if not users:
        return {"sent": 0, "dropped": 0, "failed": 0, "total": 0, "cohort": body.cohort_key}

    title, send_body = body.title, body.body
    if body.template_key:
        tmpl = db.query(models.PushTemplate).filter(
            models.PushTemplate.template_key == body.template_key
        ).first()
        if tmpl:
            title, send_body = tmpl.title, tmpl.body  # ignored variables — broadcast is one msg

    result = push_service.broadcast_to_users(
        db, users,
        title=title, body=send_body,
        category=body.category,
        template_key=body.template_key,
        deep_link=body.deep_link,
    )
    result["cohort"] = body.cohort_key
    return result


# ── Lifecycle cron + admin trigger ───────────────────────────────

def _run_lifecycle_pushes(db: Session) -> dict:
    """Send lifecycle push templates (those with trigger_day) to eligible users.

    De-duped via PushLog: a user only ever gets a given template once. Mirrors
    the email lifecycle logic but operates on push prefs (notif_marketing for
    'campaign' templates, notif_reminders for 're-engagement' templates).
    """
    now = datetime.utcnow()
    sent_counts: dict[str, int] = {}

    lifecycle_tmpls = db.query(models.PushTemplate).filter(
        models.PushTemplate.is_active == True,  # noqa: E712
        models.PushTemplate.trigger_day.isnot(None),
    ).order_by(models.PushTemplate.trigger_day).all()
    reengagement_tmpls = db.query(models.PushTemplate).filter(
        models.PushTemplate.is_active == True,  # noqa: E712
        models.PushTemplate.inactive_days.isnot(None),
    ).order_by(models.PushTemplate.inactive_days).all()
    if not lifecycle_tmpls and not reengagement_tmpls:
        return {"sent": sent_counts, "checked": 0, "note": "no_templates"}

    archived_filter = or_(models.User.is_archived == False, models.User.is_archived == None)  # noqa: E712
    users = db.query(models.User).filter(
        archived_filter, models.User.push_token.isnot(None),
    ).all()

    for user in users:
        if not user.created_at:
            continue
        days_since_signup = (now - user.created_at).days
        last_active_days = (now - user.last_study_date).days if user.last_study_date else None

        sent_keys = {pl.template_key for pl in db.query(models.PushLog.template_key).filter(
            models.PushLog.user_id == user.id,
            models.PushLog.template_key.isnot(None),
            models.PushLog.status.in_(["sent", "delivered"]),
        ).distinct().all()}

        variables = _push_variables_for_user(db, user)

        # 1) Lifecycle: at most one trigger_day push per run, in order.
        for tmpl in lifecycle_tmpls:
            if days_since_signup >= tmpl.trigger_day and tmpl.template_key not in sent_keys:
                result = push_service.send_template_to_user(db, user, tmpl.template_key, variables)
                if result.get("ok"):
                    sent_counts[tmpl.template_key] = sent_counts.get(tmpl.template_key, 0) + 1
                    sent_keys.add(tmpl.template_key)
                    break  # one per user per run
        # 2) Re-engagement: only if user has been quiet long enough.
        if last_active_days is not None and days_since_signup > 3:
            for tmpl in reengagement_tmpls:
                if (last_active_days >= tmpl.inactive_days
                        and tmpl.template_key not in sent_keys):
                    result = push_service.send_template_to_user(db, user, tmpl.template_key, variables)
                    if result.get("ok"):
                        sent_counts[tmpl.template_key] = sent_counts.get(tmpl.template_key, 0) + 1
                        sent_keys.add(tmpl.template_key)
                        break  # one re-engagement per run

    return {"sent": sent_counts, "checked": len(users)}


def _cron_lifecycle_pushes():
    """Daily — runs after onboarding emails so app-installers get both.
    Cheaply idempotent (PushLog dedup).
    """
    from database import SessionLocal
    _db = SessionLocal()
    try:
        result = _run_lifecycle_pushes(_db)
        logger.info(f"Cron lifecycle_pushes: {result}")
    except Exception as e:
        logger.error(f"Cron lifecycle_pushes failed: {e}", exc_info=True)
    finally:
        _db.close()


@app.post("/admin/push/lifecycle-run")
def admin_run_lifecycle_pushes(db: Session = Depends(get_db), _=Depends(verify_admin)):
    """Manual trigger for lifecycle pushes (idempotent, safe to call repeatedly)."""
    return _run_lifecycle_pushes(db)


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
    # Short codes / abbreviations → full name
    "uk": "United Kingdom",
    "UK": "United Kingdom",
    "Uk": "United Kingdom",
    "us": "United States",
    "US": "United States",
    "Us": "United States",
    "USA": "United States",
    "usa": "United States",
    "Usa": "United States",
    "U.S.A.": "United States",
    "U.S.": "United States",
    "UAE": "United Arab Emirates",
    "uae": "United Arab Emirates",
    "KSA": "Saudi Arabia",
    "ksa": "Saudi Arabia",
    "Ksa": "Saudi Arabia",
    "KZ": "Kazakhstan",
    "Kz": "Kazakhstan",
    "kz": "Kazakhstan",
    "PH": "Philippines",
    "ph": "Philippines",
    "Ph": "Philippines",
    "PK": "Pakistan",
    "pk": "Pakistan",
    "Pk": "Pakistan",
    "DE": "Germany",
    "de": "Germany",
    "FR": "France",
    "fr": "France",
    "BR": "Brazil",
    "br": "Brazil",
    "IN": "India",
    "in": "India",
    "CN": "China",
    "cn": "China",
    "JP": "Japan",
    "jp": "Japan",
    "KR": "South Korea",
    "kr": "South Korea",
    "RU": "Russia",
    "ru": "Russia",
    "TR": "Turkey",
    "tr": "Turkey",
    "VN": "Vietnam",
    "vn": "Vietnam",
    "ID": "Indonesia",
    "id": "Indonesia",
    # Typos + local-language spellings
    "india": "India",
    "egypt": "Egypt",
    "argentina": "Argentina",
    "armenia": "Armenia",
    "norway": "Norway",
    "italia": "Italy",
    "Italia": "Italy",
    "Srilanka": "Sri Lanka",
    "Sri lanka": "Sri Lanka",
    "sri Lanka": "Sri Lanka",
    "Phillipines": "Philippines",
    "Philipines": "Philippines",
    "Filipinas": "Philippines",
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
    "Казахстан": "Kazakhstan",
    "Россия": "Russia",
    "Україна": "Ukraine",
    "Deutschland": "Germany",
    "Nederland": "Netherlands",
    "Polska": "Poland",
    "Magyar": "Hungary",
    "Magyarország": "Hungary",
    "中国": "China",
    "日本": "Japan",
    "한국": "South Korea",
    "대한민국": "South Korea",
    "Baku": "Azerbaijan",
    "Guayaquil": "Ecuador",
    "Kurdistan": "Iraq",
    "Kalimantan utara": "Indonesia",
    "ub": "Mongolia",
    "UB": "Mongolia",
    "Korea, Republic of": "South Korea",
    "Korea": "South Korea",
    "\U0001f1ee\U0001f1f6": "Iraq",
}

# Values that are obviously not countries — set to NULL on cleanup
COUNTRY_JUNK_VALUES = {"Haha", "blublublu", "cute", "test", "Test", "TEST", "asdf", "none", "None", "N/A", "n/a", "-", ".", "?"}

# Canonical country names we trust as valid. Anything not in this set and not
# covered by COUNTRY_CLEANUP_MAP is considered junk and will be replaced from
# PostHog geoip data (or nulled out if PostHog has no data for that user).
VALID_COUNTRY_NAMES = {
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda",
    "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain",
    "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
    "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria",
    "Burkina Faso", "Burundi", "Cambodia", "Cameroon", "Canada", "Cape Verde",
    "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros",
    "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic", "Czechia",
    "Denmark", "Djibouti", "Dominica", "Dominican Republic", "East Timor", "Ecuador",
    "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini",
    "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany",
    "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
    "Haiti", "Honduras", "Hong Kong", "Hungary", "Iceland", "India", "Indonesia",
    "Iran", "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast", "Jamaica", "Japan",
    "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan",
    "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein",
    "Lithuania", "Luxembourg", "Macao", "Madagascar", "Malawi", "Malaysia",
    "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius",
    "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco",
    "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands",
    "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia",
    "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea",
    "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Puerto Rico", "Qatar",
    "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia",
    "Saint Vincent and the Grenadines", "Samoa", "San Marino",
    "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles",
    "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands",
    "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka",
    "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan",
    "Tanzania", "Thailand", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia",
    "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates",
    "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu",
    "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
}

# (Previous static POSTHOG_GEOIP_BACKFILL dict was retired Apr 2026 in favour of
# _posthog_geoip_lookup(), which queries PostHog live.)


def _posthog_geoip_lookup(lookback_days: int = 180) -> tuple[dict[int, str], str]:
    """Query PostHog for the resolved $geoip_country_name per user.

    Uses the `persons` table (one row per merged identity) rather than scanning
    `events`. PostHog stores the latest geoip on the person itself, so this
    query is O(persons) not O(events) and finishes in <1s even with millions
    of events.

    We JOIN `person_distinct_ids` to find the numeric distinct_id for each
    person — that's the value the mobile app passes to posthog.identify() and
    is how we map back to user.id.

    `lookback_days` is kept for API compat but ignored (person properties
    reflect latest state, not a time window).

    Returns (user_id -> country, status_message). Never raises.
    """
    key = _posthog_key()
    if not key:
        return {}, "POSTHOG_PERSONAL_API_KEY not set — skipping live geo lookup"

    # Note: HogQL doesn't support toInt64OrNull / toIntOrNull — use regex match
    # to keep only distinct_ids that look like numeric user.ids (post-login).
    hogql = """
    SELECT
        pdi.distinct_id AS did,
        persons.properties.$geoip_country_name AS country
    FROM persons
    INNER JOIN person_distinct_ids AS pdi ON pdi.person_id = persons.id
    WHERE persons.properties.$geoip_country_name IS NOT NULL
      AND persons.properties.$geoip_country_name != ''
      AND match(pdi.distinct_id, '^[0-9]+$')
    LIMIT 200000
    """

    try:
        project_id = _posthog_state.get("project_id")
        if not project_id:
            with httpx.Client(timeout=15.0) as client:
                r = client.get(f"{_POSTHOG_HOST}/api/projects/", headers={"Authorization": f"Bearer {key}"})
                if r.status_code >= 400:
                    return {}, f"PostHog /projects/ {r.status_code}: {r.text[:150]}"
                results = r.json().get("results") or []
                if not results:
                    return {}, "PostHog returned no projects"
                project_id = results[0]["id"]
                _posthog_state["project_id"] = project_id
                _posthog_state["project_name"] = results[0].get("name")

        with httpx.Client(timeout=60.0) as client:
            r = client.post(
                f"{_POSTHOG_HOST}/api/projects/{project_id}/query/",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"query": {"kind": "HogQLQuery", "query": hogql}},
            )
            if r.status_code >= 400:
                return {}, f"PostHog query {r.status_code}: {r.text[:200]}"
            rows = r.json().get("results") or []
    except Exception as e:
        return {}, f"PostHog lookup error: {e}"

    mapping: dict[int, str] = {}
    for row in rows:
        did, country = row[0], row[1]
        if not country:
            continue
        try:
            uid = int(str(did).strip())
        except (TypeError, ValueError):
            continue
        if not (0 < uid < 10_000_000):
            continue
        canonical = COUNTRY_CLEANUP_MAP.get(country, country)
        mapping[uid] = canonical

    status = (
        f"PostHog persons table: {len(mapping)} users mapped "
        f"(source: persons.properties.$geoip_country_name)"
    )
    return mapping, status


@app.post("/admin/cleanup-countries")
def admin_cleanup_countries(
    lookback_days: int = 365,
    overwrite_with_posthog: bool = True,
    clear_unverifiable_junk: bool = True,
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    """Authoritative country cleanup driven by PostHog `$geoip_country_name`.

    Pipeline:
      1. Apply COUNTRY_CLEANUP_MAP (typos, short codes, local spellings → canonical)
      2. Null-out COUNTRY_JUNK_VALUES (obvious garbage)
      3. Pull live geoip per user from PostHog (last `lookback_days`)
      4. For every user:
           - If user.country is blank → backfill from PostHog
           - If user.country is a VALID canonical name → leave it
           - Else (still junk after step 1, e.g. "HH", "Hamburg", random text)
               - If PostHog has data for that user → overwrite with PostHog value
               - Else if `clear_unverifiable_junk` → set to NULL
    Safe to run repeatedly.
    """
    updated: dict[str, int] = {}

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

    # Live PostHog geoip (never raises — returns empty dict + status on error)
    geo_map, geo_status = _posthog_geoip_lookup(lookback_days=lookback_days)

    # Any country name PostHog emits is canonical (it comes from MaxMind)
    known_countries = VALID_COUNTRY_NAMES | set(geo_map.values()) | set(COUNTRY_CLEANUP_MAP.values())

    users = db.query(models.User).all()

    backfilled = 0
    overwritten = 0
    cleared = 0
    backfill_samples: list[str] = []
    overwrite_samples: list[str] = []
    cleared_samples: list[str] = []
    still_blank_users: list[str] = []
    still_junk_users: list[str] = []

    for user in users:
        current_raw = user.country
        current = (current_raw or "").strip()
        posthog_country = geo_map.get(user.id)

        if not current:
            # Blank → backfill from PostHog if we have it
            if posthog_country:
                user.country = posthog_country
                backfilled += 1
                if len(backfill_samples) < 25:
                    backfill_samples.append(f"{user.username or f'#{user.id}'} → {posthog_country}")
            else:
                still_blank_users.append(user.username or f"#{user.id}")
            continue

        if current in known_countries:
            continue  # already canonical

        # Value is suspect (short code, typo, random text, emoji, etc.)
        if posthog_country and overwrite_with_posthog:
            if len(overwrite_samples) < 25:
                overwrite_samples.append(f"{user.username or f'#{user.id}'}: '{current}' → {posthog_country}")
            user.country = posthog_country
            overwritten += 1
        elif clear_unverifiable_junk:
            if len(cleared_samples) < 25:
                cleared_samples.append(f"{user.username or f'#{user.id}'}: '{current}' → NULL")
            user.country = None
            cleared += 1
        else:
            still_junk_users.append(f"{user.username or f'#{user.id}'}: '{current}'")

    db.commit()

    country_rows = (
        db.query(models.User.country, func.count(models.User.id))
        .filter(models.User.country.isnot(None), models.User.country != "")
        .group_by(models.User.country)
        .order_by(func.count(models.User.id).desc())
        .all()
    )

    return {
        "posthog_status": geo_status,
        "posthog_user_map_size": len(geo_map),
        "map_changes": updated,
        "map_changes_total": sum(updated.values()),
        "backfilled_blanks": backfilled,
        "backfill_samples": backfill_samples,
        "overwritten_junk": overwritten,
        "overwrite_samples": overwrite_samples,
        "cleared_unverifiable": cleared,
        "cleared_samples": cleared_samples,
        "still_blank": len(still_blank_users),
        "still_blank_users": still_blank_users[:30],
        "still_junk": len(still_junk_users),
        "still_junk_users": still_junk_users[:30],
        "current_countries": [{"country": r[0], "users": r[1]} for r in country_rows],
    }


# ── Schools audit & cleanup ──────────────────────────────────────

def _normalize_school_name(name: str | None) -> str:
    """Canonicalise school name for duplicate detection.
    Trim, lowercase, collapse whitespace, strip trivial punctuation."""
    if not name:
        return ""
    s = name.strip().lower()
    # Collapse whitespace
    s = re.sub(r"\s+", " ", s)
    # Strip trailing/leading punctuation that doesn't change identity
    s = s.strip(" .,-_\t")
    # Common expansions so "u of t" and "university of toronto" can group
    s = s.replace(" & ", " and ")
    # Normalize unicode quotes/dashes
    s = s.replace("–", "-").replace("—", "-").replace("'", "'")
    return s


@app.get("/admin/schools/audit")
def admin_schools_audit(
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    """Read-only: surface duplicate school names and messy country values."""
    schools = db.query(models.School).all()
    total = len(schools)

    # Group by normalized (name, country) to find duplicates
    groups: dict[tuple[str, str], list[models.School]] = {}
    for s in schools:
        key = (_normalize_school_name(s.name), (s.country or "").strip().lower())
        groups.setdefault(key, []).append(s)

    duplicate_groups: list[dict] = []
    for (norm_name, norm_country), rows in groups.items():
        if len(rows) < 2:
            continue
        duplicate_groups.append({
            "normalized_name": norm_name,
            "normalized_country": norm_country,
            "count": len(rows),
            "variants": [
                {
                    "id": r.id,
                    "name": r.name,
                    "city": r.city,
                    "region": r.region,
                    "country": r.country,
                }
                for r in rows
            ],
        })
    duplicate_groups.sort(key=lambda g: g["count"], reverse=True)

    # Also detect "near-duplicates" across different country values (likely same
    # school with different country spellings, e.g. "UK" vs "United Kingdom")
    by_name_only: dict[str, list[models.School]] = {}
    for s in schools:
        by_name_only.setdefault(_normalize_school_name(s.name), []).append(s)
    cross_country_dupes: list[dict] = []
    for norm_name, rows in by_name_only.items():
        distinct_countries = {(r.country or "").strip() for r in rows}
        if len(distinct_countries) > 1 and len(rows) >= 2:
            cross_country_dupes.append({
                "normalized_name": norm_name,
                "count": len(rows),
                "countries": sorted(distinct_countries),
                "variants": [
                    {"id": r.id, "name": r.name, "country": r.country, "city": r.city}
                    for r in rows
                ],
            })
    cross_country_dupes.sort(key=lambda g: g["count"], reverse=True)

    # Country distribution + junk
    country_rows = (
        db.query(models.School.country, func.count(models.School.id))
        .group_by(models.School.country)
        .order_by(func.count(models.School.id).desc())
        .all()
    )
    known_countries = VALID_COUNTRY_NAMES | set(COUNTRY_CLEANUP_MAP.values())
    junk_countries = []
    for c, n in country_rows:
        if not c or c not in known_countries:
            junk_countries.append({"country": c, "schools": n})

    total_dupe_rows = sum(g["count"] - 1 for g in duplicate_groups)

    return {
        "total_schools": total,
        "duplicate_groups": len(duplicate_groups),
        "duplicate_rows_removable": total_dupe_rows,
        "cross_country_groups": len(cross_country_dupes),
        "junk_country_values": len(junk_countries),
        "country_distribution": [{"country": r[0], "schools": r[1]} for r in country_rows],
        "junk_countries": junk_countries,
        "top_duplicates": duplicate_groups[:50],
        "cross_country_duplicates": cross_country_dupes[:30],
    }


@app.get("/admin/schools/similar")
def admin_schools_similar(
    threshold: float = 0.82,
    min_users: int = 1,
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    """Fuzzy-match school names entered by users to surface likely typos / variants.

    Uses difflib.SequenceMatcher on normalised names.  Returns clusters where
    at least two distinct raw strings are above `threshold` similarity (0-1).
    Only includes schools with at least `min_users` users.
    """
    from difflib import SequenceMatcher

    # Pull distinct (school, country, count) tuples — only compare within country.
    rows = (
        db.query(models.User.school, models.User.country, func.count(models.User.id))
        .filter(models.User.school.isnot(None), models.User.school != "")
        .group_by(models.User.school, models.User.country)
        .order_by(func.count(models.User.id).desc())
        .all()
    )

    def _sim(a: str, b: str) -> float:
        return SequenceMatcher(None, a, b).ratio()

    def _cluster_entries(entries):
        """Greedy single-linkage clustering within a list of (raw, cnt, norm) tuples."""
        clusters = []
        assigned = [False] * len(entries)
        for i, (raw_i, cnt_i, norm_i) in enumerate(entries):
            if assigned[i]:
                continue
            cluster = [(raw_i, cnt_i, norm_i)]
            assigned[i] = True
            for j, (raw_j, cnt_j, norm_j) in enumerate(entries):
                if assigned[j] or i == j:
                    continue
                if norm_i == norm_j or _sim(norm_i, norm_j) >= threshold:
                    cluster.append((raw_j, cnt_j, norm_j))
                    assigned[j] = True
            if len(cluster) > 1:
                clusters.append(cluster)
        return clusters

    # Group entries by country, then cluster within each country.
    by_country: dict[str, list[tuple[str, int, str]]] = {}
    for raw, country, cnt in rows:
        if cnt < min_users:
            continue
        key = (country or "").strip()
        by_country.setdefault(key, []).append((raw, cnt, _normalize_school_name(raw)))

    all_clusters: list[tuple[str, list]] = []  # (country, cluster)
    for country, entries in by_country.items():
        for cluster in _cluster_entries(entries):
            all_clusters.append((country, cluster))

    # Sort: most total users first, then most variants first.
    all_clusters.sort(key=lambda x: (-sum(cnt for _, cnt, _ in x[1]), -len(x[1])))

    result = []
    for country, cluster in all_clusters:
        variants = sorted(cluster, key=lambda x: -x[1])
        canonical = variants[0][0]
        total_users = sum(cnt for _, cnt, _ in variants)
        norm_canonical = _normalize_school_name(canonical)
        result.append({
            "canonical_suggestion": canonical,
            "country": country or None,
            "total_users": total_users,
            "variant_count": len(variants),
            "variants": [
                {
                    "name": raw,
                    "users": cnt,
                    "similarity": round(_sim(_normalize_school_name(raw), norm_canonical), 3),
                    "exact_match_after_normalise": _normalize_school_name(raw) == norm_canonical,
                }
                for raw, cnt, _ in variants
            ],
        })

    total_distinct = sum(len(entries) for entries in by_country.values())
    return {
        "threshold": threshold,
        "total_distinct_schools": total_distinct,
        "similar_clusters": len(result),
        "clusters": result,
    }


@app.post("/admin/schools/cleanup")
def admin_schools_cleanup(
    dry_run: bool = False,
    merge_duplicates: bool = True,
    update_user_schools: bool = True,
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    """Normalize school countries and merge exact-duplicate school rows.

    Steps:
      1. Apply `COUNTRY_CLEANUP_MAP` to `schools.country`.
      2. Null out `COUNTRY_JUNK_VALUES` in `schools.country`.
      3. If `merge_duplicates`: group by (normalized_name, normalized_country),
         keep the row with the most complete metadata (city/region), rename
         `users.school` from any alias to the canonical name, delete others.
      4. If `update_user_schools`: for any user.school string that matches a
         known alias in `COUNTRY_CLEANUP_MAP.keys()` (treating it as a
         free-text misspell), normalize it too.
    Pass `dry_run=true` to preview changes without committing.
    """
    country_updates: dict[str, int] = {}

    for old_val, new_val in COUNTRY_CLEANUP_MAP.items():
        rows = db.query(models.School).filter(models.School.country == old_val).all()
        if rows:
            for s in rows:
                s.country = new_val
            country_updates[f"{old_val} → {new_val}"] = len(rows)

    for junk in COUNTRY_JUNK_VALUES:
        rows = db.query(models.School).filter(models.School.country == junk).all()
        if rows:
            for s in rows:
                s.country = None
            country_updates[f"{junk} → NULL"] = len(rows)

    merged_groups: list[dict] = []
    user_schools_renamed = 0
    user_rename_samples: list[str] = []

    if merge_duplicates:
        # Refresh in-session
        db.flush()
        schools = db.query(models.School).all()
        groups: dict[tuple[str, str], list[models.School]] = {}
        for s in schools:
            key = (_normalize_school_name(s.name), (s.country or "").strip().lower())
            if not key[0]:
                continue
            groups.setdefault(key, []).append(s)

        for key, rows in groups.items():
            if len(rows) < 2:
                continue

            # Pick canonical: most complete (city+region non-null), then lowest id
            def completeness(r: models.School) -> tuple[int, int]:
                score = (1 if r.city else 0) + (1 if r.region else 0)
                return (-score, r.id)  # minimise → highest score, earliest id wins

            rows_sorted = sorted(rows, key=completeness)
            canonical = rows_sorted[0]
            losers = rows_sorted[1:]

            # Rename users.school values that matched any loser/canonical variant
            variant_names = {r.name for r in rows}
            if update_user_schools and variant_names:
                users_to_update = db.query(models.User).filter(
                    models.User.school.in_(variant_names),
                    models.User.school != canonical.name,
                ).all()
                for u in users_to_update:
                    if len(user_rename_samples) < 20:
                        user_rename_samples.append(
                            f"{u.username or f'#{u.id}'}: '{u.school}' → '{canonical.name}'"
                        )
                    u.school = canonical.name
                    user_schools_renamed += 1

            merged_groups.append({
                "canonical": {"id": canonical.id, "name": canonical.name, "country": canonical.country},
                "merged_count": len(losers),
                "merged_ids": [r.id for r in losers],
                "merged_names": sorted({r.name for r in losers}),
            })

            for r in losers:
                db.delete(r)

    if dry_run:
        db.rollback()
    else:
        db.commit()

    # Post-cleanup country distribution
    country_rows = (
        db.query(models.School.country, func.count(models.School.id))
        .group_by(models.School.country)
        .order_by(func.count(models.School.id).desc())
        .all()
    )

    return {
        "dry_run": dry_run,
        "country_changes": country_updates,
        "country_changes_total": sum(country_updates.values()),
        "merged_groups": len(merged_groups),
        "merged_rows_removed": sum(g["merged_count"] for g in merged_groups),
        "merge_details": merged_groups[:50],
        "user_schools_renamed": user_schools_renamed,
        "user_rename_samples": user_rename_samples,
        "current_country_distribution": [
            {"country": r[0], "schools": r[1]} for r in country_rows
        ],
        "total_schools_after": sum(r[1] for r in country_rows),
    }


# ── Test Runner (admin only) ──────────────────────────────────────────────────

def _persist_test_run(
    db: Session,
    *,
    suite: str,
    status: str,
    exit_code: Optional[int],
    passed: int,
    failed: int,
    errors: int,
    total: int,
    duration_seconds: Optional[float],
    started_at: datetime,
    failed_test_ids: Optional[list] = None,
    raw_summary: Optional[str] = None,
) -> Optional[int]:
    """Insert a TestRun row. Returns the new row id, or None on failure
    (we never want a logging failure to break the API response)."""
    try:
        import json as _json_mod
        row = models.TestRun(
            suite=suite[:20],
            status=status[:20],
            exit_code=exit_code,
            passed=int(passed or 0),
            failed=int(failed or 0),
            errors=int(errors or 0),
            total=int(total or 0),
            duration_seconds=duration_seconds,
            started_at=started_at,
            finished_at=datetime.utcnow(),
            triggered_by="admin",
            failed_tests=_json_mod.dumps((failed_test_ids or [])[:50]) if failed_test_ids else None,
            raw_summary=(raw_summary or "")[:500] or None,
        )
        db.add(row)
        db.commit()
        return row.id
    except Exception as e:
        logger.warning(f"persist_test_run failed (non-fatal): {e}")
        try:
            db.rollback()
        except Exception:
            pass
        return None


@app.post("/admin/run-tests")
def run_tests(
    suite: str = Query("all", description="Which suite to run: all | unit | api | flows"),
    x_admin_key: str = Header(...),
    db: Session = Depends(get_db),
    _: None = Depends(verify_admin),
):
    """
    Run the backend regression test suite and return structured results.
    Accepts suite=all|unit|api|flows.
    Returns JSON with pass/fail counts and per-test detail.

    Each invocation is persisted to the test_runs table for history tracking
    (visible at /admin/test-runs and on the admin dashboard's Tests tab).

    IMPORTANT: Only available when backend has pytest installed (dev/staging).
    Never run this against the production DB — it uses a separate SQLite test DB.
    """
    import subprocess
    import sys
    import json as _json_mod

    suite_map = {
        "all": "tests/",
        "unit": "tests/unit/",
        "api": "tests/api/",
        "flows": "tests/flows/",
    }
    test_path = suite_map.get(suite, "tests/")

    backend_dir = os.path.dirname(os.path.abspath(__file__))
    started_at = datetime.utcnow()

    # Run pytest with JSON report output
    cmd = [
        sys.executable, "-m", "pytest", test_path,
        "--tb=short", "-q",
        "--no-header",
        "--json-report", "--json-report-file=-",  # output JSON to stdout
        "--timeout=120",
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=backend_dir,
            timeout=180,
            env={**os.environ, "DATABASE_URL": "sqlite:///./test_endura.db"},
        )
        stdout = result.stdout or ""
        stderr = result.stderr or ""

        # Try to parse JSON report (from pytest-json-report)
        report = None
        for line in stdout.splitlines():
            if line.startswith("{") and '"tests"' in line:
                try:
                    report = _json_mod.loads(line)
                    break
                except Exception:
                    pass

        if report:
            tests = report.get("tests", [])
            summary = report.get("summary", {})
            status_str = "passed" if result.returncode == 0 else "failed"
            failed_ids = [t.get("nodeid", "") for t in tests if t.get("outcome") != "passed"]
            run_id = _persist_test_run(
                db,
                suite=suite,
                status=status_str,
                exit_code=result.returncode,
                passed=summary.get("passed", 0),
                failed=summary.get("failed", 0),
                errors=summary.get("error", 0),
                total=summary.get("total", 0),
                duration_seconds=report.get("duration", 0),
                started_at=started_at,
                failed_test_ids=failed_ids,
                raw_summary=f"{summary.get('passed', 0)} passed, {summary.get('failed', 0)} failed in {report.get('duration', 0):.1f}s",
            )
            return {
                "status": status_str,
                "suite": suite,
                "exit_code": result.returncode,
                "summary": summary,
                "passed": summary.get("passed", 0),
                "failed": summary.get("failed", 0),
                "errors": summary.get("error", 0),
                "total": summary.get("total", 0),
                "duration_seconds": report.get("duration", 0),
                "run_id": run_id,
                "tests": [
                    {
                        "id": t.get("nodeid", ""),
                        "outcome": t.get("outcome", ""),
                        "duration": round(t.get("duration", 0), 3),
                        "call_message": (
                            t.get("call", {}).get("longrepr", "") or ""
                        )[:500] if t.get("outcome") != "passed" else "",
                    }
                    for t in tests
                ],
            }

        # Fallback: return raw output if JSON report not available
        lines = stdout.splitlines()
        passed = sum(1 for l in lines if " passed" in l or "PASSED" in l)
        failed = sum(1 for l in lines if " failed" in l or "FAILED" in l)
        status_str = "passed" if result.returncode == 0 else "failed"
        run_id = _persist_test_run(
            db,
            suite=suite,
            status=status_str,
            exit_code=result.returncode,
            passed=passed,
            failed=failed,
            errors=0,
            total=passed + failed,
            duration_seconds=None,
            started_at=started_at,
            raw_summary=(stdout.splitlines()[-1] if stdout.splitlines() else "")[:500],
        )
        return {
            "status": status_str,
            "suite": suite,
            "exit_code": result.returncode,
            "summary": {"passed": passed, "failed": failed},
            "passed": passed,
            "failed": failed,
            "raw_output": (stdout + "\n" + stderr)[:8000],
            "run_id": run_id,
        }

    except subprocess.TimeoutExpired:
        _persist_test_run(
            db, suite=suite, status="timeout", exit_code=None,
            passed=0, failed=0, errors=0, total=0,
            duration_seconds=None, started_at=started_at,
            raw_summary="Timed out after 180s",
        )
        return JSONResponse(status_code=504, content={
            "error": "Test suite timed out after 3 minutes",
            "suite": suite,
        })
    except FileNotFoundError:
        _persist_test_run(
            db, suite=suite, status="error", exit_code=None,
            passed=0, failed=0, errors=0, total=0,
            duration_seconds=None, started_at=started_at,
            raw_summary="pytest not installed",
        )
        return JSONResponse(status_code=503, content={
            "error": "pytest not found — install test dependencies first (pip install pytest pytest-json-report)",
            "suite": suite,
        })
    except Exception as exc:
        logger.error(f"run-tests failed: {exc}")
        _persist_test_run(
            db, suite=suite, status="error", exit_code=None,
            passed=0, failed=0, errors=0, total=0,
            duration_seconds=None, started_at=started_at,
            raw_summary=str(exc)[:500],
        )
        return JSONResponse(status_code=500, content={
            "error": str(exc)[:500],
            "suite": suite,
        })


@app.get("/admin/test-runs")
def admin_test_runs(
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
    _=Depends(verify_admin),
):
    """Recent regression test runs, newest first. Used by the admin dashboard
    Tests tab to show history + spot flakes/regressions over time."""
    rows = (
        db.query(models.TestRun)
        .order_by(models.TestRun.started_at.desc())
        .limit(limit)
        .all()
    )
    return {
        "runs": [
            {
                "id": r.id,
                "suite": r.suite,
                "status": r.status,
                "exit_code": r.exit_code,
                "passed": r.passed,
                "failed": r.failed,
                "errors": r.errors,
                "total": r.total,
                "duration_seconds": r.duration_seconds,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "finished_at": r.finished_at.isoformat() if r.finished_at else None,
                "triggered_by": r.triggered_by,
                "raw_summary": r.raw_summary,
            }
            for r in rows
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
