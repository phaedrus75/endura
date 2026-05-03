"""
Test configuration and shared fixtures.
Sets env vars BEFORE any app code is imported so SQLite is used throughout.
"""
import os

# Must be set before any app imports
os.environ["DATABASE_URL"] = "sqlite:///./test_endura.db"
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-must-be-32-chars"
os.environ["ADMIN_API_KEY"] = "test-admin-key"
os.environ["RESEND_API_KEY"] = "test-resend-key"
os.environ["EVERY_ORG_WEBHOOK_TOKEN"] = "test-webhook-token"
os.environ["POSTHOG_PERSONAL_API_KEY"] = "test-posthog-key"
os.environ["SENTRY_DSN"] = ""  # disable Sentry in tests

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from unittest.mock import patch, MagicMock

from database import Base, get_db
import models
import crud
from auth import get_password_hash, create_access_token

# ---------------------------------------------------------------------------
# Database engine shared across the test session
# ---------------------------------------------------------------------------
TEST_DB_URL = "sqlite:///./test_endura.db"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def _create_tables():
    """Create all DB tables once for the session, then drop them."""
    Base.metadata.create_all(bind=engine)
    # Pre-seed static data once so every test benefits without re-seeding
    _sess = TestingSessionLocal()
    try:
        crud.seed_default_subjects(_sess)
        if _sess.query(models.Animal).count() == 0:
            for name, species, rarity in [
                ("Panda", "Ailuropoda melanoleuca", "common"),
                ("Amur Leopard", "Panthera pardus orientalis", "rare"),
                ("Blue Whale", "Balaenoptera musculus", "epic"),
                ("Mountain Gorilla", "Gorilla beringei beringei", "legendary"),
                ("Polar Bear", "Ursus maritimus", "rare"),
                ("Koala", "Phascolarctos cinereus", "common"),
            ]:
                _sess.add(models.Animal(
                    name=name, species=species, rarity=rarity,
                    conservation_status="Endangered",
                    description=f"A beautiful {name}"
                ))
            _sess.commit()
    finally:
        _sess.close()
    yield
    Base.metadata.drop_all(bind=engine)
    # Remove the temp DB file
    if os.path.exists("./test_endura.db"):
        try:
            os.remove("./test_endura.db")
        except OSError:
            pass


@pytest.fixture()
def db():
    """
    Provide a clean DB session per test.
    Only clears user-generated (dynamic) tables between tests — 
    static seed data (animals, subjects, tips, shop_items) is preserved.
    """
    # Static tables that should NOT be truncated between tests
    STATIC_TABLES = {
        "animals", "subjects", "study_tips", "shop_items",
        "email_templates", "push_templates",
    }

    session = TestingSessionLocal()
    try:
        # Clear all dynamic tables in FK-safe order
        dynamic_tables = [
            t for t in reversed(Base.metadata.sorted_tables)
            if t.name not in STATIC_TABLES
        ]
        for table in dynamic_tables:
            try:
                session.execute(table.delete())
            except Exception:
                pass
        session.commit()

        # Seed subjects if missing (they're static but we check anyway)
        if session.query(models.Subject).count() == 0:
            crud.seed_default_subjects(session)

        # Seed a minimal animal set if missing
        if session.query(models.Animal).count() == 0:
            for name, species, rarity in [
                ("Panda", "Ailuropoda melanoleuca", "common"),
                ("Amur Leopard", "Panthera pardus orientalis", "rare"),
                ("Blue Whale", "Balaenoptera musculus", "epic"),
                ("Mountain Gorilla", "Gorilla beringei beringei", "legendary"),
            ]:
                session.add(models.Animal(
                    name=name, species=species, rarity=rarity,
                    conservation_status="Endangered",
                    description=f"A beautiful {name}"
                ))
            session.commit()

        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db):
    """FastAPI TestClient with test DB injected and rate limiting disabled."""
    from main import app
    import main as _main

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    # Disable rate limiting so multiple identical requests don't 429
    _main.limiter.enabled = False
    # Reset any accumulated rate limit state from previous tests
    if hasattr(_main.limiter, '_storage'):
        try:
            _main.limiter._storage.reset()
        except Exception:
            pass

    # Clear startup event handlers so seeding doesn't run on every test
    # (static seed data is already present from the session-scoped fixture)
    original_startup = list(app.router.on_startup)
    app.router.on_startup.clear()

    with TestClient(app, raise_server_exceptions=True) as c:
        yield c

    # Restore startup handlers and state
    app.router.on_startup[:] = original_startup
    app.dependency_overrides.clear()
    _main.limiter.enabled = True


# ---------------------------------------------------------------------------
# Helper functions (used directly in tests or as fixture factories)
# ---------------------------------------------------------------------------

def make_user(db, email="alice@example.com", password="password123",
              username="alice", verified=True):
    """Create a user row directly — bypasses email verification flow."""
    existing = crud.get_user_by_email(db, email)
    if existing:
        return existing
    hashed = get_password_hash(password)
    user = crud.create_user(db, email, hashed)
    user.email_verified = verified
    user.username = username
    db.commit()
    db.refresh(user)
    return user


def jwt_headers(email: str, token_version: int = 0) -> dict:
    """Return Authorization header dict with a fresh JWT for *email*."""
    token = create_access_token({"sub": email, "tv": token_version})
    return {"Authorization": f"Bearer {token}"}


def admin_headers() -> dict:
    return {"x-admin-key": "test-admin-key"}


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def alice(db):
    return make_user(db, "alice@example.com", "password123", "alice")


@pytest.fixture()
def bob(db):
    return make_user(db, "bob@example.com", "password123", "bob")


@pytest.fixture()
def alice_headers(alice):
    return jwt_headers(alice.email)


@pytest.fixture()
def bob_headers(bob):
    return jwt_headers(bob.email)


@pytest.fixture()
def mock_resend():
    """Patch Resend email sends so no real emails are fired in tests."""
    with patch("resend.Emails.send", return_value={"id": "test-email-id"}):
        yield


@pytest.fixture()
def mock_push_service():
    """Patch httpx calls inside services/push.py."""
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "data": [{"status": "ok", "id": "test-ticket-id"}]
    }
    with patch("services.push.httpx.Client") as MockClient:
        mock_instance = MagicMock()
        mock_instance.post.return_value = mock_resp
        MockClient.return_value.__enter__ = lambda s: mock_instance
        MockClient.return_value.__exit__ = MagicMock(return_value=False)
        yield mock_instance
