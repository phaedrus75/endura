"""
API tests for /auth/* endpoints.
AUTH-01 through AUTH-17 from the test plan.
"""
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


class TestProtectedEndpoints:
    def test_me_with_valid_token(self, client, alice, alice_headers):
        """AUTH-11a: Valid token returns user profile."""
        resp = client.get(ME_URL, headers=alice_headers)
        assert resp.status_code == 200
        assert resp.json()["email"] == "alice@example.com"

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
