"""Unit tests for services/push.py — push service logic without real network calls."""
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime

import models
from services.push import (
    is_valid_expo_token, _user_can_receive, CATEGORY_PREF_COLUMN,
    send_to_user,
)
from tests.conftest import make_user


class TestTokenValidation:
    def test_valid_expo_token(self):
        assert is_valid_expo_token("ExponentPushToken[abc123XYZ_-]") is True

    def test_short_expo_token(self):
        assert is_valid_expo_token("ExponentPushToken[a]") is True

    def test_invalid_format(self):
        assert is_valid_expo_token("not-a-push-token") is False

    def test_none_token(self):
        assert is_valid_expo_token(None) is False

    def test_empty_token(self):
        assert is_valid_expo_token("") is False


class TestUserCanReceive:
    def _make_user_with_token(self):
        u = MagicMock(spec=models.User)
        u.is_archived = False
        u.push_token = "ExponentPushToken[abc123]"
        u.notification_enabled = True
        u.notif_badges_enabled = True
        u.notif_friends_enabled = True
        u.notif_reminders_enabled = True
        u.notif_marketing_enabled = True
        return u

    def test_valid_user_can_receive(self):
        user = self._make_user_with_token()
        allowed, reason = _user_can_receive(user, "badge")
        assert allowed is True
        assert reason is None

    def test_no_token_blocks(self):
        user = self._make_user_with_token()
        user.push_token = None
        allowed, reason = _user_can_receive(user, "badge")
        assert allowed is False
        assert "token" in reason

    def test_master_off_blocks(self):
        user = self._make_user_with_token()
        user.notification_enabled = False
        allowed, reason = _user_can_receive(user, "badge")
        assert allowed is False
        assert "master_off" in reason

    def test_category_off_blocks(self):
        user = self._make_user_with_token()
        user.notif_badges_enabled = False
        allowed, reason = _user_can_receive(user, "badge")
        assert allowed is False
        assert "category_off" in reason

    def test_archived_user_blocked(self):
        user = self._make_user_with_token()
        user.is_archived = True
        allowed, reason = _user_can_receive(user, "system")
        assert allowed is False

    def test_system_category_ignores_prefs(self):
        user = self._make_user_with_token()
        user.notif_marketing_enabled = False
        # "system" category has no pref gate
        allowed, reason = _user_can_receive(user, "system")
        assert allowed is True

    def test_no_token_blocks_even_for_system(self):
        user = self._make_user_with_token()
        user.push_token = None
        allowed, reason = _user_can_receive(user, "system")
        assert allowed is False


class TestSendToUser:
    """send_to_user should call httpx only when the user can receive."""

    def test_send_skipped_when_no_token(self, db):
        user = make_user(db, "push1@test.com", "password123", "push1")
        # No push token set
        with patch("services.push.httpx.Client") as mock_client:
            send_to_user(db, user, title="Test", body="Body", category="badge")
            mock_client.assert_not_called()

    def test_send_skipped_when_master_off(self, db):
        user = make_user(db, "push2@test.com", "password123", "push2")
        user.push_token = "ExponentPushToken[abc123]"
        user.notification_enabled = False
        db.commit()
        with patch("services.push.httpx.Client") as mock_client:
            send_to_user(db, user, title="Test", body="Body", category="badge")
            mock_client.assert_not_called()

    def test_send_skipped_when_category_off(self, db):
        user = make_user(db, "push3@test.com", "password123", "push3")
        user.push_token = "ExponentPushToken[abc123]"
        user.notif_badges_enabled = False
        db.commit()
        with patch("services.push.httpx.Client") as mock_client:
            send_to_user(db, user, title="Test", body="Body", category="badge")
            mock_client.assert_not_called()

    def test_send_clears_dead_token(self, db, mock_push_service):
        user = make_user(db, "push4@test.com", "password123", "push4")
        user.push_token = "ExponentPushToken[deadtoken]"
        user.notification_enabled = True
        db.commit()
        mock_push_service.post.return_value.json.return_value = {
            "data": [{"status": "error", "details": {"error": "DeviceNotRegistered"}}]
        }
        send_to_user(db, user, title="Test", body="Body", category="badge")
        db.refresh(user)
        assert user.push_token is None
