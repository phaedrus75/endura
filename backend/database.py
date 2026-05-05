from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import logging
import os

logger = logging.getLogger(__name__)

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./endura.db")

if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Pool sizing rationale (Postgres path)
# ────────────────────────────────────
# Single Uvicorn worker (Procfile runs without --workers, so default = 1).
# All sync `def` route handlers run in Starlette's threadpool (default 40
# threads in anyio). At peak each thread can hold one DB connection while
# its request is in-flight, so the DB pool MUST exceed 40 to avoid the
# Starlette pool feeding faster than SQLAlchemy can serve. Three cron jobs
# (onboarding emails, lifecycle pushes, reaper) hold one extra connection
# each while running, eating into the budget further.
#
# Defaults below give 50 total connections (25 base + 25 overflow) which
# leaves comfortable headroom over the 40-thread Starlette pool. Override
# via env if Railway's Postgres plan caps you lower (Hobby ≈ 20-25,
# Standard ≈ 100). pool_timeout=10s means requests fail fast instead of
# spinning for 30s and piling up — better UX and clearer Sentry signals
# (a hard 5xx within 10s vs. a creeping queue).
_pool_size = int(os.getenv("DB_POOL_SIZE", "25"))
_pool_overflow = int(os.getenv("DB_POOL_OVERFLOW", "25"))
_pool_timeout = int(os.getenv("DB_POOL_TIMEOUT", "10"))

if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_size=_pool_size,
        max_overflow=_pool_overflow,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_timeout=_pool_timeout,
        connect_args={"sslmode": "require"} if SQLALCHEMY_DATABASE_URL.startswith("postgresql") else {},
    )

    # Surface near-saturation in logs so we catch this before it fires
    # QueuePool exhausted in production. Threshold = 80% of total capacity.
    # Cheap (event handler is per-checkout, single int compare) and limited
    # by SQLAlchemy's internal pool to avoid log floods.
    _capacity = _pool_size + _pool_overflow
    _alert_threshold = max(1, int(_capacity * 0.8))

    @event.listens_for(engine, "checkout")
    def _warn_when_pool_saturated(dbapi_connection, connection_record, connection_proxy):
        try:
            in_use = engine.pool.checkedout()
            if in_use >= _alert_threshold:
                logger.warning(
                    "DB pool near capacity: checked_out=%s capacity=%s threshold=%s",
                    in_use, _capacity, _alert_threshold,
                )
        except Exception:
            # Stat collection must never break a request.
            pass

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
