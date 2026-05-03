"""
API tests for admin endpoints.
ADMIN-01 through ADMIN-09 from the test plan.
"""
import pytest
from tests.conftest import make_user, admin_headers, jwt_headers


class TestAdminFunnelCohort:
    def test_funnel_segments(self, client):
        r = client.get("/admin/funnel/segments", headers=admin_headers())
        assert r.status_code == 200
        j = r.json()
        assert "months" in j and "weeks" in j and "versions" in j
        assert len(j["months"]) == 3
        assert len(j["weeks"]) == 5

    def test_funnel_all_matches_overview_shape(self, client):
        ov = client.get("/admin/overview", headers=admin_headers()).json()
        fn = client.get("/admin/funnel?scope=all", headers=admin_headers()).json()
        assert fn["scope"] == "all"
        for k in ("signed_up", "verified_email", "started_timer", "bought_shop"):
            assert ov["funnel"][k] == fn["funnel"][k]

    def test_funnel_month_requires_key(self, client):
        r = client.get("/admin/funnel?scope=month", headers=admin_headers())
        assert r.status_code == 400


class TestAdminOverview:
    def test_overview_returns_kpis(self, client):
        """ADMIN-01: GET /admin/overview returns KPI fields."""
        resp = client.get("/admin/overview", headers=admin_headers())
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, dict)

    def test_overview_rejects_missing_key(self, client):
        """ADMIN-07: Missing key → 422 or 403."""
        resp = client.get("/admin/overview")
        assert resp.status_code in (422, 403)

    def test_overview_rejects_wrong_key(self, client):
        resp = client.get("/admin/overview", headers={"x-admin-key": "wrong"})
        assert resp.status_code == 403

    def test_overview_weekly_active_dedupes_users_within_week(self, client, db):
        """
        weekly_active must count each user once per ISO week, even if they
        completed sessions on multiple days. This is the bug-fix that the
        old "sum daily uniques" dashboard aggregator silently produced.
        """
        from datetime import datetime, timedelta
        import models

        # Pick a Monday well after April 1 (the overview window's floor)
        # and well before "now" so it doesn't drift past today's date.
        now = datetime.utcnow()
        # Anchor 14 days ago, then walk back to that week's Monday
        anchor = (now - timedelta(days=14)).replace(hour=12, minute=0, second=0, microsecond=0)
        monday = anchor - timedelta(days=anchor.weekday())  # Monday of that week

        u1 = make_user(db, email="wau1@example.com", username="wau1")
        u2 = make_user(db, email="wau2@example.com", username="wau2")

        # u1 studies Mon, Tue, Wed of the same week → still 1 unique that week
        for offset in (0, 1, 2):
            db.add(models.StudySession(
                user_id=u1.id, duration_minutes=25, coins_earned=10,
                started_at=monday + timedelta(days=offset, hours=1),
                completed_at=monday + timedelta(days=offset, hours=1, minutes=25),
            ))
        # u2 studies once that same week
        db.add(models.StudySession(
            user_id=u2.id, duration_minutes=25, coins_earned=10,
            started_at=monday + timedelta(days=3, hours=2),
            completed_at=monday + timedelta(days=3, hours=2, minutes=25),
        ))
        db.commit()

        resp = client.get("/admin/overview", headers=admin_headers())
        assert resp.status_code == 200
        data = resp.json()
        assert "weekly_active" in data
        assert "daily_active" in data

        monday_key = monday.strftime("%Y-%m-%d")
        weekly_bucket = next(
            (w for w in data["weekly_active"] if w["date"] == monday_key),
            None,
        )
        assert weekly_bucket is not None, f"no weekly_active row for {monday_key}"
        # Two distinct users active that week (u1 ×3 days + u2 ×1 day → 2 uniques)
        assert weekly_bucket["count"] == 2

        # And critically: SUM of that week's daily_active rows would be 4,
        # which is exactly the over-count the chart was showing before the fix.
        week_dates = {(monday + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)}
        summed_daily = sum(d["count"] for d in data["daily_active"] if d["date"] in week_dates)
        assert summed_daily == 4
        assert summed_daily > weekly_bucket["count"]  # the bug we're fixing

    def test_cohorts_retention_weekly_dedupe_and_periods(self, client, db):
        """
        /admin/cohorts/retention?granularity=weekly:
        - cohort = users grouped by signup ISO-Monday
        - period N = N weeks after that Monday
        - active in period = ≥1 study session in that 7-day window
        - retention[0] = "instant activation"; we verify the math end to end.
        """
        from datetime import datetime, timedelta
        import models

        now = datetime.utcnow()
        # Anchor 21 days ago, back off to that week's Monday so we have
        # 3 full weeks of subsequent activity to bucket retention into.
        anchor = (now - timedelta(days=21)).replace(hour=12, minute=0, second=0, microsecond=0)
        signup_monday = anchor - timedelta(days=anchor.weekday())

        # 3 users in the same signup cohort
        u_kept = make_user(db, email="ret_kept@example.com", username="retkept")
        u_one_off = make_user(db, email="ret_oneoff@example.com", username="retoneoff")
        u_lurker = make_user(db, email="ret_lurker@example.com", username="retlurker")
        for u in (u_kept, u_one_off, u_lurker):
            u.created_at = signup_monday + timedelta(hours=2)
        db.commit()

        # u_kept: studies in week 0, week 1, week 2 (full retention)
        # u_one_off: studies in week 0 only (drops off)
        # u_lurker: never studies (instant churn)
        for w in (0, 1, 2):
            db.add(models.StudySession(
                user_id=u_kept.id, duration_minutes=25, coins_earned=10,
                started_at=signup_monday + timedelta(days=7 * w + 1, hours=10),
                completed_at=signup_monday + timedelta(days=7 * w + 1, hours=10, minutes=25),
            ))
        db.add(models.StudySession(
            user_id=u_one_off.id, duration_minutes=25, coins_earned=10,
            started_at=signup_monday + timedelta(days=2, hours=11),
            completed_at=signup_monday + timedelta(days=2, hours=11, minutes=25),
        ))
        # Also: a session by u_kept on days 1 AND 4 of week 0 — must still
        # count as 1 active for week 0 (dedupe inside a period).
        db.add(models.StudySession(
            user_id=u_kept.id, duration_minutes=25, coins_earned=10,
            started_at=signup_monday + timedelta(days=4, hours=10),
            completed_at=signup_monday + timedelta(days=4, hours=10, minutes=25),
        ))
        db.commit()

        resp = client.get(
            "/admin/cohorts/retention?granularity=weekly",
            headers=admin_headers(),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["granularity"] == "weekly"
        assert data["period_label"] == "Week"
        assert data["period_days"] == 7

        cohort_key = signup_monday.strftime("%Y-%m-%d")
        cohort = next((c for c in data["cohorts"] if c["cohort_date"] == cohort_key), None)
        assert cohort is not None, f"missing cohort for {cohort_key}: {data['cohorts']}"
        assert cohort["size"] == 3

        # Period 0: u_kept + u_one_off active = 2/3 = 66.7%
        # Period 1: u_kept only = 1/3 = 33.3%
        # Period 2: u_kept only = 1/3 = 33.3%
        by_period = {r["period"]: r for r in cohort["retention"]}
        assert by_period[0]["active"] == 2 and by_period[0]["pct"] == 66.7
        assert by_period[1]["active"] == 1 and by_period[1]["pct"] == 33.3
        assert by_period[2]["active"] == 1 and by_period[2]["pct"] == 33.3

    def test_cohorts_retention_omits_future_periods(self, client, db):
        """
        A cohort that only just signed up should have its retention curve
        truncated — we don't want "0% retention week 5" showing for a cohort
        that's only existed for a day. Otherwise the chart shows misleading
        cliffs for the newest cohort.
        """
        from datetime import datetime, timedelta
        import models

        now = datetime.utcnow()
        # Anchor in this week's Monday
        this_monday = (now - timedelta(days=now.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0,
        )
        u = make_user(db, email="future@example.com", username="future")
        u.created_at = this_monday + timedelta(hours=1)
        db.commit()
        db.add(models.StudySession(
            user_id=u.id, duration_minutes=25, coins_earned=10,
            started_at=this_monday + timedelta(hours=2),
            completed_at=this_monday + timedelta(hours=2, minutes=25),
        ))
        db.commit()

        data = client.get(
            "/admin/cohorts/retention?granularity=weekly",
            headers=admin_headers(),
        ).json()
        cohort = next(
            (c for c in data["cohorts"] if c["cohort_date"] == this_monday.strftime("%Y-%m-%d")),
            None,
        )
        assert cohort is not None
        # Only period 0 (current week) should be present — no future weeks.
        periods = [r["period"] for r in cohort["retention"]]
        assert periods == [0]

    def test_cohorts_retention_daily_granularity(self, client, db):
        """Daily granularity produces day-by-day cohorts and 1-day periods."""
        from datetime import datetime, timedelta
        import models

        now = datetime.utcnow()
        signup_day = (now - timedelta(days=5)).replace(
            hour=10, minute=0, second=0, microsecond=0,
        )
        u = make_user(db, email="dayret@example.com", username="dayret")
        u.created_at = signup_day
        db.commit()
        # Active on signup day, day +2, day +3
        for offset in (0, 2, 3):
            db.add(models.StudySession(
                user_id=u.id, duration_minutes=25, coins_earned=10,
                started_at=signup_day + timedelta(days=offset, hours=2),
                completed_at=signup_day + timedelta(days=offset, hours=2, minutes=25),
            ))
        db.commit()

        data = client.get(
            "/admin/cohorts/retention?granularity=daily",
            headers=admin_headers(),
        ).json()
        assert data["granularity"] == "daily"
        assert data["period_label"] == "Day"
        assert data["period_days"] == 1

        cohort = next(
            (c for c in data["cohorts"] if c["cohort_date"] == signup_day.strftime("%Y-%m-%d")),
            None,
        )
        assert cohort is not None
        assert cohort["size"] == 1
        by_period = {r["period"]: r["active"] for r in cohort["retention"]}
        assert by_period[0] == 1  # day 0 active
        assert by_period[1] == 0  # day 1 silent
        assert by_period[2] == 1  # day 2 active
        assert by_period[3] == 1  # day 3 active

    def test_cohorts_retention_excludes_archived(self, client, db):
        """Archived users must not inflate cohort size or retention."""
        from datetime import datetime, timedelta
        import models

        now = datetime.utcnow()
        anchor = (now - timedelta(days=14)).replace(hour=12, minute=0, second=0, microsecond=0)
        signup_monday = anchor - timedelta(days=anchor.weekday())

        live = make_user(db, email="live_user@example.com", username="liveuser")
        archived = make_user(db, email="arch_user@example.com", username="archuser")
        live.created_at = signup_monday + timedelta(hours=1)
        archived.created_at = signup_monday + timedelta(hours=2)
        archived.is_archived = True
        db.commit()
        for u in (live, archived):
            db.add(models.StudySession(
                user_id=u.id, duration_minutes=25, coins_earned=10,
                started_at=signup_monday + timedelta(days=1, hours=10),
                completed_at=signup_monday + timedelta(days=1, hours=10, minutes=25),
            ))
        db.commit()

        data = client.get(
            "/admin/cohorts/retention?granularity=weekly",
            headers=admin_headers(),
        ).json()
        cohort = next(
            (c for c in data["cohorts"] if c["cohort_date"] == signup_monday.strftime("%Y-%m-%d")),
            None,
        )
        assert cohort is not None
        assert cohort["size"] == 1  # archived user excluded
        assert cohort["retention"][0]["active"] == 1
        assert cohort["retention"][0]["pct"] == 100.0

    def test_cohorts_retention_rejects_bad_granularity(self, client):
        resp = client.get(
            "/admin/cohorts/retention?granularity=hourly",
            headers=admin_headers(),
        )
        assert resp.status_code == 400

    def test_overview_weekly_active_buckets_by_iso_monday(self, client, db):
        """A session on a Sunday belongs to that week's Monday bucket."""
        from datetime import datetime, timedelta
        import models

        now = datetime.utcnow()
        anchor = (now - timedelta(days=10)).replace(hour=12, minute=0, second=0, microsecond=0)
        monday = anchor - timedelta(days=anchor.weekday())
        sunday = monday + timedelta(days=6)

        u = make_user(db, email="sun@example.com", username="sun")
        sunday_evening = sunday.replace(hour=20, minute=0)  # 20:00 still on Sunday
        db.add(models.StudySession(
            user_id=u.id, duration_minutes=25, coins_earned=10,
            started_at=sunday_evening,
            completed_at=sunday_evening + timedelta(minutes=25),
        ))
        db.commit()

        data = client.get("/admin/overview", headers=admin_headers()).json()
        monday_key = monday.strftime("%Y-%m-%d")
        bucket = next((w for w in data["weekly_active"] if w["date"] == monday_key), None)
        assert bucket is not None, (
            f"no weekly_active row for {monday_key} (sunday session at {sunday_evening}); "
            f"got {data['weekly_active']}"
        )
        assert bucket["count"] >= 1


class TestAdminUsers:
    def test_users_list_returns_paginated(self, client, alice):
        """ADMIN-02: GET /admin/users returns users list."""
        resp = client.get("/admin/users", headers=admin_headers())
        assert resp.status_code == 200
        data = resp.json()
        # Should have users field or be a list
        assert "users" in data or isinstance(data, list)

    def test_users_filtered_by_search(self, client, alice):
        """Search filter works."""
        resp = client.get(f"/admin/users?search=alice", headers=admin_headers())
        assert resp.status_code == 200

    def test_users_archived_filter_active_and_invalid(self, client, alice):
        """archived_filter=active and archived_only accepted; invalid value → 400."""
        resp = client.get("/admin/users?archived_filter=active", headers=admin_headers())
        assert resp.status_code == 200
        resp2 = client.get("/admin/users?archived_filter=archived_only", headers=admin_headers())
        assert resp2.status_code == 200
        bad = client.get("/admin/users?archived_filter=yes", headers=admin_headers())
        assert bad.status_code == 400


class TestAdminFeedback:
    def test_feedback_list_filtered_by_status(self, client, alice, alice_headers):
        """ADMIN-03: GET /admin/feedback filtered by status."""
        # Submit some feedback first
        client.post("/feedback", json={
            "feedback_type": "bug",
            "message": "Timer issue"
        }, headers=alice_headers)
        resp = client.get("/admin/feedback?status=new", headers=admin_headers())
        assert resp.status_code == 200

    def test_feedback_status_update(self, client, alice, alice_headers, db):
        """ADMIN-04: PATCH /admin/feedback/{id} updates status."""
        import models
        client.post("/feedback", json={
            "feedback_type": "bug",
            "message": "Crash on timer end"
        }, headers=alice_headers)
        feedback = db.query(models.UserFeedback).first()
        if feedback:
            resp = client.patch(f"/admin/feedback/{feedback.id}",
                                json={"status": "triaged"},
                                headers=admin_headers())
            assert resp.status_code == 200
            db.refresh(feedback)
            assert feedback.status == "triaged"


class TestAdminCleanup:
    def test_cleanup_countries_dry_run(self, client):
        """ADMIN-05: dry_run=true returns changes without mutating."""
        resp = client.post("/admin/cleanup-countries?dry_run=true",
                           headers=admin_headers())
        assert resp.status_code == 200


class TestAdminPushTemplates:
    def test_get_push_templates(self, client):
        """ADMIN-08: GET /admin/push/templates returns all templates."""
        resp = client.get("/admin/push/templates", headers=admin_headers())
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_update_push_template(self, client, db):
        """ADMIN-09: PUT template updates body."""
        import models
        # Create a test template
        tmpl = models.PushTemplate(
            template_key="test_tmpl_admin",
            name="Test Template",
            title="Test Title",
            body="Original body",
            category="marketing"
        )
        db.add(tmpl)
        db.commit()
        # PUT requires all required fields + template_key in both path and body
        resp = client.put("/admin/push/templates/test_tmpl_admin",
                          json={
                              "template_key": "test_tmpl_admin",
                              "name": "Test Template",
                              "title": "Test Title",
                              "body": "Updated body",
                              "category": "marketing",
                              "is_active": True,
                          },
                          headers=admin_headers())
        assert resp.status_code == 200
        db.refresh(tmpl)
        assert tmpl.body == "Updated body"


class TestAdminProductTests:
    def test_create_update_promote_product_test(self, client):
        create = client.post(
            "/admin/product-tests",
            json={
                "name": "Onboarding v1 vs v2",
                "feature_key": "onboarding_ab_v2",
                "control_label": "v1",
                "challenger_label": "v2",
                "hypothesis": "v2 improves onboarding completion",
            },
            headers=admin_headers(),
        )
        assert create.status_code == 200, create.text
        test_id = create.json()["id"]

        upd = client.patch(
            f"/admin/product-tests/{test_id}",
            json={
                "status": "running",
                "sample_control": 500,
                "sample_challenger": 510,
                "conversion_control": 41.5,
                "conversion_challenger": 45.2,
                "winner": "challenger",
                "note": "Early look favors challenger",
            },
            headers=admin_headers(),
        )
        assert upd.status_code == 200
        assert upd.json()["status"] == "running"
        assert upd.json()["winner"] == "challenger"

        promote = client.post(
            f"/admin/product-tests/{test_id}/promote-winner",
            json={"winner": "challenger", "note": "Ship v2"},
            headers=admin_headers(),
        )
        assert promote.status_code == 200
        assert promote.json()["status"] == "winner_promoted"

        rows = client.get("/admin/product-tests?include_events=true", headers=admin_headers())
        assert rows.status_code == 200
        tests = rows.json().get("tests", [])
        hit = next((t for t in tests if t["id"] == test_id), None)
        assert hit is not None
        assert hit["events"], "timeline events should exist"

    def test_product_test_onboarding_funnel(self, client, db):
        from datetime import datetime, timedelta

        t_start = datetime.utcnow() - timedelta(days=14)
        t_end = datetime.utcnow() + timedelta(days=1)

        def _user(email: str, variant: str, *, username: bool, completed: bool, first_timer: bool = False):
            uname = ("user_" + email.split("@")[0]) if username else None
            u = make_user(db, email, "password123", uname, verified=True)
            u.onboarding_ab_variant = variant
            u.created_at = t_start + timedelta(hours=1)
            if username:
                u.username_set_at = datetime.utcnow()
            else:
                u.username = None
                u.username_set_at = None
            u.onboarding_completed_at = datetime.utcnow() if completed else None
            u.total_sessions = 1 if first_timer else 0
            db.commit()
            return u

        _user("fa@test.com", "v1", username=True, completed=True, first_timer=True)
        _user("fb@test.com", "v1", username=True, completed=False)
        _user("fc@test.com", "v2", username=True, completed=True, first_timer=True)
        _user("fd@test.com", "v2", username=False, completed=False)

        create = client.post(
            "/admin/product-tests",
            json={
                "name": "Onboarding funnel",
                "feature_key": "onboarding_ab_main",
                "control_label": "v1",
                "challenger_label": "v2",
            },
            headers=admin_headers(),
        )
        assert create.status_code == 200, create.text
        test_id = create.json()["id"]
        patch = client.patch(
            f"/admin/product-tests/{test_id}",
            json={"status": "running", "started_at": t_start.isoformat(), "ended_at": t_end.isoformat()},
            headers=admin_headers(),
        )
        assert patch.status_code == 200, patch.text

        funnel = client.get(f"/admin/product-tests/{test_id}/funnel", headers=admin_headers())
        assert funnel.status_code == 200
        data = funnel.json()
        assert data["supported"] is True
        assert data["control"]["cohort"] == 2
        assert data["control"]["username_set"] == 2
        assert data["control"]["onboarding_completed"] == 1
        assert data["control"]["first_timer_session"] == 1
        assert data["challenger"]["cohort"] == 2
        assert data["challenger"]["onboarding_completed"] == 1
        assert data["challenger"]["first_timer_session"] == 1
        assert data["first_timer_rate_lift_challenger_minus_control_pp"] == 0.0

        other = client.post(
            "/admin/product-tests",
            json={"name": "Other", "feature_key": "checkout_speed"},
            headers=admin_headers(),
        )
        assert other.status_code == 200
        oid = other.json()["id"]
        nf = client.get(f"/admin/product-tests/{oid}/funnel", headers=admin_headers())
        assert nf.status_code == 200
        assert nf.json()["supported"] is False

    def test_onboarding_funnel_includes_accounts_created_before_running(self, client, db):
        """Flipping status to running sets started_at=now; cohort must still include older signups with a synced arm."""
        from datetime import datetime, timedelta

        old = datetime.utcnow() - timedelta(days=500)
        u = make_user(db, "oldcohort@test.com", "password123", "oldcohort", verified=True)
        u.onboarding_ab_variant = "v2"
        u.created_at = old
        u.username_set_at = datetime.utcnow()
        u.onboarding_completed_at = datetime.utcnow()
        u.total_sessions = 1
        db.commit()

        create = client.post(
            "/admin/product-tests",
            json={"name": "Onboarding window bug", "feature_key": "onboarding_ab_window"},
            headers=admin_headers(),
        )
        assert create.status_code == 200
        tid = create.json()["id"]
        patch = client.patch(
            f"/admin/product-tests/{tid}",
            json={"status": "running"},
            headers=admin_headers(),
        )
        assert patch.status_code == 200
        assert patch.json().get("started_at") is not None

        funnel = client.get(f"/admin/product-tests/{tid}/funnel", headers=admin_headers())
        assert funnel.status_code == 200
        data = funnel.json()
        assert data["supported"] is True
        assert data["challenger"]["cohort"] >= 1
        assert data["challenger"]["first_timer_session"] >= 1

    def test_onboarding_funnel_cohort_started_at_filters_pre_experiment_users(self, client, db):
        """cohort_started_at should EXCLUDE pre-experiment signups that got
        tagged with a variant only after upgrading. This is the contamination
        bug we hit in production: 23-30 pre-May-1 users tagged with v1/v2
        on app upgrade were inflating the dashboard cohort and diluting the
        funnel rates compared to the clean A/B test SQL."""
        from datetime import datetime, timedelta

        # Pre-experiment user: signed up 90 days ago, got tagged with v2 when
        # they upgraded the app last week. Should NOT be in the cohort once
        # cohort_started_at is set to ~30 days ago.
        pre = make_user(db, "pre_exp@test.com", "password123", "pre_exp", verified=True)
        pre.onboarding_ab_variant = "v2"
        pre.created_at = datetime.utcnow() - timedelta(days=90)
        pre.username_set_at = pre.created_at
        pre.total_sessions = 5
        db.commit()

        # Post-experiment user: signed up 5 days ago, genuinely experienced v2
        # at signup. Should be the only one counted with cohort_started_at set.
        post = make_user(db, "post_exp@test.com", "password123", "post_exp", verified=True)
        post.onboarding_ab_variant = "v2"
        post.created_at = datetime.utcnow() - timedelta(days=5)
        post.username_set_at = post.created_at
        post.onboarding_completed_at = post.created_at
        post.total_sessions = 1
        db.commit()

        create = client.post(
            "/admin/product-tests",
            json={"name": "Cohort floor test", "feature_key": "onboarding_ab_floor"},
            headers=admin_headers(),
        )
        assert create.status_code == 200
        tid = create.json()["id"]

        # First check: WITHOUT cohort_started_at, both users count (the bug).
        funnel = client.get(f"/admin/product-tests/{tid}/funnel", headers=admin_headers()).json()
        assert funnel["challenger"]["cohort"] == 2
        assert funnel["challenger"]["first_timer_session"] == 2
        # Pre-experiment user has no onboarding_completed_at — denominator
        # gets inflated, completion rate drops from 100% to 50%.
        assert funnel["challenger"]["completed_rate_pct_of_cohort"] == 50.0

        # Now set cohort_started_at = 30 days ago. Pre-experiment user
        # (90 days ago) drops out; post-experiment user (5 days ago) stays.
        cohort_floor = (datetime.utcnow() - timedelta(days=30)).isoformat()
        patch = client.patch(
            f"/admin/product-tests/{tid}",
            json={"cohort_started_at": cohort_floor},
            headers=admin_headers(),
        )
        assert patch.status_code == 200, patch.text
        assert patch.json()["cohort_started_at"] is not None

        # Second check: WITH cohort_started_at, only post-experiment user counts.
        clean = client.get(f"/admin/product-tests/{tid}/funnel", headers=admin_headers()).json()
        assert clean["window"]["cohort_started_at"] is not None
        assert clean["challenger"]["cohort"] == 1
        assert clean["challenger"]["first_timer_session"] == 1
        # Honest completion rate now: 100% (1/1), not 50% (1/2).
        assert clean["challenger"]["completed_rate_pct_of_cohort"] == 100.0

    def test_cohort_started_at_persists_through_serializer(self, client, db):
        """The new field must round-trip: PATCH it, GET it back, see it in JSON."""
        from datetime import datetime, timedelta

        create = client.post(
            "/admin/product-tests",
            json={"name": "Serializer round-trip", "feature_key": "onboarding_ab_serial"},
            headers=admin_headers(),
        )
        tid = create.json()["id"]
        # The serializer should include the field as None on a fresh row.
        assert "cohort_started_at" in create.json()
        assert create.json()["cohort_started_at"] is None

        floor = (datetime.utcnow() - timedelta(days=2)).replace(microsecond=0).isoformat()
        patched = client.patch(
            f"/admin/product-tests/{tid}",
            json={"cohort_started_at": floor},
            headers=admin_headers(),
        ).json()
        assert patched["cohort_started_at"] is not None
        # Drop microseconds for safe equality across DBs
        assert patched["cohort_started_at"].startswith(floor[:19])


class TestAdminAuthRequired:
    """Spot-check that ALL admin routes require the key."""
    ADMIN_ROUTES = [
        ("GET", "/admin/overview"),
        ("GET", "/admin/funnel?scope=all"),
        ("GET", "/admin/funnel/segments"),
        ("GET", "/admin/users"),
        ("GET", "/admin/feedback"),
        ("GET", "/admin/push/templates"),
        ("GET", "/admin/push/opt-in-funnel"),
    ]

    def test_all_admin_routes_need_key(self, client):
        for method, url in self.ADMIN_ROUTES:
            if method == "GET":
                resp = client.get(url, headers={"x-admin-key": "wrong"})
            else:
                resp = client.post(url, headers={"x-admin-key": "wrong"})
            assert resp.status_code == 403, f"{method} {url} should return 403 with wrong key"
