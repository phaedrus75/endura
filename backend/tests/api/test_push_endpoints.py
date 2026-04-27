"""
API tests for push notification endpoints.
PUSH-01 through PUSH-09 from the test plan.
"""
import pytest
import models
from tests.conftest import make_user


VALID_TOKEN = "ExponentPushToken[testtoken123]"


class TestPushTokenEndpoints:
    def test_register_push_token(self, client, alice, alice_headers, db):
        """PUSH-01: PUT /users/me/push-token stores token and platform."""
        resp = client.put("/users/me/push-token",
                          json={"token": VALID_TOKEN, "platform": "ios"},
                          headers=alice_headers)
        assert resp.status_code == 200
        db.refresh(alice)
        assert alice.push_token == VALID_TOKEN
        assert alice.push_platform == "ios"

    def test_delete_push_token(self, client, alice, alice_headers, db):
        """PUSH-02: DELETE /users/me/push-token clears token."""
        # First register
        client.put("/users/me/push-token",
                   json={"token": VALID_TOKEN, "platform": "ios"},
                   headers=alice_headers)
        # Then delete
        resp = client.delete("/users/me/push-token", headers=alice_headers)
        assert resp.status_code == 200
        db.refresh(alice)
        assert alice.push_token is None

    def test_get_notification_prefs(self, client, alice_headers):
        """PUSH-03: GET /users/me/notification-prefs returns all 5 fields."""
        resp = client.get("/users/me/notification-prefs", headers=alice_headers)
        assert resp.status_code == 200
        data = resp.json()
        required = [
            "notification_enabled", "notif_badges_enabled",
            "notif_friends_enabled", "notif_reminders_enabled",
            "notif_marketing_enabled"
        ]
        for field in required:
            assert field in data, f"Missing pref field: {field}"

    def test_update_notification_prefs(self, client, alice, alice_headers, db):
        """PUSH-04: PUT /users/me/notification-prefs persists changes."""
        resp = client.put("/users/me/notification-prefs",
                          json={"notif_badges_enabled": False},
                          headers=alice_headers)
        assert resp.status_code == 200
        db.refresh(alice)
        assert alice.notif_badges_enabled is False

    def test_push_requires_auth(self, client):
        """Push endpoints require auth."""
        resp = client.get("/users/me/notification-prefs")
        assert resp.status_code == 401


class TestLocalNotificationFired:
    """POST /push/local-fired — device-scheduled notifications report back so
    they appear on the admin dashboard alongside server-sent pushes."""

    PAYLOAD = {
        "template_key": "push_timer_done",
        "identifier": "abc-123",
        "title": "Your timer is done!",
        "body": "25 minutes complete.",
        "category": "local",
        "opened": False,
    }

    def test_logs_delivery(self, client, alice, alice_headers, db):
        """Inserts a push_logs row with status=delivered when the device confirms
        the notification fired."""
        resp = client.post("/push/local-fired", json=self.PAYLOAD, headers=alice_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["ok"] is True
        assert body["updated"] is False

        log = db.query(models.PushLog).filter(models.PushLog.id == body["id"]).first()
        assert log is not None
        assert log.user_id == alice.id
        assert log.template_key == "push_timer_done"
        assert log.category == "local"
        assert log.status == "delivered"
        assert log.opened is False
        assert log.expo_ticket_id == "local:abc-123"

    def test_dedupes_by_identifier_and_marks_opened_on_tap(
        self, client, alice, alice_headers, db
    ):
        """Second call with the same identifier doesn't insert a new row — it
        flips `opened=True` so we capture taps without inflating delivery counts."""
        first = client.post("/push/local-fired", json=self.PAYLOAD, headers=alice_headers)
        assert first.status_code == 200
        first_id = first.json()["id"]

        second = client.post(
            "/push/local-fired",
            json={**self.PAYLOAD, "opened": True},
            headers=alice_headers,
        )
        assert second.status_code == 200
        body = second.json()
        assert body["id"] == first_id
        assert body["updated"] is True

        # Only one row in push_logs for this identifier, and it's now opened.
        rows = (
            db.query(models.PushLog)
            .filter(models.PushLog.expo_ticket_id == "local:abc-123")
            .all()
        )
        assert len(rows) == 1
        assert rows[0].opened is True
        assert rows[0].opened_at is not None

    def test_requires_auth(self, client):
        """Anonymous calls are rejected so the endpoint can't be used to spam logs."""
        resp = client.post("/push/local-fired", json=self.PAYLOAD)
        assert resp.status_code == 401

    def test_appears_in_admin_metrics(self, client, alice_headers):
        """After logging a local notification, /admin/push/metrics should count it
        in the `local` category — confirming the dashboard surfaces it."""
        from tests.conftest import admin_headers
        client.post("/push/local-fired", json=self.PAYLOAD, headers=alice_headers)

        resp = client.get("/admin/push/metrics?days=7", headers=admin_headers())
        assert resp.status_code == 200
        data = resp.json()
        assert "local" in data["by_category"], (
            f"local notifications missing from metrics: {data['by_category']}"
        )
        assert data["by_category"]["local"].get("delivered", 0) >= 1


class TestAdminPushEndpoints:
    def test_get_opt_in_funnel(self, client):
        """GET /admin/push/opt-in-funnel returns KPIs."""
        from tests.conftest import admin_headers
        resp = client.get("/admin/push/opt-in-funnel", headers=admin_headers())
        assert resp.status_code == 200

    def test_get_push_templates(self, client):
        """GET /admin/push/templates returns template list."""
        from tests.conftest import admin_headers
        resp = client.get("/admin/push/templates", headers=admin_headers())
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_send_test_push_to_user(self, client, alice, mock_push_service):
        """POST /admin/push/test sends a push (mocked)."""
        from tests.conftest import admin_headers
        # Set a valid token first
        alice.push_token = VALID_TOKEN
        alice.notification_enabled = True
        resp = client.post("/admin/push/test",
                           json={"user_id": alice.id, "title": "Test", "body": "Hello"},
                           headers=admin_headers())
        # Should succeed (even if push service is mocked)
        assert resp.status_code in (200, 202)
