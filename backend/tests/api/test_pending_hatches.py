"""Tests for the "hatch on next launch" recovery flow.

Background: when the reaper auto-completes a stale session, the user's
coins/streak/totals are credited but no animal hatches (the reaper has
no way to know which animal the user picked). Day-1 SQL on May 4–6
showed ~32% of new-user sessions were going through this code path,
meaning a third of new users were missing the celebration moment that
makes the app sticky.

These endpoints close that gap:

  GET  /me/pending-hatches              → sessions waiting to be celebrated
  POST /sessions/{id}/hatch-pending     → user picks the animal, we hatch

Each test documents the specific failure mode it guards against so a
future reader can map back to the activation-gap analysis.
"""
import os
from datetime import datetime, timedelta

import pytest

import models
import crud


def _make_reaped_session(
    db,
    user,
    *,
    minutes: int = 25,
    auto_completed_at: datetime = None,
    subject_name: str = None,
) -> models.StudySession:
    """Insert a session that is already in the post-reaper state:
    completed_at + auto_completed_at both set, coins credited.
    """
    subject_id = None
    if subject_name:
        sub = (
            db.query(models.Subject)
            .filter(models.Subject.name == subject_name)
            .first()
        )
        if not sub:
            sub = models.Subject(name=subject_name, display_name=subject_name.title())
            db.add(sub)
            db.flush()
        subject_id = sub.id

    when = auto_completed_at or (datetime.utcnow() - timedelta(hours=2))
    started_at = when - timedelta(minutes=minutes)
    s = models.StudySession(
        user_id=user.id,
        duration_minutes=minutes,
        coins_earned=minutes,  # mirrors the reaper crediting at 1/min
        subject_id=subject_id,
        started_at=started_at,
        completed_at=when,
        auto_completed_at=when,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


class TestGetPendingHatches:
    def test_returns_empty_when_user_has_no_reaped_sessions(self, client, alice, alice_headers):
        """No reaped sessions → empty list, 200. Cold-launch happy path
        for the vast majority of users.
        """
        resp = client.get("/me/pending-hatches", headers=alice_headers)
        assert resp.status_code == 200
        assert resp.json() == {"pending": []}

    def test_returns_reaped_session_with_subject_and_minutes(self, client, alice, alice_headers, db):
        """A single reaper-finalised session shows up with everything the
        client needs to render the celebration prompt."""
        s = _make_reaped_session(db, alice, minutes=25, subject_name="biology")

        resp = client.get("/me/pending-hatches", headers=alice_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["pending"]) == 1
        entry = body["pending"][0]
        assert entry["session_id"] == s.id
        assert entry["duration_minutes"] == 25
        assert entry["subject_name"] == "biology"
        assert entry["auto_completed_at"]  # ISO string present

    def test_excludes_client_completed_sessions(self, client, alice, alice_headers, db):
        """A normally-completed session (no auto_completed_at) must NOT show
        up — those already hatched their animal at /complete time and
        re-prompting would be a double-hatch.
        """
        normal = models.StudySession(
            user_id=alice.id,
            duration_minutes=25,
            coins_earned=25,
            started_at=datetime.utcnow() - timedelta(hours=1),
            completed_at=datetime.utcnow() - timedelta(hours=1),
            auto_completed_at=None,
        )
        db.add(normal)
        db.commit()

        resp = client.get("/me/pending-hatches", headers=alice_headers)
        assert resp.status_code == 200
        assert resp.json()["pending"] == []

    def test_excludes_sessions_older_than_recency_horizon(self, client, alice, alice_headers, db):
        """A reaped session from 30 days ago must NOT be surfaced — the
        user has long moved on and waking them up about it is bad UX.
        """
        old = datetime.utcnow() - timedelta(days=30)
        _make_reaped_session(db, alice, minutes=25, auto_completed_at=old)
        resp = client.get("/me/pending-hatches", headers=alice_headers)
        assert resp.status_code == 200
        assert resp.json()["pending"] == []

    def test_debounces_after_user_hatches_anything(self, client, alice, alice_headers, db):
        """Once the user has hatched ANY animal more recently than the
        reaped session, treat them as caught-up. This prevents the
        surprise of a 5-day-old reaped session prompting after the user
        has already hatched something today.
        """
        old_reap = datetime.utcnow() - timedelta(days=2)
        _make_reaped_session(db, alice, minutes=25, auto_completed_at=old_reap)

        # User hatched something afterwards (e.g. via a successful timer).
        animal = db.query(models.Animal).first()
        assert animal is not None
        ua = models.UserAnimal(
            user_id=alice.id,
            animal_id=animal.id,
            hatched_at=datetime.utcnow() - timedelta(hours=1),
        )
        db.add(ua)
        db.commit()

        resp = client.get("/me/pending-hatches", headers=alice_headers)
        assert resp.status_code == 200
        assert resp.json()["pending"] == []

    def test_returns_only_reaps_after_most_recent_hatch(self, client, alice, alice_headers, db):
        """Reaped session BEFORE last hatch → suppressed (caught up).
        Reaped session AFTER last hatch → surfaced.
        """
        animal = db.query(models.Animal).first()
        ua = models.UserAnimal(
            user_id=alice.id,
            animal_id=animal.id,
            hatched_at=datetime.utcnow() - timedelta(hours=6),
        )
        db.add(ua)
        db.commit()

        # Old reap (before hatch) — suppressed.
        _make_reaped_session(
            db, alice, minutes=20,
            auto_completed_at=datetime.utcnow() - timedelta(hours=12),
        )
        # New reap (after hatch) — surfaced.
        new_reap = _make_reaped_session(
            db, alice, minutes=30,
            auto_completed_at=datetime.utcnow() - timedelta(hours=1),
        )

        resp = client.get("/me/pending-hatches", headers=alice_headers)
        body = resp.json()
        assert len(body["pending"]) == 1
        assert body["pending"][0]["session_id"] == new_reap.id

    def test_returns_oldest_first_when_multiple_pending(self, client, alice, alice_headers, db):
        """Multiple pending hatches are returned oldest-first so the client
        can drain them sequentially in chronological order.
        """
        a = _make_reaped_session(
            db, alice, minutes=15,
            auto_completed_at=datetime.utcnow() - timedelta(hours=4),
        )
        b = _make_reaped_session(
            db, alice, minutes=25,
            auto_completed_at=datetime.utcnow() - timedelta(hours=2),
        )
        c = _make_reaped_session(
            db, alice, minutes=45,
            auto_completed_at=datetime.utcnow() - timedelta(minutes=30),
        )

        resp = client.get("/me/pending-hatches", headers=alice_headers)
        ids = [e["session_id"] for e in resp.json()["pending"]]
        assert ids == [a.id, b.id, c.id]

    def test_other_user_sessions_are_not_leaked(self, client, alice, bob, alice_headers, db):
        """Bob's reaped session must not appear in alice's pending list."""
        _make_reaped_session(db, bob, minutes=25)
        resp = client.get("/me/pending-hatches", headers=alice_headers)
        assert resp.json()["pending"] == []

    def test_requires_auth(self, client):
        resp = client.get("/me/pending-hatches")
        assert resp.status_code == 401


class TestHatchPendingSession:
    def test_creates_user_animal_for_picked_name(self, client, alice, alice_headers, db):
        """Happy path: user picks an animal, we hatch it. UserAnimal row
        appears in their sanctuary.
        """
        s = _make_reaped_session(db, alice, minutes=25)
        before = db.query(models.UserAnimal).filter_by(user_id=alice.id).count()

        animal = db.query(models.Animal).first()
        assert animal is not None
        resp = client.post(
            f"/sessions/{s.id}/hatch-pending",
            json={"animal_name": animal.name},
            headers=alice_headers,
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["hatched_animal"]["name"] == animal.name
        assert body["session"]["id"] == s.id

        after = db.query(models.UserAnimal).filter_by(user_id=alice.id).count()
        assert after == before + 1

    def test_does_not_double_credit_coins(self, client, alice, alice_headers, db):
        """Coins were credited at reap-time. The hatch-pending endpoint
        must NOT credit them again — that would mean the user gets paid
        twice for one session.
        """
        # Snapshot post-reap coin state.
        alice.total_coins = 1000
        alice.total_study_minutes = 100
        alice.total_sessions = 4
        db.commit()
        s = _make_reaped_session(db, alice, minutes=25)

        animal = db.query(models.Animal).first()
        client.post(
            f"/sessions/{s.id}/hatch-pending",
            json={"animal_name": animal.name},
            headers=alice_headers,
        )
        db.refresh(alice)
        assert alice.total_coins == 1000
        assert alice.total_study_minutes == 100
        assert alice.total_sessions == 4

    def test_404_when_session_does_not_exist(self, client, alice_headers):
        animal_name = "red panda"
        resp = client.post(
            "/sessions/9999999/hatch-pending",
            json={"animal_name": animal_name},
            headers=alice_headers,
        )
        assert resp.status_code == 404

    def test_404_when_session_belongs_to_another_user(self, client, alice_headers, bob, db):
        """Bob's session must 404 for alice — never reveal foreign session IDs."""
        bob_session = _make_reaped_session(db, bob, minutes=25)
        animal = db.query(models.Animal).first()
        resp = client.post(
            f"/sessions/{bob_session.id}/hatch-pending",
            json={"animal_name": animal.name},
            headers=alice_headers,
        )
        assert resp.status_code == 404

    def test_409_when_session_was_client_completed(self, client, alice, alice_headers, db):
        """A normally-completed session (no auto_completed_at) already
        hatched at /complete time. Refusing here prevents a stale UI from
        triggering a double-hatch.
        """
        s = models.StudySession(
            user_id=alice.id,
            duration_minutes=25,
            coins_earned=25,
            started_at=datetime.utcnow() - timedelta(hours=1),
            completed_at=datetime.utcnow() - timedelta(hours=1),
            auto_completed_at=None,
        )
        db.add(s)
        db.commit()
        animal = db.query(models.Animal).first()
        resp = client.post(
            f"/sessions/{s.id}/hatch-pending",
            json={"animal_name": animal.name},
            headers=alice_headers,
        )
        assert resp.status_code == 409

    def test_409_when_user_already_hatched_after_this_session(self, client, alice, alice_headers, db):
        """If the user hatched anything more recently than this session
        was reaped, they're "caught up" — re-hatching this session would
        feel arbitrary.
        """
        s = _make_reaped_session(
            db, alice, minutes=25,
            auto_completed_at=datetime.utcnow() - timedelta(hours=4),
        )
        animal = db.query(models.Animal).first()
        # User already hatched after the reaped session
        ua = models.UserAnimal(
            user_id=alice.id,
            animal_id=animal.id,
            hatched_at=datetime.utcnow() - timedelta(hours=1),
        )
        db.add(ua)
        db.commit()

        resp = client.post(
            f"/sessions/{s.id}/hatch-pending",
            json={"animal_name": animal.name},
            headers=alice_headers,
        )
        assert resp.status_code == 409

    def test_hatching_one_pending_removes_it_from_subsequent_list(
        self, client, alice, alice_headers, db,
    ):
        """End-to-end flow: GET surfaces 1 pending, POST hatches it,
        next GET returns empty. This is what the client will rely on to
        avoid re-prompting in the same session.
        """
        _make_reaped_session(db, alice, minutes=25)
        first = client.get("/me/pending-hatches", headers=alice_headers).json()
        assert len(first["pending"]) == 1
        sid = first["pending"][0]["session_id"]

        animal = db.query(models.Animal).first()
        client.post(
            f"/sessions/{sid}/hatch-pending",
            json={"animal_name": animal.name},
            headers=alice_headers,
        )

        second = client.get("/me/pending-hatches", headers=alice_headers).json()
        assert second["pending"] == []

    def test_rejects_empty_animal_name(self, client, alice, alice_headers, db):
        s = _make_reaped_session(db, alice, minutes=25)
        resp = client.post(
            f"/sessions/{s.id}/hatch-pending",
            json={"animal_name": ""},
            headers=alice_headers,
        )
        assert resp.status_code == 422

    def test_requires_auth(self, client, alice, db):
        s = _make_reaped_session(db, alice, minutes=25)
        resp = client.post(
            f"/sessions/{s.id}/hatch-pending",
            json={"animal_name": "red panda"},
        )
        assert resp.status_code == 401
