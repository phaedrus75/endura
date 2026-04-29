"""Tests for POST /webhooks/resend (email open/click/delivery tracking)."""
import pytest
import models


@pytest.fixture(autouse=True)
def _clear_resend_secret(monkeypatch):
    monkeypatch.delenv("RESEND_WEBHOOK_SECRET", raising=False)


def test_resend_opened_updates_email_log(client, db, alice):
    log = models.EmailLog(
        user_id=alice.id,
        email=alice.email,
        template_key="welcome",
        subject="Hi",
        resend_message_id="re_msg_abc123",
    )
    db.add(log)
    db.commit()
    rid = log.resend_message_id

    resp = client.post(
        "/webhooks/resend",
        json={
            "type": "email.opened",
            "data": {"email_id": rid},
        },
    )
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}

    db.refresh(log)
    assert log.opened is True
    assert log.opened_at is not None


def test_resend_bounce_archives_user_without_email_log(client, db, alice):
    """Bounce suppression must commit even when no EmailLog row matches."""
    resp = client.post(
        "/webhooks/resend",
        json={
            "type": "email.bounced",
            "data": {"email_id": "unknown-id", "to": alice.email},
        },
    )
    assert resp.status_code == 200

    db.refresh(alice)
    assert alice.is_archived is True
