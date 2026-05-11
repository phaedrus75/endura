from datetime import datetime, timedelta
from typing import Optional
import jwt
from jwt.exceptions import PyJWTError as JWTError
import bcrypt
import logging
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
import models
import os

logger = logging.getLogger(__name__)

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("DATABASE_URL", "").startswith("postgresql"):
        raise RuntimeError("SECRET_KEY environment variable is required in production")
    SECRET_KEY = "dev-only-insecure-key-not-for-production"
    logger.warning("Using insecure dev SECRET_KEY — set SECRET_KEY env var for production")

ALGORITHM = "HS256"
# Effectively never-expire on mobile. Revocation is handled via `token_version`
# (bumped on logout / password reset / admin archive), so there's no security
# benefit from forcing users to re-login on a calendar timer.
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 365 * 10  # 10 years

security = HTTPBearer()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode('utf-8'),
        hashed_password.encode('utf-8')
    )


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(
        password.encode('utf-8'),
        bcrypt.gensalt()
    ).decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def _capture_app_version_from_headers(
    request: Request, user: models.User, db: Session
) -> None:
    """Opportunistically update `users.app_version` / `users.app_build` from
    the X-App-Version / X-App-Build request headers sent by the mobile app.

    Why this exists: previously these columns were only written via push
    registration, so any user who declined the push permission prompt had
    NULL forever. With this hook every authenticated call refreshes the
    binary version, so the admin "outdated" cohort and update-prompt email
    pipeline see ~all users, not just the ones who said yes to push.

    Only writes when the value differs from what's stored, to avoid hot-row
    contention on every API call. Failures are swallowed — telemetry must
    never break a real request.
    """
    try:
        version = request.headers.get("x-app-version")
        build = request.headers.get("x-app-build")
        if not version and not build:
            return

        version = version[:20].strip() if version else None
        build = build[:20].strip() if build else None

        changed = False
        if version and version != getattr(user, "app_version", None):
            user.app_version = version
            user.app_version_updated_at = datetime.utcnow()
            changed = True
        if build and build != getattr(user, "app_build", None):
            user.app_build = build
            changed = True
        if changed:
            db.commit()
    except Exception as exc:
        logger.warning("capture_app_version failed: %s", exc)
        try:
            db.rollback()
        except Exception:
            pass


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            logger.warning("Auth: no email in token payload")
            raise credentials_exception
    except JWTError:
        logger.warning("Auth: JWT decode failed")
        raise credentials_exception

    email_key = (email or "").strip().lower()
    user = (
        db.query(models.User)
        .filter(func.lower(models.User.email) == email_key)
        .first()
        if email_key
        else None
    )
    if user is None:
        logger.warning("Auth: user not found for token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found - please register again",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token_ver = payload.get("tv", 0)
    if token_ver != (user.token_version or 0):
        raise credentials_exception
    if getattr(user, "is_archived", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated. Please contact support.",
        )
    _capture_app_version_from_headers(request, user, db)
    return user


def get_optional_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: Session = Depends(get_db)
) -> Optional[models.User]:
    """Get current user if authenticated, None otherwise"""
    if credentials is None:
        return None
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            return None
        email_key = (email or "").strip().lower()
        user = (
            db.query(models.User)
            .filter(func.lower(models.User.email) == email_key)
            .first()
            if email_key
            else None
        )
        if user is None:
            return None
        token_ver = payload.get("tv", 0)
        if (user.token_version or 0) != token_ver:
            return None
        _capture_app_version_from_headers(request, user, db)
        return user
    except JWTError:
        return None
