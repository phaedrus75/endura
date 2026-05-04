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
from unittest.mock import patch, MagicMock

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


class TestReaperRecoveryNotification:
    """When the reaper auto-completes a stale session, the user should be
    pulled back into the app — they don't know their session was saved
    until we tell them. Push first, email fallback if no push token.
    """

    def _make_stale_session(self, client, headers, db):
        """Helper: start a session and time-travel it so the reaper picks it up."""
        sid = client.post(
            "/sessions/start",
            json={"duration_minutes": 25},
            headers=headers,
        ).json()["session_id"]
        row = db.query(models.StudySession).filter_by(id=sid).first()
        row.started_at = datetime.utcnow() - timedelta(hours=24)
        db.commit()
        return sid

    def test_reaper_sends_push_when_user_has_valid_token(
        self, client, alice, alice_headers, db
    ):
        """User with a valid Expo push token gets a push and NO email fallback —
        push is the cheaper, instant channel and avoids Resend send credits.
        """
        alice.push_token = "ExponentPushToken[abc123validtokenfortest]"
        alice.notification_enabled = True
        alice.notif_reminders_enabled = True
        db.commit()

        self._make_stale_session(client, alice_headers, db)

        admin_key = os.environ.get("ADMIN_API_KEY", "test-admin-key")

        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {
            "data": [{"status": "ok", "id": "ticket-recovered-1"}]
        }

        with patch("services.push.httpx.Client") as MockClient, \
             patch("main._send_template_email") as mock_email:
            mock_instance = MagicMock()
            mock_instance.post.return_value = mock_resp
            MockClient.return_value.__enter__ = lambda s: mock_instance
            MockClient.return_value.__exit__ = MagicMock(return_value=False)

            resp = client.post(
                "/admin/sessions/reap-stale",
                json={"grace_minutes": 30, "max_age_hours": 168, "limit": 100},
                headers={"X-Admin-Key": admin_key},
            )

        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["reaped"] >= 1
        # Push went out, email fallback did NOT.
        assert body["notifications"]["push_sent"] >= 1
        assert body["notifications"].get("email_sent", 0) == 0
        mock_email.assert_not_called()

        # PushLog row was written with our template_key for traceability.
        logs = db.query(models.PushLog).filter(
            models.PushLog.user_id == alice.id,
            models.PushLog.template_key == "push_session_recovered",
        ).all()
        assert len(logs) >= 1
        assert any(l.status == "sent" for l in logs)

    def test_reaper_falls_back_to_email_when_user_has_no_push_token(
        self, client, alice, alice_headers, db
    ):
        """User without a push token (didn't grant permission, never
        registered) should still get the recovery message — via email.
        """
        alice.push_token = None
        alice.notification_enabled = True  # irrelevant — no token
        db.commit()

        self._make_stale_session(client, alice_headers, db)

        admin_key = os.environ.get("ADMIN_API_KEY", "test-admin-key")

        with patch("services.push.httpx.Client") as MockClient, \
             patch("main._send_template_email", return_value=True) as mock_email:
            # Push path must NOT hit the wire — no token means we never POST.
            mock_instance = MagicMock()
            MockClient.return_value.__enter__ = lambda s: mock_instance
            MockClient.return_value.__exit__ = MagicMock(return_value=False)

            resp = client.post(
                "/admin/sessions/reap-stale",
                json={"grace_minutes": 30, "max_age_hours": 168, "limit": 100},
                headers={"X-Admin-Key": admin_key},
            )

            assert resp.status_code == 200
            assert mock_instance.post.call_count == 0  # no Expo POST
            # Email helper was called with our template + the user's email.
            mock_email.assert_called_once()
            args, _kwargs = mock_email.call_args
            assert args[0] == "session_recovered"
            assert args[1] == alice.email
            # Variables should include the duration and the user's name so
            # the email reads naturally.
            variables = args[2]
            assert variables.get("minutes") == 25
            assert variables.get("name") in (alice.username, "there")

        body = resp.json()
        assert body["notifications"]["email_sent"] >= 1
        assert body["notifications"].get("push_sent", 0) == 0

    def test_reaper_does_not_email_when_user_explicitly_opted_out_of_push(
        self, client, alice, alice_headers, db
    ):
        """User has a push token but turned the master switch OFF. We MUST
        respect that: don't push AND don't sneak the same content via email.
        Opt-out means opt-out for this notification.
        """
        alice.push_token = "ExponentPushToken[abc123validtokenfortest]"
        alice.notification_enabled = False  # master off
        db.commit()

        self._make_stale_session(client, alice_headers, db)

        admin_key = os.environ.get("ADMIN_API_KEY", "test-admin-key")

        with patch("services.push.httpx.Client") as MockClient, \
             patch("main._send_template_email") as mock_email:
            mock_instance = MagicMock()
            MockClient.return_value.__enter__ = lambda s: mock_instance
            MockClient.return_value.__exit__ = MagicMock(return_value=False)

            resp = client.post(
                "/admin/sessions/reap-stale",
                json={"grace_minutes": 30, "max_age_hours": 168, "limit": 100},
                headers={"X-Admin-Key": admin_key},
            )

            # Neither channel fires.
            assert mock_instance.post.call_count == 0
            mock_email.assert_not_called()

        body = resp.json()
        assert body["notifications"].get("opted_out", 0) >= 1
        assert body["notifications"].get("push_sent", 0) == 0
        assert body["notifications"].get("email_sent", 0) == 0

    def test_reaper_does_not_email_when_user_opted_out_of_reminders(
        self, client, alice, alice_headers, db
    ):
        """Reminder-category opt-out is also a hard 'no' — the recovery
        push is a reminder, and emailing instead would route around the
        user's stated preference.
        """
        alice.push_token = "ExponentPushToken[abc123validtokenfortest]"
        alice.notification_enabled = True
        alice.notif_reminders_enabled = False
        db.commit()

        self._make_stale_session(client, alice_headers, db)

        admin_key = os.environ.get("ADMIN_API_KEY", "test-admin-key")

        with patch("services.push.httpx.Client") as MockClient, \
             patch("main._send_template_email") as mock_email:
            mock_instance = MagicMock()
            MockClient.return_value.__enter__ = lambda s: mock_instance
            MockClient.return_value.__exit__ = MagicMock(return_value=False)

            client.post(
                "/admin/sessions/reap-stale",
                json={"grace_minutes": 30, "max_age_hours": 168, "limit": 100},
                headers={"X-Admin-Key": admin_key},
            )

            assert mock_instance.post.call_count == 0
            mock_email.assert_not_called()

    def test_reaper_session_finalised_even_if_notify_throws(
        self, client, alice, alice_headers, db
    ):
        """Notifications are best-effort — a Resend outage or an Expo blip
        must not unwind the session credit. The user's coins/streak are
        the source of truth; the push/email is just a UX nicety.
        """
        alice.push_token = "ExponentPushToken[abc123validtokenfortest]"
        alice.notification_enabled = True
        alice.notif_reminders_enabled = True
        before_coins = alice.total_coins
        db.commit()

        sid = self._make_stale_session(client, alice_headers, db)

        admin_key = os.environ.get("ADMIN_API_KEY", "test-admin-key")

        with patch(
            "services.push.send_template_to_user",
            side_effect=RuntimeError("Expo down"),
        ):
            resp = client.post(
                "/admin/sessions/reap-stale",
                json={"grace_minutes": 30, "max_age_hours": 168, "limit": 100},
                headers={"X-Admin-Key": admin_key},
            )

        assert resp.status_code == 200
        body = resp.json()
        # Notify failed (counted under 'error') but reap completed.
        assert body["reaped"] >= 1
        assert body["notifications"].get("error", 0) >= 1

        # Critically: the session is still finalised + the user got the coins.
        row = db.query(models.StudySession).filter_by(id=sid).first()
        assert row.completed_at is not None
        assert row.auto_completed_at is not None
        db.refresh(alice)
        assert alice.total_coins > before_coins
