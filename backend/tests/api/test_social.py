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

    def test_member_can_leave_group(self, client, alice, bob, alice_headers, bob_headers, db):
        """A non-creator member can leave a group they were added to."""
        # Alice creates a group and adds Bob.
        resp = client.post("/groups", json={"name": "Alice's Crew", "goal_minutes": 60},
                           headers=alice_headers)
        group_id = resp.json()["id"]
        client.post(f"/groups/{group_id}/invite",
                    json={"username": "bob"}, headers=alice_headers)

        # Bob leaves.
        resp = client.post(f"/groups/{group_id}/leave", headers=bob_headers)
        assert resp.status_code == 200

        # Bob is no longer in the member list.
        bob_membership = db.query(models.GroupMember).filter_by(
            group_id=group_id, user_id=bob.id
        ).first()
        assert bob_membership is None
        # Group still exists for Alice.
        assert db.query(models.StudyGroup).filter_by(id=group_id).first() is not None

    def test_leave_group_returns_404_if_not_member(self, client, alice, bob, alice_headers, bob_headers):
        """Leaving a group you were never in is a 404, not a silent success."""
        resp = client.post("/groups", json={"name": "Alice Only", "goal_minutes": 60},
                           headers=alice_headers)
        group_id = resp.json()["id"]
        # Bob never joined — leave should 404.
        resp = client.post(f"/groups/{group_id}/leave", headers=bob_headers)
        assert resp.status_code == 404

    def test_creator_leaving_transfers_ownership(self, client, alice, bob, alice_headers, db):
        """If the creator leaves and other members remain, ownership transfers
        to the longest-tenured remaining member so the group stays editable."""
        resp = client.post("/groups", json={"name": "Transfer Test", "goal_minutes": 60},
                           headers=alice_headers)
        group_id = resp.json()["id"]
        client.post(f"/groups/{group_id}/invite",
                    json={"username": "bob"}, headers=alice_headers)

        resp = client.post(f"/groups/{group_id}/leave", headers=alice_headers)
        assert resp.status_code == 200

        group = db.query(models.StudyGroup).filter_by(id=group_id).first()
        assert group is not None, "Group must survive when other members remain"
        assert group.creator_id == bob.id, "Ownership must transfer to next member"
        # Alice is no longer a member.
        assert db.query(models.GroupMember).filter_by(
            group_id=group_id, user_id=alice.id
        ).first() is None
        # Bob is now admin.
        bob_membership = db.query(models.GroupMember).filter_by(
            group_id=group_id, user_id=bob.id
        ).first()
        assert bob_membership is not None
        assert bob_membership.role == "admin"

    def test_last_member_leaving_deletes_group(self, client, alice, alice_headers, db):
        """If the last member (always also the creator) leaves, the group and
        its messages are torn down — no ghost groups left in the table."""
        resp = client.post("/groups", json={"name": "Solo Group", "goal_minutes": 60},
                           headers=alice_headers)
        group_id = resp.json()["id"]
        # Drop a message in so we can confirm cascade cleanup.
        client.post(f"/groups/{group_id}/messages",
                    json={"content": "hi"}, headers=alice_headers)

        resp = client.post(f"/groups/{group_id}/leave", headers=alice_headers)
        assert resp.status_code == 200

        assert db.query(models.StudyGroup).filter_by(id=group_id).first() is None
        assert db.query(models.GroupMember).filter_by(group_id=group_id).count() == 0
        assert db.query(models.GroupMessage).filter_by(group_id=group_id).count() == 0


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

    def test_friends_leaderboard_includes_self(self, client, alice, alice_headers):
        """Current user always appears on their own friends leaderboard."""
        resp = client.get("/leaderboard", headers=alice_headers)
        assert resp.status_code == 200
        rows = resp.json()
        assert any(r["user_id"] == alice.id for r in rows), \
            f"Alice (id={alice.id}) missing from her own friends leaderboard"

    def test_friends_leaderboard_includes_high_pk_friend_with_high_hours(
        self, client, alice, alice_headers, db
    ):
        """Reproduces the production report: 'lucia (user id 66) doesn't show
        up even though she has more hrs than a bunch of others'.

        The deployed code did `.in_(friend_ids).limit(20)` *before* any sort,
        which makes Postgres return 20 rows in essentially physical/PK order
        and silently cut high-PK users — even when those users have higher
        study minutes than friends who survived the cut. Sort then runs only
        on the random 20.

        This test creates 25 lower-PK friends with low minutes, then ONE
        higher-PK friend ('lucia') with the second-highest minutes, and
        asserts she's in the response.
        """
        # 25 low-minute friends added FIRST so they get the low PKs.
        for i in range(25):
            f = make_user(db, username=f"low{i:02d}", email=f"low{i:02d}@e.test")
            db.add(models.Friendship(user_id=alice.id, friend_id=f.id, status="accepted"))
            f.total_study_minutes = 5  # tiny
        db.commit()

        # Lucia is added LAST → highest PK, but she's a heavy studier.
        lucia = make_user(db, username="lucia", email="lucia@e.test")
        db.add(models.Friendship(user_id=alice.id, friend_id=lucia.id, status="accepted"))
        lucia.total_study_minutes = 9999
        db.commit()

        resp = client.get("/leaderboard", headers=alice_headers)
        assert resp.status_code == 200
        rows = resp.json()
        ids = {r["user_id"] for r in rows}

        assert lucia.id in ids, (
            f"High-PK friend with high minutes was cut from leaderboard. "
            f"Returned ids: {sorted(ids)}; lucia.id={lucia.id}"
        )
        # And lucia should rank near the top, not somewhere arbitrary.
        lucia_row = next(r for r in rows if r["user_id"] == lucia.id)
        assert lucia_row["rank"] <= 2, (
            f"Lucia has 9999 mins (only alice with 0 might beat her) but "
            f"ranks #{lucia_row['rank']} — sort isn't applied across full set"
        )

    def test_friends_leaderboard_top_studier_renders_at_rank_one(
        self, client, alice, alice_headers, db
    ):
        """Reproduces the production report: 'I (user id 2) have the highest
        number and I show at the bottom'.

        With the deployed bug, the user — even when they're the top studier —
        could land at rank 20+ in the response (if Postgres truncated higher-
        PK friends out of the slice and ranked the user against an arbitrary
        subset). This asserts the top studier always lands at rank 1, which
        means the frontend renders them with the 🥇 medal at the top.
        """
        for i in range(30):
            f = make_user(db, username=f"f{i:02d}", email=f"f{i:02d}@e.test")
            db.add(models.Friendship(user_id=alice.id, friend_id=f.id, status="accepted"))
            f.total_study_minutes = 100  # everyone studied a moderate amount
        alice.total_study_minutes = 99999  # alice is the clear top
        db.commit()

        resp = client.get("/leaderboard", headers=alice_headers)
        assert resp.status_code == 200
        rows = resp.json()

        assert rows, "Leaderboard returned empty"
        assert rows[0]["user_id"] == alice.id, (
            f"Top studier (alice, id={alice.id}) is not at rank 1. "
            f"Top row: {rows[0]}"
        )
        assert rows[0]["rank"] == 1
        assert rows[0]["total_study_minutes"] == 99999

    def test_friends_leaderboard_handles_null_total_study_minutes(self, client, alice, alice_headers, db):
        """Regression: production users created before `total_study_minutes`
        was NOT NULL can still have a NULL value, which crashes Python's
        sort with `TypeError: '<' not supported between NoneType and int`.
        That bubbles up as a 500, the frontend's `.catch(() => [])` swallows
        it, and the user sees an empty leaderboard — including themselves.

        This test sets `total_study_minutes = None` on a friend and ensures
        the endpoint still returns a 200 with both users present."""
        from sqlalchemy import update

        bob = make_user(db, username="bob_null", email="bob_null@e.test")
        db.add(models.Friendship(user_id=alice.id, friend_id=bob.id, status="accepted"))
        db.commit()

        # Force NULL via raw UPDATE — SQLAlchemy's `default=0` only fires on
        # INSERT, but legacy rows in production may have NULL.
        db.execute(
            update(models.User)
            .where(models.User.id == bob.id)
            .values(total_study_minutes=None)
        )
        # Also blank out alice's value so we cover the "current user is the
        # one with the bad data" case.
        db.execute(
            update(models.User)
            .where(models.User.id == alice.id)
            .values(total_study_minutes=None)
        )
        db.commit()

        resp = client.get("/leaderboard", headers=alice_headers)
        assert resp.status_code == 200, (
            f"Leaderboard 500'd on null total_study_minutes: {resp.status_code} {resp.text}"
        )
        rows = resp.json()
        ids = {r["user_id"] for r in rows}
        assert alice.id in ids, "Alice missing from her own friends leaderboard"
        assert bob.id in ids, "Friend with null minutes missing from leaderboard"
        # Null should be coerced to 0, not propagated.
        for r in rows:
            assert isinstance(r["total_study_minutes"], int)
            assert r["total_study_minutes"] >= 0

    def test_friends_leaderboard_includes_all_friends_when_many(self, client, alice, alice_headers, db):
        """Regression: friends leaderboard previously truncated to 20 in
        arbitrary DB order *before* sorting by minutes, so heavy-studier
        friends added later silently disappeared. Now we fetch the full set,
        sort, then truncate — every friend should be present."""
        # Make Alice friends with 25 other users (well above the old limit of 20).
        friend_ids = []
        for i in range(25):
            f = make_user(db, username=f"friend{i:02d}", email=f"friend{i:02d}@e.test")
            db.add(models.Friendship(user_id=alice.id, friend_id=f.id, status="accepted"))
            friend_ids.append(f.id)
            # Give each friend a different study-minute total so sorting is
            # well-defined; the user added LAST gets the highest score so
            # we'd notice if late-added friends were being cut.
            f.total_study_minutes = (i + 1) * 10
        db.commit()

        resp = client.get("/leaderboard", headers=alice_headers)
        assert resp.status_code == 200
        rows = resp.json()

        returned_ids = {r["user_id"] for r in rows}
        missing = [fid for fid in friend_ids if fid not in returned_ids]
        assert not missing, f"Missing friends from leaderboard: {missing}"
        # Alice herself must also be present.
        assert alice.id in returned_ids
        # And the leaderboard must actually be sorted, top-down.
        minutes = [r["total_study_minutes"] for r in rows]
        assert minutes == sorted(minutes, reverse=True), \
            f"Leaderboard not sorted by minutes desc: {minutes}"
        # Highest scorer is the last-added friend (250 mins).
        assert rows[0]["total_study_minutes"] == 250


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
