"""End-to-end tests for /auth/apple and /auth/google.

Token verification is mocked at the module boundary (the route imports the
verifier lazily inside the handler), so we patch the symbol on
``oauth_verify`` and the handler's ``from oauth_verify import …`` picks it up.
"""

from unittest.mock import patch

import jwt as pyjwt

from auth import SECRET_KEY, ALGORITHM
from tests.conftest import make_user


def _decode(access_token: str) -> dict:
    return pyjwt.decode(access_token, SECRET_KEY, algorithms=[ALGORITHM])


class TestAuthApple:
    def test_creates_new_user_on_first_sign_in(self, client, db):
        with patch(
            "oauth_verify.verify_apple_id_token",
            return_value={
                "sub": "apple.sub.new",
                "email": "newapple@example.com",
                "email_verified": True,
            },
        ):
            r = client.post("/auth/apple", json={"identity_token": "x" * 20})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["token_type"] == "bearer"
        claims = _decode(body["access_token"])
        assert claims["sub"] == "newapple@example.com"

    def test_links_existing_email_user(self, client, db):
        existing = make_user(db, "linkme@example.com", "password123", "linkme", verified=True)
        with patch(
            "oauth_verify.verify_apple_id_token",
            return_value={
                "sub": "apple.sub.link",
                "email": "linkme@example.com",
                "email_verified": True,
            },
        ):
            r = client.post("/auth/apple", json={"identity_token": "x" * 20})
        assert r.status_code == 200
        # Re-fetch user from DB to confirm linkage
        db.refresh(existing)
        assert existing.apple_id_sub == "apple.sub.link"

    def test_repeat_login_with_same_apple_sub(self, client, db):
        with patch(
            "oauth_verify.verify_apple_id_token",
            return_value={
                "sub": "apple.sub.repeat",
                "email": "repeat@example.com",
                "email_verified": True,
            },
        ):
            r1 = client.post("/auth/apple", json={"identity_token": "x" * 20})
            r2 = client.post("/auth/apple", json={"identity_token": "y" * 20})
        assert r1.status_code == 200 and r2.status_code == 200
        # Same email subject in both JWTs → same Endura user
        assert _decode(r1.json()["access_token"])["sub"] == _decode(r2.json()["access_token"])["sub"]

    def test_rejects_invalid_token(self, client):
        from fastapi import HTTPException

        def _raise(_):
            raise HTTPException(status_code=401, detail="Apple token invalid")

        with patch("oauth_verify.verify_apple_id_token", side_effect=_raise):
            r = client.post("/auth/apple", json={"identity_token": "x" * 20})
        assert r.status_code == 401

    def test_rejects_archived_user(self, client, db):
        u = make_user(db, "ghost@example.com", "password123", "ghost", verified=True)
        u.is_archived = True
        u.apple_id_sub = "apple.sub.ghost"
        db.commit()
        with patch(
            "oauth_verify.verify_apple_id_token",
            return_value={
                "sub": "apple.sub.ghost",
                "email": "ghost@example.com",
                "email_verified": True,
            },
        ):
            r = client.post("/auth/apple", json={"identity_token": "x" * 20})
        assert r.status_code == 403


class TestAuthGoogle:
    def test_creates_new_user_on_first_sign_in(self, client):
        with patch(
            "oauth_verify.verify_google_id_token",
            return_value={
                "sub": "google.sub.new",
                "email": "newgoogle@example.com",
                "email_verified": True,
            },
        ):
            r = client.post("/auth/google", json={"id_token": "x" * 20})
        assert r.status_code == 200
        claims = _decode(r.json()["access_token"])
        assert claims["sub"] == "newgoogle@example.com"

    def test_unverified_google_email_is_rejected(self, client):
        with patch(
            "oauth_verify.verify_google_id_token",
            return_value={
                "sub": "google.sub.unver",
                "email": "u@example.com",
                "email_verified": False,
            },
        ):
            r = client.post("/auth/google", json={"id_token": "x" * 20})
        assert r.status_code == 400

    def test_links_existing_email_user(self, client, db):
        existing = make_user(db, "glink@example.com", "password123", "glink", verified=True)
        with patch(
            "oauth_verify.verify_google_id_token",
            return_value={
                "sub": "google.sub.link",
                "email": "glink@example.com",
                "email_verified": True,
            },
        ):
            r = client.post("/auth/google", json={"id_token": "x" * 20})
        assert r.status_code == 200
        db.refresh(existing)
        assert existing.google_id_sub == "google.sub.link"
