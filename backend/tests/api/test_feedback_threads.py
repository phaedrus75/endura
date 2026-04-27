"""
Tests for Intercom-style feedback threads (admin replies, user inbox, read state).
"""
from __future__ import annotations

import pytest
from unittest.mock import patch

import models
from tests.conftest import admin_headers


VALID_TOKEN = "ExponentPushToken[testtoken123]"


def _ensure_support_reply_template(db):
    ex = db.query(models.PushTemplate).filter(
        models.PushTemplate.template_key == "support_reply"
    ).first()
    if ex:
        return
    db.add(
        models.PushTemplate(
            template_key="support_reply",
            name="Support team replied",
            title="The Endura team replied",
            body="{preview}",
            category="system",
            deep_link=None,
            is_active=True,
        )
    )
    db.commit()


def _submit_feedback(client, headers, *, user_id_via_auth=True, body="Hello", email=None):
    payload = {"feedback_type": "bug", "message": body}
    if email:
        payload["email"] = email
    return client.post("/feedback", json=payload, headers=headers if user_id_via_auth else None)


@pytest.fixture()
def support_template(db):
    _ensure_support_reply_template(db)


class TestAdminFeedbackReply:
    def test_admin_reply_persists_and_triages(self, client, alice, alice_headers, db, support_template):
        r = _submit_feedback(client, alice_headers, body="Crash on timer")
        assert r.status_code == 200
        fid = r.json()["id"]
        fb = db.query(models.UserFeedback).filter(models.UserFeedback.id == fid).first()
        assert fb.status == "new"

        rep = client.post(
            f"/admin/feedback/{fid}/reply",
            json={"message": "We fixed it in the next build."},
            headers=admin_headers(),
        )
        assert rep.status_code == 200
        data = rep.json()
        assert data["ok"] is True
        assert data["delivery"] == "push"
        assert data["message_id"]

        db.refresh(fb)
        assert fb.status == "triaged"
        row = db.query(models.FeedbackMessage).filter(
            models.FeedbackMessage.feedback_id == fid
        ).first()
        assert row is not None
        assert row.sender == "admin"
        assert "fixed" in row.body

    def test_admin_reply_pushes_authed_user(
        self, client, alice, alice_headers, db, support_template, mock_push_service
    ):
        client.put(
            "/users/me/push-token",
            json={"token": VALID_TOKEN, "platform": "ios"},
            headers=alice_headers,
        )
        r = _submit_feedback(client, alice_headers)
        fid = r.json()["id"]

        client.post(
            f"/admin/feedback/{fid}/reply",
            json={"message": "Thanks for the report!"},
            headers=admin_headers(),
        )
        assert mock_push_service.post.called

    def test_admin_reply_emails_anon_with_email(
        self, client, db, support_template, mock_resend
    ):
        r = client.post(
            "/feedback",
            json={
                "feedback_type": "question",
                "message": "Anonymous question",
                "email": "anon@example.com",
            },
        )
        assert r.status_code == 200
        fid = r.json()["id"]

        rep = client.post(
            f"/admin/feedback/{fid}/reply",
            json={"message": "Here is the answer."},
            headers=admin_headers(),
        )
        assert rep.status_code == 200
        assert rep.json()["delivery"] == "email"

        import resend

        assert resend.Emails.send.called

    def test_admin_reply_uncontactable_no_email(self, client, db, support_template, mock_resend):
        r = client.post(
            "/feedback",
            json={"feedback_type": "bug", "message": "No email at all"},
        )
        fid = r.json()["id"]

        with patch("main.push_service.send_template_to_user") as mock_push:
            rep = client.post(
                f"/admin/feedback/{fid}/reply",
                json={"message": "Nobody home."},
                headers=admin_headers(),
            )
        assert rep.status_code == 200
        assert rep.json()["delivery"] == "uncontactable"
        mock_push.assert_not_called()
        import resend

        assert not resend.Emails.send.called


class TestMeFeedbackInbox:
    def test_me_list_only_own_threads(self, client, alice, bob, alice_headers, bob_headers, db):
        ra = _submit_feedback(client, alice_headers, body="Alice issue")
        rb = _submit_feedback(client, bob_headers, body="Bob issue")
        assert ra.status_code == 200 and rb.status_code == 200

        la = client.get("/me/feedback", headers=alice_headers)
        lb = client.get("/me/feedback", headers=bob_headers)
        assert la.status_code == 200 and lb.status_code == 200
        a_ids = {x["id"] for x in la.json()["items"]}
        b_ids = {x["id"] for x in lb.json()["items"]}
        assert ra.json()["id"] in a_ids
        assert rb.json()["id"] not in a_ids
        assert rb.json()["id"] in b_ids

    def test_me_thread_404_for_other_user(
        self, client, alice, bob, alice_headers, bob_headers, db
    ):
        rb = _submit_feedback(client, bob_headers)
        fid = rb.json()["id"]
        r = client.get(f"/me/feedback/{fid}", headers=alice_headers)
        assert r.status_code == 404

    def test_unread_count_and_mark_read(
        self, client, alice, alice_headers, db, support_template
    ):
        r = _submit_feedback(client, alice_headers)
        fid = r.json()["id"]
        assert client.get("/me/feedback/unread-count", headers=alice_headers).json()["unread_count"] == 0

        client.post(
            f"/admin/feedback/{fid}/reply",
            json={"message": "Got it."},
            headers=admin_headers(),
        )
        assert client.get("/me/feedback/unread-count", headers=alice_headers).json()["unread_count"] == 1

        rr = client.post(f"/me/feedback/{fid}/read", headers=alice_headers)
        assert rr.status_code == 200
        assert rr.json()["marked"] >= 1
        assert client.get("/me/feedback/unread-count", headers=alice_headers).json()["unread_count"] == 0

    def test_me_thread_returns_messages(self, client, alice, alice_headers, db, support_template):
        r = _submit_feedback(client, alice_headers, body="Original")
        fid = r.json()["id"]
        client.post(
            f"/admin/feedback/{fid}/reply",
            json={"message": "Admin says hi"},
            headers=admin_headers(),
        )
        tr = client.get(f"/me/feedback/{fid}", headers=alice_headers)
        assert tr.status_code == 200
        data = tr.json()
        assert data["feedback"]["message"] == "Original"
        assert len(data["messages"]) == 1
        assert data["messages"][0]["sender"] == "admin"
        assert data["messages"][0]["body"] == "Admin says hi"


class TestAdminFeedbackDetail:
    def test_admin_get_detail_includes_messages(
        self, client, alice, alice_headers, db, support_template
    ):
        r = _submit_feedback(client, alice_headers)
        fid = r.json()["id"]
        client.post(
            f"/admin/feedback/{fid}/reply",
            json={"message": "Note from team"},
            headers=admin_headers(),
        )
        d = client.get(f"/admin/feedback/{fid}", headers=admin_headers())
        assert d.status_code == 200
        body = d.json()
        assert body["feedback"]["id"] == fid
        assert len(body["messages"]) == 1
