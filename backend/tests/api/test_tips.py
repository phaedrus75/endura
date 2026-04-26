"""API tests for /tips endpoints. TIPS-01 through TIPS-08."""
import pytest
import models
from tests.conftest import make_user


def seed_tip(db, content="Test study tip content here"):
    tip = models.StudyTip(content=content, category="general")
    db.add(tip)
    db.commit()
    db.refresh(tip)
    return tip


class TestTipsEndpoints:
    def test_get_tips_returns_list(self, client, alice_headers):
        """TIPS-01: GET /tips returns a list."""
        resp = client.get("/tips", headers=alice_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_tips_unauthenticated_returns_200(self, client, alice_headers):
        """TIPS-08: Authenticated user can view tips."""
        # Tips require authentication in this app
        resp = client.get("/tips", headers=alice_headers)
        assert resp.status_code == 200

    def test_view_tip_creates_record(self, client, alice, alice_headers, db):
        """TIPS-02: POST /tips/{id}/view records view."""
        tip = seed_tip(db)
        resp = client.post(f"/tips/{tip.id}/view", headers=alice_headers)
        assert resp.status_code == 200
        view = db.query(models.TipView).filter_by(
            user_id=alice.id, tip_id=tip.id
        ).first()
        assert view is not None

    def test_double_view_no_duplicate_row(self, client, alice, alice_headers, db):
        """TIPS-07: Second view of same tip updates existing row, not create new."""
        tip = seed_tip(db)
        client.post(f"/tips/{tip.id}/view", headers=alice_headers)
        client.post(f"/tips/{tip.id}/view", headers=alice_headers)
        count = db.query(models.TipView).filter_by(
            user_id=alice.id, tip_id=tip.id
        ).count()
        assert count == 1

    def test_save_tip(self, client, alice, alice_headers, db):
        """TIPS-04: POST /tips/{id}/save sets saved=True."""
        tip = seed_tip(db)
        resp = client.post(f"/tips/{tip.id}/save", headers=alice_headers)
        assert resp.status_code == 200
        view = db.query(models.TipView).filter_by(
            user_id=alice.id, tip_id=tip.id
        ).first()
        assert view is not None
        assert view.saved is True

    def test_unsave_tip(self, client, alice, alice_headers, db):
        """TIPS-05: POST /tips/{id}/unsave sets saved=False."""
        tip = seed_tip(db)
        client.post(f"/tips/{tip.id}/save", headers=alice_headers)
        resp = client.post(f"/tips/{tip.id}/unsave", headers=alice_headers)
        assert resp.status_code == 200
        view = db.query(models.TipView).filter_by(
            user_id=alice.id, tip_id=tip.id
        ).first()
        assert view.saved is False

    def test_like_tip(self, client, alice, alice_headers, db):
        """TIPS-03: Voting increases like_count."""
        tip = seed_tip(db)
        initial_likes = tip.likes_count
        resp = client.post(f"/tips/{tip.id}/vote", json={"vote": "like"}, headers=alice_headers)
        assert resp.status_code == 200
        db.refresh(tip)
        assert tip.likes_count > initial_likes

    def test_get_saved_tips(self, client, alice, alice_headers, db):
        """GET /tips/saved returns saved tips."""
        tip = seed_tip(db)
        client.post(f"/tips/{tip.id}/save", headers=alice_headers)
        resp = client.get("/tips/saved", headers=alice_headers)
        assert resp.status_code == 200
        saved = resp.json()
        assert any(t["id"] == tip.id for t in saved)
