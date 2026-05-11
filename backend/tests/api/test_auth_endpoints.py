"""
API tests for /auth/* endpoints.
AUTH-01 through AUTH-17 from the test plan.
"""
from datetime import datetime, timedelta

import pytest
from unittest.mock import patch
from tests.conftest import make_user, jwt_headers, admin_headers


REGISTER_URL = "/auth/register"
LOGIN_URL = "/auth/login"
ME_URL = "/auth/me"


@pytest.fixture(autouse=True)
def _no_email(mock_resend):
    """Suppress all email sends for every test in this module."""
    pass


class TestRegistration:
    def test_register_valid_user(self, client):
        """AUTH-01: Valid registration returns success message."""
        resp = client.post(REGISTER_URL, json={
            "email": "newuser@example.com",
            "password": "securepass1"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "needs_verification" in data or "message" in data

    def test_register_duplicate_email(self, client, db):
        """AUTH-02: Duplicate email does not raise hard error (returns verification prompt)."""
        make_user(db, "dup@example.com", "password123", "dupuser")
        resp = client.post(REGISTER_URL, json={
            "email": "dup@example.com",
            "password": "securepass1"
        })
        # Should not 500 — endpoint returns a "verification needed" message
        assert resp.status_code in (200, 400)

    def test_register_invalid_email(self, client):
        """AUTH-03: Invalid email format → 422."""
        resp = client.post(REGISTER_URL, json={
            "email": "not-an-email",
            "password": "securepass1"
        })
        assert resp.status_code == 422

    def test_register_short_password(self, client):
        """AUTH-04: Password under 8 chars → 422."""
        resp = client.post(REGISTER_URL, json={
            "email": "short@example.com",
            "password": "abc1"
        })
        assert resp.status_code == 422

    def test_register_password_no_number(self, client):
        """AUTH-04b: Password with no digit → 422."""
        resp = client.post(REGISTER_URL, json={
            "email": "nonum@example.com",
            "password": "onlyletters"
        })
        assert resp.status_code == 422

    def test_register_password_no_letter(self, client):
        """AUTH-04c: Password with no letter → 422."""
        resp = client.post(REGISTER_URL, json={
            "email": "nolet@example.com",
            "password": "12345678"
        })
        assert resp.status_code == 422


class TestVerifyEmail:
    def test_verify_email_matches_case_insensitively(self, client, db):
        """Register stores normalized email; verify must find the row even if casing differs."""
        u = make_user(db, "CaseMatch@Example.com", "Pass12345", "casematch")
        u.email_verified = False
        u.verification_code = "424242"
        u.verification_code_expires = datetime.utcnow() + timedelta(hours=1)
        db.commit()

        resp = client.post(
            "/auth/verify-email",
            json={"email": "casematch@EXAMPLE.COM", "code": "424242"},
        )
        assert resp.status_code == 200, resp.text
        assert "access_token" in resp.json()
        db.refresh(u)
        assert u.email_verified is True

    def test_verify_email_code_strips_spaces(self, client, db):
        u = make_user(db, "spacecode@example.com", "Pass12345", "spacecode")
        u.email_verified = False
        u.verification_code = "999888"
        u.verification_code_expires = datetime.utcnow() + timedelta(hours=1)
        db.commit()

        resp = client.post(
            "/auth/verify-email",
            json={"email": "spacecode@example.com", "code": "999 888"},
        )
        assert resp.status_code == 200, resp.text
        assert "access_token" in resp.json()

    def test_verify_email_accepts_previous_code_after_resend(self, client, db):
        """A second resend must NOT invalidate the code from the first resend.

        This is the 'stale-code trap' fix: users often paste the code that
        landed first; if the backend issued a fresh one in the meantime, the
        old one was being rejected. Both should pass while inside their TTL.
        """
        u = make_user(db, "multicode@example.com", "Pass12345", "multicode")
        u.email_verified = False
        u.verification_code = None
        u.verification_code_expires = None
        # Simulate two recent issuances; oldest first in the user's hand.
        future = datetime.utcnow() + timedelta(minutes=15)
        u.verification_codes = [
            {"code": "222222", "expires": future.isoformat()},
            {"code": "111111", "expires": future.isoformat()},
        ]
        # Latest singular column reflects the newest issuance.
        u.verification_code = "222222"
        u.verification_code_expires = future
        db.commit()

        resp = client.post(
            "/auth/verify-email",
            json={"email": "multicode@example.com", "code": "111111"},
        )
        assert resp.status_code == 200, resp.text
        db.refresh(u)
        assert u.email_verified is True
        # Successful verification clears the entire history.
        assert (u.verification_codes or []) == []

    def test_verify_email_rejects_expired_history_entries(self, client, db):
        u = make_user(db, "expired@example.com", "Pass12345", "expireduser")
        u.email_verified = False
        u.verification_code = None
        u.verification_code_expires = None
        u.verification_codes = [
            {"code": "555555", "expires": (datetime.utcnow() - timedelta(minutes=1)).isoformat()},
        ]
        db.commit()

        resp = client.post(
            "/auth/verify-email",
            json={"email": "expired@example.com", "code": "555555"},
        )
        assert resp.status_code == 400


class TestResendVerification:
    def test_resend_throttled_within_cooldown(self, client, db):
        """Two resends within 60s must reuse the existing code, not mint a new one."""
        u = make_user(db, "throttle@example.com", "Pass12345", "throttle")
        u.email_verified = False
        # Issued ~10s ago: well inside the 60s cooldown.
        future = datetime.utcnow() + timedelta(minutes=15) - timedelta(seconds=10)
        u.verification_code = "123123"
        u.verification_code_expires = future
        u.verification_codes = [{"code": "123123", "expires": future.isoformat()}]
        db.commit()

        resp = client.post(
            "/auth/resend-verification",
            json={"email": "throttle@example.com"},
        )
        assert resp.status_code == 200
        db.refresh(u)
        # Code unchanged, history unchanged — throttle silently absorbed the call.
        assert u.verification_code == "123123"
        assert len(u.verification_codes or []) == 1

    def test_resend_after_cooldown_issues_new_code_and_keeps_history(self, client, db):
        u = make_user(db, "fresh@example.com", "Pass12345", "freshuser")
        u.email_verified = False
        # Issued >60s ago: outside the cooldown, eligible for a new code.
        old_future = datetime.utcnow() + timedelta(minutes=15) - timedelta(seconds=120)
        u.verification_code = "999000"
        u.verification_code_expires = old_future
        u.verification_codes = [{"code": "999000", "expires": old_future.isoformat()}]
        db.commit()

        resp = client.post(
            "/auth/resend-verification",
            json={"email": "fresh@example.com"},
        )
        assert resp.status_code == 200
        db.refresh(u)
        # New code issued AND old one still in history (so user can paste either).
        history_codes = [e["code"] for e in (u.verification_codes or [])]
        assert "999000" in history_codes
        assert u.verification_code in history_codes
        assert u.verification_code != "999000"

    def test_register_reregister_throttled_within_cooldown(self, client, db):
        """Hitting /auth/register twice in <60s for an unverified user must NOT mint a new code."""
        u = make_user(db, "reg2x@example.com", "Pass12345", "reg2x")
        u.email_verified = False
        future = datetime.utcnow() + timedelta(minutes=15) - timedelta(seconds=5)
        u.verification_code = "777777"
        u.verification_code_expires = future
        u.verification_codes = [{"code": "777777", "expires": future.isoformat()}]
        db.commit()

        resp = client.post(
            REGISTER_URL,
            json={"email": "reg2x@example.com", "password": "Pass12345"},
        )
        assert resp.status_code == 200
        db.refresh(u)
        assert u.verification_code == "777777"


class TestRegisterCaseInsensitive:
    def test_register_does_not_create_case_variant_duplicate(self, client, db):
        """A second signup with different casing must reuse the existing row."""
        first = make_user(db, "lm.l0v3ly.27@gmail.com", "Pass12345", "lovely")
        first.email_verified = False
        db.commit()
        first_id = first.id

        resp = client.post(
            REGISTER_URL,
            json={"email": "lm.L0v3ly.27@Gmail.com", "password": "Pass12345"},
        )
        assert resp.status_code == 200

        # No new row should have been created.
        from sqlalchemy import func as _f
        import models
        rows = (
            db.query(models.User)
            .filter(_f.lower(models.User.email) == "lm.l0v3ly.27@gmail.com")
            .all()
        )
        assert len(rows) == 1
        assert rows[0].id == first_id


class TestLogin:
    def test_login_valid_credentials(self, client, db):
        """AUTH-05: Valid login returns JWT token."""
        make_user(db, "logintest@example.com", "mypassword1", "logintest")
        resp = client.post(LOGIN_URL, json={
            "email": "logintest@example.com",
            "password": "mypassword1"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client, db):
        """AUTH-06: Wrong password → 401."""
        make_user(db, "wrongpw@example.com", "correctpass1", "wrongpwuser")
        resp = client.post(LOGIN_URL, json={
            "email": "wrongpw@example.com",
            "password": "wrongpassword1"
        })
        assert resp.status_code == 401

    def test_login_nonexistent_email(self, client):
        """AUTH-07: Non-existent email → 401 (not 404, prevents enumeration)."""
        resp = client.post(LOGIN_URL, json={
            "email": "nobody@example.com",
            "password": "password123"
        })
        assert resp.status_code == 401

    def test_login_unverified_email_blocked(self, client, db):
        """Unverified user cannot log in → 403."""
        user = make_user(db, "unverified@example.com", "password123", "unverified")
        user.email_verified = False
        db.commit()
        resp = client.post(LOGIN_URL, json={
            "email": "unverified@example.com",
            "password": "password123"
        })
        assert resp.status_code == 403

    def test_login_email_case_insensitive(self, client, db):
        """Login finds user by email case-insensitively (matches stored row)."""
        make_user(db, "loginCi@example.com", "mypassword1", "loginci")
        resp = client.post(
            LOGIN_URL,
            json={"email": "LOGINCI@EXAMPLE.COM", "password": "mypassword1"},
        )
        assert resp.status_code == 200, resp.text
        assert "access_token" in resp.json()


class TestProtectedEndpoints:
    def test_me_with_valid_token(self, client, alice, alice_headers):
        """AUTH-11a: Valid token returns user profile."""
        resp = client.get(ME_URL, headers=alice_headers)
        assert resp.status_code == 200
        assert resp.json()["email"] == "alice@example.com"

    def test_me_token_sub_case_insensitive(self, client, alice):
        """JWT sub casing may differ from DB row; resolve user case-insensitively."""
        headers = jwt_headers("ALICE@EXAMPLE.COM")
        resp = client.get(ME_URL, headers=headers)
        assert resp.status_code == 200
        assert resp.json()["email"] == alice.email

    def test_me_without_token_401(self, client):
        """AUTH-11: No token → 401."""
        resp = client.get(ME_URL)
        assert resp.status_code == 401

    def test_me_with_bad_token_401(self, client):
        """AUTH-10: Tampered token → 401."""
        resp = client.get(ME_URL, headers={"Authorization": "Bearer notarealtoken"})
        assert resp.status_code == 401

    def test_expired_token_rejected(self, client, alice):
        """AUTH-09: Expired JWT → 401."""
        import jwt as pyjwt
        from datetime import timedelta
        from auth import create_access_token, SECRET_KEY, ALGORITHM
        expired_token = create_access_token(
            {"sub": alice.email, "tv": 0},
            expires_delta=timedelta(seconds=-1)
        )
        resp = client.get(ME_URL, headers={"Authorization": f"Bearer {expired_token}"})
        assert resp.status_code == 401

    def test_archived_user_blocked(self, client, db, alice, alice_headers):
        """Archived user gets 403."""
        alice.is_archived = True
        db.commit()
        resp = client.get(ME_URL, headers=alice_headers)
        assert resp.status_code == 403


class TestOnboardingABVariantSync:
    def test_sync_sets_variant_once(self, client, db):
        make_user(db, "abvar@test.com", "password123", "abvaruser")
        h = jwt_headers("abvar@test.com")
        r = client.post("/auth/onboarding-ab-variant", json={"variant": "v1"}, headers=h)
        assert r.status_code == 200
        assert r.json()["onboarding_ab_variant"] == "v1"
        r2 = client.post("/auth/onboarding-ab-variant", json={"variant": "v2"}, headers=h)
        assert r2.status_code == 200
        assert r2.json()["onboarding_ab_variant"] == "v1"

    def test_sync_rejects_invalid_variant(self, client, alice_headers):
        r = client.post(
            "/auth/onboarding-ab-variant",
            json={"variant": "v3"},
            headers=alice_headers,
        )
        assert r.status_code == 422


class TestAdminAccess:
    def test_admin_endpoint_valid_key(self, client):
        """AUTH-12: Valid admin key → 200."""
        resp = client.get("/admin/overview", headers=admin_headers())
        assert resp.status_code == 200

    def test_admin_endpoint_wrong_key(self, client):
        """AUTH-13: Wrong admin key → 403."""
        resp = client.get("/admin/overview", headers={"x-admin-key": "wrongkey"})
        assert resp.status_code == 403

    def test_admin_endpoint_no_key(self, client):
        """AUTH-14: Missing admin key → 422 or 403."""
        resp = client.get("/admin/overview")
        assert resp.status_code in (403, 422)
