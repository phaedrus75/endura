"""Link Sign in with Apple / Google identities to existing Endura users.

Call this only after the IdP token has been verified server-side. When the IdP
attests a verified email that matches an existing row (case-insensitive), we
attach the provider subject to that user so one Endura account can sign in with
email/password or OAuth.

Security: ``idp_email_verified`` must be true from the verified token (Apple /
Google). We do not merge on unverified email claims.
"""

from __future__ import annotations

import secrets
from typing import Literal, Optional

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

import crud
import models
from auth import get_password_hash

Provider = Literal["apple", "google"]


def get_user_by_email_ci(db: Session, email: str) -> Optional[models.User]:
    """Case-insensitive email lookup (stable for merge with IdP emails)."""
    norm = (email or "").strip().lower()
    if not norm:
        return None
    return (
        db.query(models.User)
        .filter(func.lower(models.User.email) == norm)
        .first()
    )


def get_user_by_apple_sub(db: Session, sub: str) -> Optional[models.User]:
    if not sub:
        return None
    return db.query(models.User).filter(models.User.apple_id_sub == sub).first()


def get_user_by_google_sub(db: Session, sub: str) -> Optional[models.User]:
    if not sub:
        return None
    return db.query(models.User).filter(models.User.google_id_sub == sub).first()


def resolve_oauth_user(
    db: Session,
    *,
    provider: Provider,
    provider_sub: str,
    email: Optional[str],
    idp_email_verified: bool,
) -> models.User:
    """
    Return the Endura user for this OAuth login, creating or merging as needed.

    - If ``provider_sub`` already linked → that user.
    - Else if ``email`` matches an existing user (CI) and IdP verified email →
      attach ``provider_sub`` to that row (one account).
    - Else create a new user (requires verified email + non-empty email).
    """
    sub = (provider_sub or "").strip()
    if not sub:
        raise HTTPException(status_code=400, detail="Missing OAuth subject")

    if provider == "apple":
        existing_sub = get_user_by_apple_sub(db, sub)
    else:
        existing_sub = get_user_by_google_sub(db, sub)
    if existing_sub:
        return existing_sub

    if not email or not str(email).strip():
        raise HTTPException(
            status_code=400,
            detail="OAuth login requires an email from the identity provider",
        )
    if not idp_email_verified:
        raise HTTPException(
            status_code=400,
            detail="Email must be verified by the identity provider before account linking",
        )

    email_norm = email.strip()
    by_email = get_user_by_email_ci(db, email_norm)
    if by_email:
        if getattr(by_email, "is_archived", False):
            raise HTTPException(
                status_code=403,
                detail="This account has been deactivated. Please contact support.",
            )
        if provider == "apple":
            if by_email.apple_id_sub and by_email.apple_id_sub != sub:
                raise HTTPException(
                    status_code=409,
                    detail="This Endura account is already linked to a different Apple ID.",
                )
            by_email.apple_id_sub = sub
        else:
            if by_email.google_id_sub and by_email.google_id_sub != sub:
                raise HTTPException(
                    status_code=409,
                    detail="This Endura account is already linked to a different Google account.",
                )
            by_email.google_id_sub = sub
        by_email.email_verified = True
        by_email.verification_code = None
        by_email.verification_code_expires = None
        by_email.verification_attempts = 0
        db.commit()
        db.refresh(by_email)
        return by_email

    # New OAuth-only user: unusable random password; email trusted from IdP.
    placeholder_pw = get_password_hash(secrets.token_urlsafe(48))
    new_user = crud.create_user(db, email_norm, placeholder_pw)
    new_user.email_verified = True
    new_user.verification_code = None
    new_user.verification_code_expires = None
    new_user.verification_attempts = 0
    if provider == "apple":
        new_user.apple_id_sub = sub
    else:
        new_user.google_id_sub = sub
    db.commit()
    db.refresh(new_user)
    return new_user
