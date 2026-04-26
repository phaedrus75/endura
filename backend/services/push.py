"""Expo Push Notifications service.

Sends push notifications via Expo's HTTP/2 push API. Wraps token validation,
batch sending (Expo accepts up to 100 messages per request), receipt parsing,
and DB logging via PushLog.

References
----------
- https://docs.expo.dev/push-notifications/sending-notifications/
- https://docs.expo.dev/push-notifications/receiving-notifications/

Design
------
- Send is best-effort + non-blocking: callers should never `await` the network
  on the request hot path. The convenience helpers below take a `db: Session`
  and write a PushLog row regardless of outcome so the admin dashboard always
  has visibility.
- Token format: 'ExponentPushToken[xxx]' (or the bare 'expo://' variant).
  We validate cheaply, anything else is dropped early with status='dropped'.
- DeviceNotRegistered errors auto-clear the user's push_token so we stop
  spamming dead devices and they can re-register on next install.
- We deliberately do NOT verify Expo receipts in real time (would require a
  separate poll job). Tickets with status='ok' are stored as 'sent'. Add a
  receipts cron job later if you want true delivery confirmation.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Iterable, Optional

import httpx
from sqlalchemy.orm import Session

import models

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts"
TOKEN_RE = re.compile(r"^Expo(nentPushToken)?\[[A-Za-z0-9_-]+\]$")
MAX_BATCH = 100


# ─── Categories ──────────────────────────────────────────────────────────
# Map a push category to the user-preference column that gates it. The
# `notification_enabled` master switch always wins (set False = silence all).
CATEGORY_PREF_COLUMN = {
    "badge": "notif_badges_enabled",
    "friend": "notif_friends_enabled",
    "reminder": "notif_reminders_enabled",
    "campaign": "notif_marketing_enabled",
    "marketing": "notif_marketing_enabled",
    "system": None,  # always send (account/security/critical)
}


def is_valid_expo_token(token: Optional[str]) -> bool:
    """Cheap shape check. Real validation only happens at send time."""
    if not token or not isinstance(token, str):
        return False
    return bool(TOKEN_RE.match(token.strip()))


def _user_can_receive(user: models.User, category: str) -> tuple[bool, str | None]:
    """Returns (allowed, reason_if_not). Order: archived > master > category."""
    if not user:
        return False, "user_missing"
    if getattr(user, "is_archived", False):
        return False, "user_archived"
    if not user.push_token or not is_valid_expo_token(user.push_token):
        return False, "no_valid_token"
    if not bool(user.notification_enabled):
        return False, "master_off"
    pref_col = CATEGORY_PREF_COLUMN.get(category)
    if pref_col is not None and not bool(getattr(user, pref_col, True)):
        return False, f"category_off:{category}"
    return True, None


def _render(template: models.PushTemplate, variables: dict) -> tuple[str, str]:
    """Render {placeholder} variables into title/body. Mirrors EmailTemplate logic."""
    title = template.title or ""
    body = template.body or ""
    for key, val in (variables or {}).items():
        token = "{" + key + "}"
        title = title.replace(token, str(val))
        body = body.replace(token, str(val))
    return title, body


# ─── Low-level send ──────────────────────────────────────────────────────

def _post_to_expo(messages: list[dict]) -> list[dict]:
    """POST a batch (≤100) to Expo. Returns the per-message ticket array.

    Expo can return either a single object or a list — normalise to list.
    Network errors raise; let the caller decide retry policy.
    """
    if not messages:
        return []
    headers = {
        "accept": "application/json",
        "accept-encoding": "gzip, deflate",
        "content-type": "application/json",
    }
    with httpx.Client(timeout=10.0) as client:
        resp = client.post(EXPO_PUSH_URL, json=messages, headers=headers)
        resp.raise_for_status()
        payload = resp.json()
    data = payload.get("data") if isinstance(payload, dict) else payload
    if data is None:
        return []
    if isinstance(data, dict):
        return [data]
    return list(data)


def _log(
    db: Session,
    *,
    user_id: int | None,
    push_token: str | None,
    template_key: str | None,
    category: str | None,
    title: str | None,
    body: str | None,
    status: str,
    expo_ticket_id: str | None = None,
    error_code: str | None = None,
    error_message: str | None = None,
) -> None:
    try:
        db.add(models.PushLog(
            user_id=user_id,
            push_token=push_token,
            template_key=template_key,
            category=category,
            title=title,
            body=body,
            expo_ticket_id=expo_ticket_id,
            status=status,
            error_code=error_code,
            error_message=(error_message or "")[:500] if error_message else None,
        ))
        db.commit()
    except Exception as e:
        # Never let a logging failure break the caller. Rollback so the parent
        # transaction (e.g. the badge award) can still commit cleanly.
        logger.error(f"PushLog insert failed: {e}")
        try:
            db.rollback()
        except Exception:
            pass


def _handle_device_not_registered(db: Session, user: models.User) -> None:
    """When Expo says the token is dead, clear it so we stop sending."""
    try:
        user.push_token = None
        user.push_token_updated_at = datetime.utcnow()
        db.commit()
        logger.info(f"Cleared dead push_token for user {user.id}")
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass


# ─── Public API ──────────────────────────────────────────────────────────

def send_to_user(
    db: Session,
    user: models.User,
    *,
    title: str,
    body: str,
    category: str = "marketing",
    template_key: str | None = None,
    deep_link: str | None = None,
    data: dict | None = None,
) -> dict:
    """Send a single push to one user. Honours per-category preferences.

    Returns {ok: bool, status: str, reason?: str}. Never raises.
    """
    allowed, reason = _user_can_receive(user, category)
    if not allowed:
        _log(
            db, user_id=user.id, push_token=user.push_token, template_key=template_key,
            category=category, title=title, body=body, status="dropped",
            error_code=reason, error_message=None,
        )
        return {"ok": False, "status": "dropped", "reason": reason}

    msg: dict[str, Any] = {
        "to": user.push_token,
        "title": title[:80],
        "body": body[:220],
        "sound": "default",
        "priority": "high",
        "data": {"category": category, **(data or {}), **({"deep_link": deep_link} if deep_link else {})},
    }
    if category == "badge":
        msg["badge"] = 1  # bump app icon badge

    try:
        tickets = _post_to_expo([msg])
    except Exception as e:
        logger.error(f"Expo push failed for user {user.id}: {e}")
        _log(
            db, user_id=user.id, push_token=user.push_token, template_key=template_key,
            category=category, title=title, body=body, status="failed",
            error_code="network_error", error_message=str(e),
        )
        return {"ok": False, "status": "failed", "reason": "network_error"}

    ticket = tickets[0] if tickets else {}
    if ticket.get("status") == "ok":
        _log(
            db, user_id=user.id, push_token=user.push_token, template_key=template_key,
            category=category, title=title, body=body, status="sent",
            expo_ticket_id=ticket.get("id"),
        )
        return {"ok": True, "status": "sent", "ticket_id": ticket.get("id")}

    err = (ticket.get("details") or {}).get("error") if isinstance(ticket, dict) else None
    msg_err = ticket.get("message") if isinstance(ticket, dict) else None
    _log(
        db, user_id=user.id, push_token=user.push_token, template_key=template_key,
        category=category, title=title, body=body, status="failed",
        error_code=err, error_message=msg_err,
    )
    if err == "DeviceNotRegistered":
        _handle_device_not_registered(db, user)
    return {"ok": False, "status": "failed", "reason": err or msg_err}


def send_template_to_user(
    db: Session,
    user: models.User,
    template_key: str,
    variables: dict | None = None,
    *,
    skip_if_already_sent: bool = False,
) -> dict:
    """Look up a PushTemplate by key, render variables, send."""
    tmpl = db.query(models.PushTemplate).filter(
        models.PushTemplate.template_key == template_key,
        models.PushTemplate.is_active == True,  # noqa: E712
    ).first()
    if not tmpl:
        return {"ok": False, "status": "dropped", "reason": "template_missing"}

    if skip_if_already_sent:
        already = db.query(models.PushLog.id).filter(
            models.PushLog.user_id == user.id,
            models.PushLog.template_key == template_key,
            models.PushLog.status == "sent",
        ).first()
        if already:
            return {"ok": False, "status": "dropped", "reason": "already_sent"}

    title, body = _render(tmpl, variables or {})
    return send_to_user(
        db, user,
        title=title, body=body,
        category=tmpl.category,
        template_key=template_key,
        deep_link=tmpl.deep_link,
    )


def broadcast_to_users(
    db: Session,
    users: Iterable[models.User],
    *,
    title: str,
    body: str,
    category: str = "marketing",
    template_key: str | None = None,
    deep_link: str | None = None,
    data: dict | None = None,
) -> dict:
    """Batch-send to many users. Returns aggregate counts.

    Splits into chunks of 100 (Expo's max batch size). Drops users who fail
    the prefs check before hitting the network. Logs every attempt.
    """
    eligible: list[models.User] = []
    drops = 0
    for u in users:
        allowed, reason = _user_can_receive(u, category)
        if allowed:
            eligible.append(u)
        else:
            drops += 1
            _log(
                db, user_id=u.id, push_token=u.push_token, template_key=template_key,
                category=category, title=title, body=body, status="dropped",
                error_code=reason,
            )
    if not eligible:
        return {"sent": 0, "dropped": drops, "failed": 0, "total": drops}

    sent = 0
    failed = 0
    for i in range(0, len(eligible), MAX_BATCH):
        chunk = eligible[i:i + MAX_BATCH]
        messages = [{
            "to": u.push_token,
            "title": title[:80],
            "body": body[:220],
            "sound": "default",
            "priority": "high",
            "data": {"category": category, **(data or {}), **({"deep_link": deep_link} if deep_link else {})},
        } for u in chunk]

        try:
            tickets = _post_to_expo(messages)
        except Exception as e:
            logger.error(f"Expo broadcast batch failed ({len(chunk)} msgs): {e}")
            for u in chunk:
                failed += 1
                _log(
                    db, user_id=u.id, push_token=u.push_token, template_key=template_key,
                    category=category, title=title, body=body, status="failed",
                    error_code="network_error", error_message=str(e),
                )
            continue

        for u, ticket in zip(chunk, tickets):
            if ticket.get("status") == "ok":
                sent += 1
                _log(
                    db, user_id=u.id, push_token=u.push_token, template_key=template_key,
                    category=category, title=title, body=body, status="sent",
                    expo_ticket_id=ticket.get("id"),
                )
            else:
                failed += 1
                err = (ticket.get("details") or {}).get("error") if isinstance(ticket, dict) else None
                _log(
                    db, user_id=u.id, push_token=u.push_token, template_key=template_key,
                    category=category, title=title, body=body, status="failed",
                    error_code=err, error_message=ticket.get("message"),
                )
                if err == "DeviceNotRegistered":
                    _handle_device_not_registered(db, u)

    return {"sent": sent, "failed": failed, "dropped": drops, "total": sent + failed + drops}
