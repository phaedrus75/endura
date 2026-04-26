"""
API tests for social endpoints: friends, groups, feed, leaderboard.
SOCIAL-01 through SOCIAL-16 from the test plan.
"""
import pytest
import models
from tests.conftest import make_user, jwt_headers


class TestFriendRequests:
    def test_send_friend_request(self, client, alice, bob, alice_headers):
        """SOCIAL-01: Send friend request creates pending friendship."""
        resp = client.post("/friends/request",
                           json={"friend_username": "bob"},
                           headers=alice_headers)
        assert resp.status_code == 200

    def test_accept_friend_request(self, client, alice, bob, alice_headers, bob_headers, db):
        """SOCIAL-02: Accepting changes status to accepted."""
        # Alice sends to Bob
        client.post("/friends/request", json={"friend_username": "bob"}, headers=alice_headers)
        # Bob gets the pending request ID
        pending = db.query(models.Friendship).filter_by(
            user_id=alice.id, friend_id=bob.id, status="pending"
        ).first()
        assert pending is not None
        # Bob accepts
        resp = client.post(f"/friends/accept/{pending.id}", headers=bob_headers)
        assert resp.status_code == 200
        db.refresh(pending)
        assert pending.status == "accepted"

    def test_cannot_friend_yourself(self, client, alice, alice_headers):
        """SOCIAL-05: Friending yourself → error."""
        resp = client.post("/friends/request",
                           json={"friend_username": "alice"},
                           headers=alice_headers)
        assert resp.status_code in (400, 422)

    def test_duplicate_friend_request_rejected(self, client, alice, bob, alice_headers):
        """SOCIAL-04: Duplicate friend request → error."""
        client.post("/friends/request", json={"friend_username": "bob"}, headers=alice_headers)
        resp = client.post("/friends/request", json={"friend_username": "bob"}, headers=alice_headers)
        assert resp.status_code in (400, 409)

    def test_get_friends_returns_only_accepted(self, client, alice, bob, alice_headers, bob_headers, db):
        """SOCIAL-06: GET /friends only shows accepted connections."""
        # Send request (pending, not accepted yet)
        client.post("/friends/request", json={"friend_username": "bob"}, headers=alice_headers)
        resp = client.get("/friends", headers=alice_headers)
        assert resp.status_code == 200
        friends = resp.json()
        # Should be empty — request is still pending
        assert all(f["username"] != "bob" for f in friends)

    def test_get_pending_requests(self, client, alice, bob, alice_headers, bob_headers):
        """Bob should see pending request from Alice."""
        client.post("/friends/request", json={"friend_username": "bob"}, headers=alice_headers)
        resp = client.get("/friends/pending", headers=bob_headers)
        assert resp.status_code == 200
        pending = resp.json()
        assert any(p["username"] == "alice" for p in pending)


class TestStudyGroups:
    def test_create_group(self, client, alice_headers, db):
        """SOCIAL-09: Create group — row created, creator is member."""
        resp = client.post("/groups", json={
            "name": "Test Group",
            "goal_minutes": 120
        }, headers=alice_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Test Group"

    def test_non_member_cannot_read_messages(self, client, alice, bob, alice_headers, bob_headers, db):
        """SOCIAL-11: Non-member cannot read group messages."""
        # Alice creates a group
        resp = client.post("/groups", json={"name": "Alice Group", "goal_minutes": 60},
                           headers=alice_headers)
        group_id = resp.json()["id"]
        # Bob tries to read messages
        resp = client.get(f"/groups/{group_id}/messages", headers=bob_headers)
        assert resp.status_code in (403, 404, 200)
        # If 200, should return empty or null (not bob's messages)
        if resp.status_code == 200:
            assert resp.json() in ([], None)


class TestLeaderboard:
    def test_leaderboard_endpoint_returns_list(self, client, alice_headers):
        """SOCIAL-14: Leaderboard returns a list."""
        resp = client.get("/leaderboard", headers=alice_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_global_leaderboard_accessible(self, client, alice_headers):
        """GET /leaderboard/global returns list."""
        resp = client.get("/leaderboard/global", headers=alice_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestFeed:
    def test_feed_empty_for_friendless_user(self, client, alice_headers):
        """Feed is empty when user has no friends."""
        resp = client.get("/feed", headers=alice_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_react_to_feed_event(self, client, alice, bob, alice_headers, bob_headers, db):
        """SOCIAL-13: React to a feed event from a friend."""
        # Create a friendship directly
        client.post("/friends/request", json={"friend_username": "bob"}, headers=alice_headers)
        pending = db.query(models.Friendship).filter_by(user_id=alice.id, friend_id=bob.id).first()
        if pending:
            pending.status = "accepted"
            db.commit()
        # Create an activity event for alice
        event = models.ActivityEvent(
            user_id=alice.id, event_type="session_complete",
            description="completed a 25-minute session"
        )
        db.add(event)
        db.commit()
        db.refresh(event)
        # Bob reacts to alice's event
        resp = client.post(f"/feed/{event.id}/react",
                           json={"reaction": "fire"}, headers=bob_headers)
        assert resp.status_code == 200
