"""Verify Apple / Google ID tokens (RS256, JWKS) before linking to a user.

Exposes :func:`verify_apple_id_token` and :func:`verify_google_id_token`. Both
return a normalized claims dict::

    {
        "sub": "...",                # stable IdP user identifier
        "email": "user@example.com" or None,
        "email_verified": True/False,
    }

Env config:
    APPLE_AUDIENCES   comma-separated list of allowed ``aud`` values
                       (typically the iOS bundle id, e.g. "com.endura.study").
                       Falls back to ``APPLE_BUNDLE_ID`` and finally
                       ``"com.endura.study"`` so dev/local works out of the box.
    GOOGLE_AUDIENCES  comma-separated list of allowed Google OAuth client IDs.
                       Required in production.

Network:
    JWKS responses are cached in-process per provider. PyJWT's ``PyJWKClient``
    handles the HTTP fetch + key selection by ``kid`` automatically.
"""

from __future__ import annotations

import logging
import os
import threading
from typing import Optional

import jwt
from fastapi import HTTPException
from jwt import PyJWKClient

logger = logging.getLogger(__name__)


_APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"
_GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"

_APPLE_ISS = "https://appleid.apple.com"
_GOOGLE_ISS = ("https://accounts.google.com", "accounts.google.com")

_jwks_lock = threading.Lock()
_apple_client: Optional[PyJWKClient] = None
_google_client: Optional[PyJWKClient] = None


def _apple_audiences() -> list[str]:
    raw = os.getenv("APPLE_AUDIENCES")
    if not raw:
        single = os.getenv("APPLE_BUNDLE_ID") or "com.endura.study"
        return [single]
    return [a.strip() for a in raw.split(",") if a.strip()]


def _google_audiences() -> list[str]:
    raw = os.getenv("GOOGLE_AUDIENCES")
    if not raw:
        return []
    return [a.strip() for a in raw.split(",") if a.strip()]


def _get_apple_jwks_client() -> PyJWKClient:
    global _apple_client
    if _apple_client is None:
        with _jwks_lock:
            if _apple_client is None:
                _apple_client = PyJWKClient(_APPLE_JWKS_URL, cache_keys=True)
    return _apple_client


def _get_google_jwks_client() -> PyJWKClient:
    global _google_client
    if _google_client is None:
        with _jwks_lock:
            if _google_client is None:
                _google_client = PyJWKClient(_GOOGLE_JWKS_URL, cache_keys=True)
    return _google_client


def _coerce_email_verified(value) -> bool:
    """Apple sends `email_verified` as the string "true"; Google sends bool."""
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() == "true"
    return False


def verify_apple_id_token(id_token: str) -> dict:
    """Verify a Sign in with Apple identity token. Raises HTTPException on failure."""
    if not id_token or not isinstance(id_token, str):
        raise HTTPException(status_code=400, detail="Missing Apple identity token")
    audiences = _apple_audiences()
    try:
        signing_key = _get_apple_jwks_client().get_signing_key_from_jwt(id_token)
        claims = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=audiences,
            issuer=_APPLE_ISS,
            options={"require": ["exp", "iat", "iss", "aud", "sub"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Apple token expired")
    except jwt.InvalidAudienceError:
        raise HTTPException(status_code=401, detail="Apple token audience mismatch")
    except jwt.InvalidIssuerError:
        raise HTTPException(status_code=401, detail="Apple token issuer mismatch")
    except jwt.InvalidTokenError as e:
        logger.warning("Apple token rejected: %s", e)
        raise HTTPException(status_code=401, detail="Apple token invalid")
    except Exception as e:
        logger.error("Apple token verification error: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail="Apple key fetch failed")

    sub = claims.get("sub") or ""
    email = claims.get("email")
    email_verified = _coerce_email_verified(claims.get("email_verified"))
    if not sub:
        raise HTTPException(status_code=401, detail="Apple token missing sub")
    return {"sub": sub, "email": email, "email_verified": email_verified}


def verify_google_id_token(id_token: str) -> dict:
    """Verify a Google Sign-In identity token. Raises HTTPException on failure."""
    if not id_token or not isinstance(id_token, str):
        raise HTTPException(status_code=400, detail="Missing Google identity token")
    audiences = _google_audiences()
    if not audiences:
        raise HTTPException(
            status_code=503,
            detail="GOOGLE_AUDIENCES not configured on the server",
        )
    try:
        signing_key = _get_google_jwks_client().get_signing_key_from_jwt(id_token)
        claims = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=audiences,
            options={"require": ["exp", "iat", "iss", "aud", "sub"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Google token expired")
    except jwt.InvalidAudienceError:
        raise HTTPException(status_code=401, detail="Google token audience mismatch")
    except jwt.InvalidTokenError as e:
        logger.warning("Google token rejected: %s", e)
        raise HTTPException(status_code=401, detail="Google token invalid")
    except Exception as e:
        logger.error("Google token verification error: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail="Google key fetch failed")

    iss = claims.get("iss")
    if iss not in _GOOGLE_ISS:
        raise HTTPException(status_code=401, detail="Google token issuer mismatch")

    sub = claims.get("sub") or ""
    email = claims.get("email")
    email_verified = _coerce_email_verified(claims.get("email_verified"))
    if not sub:
        raise HTTPException(status_code=401, detail="Google token missing sub")
    return {"sub": sub, "email": email, "email_verified": email_verified}
