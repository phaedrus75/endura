"""
Audit tests for the silent timer-disappearance fix.

Each test exercises a specific failure mode that previously produced a
PostHog `session_started` without a corresponding `session_completed`,
or a stranded incomplete row in the database. They are documented with
the failure-mode letter from the audit so future readers can map them
back to the gap analysis.
"""
import os
from datetime import datetime, timedelta

import pytest

import models
import crud


class TestStrandedRowFailureModes:
    """Failure modes where the row is created on /sessions/start but the
    completion never lands — the row sits as `completed_at IS NULL` forever
    unless something on the server reaps it.
    """

    def test_F_started_row_never_completed_stays_incomplete(
        self, client, alice, alice_headers, db
    ):
        """Mode F: client succeeded at /sessions/start, then /complete never
        landed (network drop, app killed, server 5xx, retries exhausted).
        The DB row sits as completed_at IS NULL and must surface in the
        admin dashboard. Without server-side reaping it stays there forever.
        """
        sid = client.post(
            "/sessions/start",
            json={"duration_minutes": 30},
            headers=alice_headers,
        ).json()["session_id"]

        # Pretend the row has been sitting around for an hour (timer was 30m,
        # so well past the expected end → stale).
        row = db.query(models.StudySession).filter_by(id=sid).first()
        row.started_at = datetime.utcnow() - timedelta(hours=1)
        db.commit()

        admin_key = os.environ.get("ADMIN_API_KEY", "test-admin-key")
        listed = client.get(
            "/admin/sessions/incomplete",
            headers={"X-Admin-Key": admin_key},
        )
        assert listed.status_code == 200
        body = listed.json()
        match = next((s for s in body["sessions"] if s["id"] == sid), None)
        assert match is not None
        assert match["is_stale"] is True

        # No reaper exists today; the row stays incomplete forever. This
        # documents the gap — if/when a server-side abandon-after-N-hours
        # endpoint lands, this assert flips and the test should be updated
        # to assert auto-completion instead.
        assert row.completed_at is None

    def test_D_reaper_credits_user_who_never_reopens(
        self, client, alice, alice_headers, db
    ):
        """Mode D (Gap 2 fix): user starts a timer, focuses for the duration,
        never reopens the app. The reaper finds the stale row, awards
        coins/streak, and stamps auto_completed_at so we don't double-credit.
        """
        before_coins = alice.total_coins
        before_streak = alice.current_streak
        before_minutes = alice.total_study_minutes

        sid = client.post(
            "/sessions/start",
            json={"duration_minutes": 25},
            headers=alice_headers,
        ).json()["session_id"]

        # Pretend the row started 24h ago — well past the 30m grace window
        row = db.query(models.StudySession).filter_by(id=sid).first()
        row.started_at = datetime.utcnow() - timedelta(hours=24)
        db.commit()

        admin_key = os.environ.get("ADMIN_API_KEY", "test-admin-key")
        resp = client.post(
            "/admin/sessions/reap-stale",
            json={"grace_minutes": 30, "max_age_hours": 168, "limit": 100},
            headers={"X-Admin-Key": admin_key},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["reaped"] >= 1
        assert body["users_credited"] >= 1
        assert body["coins_awarded"] > 0

        db.refresh(row)
        db.refresh(alice)
        assert row.completed_at is not None  # finalised
        assert row.auto_completed_at is not None  # marked as reaped
        assert row.coins_earned > 0
        assert alice.total_coins > before_coins
        assert alice.total_study_minutes == before_minutes + 25
        # Streak fires on first session of the day; the test alice fixture
        # starts with 0, so this should bump to 1.
        assert alice.current_streak >= max(1, before_streak)

    def test_D_reaper_skips_rows_inside_grace_window(
        self, client, alice, alice_headers, db
    ):
        """A timer that just started a few minutes ago must NOT be reaped —
        the user could still be focusing. The grace window is the safety net.
        """
        sid = client.post(
            "/sessions/start",
            json={"duration_minutes": 25},
            headers=alice_headers,
        ).json()["session_id"]
        # Don't time-travel — row is fresh.

        admin_key = os.environ.get("ADMIN_API_KEY", "test-admin-key")
        resp = client.post(
            "/admin/sessions/reap-stale",
            json={"grace_minutes": 30, "max_age_hours": 168, "limit": 100},
            headers={"X-Admin-Key": admin_key},
        )
        assert resp.status_code == 200
        body = resp.json()
        # The fresh row should be skipped, not reaped.
        row = db.query(models.StudySession).filter_by(id=sid).first()
        assert row.completed_at is None
        assert row.auto_completed_at is None

    def test_D_reaper_idempotent_no_double_credit(
        self, client, alice, alice_headers, db
    ):
        """Running the reaper twice on the same stale row must NOT
        double-credit the user.
        """
        sid = client.post(
            "/sessions/start",
            json={"duration_minutes": 25},
            headers=alice_headers,
        ).json()["session_id"]
        row = db.query(models.StudySession).filter_by(id=sid).first()
        row.started_at = datetime.utcnow() - timedelta(hours=24)
        db.commit()

        admin_key = os.environ.get("ADMIN_API_KEY", "test-admin-key")
        first = client.post(
            "/admin/sessions/reap-stale",
            json={"grace_minutes": 30, "max_age_hours": 168, "limit": 100},
            headers={"X-Admin-Key": admin_key},
        ).json()
        db.refresh(alice)
        coins_after_first = alice.total_coins
        sessions_after_first = alice.total_sessions
        assert first["reaped"] >= 1

        second = client.post(
            "/admin/sessions/reap-stale",
            json={"grace_minutes": 30, "max_age_hours": 168, "limit": 100},
            headers={"X-Admin-Key": admin_key},
        ).json()
        db.refresh(alice)
        # The same row must not be considered again — already has
        # auto_completed_at set.
        assert second["reaped"] == 0
        assert alice.total_coins == coins_after_first
        assert alice.total_sessions == sessions_after_first

    def test_D_reaper_does_not_touch_already_completed_rows(
        self, client, alice, alice_headers, db
    ):
        """A row that the client already finalised via /sessions/{id}/complete
        is invisible to the reaper (completed_at IS NOT NULL filter).
        """
        sid = client.post(
            "/sessions/start",
            json={"duration_minutes": 25},
            headers=alice_headers,
        ).json()["session_id"]
        client.post(
            f"/sessions/{sid}/complete",
            json={"duration_minutes": 25},
            headers=alice_headers,
        )
        row = db.query(models.StudySession).filter_by(id=sid).first()
        completed_at_before = row.completed_at
        coins_before = row.coins_earned

        admin_key = os.environ.get("ADMIN_API_KEY", "test-admin-key")
        resp = client.post(
            "/admin/sessions/reap-stale",
            json={"grace_minutes": 30, "max_age_hours": 168, "limit": 100},
            headers={"X-Admin-Key": admin_key},
        )
        assert resp.status_code == 200

        db.refresh(row)
        assert row.completed_at == completed_at_before
        assert row.coins_earned == coins_before
        assert row.auto_completed_at is None

    def test_D_reaper_respects_max_age_horizon(
        self, client, alice, alice_headers, db
    ):
        """Ancient rows (older than max_age_hours) must be left alone — they're
        almost certainly stale dev/test artifacts and retroactive credit a
        week later would be confusing.
        """
        sid = client.post(
            "/sessions/start",
            json={"duration_minutes": 25},
            headers=alice_headers,
        ).json()["session_id"]
        row = db.query(models.StudySession).filter_by(id=sid).first()
        # 200h ago — older than the 168h horizon
        row.started_at = datetime.utcnow() - timedelta(hours=200)
        db.commit()

        admin_key = os.environ.get("ADMIN_API_KEY", "test-admin-key")
        resp = client.post(
            "/admin/sessions/reap-stale",
            json={"grace_minutes": 30, "max_age_hours": 168, "limit": 100},
            headers={"X-Admin-Key": admin_key},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["reaped"] == 0  # ancient row not picked up

        db.refresh(row)
        assert row.completed_at is None
        assert row.auto_completed_at is None


class TestRecoveryPath:
    """The recovery path on the client calls /sessions/{id}/complete to
    finalise sessions whose JS context was killed mid-timer. These tests
    confirm the backend cooperates with that handshake.
    """

    def test_complete_after_long_idle_succeeds(self, client, alice, alice_headers, db):
        """Mode A/C/E: backend finalises a row that was started a long time
        ago (timer would already have fired locally). Client recovery effect
        relies on this returning 200.
        """
        sid = client.post(
            "/sessions/start",
            json={"duration_minutes": 25},
            headers=alice_headers,
        ).json()["session_id"]
        # Pretend two hours passed before the recovery effect ran
        row = db.query(models.StudySession).filter_by(id=sid).first()
        row.started_at = datetime.utcnow() - timedelta(hours=2)
        db.commit()

        resp = client.post(
            f"/sessions/{sid}/complete",
            json={"duration_minutes": 25},
            headers=alice_headers,
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["session"]["coins_earned"] > 0

    def test_recovery_idempotent_against_double_save(self, client, alice, alice_headers):
        """Mode A + late launch: the recovery path runs, succeeds, and then the
        user reopens the app yet again. The second complete attempt MUST be
        rejected with 409 so coins/streak don't double-credit. Already
        covered by test_complete_twice_returns_409 — restated here in the
        failure-mode language for clarity.
        """
        sid = client.post(
            "/sessions/start",
            json={"duration_minutes": 25},
            headers=alice_headers,
        ).json()["session_id"]
        first = client.post(
            f"/sessions/{sid}/complete",
            json={"duration_minutes": 25},
            headers=alice_headers,
        )
        assert first.status_code == 200
        second = client.post(
            f"/sessions/{sid}/complete",
            json={"duration_minutes": 25},
            headers=alice_headers,
        )
        assert second.status_code == 409


class TestStartFailureModes:
    """Modes where /sessions/start itself doesn't establish a row, but the
    client may have already fired Analytics.sessionStarted in PostHog.
    """

    def test_K_concurrent_double_start_creates_two_incomplete_rows(
        self, client, alice, alice_headers, db
    ):
        """Mode O variant: the same user starts two timers in quick succession
        (e.g. tapped Start, app froze, tapped again). The endpoint is
        deliberately NOT idempotent — both rows get inserted. Documents the
        current behaviour so we notice if it changes.
        """
        sid1 = client.post(
            "/sessions/start",
            json={"duration_minutes": 25},
            headers=alice_headers,
        ).json()["session_id"]
        sid2 = client.post(
            "/sessions/start",
            json={"duration_minutes": 25},
            headers=alice_headers,
        ).json()["session_id"]
        assert sid1 != sid2
        rows = db.query(models.StudySession).filter_by(user_id=alice.id).all()
        assert len(rows) == 2
        assert all(r.completed_at is None for r in rows)
