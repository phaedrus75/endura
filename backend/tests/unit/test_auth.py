"""
Unit tests for auth.py — JWT encoding/decoding and password hashing.
No network, no DB, pure function tests.
"""
import pytest
import jwt as pyjwt
from datetime import datetime, timedelta
from unittest.mock import patch

from auth import (
    create_access_token, verify_password, get_password_hash,
    ALGORITHM, SECRET_KEY, ACCESS_TOKEN_EXPIRE_MINUTES,
)


class TestPasswordHashing:
    def test_hash_is_not_plain_text(self):
        hashed = get_password_hash("mysecretpass1")
        assert hashed != "mysecretpass1"

    def test_correct_password_verifies(self):
        hashed = get_password_hash("correct_horse1")
        assert verify_password("correct_horse1", hashed) is True

    def test_wrong_password_fails(self):
        hashed = get_password_hash("correct_horse1")
        assert verify_password("wrongpassword1", hashed) is False

    def test_empty_password_verifies_correctly(self):
        # Edge case: empty string should not match a hashed non-empty password
        hashed = get_password_hash("nonempty1")
        assert verify_password("", hashed) is False

    def test_different_hashes_for_same_password(self):
        # bcrypt salts should produce different hashes
        h1 = get_password_hash("samepassword1")
        h2 = get_password_hash("samepassword1")
        assert h1 != h2

    def test_hash_both_verifies_despite_different_salt(self):
        pw = "mybigpassword1"
        h1 = get_password_hash(pw)
        h2 = get_password_hash(pw)
        assert verify_password(pw, h1) is True
        assert verify_password(pw, h2) is True


class TestJWTTokens:
    def test_token_is_decodable(self):
        token = create_access_token({"sub": "user@example.com", "tv": 0})
        payload = pyjwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "user@example.com"

    def test_token_contains_sub(self):
        token = create_access_token({"sub": "test@test.com", "tv": 0})
        payload = pyjwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "test@test.com"

    def test_token_contains_exp(self):
        token = create_access_token({"sub": "test@test.com", "tv": 0})
        payload = pyjwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert "exp" in payload

    def test_token_with_custom_expiry(self):
        token = create_access_token(
            {"sub": "test@test.com", "tv": 0},
            expires_delta=timedelta(minutes=5)
        )
        payload = pyjwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # exp should be ~5 minutes from now — compare in UTC epoch seconds
        from datetime import timezone
        expected_exp = datetime.now(timezone.utc) + timedelta(minutes=5)
        diff = abs(payload["exp"] - expected_exp.timestamp())
        assert diff < 30  # within 30 seconds

    def test_tampered_token_raises(self):
        token = create_access_token({"sub": "test@test.com", "tv": 0})
        bad_token = token[:-5] + "xxxxx"
        with pytest.raises(pyjwt.exceptions.DecodeError):
            pyjwt.decode(bad_token, SECRET_KEY, algorithms=[ALGORITHM])

    def test_wrong_secret_raises(self):
        token = create_access_token({"sub": "test@test.com", "tv": 0})
        with pytest.raises(pyjwt.exceptions.InvalidSignatureError):
            pyjwt.decode(token, "wrong-secret", algorithms=[ALGORITHM])

    def test_token_version_in_payload(self):
        token = create_access_token({"sub": "test@test.com", "tv": 3})
        payload = pyjwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["tv"] == 3

    def test_expired_token_raises_on_decode(self):
        token = create_access_token(
            {"sub": "test@test.com", "tv": 0},
            expires_delta=timedelta(seconds=-1)  # already expired
        )
        with pytest.raises(pyjwt.exceptions.ExpiredSignatureError):
            pyjwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
