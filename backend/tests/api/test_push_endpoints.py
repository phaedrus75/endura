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
