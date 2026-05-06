"""Tests for /admin/geography — specifically the activated-users + avg
study-hours columns added on top of the existing per-country user count.

The shape we contract on:
  countries[i] = {
      country: str,
      users: int,                          # total users with this country set
      activated_users: int,                # users with >= 1 study session row
      avg_study_hours_per_activated: float # User.total_study_minutes / activated / 60
  }

`avg_study_hours_per_activated` deliberately uses User.total_study_minutes
(the canonical aggregate that already excludes abandoned + not-yet-completed
sessions) so we don't double-count or include phantom credit. Activated is
deliberately broader than User.total_sessions because it counts users who
*started* a timer even if they later abandoned or never completed it —
that's the right activation definition for marketing/funnel purposes.
"""
from tests.conftest import make_user, admin_headers

import models


class TestAdminGeographyActivation:
    def test_user_with_no_session_counts_as_unactivated(self, client, db):
        u = make_user(db, "no-session@example.com", "password123", "nosess")
        u.country = "Brazil"
        db.commit()

        body = client.get("/admin/geography", headers=admin_headers()).json()
        br = next((c for c in body["countries"] if c["country"] == "Brazil"), None)
        assert br is not None
        assert br["users"] == 1
        assert br["activated_users"] == 0
        # No activated users → avg is 0, not NaN/None.
        assert br["avg_study_hours_per_activated"] == 0

    def test_user_with_started_session_counts_as_activated(self, client, db, alice, alice_headers):
        alice.country = "Argentina"
        db.commit()
        # Just starting (no /complete) is enough — that's the "at least 1
        # timer" semantic the dashboard label promises.
        client.post("/sessions/start", json={"duration_minutes": 25}, headers=alice_headers)

        body = client.get("/admin/geography", headers=admin_headers()).json()
        ar = next((c for c in body["countries"] if c["country"] == "Argentina"), None)
        assert ar is not None
        assert ar["users"] == 1
        assert ar["activated_users"] == 1
        # No completed sessions yet → total_study_minutes is 0 → avg hrs is 0.
        assert ar["avg_study_hours_per_activated"] == 0

    def test_avg_study_hours_uses_total_study_minutes(self, client, db, alice, alice_headers, bob, bob_headers):
        """Two activated users in the same country with different credited
        minutes — the avg should be the mean in hours, rounded to 2dp.
        Uses User.total_study_minutes directly (set in-test) to avoid
        coupling to the /complete endpoint's exact crediting logic.
        """
        alice.country = "Vietnam"
        alice.total_study_minutes = 60   # 1 hr
        bob.country = "Vietnam"
        bob.total_study_minutes = 180    # 3 hr
        db.commit()
        # Make both "activated" by giving each a started session.
        client.post("/sessions/start", json={"duration_minutes": 25}, headers=alice_headers)
        client.post("/sessions/start", json={"duration_minutes": 25}, headers=bob_headers)

        body = client.get("/admin/geography", headers=admin_headers()).json()
        vn = next((c for c in body["countries"] if c["country"] == "Vietnam"), None)
        assert vn is not None
        assert vn["users"] == 2
        assert vn["activated_users"] == 2
        # (60 + 180) / 2 / 60 = 2.0 hrs
        assert vn["avg_study_hours_per_activated"] == 2.0

    def test_country_filter_excludes_blank(self, client, db):
        u = make_user(db, "blank-country@example.com", "password123", "blank")
        u.country = ""
        db.commit()
        body = client.get("/admin/geography", headers=admin_headers()).json()
        # Empty-string country must never show up — protects the dashboard
        # from a "" row that looks like a country with no name.
        assert all(c["country"] for c in body["countries"])

    def test_unactivated_users_dont_distort_avg(self, client, db, alice, alice_headers):
        """If a country has 100 users but only 1 has ever started a timer,
        the avg study hrs should reflect that 1 activated user — not be
        diluted by the 99 who never started anything.
        """
        alice.country = "Algeria"
        alice.total_study_minutes = 120  # 2 hr
        db.commit()
        client.post("/sessions/start", json={"duration_minutes": 25}, headers=alice_headers)

        # 99 unactivated users in the same country.
        for i in range(99):
            u = make_user(db, f"un-{i}@example.com", "password123", f"un{i}")
            u.country = "Algeria"
            # Note: NOT activated. total_study_minutes left at default (0).
        db.commit()

        body = client.get("/admin/geography", headers=admin_headers()).json()
        dz = next((c for c in body["countries"] if c["country"] == "Algeria"), None)
        assert dz is not None
        assert dz["users"] == 100
        assert dz["activated_users"] == 1
        # Just alice's 120 min / 1 / 60 = 2.0 hrs — the 99 unactivated rows
        # must NOT pull the avg down toward 0.
        assert dz["avg_study_hours_per_activated"] == 2.0
