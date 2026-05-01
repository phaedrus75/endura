"""Tests for OAuth merge-by-email (apple_id_sub / google_id_sub)."""

import pytest
from fastapi import HTTPException

import oauth_merge
from auth import get_password_hash
from tests.conftest import make_user


def test_resolve_new_apple_user(db):
    u = oauth_merge.resolve_oauth_user(
        db,
        provider="apple",
        provider_sub="apple.sub.123",
        email="newoauth@example.com",
        idp_email_verified=True,
    )
    assert u.id is not None
    assert u.email == "newoauth@example.com"
    assert u.apple_id_sub == "apple.sub.123"
    assert u.email_verified is True


def test_resolve_merge_apple_same_email(db):
    existing = make_user(db, "merge@example.com", "password123", "merger", verified=True)
    u = oauth_merge.resolve_oauth_user(
        db,
        provider="apple",
        provider_sub="apple.sub.merge",
        email="Merge@Example.com",
        idp_email_verified=True,
    )
    assert u.id == existing.id
    assert u.apple_id_sub == "apple.sub.merge"
    assert u.email_verified is True


def test_resolve_idempotent_apple_sub(db):
    u1 = oauth_merge.resolve_oauth_user(
        db,
        provider="apple",
        provider_sub="apple.sub.same",
        email="same@example.com",
        idp_email_verified=True,
    )
    u2 = oauth_merge.resolve_oauth_user(
        db,
        provider="apple",
        provider_sub="apple.sub.same",
        email="same@example.com",
        idp_email_verified=True,
    )
    assert u1.id == u2.id


def test_resolve_conflict_second_apple_on_same_account(db):
    existing = make_user(db, "twoapple@example.com", "password123", "twoa", verified=True)
    oauth_merge.resolve_oauth_user(
        db,
        provider="apple",
        provider_sub="apple.first",
        email="twoapple@example.com",
        idp_email_verified=True,
    )
    with pytest.raises(HTTPException) as ei:
        oauth_merge.resolve_oauth_user(
            db,
            provider="apple",
            provider_sub="apple.second",
            email="twoapple@example.com",
            idp_email_verified=True,
        )
    assert ei.value.status_code == 409


def test_resolve_merge_google(db):
    existing = make_user(db, "gmerge@example.com", "password123", "gmer", verified=True)
    u = oauth_merge.resolve_oauth_user(
        db,
        provider="google",
        provider_sub="google123",
        email="gmerge@example.com",
        idp_email_verified=True,
    )
    assert u.id == existing.id
    assert u.google_id_sub == "google123"


def test_rejects_unverified_email_claim(db):
    with pytest.raises(HTTPException) as ei:
        oauth_merge.resolve_oauth_user(
            db,
            provider="apple",
            provider_sub="apple.x",
            email="unver@example.com",
            idp_email_verified=False,
        )
    assert ei.value.status_code == 400
