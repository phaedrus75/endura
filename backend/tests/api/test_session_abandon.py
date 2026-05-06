"""Tests for the explicit-abandon flow (build 36 fix).

Background: PostHog showed ~10% of session_started events end with the
user tapping "Abandon Egg" in-app, but the client only cleared local
state. The DB row sat with completed_at=NULL and the reaper auto-credited
it 30 min later — net: explicit kills were getting full coins/streak.

This module covers:
  - POST /sessions/{id}/abandon writes abandoned_at + completed_at +
    coins_earned=0 without touching user totals.
  - The endpoint is idempotent (network retries don't double-anything).
  - The endpoint refuses to undo a session the user actually completed.
  - The reaper skips abandoned rows (the going-forward credit-leak fix).
  - GET /me/pending-hatches and POST /sessions/{id}/hatch-pending both
    refuse to surface or hatch abandoned sessions.
"""
from datetime import datetime, timedelta

import pytest

import models
import crud


def _start_session(client, headers, *, minutes: int = 25, animal_name: str = None) -> int:
    payload = {"duration_minutes": minutes}
    if animal_name:
        payload["animal_name"] = animal_name
    resp = client.post("/sessions/start", json=payload, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()["session_id"]


class TestAbandonEndpoint:
    def test_abandon_marks_row_with_abandoned_at_and_zero_coins(self, client, alice, alice_headers, db):
        sid = _start_session(client, alice_headers)
        resp = client.post(f"/sessions/{sid}/abandon", headers=alice_headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

        row = db.query(models.StudySession).filter_by(id=sid).first()
        assert row.abandoned_at is not None
        assert row.completed_at is not None  # so the row stops being "incomplete"
        assert row.coins_earned == 0

    def test_abandon_does_not_touch_user_totals(self, client, alice, alice_headers, db):
        """Abandonment must not change coins/streak/minutes — that's the
        whole point of this build. Mark a snapshot before and assert
        it's identical after the abandon call.
        """
        alice.total_coins = 500
        alice.current_coins = 500
        alice.total_study_minutes = 100
        alice.total_sessions = 4
        db.commit()

        sid = _start_session(client, alice_headers)
        client.post(f"/sessions/{sid}/abandon", headers=alice_headers)
        db.refresh(alice)

        assert alice.total_coins == 500
        assert alice.current_coins == 500
        assert alice.total_study_minutes == 100
        assert alice.total_sessions == 4

    def test_abandon_is_idempotent(self, client, alice, alice_headers, db):
        """Client retries (network-tolerant pattern, same as /complete)
        must not produce confusing errors on the second hit.
        """
        sid = _start_session(client, alice_headers)
        first = client.post(f"/sessions/{sid}/abandon", headers=alice_headers)
        assert first.status_code == 200
        second = client.post(f"/sessions/{sid}/abandon", headers=alice_headers)
        assert second.status_code == 200
        assert second.json()["status"] == "ok"
        # And the row's abandoned_at is from the FIRST call (idempotent
        # writes don't keep moving the timestamp forward).
        row = db.query(models.StudySession).filter_by(id=sid).first()
        ts1 = row.abandoned_at
        client.post(f"/sessions/{sid}/abandon", headers=alice_headers)
        db.refresh(row)
        assert row.abandoned_at == ts1

    def test_abandon_refuses_to_undo_a_real_completion(self, client, alice, alice_headers, db):
        """If the user happens to tap Abandon AFTER tapping Complete (race
        between two confirmations), don't punish them — leave the
        legitimately-credited row alone.
        """
        sid = _start_session(client, alice_headers)
        client.post(f"/sessions/{sid}/complete", json={"duration_minutes": 25}, headers=alice_headers)
        db.refresh(alice)
        coins_after_complete = alice.total_coins

        resp = client.post(f"/sessions/{sid}/abandon", headers=alice_headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "already_completed"

        row = db.query(models.StudySession).filter_by(id=sid).first()
        assert row.abandoned_at is None  # left alone
        assert row.coins_earned > 0       # original credit preserved
        db.refresh(alice)
        assert alice.total_coins == coins_after_complete  # totals untouched

    def test_abandon_404_on_unknown_session(self, client, alice_headers):
        resp = client.post("/sessions/9999999/abandon", headers=alice_headers)
        assert resp.status_code == 404

    def test_abandon_404_on_other_users_session(self, client, alice_headers, bob, bob_headers):
        sid = _start_session(client, bob_headers)
        resp = client.post(f"/sessions/{sid}/abandon", headers=alice_headers)
        assert resp.status_code == 404

    def test_abandon_requires_auth(self, client, alice, alice_headers, db):
        sid = _start_session(client, alice_headers)
        resp = client.post(f"/sessions/{sid}/abandon")
        assert resp.status_code == 401


class TestReaperSkipsAbandoned:
    """The whole point of this build: the reaper must not credit rows
    the user explicitly told us to throw away.
    """

    def test_reaper_does_not_credit_abandoned_session(self, client, alice, alice_headers, db):
        sid = _start_session(client, alice_headers)
        # Time-travel the row past expected end + grace so it would be
        # reapable if not for the abandoned_at guard.
        row = db.query(models.StudySession).filter_by(id=sid).first()
        row.started_at = datetime.utcnow() - timedelta(hours=24)
        db.commit()

        # Snapshot user totals BEFORE abandon so we can prove they don't move.
        coins_before = alice.total_coins
        sessions_before = alice.total_sessions

        # User abandons.
        client.post(f"/sessions/{sid}/abandon", headers=alice_headers)

        # Now run the reaper. It should pick up zero new credit because
        # this row is marked abandoned (and also already has completed_at
        # set — both filters protect us, this asserts the abandon filter).
        result = crud.reap_stale_sessions(db, grace_minutes=0, max_age_hours=168, limit=100)
        # The row was abandoned (completed_at + abandoned_at set) so it's
        # not even a candidate. Whether `reaped` is 0 or non-zero from
        # OTHER rows doesn't matter for this assertion — what matters is
        # OUR session didn't get credited again.
        db.refresh(alice)
        assert alice.total_coins == coins_before
        assert alice.total_sessions == sessions_before

        row = db.query(models.StudySession).filter_by(id=sid).first()
        # Crucially: auto_completed_at must NOT have been set by the
        # reaper. Abandoned rows are off-limits to the reaper entirely.
        assert row.auto_completed_at is None
        assert row.coins_earned == 0


class TestPendingHatchExcludesAbandoned:
    """If a session somehow ends up with both auto_completed_at and
    abandoned_at (legacy data, race on a back-dated abandon, etc.), the
    pending-hatch flow MUST NOT surface it. Asking the user to hatch what
    they explicitly told us to discard is the wrong behaviour.
    """

    def test_pending_hatches_excludes_abandoned_rows(self, client, alice, alice_headers, db):
        # Create a row that's BOTH auto_completed AND abandoned — the
        # belt-and-braces case where the reaper somehow won the race
        # before the abandon write landed.
        when = datetime.utcnow() - timedelta(hours=2)
        s = models.StudySession(
            user_id=alice.id,
            duration_minutes=25,
            coins_earned=25,
            started_at=when - timedelta(minutes=25),
            completed_at=when,
            auto_completed_at=when,
            abandoned_at=when,
        )
        db.add(s)
        db.commit()

        body = client.get("/me/pending-hatches", headers=alice_headers).json()
        assert body["pending"] == []

    def test_hatch_pending_refuses_abandoned_row(self, client, alice, alice_headers, db):
        when = datetime.utcnow() - timedelta(hours=2)
        s = models.StudySession(
            user_id=alice.id,
            duration_minutes=25,
            coins_earned=25,
            started_at=when - timedelta(minutes=25),
            completed_at=when,
            auto_completed_at=when,
            abandoned_at=when,
        )
        db.add(s)
        db.commit()

        animal = db.query(models.Animal).first()
        resp = client.post(
            f"/sessions/{s.id}/hatch-pending",
            json={"animal_name": animal.name},
            headers=alice_headers,
        )
        # Same 409 we use for "no pending hatch for this session" — the
        # client-facing semantics are identical.
        assert resp.status_code == 409


class TestAdminIncompleteListsAbandoned:
    """Build 36 surfacing: ops needs to see abandoned sessions in the
    "started but not completed" admin view alongside in-flight ones, so
    the abandon-rate trend is visible in the same place the silent-loss
    trend has always been monitored.
    """

    def _admin_headers(self):
        import os
        return {"X-Admin-Key": os.environ.get("ADMIN_API_KEY", "dev-only-admin-key")}

    def test_abandoned_session_shows_up_with_abandoned_status(self, client, alice, alice_headers):
        sid = _start_session(client, alice_headers)
        client.post(f"/sessions/{sid}/abandon", headers=alice_headers)

        resp = client.get(
            "/admin/sessions/incomplete",
            headers=self._admin_headers(),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["abandoned_count"] >= 1

        ours = next((s for s in body["sessions"] if s["id"] == sid), None)
        assert ours is not None, "abandoned session must appear in the incomplete list"
        assert ours["status"] == "abandoned"
        assert ours["is_abandoned"] is True
        assert ours["is_stale"] is False
        assert ours["abandoned_at"] is not None

    def test_naturally_completed_session_still_excluded(self, client, alice, alice_headers):
        """The 'abandoned shows up here too' change must not regress the
        original semantic: a normal user-completed session never appears
        on this admin tab. Otherwise the dashboard turns into noise.
        """
        sid = _start_session(client, alice_headers)
        client.post(f"/sessions/{sid}/complete", json={"duration_minutes": 25}, headers=alice_headers)

        resp = client.get(
            "/admin/sessions/incomplete",
            headers=self._admin_headers(),
        )
        assert resp.status_code == 200
        assert all(s["id"] != sid for s in resp.json()["sessions"])

    def test_reaper_rescued_session_excluded(self, client, alice, alice_headers, db):
        """Auto-completed (reaper-rescued) rows shouldn't pollute this
        view either — the user got their credit, ops doesn't need to
        chase them. They live on the recovery dashboard, not here.
        """
        sid = _start_session(client, alice_headers)
        row = db.query(models.StudySession).filter_by(id=sid).first()
        # Hand-mark as auto-completed (skip the reaper invocation; this
        # test is about the admin filter, not the reaper).
        when = datetime.utcnow() - timedelta(minutes=5)
        row.completed_at = when
        row.auto_completed_at = when
        row.coins_earned = 25
        db.commit()

        resp = client.get(
            "/admin/sessions/incomplete",
            headers=self._admin_headers(),
        )
        assert resp.status_code == 200
        assert all(s["id"] != sid for s in resp.json()["sessions"])

    def test_in_flight_status_for_fresh_session(self, client, alice, alice_headers):
        sid = _start_session(client, alice_headers)
        resp = client.get(
            "/admin/sessions/incomplete",
            headers=self._admin_headers(),
        )
        ours = next((s for s in resp.json()["sessions"] if s["id"] == sid), None)
        assert ours is not None
        # Fresh session, elapsed < duration → in flight, not stale, not abandoned.
        assert ours["status"] == "in_flight"
        assert ours["is_abandoned"] is False
        assert ours["abandoned_at"] is None
